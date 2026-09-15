#!/usr/bin/env node
/**
 * ตรวจชุดข้อมูลตัวอย่าง — เรียกผ่าน API ของแอปที่รันอยู่จริง
 * เพื่อให้ใช้ "กฎตัวจริง" ไม่ใช่กฎที่เขียนขึ้นใหม่ในเทสต์ (PLAN §8.1)
 *
 *   npm run dev            (อีกหน้าต่างหนึ่ง)
 *   npm run verify:seed
 */
const base = process.env.APP_URL || "http://localhost:3000";

let res;
try {
  res = await fetch(`${base}/api/data/verify`, { cache: "no-store" });
} catch (e) {
  console.error(`\n⛔ เรียก ${base} ไม่ได้ — สั่ง npm run dev ในอีกหน้าต่างก่อน\n   ${e.message}\n`);
  process.exit(1);
}
const data = await res.json();

let group = "";
for (const c of data.checks) {
  if (c.group !== group) {
    group = c.group;
    console.log(`\n── ${group} ${"─".repeat(Math.max(0, 56 - group.length))}`);
  }
  const icon = c.ok ? "✓" : "⛔";
  console.log(`${icon}  ${c.name}`);
  if (!c.ok) console.log(`     ได้ ${c.got}  ·  ต้องได้ ${c.want}`);
}

const { total, passed, failed } = data.summary;
console.log("\n" + "─".repeat(60));
console.log(`ผ่าน ${passed}/${total}${failed ? ` · ไม่ผ่าน ${failed}` : ""}`);
console.log("─".repeat(60));
process.exit(failed > 0 ? 2 : 0);
