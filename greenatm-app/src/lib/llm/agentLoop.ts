import "server-only";
import { chatCompletion, type ChatMessage, type ToolCall } from "./client";
import { loadLlmConfig } from "./config";
import { TEST_TOOLS, TOOL_NAMES, executeTool, type ToolExecution } from "./tools";

/**
 * TF6 — "endpoint คืน tool_calls จริงหรือไม่"
 *
 * PLAN §5.4 กำหนดสองทาง:
 *   ทางหลัก  native tool calling  (ถ้า TF6 ผ่าน)
 *   ทางสำรอง ลูปเลือก action ด้วย JSON ที่ validate ด้วย schema ในโค้ด
 *
 * ทางสำรองยังเป็น agent ตามนิยาม — โมเดลเลือกการกระทำจากผลที่สังเกตได้
 * ภายใต้ขอบเขตที่บังคับ เพียงแต่ไม่พึ่ง native tool-calling API
 * ⚠️ ถ้าใช้ทางสำรอง ต้องระบุตามจริงบนสไลด์ ห้ามอ้างว่าใช้ native tool calling
 */

export type ProbeStep = {
  step: number;
  kind: "model" | "tool";
  detail: string;
  latencyMs?: number;
};

export type Tf6Result = {
  verdict: "native" | "fallback" | "failed";
  nativeToolCallsSeen: boolean;
  steps: ProbeStep[];
  toolExecutions: ToolExecution[];
  finalAnswer: string | null;
  extraBodyRejected: boolean;
  totalLatencyMs: number;
  error: string | null;
};

const SYSTEM = [
  "คุณเป็นผู้ช่วยประเมินหลักฐานของระบบ GreenATM",
  "ถ้าต้องการข้อมูลของรายการใด ให้เรียกใช้เครื่องมือที่มีให้ อย่าเดาข้อมูลเอง",
  "ถ้าไม่มีข้อมูลในระบบ ให้ตอบว่าไม่มี ห้ามแต่งตัวเลขหรือชื่อเอกสาร",
  "ตอบเป็นภาษาไทย สั้น ตรงประเด็น",
].join(" ");

const TASK = 'รายการ 2.7 มีหลักฐานแนบไว้กี่ชิ้น และแต่ละชิ้นชื่ออะไร';

const MAX_TOOL_CALLS = 6;

/** ── ทางหลัก: native tool calling ─────────────────────────────────────── */
async function tryNative(): Promise<Tf6Result | null> {
  const cfg = loadLlmConfig();
  const steps: ProbeStep[] = [];
  const executions: ToolExecution[] = [];
  const started = Date.now();
  let extraBodyRejected = false;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: TASK },
  ];

  let first = await chatCompletion({ messages, tools: TEST_TOOLS, config: cfg });
  extraBodyRejected ||= first.extraBodyRejected;
  steps.push({
    step: 1,
    kind: "model",
    detail: first.ok
      ? `ตอบกลับ · tool_calls ${first.toolCalls.length} รายการ`
      : `ล้มเหลว: ${first.error}`,
    latencyMs: first.latencyMs,
  });

  if (!first.ok) {
    return {
      verdict: "failed",
      nativeToolCallsSeen: false,
      steps,
      toolExecutions: executions,
      finalAnswer: null,
      extraBodyRejected,
      totalLatencyMs: Date.now() - started,
      error: first.error,
    };
  }

  if (first.toolCalls.length === 0) {
    // ไม่ล้มเหลว แต่ไม่เรียก tool → ยังไม่ยืนยันว่า native ใช้ได้ ให้ไปลองทางสำรอง
    return null;
  }

  // มี tool_calls จริง → validate argument แล้ว execute แล้วป้อนผลกลับ
  let calls: ToolCall[] = first.toolCalls.slice(0, MAX_TOOL_CALLS);
  messages.push({ role: "assistant", content: first.content, tool_calls: calls });

  let stepNo = 2;
  for (const call of calls) {
    const exec = executeTool(call.function.name, call.function.arguments);
    executions.push(exec);
    steps.push({
      step: stepNo++,
      kind: "tool",
      detail: `${call.function.name}(${call.function.arguments}) → ${exec.ok ? "สำเร็จ" : `ปฏิเสธ: ${exec.error}`}`,
    });
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(exec.ok ? exec.result : { error: exec.error }),
    });
  }

  const second = await chatCompletion({ messages, tools: TEST_TOOLS, config: cfg });
  extraBodyRejected ||= second.extraBodyRejected;
  steps.push({
    step: stepNo++,
    kind: "model",
    detail: second.ok ? "สรุปคำตอบจากผลของ tool" : `ล้มเหลว: ${second.error}`,
    latencyMs: second.latencyMs,
  });

  return {
    verdict: second.ok ? "native" : "failed",
    nativeToolCallsSeen: true,
    steps,
    toolExecutions: executions,
    finalAnswer: second.content,
    extraBodyRejected,
    totalLatencyMs: Date.now() - started,
    error: second.ok ? null : second.error,
  };
}

/** ── ทางสำรอง: ลูปเลือก action ด้วย JSON ที่ validate ในโค้ด ───────────── */
const FALLBACK_SYSTEM = [
  SYSTEM,
  "ตอบกลับเป็น JSON อย่างเดียว ไม่มีข้อความอื่นประกอบ ไม่มี markdown fence",
  `เลือกได้สองแบบเท่านั้น:`,
  `{"action":"get_item","args":{"item_id":"2.7"}}`,
  `{"action":"final","answer":"<คำตอบภาษาไทย>"}`,
].join(" ");

