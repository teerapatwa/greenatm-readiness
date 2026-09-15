import { currentUser, requireAbility, requireItemWriteAccess } from "@/lib/auth/session";
import { addMilestone, itemByCode } from "@/lib/db/queries";
import { fail, jsonBody, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** เพิ่มขั้นในแผนงาน — น้ำหนักทุกขั้นถูกเกลี่ยใหม่ให้เท่ากัน */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");
    requireItemWriteAccess(u, code);

    const b = await jsonBody<{ name?: string; plannedStart?: string; plannedEnd?: string }>(req);
    const seq = addMilestone(code, {
      name: str(b.name, "ชื่อขั้น"),
      plannedStart: str(b.plannedStart, "วันเริ่มตามแผน"),
      plannedEnd: str(b.plannedEnd, "วันสิ้นสุดตามแผน"),
    }, u.id);

    const after = itemByCode(code)!;
    return ok({
      seq, milestones: after.milestones,
      note: "เกลี่ยน้ำหนักทุกขั้นให้เท่ากันใหม่ — ความคืบหน้ารวมจึงเปลี่ยนตาม",
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
