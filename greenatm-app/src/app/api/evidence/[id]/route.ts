import { currentUser, requireAbility, requireItemWriteAccess } from "@/lib/auth/session";
import { HttpError } from "@/lib/auth/session";
import { confirmTier, evidence, setEvidenceDate } from "@/lib/db/queries";
import { fail, jsonBody, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PATCH สองอย่างบนหลักฐานชิ้นหนึ่ง แต่ **สิทธิ์ต่างกันคนละขั้ว**
 *
 *   { documentDate } → เจ้าของข้อมูลของรายการนั้น (เติมวันที่ที่ระบบถาม)
 *   { tier }         → ทีมกลางเท่านั้น — ค่า Verified ขยับจากจุดนี้ที่เดียว (§5.5)
 *
 * เจ้าของข้อมูลยิง { tier } มาต้องได้ 403 ไม่ใช่แค่ไม่มีปุ่มบนหน้าจอ
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    const ev = evidence().find((e) => e.id === id);
    if (!ev) throw new HttpError(404, `ไม่พบหลักฐาน ${id}`);

    const body = await jsonBody<{ documentDate?: string; tier?: string; reason?: string }>(req);

    if (body.tier !== undefined) {
      requireAbility(u, "confirm_tier");
      const tier = str(body.tier, "tier").toUpperCase();
      if (!["A", "B", "C", "D"].includes(tier)) {
        throw new HttpError(400, "tier ต้องเป็น A, B, C หรือ D");
      }
      if (ev.proposedTier && tier !== ev.proposedTier && !body.reason?.trim()) {
        throw new HttpError(400, "การแก้ชั้นที่ agent เสนอ ต้องระบุเหตุผล");
      }
      confirmTier(id, tier as "A" | "B" | "C" | "D", u.id, body.reason?.trim());
      return ok({
        id, confirmedTier: tier, confirmedBy: u.id,
        countsTowardVerified: tier === "A" || tier === "B",
      });
    }

    if (body.documentDate !== undefined) {
      requireAbility(u, "enter_progress");
      requireItemWriteAccess(u, ev.itemCode);
      setEvidenceDate(id, str(body.documentDate, "documentDate"), u.id);
      return ok({ id, documentDate: body.documentDate, inferredFromUpload: false });
    }

    throw new HttpError(400, "ต้องส่ง documentDate หรือ tier อย่างน้อยหนึ่งอย่าง");
  } catch (e) {
    return fail(e);
  }
}
