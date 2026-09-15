import { currentUser } from "@/lib/auth/session";
import { buildView } from "@/lib/view";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** สถานะทั้งหมดที่ผู้ใช้คนนี้มีสิทธิ์เห็น — การกรองอยู่ใน buildView */
export async function GET() {
  try {
    return ok(buildView(await currentUser()));
  } catch (e) {
    return fail(e);
  }
}
