import "server-only";
import { chatCompletion } from "./client";
import { extractText, type Extracted } from "./extract";
import { LlmConfigError } from "./config";
import { evidenceRow, itemByCode, setProposedTier, recordAgentRun } from "@/lib/db/queries";

/**
 * Agent ที่อ่านหลักฐานเทียบเกณฑ์ แล้ว **เสนอ** ชั้น A–D — PLAN R6
 *
 * กฎที่บังคับไว้ในไฟล์นี้:
 *  1. **เสนอเท่านั้น** — เขียนลง proposed_tier · ไม่แตะ confirmed_tier · ค่า Verified ไม่ขยับ
 *     คนกดยืนยันเองที่ศูนย์ตรวจสอบเหมือนเดิม (AC-18 · actor ใน audit_log ห้ามเป็น ai)
 *  2. **ล้มแล้วต้องล้มให้เห็น** — ยิงไม่ถึง หรือตอบไม่เป็น JSON สองครั้ง
 *     → ไม่มีข้อเสนอ และบอกว่าทำไม · **ห้ามเดาชั้นใส่ไว้แทน**
 *  3. ทุกครั้งบันทึกลง agent_run — หลักฐานว่า agent ทำงานจริง ตรวจย้อนได้ (AC-06)
 *  4. บอกตามจริงว่าอ่านเนื้อไฟล์ได้หรือไม่ได้ และอ่านไปเท่าไรจากทั้งหมดเท่าไร
 */

export type TierProposal = {
  ok: boolean;
  tier: "A" | "B" | "C" | "D" | null;
  reason: string | null;
  extract: Extracted;
  latencyMs: number;
  /** ต้อง retry เพราะรอบแรกตอบไม่เป็น JSON หรือไม่ */
  retried: boolean;
  error: string | null;
};

const TIER_RULES = `ชั้น A = เอกสารที่ลงนามหรือออกอย่างเป็นทางการ และแสดงผลที่วัดได้จริง
ชั้น B = เอกสารทางการที่แสดงผล แต่ยังไม่ลงนาม หรือครอบคลุมเพียงบางส่วน
ชั้น C = แผน ร่าง หรือความตั้งใจ ที่ยังไม่มีผลเกิดขึ้นจริง ("แผนไม่ใช่หลักฐานของผลลัพธ์")
ชั้น D = ถูกอ้างถึงแต่ไม่มีตัวเอกสาร หรือเนื้อหาไม่เกี่ยวกับเกณฑ์ข้อนี้`;

function buildPrompt(a: {
  itemCode: string; itemName: string; category: number;
  achievedLevel: number; targetLevel: number;
  title: string; documentDate: string | null; extract: Extracted;
}) {
  const body = a.extract.ok
    ? `เนื้อความในเอกสาร${a.extract.truncated ? ` (ตัดมา ${a.extract.sentChars} จาก ${a.extract.totalChars} ตัวอักษร)` : ""}:
"""
${a.extract.text}
"""`
    : `**อ่านเนื้อไฟล์ไม่ได้** (${a.extract.reason}) — ตัดสินจากชื่อเอกสารและวันที่เท่านั้น
และต้องบอกในเหตุผลด้วยว่าตัดสินโดยไม่ได้อ่านเนื้อไฟล์`;

  /*
    ระบบยังไม่มีข้อความเกณฑ์รายข้อเก็บไว้ (ตาราง tracked_item ไม่มีคอลัมน์นั้น)
    จึงบอกโมเดลตามจริงว่ามีแค่ชื่อรายการกับระดับ — ไม่แต่งเกณฑ์ขึ้นมาเอง
  */
  return `รายการประเมิน ${a.itemCode} · ${a.itemName} (หมวด ${a.category})
ระดับที่ไปถึงแล้ว ${a.achievedLevel} · ระดับเป้าหมาย ${a.targetLevel}
(ระบบยังไม่มีข้อความเกณฑ์รายข้อเก็บไว้ ให้ตัดสินจากลักษณะของเอกสารเป็นหลัก)

ชื่อเอกสาร: ${a.title}
วันที่ในเอกสาร: ${a.documentDate ?? "ไม่ทราบ — ยังไม่มีใครเติมให้"}

${body}

จัดชั้นเอกสารนี้ตามเกณฑ์นี้:
${TIER_RULES}

ตอบกลับเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ไม่มี markdown:
{"tier":"A|B|C|D","reason":"เหตุผลภาษาไทยไม่เกิน 2 ประโยค อ้างสิ่งที่พบในเอกสาร"}`;
}

