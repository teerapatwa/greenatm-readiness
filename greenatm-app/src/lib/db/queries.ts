import "server-only";
import { db } from "./index";
import type { Evidence, Item, Milestone, Seed, Settings, Slip } from "@/lib/data/rules";
import { SEED } from "@/lib/data/seed";

/**
 * อ่าน/เขียนฐานข้อมูล — คืนรูปข้อมูลเดียวกับ rules.ts ทุกตัว
 * เพื่อให้ pure function ใน rules.ts ใช้ได้เหมือนเดิมโดยไม่ต้องแก้แม้บรรทัดเดียว
 */

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const n = (v: unknown) => Number(v);

export function settings(): Settings {
  const rows = db().prepare("SELECT key,value FROM app_setting").all() as Row[];
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.key)] = Number(r.value);
  return out as unknown as Settings;
}

export function setSetting(key: string, value: number, actor: string) {
  const before = db().prepare("SELECT value FROM app_setting WHERE key=?").get(key) as Row | undefined;
  if (!before) throw new Error(`ไม่รู้จักค่าตั้งค่า "${key}"`);
  db().prepare("UPDATE app_setting SET value=?, updated_by=?, updated_at=? WHERE key=?")
    .run(String(value), actor, nowIso(), key);
  audit(actor, "set_setting", "app_setting", key, { value: before.value }, { value });
}

export function users() {
  return (db().prepare("SELECT id,title,role,division_id FROM app_user ORDER BY id").all() as Row[])
    .map((r) => ({
      id: String(r.id), title: String(r.title),
      role: String(r.role) as "owner" | "central" | "executive",
      divisionId: s(r.division_id),
    }));
}

export function userById(id: string) {
  return users().find((u) => u.id === id) ?? null;
}

export function divisions() {
  return (db().prepare("SELECT id,name,name_en,category FROM division ORDER BY id").all() as Row[])
    .map((r) => ({ id: String(r.id), name: String(r.name), nameEn: String(r.name_en), category: n(r.category) }));
}

export function categories() {
  return (db().prepare("SELECT num,name,division_id FROM assess_category ORDER BY num").all() as Row[])
    .map((r) => ({ num: n(r.num), name: String(r.name), divisionId: String(r.division_id) }));
}

function milestonesOf(code: string): Milestone[] {
  return (db().prepare(
    `SELECT seq,name,weight,planned_start,planned_end,actual_start,actual_end,percent_complete
     FROM milestone WHERE item_code=? ORDER BY seq`).all(code) as Row[])
    .map((r) => ({
      seq: n(r.seq), name: String(r.name), weight: n(r.weight),
      plannedStart: String(r.planned_start), plannedEnd: String(r.planned_end),
      actualStart: s(r.actual_start), actualEnd: s(r.actual_end),
      percentComplete: n(r.percent_complete),
    }));
}

function slipsOf(code: string): Slip[] {
  return (db().prepare(
    "SELECT from_date,to_date,reason,by_user,at FROM milestone_slip WHERE item_code=? ORDER BY id").all(code) as Row[])
    .map((r) => ({
      from: String(r.from_date), to: String(r.to_date), reason: String(r.reason),
      by: String(r.by_user), at: String(r.at),
    }));
}

export function items(): Item[] {
  return (db().prepare(
    `SELECT code,name,category,division_id,owner_user_id,achieved_level,last_year_level,
            target_level,percent_within_next_level,submitted_this_cycle,due_date,last_updated
     FROM tracked_item ORDER BY category, CAST(substr(code, instr(code,'.')+1) AS INTEGER)`).all() as Row[])
    .map((r) => ({
      code: String(r.code), name: String(r.name), category: n(r.category),
      divisionId: String(r.division_id), ownerUserId: s(r.owner_user_id),
      achievedLevel: n(r.achieved_level), lastYearLevel: n(r.last_year_level),
      targetLevel: n(r.target_level), percentWithinNextLevel: n(r.percent_within_next_level),
      submittedThisCycle: n(r.submitted_this_cycle) === 1,
      dueDate: String(r.due_date), lastUpdated: String(r.last_updated),
      milestones: milestonesOf(String(r.code)), slipHistory: slipsOf(String(r.code)),
    }));
}

export function itemByCode(code: string): Item | null {
  return items().find((i) => i.code === code) ?? null;
}

