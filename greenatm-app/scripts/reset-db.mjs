#!/usr/bin/env node
/** ลบฐานข้อมูลเพื่อให้ seed ใหม่ตอนเปิดครั้งถัดไป — ใช้ก่อนรันเทสต์ให้ผลเดิมทุกครั้ง */
import fs from "node:fs";
import path from "node:path";
const dir = path.join(process.cwd(), "data");
let n = 0;
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith("greenatm.sqlite")) { fs.rmSync(path.join(dir, f)); n++; }
  }
}
console.log(n ? `ลบไฟล์ฐานข้อมูล ${n} ไฟล์ — seed ใหม่ตอนเปิดครั้งถัดไป` : "ยังไม่มีฐานข้อมูล");
