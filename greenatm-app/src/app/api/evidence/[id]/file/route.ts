import fs from "node:fs";
import path from "node:path";
import { currentUser } from "@/lib/auth/session";
import { evidenceRow, UPLOAD_TYPES } from "@/lib/db/queries";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ส่งไฟล์ที่แนบไว้กลับ — อ่านได้ทุกบทบาท (เส้นแบ่งอยู่ที่การเขียน ไม่ใช่การอ่าน) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await currentUser();
    const row = evidenceRow(id);
    if (!row) return new Response("ไม่พบหลักฐาน", { status: 404 });
    if (!row.storedPath) return new Response("หลักฐานนี้ไม่มีไฟล์แนบ มีแต่ชื่อเรื่อง", { status: 404 });

    const abs = path.resolve(process.cwd(), row.storedPath);
    // กันการอ่านไฟล์นอกโฟลเดอร์โปรเจกต์ แม้ค่าในฐานข้อมูลจะถูกแก้
    if (!abs.startsWith(path.resolve(process.cwd()) + path.sep)) {
      return new Response("เส้นทางไฟล์ไม่ถูกต้อง", { status: 400 });
    }
    if (!fs.existsSync(abs)) return new Response("ไฟล์หายไปจากดิสก์", { status: 404 });

    const ext = path.extname(abs).toLowerCase();
    const type = Object.entries(UPLOAD_TYPES).find(([, e]) => e === ext)?.[0]
      ?? "application/octet-stream";
    return new Response(new Uint8Array(fs.readFileSync(abs)), {
      headers: {
        "content-type": type,
        "content-disposition": `inline; filename="${encodeURIComponent(path.basename(abs))}"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
