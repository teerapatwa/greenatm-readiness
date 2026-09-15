import { currentUser, requireAbility } from "@/lib/auth/session";
import { itemByCode, setTargetLevel } from "@/lib/db/queries";
import { fail, jsonBody, num, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ตั้งเป้าระดับของปี — ผู้บริหารเท่านั้น (§5.5) */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "set_target_level");
    const b = await jsonBody<{ targetLevel?: number }>(req);
    setTargetLevel(code, num(b.targetLevel, "targetLevel"), u.id);
    return ok({ code, targetLevel: itemByCode(code)!.targetLevel, changedBy: u.id });
  } catch (e) {
    return fail(e);
  }
}
