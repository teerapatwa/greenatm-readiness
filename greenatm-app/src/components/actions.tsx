"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ส่วนที่โต้ตอบได้ — ทุกตัวยิงไป API แล้ว refresh
 *
 * ⚠️ กฎที่ถือไว้ทั้งไฟล์: **ไม่มี component ไหนเปลี่ยนค่าจริงได้เอง**
 * ProgressForm ร่างการ์ด · ConfirmCard คือปุ่มที่คนกด — การเขียนเกิดที่นั้น (AC-17 · AC-18)
 */

async function send(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error([body.error, body.detail].filter(Boolean).join(" · ") || `HTTP ${res.status}`);
  return body;
}

function useAction() {
  const router = useRouter();
  const [pendingTransition, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ message?: string; note?: string } | void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await fn();
      if (r && (r.message || r.note)) setNote(r.message ?? r.note ?? null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { run, busy: busy || pendingTransition, error, note };
}

// ปุ่มและช่องกรอกทั้งไฟล์ใช้คลาสจาก globals.css ที่ยึดค่าตามไฟล์ทีม
const primary = "ga-btn ga-btn-primary";
const ghost = "ga-btn ga-btn-ghost";
const grey = "ga-btn ga-btn-grey";
const soft = "ga-btn ga-btn-soft";
const field = "ga-input";

function Msg({ error, note }: { error: string | null; note: string | null }) {
  if (error) return <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--danger)" }}>⛔ {error}</p>;
  if (note) return <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink2)" }}>{note}</p>;
  return null;
}

// ── สลับผู้ใช้ ──────────────────────────────────────────────────────────────

