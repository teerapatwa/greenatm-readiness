import { currentUser, requireAbility } from "@/lib/auth/session";
import { setSetting, settings } from "@/lib/db/queries";
import { fail, jsonBody, num, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try { return ok(settings()); } catch (e) { return fail(e); }
}

/** แก้เกณฑ์ได้จากหน้าจอ ไม่ต้องแก้โค้ด ไม่ต้องรีสตาร์ต (AC-11 · AC-24) */
export async function PATCH(req: Request) {
  try {
    const u = await currentUser();
    requireAbility(u, "set_setting");
    const b = await jsonBody<{ key?: string; value?: number }>(req);
    setSetting(str(b.key, "key"), num(b.value, "value"), u.id);
    return ok({ settings: settings(), changedBy: u.id });
  } catch (e) {
    return fail(e);
  }
}
