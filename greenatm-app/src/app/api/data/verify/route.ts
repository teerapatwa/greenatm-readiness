import { NextResponse } from "next/server";
import { snapshot } from "@/lib/db/queries";
import {
  buildAlerts,
  alertCounts,
  progressPercent,
  verifiedPercent,
  suggestion,
  projectedLevel,
  velocity,
  stalledItems,
} from "@/lib/data/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ตรวจชุดข้อมูลตัวอย่างด้วยกฎ "ตัวจริง" ที่แอปใช้ ไม่ใช่กฎที่เขียนขึ้นใหม่ในเทสต์
 * (PLAN §8.1 — เทสต์ที่เขียนกฎขึ้นมาเองพิสูจน์ได้แค่ว่าคนเขียนคิดเหมือนเดิมสองครั้ง)
 */
export async function GET() {
  const SEED = snapshot();
  const items = SEED.items;
  const alerts = buildAlerts(SEED);
  const counts = alertCounts(alerts);

  const checks: { group: string; name: string; ok: boolean; got: string; want: string }[] = [];
  const check = (group: string, name: string, got: unknown, want: unknown, ok?: boolean) =>
    checks.push({
      group,
      name,
      ok: ok ?? JSON.stringify(got) === JSON.stringify(want),
      got: typeof got === "string" ? got : JSON.stringify(got),
      want: typeof want === "string" ? want : JSON.stringify(want),
    });

  // ── โครงชุดข้อมูล ────────────────────────────────────────────────────────
  check("ชุดข้อมูล", "จำนวนรายการ", items.length, 24);
  check(
    "ชุดข้อมูล",
    "รายการต่อหมวด",
    [1, 2, 3, 4].map((c) => items.filter((i) => i.category === c).length),
    [4, 12, 4, 4],
  );
  const mean = items.reduce((s, i) => s + i.achievedLevel, 0) / items.length;
  const meanLast = items.reduce((s, i) => s + i.lastYearLevel, 0) / items.length;
  check("ชุดข้อมูล", "ระดับเฉลี่ยปัจจุบัน", mean.toFixed(2), "1.83");
  check("ชุดข้อมูล", "ระดับเฉลี่ยปีที่แล้ว", meanLast.toFixed(3), "1.625"); // แผนเขียน 1.62 — ตัวเลขเดียวกัน ปัดคนละแบบ
  check("ชุดข้อมูล", "รายการที่ไม่ขยับระดับมาหนึ่งปี", stalledItems(items).length, 19);
  check("ชุดข้อมูล", "รายการที่ไม่มีเจ้าของในระบบ (หมวด 4)", items.filter((i) => !i.ownerUserId).length, 4);
  check(
    "ชุดข้อมูล",
    "ทุก milestone มีวันที่ตามแผน",
    items.every((i) => i.milestones.every((m) => !!m.plannedStart && !!m.plannedEnd)),
    true,
  );

  // ── การกระจายแจ้งเตือน — §5.4.2 ข้อ 2, 3 ─────────────────────────────────
  check("แจ้งเตือน", "ถึง moderator", counts.moderator, 8);
  check("แจ้งเตือน", "ถึงเจ้าของ (รวมที่ไม่มีผู้รับ)", counts.ownerTotal, 27);
  check("แจ้งเตือน", "moderator ได้น้อยกว่าเจ้าของ", counts.moderator < counts.ownerTotal, true);
  check("แจ้งเตือน", "ไม่มีอะไรถึงผู้บริหาร", counts.executive, 0);
  check("แจ้งเตือน", "หมวด 4 — แจ้งเตือนที่ไม่มีผู้รับ", counts.orphan, 5);
  check(
    "แจ้งเตือน",
    "ต่อเจ้าของแต่ละคน",
    [counts.byOwner["u-owner1"] ?? 0, counts.byOwner["u-owner2"] ?? 0, counts.byOwner["u-owner3"] ?? 0],
    [2, 14, 6],
  );
  check(
    "แจ้งเตือน",
    "ทุกแจ้งเตือนอ้างรายการจริงและมีหัวเรื่อง+เนื้อหา",
    alerts.every(
      (a) => items.some((i) => i.code === a.itemCode) && a.head.length > 0 && a.body.length > 0,
    ),
    true,
  );

  // ── กฎรายข้อ ─────────────────────────────────────────────────────────────
  check("กฎ", "ใกล้กำหนดส่ง — ยิง 4 รายการ", alerts.filter((a) => a.rule === "A-DUESOON").length, 4);
  check(
    "กฎ",
    "ยังไม่ถึงกำหนด → ห้ามยิง 'เลยกำหนด'",
    alerts.filter((a) => a.rule === "A-OVERDUE").length,
    0,
  );
  check("กฎ", "milestone เลยกำหนด — ยิง 2 รายการ", alerts.filter((a) => a.rule === "A-MILESTONE").length, 2);
  const slip = alerts.filter((a) => a.rule === "A-SLIP");
  check(
    "กฎ",
    "เลื่อนครั้งที่ 3 → ESCALATE ทั้งสองรายการ",
    slip.filter((a) => a.verb === "ESCALATE").map((a) => a.itemCode).sort(),
    ["2.10", "3.3"],
  );
  check(
    "กฎ",
    "เลื่อนครั้งแรก → ไม่รบกวน moderator",
    slip.filter((a) => a.verb === "NOTE").every((a) => a.toModerator === false),
    true,
  );
  check(
    "กฎ",
    "ไม่มีหลักฐาน / ไม่มีวันที่ / ล้าสมัย → ถึงเจ้าของเท่านั้น",
    alerts
      .filter((a) => ["A-NOEV", "A-NODATE", "A-STALE"].includes(a.rule))
      .every((a) => a.toModerator === false),
    true,
  );

  // ── เคสยอมรับ ────────────────────────────────────────────────────────────
  const i41 = items.find((i) => i.code === "4.1")!;
  check("AC-01", "4.1 · งานคืบหน้า (เจ้าของกรอกเอง)", `${progressPercent(i41)}%`, "67%");
  check("AC-01", "4.1 · ยืนยันด้วยหลักฐาน ต้องเป็น 0", verifiedPercent(i41, SEED.evidence), 0);
  check("AC-01", "4.1 · ระดับต้องไม่ขยับ", i41.achievedLevel === i41.lastYearLevel, true);

  const ev32 = SEED.evidence.filter((e) => e.itemCode === "3.2");
  check("AC-02", "3.2 · เอกสารเป็นชั้น C ทั้งหมด", ev32.every((e) => e.proposedTier === "C"), true);
  check(
    "AC-02",
    "3.2 · ยืนยันด้วยหลักฐาน ต้องเป็น 0",
    verifiedPercent(items.find((i) => i.code === "3.2")!, SEED.evidence),
    0,
  );

  check(
    "AC-03",
    "2.10 · เอกสารไม่มีวันที่ → ถาม ไม่เดา",
    alerts.some((a) => a.rule === "A-NODATE" && a.itemCode === "2.10"),
    true,
  );

  const i27 = items.find((i) => i.code === "2.7")!;
  check(
    "AC-04",
    "2.7 · มีหลักฐานชั้น A ที่ยืนยันแล้ว",
    SEED.evidence.some((e) => e.itemCode === "2.7" && e.confirmedTier === "A"),
    true,
  );
  check("AC-04", "2.7 · ตัวเลขที่ยืนยันขยับ", verifiedPercent(i27, SEED.evidence) > 0, true);

  // AC-26 — ถึงเป้าแต่ไม่มีหลักฐาน ห้ามขึ้นว่า "เสร็จสมบูรณ์"
  for (const code of ["2.11", "2.12"]) {
    const it = items.find((i) => i.code === code)!;
    const s = suggestion(it, SEED.evidence, SEED.settings);
    check(
      "AC-26",
      `${code} · ถึงเป้า Level 5 แต่ไม่มีหลักฐาน → ห้ามเป็น complete`,
      s.verdict,
      "needsfix",
    );
  }
  const it210 = items.find((i) => i.code === "2.10")!;
  check(
    "AC-26",
    "2.10 · การยกระดับต้องไม่ถูกการวินิจฉัยอื่นกลบ",
    suggestion(it210, SEED.evidence, SEED.settings).escalated,
    true,
  );

  // ── การคาดการณ์ — §5.7 ───────────────────────────────────────────────────
  check("คาดการณ์", "ไม่เกิน Level 5", items.every((i) => projectedLevel(i, 5, 1.5) <= 5), true);
  check(
    "คาดการณ์",
    "5 ปี ไม่ต่ำกว่า 3 ปี",
    items.every((i) => projectedLevel(i, 5) >= projectedLevel(i, 3)),
    true,
  );
  const zeroV = items.filter((i) => velocity(i) <= 0);
  check(
    "คาดการณ์",
    "velocity เป็นศูนย์แล้วไม่งอกเอง",
    zeroV.every((i) => projectedLevel(i, 5) === i.achievedLevel + i.percentWithinNextLevel / 100),
    true,
  );
  check("คาดการณ์", "รายการที่นิ่ง — หัวข้อข่าวที่ซื่อสัตย์", `${stalledItems(items).length}/24`, "19/24");

  const passed = checks.filter((c) => c.ok).length;
  return NextResponse.json({
    summary: { total: checks.length, passed, failed: checks.length - passed },
    checks,
    alertSample: alerts.slice(0, 5),
    testedAt: new Date().toISOString(),
  });
}
