"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Snapshot = { name: string; bytes: number; createdAt: string; isBaseline: boolean };

/**
 * เครื่องมือสำหรับเดโม — สำรองและย้อนฐานข้อมูลกลับ
 *
 * ⚠️ ไม่ใช่ฟีเจอร์ของระบบจริง · การย้อนกลับทับข้อมูลของทุกคน
 * จึงต้องกดยืนยันสองจังหวะ และหน้าจอต้องบอกตรง ๆ ว่านี่คือเครื่องมือเดโม
 */
export function DemoTools() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/demo/snapshots", { cache: "no-store" });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error ?? "โหลดรายการจุดสำรองไม่ได้");
      setSnaps(b.snapshots);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSnaps([]);
    }
  };
  useEffect(() => { void load(); }, []);

  const call = async (key: string, url: string, init: RequestInit) => {
    setBusy(key); setError(null); setNote(null);
    try {
      const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · ") || `HTTP ${res.status}`);
      if (b.snapshots) setSnaps(b.snapshots);
      if (b.note) setNote(b.note);
      setArmed(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const fmt = (s: Snapshot) =>
    `${(s.bytes / 1024).toFixed(0)} KB · ${s.createdAt.slice(0, 16).replace("T", " ")}`;

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--warn-line)",
      borderLeft: "4px solid var(--warn)", borderRadius: 10, padding: "16px 20px",
    }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--warn-ink)" }}>
        🧪 เครื่องมือสำหรับเดโม — สำรองและย้อนฐานข้อมูล
      </div>
      <p style={{ margin: "6px 0 14px", fontSize: 12.5, color: "var(--ink2)" }}>
        ใช้ตอนซ้อมหรือสาธิต: กด <b>สำรองตอนนี้</b> ก่อนเริ่มเล่น แล้ว <b>ย้อนกลับ</b> เมื่อเล่นจบ
        <br />
        <b style={{ color: "var(--warn-ink)" }}>
          การย้อนกลับทับข้อมูลของทุกคนในฐานข้อมูลนี้
        </b>{" "}
        — ระบบสำรองสภาพก่อนย้อนไว้ให้อัตโนมัติ จึงย้อนของการย้อนได้อีกชั้น ·
        ในระบบจริงงานนี้เป็นของผู้ดูแลระบบ ไม่ใช่ปุ่มบนหน้าจอผู้ใช้
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12.5, flex: "1 1 220px" }}>
          <span style={{ display: "block", color: "var(--muted)" }}>ชื่อจุดสำรอง</span>
          <input className="ga-input" style={{ width: "100%" }} value={name}
            placeholder="เช่น ก่อนซ้อมรอบเช้า"
            onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="ga-btn ga-btn-primary"
          disabled={busy !== null || name.trim().length < 2}
          onClick={() => call("create", "/api/demo/snapshots", {
            method: "POST", body: JSON.stringify({ name }),
          }).then(() => setName(""))}>
          {busy === "create" ? "กำลังสำรอง…" : "สำรองตอนนี้"}
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        {snaps === null ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>กำลังโหลด…</p>
        ) : snaps.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>ยังไม่มีจุดสำรอง</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {snaps.map((s) => (
              <div key={s.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 10, flexWrap: "wrap",
                background: s.isBaseline ? "var(--ok-bg)" : "var(--fill2)",
                border: `1px solid ${s.isBaseline ? "var(--ok-line)" : "var(--line)"}`,
                borderRadius: 8, padding: "8px 12px",
              }}>
                <div style={{ fontSize: 13, minWidth: 0 }}>
                  <b>{s.name}</b>
                  {s.isBaseline && (
                    <span style={{ fontSize: 11, color: "#166b40", fontWeight: 700 }}>
                      {" "}· จุดตั้งต้น (ลบไม่ได้)
                    </span>
                  )}
                  <div style={{ fontSize: 11.5, color: "var(--muted2)" }}>{fmt(s)}</div>
                </div>

                {armed === s.name ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--danger)" }}>
                      ทับข้อมูลปัจจุบันทั้งหมดด้วย “{s.name}”?
                    </span>
                    <button className="ga-btn ga-btn-danger" disabled={busy !== null}
                      onClick={() => call("restore", `/api/demo/snapshots/${encodeURIComponent(s.name)}`,
                        { method: "POST" })}>
                      {busy === "restore" ? "กำลังย้อน…" : "ยืนยันย้อนกลับ"}
                    </button>
                    <button className="ga-btn ga-btn-ghost" disabled={busy !== null}
                      onClick={() => setArmed(null)}>ยกเลิก</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="ga-btn ga-btn-grey" disabled={busy !== null}
                      onClick={() => { setArmed(s.name); setError(null); setNote(null); }}>
                      ย้อนกลับมาที่นี่
                    </button>
                    {!s.isBaseline && (
                      <button className="ga-btn ga-btn-ghost" disabled={busy !== null}
                        onClick={() => call("del", `/api/demo/snapshots/${encodeURIComponent(s.name)}`,
                          { method: "DELETE" })}>
                        ลบ
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5, color: "var(--danger)" }}>⛔ {error}</p>}
      {note && <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5, color: "var(--ink2)" }}>{note}</p>}

      <p style={{ marginTop: 12, marginBottom: 0, fontSize: 11.5, color: "var(--muted)" }}>
        ไฟล์จุดสำรองเก็บที่ <code>data/snapshots/</code> ซึ่งอยู่ใน <code>.gitignore</code> —
        ไม่ขึ้น repo · ไฟล์หลักฐานที่อัปโหลดไว้ <b>ไม่ถูกย้อนกลับด้วย</b>
        (แถวในฐานข้อมูลหายไป แต่ไฟล์ยังอยู่บนดิสก์ ซึ่งไม่กระทบหน้าจอ)
      </p>
    </div>
  );
}
