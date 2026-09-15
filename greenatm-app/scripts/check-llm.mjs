#!/usr/bin/env node
/**
 * ตรวจการเชื่อมต่อจากบรรทัดคำสั่ง — ไม่ต้องเปิดเว็บ
 * รันบนเครื่องที่จะรัน backend จริง ตามที่ QWEN-FPT-INTEGRATION.md กำหนด
 *
 *   node scripts/check-llm.mjs
 *
 * อ่านค่าจาก .env.local (ถ้ามี) แล้วทับด้วย environment จริง
 * ไม่พิมพ์ API key ออกมาไม่ว่ากรณีใด
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadDotEnv(resolve(process.cwd(), ".env.local"));
loadDotEnv(resolve(process.cwd(), ".env"));

const provider = (process.env.LLM_PROVIDER || "qwen").trim();
const baseUrl = (process.env.LLM_BASE_URL || "").trim().replace(/\/+$/, "");
const model = (process.env.LLM_MODEL || "").trim();
const apiKey = (process.env.LLM_API_KEY || "").trim();
const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 120000);
const allowInsecure = (process.env.ALLOW_INSECURE_LLM_HTTP || "").toLowerCase() === "true";

const isPlaceholder = (v) => v === "" || /^<.*>$/.test(v);
const problems = [];
if (isPlaceholder(baseUrl)) problems.push("LLM_BASE_URL ยังไม่ได้ตั้งค่า");
else if (!baseUrl.endsWith("/v1")) problems.push("LLM_BASE_URL ต้องลงท้ายด้วย /v1");
if (isPlaceholder(model)) problems.push("LLM_MODEL ยังเป็น placeholder");
const key = isPlaceholder(apiKey) ? null : apiKey;
if (baseUrl.startsWith("http://") && key && !allowInsecure) {
  problems.push(
    "ปฏิเสธการส่ง API key ข้าม http:// — ขอ HTTPS หรือเส้นทางภายในจาก facilitator ก่อน " +
      "(หรือปล่อย LLM_API_KEY ว่างถ้า endpoint ไม่ต้องใช้ key)",
  );
}

console.log("─".repeat(72));
console.log(`provider  ${provider}`);
console.log(`base URL  ${baseUrl || "(ไม่ได้ตั้ง)"}`);
console.log(`model     ${model || "(ไม่ได้ตั้ง)"}`);
console.log(`api key   ${key ? "มี (ไม่แสดง)" : "ไม่มี"}`);
console.log(`transport ${baseUrl.startsWith("https://") ? "HTTPS" : "HTTP ธรรมดา"}`);
console.log("─".repeat(72));

if (problems.length) {
  console.error("\n⛔ ตั้งค่ายังไม่ครบ — ยังยิงไม่ได้\n");
  for (const p of problems) console.error("   · " + p);
  console.error("\n   คัดลอก .env.example เป็น .env.local แล้วเติมค่าที่ facilitator ยืนยัน\n");
  process.exit(1);
}

const headers = { "Content-Type": "application/json" };
if (key) headers.Authorization = `Bearer ${key}`;

const extraBody = { chat_template_kwargs: { enable_thinking: false } };

async function withTimeout(fn, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fn(c.signal);
  } finally {
    clearTimeout(t);
  }
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const icon = ok === true ? "✓" : ok === false ? "⛔" : "⬜";
  console.log(`${icon}  ${name}${detail ? " — " + detail : ""}`);
}

// 1) GET /v1/models
let served = [];
try {
  const t0 = Date.now();
  const res = await withTimeout(
    (signal) => fetch(`${baseUrl}/models`, { headers, signal }),
    Math.min(timeoutMs, 20000),
  );
  const text = await res.text();
  if (res.ok) {
    try {
      served = (JSON.parse(text).data || []).map((m) => m.id).filter(Boolean);
    } catch {}
    record("GET /v1/models", true, `${served.length} รุ่น · ${Date.now() - t0} ms`);
    if (served.length) console.log("     " + served.join(", "));
    record(
      "model alias ตรงกับที่ served",
      served.includes(model),
      served.includes(model) ? model : `ไม่พบ "${model}" — หยุดแล้วถาม facilitator อย่าเดา`,
    );
  } else {
    record("GET /v1/models", false, `HTTP ${res.status} — gateway อาจไม่เปิด route นี้`);
    record("model alias ตรงกับที่ served", null, "ตรวจไม่ได้ ให้ยืนยันกับ facilitator");
  }
} catch (e) {
  record("GET /v1/models", false, e.name === "AbortError" ? "หมดเวลา" : e.message);
  record("model alias ตรงกับที่ served", null, "ตรวจไม่ได้");
}

// 2) POST /v1/chat/completions
const basePayload = {
  model,
  messages: [
    { role: "system", content: "Reply briefly in Thai. Keep missing information explicit." },
    {
      role: "user",
      content: "พนักงานบอกเพียงว่า VPN ใช้งานไม่ได้ ควรถามข้อมูลอะไรเพิ่มก่อนแนะนำวิธีแก้?",
    },
  ],
  stream: false,
  temperature: 0,
  max_tokens: 2048,
};

async function chat(payload) {
  const t0 = Date.now();
  const res = await withTimeout(
    (signal) =>
      fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      }),
    timeoutMs,
  );
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, ms: Date.now() - t0 };
}

let thinkingSupported = null;
let r = await chat({ ...basePayload, ...extraBody });
if (r.status === 400) {
  thinkingSupported = false;
  record("รองรับ enable_thinking:false", false, "HTTP 400 — ลองใหม่โดยถอดฟิลด์ออก");
  r = await chat(basePayload);
} else {
  thinkingSupported = r.status >= 200 && r.status < 300 ? true : null;
  record("รองรับ enable_thinking:false", thinkingSupported, thinkingSupported ? "ส่งไปแล้วไม่ถูกปฏิเสธ" : "ยังสรุปไม่ได้");
}

const choice = r.json?.choices?.[0];
const content = choice?.message?.content;
const finish = choice?.finish_reason;

if (r.status < 200 || r.status >= 300) {
  record("แชทธรรมดา", false, `HTTP ${r.status}: ${(r.json?.error?.message || r.text || "").slice(0, 200)}`);
} else if (!content || !String(content).trim()) {
  record("แชทธรรมดา", false, `ตอบกลับสำเร็จแต่ไม่มีเนื้อหา · finish_reason = ${finish ?? "ไม่ระบุ"}`);
} else {
  record("แชทธรรมดา", true, `${r.ms} ms · finish_reason = ${finish ?? "—"}`);
  record("latency พอเดโมได้", r.ms < 15000, `${r.ms} ms`);
  console.log("\n--- คำตอบที่ได้จริง (อ่านเองว่าตรงคำถามไหม) ---");
  console.log(String(content).trim());
  console.log("---------------------------------------------\n");
}

// 3) TF6 — tool_calls จริง
const tools = [
  {
    type: "function",
    function: {
      name: "get_item",
      description: "ดึงข้อมูลรายการประเมิน GreenATM หนึ่งรายการ",
      parameters: {
        type: "object",
        properties: { item_id: { type: "string" } },
        required: ["item_id"],
      },
    },
  },
];

try {
  const t = await chat({
    ...basePayload,
    ...(thinkingSupported === false ? {} : extraBody),
    messages: [
      {
        role: "system",
        content: "ถ้าต้องการข้อมูลรายการใด ให้เรียกใช้เครื่องมือที่มีให้ อย่าเดาข้อมูลเอง",
      },
      { role: "user", content: "รายการ 2.7 มีหลักฐานแนบไว้กี่ชิ้น" },
    ],
    tools,
    tool_choice: "auto",
  });
  const calls = t.json?.choices?.[0]?.message?.tool_calls;
  const got = Array.isArray(calls) && calls.length > 0;
  record("TF6 · tool_calls จริง", got, got ? JSON.stringify(calls[0]?.function) : "ไม่คืน tool_calls → ต้องใช้ทางสำรอง JSON action loop");
} catch (e) {
  record("TF6 · tool_calls จริง", false, e.message);
}

console.log("\n" + "─".repeat(72));
const pass = results.filter((x) => x.ok === true).length;
const fail = results.filter((x) => x.ok === false).length;
const unknown = results.filter((x) => x.ok == null).length;
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail} · ตรวจไม่ได้ ${unknown}`);
console.log("บันทึกผลตามจริงทุกช่อง รวมช่องที่ไม่ผ่าน — อย่าเขียนว่าเชื่อมต่อสำเร็จถ้ายังไม่ผ่าน");
console.log("─".repeat(72));
process.exit(fail > 0 ? 2 : 0);
