import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * อ่านข้อความที่ฝังอยู่ในไฟล์เอกสาร
 *
 * **นี่ไม่ใช่ OCR** — ไม่ได้แปลงภาพเป็นตัวอักษร แค่หยิบชั้นข้อความที่ฝังอยู่ใน PDF ออกมา
 * PLAN §3.3 ตัด OCR ออกไป และยังตัดอยู่ · ไฟล์สแกนกับรูปภาพจะอ่านไม่ได้
 * และต้อง **บอกบนหน้าจอว่าอ่านไม่ได้** ไม่ใช่เงียบแล้วปล่อยให้เข้าใจว่าอ่านครบ
 */

/** ตัดความยาวก่อนส่งให้โมเดล — เอกสารจริงอาจ 50 หน้า ส่งหมดจะช้าและกินโควตา */
export const EXTRACT_CHAR_LIMIT = 6000;

/** สั้นกว่านี้ถือว่า "ไม่มีชั้นข้อความ" — PDF สแกนมักได้ศูนย์หรือเศษขยะไม่กี่ตัว */
const MIN_USEFUL_CHARS = 40;

/* ฟอนต์มาตรฐานมากับแพ็กเกจ — ไม่ดึงจากอินเทอร์เน็ต (กฎห้าม CDN ภายนอก) */
/* pdfjs ต้องการรูปแบบ URL — บน Windows path.sep เป็น \ ซึ่งมันปฏิเสธ */
const STANDARD_FONTS = path.join(
  process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts",
).split(path.sep).join("/") + "/";

export type Extracted = {
  ok: boolean;
  text: string | null;
  /** จำนวนตัวอักษรที่อ่านได้ทั้งหมด ก่อนตัด */
  totalChars: number;
  /** จำนวนที่ส่งให้โมเดลจริง */
  sentChars: number;
  truncated: boolean;
  pages: number | null;
  /** เหตุผลที่อ่านไม่ได้ — ต้องแสดงบนหน้าจอตามจริง */
  reason: string | null;
};

const fail = (reason: string): Extracted => ({
  ok: false, text: null, totalChars: 0, sentChars: 0,
  truncated: false, pages: null, reason,
});

export async function extractText(storedPath: string | null): Promise<Extracted> {
  if (!storedPath) return fail("ไม่มีไฟล์แนบ — มีแต่ชื่อเรื่อง");

  const abs = path.isAbsolute(storedPath) ? storedPath : path.join(process.cwd(), storedPath);
  if (!fs.existsSync(abs)) return fail("ไม่พบไฟล์บนดิสก์ (แถวในฐานข้อมูลชี้ไปที่ไฟล์ที่ไม่มีแล้ว)");

  const ext = path.extname(abs).toLowerCase();
  if (ext !== ".pdf") {
    return fail(
      ext === ".doc" || ext === ".docx"
        ? "ไฟล์ Word — รอบนี้ยังไม่รองรับการอ่านเนื้อไฟล์"
        : "ไฟล์รูปภาพ — ไม่มีชั้นข้อความให้อ่าน และระบบนี้ไม่ทำ OCR",
    );
  }

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(fs.readFileSync(abs)),
      // ชี้ไปที่ฟอนต์มาตรฐานในแพ็กเกจเอง — ไม่ดึงจากอินเทอร์เน็ต (กฎห้าม CDN ภายนอก)
      standardFontDataUrl: STANDARD_FONTS,
    }).promise;

    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      out += content.items
        .map((x) => ("str" in x ? x.str : ""))
        .join(" ") + "\n";
    }
    const text = out.replace(/[ \t]+/g, " ").trim();

    if (text.length < MIN_USEFUL_CHARS) {
      return {
        ...fail("อ่านเนื้อไฟล์ไม่ได้ — น่าจะเป็นไฟล์สแกน ระบบนี้ไม่ทำ OCR"),
        pages: doc.numPages,
        totalChars: text.length,
      };
    }

    const truncated = text.length > EXTRACT_CHAR_LIMIT;
    return {
      ok: true,
      text: truncated ? text.slice(0, EXTRACT_CHAR_LIMIT) : text,
      totalChars: text.length,
      sentChars: Math.min(text.length, EXTRACT_CHAR_LIMIT),
      truncated,
      pages: doc.numPages,
      reason: null,
    };
  } catch (e) {
    return fail(`อ่านไฟล์ PDF ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
  }
}
