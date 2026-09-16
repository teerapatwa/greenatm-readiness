import { currentUser, requireAbility } from "@/lib/auth/session";
import { discardOutbox, editOutbox, markSent } from "@/lib/db/queries";
import { fail, ok, jsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "กดส่ง" = บันทึกว่าคนกดส่งแล้ว ไม่มีอะไรวิ่งออกนอกเครื่อง
 * ในโปรเจกต์นี้ไม่มี SMTP / LINE / Teams credential อยู่เลย จึงส่งจริงไม่ได้แม้อยากส่ง
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "send_outbox");
    markSent(Number(id), u.id);
    return ok({ id: Number(id), sentBy: u.id, actuallyDelivered: false,
      note: "บันทึกว่าส่งแล้วในระบบเท่านั้น — ไม่มีช่องทางส่งจริงในต้นแบบ" });
  } catch (e) {
    return fail(e);
  }
}

/**
 * แก้ข้อความก่อนส่ง — สิ่งที่ทำให้ "คนกดส่ง" ไม่ใช่แค่การกดปั๊มอนุมัติ
 *
 * ถ้าคนแก้ข้อความที่ระบบร่างมาไม่ได้ เขาก็เหลือทางเลือกแค่ "ส่งตามที่ร่าง" กับ "ไม่ส่ง"
 * ซึ่งขัดกับที่ทั้งระบบอ้างว่าคนเป็นผู้ตัดสิน
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "draft_outbox");
    const b = await jsonBody<{ subject?: string; body?: string }>(req);
    if (typeof b.subject !== "string" || typeof b.body !== "string") {
      throw new Error("ต้องส่งทั้ง subject และ body");
    }
    editOutbox(Number(id), { subject: b.subject, body: b.body, actor: u.id });
    return ok({ id: Number(id), editedBy: u.id, note: "แก้ข้อความแล้ว — ยังไม่ได้ส่ง" });
  } catch (e) {
    return fail(e);
  }
}

/** ทิ้งร่างที่ไม่ควรส่ง — ร่างที่กดส่งไปแล้วลบไม่ได้ */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "draft_outbox");
    const b = await jsonBody<{ reason?: string }>(req).catch(() => ({} as { reason?: string }));
    discardOutbox(Number(id), u.id, b.reason?.trim());
    return ok({ id: Number(id), discardedBy: u.id, note: "ทิ้งร่างแล้ว — ไม่มีอะไรถูกส่งออกไป" });
  } catch (e) {
    return fail(e);
  }
}
