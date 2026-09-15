import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { buildView } from "@/lib/view";

export const dynamic = "force-dynamic";

/** /item ไม่มีรหัส → พาไปที่รายการแรกที่ผู้ใช้คนนี้แก้ได้ (ถ้าไม่มี ก็รายการแรกสุด) */
export default async function ItemIndex() {
  const u = await currentUser();
  const v = buildView(u);
  const first = v.myItems[0] ?? v.items[0];
  redirect(`/item/${first.code}`);
}
