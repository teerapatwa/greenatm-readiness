/**
 * กฎของระบบ — โค้ดล้วน ไม่มีการเรียกโมเดล (PLAN §5.1 · §5.4.2 · §5.7)
 *
 * ทุกฟังก์ชันในไฟล์นี้เป็น pure function ที่รับข้อมูลเข้าแล้วคืนผลลัพธ์
 * ใช้ตัวเดียวกันทั้งในแอปและในสคริปต์ตรวจ — เทสต์ที่เขียนกฎขึ้นมาใหม่เอง
 * พิสูจน์ได้แค่ว่าคนเขียนคิดเหมือนเดิมสองครั้ง (PLAN §8.1)
 */

export type Milestone = {
  seq: number;
  name: string;
  weight: number;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  percentComplete: number;
};

export type Slip = { from: string; to: string; reason: string; by: string; at: string };

export type Item = {
  code: string;
  name: string;
  category: number;
  divisionId: string;
  ownerUserId: string | null;
  achievedLevel: number;
  lastYearLevel: number;
  targetLevel: number;
  percentWithinNextLevel: number;
  submittedThisCycle: boolean;
  dueDate: string;
  lastUpdated: string;
  milestones: Milestone[];
  slipHistory: Slip[];
};

export type Evidence = {
  id: string;
  itemCode: string;
  title: string;
  documentDate: string | null;
  uploadDate: string;
  proposedTier: "A" | "B" | "C" | "D" | null;
  proposedReason: string | null;
  confirmedTier: "A" | "B" | "C" | "D" | null;
  confirmedBy: string | null;
};

export type Settings = {
  at_risk_threshold_points: number;
  alert_lead_days: number;
  monthly_due_day: number;
  evidence_stale_months: number;
  slip_escalate_after: number;
  agent_max_tool_calls: number;
  agent_timeout_seconds: number;
};

export type Seed = {
  meta: { today: string; cycle: string; cycleDue: string; synthetic: boolean; note: string; formRef: string };
  settings: Settings;
  divisions: { id: string; name: string; nameEn: string; category: number }[];
  categories: { num: number; name: string; divisionId: string }[];
  users: { id: string; title: string; role: "owner" | "central" | "executive"; divisionId: string | null }[];
  items: Item[];
  evidence: Evidence[];
};

export type Verb = "NOTE" | "ASK" | "ESCALATE";

export type Alert = {
  rule: "A-DUESOON" | "A-OVERDUE" | "A-MILESTONE" | "A-SLIP" | "A-NOEV" | "A-NODATE" | "A-STALE";
  itemCode: string;
  verb: Verb;
  head: string;
  body: string;
  /** ผู้รับ — null คือ "ไม่มีผู้รับ" ซึ่งเป็นสิ่งที่ต้องเห็น ไม่ใช่สิ่งที่หายไปเงียบ ๆ */
  toOwner: string | null;
  toModerator: boolean;
};

const DAY = 86_400_000;