function parseProposal(text: string | null): { tier: string; reason: string } | null {
  if (!text) return null;
  // โมเดลบางตัวห่อ JSON ด้วย ```json — ดึงก้อนวงเล็บปีกกาแรกออกมา
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { tier?: unknown; reason?: unknown };
    const tier = String(j.tier ?? "").trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(tier)) return null;
    const reason = String(j.reason ?? "").trim();
    return { tier, reason: reason || "ไม่ได้ให้เหตุผล" };
  } catch {
    return null;
  }
}

export async function proposeTier(evidenceId: string): Promise<TierProposal> {
  const startedAt = new Date().toISOString();
  const ev = evidenceRow(evidenceId);
  if (!ev) throw new Error(`ไม่พบหลักฐาน ${evidenceId}`);
  const item = itemByCode(ev.itemCode);
  if (!item) throw new Error(`ไม่พบรายการ ${ev.itemCode}`);

  const extract = await extractText(ev.storedPath);
  const prompt = buildPrompt({
    itemCode: item.code, itemName: item.name, category: item.category,
    achievedLevel: item.achievedLevel, targetLevel: item.targetLevel,
    title: ev.title, documentDate: ev.documentDate, extract,
  });

  const finish = (r: Omit<TierProposal, "extract">): TierProposal => {
    recordAgentRun({
      itemCode: ev.itemCode, startedAt, endedAt: new Date().toISOString(),
      toolCalls: JSON.stringify({
        evidenceId, extracted: extract.ok, chars: extract.sentChars,
        pages: extract.pages, retried: r.retried,
      }),
      outcome: r.ok ? `proposed:${r.tier}` : `failed:${r.error ?? "unknown"}`.slice(0, 200),
    });
    return { ...r, extract };
  };

  let retried = false;
  let latency = 0;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await chatCompletion({
        temperature: 0,
        maxTokens: 400,
        messages: [
          {
            role: "system",
            content: "คุณคือผู้ช่วยคัดกรองหลักฐาน ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON",
          },
          { role: "user", content: attempt === 0 ? prompt : `${prompt}\n\nรอบก่อนคุณตอบไม่เป็น JSON ที่อ่านได้ ตอบใหม่เป็น JSON อย่างเดียว` },
        ],
      });
      latency += res.latencyMs;

      if (!res.ok) {
        return finish({
          ok: false, tier: null, reason: null, latencyMs: latency, retried,
          error: res.error ?? `HTTP ${res.httpStatus}`,
        });
      }

      const parsed = parseProposal(res.content);
      if (parsed) {
        setProposedTier(evidenceId, parsed.tier as "A" | "B" | "C" | "D", parsed.reason);
        return finish({
          ok: true, tier: parsed.tier as "A" | "B" | "C" | "D", reason: parsed.reason,
          latencyMs: latency, retried, error: null,
        });
      }
      retried = true;
    }
    // ตอบไม่เป็น JSON สองรอบ = ยอมแพ้ ไม่เดาชั้นให้
    return finish({
      ok: false, tier: null, reason: null, latencyMs: latency, retried: true,
      error: "โมเดลตอบไม่เป็น JSON ที่อ่านได้ สองครั้งติด",
    });
  } catch (e) {
    return finish({
      ok: false, tier: null, reason: null, latencyMs: latency, retried,
      error: e instanceof LlmConfigError ? e.message : (e instanceof Error ? e.message : String(e)),
    });
  }
}
