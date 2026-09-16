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
  /*
    เลขลำดับต้องมาจาก "เลขสูงสุดที่เคยใช้" ไม่ใช่ "จำนวนแถวที่มีอยู่"
    เพราะพอลบแถวไหนไป จำนวนแถวจะลดลง แล้วแถวถัดไปจะได้เลขที่มีคนใช้อยู่แล้ว
    → UNIQUE constraint failed: evidence.id · แนบหลักฐานใหม่ไม่ได้อีกเลยจนกว่าจะรีเซ็ต
  */
  const r = db().prepare(
    "SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER)) AS m FROM evidence").get() as Row;
  const id = `E-${String((r.m === null || r.m === undefined ? 0 : n(r.m)) + 1).padStart(3, "0")}`;
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

/**
 * เพิกถอนชั้นที่ยืนยันไว้ — ทีมกลางเท่านั้น
 *
 * ยืนยันผิดต้องถอนคืนได้ · ค่า Verified จะลดลงตาม ซึ่งถูกต้อง —
 * หลักฐานที่ถอนการยืนยันแล้ว ไม่ควรนับว่าพิสูจน์อะไรได้
 * ข้อเสนอของ agent (proposed_tier) ไม่ถูกลบ เพราะเป็นคนละเรื่องกับการยืนยันของคน
 */
