import "server-only";
import fs from "node:fs";
import path from "node:path";
import { closeDb, db, dbPath } from "./index";

/**
 * สำรองและย้อนกลับฐานข้อมูลเดโม
 *
 * ⚠️ นี่คือ **เครื่องมือสำหรับเดโม** ไม่ใช่ฟีเจอร์ของระบบจริง
 * การย้อนกลับทับข้อมูลของทุกคนในฐานข้อมูลเดียวกัน — ในของจริงต้องเป็น
 * point-in-time recovery ที่ผู้ดูแลระบบทำ ไม่ใช่ปุ่มบนหน้าจอผู้ใช้
 * หน้าจอจึงต้องเขียนให้ชัดว่าเป็นเครื่องมือเดโม และต้องกดยืนยันสองจังหวะ
 *
 * เรื่องที่ต้องระวังทางเทคนิค:
 *  · WAL — ต้อง checkpoint ก่อนคัดลอกไฟล์ ไม่งั้น snapshot จะไม่มีข้อมูลล่าสุด
 *  · ต้องปิด connection ก่อนเขียนทับไฟล์ แล้วเปิดใหม่ ไม่งั้นบน Windows ไฟล์ถูกล็อก
 *  · ต้องลบ -wal / -shm ตอนย้อนกลับ ไม่งั้นข้อมูลเก่าใน WAL จะถูก replay ทับ snapshot
 */

const SNAP_DIR = process.env.GREENATM_SNAPSHOTS
  ?? path.join(process.cwd(), "data", "snapshots");

/** ชื่อ snapshot ต้องปลอดภัยพอเป็นชื่อไฟล์ — whitelist ไม่ใช่ blacklist */
export function safeSnapshotName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9฀-๿._\- ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.\-_]+/, "")
    .slice(0, 60);
  return cleaned;
}

export type Snapshot = {
  name: string;
  bytes: number;
  createdAt: string;
  isBaseline: boolean;
};

const BASELINE = "baseline";

function fileFor(name: string) {
  return path.join(SNAP_DIR, `${name}.sqlite`);
}

export function listSnapshots(): Snapshot[] {
  if (!fs.existsSync(SNAP_DIR)) return [];
  return fs
    .readdirSync(SNAP_DIR)
    .filter((f) => f.endsWith(".sqlite"))
    .map((f) => {
      const st = fs.statSync(path.join(SNAP_DIR, f));
      const name = f.replace(/\.sqlite$/, "");
      return {
        name,
        bytes: st.size,
        createdAt: st.mtime.toISOString(),
        isBaseline: name === BASELINE,
      };
    })
    .sort((a, b) => (a.isBaseline ? -1 : b.isBaseline ? 1 : b.createdAt.localeCompare(a.createdAt)));
}

export function createSnapshot(rawName: string): Snapshot {
  const name = safeSnapshotName(rawName);
  if (name.length < 2) throw new Error("ชื่อจุดสำรองสั้นเกินไป (ต้อง 2 ตัวอักษรขึ้นไป)");
  if (listSnapshots().length >= 20) {
    throw new Error("มีจุดสำรองครบ 20 รายการแล้ว — ลบของเก่าก่อน");
  }

  // ดึงข้อมูลใน WAL ลงไฟล์หลักก่อน ไม่งั้นสำเร็จแต่ได้ข้อมูลเก่า
  db().exec("PRAGMA wal_checkpoint(TRUNCATE)");

  fs.mkdirSync(SNAP_DIR, { recursive: true });
  const target = fileFor(name);
  if (!path.resolve(target).startsWith(path.resolve(SNAP_DIR) + path.sep)) {
    throw new Error("ชื่อจุดสำรองไม่ปลอดภัย");
  }
  fs.copyFileSync(dbPath(), target);
  const st = fs.statSync(target);
  return { name, bytes: st.size, createdAt: st.mtime.toISOString(), isBaseline: name === BASELINE };
}

/** สร้างจุดสำรองตั้งต้นครั้งแรกครั้งเดียว — ให้มีที่ให้ย้อนกลับเสมอ */
export function ensureBaseline(): Snapshot | null {
  if (fs.existsSync(fileFor(BASELINE))) return null;
  return createSnapshot(BASELINE);
}

export function restoreSnapshot(rawName: string) {
  const name = safeSnapshotName(rawName);
  const src = fileFor(name);
  if (!fs.existsSync(src)) throw new Error(`ไม่พบจุดสำรองชื่อ "${name}"`);

  // เก็บสภาพก่อนย้อน ให้ย้อนของการย้อนได้อีกชั้นหนึ่ง
  let before: Snapshot | null = null;
  try {
    before = createSnapshot("ก่อนย้อนกลับ-" + new Date().toISOString().slice(11, 19).replace(/:/g, ""));
  } catch {
    before = null; // ถ้าสำรองไม่ได้ก็ยังย้อนต่อ แต่บอกผู้ใช้ว่าไม่มี
  }

  closeDb();
  for (const suffix of ["-wal", "-shm"]) {
    const f = dbPath() + suffix;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  fs.copyFileSync(src, dbPath());
  db(); // เปิดใหม่ (migrate ทำงานให้ด้วย ถ้า snapshot เก่ากว่า schema)

  return { restored: name, safetyCopy: before?.name ?? null };
}

export function removeSnapshot(rawName: string) {
  const name = safeSnapshotName(rawName);
  if (name === BASELINE) throw new Error("ลบจุดสำรองตั้งต้นไม่ได้ — เป็นที่ให้ย้อนกลับเสมอ");
  const f = fileFor(name);
  if (!fs.existsSync(f)) throw new Error(`ไม่พบจุดสำรองชื่อ "${name}"`);
  fs.rmSync(f);
  return name;
}