export function UserSwitcher({ users, currentId }: {
  users: { id: string; title: string; role: string; divisionId: string | null }[];
  currentId: string;
}) {
  const { run, busy } = useAction();
  const groups: [string, string][] = [
    ["owner", "เจ้าของข้อมูล (แต่ละกอง)"],
    ["central", "ผู้ดูแล"],
    ["executive", "ผู้บริหาร"],
  ];
  return (
    <select
      aria-label="สลับผู้ใช้"
      className="ga-select"
      style={{ maxWidth: 320 }}
      value={currentId}
      disabled={busy}
      onChange={(e) =>
        run(() => send("/api/session", { body: JSON.stringify({ userId: e.target.value }) }))
      }
    >
      {groups.map(([role, label]) => (
        <optgroup key={role} label={label}>
          {users.filter((u) => u.role === role).map((u) => (
            <option key={u.id} value={u.id}>{u.title}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── ร่างความคืบหน้า → การ์ดยืนยัน ────────────────────────────────────────────

export function ProgressForm({ itemCode, milestones, percentWithinNextLevel, frontierLevel }: {
  itemCode: string;
  milestones: { seq: number; name: string; percentComplete: number }[];
  percentWithinNextLevel: number;
  frontierLevel: number;
}) {
  const { run, busy, error, note } = useAction();
  const [field, setField] = useState<"milestone_percent" | "percent_within_next_level">(
    milestones.length > 0 ? "milestone_percent" : "percent_within_next_level",
  );
  const [seq, setSeq] = useState(milestones[0]?.seq ?? 1);
  const [percent, setPercent] = useState(
    milestones[0]?.percentComplete ?? percentWithinNextLevel,
  );
  const [date, setDate] = useState("");

  /** ค่าปัจจุบันของสิ่งที่กำลังแก้อยู่ — ใช้เทียบให้เห็นว่าเลื่อนไปเท่าไร */
  const current = field === "milestone_percent"
    ? (milestones.find((m) => m.seq === seq)?.percentComplete ?? 0)
    : percentWithinNextLevel;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12.5 }}>
          <span style={{ display: "block", color: "var(--muted)" }}>สิ่งที่จะอัปเดต</span>
          <select
            className={field}
            value={field}
            onChange={(e) => {
              const f = e.target.value as typeof field;
              setField(f);
              setPercent(f === "milestone_percent"
                ? milestones.find((m) => m.seq === seq)?.percentComplete ?? 0
                : percentWithinNextLevel);
            }}
          >
            {milestones.length > 0 && <option value="milestone_percent">ความคืบหน้าของ milestone</option>}
            <option value="percent_within_next_level">ความคืบหน้าไปสู่ระดับ {frontierLevel}</option>
          </select>
        </label>

        {field === "milestone_percent" && (
          <label style={{ fontSize: 12.5 }}>
            <span style={{ display: "block", color: "var(--muted)" }}>ขั้นที่</span>
            <select
              className={field} style={{ maxWidth: 210 }}
              value={seq}
              onChange={(e) => {
                const s = Number(e.target.value);
                setSeq(s);
                setPercent(milestones.find((m) => m.seq === s)?.percentComplete ?? 0);
              }}
            >
              {milestones.map((m) => (
                <option key={m.seq} value={m.seq}>{m.seq} · {m.name} ({m.percentComplete}%)</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ fontSize: 12.5 }}>
          <span style={{ display: "block", color: "var(--muted)" }}>วันที่เสร็จจริง (ถ้ามี)</span>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        </label>
      </div>

      {/*
        แถบเลื่อน 0–100% — ลากง่ายกว่าพิมพ์ตอนสาธิต และเห็นระยะที่ขยับจากค่าเดิมชัด
        step 5 เพราะความคืบหน้าของแผนงานไม่ได้ละเอียดระดับ 1% และลากให้ตรงเลขกลม ๆ ง่ายกว่า
      */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          fontSize: 12.5, marginBottom: 4,
        }}>
          <span style={{ color: "var(--muted)" }}>ความคืบหน้า</span>
          <span className="tnum">
            <span style={{ color: "var(--muted2)" }}>เดิม {current}%</span>
            {percent !== current && (
              <>
                {" → "}
                <b style={{
                  fontSize: 17,
                  color: percent > current ? "var(--accent)" : "var(--danger)",
                }}>
                  {percent}%
                </b>
                <span style={{
                  fontSize: 11.5, marginLeft: 4,
                  color: percent > current ? "var(--accent)" : "var(--danger)",
                }}>
                  ({percent > current ? "+" : ""}{percent - current})
                </span>
              </>
            )}
            {percent === current && (
              <span style={{ marginLeft: 6, fontSize: 11.5, color: "var(--muted2)" }}>
                — ยังไม่ได้เลื่อน
              </span>
            )}
          </span>
        </div>

        <input
          className="ga-range"
          type="range" min={0} max={100} step={5}
          value={percent}
          disabled={busy}
          aria-label={`ความคืบหน้า เดิม ${current} เปอร์เซ็นต์ ตอนนี้เลือก ${percent} เปอร์เซ็นต์`}
          onChange={(e) => setPercent(Number(e.target.value))}
        />

        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 10.5, color: "var(--muted2)", marginTop: -2,
        }} className="tnum" aria-hidden>
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
          {[0, 25, 50, 75, 100].map((n) => (
            <button key={n} className="ga-btn ga-btn-grey" style={{ padding: "4px 10px" }}
              disabled={busy} onClick={() => setPercent(n)}>
              {n}%
            </button>
          ))}
          {percent !== current && (
            <button className="ga-btn ga-btn-ghost" style={{ padding: "4px 10px" }}
              disabled={busy} onClick={() => setPercent(current)}>
              กลับค่าเดิม
            </button>
          )}
          <button
            className={primary} style={{ marginLeft: "auto" }}
            disabled={busy || percent === current}
            onClick={() => run(() => send(`/api/items/${itemCode}/progress`, {
              body: JSON.stringify({
                field, milestoneSeq: seq, percent, actualDate: date || null,
              }),
            }))}
          >
            {busy ? "กำลังร่าง…" : "ตรวจก่อนบันทึก →"}
          </button>
        </div>
      </div>
      <p style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
        เลื่อนแถบแล้วกด “ตรวจก่อนบันทึก” — <b>ค่าจริงยังไม่เปลี่ยน</b>
        ระบบจะขึ้นการ์ดให้ตรวจก่อนยืนยันอีกครั้ง
      </p>
      <Msg error={error} note={note} />
    </div>
  );
}

/** การ์ดยืนยัน — จุดเดียวที่ค่าจริงเปลี่ยน และเปลี่ยนเพราะคนกด */
export function ConfirmCard({ pending }: {
  pending: {
    id: number; itemCode: string; milestoneSeq: number | null; field: string;
    oldValue: string; newValue: string; actualDate: string | null; draftedBy: string;
  };
}) {
  const { run, busy, error } = useAction();
  const what = pending.field === "milestone_percent"
    ? `milestone ขั้นที่ ${pending.milestoneSeq}`
    : "ความคืบหน้าไปสู่ระดับถัดไป";
  return (
    <div style={{ border: "2px solid var(--teal)", borderRadius: 10, padding: 14 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>
        รอคุณยืนยัน · ค่าจริงยังไม่เปลี่ยน
      </p>
      <p style={{ marginTop: 6, fontSize: 15 }}>
        <code style={{ fontWeight: 700 }}>{pending.itemCode}</code> · {what}{" "}
        <span style={{ color: "var(--muted)" }}>{pending.oldValue}%</span>
        {" → "}
        <b>{pending.newValue}%</b>
        {pending.actualDate ? <span style={{ color: "var(--ink2)" }}> · วันที่เสร็จ {pending.actualDate}</span> : null}
      </p>
      <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
        ร่างโดย: {pending.draftedBy === "ai" ? "agent ผู้ช่วย (เสนอ ไม่ได้เขียน)" : pending.draftedBy}
      </p>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button className={primary} disabled={busy}
          onClick={() => run(() => send(`/api/pending/${pending.id}`))}>
          {busy ? "กำลังบันทึก…" : "ยืนยัน — บันทึกค่านี้"}
        </button>
        <button className={ghost} disabled={busy}
          onClick={() => run(async () => {
            const res = await fetch(`/api/pending/${pending.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error((await res.json()).error ?? "ยกเลิกไม่สำเร็จ");
          })}>
          ยกเลิก
        </button>
      </div>
      <Msg error={error} note={null} />
    </div>
  );
}

// ── หลักฐาน ─────────────────────────────────────────────────────────────────

type ProposeResult = {
  ok: boolean;
  proposedTier: string | null;
  proposedReason: string | null;
  latencyMs: number;
  retried: boolean;
  error: string | null;
  read: {
    ok: boolean; pages: number | null; totalChars: number;
    sentChars: number; truncated: boolean; reason: string | null;
  };
  note: string;
};

/**
 * ผลของ agent ที่อ่านเอกสารแล้วเสนอชั้น
 *
 * ต้องบอกสามอย่างเสมอ ไม่ว่าผลจะออกมาอย่างไร:
 *   1. อ่านเนื้อไฟล์ได้จริงหรือไม่ · ได้กี่ตัวอักษรจากทั้งหมดเท่าไร
 *   2. นี่เป็น **ข้อเสนอ** ไม่ใช่การยืนยัน — ค่า Verified ยังไม่ขยับ
 *   3. ถ้าล้ม ล้มเพราะอะไร · **ไม่มีการเดาชั้นใส่ไว้แทน**
 */
export function ProposeResultPanel({ r }: { r: ProposeResult }) {
  const tone = r.ok ? "var(--ok-bg)" : "var(--warn-bg)";
  const line = r.ok ? "var(--ok-line)" : "var(--warn-line)";
  return (
    <div style={{
      marginTop: 8, background: tone, border: `1px solid ${line}`,
      borderRadius: 8, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 700, color: r.ok ? "var(--accent)" : "var(--warn-ink)" }}>
        {r.ok ? `agent เสนอชั้น ${r.proposedTier}` : "agent เสนอชั้นไม่สำเร็จ"}
        <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {(r.latencyMs / 1000).toFixed(1)} วินาที</span>
      </div>

      {r.ok && r.proposedReason && (
        <div style={{ marginTop: 4, color: "#3d4a43" }}>เหตุผล: {r.proposedReason}</div>
      )}
      {!r.ok && (
        <div style={{ marginTop: 4, color: "var(--warn-ink)" }}>
          {r.error} — <b>ทีมกลางจัดชั้นเอง</b> ระบบไม่เดาชั้นใส่ไว้แทน
        </div>
      )}

      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
        {r.read.ok
          ? <>อ่านเนื้อไฟล์แล้ว {r.read.pages} หน้า · ส่งให้โมเดล {r.read.sentChars.toLocaleString()} จาก{" "}
              {r.read.totalChars.toLocaleString()} ตัวอักษร
              {r.read.truncated && <b style={{ color: "var(--warn-ink)" }}> (ตัดความยาว — ไม่ได้อ่านทั้งฉบับ)</b>}</>
          : <b style={{ color: "var(--warn-ink)" }}>ไม่ได้อ่านเนื้อไฟล์: {r.read.reason}</b>}
        {r.retried && " · ต้องถามซ้ำหนึ่งครั้งเพราะรอบแรกตอบไม่เป็น JSON"}
      </div>

      {r.ok && (
        <div style={{ marginTop: 6, color: "var(--ink2)" }}>
          ⓘ นี่คือ<b>ข้อเสนอ</b> ยังไม่ใช่การยืนยัน — ค่า Verified ไม่ขยับจนกว่าทีมกลางจะกดยืนยัน
        </div>
      )}
    </div>
  );
}

/** ปุ่มเรียก agent ให้เสนอชั้น — ใช้กับหลักฐานที่ยังไม่มีข้อเสนอ */
export function ProposeTierButton({ evidenceId, hasProposal }: {
  evidenceId: string; hasProposal: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ProposeResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/propose-tier`, { method: "POST" });
      const b = await res.json();
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
      setR(b);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 6 }}>
      <button className={ghost} disabled={busy} onClick={go}>
        {busy ? "agent กำลังอ่านเอกสาร…" : hasProposal ? "ให้ agent เสนอชั้นใหม่" : "ให้ agent เสนอชั้น"}
      </button>
      {err && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--danger)" }}>⛔ {err}</p>}
      {r && <ProposeResultPanel r={r} />}
    </div>
  );
}

export function EvidenceForm({ itemCode }: { itemCode: string }) {
  const { run, busy, error, note } = useAction();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [noDate, setNoDate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<ProposeResult | null>(null);

  const submit = () =>
    run(async () => {
      // ส่งเป็น multipart เมื่อมีไฟล์ · ถ้าไม่มีไฟล์ก็ยังแนบชื่อเรื่องได้เหมือนเดิม
      const fd = new FormData();
      fd.set("itemCode", itemCode);
      fd.set("title", title);
      fd.set("documentDate", noDate ? "" : date);
      if (file) fd.set("file", file);
      const res = await fetch("/api/evidence", { method: "POST", body: fd });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
      setTitle(""); setDate(""); setFile(null); setNoDate(false);

      /*
        แนบเสร็จแล้วค่อยให้ agent อ่าน — แยกคนละคำขอโดยตั้งใจ
        การแนบหลักฐานต้องสำเร็จทันทีและต้องไม่พังเพราะโมเดลล่ม
      */
      setProposal(null);
      setProposing(true);
      try {
        const pr = await fetch(`/api/evidence/${b.id}/propose-tier`, { method: "POST" });
        const pb = await pr.json();
        if (pr.ok) setProposal(pb);
      } catch { /* ข้อเสนอเป็นของแถม ไม่ใช่เงื่อนไขของการแนบ */ }
      setProposing(false);
      return b;
    });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12.5, flex: "1 1 220px" }}>
          <span style={{ display: "block", color: "var(--muted)" }}>ไฟล์เอกสาร</span>
          <input
            className={field} type="file" style={{ width: "100%", padding: "5px 8px" }}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title.trim()) setTitle(f.name);
            }}
          />
        </label>
        <label style={{ fontSize: 12.5, flex: "1 1 220px" }}>
          <span style={{ display: "block", color: "var(--muted)" }}>ชื่อเอกสาร</span>
          <input className={field} style={{ width: "100%" }} value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น รายงานผลการตรวจวัด ลงนามแล้ว" />
        </label>
        <label style={{ fontSize: 12.5 }}>
          <span style={{ display: "block", color: "var(--muted)" }}>วันที่ในตัวเอกสาร</span>
          <input className={field} type="date" value={date} disabled={noDate}
            onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className={primary} disabled={busy || (!title.trim() && !file)} onClick={submit}>
          {busy ? "กำลังแนบ…" : "แนบหลักฐาน"}
        </button>
      </div>

      {proposing && (
        <p style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 8 }}>
          agent กำลังอ่านเนื้อเอกสารเพื่อเสนอชั้น… (อาจใช้เวลาหลายวินาที)
        </p>
      )}
      {proposal && <ProposeResultPanel r={proposal} />}

      {file && (
        <p style={{ fontSize: 12, color: "var(--ink2)", marginTop: 6 }}>
          เลือกไว้: <b>{file.name}</b> · {(file.size / 1048576).toFixed(2)} MB
          {file.size > 10 * 1048576 && (
            <b style={{ color: "var(--danger)" }}> — เกินเพดาน 10 MB ระบบจะปฏิเสธ</b>
          )}
        </p>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5,
        color: "var(--ink2)", marginTop: 8 }}>
        <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} />
        เอกสารนี้ไม่มีวันที่อยู่ในตัวเอกสารจริง ๆ
      </label>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 0 }}>
        รับ PDF · Word · รูปภาพ ไม่เกิน 10 MB · <b>ไม่ทำ OCR</b> ·
        ไม่ใส่วันที่ก็แนบได้ — ระบบจะ<b>ถาม</b>ภายหลัง และ<b>ไม่เอาวันอัปโหลดหรือวันแก้ไขไฟล์มาใช้แทน</b>
      </p>
      <Msg error={error} note={note} />
    </div>
  );
}