function days(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** ── แจ้งเตือน — §5.4.2 · ไม่มีโมเดลเกี่ยวข้อง ทุกกฎ re-derive จากฐานข้อมูลได้ ── */
export function buildAlerts(seed: Seed): Alert[] {
  const { today } = seed.meta;
  const s = seed.settings;
  const out: Alert[] = [];

  const push = (a: Alert) => out.push(a);
  const evidenceOf = (code: string) => seed.evidence.filter((e) => e.itemCode === code);

  for (const it of seed.items) {
    const owner = it.ownerUserId;
    const label = `${it.code} · ${it.name}`;
    const untilDue = days(today, it.dueDate);

    // ส่งข้อมูลรอบนี้
    if (!it.submittedThisCycle) {
      if (untilDue < 0) {
        push({
          rule: "A-OVERDUE", itemCode: it.code, verb: "ESCALATE",
          head: `เลยกำหนดส่ง ${Math.abs(untilDue)} วัน`,
          body: `${label} ยังไม่ส่งข้อมูลรอบนี้ · กำหนด ${it.dueDate}`,
          toOwner: owner, toModerator: true,
        });
      } else if (untilDue <= s.alert_lead_days) {
        push({
          rule: "A-DUESOON", itemCode: it.code, verb: "NOTE",
          head: `ครบกำหนดส่งในอีก ${untilDue} วัน`,
          body: `${label} ยังไม่ส่งข้อมูลรอบนี้ · กำหนด ${it.dueDate}`,
          toOwner: owner, toModerator: true,
        });
      }
    }

    // milestone เลยวันแผนแล้วยังไม่ 100%
    const late = it.milestones.filter((m) => days(today, m.plannedEnd) < 0 && m.percentComplete < 100);
    if (late.length > 0) {
      const worst = late[0];
      push({
        rule: "A-MILESTONE", itemCode: it.code, verb: "ASK",
        head: `แผนงานเลยกำหนด ${late.length} ขั้น`,
        body: `${label} · ${worst.name} วางแผนจบ ${worst.plannedEnd} ปัจจุบัน ${worst.percentComplete}%`,
        toOwner: owner, toModerator: true,
      });
    }

    // การเลื่อนแผน — ยกระดับตามจำนวนครั้ง ไม่ใช่เดาความรุนแรง
    const n = it.slipHistory.length;
    if (n > 0) {
      const verb: Verb = n >= s.slip_escalate_after ? "ESCALATE" : n === 2 ? "ASK" : "NOTE";
      const reasons = new Set(it.slipHistory.map((x) => x.reason));
      const same = reasons.size === 1 && n >= 2 ? " · เหตุผลเดิมทุกครั้ง" : "";
      push({
        rule: "A-SLIP", itemCode: it.code, verb,
        head: `เลื่อนแผนครั้งที่ ${n}${same}`,
        body: `${label} · ล่าสุด ${it.slipHistory[n - 1].from} → ${it.slipHistory[n - 1].to} (${it.slipHistory[n - 1].reason})`,
        toOwner: owner,
        toModerator: n >= 2, // ครั้งแรกไม่รบกวน moderator
      });
    }

    // หลักฐาน — ไปหาเจ้าของเท่านั้น
    const evs = evidenceOf(it.code);
    if (evs.length === 0) {
      push({
        rule: "A-NOEV", itemCode: it.code, verb: "ASK",
        head: "ยังไม่มีหลักฐานแนบเลย",
        body: `${label} · ระดับที่ยืนยันจะไม่ขยับจนกว่าจะมีหลักฐานชั้น A หรือ B`,
        toOwner: owner, toModerator: false,
      });
    }
    for (const e of evs) {
      if (e.documentDate === null) {
        push({
          rule: "A-NODATE", itemCode: it.code, verb: "ASK",
          head: "เอกสารไม่มีวันที่ในตัวเอกสาร",
          body: `${label} · ${e.id} ${e.title} — ระบบถามวันที่ ไม่เดาจากวันอัปโหลด`,
          toOwner: owner, toModerator: false,
        });
      } else if (monthsBetween(e.documentDate, today) > s.evidence_stale_months) {
        push({
          rule: "A-STALE", itemCode: it.code, verb: "ASK",
          head: `เอกสารเก่ากว่า ${s.evidence_stale_months} เดือน`,
          body: `${label} · ${e.id} ลงวันที่ ${e.documentDate}`,
          toOwner: owner, toModerator: false,
        });
      }
    }
  }
  return out;
}

export function alertCounts(alerts: Alert[]) {
  const byOwner: Record<string, number> = {};
  let orphan = 0;
  let moderator = 0;
  for (const a of alerts) {
    if (a.toModerator) moderator++;
    if (a.toOwner) byOwner[a.toOwner] = (byOwner[a.toOwner] ?? 0) + 1;
    else orphan++;
  }
  const ownerTotal = Object.values(byOwner).reduce((x, y) => x + y, 0) + orphan;
  return { moderator, byOwner, orphan, ownerTotal, executive: 0 };
}

/** ── สองตัวเลขที่ห้ามรวมกัน — §4.2 ───────────────────────────────────────── */
export function progressPercent(it: Item): number {
  const total = it.milestones.reduce((s, m) => s + m.weight, 0) || 1;
  return Math.round(it.milestones.reduce((s, m) => s + (m.weight * m.percentComplete) / 100, 0) / total * 100);
}

/** นับเฉพาะหลักฐานที่ "คนยืนยันแล้ว" และเป็นชั้น A หรือ B เท่านั้น */
export function verifiedPercent(it: Item, evidence: Evidence[]): number {
  const mine = evidence.filter((e) => e.itemCode === it.code);
  const countable = mine.filter((e) => e.confirmedTier === "A" || e.confirmedTier === "B");
  if (countable.length === 0) return 0;
  return Math.round((countable.length / Math.max(mine.length, 1)) * 100);
}

export type Verdict = "complete" | "nearly" | "onplan" | "needsfix" | "asked" | "escalate";

/**
 * Suggestion — กฎในโค้ด ไม่ใช่ผลจากโมเดล (PLAN §5.1)
 *
 * ลำดับสำคัญ: ตรวจหลักฐาน "ก่อน" ตรวจเป้า มิฉะนั้นรายการที่ถึงเป้าแต่ไม่มีหลักฐาน
 * จะขึ้นว่า "เสร็จสมบูรณ์" ซึ่งขัดกับกฎข้อแรกของทั้งระบบ (นี่คือ AC-26)
 * และบรรทัด escalate ต้องต่อท้ายเสมอเมื่อถึงเกณฑ์ ไม่ให้การวินิจฉัยอื่นกลบมันได้
 */
export function suggestion(
  it: Item,
  evidence: Evidence[],
  settings: Settings,
): { verdict: Verdict; reason: string; escalated: boolean } {
  const mine = evidence.filter((e) => e.itemCode === it.code);
  const countable = mine.filter((e) => e.confirmedTier === "A" || e.confirmedTier === "B");
  const escalated = it.slipHistory.length >= settings.slip_escalate_after;

  let verdict: Verdict;
  let reason: string;

  if (countable.length === 0) {
    // ← ตรวจหลักฐานก่อนเป้าเสมอ
    verdict = "needsfix";
    reason =
      mine.length === 0
        ? "ยังไม่มีหลักฐานแนบเลย — ระดับที่ยืนยันจะไม่ขยับ"
        : "มีเอกสารแต่ยังไม่มีชั้น A/B ที่ยืนยันแล้ว — แผนไม่ใช่หลักฐานผลลัพธ์";
  } else if (it.achievedLevel >= it.targetLevel) {
    verdict = "complete";
    reason = "ถึงระดับเป้าหมายแล้ว และมีหลักฐานที่ยืนยันรองรับ";
  } else if (it.percentWithinNextLevel >= 80) {
    verdict = "nearly";
    reason = "ใกล้ถึงระดับถัดไป";
  } else if (mine.some((e) => e.documentDate === null)) {
    verdict = "asked";
    reason = "ระบบขอวันที่ของเอกสารเพิ่ม";
  } else {
    verdict = "onplan";
    reason = "ดำเนินการตามแผน";
  }

  if (escalated) {
    verdict = "escalate";
    reason = `เลื่อนแผนครบ ${it.slipHistory.length} ครั้ง — ต้องการการตัดสินใจ ไม่ใช่การเร่ง · ${reason}`;
  }
  return { verdict, reason, escalated };
}

/** ── การคาดการณ์ — §5.7 · สูตรเดียว เผยแพร่ไว้ ไม่มีโมเดลเกี่ยวข้อง ───────── */
export function velocity(it: Item): number {
  return it.achievedLevel - it.lastYearLevel + it.percentWithinNextLevel / 100;
}

export function projectedLevel(it: Item, years: number, multiplier = 1): number {
  const v = Math.max(0, velocity(it)) * multiplier;
  return Math.min(5, it.achievedLevel + it.percentWithinNextLevel / 100 + v * years);
}

export const SCENARIOS = [
  { key: "same", label: "อัตราเท่าปีที่ผ่านมา", multiplier: 1 },
  { key: "faster", label: "เร็วขึ้น 50%", multiplier: 1.5 },
  { key: "stalled", label: "หยุดนิ่ง", multiplier: 0 },
] as const;

export function orgAverage(items: Item[], years: number, multiplier: number): number {
  if (items.length === 0) return 0;
  return items.reduce((s, i) => s + projectedLevel(i, years, multiplier), 0) / items.length;
}

export function stalledItems(items: Item[]): Item[] {
  return items.filter((i) => i.achievedLevel === i.lastYearLevel);
}

/** ── สถานะ On Track / At Risk / Delayed — §5.5 "โค้ดคำนวณ ไม่มีใครตั้งเอง" ─────
 *
 * ปิดช่องโหว่สองอย่างพร้อมกัน: R5 กำหนดให้มีสถานะ และ at_risk_threshold_points
 * เป็นค่าตั้งค่าที่เดิม **ไม่มีใครอ่าน** ซึ่งแย่กว่าไม่มีค่า เพราะอ่านเหมือนทำเสร็จแล้ว
 */
export type Status = "on_track" | "at_risk" | "delayed";

/** ความคืบหน้าที่ "ควรได้แล้ว" ตามปฏิทิน — เทียบตามน้ำหนักและช่วงวันแผนของแต่ละขั้น */
export function expectedPercent(it: Item, today: string): number {
  if (it.milestones.length === 0) return 0;
  const total = it.milestones.reduce((s, m) => s + m.weight, 0) || 1;
  const earned = it.milestones.reduce((s, m) => {
    const start = Date.parse(m.plannedStart);
    const end = Date.parse(m.plannedEnd);
    const now = Date.parse(today);
    if (now >= end) return s + m.weight;              // ช่วงนี้ควรจบแล้ว
    if (now <= start) return s;                        // ยังไม่ถึงคิว
    const span = end - start || 1;
    return s + (m.weight * (now - start)) / span;      // อยู่กลางช่วง คิดตามสัดส่วนเวลา
  }, 0);
  return Math.round((earned / total) * 100);
}

export function statusFor(it: Item, settings: Settings, today: string): Status {
  // ช้ากว่ากำหนดแบบชัดเจน — มีขั้นที่เลยวันแผนแล้วยังไม่จบ หรือยังไม่ส่งข้อมูลทั้งที่เลยกำหนด
  const lateMilestone = it.milestones.some(
    (m) => Date.parse(m.plannedEnd) < Date.parse(today) && m.percentComplete < 100,
  );
  const lateSubmission = !it.submittedThisCycle && Date.parse(it.dueDate) < Date.parse(today);
  if (lateMilestone || lateSubmission) return "delayed";

  // ตามหลังปฏิทินเกินเกณฑ์ที่ตั้งไว้ — เกณฑ์มาจาก app_setting แก้ได้จากหน้าจอ
  const gap = expectedPercent(it, today) - progressPercent(it);
  if (gap > settings.at_risk_threshold_points) return "at_risk";

  return "on_track";
}

export const STATUS_LABEL: Record<Status, string> = {
  on_track: "ตามแผน",
  at_risk: "เสี่ยง",
  delayed: "ช้ากว่าแผน",
};

/** ── "ยังขาดอะไร" — แผงในไฟล์ทีม · ตาราง item_gap ยังไม่มีใครเขียน จึง derive จากกฎ ──
 *
 * คืนทั้งข้อที่ครบแล้วและที่ยังขาด เพื่อให้หน้าจอขีดฆ่าข้อที่ครบได้แบบไฟล์ทีม
 */
export type Gap = { text: string; done: boolean };

export function gapsFor(it: Item, evidence: Evidence[], settings: Settings, today: string): Gap[] {
  const mine = evidence.filter((e) => e.itemCode === it.code);
  const countable = mine.filter((e) => e.confirmedTier === "A" || e.confirmedTier === "B");
  const out: Gap[] = [];

  out.push({
    text: "แนบหลักฐานเข้ารายการนี้",
    done: mine.length > 0,
  });
  out.push({
    text: "มีหลักฐานชั้น A หรือ B ที่ทีมกลางยืนยันแล้ว — “แผนไม่ใช่หลักฐานผลลัพธ์”",
    done: countable.length > 0,
  });

  const undated = mine.filter((e) => e.documentDate === null);
  if (undated.length > 0) {
    out.push({
      text: `ระบุวันที่ในเอกสารให้ครบ (${undated.map((e) => e.id).join(", ")}) — ระบบไม่เดาจากวันอัปโหลด`,
      done: false,
    });
  }

  const stale = mine.filter(
    (e) => e.documentDate !== null && monthsBetween(e.documentDate, today) > settings.evidence_stale_months,
  );
  if (stale.length > 0) {
    out.push({
      text: `เปลี่ยนหลักฐานที่เก่ากว่า ${settings.evidence_stale_months} เดือน (${stale.map((e) => e.id).join(", ")})`,
      done: false,
    });
  }

  if (it.milestones.length > 0) {
    const undone = it.milestones.filter((m) => m.percentComplete < 100);
    out.push({
      text: undone.length === 0
        ? "แผนงานครบทุกขั้น"
        : `ปิดแผนงานที่เหลือ ${undone.length} ขั้น (${undone.map((m) => m.name).join(", ")})`,
      done: undone.length === 0,
    });
  } else {
    out.push({ text: "วางแผนงานย่อยของรายการนี้", done: false });
  }

  if (it.achievedLevel < it.targetLevel) {
    out.push({
      text: `ไปให้ถึงระดับ ${it.targetLevel} ตามเป้าปีนี้ (ตอนนี้ระดับ ${it.achievedLevel})`,
      done: false,
    });
  }

  if (it.slipHistory.length >= settings.slip_escalate_after) {
    out.push({
      text: `ชี้แจงการเลื่อนแผน ${it.slipHistory.length} ครั้ง — ต้องการการตัดสินใจ ไม่ใช่การเร่ง`,
      done: false,
    });
  }

  return out;
}
