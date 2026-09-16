import "server-only";
import { activeProvider, readEndpoint } from "./endpoints";

/**
 * อ่านและตรวจค่าตั้งค่าของโมเดล — ฝั่ง server เท่านั้น
 *
 * กฎที่บังคับไว้ในไฟล์นี้ (มาจาก DGX-/QWEN-INTEGRATION.md และ PLAN §7):
 *  1. placeholder ที่ยังไม่ถูกแทน = configuration error ที่อ่านรู้เรื่อง ไม่ใช่ยิงแล้วพัง
 *  2. base URL ต้องลงท้าย /v1 — โค้ดต่อ /chat/completions ให้เอง ต่อครั้งเดียว
 *  3. ห้ามส่ง API key ข้าม http:// เว้นแต่ประกาศยอมรับความเสี่ยงไว้ชัดเจน
 *  4. key ไม่เคยถูก log ไม่เคยถูกส่งกลับไป client
 */

export type ProviderId = "dgx" | "qwen";

export type LlmConfig = {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  timeoutMs: number;
  insecureTransport: boolean;
};

export class LlmConfigError extends Error {
  readonly hints: string[];
  constructor(message: string, hints: string[] = []) {
    super(message);
    this.name = "LlmConfigError";
    this.hints = hints;
  }
}

const PLACEHOLDER = /^<.*>$/;

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

function isUnset(v: string): boolean {
  return v === "" || PLACEHOLDER.test(v);
}

export function loadLlmConfig(override?: ProviderId): LlmConfig {
  const problems: string[] = [];
  const hints: string[] = [];

  /*
    provider ที่ใช้จริงมาจาก 3 ทาง เรียงตามลำดับความสำคัญ
      1. override ที่ผู้เรียกระบุ (ใช้ตอน "ลองยิงตัวที่ยังไม่ได้เลือก")
      2. ตัวที่ผู้ดูแลเลือกไว้บนหน้าจอ (เก็บในฐานข้อมูล)
      3. LLM_PROVIDER ในไฟล์สภาพแวดล้อม
    endpoints.ts import แค่ "ชนิดข้อมูล" จากไฟล์นี้ จึงไม่เกิดวงจรตอน runtime
  */
  const provider: ProviderId = override ?? activeProvider();
  const P = provider.toUpperCase();
  const ep = readEndpoint(provider);
  const baseUrl = (ep.baseUrl ?? "").replace(/\/+$/, "");
  if (isUnset(baseUrl)) {
    problems.push(`ยังไม่ได้ตั้งค่า endpoint ของ ${provider} (${ep.missing.join(" · ") || "LLM_BASE_URL"})`);
    hints.push("คัดลอก .env.example เป็น .env.local แล้วเติมค่าที่ facilitator ยืนยัน");
  } else if (!/^https?:\/\//.test(baseUrl)) {
    problems.push(`LLM_BASE_URL ต้องขึ้นต้นด้วย http:// หรือ https:// (ได้รับ "${baseUrl}")`);
  } else if (!baseUrl.endsWith("/v1")) {
    problems.push(`LLM_BASE_URL ต้องลงท้ายด้วย /v1 (ได้รับ "${baseUrl}")`);
    hints.push("โค้ดต่อ /chat/completions ให้เองอยู่แล้ว อย่าใส่มาใน URL");
  }

  const model = ep.model ?? "";
  if (isUnset(model)) {
    problems.push(`ยังไม่ได้ตั้งค่าชื่อรุ่นของ ${provider} (LLM_${P}_MODEL)`);
    hints.push('ยืนยันจาก GET /v1/models หรือจาก facilitator · "qwen3.8-27b" ลอกมาจากโน้ต ยังไม่ยืนยัน');
  }

  const apiKeyRaw = clean(process.env[`LLM_${P}_API_KEY`]) || clean(process.env.LLM_API_KEY);
  const apiKey = isUnset(apiKeyRaw) ? null : apiKeyRaw;

  const timeoutMs = Number(clean(process.env.LLM_TIMEOUT_MS) || "120000");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    problems.push("LLM_TIMEOUT_MS ต้องเป็นตัวเลขมากกว่า 0");
  }

  const allowInsecure = clean(process.env.ALLOW_INSECURE_LLM_HTTP).toLowerCase() === "true";
  const isPlainHttp = baseUrl.startsWith("http://");

  // กฎข้อ 3 — key ห้ามวิ่งข้าม http:// โดยไม่ได้ตั้งใจ
  if (isPlainHttp && apiKey && !allowInsecure) {
    problems.push(
      "ปฏิเสธการส่ง API key ข้าม http:// — endpoint นี้ไม่ได้เข้ารหัส",
    );
    hints.push(
      "QWEN-FPT-INTEGRATION.md: ต้องได้ HTTPS endpoint หรือเส้นทางภายในที่อนุมัติ ก่อนส่ง key จริง",
      "ถ้า facilitator ยืนยันแล้วว่าเป็นเส้นทางภายในที่ปลอดภัย ให้ตั้ง ALLOW_INSECURE_LLM_HTTP=true",
      "ถ้า endpoint ไม่ต้องใช้ key ให้ปล่อย LLM_API_KEY ว่างไว้ — ทดสอบต่อได้ทันที",
    );
  }

  if (problems.length > 0) {
    throw new LlmConfigError(problems.join(" · "), hints);
  }

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    timeoutMs,
    insecureTransport: isPlainHttp,
  };
}

/** ข้อมูลที่ปลอดภัยพอจะส่งไปแสดงบนหน้าจอ — ไม่มี key ไม่มีเศษของ key */
export function describeConfig(c: LlmConfig) {
  return {
    provider: c.provider,
    baseUrl: c.baseUrl,
    model: c.model,
    hasApiKey: c.apiKey !== null,
    timeoutMs: c.timeoutMs,
    insecureTransport: c.insecureTransport,
  };
}
