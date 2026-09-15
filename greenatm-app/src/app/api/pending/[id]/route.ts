import { currentUser, requireAbility } from "@/lib/auth/session";
import { cancelPending, confirmPending, itemByCode } from "@/lib/db/queries";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ยืนยันการ์ด — **จุดเดียวในระบบที่ค่าความคืบหน้าจริงเปลี่ยน** (AC-18)
 *
 * เจตนา: agent ร่างได้ แต่ "การกด" เป็นการกระทำของคน
 * audit_log.actor จึงเป็น user id เสมอ (ทั้ง CHECK ใน schema และ guard ใน queries.ts)
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");

    const p = confirmPending(Number(id), u.id);
    const after = itemByCode(p.itemCode)!;
    return ok({
      committed: true,
      actor: u.id,
      item: {
        code: after.code,
        percentWithinNextLevel: after.percentWithinNextLevel,
        achievedLevel: after.achievedLevel,
        milestones: after.milestones.map((m) => ({ seq: m.seq, percentComplete: m.percentComplete })),
      },
      note: "ระดับที่ยืนยันด้วยหลักฐานไม่ขยับจากการกดนี้ — ต้องมีหลักฐานชั้น A/B ที่ทีมกลางยืนยัน",
    });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");
    cancelPending(Number(id), u.id);
    return ok({ cancelled: true });
  } catch (e) {
    return fail(e);
  }
}
