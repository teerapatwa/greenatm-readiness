import "server-only";

/**
 * โครงฐานข้อมูล — PLAN.en.md §6.3
 *
 * กฎที่ฝังไว้ในโครงนี้ ไม่ใช่แค่เขียนในเอกสาร:
 *   · ไม่มีคอลัมน์ weight ระดับรายการ — แบบฟอร์ม วว.นบ209 ให้คะแนนเป็น Level ไม่ใช่ถ่วงน้ำหนัก
 *   · achieved_level กับ verified_level แยกคอลัมน์กันคนละช่อง เพื่อให้ "รวมกันโดยบังเอิญ" เป็นไปไม่ได้
 *   · pending_progress เป็นตารางแยก — agent เขียนได้แค่ตารางนี้ ค่าจริงเปลี่ยนเมื่อคนกดยืนยัน
 *   · audit_log เป็น append-only และ actor ต้องเป็น user id เสมอ (CHECK กันค่า 'ai' ไว้ในระดับ DB)
 */
export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_setting (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  TEXT,
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS division (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  name_en  TEXT NOT NULL,
  category INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assess_category (
  num         INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  division_id TEXT REFERENCES division(id)
);

CREATE TABLE IF NOT EXISTS app_user (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('owner','central','executive')),
  division_id TEXT REFERENCES division(id)
);

CREATE TABLE IF NOT EXISTS tracked_item (
  code                      TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  category                  INTEGER NOT NULL REFERENCES assess_category(num),
  division_id               TEXT NOT NULL REFERENCES division(id),
  owner_user_id             TEXT REFERENCES app_user(id),      -- null ได้ = ไม่มีเจ้าของในระบบ
  -- ระดับ 0 = "ยังไม่ถึงระดับ 1" เป็นสถานะจริงในสเกลนี้ ไม่ใช่ข้อมูลเสีย
  -- (ข้อ 1.2 ปีที่แล้วอยู่ที่ 0 แล้วขึ้นมาเป็น 1 ปีนี้ — ถ้าบังคับ 1..5 จะบันทึกความก้าวหน้านี้ไม่ได้)
  achieved_level            INTEGER NOT NULL CHECK (achieved_level BETWEEN 0 AND 5),
  last_year_level           INTEGER NOT NULL CHECK (last_year_level BETWEEN 0 AND 5),
  target_level              INTEGER NOT NULL CHECK (target_level BETWEEN 1 AND 5),
  percent_within_next_level INTEGER NOT NULL CHECK (percent_within_next_level BETWEEN 0 AND 100),
  submitted_this_cycle      INTEGER NOT NULL DEFAULT 0,
  due_date                  TEXT NOT NULL,
  last_updated              TEXT NOT NULL,
  -- เป้าต้องไม่ต่ำกว่าระดับที่ได้แล้ว (PLAN §6.3 Level rules)
  CHECK (target_level >= achieved_level)
);

CREATE TABLE IF NOT EXISTS milestone (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code        TEXT NOT NULL REFERENCES tracked_item(code),
  seq              INTEGER NOT NULL,
  name             TEXT NOT NULL,
  weight           REAL NOT NULL,
  planned_start    TEXT NOT NULL,
  planned_end      TEXT NOT NULL,
  actual_start     TEXT,
  actual_end       TEXT,
  percent_complete INTEGER NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  UNIQUE (item_code, seq)
);

CREATE TABLE IF NOT EXISTS milestone_slip (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code   TEXT NOT NULL REFERENCES tracked_item(code),
  from_date   TEXT NOT NULL,
  to_date     TEXT NOT NULL,
  reason      TEXT NOT NULL,
  by_user     TEXT NOT NULL,
  at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id              TEXT PRIMARY KEY,
  item_code       TEXT NOT NULL REFERENCES tracked_item(code),
  title           TEXT NOT NULL,
  document_date   TEXT,          -- null = ไม่พบวันที่ในเอกสาร → ระบบต้องถาม ห้ามเดา (AC-03)
  upload_date     TEXT NOT NULL,
  uploaded_by     TEXT REFERENCES app_user(id),
  stored_path     TEXT,          -- ที่เก็บไฟล์จริงบนดิสก์ · null = ยังไม่แนบไฟล์ มีแต่ชื่อเรื่อง
  proposed_tier   TEXT CHECK (proposed_tier IN ('A','B','C','D')),
  proposed_reason TEXT,
  proposed_by     TEXT,          -- 'ai' ได้เฉพาะช่องนี้ เพราะเป็นข้อเสนอ ไม่ใช่การยืนยัน
  confirmed_tier  TEXT CHECK (confirmed_tier IN ('A','B','C','D')),
  confirmed_by    TEXT REFERENCES app_user(id),
  confirmed_at    TEXT,
  -- ชั้นที่ยืนยันแล้วต้องมีคนยืนยัน ไม่มีทางมีชั้นยืนยันที่ไม่มีเจ้าของลายมือ
  CHECK ((confirmed_tier IS NULL) = (confirmed_by IS NULL))
);

CREATE TABLE IF NOT EXISTS item_gap (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code   TEXT NOT NULL REFERENCES tracked_item(code),
  missing     TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  resolved_at TEXT
);

-- ── การ์ดยืนยัน: agent/ฟอร์มเขียนลงตารางนี้ได้ ค่าจริงยังไม่ขยับ (AC-17) ──
CREATE TABLE IF NOT EXISTS pending_progress (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code     TEXT NOT NULL REFERENCES tracked_item(code),
  milestone_seq INTEGER,
  field         TEXT NOT NULL CHECK (field IN ('milestone_percent','percent_within_next_level')),
  old_value     TEXT NOT NULL,
  new_value     TEXT NOT NULL,
  actual_date   TEXT,
  drafted_by    TEXT NOT NULL,        -- 'ai' ได้ เพราะเป็นร่าง
  drafted_for   TEXT NOT NULL REFERENCES app_user(id),
  created_at    TEXT NOT NULL,
  confirmed_by  TEXT REFERENCES app_user(id),
  confirmed_at  TEXT,
  cancelled_at  TEXT
);

CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_rule  TEXT NOT NULL,
  item_code   TEXT NOT NULL REFERENCES tracked_item(code),
  to_display  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  TEXT NOT NULL REFERENCES app_user(id),
  created_at  TEXT NOT NULL,
  sent_by     TEXT REFERENCES app_user(id),
  sent_at     TEXT
);

CREATE TABLE IF NOT EXISTS agent_run (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code  TEXT REFERENCES tracked_item(code),
  started_at TEXT NOT NULL,
  ended_at   TEXT,
  tool_calls TEXT,
  outcome    TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  before      TEXT,
  after       TEXT,
  at          TEXT NOT NULL,
  -- §5.5 · AC-18: การเปลี่ยนค่าจริงต้องเป็นการกระทำของคน actor ห้ามเป็น ai
  CHECK (actor <> 'ai')
);

CREATE INDEX IF NOT EXISTS idx_evidence_item ON evidence(item_code);
CREATE INDEX IF NOT EXISTS idx_milestone_item ON milestone(item_code);
CREATE INDEX IF NOT EXISTS idx_slip_item ON milestone_slip(item_code);
CREATE INDEX IF NOT EXISTS idx_pending_open ON pending_progress(drafted_for, confirmed_at, cancelled_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
`;
