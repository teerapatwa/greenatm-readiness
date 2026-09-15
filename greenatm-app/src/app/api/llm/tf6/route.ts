import { NextResponse } from "next/server";
import { LlmConfigError } from "@/lib/llm/config";
import { runTf6Probe } from "@/lib/llm/agentLoop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** TF6 — ทดสอบ tool interaction จริง แยกจากแชทธรรมดา ตามที่เอกสาร integration สั่งไว้ */
export async function POST() {
  try {
    const result = await runTf6Probe();
    return NextResponse.json({ ...result, testedAt: new Date().toISOString() });
  } catch (e) {
    if (e instanceof LlmConfigError) {
      return NextResponse.json({ configError: e.message, hints: e.hints }, { status: 503 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
