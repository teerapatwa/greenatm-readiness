import { NextResponse } from "next/server";
import { loadLlmConfig, describeConfig, LlmConfigError } from "@/lib/llm/config";
import { chatCompletion, listModels } from "@/lib/llm/client";
import { profileFor } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ตรวจการเชื่อมต่อตามลำดับใน QWEN-FPT-INTEGRATION.md §Prove the connection
 *   1) ตั้งค่าครบไหม  2) GET /v1/models  3) POST /v1/chat/completions ครั้งเดียว non-streaming
 * ผลทุกช่องถูกบันทึกตามจริง รวมช่องที่ไม่ผ่าน
 */
export async function GET() {
  try {
    const cfg = loadLlmConfig();
    const profile = profileFor(cfg.provider);

    const models = await listModels(cfg);

    const chat = await chatCompletion({
      config: cfg,
      messages: [
        { role: "system", content: "Reply briefly in Thai. Keep missing information explicit." },
        {
          role: "user",
          content:
            "พนักงานบอกเพียงว่า VPN ใช้งานไม่ได้ ควรถามข้อมูลอะไรเพิ่มก่อนแนะนำวิธีแก้?",
        },
      ],
    });

    const modelListed =
      models.ok && models.models.length > 0 ? models.models.includes(cfg.model) : null;

    return NextResponse.json({
      config: describeConfig(cfg),
      providerNotes: profile.notes,
      checks: {
        models: {
          ok: models.ok,
          httpStatus: models.httpStatus,
          latencyMs: models.latencyMs,
          served: models.models,
          modelIsListed: modelListed,
          error: models.error,
          note: models.ok
            ? null
            : "gateway อาจไม่เปิด route นี้ — ไม่ถือว่าการเชื่อมต่อล้มเหลว ให้ยืนยัน model id กับ facilitator แทน",
        },
        chat: {
          ok: chat.ok,
          httpStatus: chat.httpStatus,
          latencyMs: chat.latencyMs,
          finishReason: chat.finishReason,
          usage: chat.usage,
          content: chat.content,
          extraBodyRejected: chat.extraBodyRejected,
          error: chat.error,
        },
      },
      thinkingOption: {
        sent: JSON.stringify(profile.extraBody),
        supported: chat.extraBodyRejected ? false : chat.ok ? true : null,
        note: chat.extraBodyRejected
          ? "endpoint ปฏิเสธ chat_template_kwargs (HTTP 400) — โค้ด retry โดยถอดออกแล้วจึงผ่าน"
          : null,
      },
      testedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof LlmConfigError) {
      return NextResponse.json(
        { configError: e.message, hints: e.hints },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
