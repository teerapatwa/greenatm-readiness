import { currentUser, requireAbility } from "@/lib/auth/session";
import { audit } from "@/lib/db/queries";
import { listSnapshots, removeSnapshot, restoreSnapshot } from "@/lib/db/snapshot";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ย้อนฐานข้อมูลกลับไปที่จุดสำรอง — ผู้ดูแลเท่านั้น
 *
 * ⚠️ ทับข้อมูลของทุกคนในฐานข้อมูลเดียวกัน
 * ระบบสำรองสภาพก่อนย้อนไว้ให้อัตโนมัติ จึงย้อนของการย้อนได้อีกชั้น
 * บันทึก audit **หลัง**ย้อนเสร็จ — เพราะ log ก่อนย้อนจะถูกทับหายไปกับฐานข้อมูล
 */
export async function POST(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "manage_item");
    const r = restoreSnapshot(decodeURIComponent(name));
    audit(u.id, "restore_snapshot", "demo_snapshot", r.restored, null,
      { safetyCopy: r.safetyCopy });
    return ok({
      ...r,
      snapshots: listSnapshots(),
      note: r.safetyCopy
        ? `ย้อนกลับแล้ว · สภาพก่อนย้อนเก็บไว้ที่ "${r.safetyCopy}"`
        : "ย้อนกลับแล้ว · สำรองสภาพก่อนย้อนไม่สำเร็จ จึงย้อนกลับของการย้อนไม่ได้",
    });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await ctx.params;
    const u = await currentUser();
    requireAbility(u, "manage_item");
    const removed = removeSnapshot(decodeURIComponent(name));
    audit(u.id, "delete_snapshot", "demo_snapshot", removed, null, null);
    return ok({ deleted: removed, snapshots: listSnapshots() });
  } catch (e) {
    return fail(e);
  }
}
