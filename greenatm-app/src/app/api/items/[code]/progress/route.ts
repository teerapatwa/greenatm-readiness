import { currentUser, requireAbility, requireItemWriteAccess } from "@/lib/auth/session";
import { draftProgress } from "@/lib/db/queries";
import { fail, jsonBody, num, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ร่างการเปลี่ยนความคืบหน้า → **การ์ดรอยืนยัน** (AC-17)
 *
 * เส้นทางนี้ไม่เคยเปลี่ยนค่าจริง แม้เรียกโดยคน ไม่ใช่ agent
 * ค่าจริงเปลี่ยนที่ POST /api/pending/[id] เท่านั้น
 *
 * ตรวจสิทธิ์ก่อนทุกครั้ง — กองอื่นยิงมาก็ได้ 403 (AC-13 · AC-20)
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "enter_progress");
    requireItemWriteAccess(u, code);

    const body = await jsonBody<{
      field?: string; milestoneSeq?: number; percent?: number; actualDate?: string | null;
      draftedBy?: string;
    }>(req);

    const field = body.field === "percent_within_next_level"
      ? "percent_within_next_level"
      : "milestone_percent";

    const pending = draftProgress({
      itemCode: code,
      milestoneSeq: field === "milestone_percent" ? num(body.milestoneSeq, "milestoneSeq") : null,
      field,
      newValue: num(body.percent, "percent"),
      actualDate: body.actualDate ?? null,
      // agent ร่างได้ (drafted_by = 'ai') แต่ยืนยันไม่ได้ · ค่าจากผู้ใช้จะบันทึกชื่อผู้ใช้
      draftedBy: body.draftedBy === "ai" ? "ai" : u.id,
      draftedFor: u.id,
    });

    return ok({
      pending,
      committed: false,
      message: "ยังไม่เปลี่ยนค่าจริง — ขึ้นการ์ดรอยืนยันเท่านั้น",
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
