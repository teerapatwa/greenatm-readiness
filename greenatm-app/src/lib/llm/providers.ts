import "server-only";
import type { ProviderId } from "./config";

/**
 * ตัวเลือกเฉพาะ provider
 *
 * ทำไมต้องมีไฟล์นี้: เอกสาร integration ทั้งสองฉบับเขียนตรงกันว่า
 *   "preserve provider-specific options explicitly;
 *    changing the model ID alone may not be sufficient"
 * → การสลับ endpoint ด้วย LLM_BASE_URL + LLM_MODEL อย่างเดียว "ไม่พอ"
 *
 * `enable_thinking: false` เป็น top-level field ของ request จริง ๆ
 * ไม่ใช่ `extra_body` ของ SDK — โปรเจกต์นี้ใช้ fetch ตรง จึงส่งได้ตรง ๆ
 */

export type ProviderProfile = {
  id: ProviderId;
  label: string;
  /** field เพิ่มที่แนบไปกับ request */
  extraBody: Record<string, unknown>;
  /** ยืนยันแล้วหรือยังว่า endpoint นี้รับ extraBody — ใช้ตัดสินใจว่าจะ retry ไหม */
  extraBodyVerified: boolean;
  /** งบ token สำหรับคำตอบสุดท้าย (เผื่อ reasoning ใน deployment ที่ยังไม่ยืนยัน) */
  defaultMaxTokens: number;
  notes: string[];
};

export const PROVIDERS: Record<ProviderId, ProviderProfile> = {
  dgx: {
    id: "dgx",
    label: "DGX Spark",
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
    extraBodyVerified: false,
    defaultMaxTokens: 2048,
    notes: [
      "thinking เปิดโดยค่าเริ่มต้น — ต้องปิดผ่าน chat_template_kwargs",
      "ห้ามเอา reasoning text มาใช้เป็นคำตอบสุดท้าย",
    ],
  },
  qwen: {
    id: "qwen",
    label: "Qwen (FPT Cloud)",
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
    extraBodyVerified: false,
    defaultMaxTokens: 2048,
    notes: [
      "port / API path / model list / auth ยังไม่ยืนยันสักอย่าง",
      "endpoint ที่บันทึกไว้เป็น HTTP ธรรมดา — ดูประตูกันพลาดใน config.ts",
      "ยังไม่ยืนยันว่า chat template รองรับ enable_thinking — โค้ดจะ retry ให้ถ้าโดน 400",
    ],
  },
};

export function profileFor(provider: ProviderId): ProviderProfile {
  return PROVIDERS[provider];
}