export function EvidenceDateForm({ evidenceId }: { evidenceId: string }) {
  const { run, busy, error } = useAction();
  const [date, setDate] = useState("");
  return (
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <input
        type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className={field}
      />
      <button className={ghost} disabled={busy || !date}
        onClick={() => run(async () => {
          const res = await fetch(`/api/evidence/${evidenceId}`, {
            method: "PATCH", headers: { "content-type": "application/json" },
            body: JSON.stringify({ documentDate: date }),
          });
          const b = await res.json();
          if (!res.ok) throw new Error(b.error ?? "บันทึกไม่สำเร็จ");
          return b;
        })}>
        บันทึกวันที่ในเอกสาร
      </button>
      <Msg error={error} note={null} />
    </div>
  );
}

/**
 * ยืนยัน / แก้ / เพิกถอนชั้นหลักฐาน — ทีมกลางเท่านั้น ค่า Verified ขยับจากจุดนี้
 *
 * เคยพลาดสามอย่างตรงนี้ และแก้แล้วทั้งหมด:
 *  1. ช่องเลือกตั้งต้นที่ `proposedTier ?? "C"` → พอ agent ไม่ได้เสนอ มันโชว์ "ชั้น C"
 *     ทั้งที่ยังไม่มีใครเสนออะไรเลย · และพอยืนยันไปแล้วก็ยังเด้งกลับไปโชว์ข้อเสนอเดิม
 *     ไม่ใช่ค่าที่ใช้อยู่จริง — **ค่าเริ่มต้นเพื่อความสะดวก กลายเป็นการแสดงค่าที่ไม่มีอยู่จริง**
 *  2. ปุ่มเขียน "ยืนยันชั้นนี้" ตลอด แม้ยืนยันไปแล้ว → อ่านแล้วเหมือนกดไม่ติด คนเลยกดซ้ำ
 *     และกดซ้ำได้ไม่จำกัด ได้แถว audit เพิ่มทุกครั้งโดยไม่มีอะไรเปลี่ยน
 *  3. API เพิกถอนชั้นได้ตั้งแต่แรก แต่ไม่มีปุ่มบนหน้าจอ — ของที่มีจริงแต่คนใช้ไม่ถึง
 */
