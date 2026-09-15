import { currentUser, requireAbility, HttpError } from "@/lib/auth/session";
import { itemByCode, setAchievedLevel, setTargetLevel, updateItemMeta } from "@/lib/db/queries";
import { fail, jsonBody, num, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * แก้ข้อมูลของรายการ — **สี่ฟิลด์ สิทธิ์ไม่เหมือนกัน** จึงตรวจแยกทีละอัน
 *
 *   { name }            → ทีมกลาง      (manage_item)
 *   { ownerUserId }     → ทีมกลาง      (manage_item)
 *   { achievedLevel }   → ทีมกลาง      (manage_item) + ต้องมีหลักฐาน A/B ที่ยืนยันแล้ว
 *   { targetLevel }     → ทีมกลาง + ผู้บริหาร (set_target_level) — §5.5
 *
 * เจ้าของข้อมูลยิงมาทุกกรณีต้องได้ 403 ไม่ใช่แค่ไม่มีช่องกรอกบนหน้าจอ
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const u = await currentUser();
    if (!itemByCode(code)) throw new HttpError(404, `ไม่พบรายการ ${code}`);

    const b = await jsonBody<{
      name?: string; ownerUserId?: string | null;
      achievedLevel?: number; targetLevel?: number;
    }>(req);

    const applied: string[] = [];

    if (b.name !== undefined || b.ownerUserId !== undefined) {
      requireAbility(u, "manage_item");
      const r = updateItemMeta(code, { name: b.name, ownerUserId: b.ownerUserId }, u.id);
      if (r.changed) applied.push(...Object.keys(r.changes));
    }

    // เป้าต้องตั้งก่อนระดับที่ได้ เพราะ setAchievedLevel ปฏิเสธค่าที่สูงกว่าเป้า
    if (b.targetLevel !== undefined) {
      requireAbility(u, "set_target_level");
      setTargetLevel(code, num(b.targetLevel, "targetLevel"), u.id);
      applied.push("targetLevel");
    }

    if (b.achievedLevel !== undefined) {
      requireAbility(u, "manage_item");
      const r = setAchievedLevel(code, num(b.achievedLevel, "achievedLevel"), u.id);
      if (r.changed) applied.push("achievedLevel");
    }

    if (applied.length === 0 && Object.keys(b).length === 0) {
      throw new HttpError(400, "ต้องส่งฟิลด์ที่จะแก้อย่างน้อยหนึ่งฟิลด์");
    }

    const after = itemByCode(code)!;
    return ok({
      code, applied, changedBy: u.id,
      item: {
        name: after.name, ownerUserId: after.ownerUserId,
        achievedLevel: after.achievedLevel, targetLevel: after.targetLevel,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
