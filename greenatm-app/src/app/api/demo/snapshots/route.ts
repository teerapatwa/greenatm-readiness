import { currentUser, requireAbility } from "@/lib/auth/session";
import { audit } from "@/lib/db/queries";
import { createSnapshot, ensureBaseline, listSnapshots } from "@/lib/db/snapshot";
import { fail, jsonBody, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * จุดสำรองฐานข้อมูลเดโม — ผู้ดูแลเท่านั้น
 * ⚠️ เครื่องมือสำหรับเดโม ไม่ใช่ฟีเจอร์ของระบบจริง (ดู src/lib/db/snapshot.ts)
 */
export async function GET() {
  try {
    const u = await currentUser();
    requireAbility(u, "manage_item");
    ensureBaseline();            // ให้มีที่ให้ย้อนกลับเสมอ
    return ok({ snapshots: listSnapshots() });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const u = await currentUser();
    requireAbility(u, "manage_item");
    const b = await jsonBody<{ name?: string }>(req);
    const snap = createSnapshot(str(b.name, "ชื่อจุดสำรอง"));
    audit(u.id, "create_snapshot", "demo_snapshot", snap.name, null, { bytes: snap.bytes });
    return ok({ snapshot: snap, snapshots: listSnapshots() }, 201);
  } catch (e) {
    return fail(e);
  }
}
