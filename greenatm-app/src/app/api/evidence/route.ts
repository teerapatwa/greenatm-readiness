import { currentUser, requireAbility, requireItemWriteAccess } from "@/lib/auth/session";
import { addEvidence } from "@/lib/db/queries";
import { fail, jsonBody, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * แนบหลักฐานเข้ารายการ
 *
 * ถ้าไม่ส่ง documentDate มา ระบบเก็บเป็น null แล้ว **ถาม** ผ่านกฎ A-NODATE
 * ไม่มีที่ใดในโค้ดเอา upload_date มาใช้แทนวันที่ในเอกสาร (AC-03)
 */
export async function POST(req: Request) {
  try {
    const u = await currentUser();
    requireAbility(u, "enter_progress");

    const body = await jsonBody<{ itemCode?: string; title?: string; documentDate?: string | null }>(req);
    const code = str(body.itemCode, "itemCode");
    requireItemWriteAccess(u, code);

    const id = addEvidence({
      itemCode: code,
      title: str(body.title, "title"),
      documentDate: body.documentDate?.trim() ? body.documentDate.trim() : null,
      actor: u.id,
    });

    return ok({
      id,
      confirmedTier: null,
      message: body.documentDate
        ? "แนบแล้ว — รอทีมกลางยืนยันชั้นหลักฐาน ค่า Verified ยังไม่ขยับ"
        : "แนบแล้ว แต่ไม่พบวันที่ในเอกสาร — ระบบจะถามวันที่ ไม่เดาจากวันอัปโหลด",
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
