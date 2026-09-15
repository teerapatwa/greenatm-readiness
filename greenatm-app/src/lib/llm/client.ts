import "server-only";
import { loadLlmConfig, type LlmConfig } from "./config";
import { profileFor } from "./providers";

/**
 * ตัวเรียกโมเดล — OpenAI-compatible Chat Completions, non-streaming
 *
 * กฎที่บังคับไว้ในไฟล์นี้:
 *  1. ล้มเหลวคือล้มเหลว — ไม่มีการคืนคำตอบสำเร็จรูปแทนคำตอบที่ยิงไม่สำเร็จ
 *  2. content ว่าง = ยังไม่สำเร็จ ต้องรายงาน finish_reason ตามจริง
 *  3. ถ้า 400 เพราะ extraBody ที่ยังไม่ยืนยัน → retry หนึ่งครั้งโดยถอด extraBody ออก
 *     แล้วบอกตามจริงว่ารอบไหนที่ผ่าน (นี่คือการ "verify support" ที่เอกสารสั่งไว้)
 *  4. key ไม่ถูก log และไม่ถูกส่งกลับ client
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatResult = {
  ok: boolean;
  httpStatus: number | null;
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string | null;
  usage: Record<string, unknown> | null;
  latencyMs: number;
  /** true = ต้องถอด extraBody ออกถึงจะผ่าน → endpoint นี้ไม่รองรับ */
  extraBodyRejected: boolean;
  error: string | null;
  raw?: unknown;
};

type ChatOptions = {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
  config?: LlmConfig;
  keepRaw?: boolean;
};

function authHeaders(cfg: LlmConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  return h;
}

async function postOnce(
  cfg: LlmConfig,
  body: Record<string, unknown>,
): Promise<{ status: number; json: any; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ปล่อยเป็น null — จะรายงานเป็นข้อความดิบแทน */
    }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function chatCompletion(opts: ChatOptions): Promise<ChatResult> {
  const cfg = opts.config ?? loadLlmConfig();
  const profile = profileFor(cfg.provider);
  const started = Date.now();

  const base: Record<string, unknown> = {
    model: cfg.model,
    messages: opts.messages,
    stream: false,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? profile.defaultMaxTokens,
  };
  if (opts.tools && opts.tools.length > 0) {
    base.tools = opts.tools;
    base.tool_choice = "auto";
  }

  const fail = (error: string, httpStatus: number | null, extraBodyRejected = false): ChatResult => ({
    ok: false,
    httpStatus,
    content: null,
    toolCalls: [],
    finishReason: null,
    usage: null,
    latencyMs: Date.now() - started,
    extraBodyRejected,
    error,
  });

  let extraBodyRejected = false;
  let attempt: { status: number; json: any; text: string };

  try {
    attempt = await postOnce(cfg, { ...base, ...profile.extraBody });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return fail(`หมดเวลา ${cfg.timeoutMs} ms — ยังไม่ได้คำตอบจาก endpoint`, null);
    }
    return fail(`เชื่อมต่อไม่สำเร็จ: ${e?.message ?? String(e)}`, null);
  }

  // กฎข้อ 3 — 400 ตอนส่ง extraBody ที่ยังไม่ยืนยัน แปลว่า endpoint นี้ไม่รองรับ
  if (attempt.status === 400 && Object.keys(profile.extraBody).length > 0) {
    extraBodyRejected = true;
    try {
      attempt = await postOnce(cfg, base);
    } catch (e: any) {
      return fail(`retry ไม่สำเร็จ: ${e?.message ?? String(e)}`, 400, true);
    }
  }

  if (attempt.status < 200 || attempt.status >= 300) {
    const detail =
      attempt.json?.error?.message ??
      attempt.json?.message ??
      attempt.text.slice(0, 400) ??
      "ไม่มีรายละเอียด";
    return fail(`HTTP ${attempt.status}: ${detail}`, attempt.status, extraBodyRejected);
  }

  const choice = attempt.json?.choices?.[0];
  const message = choice?.message ?? {};
  const content: string | null =
    typeof message.content === "string" && message.content.trim() !== ""
      ? message.content
      : null;
  const toolCalls: ToolCall[] = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const finishReason: string | null = choice?.finish_reason ?? null;

  // กฎข้อ 2 — ไม่มีเนื้อหาและไม่มี tool call = ยังไม่สำเร็จ
  if (!content && toolCalls.length === 0) {
    return {
      ...fail(
        `ตอบกลับสำเร็จแต่ไม่มีเนื้อหา (finish_reason = ${finishReason ?? "ไม่ระบุ"})`,
        attempt.status,
        extraBodyRejected,
      ),
      finishReason,
      usage: attempt.json?.usage ?? null,
      raw: opts.keepRaw ? attempt.json : undefined,
    };
  }

  return {
    ok: true,
    httpStatus: attempt.status,
    content,
    toolCalls,
    finishReason,
    usage: attempt.json?.usage ?? null,
    latencyMs: Date.now() - started,
    extraBodyRejected,
    error: null,
    raw: opts.keepRaw ? attempt.json : undefined,
  };
}

/** GET /v1/models — บาง gateway ไม่เปิด route นี้ ซึ่งไม่ใช่ความล้มเหลวของการเชื่อมต่อ */
export async function listModels(cfg?: LlmConfig) {
  const c = cfg ?? loadLlmConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(c.timeoutMs, 20000));
  const started = Date.now();
  try {
    const res = await fetch(`${c.baseUrl}/models`, {
      headers: authHeaders(c),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let ids: string[] = [];
    try {
      const j = JSON.parse(text);
      ids = Array.isArray(j?.data)
        ? j.data.map((m: any) => String(m?.id)).filter(Boolean)
        : [];
    } catch {
      /* ไม่ใช่ JSON */
    }
    return {
      ok: res.ok,
      httpStatus: res.status,
      models: ids,
      latencyMs: Date.now() - started,
      error: res.ok ? null : `HTTP ${res.status}: ${text.slice(0, 200)}`,
    };
  } catch (e: any) {
    return {
      ok: false,
      httpStatus: null,
      models: [] as string[],
      latencyMs: Date.now() - started,
      error: e?.name === "AbortError" ? "หมดเวลา" : `เชื่อมต่อไม่สำเร็จ: ${e?.message ?? String(e)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
