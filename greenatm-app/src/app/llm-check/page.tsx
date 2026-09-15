"use client";

import { useState } from "react";

/**
 * หน้าตรวจการเชื่อมต่อโมเดล — แทนตารางบันทึกผลใน PLAN_SUMMARY §2.1
 * ทุกช่องเริ่มต้นที่ "ยังไม่ได้ทดสอบ" และเปลี่ยนก็ต่อเมื่อมีผลจริงกลับมา
 * key ไม่เคยถูกส่งมาที่หน้านี้ — หน้าเว็บเรียกได้แค่ API route ของตัวเอง
 */

type Health = any;
type Tf6 = any;

function Verdict({ state, children }: { state: "pass" | "fail" | "unknown"; children: React.ReactNode }) {
  const map = {
    pass: { icon: "✓", color: "var(--ok)" },
    fail: { icon: "⛔", color: "var(--late)" },
    unknown: { icon: "⬜", color: "var(--muted)" },
  }[state];
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: map.color }}>
      <span aria-hidden>{map.icon}</span>
      <span>{children}</span>
    </span>
  );
}

function Row({
  label,
  state,
  detail,
}: {
  label: string;
  state: "pass" | "fail" | "unknown";
  detail?: React.ReactNode;
}) {
  return (
    <tr className="border-t border-[var(--line)] align-top">
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 pr-4 whitespace-nowrap">
        <Verdict state={state}>
          {state === "pass" ? "ผ่าน" : state === "fail" ? "ไม่ผ่าน" : "ยังไม่ได้ทดสอบ"}
        </Verdict>
      </td>
      <td className="py-2 text-[var(--ink2)]">{detail ?? "—"}</td>
    </tr>
  );
}

