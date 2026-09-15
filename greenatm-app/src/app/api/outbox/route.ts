import { currentUser, requireAbility } from "@/lib/auth/session";
import { draftOutbox, itemByCode } from "@/lib/db/queries";
import { fail, jsonBody, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ร่างข้อความจากแจ้งเตือน — ร่างเท่านั้น ไม่มี transport ในโปรเจกต์นี้ */
export async function POST(req: Request) {
  try {
    const u = await currentUser();
    requireAbility(u, "draft_outbox");
    const b = await jsonBody<{ alertRule?: string; itemCode?: string; subject?: string; body?: string }>(req);
    const code = str(b.itemCode, "itemCode");
    const it = itemByCode(code);
    if (!it) return fail(new Error(`ไม่พบรายการ ${code}`));
    const id = draftOutbox({
      alertRule: str(b.alertRule, "alertRule"),
      itemCode: code,
      toDisplay: it.ownerUserId ?? "ไม่มีเจ้าของในระบบ",
      subject: str(b.subject, "subject"),
      body: str(b.body, "body"),
      actor: u.id,
    });
    return ok({ id, sent: false, note: "ร่างแล้ว — ต้นแบบนี้ไม่ส่งอีเมล/LINE/Teams จริง" }, 201);
  } catch (e) {
    return fail(e);
  }
}