export function revokeTier(id: string, actor: string, reason?: string) {
  const r = db().prepare(
    "SELECT item_code,confirmed_tier,confirmed_by FROM evidence WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error(`ไม่พบหลักฐาน ${id}`);
  if (!r.confirmed_tier) throw new Error(`หลักฐาน ${id} ยังไม่เคยถูกยืนยัน จึงเพิกถอนไม่ได้`);
  db().prepare(
    "UPDATE evidence SET confirmed_tier=NULL, confirmed_by=NULL, confirmed_at=NULL WHERE id=?").run(id);
  audit(actor, "revoke_tier", "evidence", id,
    { confirmedTier: s(r.confirmed_tier), confirmedBy: s(r.confirmed_by) },
    { confirmedTier: null, reason: reason ?? null });
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
    `SELECT id,alert_rule,item_code,to_display,subject,body,created_by,created_at,
            sent_by,sent_at,edited_by,edited_at
     FROM outbox ORDER BY id DESC`).all() as Row[])
    .map((r) => ({
      id: n(r.id), alertRule: String(r.alert_rule), itemCode: String(r.item_code),
      toDisplay: String(r.to_display), subject: String(r.subject), body: String(r.body),
      createdBy: String(r.created_by), createdAt: String(r.created_at),
      sentBy: s(r.sent_by), sentAt: s(r.sent_at),
      editedBy: s(r.edited_by), editedAt: s(r.edited_at),
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

// ── แผนงาน (milestone) ───────────────────────────────────────────────────────

/** เกลี่ยน้ำหนักทุกขั้นให้เท่ากัน — ใช้หลังเพิ่ม/ลบขั้น เพื่อให้ progressPercent อธิบายได้ */
function rebalanceWeights(code: string) {
  const rows = db().prepare("SELECT seq FROM milestone WHERE item_code=? ORDER BY seq").all(code) as Row[];
  if (rows.length === 0) return;
  const w = Math.round((100 / rows.length) * 100) / 100;
  const up = db().prepare("UPDATE milestone SET weight=? WHERE item_code=? AND seq=?");
  for (const r of rows) up.run(w, code, n(r.seq));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addMilestone(
  code: string,
  a: { name: string; plannedStart: string; plannedEnd: string },
  actor: string,
) {
  const it = itemByCode(code);
  if (!it) throw new Error(`ไม่พบรายการ ${code}`);
  const name = a.name.trim();
  if (name.length < 3) throw new Error("ชื่อขั้นสั้นเกินไป (ต้อง 3 ตัวอักษรขึ้นไป)");
  if (name.length > 200) throw new Error("ชื่อขั้นยาวเกิน 200 ตัวอักษร");
  if (!DATE.test(a.plannedStart) || !DATE.test(a.plannedEnd)) {
    throw new Error("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
  }
  if (a.plannedEnd < a.plannedStart) throw new Error("วันสิ้นสุดตามแผนต้องไม่มาก่อนวันเริ่ม");

  const seq = (it.milestones.reduce((m, x) => Math.max(m, x.seq), 0) || 0) + 1;
  db().prepare(
    `INSERT INTO milestone (item_code,seq,name,weight,planned_start,planned_end,percent_complete)
     VALUES (?,?,?,?,?,?,0)`).run(code, seq, name, 0, a.plannedStart, a.plannedEnd);
  rebalanceWeights(code);
  audit(actor, "add_milestone", "tracked_item", code, null,
    { seq, name, plannedStart: a.plannedStart, plannedEnd: a.plannedEnd });
  return seq;
}

export function updateMilestone(
  code: string,
  seq: number,
  patch: { name?: string; plannedStart?: string; plannedEnd?: string },
  actor: string,
) {
  const it = itemByCode(code);
  if (!it) throw new Error(`ไม่พบรายการ ${code}`);
  const m = it.milestones.find((x) => x.seq === seq);
  if (!m) throw new Error(`ไม่พบแผนงานขั้นที่ ${seq}`);

  const next = {
    name: patch.name !== undefined ? patch.name.trim() : m.name,
    plannedStart: patch.plannedStart ?? m.plannedStart,
    plannedEnd: patch.plannedEnd ?? m.plannedEnd,
  };
  if (next.name.length < 3) throw new Error("ชื่อขั้นสั้นเกินไป (ต้อง 3 ตัวอักษรขึ้นไป)");
  if (next.name.length > 200) throw new Error("ชื่อขั้นยาวเกิน 200 ตัวอักษร");
  if (!DATE.test(next.plannedStart) || !DATE.test(next.plannedEnd)) {
    throw new Error("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
  }
  if (next.plannedEnd < next.plannedStart) throw new Error("วันสิ้นสุดตามแผนต้องไม่มาก่อนวันเริ่ม");
  // เลื่อนวันให้ช้าลง = การเลื่อนแผน ต้องผ่าน recordSlip ที่บังคับเหตุผล
  if (next.plannedEnd > m.plannedEnd) {
    throw new Error(
      "การเลื่อนวันสิ้นสุดให้ช้าลง ต้องบันทึกเป็น “การเลื่อนแผน” พร้อมเหตุผล — ใช้ปุ่มเลื่อนแผน",
    );
  }

  db().prepare("UPDATE milestone SET name=?, planned_start=?, planned_end=? WHERE item_code=? AND seq=?")
    .run(next.name, next.plannedStart, next.plannedEnd, code, seq);
  audit(actor, "update_milestone", "tracked_item", code,
    { seq, name: m.name, plannedStart: m.plannedStart, plannedEnd: m.plannedEnd },
    { seq, ...next });
  return next;
}

export function deleteMilestone(code: string, seq: number, actor: string) {
  const it = itemByCode(code);
  if (!it) throw new Error(`ไม่พบรายการ ${code}`);
  const m = it.milestones.find((x) => x.seq === seq);
  if (!m) throw new Error(`ไม่พบแผนงานขั้นที่ ${seq}`);
  if (m.percentComplete > 0) {
    throw new Error(
      `ขั้นที่ ${seq} เริ่มไปแล้ว ${m.percentComplete}% — ลบไม่ได้ เพราะจะทำให้ความคืบหน้าที่บันทึกไว้หายไป`,
    );
  }
  db().prepare("DELETE FROM milestone WHERE item_code=? AND seq=?").run(code, seq);
  rebalanceWeights(code);
  audit(actor, "delete_milestone", "tracked_item", code, { seq, name: m.name }, null);
}

/**
 * บันทึกการเลื่อนแผน — **จุดที่ทำให้กฎ A-SLIP และการยกระดับครั้งที่ 3 ทำงานจากข้อมูลจริง**
 *
 * เลื่อนวันแล้วสัญญาณ "เลยกำหนด" จะหายไปจริง (เพราะวันแผนขยับ)
 * แต่ระบบนับจำนวนครั้งไว้ — นี่คือเหตุผลที่กฎยกระดับนับ "ครั้ง" ไม่ใช่ "ความรุนแรง"
 */
export function recordSlip(
  code: string,
  a: { milestoneSeq: number; toDate: string; reason: string },
  actor: string,
) {
  const it = itemByCode(code);
  if (!it) throw new Error(`ไม่พบรายการ ${code}`);
  const m = it.milestones.find((x) => x.seq === a.milestoneSeq);
  if (!m) throw new Error(`ไม่พบแผนงานขั้นที่ ${a.milestoneSeq}`);
  if (!DATE.test(a.toDate)) throw new Error("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
  if (a.toDate <= m.plannedEnd) {
    throw new Error(
      `วันใหม่ (${a.toDate}) ต้องช้ากว่าวันแผนเดิม (${m.plannedEnd}) — ถ้าเร็วขึ้นไม่ใช่การเลื่อนแผน ให้แก้วันแผนตรง ๆ`,
    );
  }
  const reason = a.reason.trim();
  if (reason.length < 5) {
    throw new Error("ต้องระบุเหตุผลการเลื่อนแผนอย่างน้อย 5 ตัวอักษร — เหตุผลคือสิ่งที่ทำให้การเลื่อนซ้ำมีความหมาย");
  }

  const d = db();
  d.exec("BEGIN");
  try {
    d.prepare(
      "INSERT INTO milestone_slip (item_code,from_date,to_date,reason,by_user,at) VALUES (?,?,?,?,?,?)")
      .run(code, m.plannedEnd, a.toDate, reason, actor, nowIso());
    d.prepare("UPDATE milestone SET planned_end=? WHERE item_code=? AND seq=?")
      .run(a.toDate, code, a.milestoneSeq);
    d.prepare("UPDATE tracked_item SET last_updated=? WHERE code=?").run(today(), code);
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }

  const count = slipsOf(code).length;
  audit(actor, "record_slip", "tracked_item", code,
    { seq: a.milestoneSeq, plannedEnd: m.plannedEnd },
    { seq: a.milestoneSeq, plannedEnd: a.toDate, reason, slipCount: count });
  return { count, from: m.plannedEnd, to: a.toDate };
}

export function slipRows(code: string) {
  return (db().prepare(
    "SELECT id,item_code,from_date,to_date,reason,by_user,at FROM milestone_slip WHERE item_code=? ORDER BY id")
    .all(code) as Row[])
    .map((r) => ({
      id: n(r.id), itemCode: String(r.item_code), from: String(r.from_date),
      to: String(r.to_date), reason: String(r.reason), by: String(r.by_user), at: String(r.at),
    }));
}

/** ลบ slip ที่บันทึกผิด — ทีมกลางเท่านั้น · คืนวันแผนกลับไปเป็นวันก่อนเลื่อน */
export function deleteSlip(code: string, id: number, actor: string) {
  const r = db().prepare(
    "SELECT item_code,from_date,to_date,reason FROM milestone_slip WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error(`ไม่พบประวัติการเลื่อนแผน id ${id}`);
  if (String(r.item_code) !== code) throw new Error("ประวัติการเลื่อนแผนนี้ไม่ใช่ของรายการนี้");

  const d = db();
  d.exec("BEGIN");
  try {
    // คืนวันแผนให้ขั้นที่ยังมีวันตรงกับ to_date ของ slip นี้ (ถ้ายังไม่ถูกเลื่อนต่อ)
    d.prepare("UPDATE milestone SET planned_end=? WHERE item_code=? AND planned_end=?")
      .run(String(r.from_date), code, String(r.to_date));
    d.prepare("DELETE FROM milestone_slip WHERE id=?").run(id);
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
  audit(actor, "delete_slip", "tracked_item", code,
    { slipId: id, from: String(r.from_date), to: String(r.to_date), reason: String(r.reason) }, null);
}

// ── ไฟล์แนบจริง ─────────────────────────────────────────────────────────────

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** ชนิดที่รับ — PDF / Word / รูป ตาม R4 · ไม่ทำ OCR (§3.3) */
export const UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * ทำชื่อไฟล์ให้ปลอดภัย — ใช้ whitelist ไม่ใช่ blacklist
 *
 * ตัด path ทั้งหมดออกก่อน (กัน ../ และ path แบบ Windows) แล้วเหลือเฉพาะอักขระที่ยอมรับ
 * วิธี whitelist ปลอดภัยกว่า เพราะอักขระแปลกที่ยังไม่รู้จักจะถูกตัดออกโดยปริยาย
 */
export function safeFileName(raw: string): string {
  // แยกด้วยทั้ง / และ \ โดยไม่ใช้ regex เพื่อไม่ต้องพึ่ง escape ที่พลาดง่าย
  const base = raw.split("/").join("|").split(String.fromCharCode(92)).join("|")
    .split("|").filter(Boolean).pop() ?? "file";
  const cleaned = base
    .replace(/[^A-Za-z0-9\u0E00-\u0E7F._()\- ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

export function setEvidenceFile(id: string, storedPath: string, actor: string) {
  const r = db().prepare("SELECT stored_path FROM evidence WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error(`ไม่พบหลักฐาน ${id}`);
  db().prepare("UPDATE evidence SET stored_path=? WHERE id=?").run(storedPath, id);
  audit(actor, "attach_file", "evidence", id, { storedPath: s(r.stored_path) }, { storedPath });
}

export function evidenceRow(id: string) {
  const r = db().prepare(
    `SELECT id,item_code,title,document_date,upload_date,uploaded_by,stored_path,
            proposed_tier,proposed_reason,confirmed_tier,confirmed_by
     FROM evidence WHERE id=?`).get(id) as Row | undefined;
  if (!r) return null;
  return {
    id: String(r.id), itemCode: String(r.item_code), title: String(r.title),
    documentDate: s(r.document_date), uploadDate: String(r.upload_date),
    uploadedBy: s(r.uploaded_by), storedPath: s(r.stored_path),
    proposedTier: s(r.proposed_tier), proposedReason: s(r.proposed_reason),
    confirmedTier: s(r.confirmed_tier), confirmedBy: s(r.confirmed_by),
  };
}

/** ลบหลักฐาน — ทีมกลางเท่านั้น · เอกสารที่แนบผิดต้องเอาออกได้ */
export function deleteEvidence(id: string, actor: string) {
  const row = evidenceRow(id);
  if (!row) throw new Error(`ไม่พบหลักฐาน ${id}`);
  db().prepare("DELETE FROM evidence WHERE id=?").run(id);
  audit(actor, "delete_evidence", "evidence", id,
    { itemCode: row.itemCode, title: row.title, confirmedTier: row.confirmedTier }, null);
  return row;
}

/* ── ค่าตั้งค่าที่เป็นข้อความ (เช่น provider ของโมเดลที่เลือกใช้อยู่) ─────────── */

export function textSetting(key: string): string | null {
  const r = db().prepare("SELECT value FROM app_text_setting WHERE key=?").get(key) as Row | undefined;
  return r ? String(r.value) : null;
}

/**
 * เขียนค่าตั้งค่าที่เป็นข้อความ พร้อมบันทึก audit
 *
 * `allowed` บังคับให้ค่าที่รับได้มาจากรายการที่กำหนดไว้เท่านั้น — ไม่ใช่ข้อความอะไรก็ได้
 * ที่หลุดจาก body ของ request เข้ามาตรง ๆ
 */
export function setTextSetting(key: string, value: string, actor: string, allowed: readonly string[]) {
  if (!allowed.includes(value)) {
    throw new Error(`ค่า "${value}" ไม่อยู่ในตัวเลือกที่อนุญาต (${allowed.join(" / ")})`);
  }
  const before = textSetting(key);
  db().prepare(
    `INSERT INTO app_text_setting (key,value,updated_by,updated_at) VALUES (?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,
       updated_by=excluded.updated_by, updated_at=excluded.updated_at`,
  ).run(key, value, actor, nowIso());
  audit(actor, "set_setting", "app_text_setting", key, { value: before }, { value });
}

/**
 * บันทึกข้อเสนอชั้นของ agent — **เสนอเท่านั้น**
 *
 * แตะเฉพาะ proposed_* · ไม่แตะ confirmed_tier จึงไม่ทำให้ค่า Verified ขยับ
 * และ**ไม่เขียน audit_log** เพราะ audit_log บังคับว่า actor ต้องเป็นคน (CHECK actor <> 'ai')
 * ร่องรอยของ agent อยู่ในตาราง agent_run ซึ่งเป็นคนละเรื่องกันโดยตั้งใจ
 */
export function setProposedTier(id: string, tier: "A" | "B" | "C" | "D", reason: string) {
  const r = db().prepare("SELECT id FROM evidence WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error(`ไม่พบหลักฐาน ${id}`);
  db().prepare("UPDATE evidence SET proposed_tier=?, proposed_reason=? WHERE id=?")
    .run(tier, reason, id);
}

/** หลักฐานว่า agent ทำงานจริง ตรวจย้อนได้ — AC-06 */
export function recordAgentRun(a: {
  itemCode: string | null; startedAt: string; endedAt: string;
  toolCalls: string | null; outcome: string;
}) {
  db().prepare(
    `INSERT INTO agent_run (item_code,started_at,ended_at,tool_calls,outcome)
     VALUES (?,?,?,?,?)`,
  ).run(a.itemCode, a.startedAt, a.endedAt, a.toolCalls, a.outcome);
}

export function agentRuns(limit = 20) {
  return (db().prepare(
    `SELECT id,item_code,started_at,ended_at,tool_calls,outcome
     FROM agent_run ORDER BY id DESC LIMIT ?`).all(limit) as Row[])
    .map((r) => ({
      id: n(r.id), itemCode: s(r.item_code),
      startedAt: String(r.started_at), endedAt: s(r.ended_at),
      toolCalls: s(r.tool_calls), outcome: String(r.outcome),
    }));
}

export function agentRunCount(): number {
  return n((db().prepare("SELECT COUNT(*) AS c FROM agent_run").get() as Row).c);
}

/**
 * แก้ข้อความที่ระบบร่างไว้ ก่อนคนกดส่ง
 *
 * นี่คือสิ่งที่ทำให้ "คนกดส่ง" มีความหมายจริง — ถ้าคนแก้ไม่ได้ ก็เหลือแค่กดอนุมัติ
 * ซึ่งเป็นสิ่งที่ทั้งระบบอ้างว่าไม่ทำ
 *
 * **ร่างที่กดส่งไปแล้วแก้ไม่ได้** — ข้อความนั้นคือบันทึกว่าส่งอะไรออกไป
 * แก้ย้อนหลังคือการปลอมประวัติ
 */
export function editOutbox(id: number, a: { subject: string; body: string; actor: string }) {
  const r = db().prepare("SELECT subject,body,sent_at FROM outbox WHERE id=?").get(id) as Row | undefined;
  if (!r) throw new Error("ไม่พบร่างข้อความ");
  if (r.sent_at) throw new Error("ร่างนี้กดส่งไปแล้ว — แก้ย้อนหลังไม่ได้ เพราะเป็นบันทึกว่าส่งอะไรออกไป");
  const subject = a.subject.trim();
  const body = a.body.trim();
  if (subject.length < 3) throw new Error("หัวเรื่องสั้นเกินไป (ต้อง 3 ตัวอักษรขึ้นไป)");
  if (body.length < 10) throw new Error("เนื้อความสั้นเกินไป (ต้อง 10 ตัวอักษรขึ้นไป)");
  db().prepare("UPDATE outbox SET subject=?, body=?, edited_by=?, edited_at=? WHERE id=?")
    .run(subject, body, a.actor, nowIso(), id);
  audit(a.actor, "edit_outbox", "outbox", String(id),
    { subject: s(r.subject), body: s(r.body) }, { subject, body });
}

/** ทิ้งร่างที่ไม่ควรส่ง — ร่างที่กดส่งไปแล้วลบไม่ได้ */
export function discardOutbox(id: number, actor: string, reason?: string) {
  const r = db().prepare("SELECT subject,body,item_code,sent_at FROM outbox WHERE id=?")
    .get(id) as Row | undefined;
  if (!r) throw new Error("ไม่พบร่างข้อความ");
  if (r.sent_at) throw new Error("ร่างนี้กดส่งไปแล้ว — ลบไม่ได้ เพราะเป็นบันทึกว่าส่งอะไรออกไป");
  db().prepare("DELETE FROM outbox WHERE id=?").run(id);
  audit(actor, "discard_outbox", "outbox", String(id),
    { subject: s(r.subject), itemCode: s(r.item_code) }, { reason: reason ?? null });
}