export function TierActions({ evidenceId, proposedTier, confirmedTier, confirmedBy }: {
  evidenceId: string;
  proposedTier: string | null;
  confirmedTier?: string | null;
  confirmedBy?: string | null;
}) {
  const { run, busy, error, note } = useAction();

  /* ค่าที่ใช้อยู่จริง: ที่ยืนยันแล้วมาก่อนข้อเสนอของ agent เสมอ */
  const current = confirmedTier ?? null;
  const [tier, setTier] = useState(current ?? proposedTier ?? "");
  const [reason, setReason] = useState("");
  const [armRevoke, setArmRevoke] = useState(false);

  const unchanged = tier === (current ?? "") || (current === null && tier === proposedTier && !tier);
  /* ต้องให้เหตุผลเมื่อ "ทับคำตัดสินที่มีอยู่แล้ว" ไม่ว่าคำตัดสินนั้นจะมาจาก agent หรือจากคน */
  const overridingAgent = current === null && proposedTier !== null && tier !== proposedTier;
  const overridingHuman = current !== null && tier !== current;
  const needsReason = overridingAgent || overridingHuman;

  const label = !tier
    ? "เลือกชั้นก่อน"
    : current === null
      ? (overridingAgent ? `ยืนยันเป็นชั้น ${tier} พร้อมเหตุผล` : `ยืนยันชั้น ${tier}`)
      : tier === current ? `ยืนยันเป็นชั้น ${current} แล้ว` : `แก้เป็นชั้น ${tier}`;

  const patch = () => run(async () => {
    const res = await fetch(`/api/evidence/${evidenceId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier, reason: reason || undefined }),
    });
    const b = await res.json();
    if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
    /*
      บอกตัวเลขที่ขยับจริง ไม่ใช่แค่ "นับเข้าแล้ว"
      และย้ำว่า Level ไม่ขยับ เพราะเป็นคำถามแรกที่คนถามหลังกดปุ่มนี้
    */
    if (!b.countsTowardVerified) {
      return { note: `ยืนยันชั้น ${b.confirmedTier} — ชั้นนี้ไม่นับเข้าค่า Verified (นับเฉพาะ A และ B)` };
    }
    const moved = b.verifiedAfter !== b.verifiedBefore
      ? `ค่า Verified ของ ${b.itemCode} ขยับ ${b.verifiedBefore}% → ${b.verifiedAfter}%`
      : `ค่า Verified ของ ${b.itemCode} ยังเป็น ${b.verifiedAfter}% เท่าเดิม`;
    return {
      note: `ยืนยันชั้น ${b.confirmedTier} แล้ว · ${moved} · `
        + `ระดับที่ได้ยังเป็น ${b.achievedLevel} เท่าเดิม — `
        + `การขึ้นระดับเป็นการตัดสินใจอีกครั้งที่หน้ารายละเอียด`,
    };
  });

  const revoke = () => run(async () => {
    const res = await fetch(`/api/evidence/${evidenceId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier: null, reason: reason || undefined }),
    });
    const b = await res.json();
    if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
    setArmRevoke(false);
    setTier(proposedTier ?? "");
    return {
      note: `เพิกถอนการยืนยันแล้ว · ค่า Verified ของ ${b.itemCode} `
        + `${b.verifiedBefore}% → ${b.verifiedAfter}% · กลับเข้าคิวรอยืนยันใหม่`,
    };
  });

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <select className={field} value={tier} onChange={(e) => setTier(e.target.value)}>
          {/* ไม่มีค่าที่ใช้อยู่ ก็ต้องไม่แกล้งมีค่า — ตัวเลือกว่างบอกตามจริง */}
          {!current && !proposedTier && <option value="">— agent ไม่ได้เสนอ เลือกเอง —</option>}
          {["A", "B", "C", "D"].map((t) => (
            <option key={t} value={t}>
              ชั้น {t}
              {t === current ? " · ใช้อยู่" : t === proposedTier && !current ? " · agent เสนอ" : ""}
            </option>
          ))}
        </select>

        {needsReason && (
          <input
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={overridingHuman
              ? `เหตุผลที่แก้จากชั้น ${current} ที่ยืนยันไปแล้ว (บังคับ)`
              : "เหตุผลที่แก้จากที่ agent เสนอ (บังคับ)"}
            className={field} style={{ minWidth: 260, flexGrow: 1, borderColor: "var(--warn)" }}
          />
        )}

        <button className={primary} disabled={busy || !tier || unchanged} onClick={patch}>
          {label}
        </button>

        {current !== null && (armRevoke ? (
          <>
            <span style={{ fontSize: 12, color: "var(--danger)" }}>
              ถอนการยืนยันชั้น {current}? ค่า Verified จะลดลง
            </span>
            <button className="ga-btn ga-btn-danger" disabled={busy} onClick={revoke}>
              ยืนยันการเพิกถอน
            </button>
            <button className={ghost} disabled={busy} onClick={() => setArmRevoke(false)}>ยกเลิก</button>
          </>
        ) : (
          <button className={ghost} disabled={busy} onClick={() => setArmRevoke(true)}>
            เพิกถอนการยืนยัน
          </button>
        ))}
      </div>

      {current !== null && (
        <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
          ใช้อยู่: ชั้น {current}{confirmedBy ? ` · ยืนยันโดย ${confirmedBy}` : ""}
          {unchanged && " — เลือกชั้นอื่นถึงจะแก้ได้"}
        </p>
      )}
      {overridingAgent && (
        <p style={{ marginTop: 4, fontSize: 12, color: "var(--warn-ink)" }}>
          กำลังแก้จากชั้น {proposedTier} ที่ agent เสนอ → ต้องระบุเหตุผล ระบบบันทึกทั้งค่าเดิมและค่าใหม่
        </p>
      )}
      {overridingHuman && (
        <p style={{ marginTop: 4, fontSize: 12, color: "var(--warn-ink)" }}>
          กำลังทับคำตัดสินของคน (ชั้น {current}) → ต้องระบุเหตุผล
        </p>
      )}
      <Msg error={error} note={note} />
    </div>
  );
}

