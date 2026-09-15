import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { SEED } from "@/lib/data/seed";

/**
 * ฐานข้อมูลไฟล์เดียวบนเครื่องที่รัน backend — PLAN §6.4
 *
 * ใช้ node:sqlite ที่มาพร้อม Node 22 จึงไม่ต้อง compile native module
 * (better-sqlite3 ต้องมี build tools บน Windows ซึ่งเป็นความเสี่ยงที่ไม่จำเป็นในเวิร์กช็อป)
 *
 * seed ลงครั้งแรกครั้งเดียว — รีสตาร์ตแล้วข้อมูลที่คนกรอกไว้ต้องอยู่ครบ (R12 · AC-16)
 */

const DB_PATH = process.env.GREENATM_DB ?? path.join(process.cwd(), "data", "greenatm.sqlite");

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const fresh = !fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size === 0;
  const opened = new DatabaseSync(DB_PATH);
  try {
    opened.exec(SCHEMA);
    if (fresh) seedInto(opened);
  } catch (err) {
    // อย่าเก็บ connection ที่ seed ไม่สำเร็จไว้เป็น singleton
    // ไม่งั้นทุก request ถัดไปจะอ่านตารางว่างแล้วพังด้วย error ที่ชี้ไปผิดที่
    opened.close();
    throw err;
  }
  _db = opened;
  return _db;
}

/** ลบฐานข้อมูลแล้วสร้างใหม่จาก seed — ใช้ในสคริปต์ตรวจเท่านั้น ไม่มี route ไหนเรียก */
export function resetDatabase() {
  if (_db) {
    _db.close();
    _db = null;
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    const f = DB_PATH + suffix;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  return db();
}

export function dbPath() {
  return DB_PATH;
}

function seedInto(d: DatabaseSync) {
  const now = SEED.meta.today;
  d.exec("BEGIN");
  try {
    const setting = d.prepare(
      "INSERT INTO app_setting (key,value,description,updated_by,updated_at) VALUES (?,?,?,?,?)",
    );
    for (const [k, v] of Object.entries(SEED.settings)) {
      setting.run(k, String(v), null, "seed", now);
    }

    const div = d.prepare("INSERT INTO division (id,name,name_en,category) VALUES (?,?,?,?)");
    for (const x of SEED.divisions) div.run(x.id, x.name, x.nameEn, x.category);

    const cat = d.prepare("INSERT INTO assess_category (num,name,division_id) VALUES (?,?,?)");
    for (const x of SEED.categories) cat.run(x.num, x.name, x.divisionId);

    const usr = d.prepare("INSERT INTO app_user (id,title,role,division_id) VALUES (?,?,?,?)");
    for (const x of SEED.users) usr.run(x.id, x.title, x.role, x.divisionId);

    const item = d.prepare(`INSERT INTO tracked_item
      (code,name,category,division_id,owner_user_id,achieved_level,last_year_level,target_level,
       percent_within_next_level,submitted_this_cycle,due_date,last_updated)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const ms = d.prepare(`INSERT INTO milestone
      (item_code,seq,name,weight,planned_start,planned_end,actual_start,actual_end,percent_complete)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    const slip = d.prepare(
      "INSERT INTO milestone_slip (item_code,from_date,to_date,reason,by_user,at) VALUES (?,?,?,?,?,?)",
    );
    for (const it of SEED.items) {
      item.run(
        it.code, it.name, it.category, it.divisionId, it.ownerUserId,
        it.achievedLevel, it.lastYearLevel, it.targetLevel, it.percentWithinNextLevel,
        it.submittedThisCycle ? 1 : 0, it.dueDate, it.lastUpdated,
      );
      for (const m of it.milestones) {
        ms.run(it.code, m.seq, m.name, m.weight, m.plannedStart, m.plannedEnd,
          m.actualStart, m.actualEnd, m.percentComplete);
      }
      for (const s of it.slipHistory) {
        slip.run(it.code, s.from, s.to, s.reason, s.by, s.at);
      }
    }

    const ev = d.prepare(`INSERT INTO evidence
      (id,item_code,title,document_date,upload_date,uploaded_by,
       proposed_tier,proposed_reason,proposed_by,confirmed_tier,confirmed_by,confirmed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const e of SEED.evidence) {
      const owner = SEED.items.find((i) => i.code === e.itemCode)?.ownerUserId ?? null;
      ev.run(
        e.id, e.itemCode, e.title, e.documentDate, e.uploadDate, owner,
        e.proposedTier, e.proposedReason, e.proposedTier ? "ai" : null,
        e.confirmedTier, e.confirmedBy, e.confirmedTier ? e.uploadDate : null,
      );
    }
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}
