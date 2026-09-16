import "server-only";
import type { ProviderId } from "./config";
import { textSetting, setTextSetting } from "@/lib/db/queries";

/**
 * รายการ endpoint ที่ตั้งค่าไว้ และตัวที่เลือกใช้อยู่
 *
 * ทำไมต้องแยกจาก config.ts: เดิมเลือก provider ได้ทางตัวแปรสภาพแวดล้อมอย่างเดียว
 * ซึ่งแปลว่าต้องแก้ไฟล์แล้ว restart เซิร์ฟเวอร์ — ทำกลางการสาธิตไม่ได้
 * ไฟล์นี้ให้ "เลือกจากรายการที่ตั้งค่าไว้แล้ว" ได้จากหน้าจอ โดย**ไม่**เปิดให้พิมพ์ URL เอง
 *
 * ที่ไม่ยอมให้พิมพ์ URL เองเพราะเป็นทางที่ key จะถูกส่งไปที่อยู่ปลายทางที่ไม่ได้ตั้งใจ —
 * QWEN-FPT-INTEGRATION.md เขียนห้ามไว้ตรง ๆ ว่า "Do not send credentials to an
 * arbitrary replacement URL"
 */

export const PROVIDER_IDS = ["dgx", "qwen"] as const;
export const ACTIVE_PROVIDER_KEY = "llm_provider";

export type EndpointEntry = {
  id: ProviderId;
  /** ตั้งค่าครบพอจะใช้งานได้ไหม (มีทั้ง base URL และชื่อรุ่น) */
  configured: boolean;
  baseUrl: string | null;
  model: string | null;
  hasApiKey: boolean;
  missing: string[];
};

function env(name: string): string {
  const v = (process.env[name] ?? "").trim();
  return v === "" || /^<.*>$/.test(v) ? "" : v;
}

/**
 * อ่านค่าของ provider หนึ่งตัว
 *
 * ลำดับ: ตัวแปรเฉพาะ provider (LLM_DGX_*) ก่อน แล้วค่อยถอยไปใช้ LLM_BASE_URL เดิม
 * **เฉพาะเมื่อ LLM_PROVIDER ชี้มาที่ provider ตัวนั้น** — ไม่งั้นสลับไป qwen แล้ว
 * จะได้ URL ของ dgx ติดมาด้วยโดยไม่รู้ตัว ซึ่งอันตรายกว่าการบอกว่ายังไม่ได้ตั้งค่า
 */
export function readEndpoint(id: ProviderId): EndpointEntry {
  const P = id.toUpperCase();
  const legacyIsMine = (env("LLM_PROVIDER") || "qwen") === id;
  const baseUrl = env(`LLM_${P}_BASE_URL`) || (legacyIsMine ? env("LLM_BASE_URL") : "");
  const model = env(`LLM_${P}_MODEL`) || (legacyIsMine ? env("LLM_MODEL") : "");
  const apiKey = env(`LLM_${P}_API_KEY`) || (legacyIsMine ? env("LLM_API_KEY") : "");

  const missing: string[] = [];
  if (!baseUrl) missing.push(`LLM_${P}_BASE_URL`);
  if (!model) missing.push(`LLM_${P}_MODEL`);

  return {
    id,
    configured: missing.length === 0,
    baseUrl: baseUrl || null,
    model: model || null,
    hasApiKey: apiKey !== "",
    missing,
  };
}

export function listEndpoints(): EndpointEntry[] {
  return PROVIDER_IDS.map(readEndpoint);
}

/** provider ที่ใช้อยู่ — ค่าที่เลือกจากหน้าจอมาก่อนตัวแปรสภาพแวดล้อม */
export function activeProvider(): ProviderId {
  const chosen = textSetting(ACTIVE_PROVIDER_KEY);
  if (chosen && (PROVIDER_IDS as readonly string[]).includes(chosen)) {
    return chosen as ProviderId;
  }
  const fromEnv = env("LLM_PROVIDER");
  return (PROVIDER_IDS as readonly string[]).includes(fromEnv)
    ? (fromEnv as ProviderId)
    : "qwen";
}

export function setActiveProvider(id: string, actor: string): ProviderId {
  setTextSetting(ACTIVE_PROVIDER_KEY, id, actor, PROVIDER_IDS);
  return id as ProviderId;
}