export function evidence(): Evidence[] {
  return (db().prepare(
    `SELECT id,item_code,title,document_date,upload_date,proposed_tier,proposed_reason,
            confirmed_tier,confirmed_by FROM evidence ORDER BY id`).all() as Row[])
    .map((r) => ({
      id: String(r.id), itemCode: String(r.item_code), title: String(r.title),
      documentDate: s(r.document_date), uploadDate: String(r.upload_date),
      proposedTier: s(r.proposed_tier) as Evidence["proposedTier"],
      proposedReason: s(r.proposed_reason),
      confirmedTier: s(r.confirmed_tier) as Evidence["confirmedTier"],
      confirmedBy: s(r.confirmed_by),
    }));
}

/** ชุดข้อมูลรูปเดียวกับ Seed — ส่งเข้า buildAlerts / suggestion ได้ตรง ๆ */
export function snapshot(): Seed {
  return {
    meta: SEED.meta,
    settings: settings(),
    divisions: divisions(),
    categories: categories(),
    users: users(),
    items: items(),
    evidence: evidence(),
  };
}

/** วันเวลาอ้างอิงของระบบ — ตรึงไว้ที่วันของชุดข้อมูล เพื่อให้เดโมและเทสต์ให้ผลเดิมทุกครั้ง */
export function today() {
  return SEED.meta.today;
}
export function nowIso() {
  return `${SEED.meta.today}T00:00:00.000Z`;
}

// ── audit_log ────────────────────────────────────────────────────────────────

export function audit(
  actor: string, action: string, entityType: string, entityId: string,
  before: unknown, after: unknown,
) {
  if (actor === "ai") {
    // ป้องกันซ้ำชั้นแอป นอกจาก CHECK ใน schema — §5.5 · AC-18
    throw new Error("audit_log.actor ห้ามเป็น 'ai' — การเปลี่ยนค่าจริงต้องเป็นการกระทำของคน");
  }
  db().prepare(
    "INSERT INTO audit_log (actor,action,entity_type,entity_id,before,after,at) VALUES (?,?,?,?,?,?,?)")
    .run(actor, action, entityType, entityId,
      before === null || before === undefined ? null : JSON.stringify(before),
      after === null || after === undefined ? null : JSON.stringify(after),
      new Date().toISOString());
}

export function auditFor(entityType: string, entityId: string) {
  return (db().prepare(
    "SELECT actor,action,before,after,at FROM audit_log WHERE entity_type=? AND entity_id=? ORDER BY id DESC")
    .all(entityType, entityId) as Row[])
    .map((r) => ({
      actor: String(r.actor), action: String(r.action),
      before: s(r.before), after: s(r.after), at: String(r.at),
    }));
}

export function auditCount() {
  const r = db().prepare("SELECT COUNT(*) AS c FROM audit_log").get() as Row;
  return n(r.c);
}

// ── การ์ดยืนยัน (pending) ────────────────────────────────────────────────────

export type Pending = {
  id: number; itemCode: string; milestoneSeq: number | null;
  field: "milestone_percent" | "percent_within_next_level";
  oldValue: string; newValue: string; actualDate: string | null;
  draftedBy: string; draftedFor: string; createdAt: string;
};

/**
 * ร่างการเปลี่ยนค่า — เขียนลงตาราง pending เท่านั้น ค่าจริงไม่ขยับ (AC-17)
 * draftedBy เป็น 'ai' ได้ เพราะยังไม่ใช่การเขียนค่าจริง
 */
