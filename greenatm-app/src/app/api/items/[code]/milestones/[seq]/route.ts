import { currentUser, requireAbility, requireItemWriteAccess } from "@/lib/auth/session";
import { deleteMilestone, itemByCode, updateMilestone } from "@/lib/db/queries";
import { fail, jsonBody, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * แก้ชื่อ/วันแผนของขั้น
 * ⚠️ เลื่อนวันสิ้นสุดให้ช้าลงผ่านทางนี้ไม่ได้ — ต้องใช้ POST /slips ที่บังคับเหตุผล
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string; seq: string }> }) {
  try {
    const { code, seq } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");
    requireItemWriteAccess(u, code);
    const b = await jsonBody<{ name?: string; plannedStart?: string; plannedEnd?: string }>(req);
    const next = updateMilestone(code, Number(seq), b, u.id);
    return ok({ seq: Number(seq), ...next, milestones: itemByCode(code)!.milestones });
  } catch (e) {
    return fail(e);
  }
}

/** ลบขั้น — ได้เฉพาะขั้นที่ยัง 0% เพื่อไม่ให้ความคืบหน้าที่บันทึกไว้หายไป */
export async function DELETE(_req: Request, ctx: { params: Promise<{ code: string; seq: string }> }) {
  try {
    const { code, seq } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");
    requireItemWriteAccess(u, code);
    deleteMilestone(code, Number(seq), u.id);
    return ok({ deleted: Number(seq), milestones: itemByCode(code)!.milestones });
  } catch (e) {
    return fail(e);
  }
}
