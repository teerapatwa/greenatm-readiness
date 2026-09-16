import { NextResponse } from "next/server";
import { loadLlmConfig, describeConfig, LlmConfigError } from "@/lib/llm/config";
import { chatCompletion, listModels } from "@/lib/llm/client";
import { activeProvider } from "@/lib/llm/endpoints";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * สถานะการต่อโมเดลแบบย่อ — สำหรับไฟบอกสถานะมุมขวาบน
 *
 * ต่างจาก /api/llm/health ตรงที่ตัวนี้ต้อง **เบาและเร็วพอจะเรียกทุกหน้า**
 *   · ตัด timeout เหลือ 6 วินาที ไม่ใช่ 120 — หน้าจอรอนานกว่านี้ไม่ได้
 *   · ขอคำตอบสั้นที่สุด (max_tokens 1) พอรู้ว่ายิงถึงและตอบกลับได้
 *   · cache ผลไว้ 60 วินาที ไม่งั้นทุกการเปิดหน้าของทุกคนจะยิงโมเดลเครื่องที่ใช้ร่วมกัน
 *
 * ต้องไม่โกหก: "ต่อได้" ประกาศได้ต่อเมื่อ **chat ตอบกลับจริง** เท่านั้น
 * GET /v1/models ที่ไม่ผ่านไม่ใช่ข้อสรุปว่าใช้ไม่ได้ (gateway อาจไม่เปิด route นั้น)
 * แต่ models ผ่านเฉย ๆ ก็ยังไม่ใช่ข้อสรุปว่าคุยได้ จึงต้องยิง chat ทุกครั้ง
 */

export type LlmState = "ok" | "unreachable" | "rejected" | "unconfigured";

type StatusBody = {
  state: LlmState;
  label: string;
  detail: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
  hasApiKey?: boolean;
  insecureTransport?: boolean;
  latencyMs?: number;
  modelListed?: boolean | null;
  checkedAt: string;
  cached: boolean;
};

const TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 6_000;

/* cache แยกตาม provider — ไม่งั้นสลับ provider แล้วยังเห็นผลของตัวเก่าอีกนาที */
let cache: { at: number; key: string; body: StatusBody } | null = null;

async function probe(): Promise<StatusBody> {
  const checkedAt = new Date().toISOString();
  let cfg;
  try {
    cfg = loadLlmConfig();
  } catch (e) {
    if (e instanceof LlmConfigError) {
      return {
        state: "unconfigured",
        label: "ยังไม่ได้ตั้งค่าโมเดล",
        detail: e.message,
        checkedAt,
        cached: false,
      };
    }
    throw e;
  }

  // ใช้ timeout ของตัวเองแทนค่าจริง เพื่อไม่ให้หน้าจอค้างรอ
  const fast = { ...cfg, timeoutMs: PROBE_TIMEOUT_MS };
  const shown = describeConfig(cfg);

  const models = await listModels(fast);
  const chat = await chatCompletion({
    config: fast,
    maxTokens: 1,
    messages: [{ role: "user", content: "ping" }],
  });

  const common = {
    ...shown,
    latencyMs: chat.latencyMs,
    modelListed: models.ok && models.models.length > 0
      ? models.models.includes(cfg.model)
      : null,
    checkedAt,
    cached: false,
  };

  if (chat.ok || chat.finishReason === "length") {
    /*
      finish_reason = "length" คือ max_tokens 1 ทำงานถูกต้อง ไม่ใช่ความล้มเหลว
      โมเดลตอบกลับมาแล้วแต่ถูกตัดตามที่เราสั่ง — ถือว่าเส้นทางใช้ได้จริง
    */
    return {
      ...common,
      state: "ok",
      label: "ต่อโมเดลได้",
      detail: `${shown.model} · ตอบกลับใน ${chat.latencyMs} ms`
        + (common.modelListed === false
          ? " · ⚠ ชื่อรุ่นนี้ไม่อยู่ในรายการที่ endpoint ประกาศ"
          : ""),
    };
  }

  // ยิงไม่ถึงเลย (TCP/DNS/timeout) ต่างจากยิงถึงแล้วถูกปฏิเสธ — คนละวิธีแก้
  const unreachable = chat.httpStatus === null;
  return {
    ...common,
    state: unreachable ? "unreachable" : "rejected",
    label: unreachable ? "ต่อโมเดลไม่ได้" : "โมเดลปฏิเสธคำขอ",
    detail: unreachable
      ? `ยิงไปที่ ${shown.baseUrl} ไม่ถึง — ${chat.error ?? "ไม่ทราบสาเหตุ"}`
      : `HTTP ${chat.httpStatus} — ${chat.error ?? "ไม่ทราบสาเหตุ"}`,
  };
}

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("refresh") === "1";
    const key = activeProvider();
    if (!force && cache && cache.key === key && Date.now() - cache.at < TTL_MS) {
      return NextResponse.json({ ...cache.body, cached: true });
    }
    const body = await probe();
    cache = { at: Date.now(), key, body };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      {
        state: "unreachable" as const,
        label: "ตรวจสถานะไม่สำเร็จ",
        detail: String(e),
        checkedAt: new Date().toISOString(),
        cached: false,
      },
      { status: 500 },
    );
  }
}