export function draftProgress(a: {
  itemCode: string; milestoneSeq: number | null;
  field: Pending["field"]; newValue: number; actualDate: string | null;
  draftedBy: string; draftedFor: string;
}): Pending {
  const it = itemByCode(a.itemCode);
  if (!it) throw new Error(`ไม่พบรายการ ${a.itemCode}`);
  if (a.newValue < 0 || a.newValue > 100) throw new Error("ค่าต้องอยู่ระหว่าง 0–100");
  if (a.actualDate && !/^\d{4}-\d{2}-\d{2}$/.test(a.actualDate)) {
    throw new Error("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
  }

  let oldValue: number;
  if (a.field === "milestone_percent") {
    const m = it.milestones.find((x) => x.seq === a.milestoneSeq);
    if (!m) throw new Error(`ไม่พบแผนงานขั้นที่ ${a.milestoneSeq} ของ ${a.itemCode}`);
    oldValue = m.percentComplete;
  } else {
    oldValue = it.percentWithinNextLevel;
  }

  const info = db().prepare(
    `INSERT INTO pending_progress
     (item_code,milestone_seq,field,old_value,new_value,actual_date,drafted_by,drafted_for,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(a.itemCode, a.milestoneSeq, a.field, String(oldValue), String(a.newValue),
      a.actualDate, a.draftedBy, a.draftedFor, nowIso());

  return pendingById(Number(info.lastInsertRowid))!;
}

export function pendingById(id: number): Pending | null {
  const r = db().prepare(
    `SELECT id,item_code,milestone_seq,field,old_value,new_value,actual_date,
            drafted_by,drafted_for,created_at
     FROM pending_progress WHERE id=? AND confirmed_at IS NULL AND cancelled_at IS NULL`)
    .get(id) as Row | undefined;
  if (!r) return null;
  return {
    id: n(r.id), itemCode: String(r.item_code),
    milestoneSeq: r.milestone_seq === null ? null : n(r.milestone_seq),
    field: String(r.field) as Pending["field"],
    oldValue: String(r.old_value), newValue: String(r.new_value),
    actualDate: s(r.actual_date), draftedBy: String(r.drafted_by),
    draftedFor: String(r.drafted_for), createdAt: String(r.created_at),
  };
}

export function openPendingFor(userId: string): Pending[] {
  return (db().prepare(
    `SELECT id FROM pending_progress
     WHERE drafted_for=? AND confirmed_at IS NULL AND cancelled_at IS NULL ORDER BY id`)
    .all(userId) as Row[])
    .map((r) => pendingById(n(r.id))!)
    .filter(Boolean);
}

export function cancelPending(id: number, actor: string) {
  const p = pendingById(id);
  if (!p) throw new Error("ไม่พบการ์ดที่รอยืนยัน");
  db().prepare("UPDATE pending_progress SET cancelled_at=? WHERE id=?").run(nowIso(), id);
  audit(actor, "cancel_pending", "pending_progress", String(id), p, null);
}

/**
 * ยืนยันการ์ด — **จุดเดียวในระบบที่ค่าความคืบหน้าจริงเปลี่ยน**
 * actor ต้องเป็น user id · audit_log บันทึกค่าก่อน/หลัง (AC-18)
 */
export function confirmPending(id: number, actor: string) {
  const p = pendingById(id);
  if (!p) throw new Error("ไม่พบการ์ดที่รอยืนยัน");
  if (p.draftedFor !== actor) throw new Error("การ์ดนี้ไม่ได้ร่างไว้ให้ผู้ใช้คนนี้ยืนยัน");

  const d = db();
  d.exec("BEGIN");
  try {
    if (p.field === "milestone_percent") {
      d.prepare("UPDATE milestone SET percent_complete=?, actual_end=COALESCE(?,actual_end) WHERE item_code=? AND seq=?")
        .run(Number(p.newValue), Number(p.newValue) === 100 ? p.actualDate : null, p.itemCode, p.milestoneSeq);
    } else {
      d.prepare("UPDATE tracked_item SET percent_within_next_level=? WHERE code=?")
        .run(Number(p.newValue), p.itemCode);
    }
    d.prepare("UPDATE tracked_item SET submitted_this_cycle=1, last_updated=? WHERE code=?")
      .run(today(), p.itemCode);
    d.prepare("UPDATE pending_progress SET confirmed_by=?, confirmed_at=? WHERE id=?")
      .run(actor, nowIso(), id);
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }

  audit(actor, "confirm_progress", "tracked_item", p.itemCode,
    { field: p.field, milestoneSeq: p.milestoneSeq, value: Number(p.oldValue) },
    { field: p.field, milestoneSeq: p.milestoneSeq, value: Number(p.newValue), draftedBy: p.draftedBy });
  return p;
}

// ── หลักฐาน ─────────────────────────────────────────────────────────────────

export function addEvidence(a: {
  itemCode: string; title: string; documentDate: string | null; actor: string;
}) {
  const it = itemByCode(a.itemCode);
  if (!it) throw new Error(`ไม่พบรายการ ${a.itemCode}`);
  if (!a.title.trim()) throw new Error("ต้องระบุชื่อเอกสาร");
  if (a.documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(a.documentDate)) {
    throw new Error("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
  }
  const r = db().prepare("SELECT COUNT(*) AS c FROM evidence").get() as Row;
  const id = `E-${String(n(r.c) + 1).padStart(3, "0")}`;
  db().prepare(
    `INSERT INTO evidence (id,item_code,title,document_date,upload_date,uploaded_by)
     VALUES (?,?,?,?,?,?)`)
    .run(id, a.itemCode, a.title.trim(), a.documentDate, today(), a.actor);
  audit(a.actor, "add_evidence", "evidence", id, null,
    { itemCode: a.itemCode, title: a.title.trim(), documentDate: a.documentDate });
  return id;
}

/** เติมวันที่ของเอกสารที่สกัดไม่ได้ — ระบบถาม ไม่เดาจากวันอัปโหลด (AC-03) */
export function setEvidenceDate(id: string, date: string, actor: string) {
  const r = db().prepare("SELECT item_code,document_date FROM evidence WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error(`ไม่พบหลักฐาน ${id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
  if (date > today()) throw new Error("วันที่ในเอกสารอยู่ในอนาคต");
  db().prepare("UPDATE evidence SET document_date=? WHERE id=?").run(date, id);
  audit(actor, "set_evidence_date", "evidence", id,
    { documentDate: s(r.document_date) }, { documentDate: date });
}

/** ยืนยัน/แก้ชั้นหลักฐาน — ทีมกลางเท่านั้น ค่า Verified ขยับจากจุดนี้ที่เดียว */
export function confirmTier(id: string, tier: "A" | "B" | "C" | "D", actor: string, reason?: string) {
  const r = db().prepare(
    "SELECT item_code,proposed_tier,confirmed_tier FROM evidence WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error(`ไม่พบหลักฐาน ${id}`);
  db().prepare("UPDATE evidence SET confirmed_tier=?, confirmed_by=?, confirmed_at=? WHERE id=?")
    .run(tier, actor, nowIso(), id);
  audit(actor, "confirm_tier", "evidence", id,
    { confirmedTier: s(r.confirmed_tier) },
    { confirmedTier: tier, proposedTier: s(r.proposed_tier), overrode: s(r.proposed_tier) !== tier, reason: reason ?? null });
}

// ── Outbox ──────────────────────────────────────────────────────────────────

export function draftOutbox(a: {
  alertRule: string; itemCode: string; toDisplay: string;
  subject: string; body: string; actor: string;
}) {
  const info = db().prepare(
    `INSERT INTO outbox (alert_rule,item_code,to_display,subject,body,created_by,created_at)
     VALUES (?,?,?,?,?,?,?)`)
    .run(a.alertRule, a.itemCode, a.toDisplay, a.subject, a.body, a.actor, nowIso());
  const id = Number(info.lastInsertRowid);
  audit(a.actor, "draft_outbox", "outbox", String(id), null,
    { alertRule: a.alertRule, itemCode: a.itemCode, to: a.toDisplay });
  return id;
}

/**
 * "ส่ง" = บันทึกว่าคนกดส่งแล้วเท่านั้น — ต้นแบบนี้ไม่มี transport ใด ๆ
 * ไม่มี SMTP ไม่มี LINE ไม่มี Teams ในโปรเจกต์นี้ จึงส่งออกไปข้างนอกไม่ได้เลย (§3.3)
 */
export function markSent(id: number, actor: string) {
  const r = db().prepare("SELECT sent_at,item_code FROM outbox WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error("ไม่พบร่างข้อความ");
  if (r.sent_at) throw new Error("ร่างนี้ถูกกดส่งไปแล้ว");
  db().prepare("UPDATE outbox SET sent_by=?, sent_at=? WHERE id=?").run(actor, nowIso(), id);
  audit(actor, "send_outbox", "outbox", String(id), { sentAt: null }, { sentAt: nowIso() });
}

export function outbox() {
  return (db().prepare(
    `SELECT id,alert_rule,item_code,to_display,subject,body,created_by,created_at,sent_by,sent_at
     FROM outbox ORDER BY id DESC`).all() as Row[])
    .map((r) => ({
      id: n(r.id), alertRule: String(r.alert_rule), itemCode: String(r.item_code),
      toDisplay: String(r.to_display), subject: String(r.subject), body: String(r.body),
      createdBy: String(r.created_by), createdAt: String(r.created_at),
      sentBy: s(r.sent_by), sentAt: s(r.sent_at),
    }));
}

// ── เป้าระดับของปี (ผู้บริหาร) ───────────────────────────────────────────────

/**
 * แก้ชื่อหัวข้อและมอบหมายผู้รับผิดชอบ — ทีมกลางเท่านั้น (§5.5 "แก้ข้อมูลของกองอื่น")
 *
 * ผู้รับผิดชอบต้องเป็นผู้ใช้บทบาท owner ที่สังกัดกองเดียวกับรายการนั้น
 * ไม่งั้นการมอบหมายจะสร้างสถานะที่สิทธิ์ตรวจไม่ผ่าน — คนถูกมอบหมายแต่แก้ไม่ได้
 */
export function updateItemMeta(
  code: string,
  patch: { name?: string; ownerUserId?: string | null },
  actor: string,
) {
  const it = itemByCode(code);
  if (!it) throw new Error(`ไม่พบรายการ ${code}`);
  const changes: Record<string, [unknown, unknown]> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 3) throw new Error("ชื่อหัวข้อสั้นเกินไป");
    if (name.length > 200) throw new Error("ชื่อหัวข้อยาวเกิน 200 ตัวอักษร");
    if (name !== it.name) {
      db().prepare("UPDATE tracked_item SET name=? WHERE code=?").run(name, code);
      changes.name = [it.name, name];
    }
  }

  if (patch.ownerUserId !== undefined) {
    const next = patch.ownerUserId;
    if (next !== null) {
      const u = userById(next);
      if (!u) throw new Error(`ไม่รู้จักผู้ใช้ ${next}`);
      if (u.role !== "owner") {
        throw new Error(`${u.title} ไม่ใช่บทบาทเจ้าของข้อมูล จึงมอบหมายรายการให้ไม่ได้`);
      }
      if (u.divisionId !== it.divisionId) {
        throw new Error(
          `${u.title} สังกัดคนละกองกับรายการนี้ — ถ้ามอบหมายไป สิทธิ์จะตรวจไม่ผ่านและแก้ข้อมูลไม่ได้`,
        );
      }
    }
    if (next !== it.ownerUserId) {
      db().prepare("UPDATE tracked_item SET owner_user_id=? WHERE code=?").run(next, code);
      changes.ownerUserId = [it.ownerUserId, next];
    }
  }

  if (Object.keys(changes).length === 0) return { changed: false, changes };
  db().prepare("UPDATE tracked_item SET last_updated=? WHERE code=?").run(today(), code);
  audit(actor, "update_item_meta", "tracked_item", code,
    Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v[0]])),
    Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v[1]])));
  return { changed: true, changes };
}

