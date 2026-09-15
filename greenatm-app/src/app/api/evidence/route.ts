import fs from "node:fs";
import path from "node:path";
import { currentUser, requireAbility, requireItemWriteAccess, HttpError } from "@/lib/auth/session";
import {
  addEvidence, setEvidenceFile, safeFileName, UPLOAD_MAX_BYTES, UPLOAD_TYPES,
} from "@/lib/db/queries";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_ROOT = process.env.GREENATM_UPLOADS
  ?? path.join(process.cwd(), "sample-data", "uploads");

/**
 * แนบหลักฐาน — รับได้ทั้ง JSON (ชื่อเรื่องเปล่า ๆ) และ multipart (มีไฟล์จริง)
 *
 * กฎที่บังคับไว้:
 *  · ชนิดไฟล์ต้องอยู่ใน whitelist (PDF/Word/รูป) — R4 · ไม่ทำ OCR (§3.3)
 *  · ขนาดไม่เกิน 10 MB
 *  · ชื่อไฟล์ผ่าน safeFileName แล้วยังตรวจซ้ำว่า path ที่ได้อยู่ในโฟลเดอร์ปลายทางจริง
 *  · **ไม่เอาวันแก้ไขไฟล์มาใช้เป็น document_date** — ระบบยังถามเหมือนเดิม (AC-03)
 */
export async function POST(req: Request) {
  try {
    const u = await currentUser();
    requireAbility(u, "enter_progress");

    const ctype = req.headers.get("content-type") ?? "";
    let itemCode: string;
    let title: string;
    let documentDate: string | null;
    let file: File | null = null;

    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      itemCode = String(form.get("itemCode") ?? "").trim();
      title = String(form.get("title") ?? "").trim();
      const d = String(form.get("documentDate") ?? "").trim();
      documentDate = d === "" ? null : d;
      const f = form.get("file");
      if (f instanceof File && f.size > 0) file = f;
    } else {
      const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      itemCode = String(b.itemCode ?? "").trim();
      title = String(b.title ?? "").trim();
      const d = String(b.documentDate ?? "").trim();
      documentDate = d === "" || d === "null" ? null : d;
    }

    if (!itemCode) throw new HttpError(400, "ต้องระบุ itemCode");
    requireItemWriteAccess(u, itemCode);

    if (file) {
      const ext = UPLOAD_TYPES[file.type];
      if (!ext) {
        throw new HttpError(
          400,
          `ชนิดไฟล์ "${file.type || "ไม่ทราบ"}" ไม่รับ — รับเฉพาะ PDF, Word และรูปภาพ`,
          `ที่รับได้: ${Object.values(UPLOAD_TYPES).join(" ")}`,
        );
      }
      if (file.size > UPLOAD_MAX_BYTES) {
        throw new HttpError(
          400,
          `ไฟล์ใหญ่ ${(file.size / 1048576).toFixed(1)} MB — เกินเพดาน ${UPLOAD_MAX_BYTES / 1048576} MB`,
        );
      }
      // ไม่มีไฟล์ชื่อเรื่อง ก็ใช้ชื่อไฟล์เป็นชื่อเรื่อง
      if (!title) title = safeFileName(file.name);
    }

    if (!title) throw new HttpError(400, "ต้องระบุชื่อเอกสาร หรือแนบไฟล์มาด้วย");

    const id = addEvidence({ itemCode, title, documentDate, actor: u.id });

    let storedAs: string | null = null;
    if (file) {
      const dir = path.join(UPLOAD_ROOT, safeFileName(itemCode));
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, `${id}_${safeFileName(file.name)}`);
      // ตรวจซ้ำอีกชั้น: path ที่ได้ต้องอยู่ใต้โฟลเดอร์ปลายทางจริง
      if (!path.resolve(target).startsWith(path.resolve(dir) + path.sep)) {
        throw new HttpError(400, "ชื่อไฟล์ไม่ปลอดภัย");
      }
      fs.writeFileSync(target, Buffer.from(await file.arrayBuffer()));
      storedAs = path.relative(process.cwd(), target).split(path.sep).join("/");
      setEvidenceFile(id, storedAs, u.id);
    }

    return ok({
      id,
      storedPath: storedAs,
      hasFile: storedAs !== null,
      documentDate,
      confirmedTier: null,
      message: documentDate
        ? "แนบแล้ว — รอทีมกลางยืนยันชั้นหลักฐาน ค่า Verified ยังไม่ขยับ"
        : "แนบแล้ว แต่ไม่พบวันที่ในเอกสาร — ระบบจะถามวันที่ ไม่เดาจากวันอัปโหลดหรือวันแก้ไขไฟล์",
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
