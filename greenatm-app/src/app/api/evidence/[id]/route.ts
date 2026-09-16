import { currentUser, requireAbility, requireItemWriteAccess } from "@/lib/auth/session";
import { HttpError } from "@/lib/auth/session";
import fs from "node:fs";
import path from "node:path";
import {
  confirmTier, deleteEvidence, evidence, itemByCode, revokeTier, setEvidenceDate,
} from "@/lib/db/queries";
import { verifiedPercent } from "@/lib/data/rules";
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

    const body = await jsonBody<{ documentDate?: string; tier?: string | null; reason?: string }>(req);

    if (body.tier === null) {
      // เพิกถอนการยืนยันที่กดผิด — ค่า Verified จะลดลงตาม ซึ่งถูกต้อง
      requireAbility(u, "confirm_tier");
      const itemBefore = itemByCode(ev.itemCode)!;
      const before = verifiedPercent(itemBefore, evidence());
      revokeTier(id, u.id, body.reason?.trim());
      const after = verifiedPercent(itemByCode(ev.itemCode)!, evidence());
      return ok({
        id, confirmedTier: null, revokedBy: u.id, itemCode: ev.itemCode,
        verifiedBefore: before, verifiedAfter: after,
      });
    }

    if (body.tier !== undefined) {
      requireAbility(u, "confirm_tier");
      const tier = str(body.tier, "tier").toUpperCase();
      if (!["A", "B", "C", "D"].includes(tier)) {
        throw new HttpError(400, "tier ต้องเป็น A, B, C หรือ D");
      }
      if (ev.proposedTier && tier !== ev.proposedTier && !body.reason?.trim()) {
        throw new HttpError(400, "การแก้ชั้นที่ agent เสนอ ต้องระบุเหตุผล");
      }
      // จับค่าก่อน/หลัง เพื่อให้หน้าจอบอกได้ว่าการกดนี้ขยับอะไรจากเท่าไรเป็นเท่าไร
      const itemBefore = itemByCode(ev.itemCode)!;
      const before = verifiedPercent(itemBefore, evidence());
      confirmTier(id, tier as "A" | "B" | "C" | "D", u.id, body.reason?.trim());
      const after = verifiedPercent(itemByCode(ev.itemCode)!, evidence());
      return ok({
        id, confirmedTier: tier, confirmedBy: u.id,
        countsTowardVerified: tier === "A" || tier === "B",
        itemCode: ev.itemCode,
        verifiedBefore: before,
        verifiedAfter: after,
        achievedLevel: itemBefore.achievedLevel,
        levelChanged: false,
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

/**
 * ลบหลักฐาน — ทีมกลางเท่านั้น
 *
 * ของจริงต้องลบเอกสารที่แนบผิดได้ · และการมีเส้นทางนี้ทำให้ชุดทดสอบคืนสภาพตัวเองได้
 * ซึ่งเป็นเหตุให้ verify:seed กับ verify:app รันสลับลำดับกันได้โดยไม่พัง
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "confirm_tier");
    const row = deleteEvidence(id, u.id);
    let fileRemoved = false;
    if (row.storedPath) {
      const abs = path.resolve(process.cwd(), row.storedPath);
      if (abs.startsWith(path.resolve(process.cwd()) + path.sep) && fs.existsSync(abs)) {
        fs.rmSync(abs);
        fileRemoved = true;
      }
    }
    return ok({ deleted: id, itemCode: row.itemCode, fileRemoved });
  } catch (e) {
    return fail(e);
  }
}