/**
 * ปรับระดับที่ได้ — ทีมกลางเท่านั้น และ **ต้องมีหลักฐานชั้น A/B ที่ยืนยันแล้วรองรับ**
 * (§5.5 "on confirmed evidence, logged") · นี่คือกฎที่กันไม่ให้ระดับขยับด้วยคำกล่าวอ้าง
 */
export function setAchievedLevel(code: string, level: number, actor: string) {
  const it = itemByCode(code);
  if (!it) throw new Error(`ไม่พบรายการ ${code}`);
  if (!Number.isInteger(level) || level < 0 || level > 5) {
    throw new Error("ระดับต้องเป็นจำนวนเต็ม 0–5");
  }
  if (level > it.targetLevel) {
    throw new Error(`ระดับ ${level} สูงกว่าเป้าปีนี้ (${it.targetLevel}) — ตั้งเป้าให้ถึงก่อน`);
  }
  if (level > it.achievedLevel) {
    const confirmed = evidence().filter(
      (e) => e.itemCode === code && (e.confirmedTier === "A" || e.confirmedTier === "B"),
    );
    if (confirmed.length === 0) {
      throw new Error(
        "ขึ้นระดับไม่ได้ — รายการนี้ยังไม่มีหลักฐานชั้น A/B ที่ยืนยันแล้วแม้ชิ้นเดียว " +
        "(ระดับขยับด้วยหลักฐาน ไม่ใช่ด้วยการกรอก)",
      );
    }
  }
  if (level === it.achievedLevel) return { changed: false };
  db().prepare("UPDATE tracked_item SET achieved_level=?, last_updated=? WHERE code=?")
    .run(level, today(), code);
  audit(actor, "set_achieved_level", "tracked_item", code,
    { achievedLevel: it.achievedLevel }, { achievedLevel: level });
  return { changed: true };
}

export function setTargetLevel(code: string, target: number, actor: string) {
  const it = itemByCode(code);
  if (!it) throw new Error(`ไม่พบรายการ ${code}`);
  if (!Number.isInteger(target) || target < 1 || target > 5) throw new Error("เป้าต้องเป็นจำนวนเต็ม 1–5");
  if (target < it.achievedLevel) {
    throw new Error(`เป้า (${target}) ต่ำกว่าระดับที่ได้แล้ว (${it.achievedLevel}) — บันทึกไม่ได้`);
  }
  db().prepare("UPDATE tracked_item SET target_level=? WHERE code=?").run(target, code);
  audit(actor, "set_target_level", "tracked_item", code,
    { targetLevel: it.targetLevel }, { targetLevel: target });
}
