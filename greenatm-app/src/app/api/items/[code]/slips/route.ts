import { currentUser, requireAbility, requireItemWriteAccess } from "@/lib/auth/session";
import { itemByCode, recordSlip, settings, slipRows } from "@/lib/db/queries";
import { fail, jsonBody, num, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    await currentUser();
    return ok({ slips: slipRows(code) });
  } catch (e) {
    return fail(e);
  }
}

/**
 * บันทึกการเลื่อนแผน — จุดที่ทำให้กฎยกระดับครั้งที่ 3 ทำงานจากข้อมูลจริง
 *
 * เลื่อนวันแล้วสัญญาณ "เลยกำหนด" หายไปจริง แต่ระบบนับจำนวนครั้งไว้
 * ครั้งที่ 1 แจ้งให้ทราบ → ครั้งที่ 2 ขอข้อมูล + ถึงผู้ดูแล → ครั้งที่ 3 ยกให้ผู้ดูแลตัดสิน
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");
    requireItemWriteAccess(u, code);

    const b = await jsonBody<{ milestoneSeq?: number; toDate?: string; reason?: string }>(req);
    const r = recordSlip(code, {
      milestoneSeq: num(b.milestoneSeq, "milestoneSeq"),
      toDate: str(b.toDate, "วันแผนใหม่"),
      reason: str(b.reason, "เหตุผลการเลื่อนแผน"),
    }, u.id);

    const s = settings();
    const verb = r.count >= s.slip_escalate_after ? "ESCALATE" : r.count === 2 ? "ASK" : "NOTE";
    return ok({
      ...r, verb,
      reachesModerator: r.count >= 2,
      milestones: itemByCode(code)!.milestones,
      note: verb === "ESCALATE"
        ? `เลื่อนครบ ${r.count} ครั้ง — ยกให้ผู้ดูแลตัดสินพร้อมประวัติทั้งหมด`
        : `บันทึกการเลื่อนครั้งที่ ${r.count} แล้ว`,
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
