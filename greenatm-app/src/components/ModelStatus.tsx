"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Status = {
  state: "ok" | "unreachable" | "rejected" | "unconfigured";
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

type Endpoint = {
  id: "dgx" | "qwen";
  label: string;
  configured: boolean;
  baseUrl: string | null;
  model: string | null;
  missing: string[];
  isActive: boolean;
};

const TONE: Record<Status["state"], { dot: string; ink: string; bg: string; line: string }> = {
  ok:           { dot: "var(--accent)", ink: "var(--accent)",   bg: "var(--ok-bg)",   line: "var(--ok-line)" },
  unreachable:  { dot: "var(--danger)", ink: "var(--danger)",   bg: "#fdf2f0",        line: "#f0c3bb" },
  rejected:     { dot: "var(--warn)",   ink: "var(--warn-ink)", bg: "var(--warn-bg)", line: "var(--warn-line)" },
  unconfigured: { dot: "var(--muted)",  ink: "var(--ink2)",     bg: "var(--fill2)",   line: "var(--line)" },
};

/**
 * ไฟบอกสถานะการต่อโมเดล — มุมขวาบน
 *
 * ทำไมต้องมี: กฎของโปรเจกต์คือ **ห้ามอ้างว่าต่อโมเดลได้ก่อนพิสูจน์**
 * ไฟดวงนี้คือการพิสูจน์ที่เห็นได้ตลอดเวลา ไม่ใช่คำกล่าวอ้างในสไลด์
 * ถ้าแดง แปลว่าเดโมที่ใช้โมเดลจะไม่ทำงาน — รู้ก่อนขึ้นเวที ดีกว่ารู้บนเวที
 *
 * ตั้งใจให้ไม่บล็อกการแสดงผลของหน้า: หน้าเรนเดอร์ก่อน แล้วค่อยยิงตรวจ
 */
