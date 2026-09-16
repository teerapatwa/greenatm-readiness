"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type OutboxMsg = {
  id: number;
  alertRule: string;
  itemCode: string;
  toDisplay: string;
  subject: string;
  body: string;
  sentBy: string | null;
  sentAt: string | null;
  editedBy: string | null;
  editedAt: string | null;
};

/**
 * ร่างข้อความหนึ่งฉบับ — อ่าน แก้ ทิ้ง หรือกดส่ง
 *
 * ทำไมต้องแก้ได้: หน้าจอเขียนว่า "ระบบร่าง คนกดส่งเอง" แต่เดิมคนทำได้แค่
 * กดส่งกับไม่กด — แก้ข้อความที่ร่างผิดไม่ได้ ทิ้งร่างที่ไม่ควรส่งก็ไม่ได้
 * นั่นไม่ใช่คนตัดสินใจ แต่เป็นคนกดปั๊มอนุมัติ ซึ่งเป็นสิ่งที่ทั้งระบบอ้างว่าไม่ทำ
 *
 * ร่างที่กดส่งไปแล้ว **แก้และลบไม่ได้** — เป็นบันทึกว่าส่งอะไรออกไป
 * (บังคับที่ API ด้วย ไม่ใช่แค่ซ่อนปุ่ม)
 */
export function OutboxCard({ m, toTitle, canDraft, canSend }: {
  m: OutboxMsg;
  toTitle: string;
  canDraft: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(m.subject);
  const [body, setBody] = useState(m.body);
  const [armDiscard, setArmDiscard] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const call = async (key: string, init: RequestInit) => {
    setBusy(key); setError(null); setNote(null);
    try {
      const res = await fetch(`/api/outbox/${m.id}`, {
        headers: { "content-type": "application/json" }, ...init,
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · ") || `HTTP ${res.status}`);
      setNote(b.note ?? null);
      setEditing(false); setArmDiscard(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const dirty = subject.trim() !== m.subject || body.trim() !== m.body;

  return (
    <div style={{
      background: "var(--card)",
      border: `1px solid ${m.sentAt ? "var(--ok-line)" : "var(--line)"}`,
      borderRadius: 10, padding: "14px 18px",
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
        <b style={{ fontSize: 13 }}>ถึง {toTitle}</b>
        <code style={{ fontSize: 11.5, color: "var(--muted2)" }}>{m.alertRule} · {m.itemCode}</code>
        {m.editedAt && (
          <span style={{ fontSize: 11.5, color: "var(--warn-ink)", fontWeight: 600 }}>
            ✎ คนแก้ข้อความแล้วโดย {m.editedBy}
          </span>
        )}
        {m.sentAt && (
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>
            ✓ กดส่งแล้วโดย {m.sentBy}
          </span>
        )}
      </div>

      {editing ? (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>
            หัวเรื่อง
            <input className="ga-input" style={{ width: "100%", marginTop: 2 }}
              value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>
            เนื้อความ
            <textarea className="ga-input" rows={6}
              style={{ width: "100%", marginTop: 2, fontFamily: "inherit", lineHeight: 1.7 }}
              value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ga-btn ga-btn-primary" disabled={busy !== null || !dirty}
              onClick={() => call("save", {
                method: "PATCH", body: JSON.stringify({ subject, body }),
              })}>
              {busy === "save" ? "กำลังบันทึก…" : "บันทึกข้อความที่แก้"}
            </button>
            <button className="ga-btn ga-btn-ghost" disabled={busy !== null}
              onClick={() => { setSubject(m.subject); setBody(m.body); setEditing(false); }}>
              ยกเลิกการแก้
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600 }}>{m.subject}</p>
          <pre style={{
            margin: "4px 0 0", whiteSpace: "pre-wrap", fontFamily: "inherit",
            fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.7,
          }}>{m.body}</pre>

          {!m.sentAt && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {canSend && (
                <button className="ga-btn ga-btn-primary" disabled={busy !== null}
                  onClick={() => call("send", { method: "POST" })}>
                  {busy === "send" ? "กำลังบันทึก…" : "ตรวจแล้ว — กดส่ง"}
                </button>
              )}
              {canDraft && (
                <button className="ga-btn ga-btn-grey" disabled={busy !== null}
                  onClick={() => setEditing(true)}>
                  แก้ข้อความ
                </button>
              )}
              {canDraft && (armDiscard ? (
                <>
                  <span style={{ fontSize: 12, color: "var(--danger)" }}>ทิ้งร่างนี้?</span>
                  <button className="ga-btn ga-btn-danger" disabled={busy !== null}
                    onClick={() => call("discard", { method: "DELETE", body: JSON.stringify({}) })}>
                    ยืนยันทิ้ง
                  </button>
                  <button className="ga-btn ga-btn-ghost" disabled={busy !== null}
                    onClick={() => setArmDiscard(false)}>ยกเลิก</button>
                </>
              ) : (
                <button className="ga-btn ga-btn-ghost" disabled={busy !== null}
                  onClick={() => setArmDiscard(true)}>
                  ทิ้งร่างนี้
                </button>
              ))}
            </div>
          )}

          {m.sentAt && (
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
              ร่างที่กดส่งแล้วแก้และลบไม่ได้ — เป็นบันทึกว่าส่งอะไรออกไป
            </p>
          )}
        </>
      )}

      {error && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--danger)" }}>⛔ {error}</p>}
      {note && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--accent)" }}>{note}</p>}
    </div>
  );
}
