import { NextResponse } from "next/server";
import { currentUser, requireAbility } from "@/lib/auth/session";
import { activeProvider, listEndpoints, setActiveProvider } from "@/lib/llm/endpoints";
import { PROVIDERS } from "@/lib/llm/providers";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * เลือกว่าจะให้ agent ใช้โมเดลตัวไหน — ผู้ดูแล (ทีมกลาง) เท่านั้น
 *
 * เลือกได้เฉพาะจากรายการที่ตั้งค่าไว้แล้วในไฟล์สภาพแวดล้อม
 * **ไม่เปิดให้พิมพ์ URL เอง** เพราะเป็นทางที่ key จะถูกส่งไปปลายทางที่ไม่ได้ตั้งใจ
 */

function snapshot() {
  const active = activeProvider();
  return {
    active,
    providers: listEndpoints().map((e) => ({
      ...e,
      label: PROVIDERS[e.id].label,
      notes: PROVIDERS[e.id].notes,
      isActive: e.id === active,
    })),
  };
}

export async function GET() {
  try {
    await currentUser(); // ดูได้ทุกบทบาท — เป็นข้อมูลสถานะ ไม่ใช่ข้อมูลรายกอง
    return ok(snapshot());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const u = await currentUser();
    requireAbility(u, "set_setting");
    const body = (await req.json()) as { provider?: string };
    if (!body.provider) throw new Error("ต้องระบุ provider");

    const chosen = listEndpoints().find((e) => e.id === body.provider);
    if (chosen && !chosen.configured) {
      throw new Error(
        `ยังตั้งค่า ${body.provider} ไม่ครบ — ขาด ${chosen.missing.join(" · ")} · เติมใน .env.local แล้วเปิดเซิร์ฟเวอร์ใหม่`,
      );
    }

    setActiveProvider(body.provider, u.id);
    return ok({ ...snapshot(), note: `สลับไปใช้ ${PROVIDERS[body.provider as "dgx" | "qwen"].label} แล้ว` });
  } catch (e) {
    return fail(e);
  }
}
