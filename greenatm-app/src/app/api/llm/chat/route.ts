import { NextResponse } from "next/server";
import { LlmConfigError } from "@/lib/llm/config";
import { chatCompletion } from "@/lib/llm/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** แชทครั้งเดียว non-streaming — ใช้ตรวจคุณภาพคำตอบภาษาไทยด้วยมือ */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "ต้องระบุ prompt" }, { status: 400 });
    }
    const r = await chatCompletion({
      messages: [
        { role: "system", content: "ตอบเป็นภาษาไทย สั้น ตรงประเด็น ถ้าไม่มีข้อมูลให้บอกว่าไม่มี ห้ามเดา" },
        { role: "user", content: prompt },
      ],
    });
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  } catch (e) {
    if (e instanceof LlmConfigError) {
      return NextResponse.json({ configError: e.message, hints: e.hints }, { status: 503 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
