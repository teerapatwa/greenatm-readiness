import { currentUser, requireAbility } from "@/lib/auth/session";
import { deleteSlip, itemByCode, slipRows } from "@/lib/db/queries";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ลบประวัติการเลื่อนแผนที่บันทึกผิด — ทีมกลางเท่านั้น · คืนวันแผนให้ด้วย */
export async function DELETE(_req: Request, ctx: { params: Promise<{ code: string; id: string }> }) {
  try {
    const { code, id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "manage_item");
    deleteSlip(code, Number(id), u.id);
    return ok({ deleted: Number(id), slips: slipRows(code), milestones: itemByCode(code)!.milestones });
  } catch (e) {
    return fail(e);
  }
}
