import { currentUser, requireAbility } from "@/lib/auth/session";
import { markSent } from "@/lib/db/queries";
import { fail, ok } from "@/lib/http";

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
