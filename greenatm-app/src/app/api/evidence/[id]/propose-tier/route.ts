import { currentUser, requireAbility, requireItemWriteAccess, HttpError } from "@/lib/auth/session";
import { evidenceRow } from "@/lib/db/queries";
import { proposeTier } from "@/lib/llm/tierAgent";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * ให้ agent อ่านเอกสารแล้ว **เสนอ** ชั้น A–D — PLAN R6
 *
 * แยกจาก POST /api/evidence โดยตั้งใจ: การแนบไฟล์ต้องเสร็จทันที
 * ส่วนการเรียกโมเดลใช้เวลาหลายวินาที ถ้ารวมกันผู้ใช้จะนึกว่าแอปค้าง
 * และถ้าโมเดลล่ม การแนบหลักฐานก็จะพังไปด้วยทั้งที่ไม่เกี่ยวกัน
 *
 * สิทธิ์เท่ากับการแนบหลักฐาน (`enter_progress` + เป็นรายการของกองตัวเอง)
 * เพราะผลลัพธ์เป็นแค่ **ข้อเสนอ** — การยืนยันยังเป็นของทีมกลางเหมือนเดิม
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");

    const ev = evidenceRow(id);
    if (!ev) throw new HttpError(404, `ไม่พบหลักฐาน ${id}`);
    requireItemWriteAccess(u, ev.itemCode);

    if (ev.confirmedTier) {
      throw new HttpError(400,
        `หลักฐานนี้ทีมกลางยืนยันเป็นชั้น ${ev.confirmedTier} แล้ว — ข้อเสนอของ agent ไม่มีผลกับของที่ตัดสินไปแล้ว`);
    }

    const r = await proposeTier(id);

    return ok({
      id,
      ok: r.ok,
      proposedTier: r.tier,
      proposedReason: r.reason,
      latencyMs: r.latencyMs,
      retried: r.retried,
      error: r.error,
      read: {
        ok: r.extract.ok,
        pages: r.extract.pages,
        totalChars: r.extract.totalChars,
        sentChars: r.extract.sentChars,
        truncated: r.extract.truncated,
        reason: r.extract.reason,
      },
      // ย้ำทุกครั้งว่านี่ยังไม่ใช่การยืนยัน — เป็นคำถามแรกที่คนถามหลังเห็นชั้นโผล่มา
      note: r.ok
        ? `agent เสนอชั้น ${r.tier} — ยังไม่ใช่การยืนยัน ค่า Verified ไม่ขยับจนกว่าทีมกลางจะกดยืนยัน`
        : "agent เสนอชั้นไม่สำเร็จ — ทีมกลางจัดชั้นเอง",
    });
  } catch (e) {
    return fail(e);
  }
}