/** ดึง JSON ก้อนแรกออกจากข้อความ ทนต่อ fence และคำนำหน้า */
function extractJson(text: string): any | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  for (let end = candidate.length; end > start; end--) {
    const slice = candidate.slice(start, end);
    if (!slice.trimEnd().endsWith("}")) continue;
    try {
      return JSON.parse(slice);
    } catch {
      /* ลองสั้นลง */
    }
  }
  return null;
}

async function tryFallback(): Promise<Tf6Result> {
  const cfg = loadLlmConfig();
  const steps: ProbeStep[] = [];
  const executions: ToolExecution[] = [];
  const started = Date.now();
  let extraBodyRejected = false;
  let malformed = 0;

  const messages: ChatMessage[] = [
    { role: "system", content: FALLBACK_SYSTEM },
    { role: "user", content: TASK },
  ];

  for (let i = 1; i <= MAX_TOOL_CALLS; i++) {
    const r = await chatCompletion({ messages, config: cfg });
    extraBodyRejected ||= r.extraBodyRejected;

    if (!r.ok) {
      steps.push({ step: steps.length + 1, kind: "model", detail: `ล้มเหลว: ${r.error}`, latencyMs: r.latencyMs });
      return {
        verdict: "failed",
        nativeToolCallsSeen: false,
        steps,
        toolExecutions: executions,
        finalAnswer: null,
        extraBodyRejected,
        totalLatencyMs: Date.now() - started,
        error: r.error,
      };
    }

    const parsed = extractJson(r.content ?? "");
    if (!parsed || typeof parsed.action !== "string") {
      malformed++;
      steps.push({
        step: steps.length + 1,
        kind: "model",
        detail: `JSON ผิดรูป (ครั้งที่ ${malformed})`,
        latencyMs: r.latencyMs,
      });
      // PLAN §5.3 — ผิดรูป 2 ครั้งติด ให้หยุด ไม่เดาให้จบ
      if (malformed >= 2) {
        return {
          verdict: "failed",
          nativeToolCallsSeen: false,
          steps,
          toolExecutions: executions,
          finalAnswer: null,
          extraBodyRejected,
          totalLatencyMs: Date.now() - started,
          error: "โมเดลคืน JSON ผิดรูป 2 ครั้งติด — หยุดตามเงื่อนไขใน PLAN §5.3",
        };
      }
      messages.push({ role: "assistant", content: r.content });
      messages.push({ role: "user", content: "รูปแบบไม่ถูกต้อง ตอบเป็น JSON ตามที่กำหนดเท่านั้น" });
      continue;
    }

    if (parsed.action === "final") {
      steps.push({ step: steps.length + 1, kind: "model", detail: "เลือก action: final", latencyMs: r.latencyMs });
      return {
        verdict: "fallback",
        nativeToolCallsSeen: false,
        steps,
        toolExecutions: executions,
        finalAnswer: typeof parsed.answer === "string" ? parsed.answer : null,
        extraBodyRejected,
        totalLatencyMs: Date.now() - started,
        error: null,
      };
    }

    if (!TOOL_NAMES.includes(parsed.action)) {
      steps.push({
        step: steps.length + 1,
        kind: "model",
        detail: `เลือก action ที่ไม่อนุญาต: ${parsed.action} — โค้ดปฏิเสธ`,
        latencyMs: r.latencyMs,
      });
      messages.push({ role: "assistant", content: r.content });
      messages.push({ role: "user", content: `action "${parsed.action}" ไม่มีในระบบ เลือกจาก get_item หรือ final เท่านั้น` });
      continue;
    }

    steps.push({ step: steps.length + 1, kind: "model", detail: `เลือก action: ${parsed.action}`, latencyMs: r.latencyMs });
    const exec = executeTool(parsed.action, parsed.args ?? {});
    executions.push(exec);
    steps.push({
      step: steps.length + 1,
      kind: "tool",
      detail: `${exec.name}(${JSON.stringify(exec.args)}) → ${exec.ok ? "สำเร็จ" : `ปฏิเสธ: ${exec.error}`}`,
    });
    messages.push({ role: "assistant", content: r.content });
    messages.push({
      role: "user",
      content: `ผลของเครื่องมือ: ${JSON.stringify(exec.ok ? exec.result : { error: exec.error })}`,
    });
  }

  return {
    verdict: "failed",
    nativeToolCallsSeen: false,
    steps,
    toolExecutions: executions,
    finalAnswer: null,
    extraBodyRejected,
    totalLatencyMs: Date.now() - started,
    error: `ชนเพดาน ${MAX_TOOL_CALLS} ครั้งโดยยังไม่ได้ข้อสรุป — รายงานว่าไม่สำเร็จ ไม่เดาให้จบ`,
  };
}

export async function runTf6Probe(): Promise<Tf6Result> {
  const native = await tryNative();
  if (native) return native;
  const fb = await tryFallback();
  return {
    ...fb,
    steps: [
      { step: 0, kind: "model", detail: "ไม่พบ tool_calls ในคำตอบแรก → เปลี่ยนไปทางสำรอง (JSON action loop)" },
      ...fb.steps,
    ],
  };
}