// ── Outbox ──────────────────────────────────────────────────────────────────

export function DraftAlertButton({ alert }: {
  alert: { rule: string; itemCode: string; head: string; body: string; verb: string; toOwner: string | null };
}) {
  const { run, busy, error, note } = useAction();
  return (
    <span>
      <button className={ghost} disabled={busy}
        onClick={() => run(() => send("/api/outbox", {
          body: JSON.stringify({
            alertRule: alert.rule, itemCode: alert.itemCode,
            subject: alert.head,
            body: `${alert.body}\n\nกรุณาดำเนินการ — ข้อความนี้ร่างโดยระบบ และถูกส่งโดยผู้ดูแลที่กดส่งเอง`,
          }),
        }))}>
        {busy ? "กำลังร่าง…" : "ร่างข้อความ"}
      </button>
      <Msg error={error} note={note} />
    </span>
  );
}

export function SendButton({ id }: { id: number }) {
  const { run, busy, error, note } = useAction();
  return (
    <span>
      <button className={primary} disabled={busy}
        onClick={() => run(() => send(`/api/outbox/${id}`))}>
        {busy ? "กำลังบันทึก…" : "ตรวจแล้ว — กดส่ง"}
      </button>
      <Msg error={error} note={note} />
    </span>
  );
}

// ── เกณฑ์ระบบ / เป้าระดับ ───────────────────────────────────────────────────

export function SettingField({ settingKey, label, value, suffix }: {
  settingKey: string; label: string; value: number; suffix?: string;
}) {
  const { run, busy, error, note } = useAction();
  const [v, setV] = useState(value);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <span style={{ minWidth: 230, fontSize: 13 }}>{label}</span>
      <input
        type="number" value={v} onChange={(e) => setV(Number(e.target.value))}
        className={field} style={{ width: 80 }}
      />
      {suffix && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{suffix}</span>}
      <button className={ghost} disabled={busy || v === value}
        onClick={() => run(() => send("/api/settings", {
          method: "PATCH", body: JSON.stringify({ key: settingKey, value: v }),
        }).then(() => ({ note: "บันทึกแล้ว — ผลมีทันที ไม่ต้องรีสตาร์ต" })))}>
        บันทึก
      </button>
      <Msg error={error} note={note} />
    </div>
  );
}