export function ModelStatus() {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [eps, setEps] = useState<Endpoint[] | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchErr, setSwitchErr] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/llm/status${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      setS(await res.json());
    } catch (e) {
      setS({
        state: "unreachable",
        label: "ตรวจสถานะไม่ได้",
        detail: e instanceof Error ? e.message : String(e),
        checkedAt: new Date().toISOString(),
        cached: false,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const loadEndpoints = useCallback(async () => {
    try {
      const res = await fetch("/api/llm/provider", { cache: "no-store" });
      const b = await res.json();
      if (res.ok) setEps(b.providers);
    } catch { /* ไม่ใช่เรื่องคอขาดบาดตาย — ไฟสถานะยังทำงานได้โดยไม่มีรายการนี้ */ }
  }, []);

  const switchTo = useCallback(async (id: string) => {
    setSwitching(id); setSwitchErr(null);
    try {
      const res = await fetch("/api/llm/provider", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: id }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
      setEps(b.providers);
      await load(true); // ตรวจใหม่ทันที ไม่งั้นไฟยังเป็นของตัวเก่า
    } catch (e) {
      setSwitchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSwitching(null);
    }
  }, [load]);

  useEffect(() => {
    if (open) void loadEndpoints();
  }, [open, loadEndpoints]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!s) {
    return (
      <span style={pill("var(--fill2)", "var(--line)", "var(--muted)")}>
        <Dot color="var(--muted)" pulse />
        Agent · กำลังตรวจ…
      </span>
    );
  }

  const tone = TONE[s.state];
  const when = s.checkedAt.slice(11, 16);

  return (
    <span style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`สถานะการต่อโมเดล: ${s.label} — กดเพื่อดูรายละเอียด`}
        style={{ ...pill(tone.bg, tone.line, tone.ink), cursor: "pointer" }}
      >
        <Dot color={tone.dot} pulse={busy} />
        Agent · {s.label}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40,
            width: 320, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: 10, padding: "12px 14px", boxShadow: "0 8px 24px rgba(21,41,34,.12)",
            fontSize: 12, color: "var(--ink2)", lineHeight: 1.6, textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 12.5, color: tone.ink }}>{s.label}</div>
          <div style={{ marginTop: 4 }}>{s.detail}</div>

          <dl style={{ margin: "10px 0 0", display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px" }}>
            <Row k="provider" v={s.provider} />
            <Row k="รุ่น" v={s.model} />
            <Row k="endpoint" v={s.baseUrl} mono />
            <Row k="API key" v={s.hasApiKey === undefined ? undefined : s.hasApiKey ? "ตั้งไว้แล้ว" : "ไม่ได้ใช้"} />
            <Row k="ตรวจเมื่อ" v={`${when} น.${s.cached ? " (ผลที่จำไว้)" : ""}`} />
          </dl>

          {s.insecureTransport && (
            <p style={{ margin: "8px 0 0", color: "var(--warn-ink)" }}>
              ⚠ endpoint เป็น http ธรรมดา — ห้ามส่ง key จริงหรือข้อมูลที่ไม่เปิดเผยจนกว่าจะได้เส้นทางที่อนุมัติ
            </p>
          )}

          {eps && eps.length > 0 && (
            <div className="ga-divider" style={{ marginTop: 10, paddingTop: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)", marginBottom: 6 }}>
                เลือกโมเดลที่ให้ agent ใช้
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {eps.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={!e.configured || switching !== null || e.isActive}
                    onClick={() => void switchTo(e.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      textAlign: "left", padding: "6px 8px", borderRadius: 7,
                      border: `1px solid ${e.isActive ? "var(--accent)" : "var(--line)"}`,
                      background: e.isActive ? "var(--ok-bg)" : "var(--card)",
                      cursor: !e.configured || e.isActive ? "default" : "pointer",
                      opacity: e.configured ? 1 : 0.55,
                      font: "inherit", color: "inherit",
                    }}
                  >
                    <span aria-hidden style={{ color: e.isActive ? "var(--accent)" : "var(--muted2)" }}>
                      {e.isActive ? "●" : "○"}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 12.5 }}>{e.label}</b>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted2)", wordBreak: "break-all" }}>
                        {e.configured
                          ? `${e.model} · ${e.baseUrl}`
                          : `ยังไม่ได้ตั้งค่า — ขาด ${e.missing.join(" · ")}`}
                      </span>
                    </span>
                    {switching === e.id && (
                      <span style={{ marginLeft: "auto", fontSize: 11 }}>กำลังสลับ…</span>
                    )}
                  </button>
                ))}
              </div>
              {switchErr && (
                <p style={{ margin: "6px 0 0", color: "var(--danger)" }}>⛔ {switchErr}</p>
              )}
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>
                เลือกได้เฉพาะ endpoint ที่ตั้งค่าไว้ใน <code>.env.local</code> แล้ว —
                หน้าจอนี้ไม่เปิดให้พิมพ์ URL เอง · เปลี่ยนได้เฉพาะผู้ดูแล (ทีมกลาง)
              </p>
            </div>
          )}

          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <button className="ga-btn ga-btn-grey" disabled={busy} onClick={() => void load(true)}>
              {busy ? "กำลังตรวจ…" : "ตรวจใหม่"}
            </button>
            <Link href="/llm-check" className="ga-btn ga-btn-ghost" style={{ textDecoration: "none" }}>
              ดูผลตรวจเต็ม
            </Link>
          </div>
        </div>
      )}
    </span>
  );
}

function Row({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  if (!v) return null;
  return (
    <>
      <dt style={{ color: "var(--muted2)" }}>{k}</dt>
      <dd style={{ margin: 0, fontFamily: mono ? "ui-monospace, monospace" : undefined, wordBreak: "break-all" }}>
        {v}
      </dd>
    </>
  );
}

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        width: 7, height: 7, borderRadius: "50%", background: color, flex: "none",
        animation: pulse ? "ga-pulse 1.2s ease-in-out infinite" : undefined,
      }}
    />
  );
}

function pill(bg: string, line: string, ink: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: bg, border: `1px solid ${line}`, color: ink,
    borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600,
    whiteSpace: "nowrap",
  };
}