export default function LlmCheckPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [tf6, setTf6] = useState<Tf6 | null>(null);
  const [busy, setBusy] = useState<"" | "health" | "tf6">("");
  const [err, setErr] = useState<string | null>(null);

  async function runHealth() {
    setBusy("health");
    setErr(null);
    try {
      const r = await fetch("/api/llm/health", { cache: "no-store" });
      setHealth(await r.json());
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy("");
    }
  }

  async function runTf6() {
    setBusy("tf6");
    setErr(null);
    try {
      const r = await fetch("/api/llm/tf6", { method: "POST", cache: "no-store" });
      setTf6(await r.json());
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy("");
    }
  }

  const cfgErr = health?.configError ?? tf6?.configError;
  const chat = health?.checks?.chat;
  const models = health?.checks?.models;

  const s = (v: boolean | null | undefined): "pass" | "fail" | "unknown" =>
    v === true ? "pass" : v === false ? "fail" : "unknown";

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-xl font-semibold">ตรวจการเชื่อมต่อโมเดล</h1>
      <p className="mt-1 text-[14px] text-[var(--ink2)]">
        รันจากเครื่องที่จะรัน backend จริงเท่านั้น · ผลที่ได้บันทึกตามจริงทุกช่อง รวมช่องที่ไม่ผ่าน
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={runHealth}
          disabled={busy !== ""}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-50"
        >
          {busy === "health" ? "กำลังตรวจ…" : "1 · ตรวจ /v1/models + แชทหนึ่งครั้ง"}
        </button>
        <button
          onClick={runTf6}
          disabled={busy !== ""}
          className="rounded-md border border-[var(--accent)] px-4 py-2 text-[var(--accent)] disabled:opacity-50"
        >
          {busy === "tf6" ? "กำลังทดสอบ…" : "2 · TF6 — ทดสอบ tool_calls จริง"}
        </button>
      </div>

      {err && (
        <p className="mt-4 rounded-md border border-[var(--late)] px-3 py-2 text-[var(--late)]">
          เรียก API ไม่สำเร็จ: {err}
        </p>
      )}

      {cfgErr && (
        <div className="mt-4 rounded-md border border-[var(--late)] p-3">
          <p className="font-medium text-[var(--late)]">ตั้งค่ายังไม่ครบ — ยังยิงไม่ได้</p>
          <p className="mt-1 text-[14px]">{cfgErr}</p>
          {Array.isArray(health?.hints ?? tf6?.hints) && (
            <ul className="mt-2 list-disc pl-5 text-[14px] text-[var(--ink2)]">
              {(health?.hints ?? tf6?.hints).map((h: string, i: number) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {health?.config && (
        <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 text-[14px]">
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <div>provider: <b>{health.config.provider}</b></div>
            <div>model: <b>{health.config.model}</b></div>
            <div className="sm:col-span-2">base URL: <b>{health.config.baseUrl}</b></div>
            <div>มี API key: <b>{health.config.hasApiKey ? "มี" : "ไม่มี"}</b></div>
            <div>
              การเข้ารหัส:{" "}
              <b style={{ color: health.config.insecureTransport ? "var(--warn)" : "var(--ok)" }}>
                {health.config.insecureTransport ? "HTTP ธรรมดา" : "HTTPS"}
              </b>
            </div>
          </div>
          {health.config.insecureTransport && (
            <p className="mt-2 text-[13px] text-[var(--ink2)]">
              ⚠ endpoint นี้ไม่ได้เข้ารหัส — ห้ามส่ง key จริงหรือข้อมูลที่ไม่เปิดเผยจนกว่าจะได้
              HTTPS หรือเส้นทางภายในที่ facilitator อนุมัติ
            </p>
          )}
        </div>
      )}

      <table className="mt-6 w-full border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[var(--muted)]">
            <th className="pb-2 font-medium">สิ่งที่ทดสอบ</th>
            <th className="pb-2 font-medium">ผล</th>
            <th className="pb-2 font-medium">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          <Row
            label="/v1/models ตอบ"
            state={s(models?.ok)}
            detail={
              models
                ? models.ok
                  ? `${models.models.length} รุ่น · ${models.latencyMs} ms`
                  : models.error
                : undefined
            }
          />
          <Row
            label="model alias ตรงกับที่ served"
            state={s(models?.modelIsListed)}
            detail={
              models?.modelIsListed === false
                ? `ไม่พบ "${health?.config?.model}" ในรายการ — หยุดแล้วถาม facilitator อย่าเดา`
                : models?.modelIsListed === null
                  ? "gateway ไม่เปิด route นี้ — ยืนยัน model id กับ facilitator แทน"
                  : undefined
            }
          />
          <Row
            label="แชทธรรมดาได้คำตอบที่ไม่ว่าง"
            state={s(chat?.ok)}
            detail={
              chat
                ? chat.ok
                  ? `${chat.latencyMs} ms · finish_reason = ${chat.finishReason ?? "—"}`
                  : chat.error
                : undefined
            }
          />
          <Row
            label="รองรับ enable_thinking:false"
            state={s(health?.thinkingOption?.supported)}
            detail={health?.thinkingOption?.note ?? (health ? "ส่งไปแล้วไม่ถูกปฏิเสธ" : undefined)}
          />
          <Row
            label="tool_calls จริง (TF6)"
            state={tf6 ? (tf6.nativeToolCallsSeen ? "pass" : "fail") : "unknown"}
            detail={
              tf6
                ? tf6.verdict === "native"
                  ? "endpoint คืน tool_calls จริง → ใช้ทางหลักได้"
                  : tf6.verdict === "fallback"
                    ? "ไม่คืน tool_calls → ทางสำรอง JSON action loop ทำงานได้ ต้องระบุตามจริงบนสไลด์"
                    : tf6.error
                : undefined
            }
          />
          <Row
            label="latency พอเดโมได้"
            state={chat?.ok ? (chat.latencyMs < 15000 ? "pass" : "fail") : "unknown"}
            detail={chat?.ok ? `${chat.latencyMs} ms` : undefined}
          />
        </tbody>
      </table>

      {chat?.content && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold">คำตอบที่ได้จริง — ตรวจคุณภาพภาษาไทยด้วยตาเอง</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--card)] p-3 text-[14px] leading-6">
            {chat.content}
          </pre>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            การเชื่อมต่อสำเร็จไม่ใช่การทดสอบพฤติกรรม — อ่านว่าคำตอบตรงคำถามหรือไม่
          </p>
        </section>
      )}

      {tf6?.steps && (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">
            TF6 — ลำดับที่เกิดขึ้นจริง{" "}
            <span className="font-normal text-[var(--ink2)]">
              ({tf6.verdict === "native" ? "native tool calling" : tf6.verdict === "fallback" ? "ทางสำรอง" : "ไม่สำเร็จ"}
              {" · "}
              {tf6.totalLatencyMs} ms)
            </span>
          </h2>
          <ol className="mt-2 space-y-1 text-[14px]">
            {tf6.steps.map((st: any, i: number) => (
              <li key={i} className="flex gap-3 border-b border-[var(--line)] py-1.5">
                <span className="w-6 shrink-0 text-[var(--muted)]">{st.step}</span>
                <span className="w-12 shrink-0 text-[var(--muted)]">{st.kind}</span>
                <span className="flex-1">{st.detail}</span>
                {st.latencyMs != null && (
                  <span className="shrink-0 text-[var(--muted)]">{st.latencyMs} ms</span>
                )}
              </li>
            ))}
          </ol>
          {tf6.finalAnswer && (
            <pre className="mt-3 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--card)] p-3 text-[14px] leading-6">
              {tf6.finalAnswer}
            </pre>
          )}
          {tf6.error && <p className="mt-2 text-[var(--late)]">{tf6.error}</p>}
        </section>
      )}
    </main>
  );
}
