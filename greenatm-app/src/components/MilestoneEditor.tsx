"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * แก้แผนงาน — เพิ่ม/แก้ชื่อ/แก้วัน/ลบขั้น และ **บันทึกการเลื่อนแผน**
 *
 * ⚠️ การเลื่อนวันสิ้นสุดให้ช้าลง ต้องผ่านปุ่ม "เลื่อนแผน" ที่บังคับกรอกเหตุผลเท่านั้น
 * เพราะเหตุผลคือสิ่งที่ทำให้การเลื่อนซ้ำ ๆ มีความหมาย — ครั้งที่ 3 ยกให้ผู้ดูแลตัดสิน
 */
type MS = {
  seq: number; name: string;
  plannedStart: string; plannedEnd: string; percentComplete: number;
};

export function MilestoneEditor({ code, milestones, escalateAfter, slipCount, today, canDeleteSlip }: {
  code: string;
  milestones: MS[];
  escalateAfter: number;
  slipCount: number;
  today: string;
  canDeleteSlip: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<"add" | number | null>(null);

  const call = async (url: string, init: RequestInit) => {
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · ") || `HTTP ${res.status}`);
      if (b.note) setNote(b.note);
      setOpen(null);
      startTransition(() => router.refresh());
      return b;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {milestones.map((m) => (
          <MilestoneRow
            key={m.seq} m={m} today={today} busy={busy}
            isOpen={open === m.seq}
            onToggle={() => setOpen(open === m.seq ? null : m.seq)}
            onSave={(patch) => call(`/api/items/${code}/milestones/${m.seq}`, {
              method: "PATCH", body: JSON.stringify(patch),
            })}
            onSlip={(toDate, reason) => call(`/api/items/${code}/slips`, {
              method: "POST", body: JSON.stringify({ milestoneSeq: m.seq, toDate, reason }),
            })}
            onDelete={() => call(`/api/items/${code}/milestones/${m.seq}`, { method: "DELETE" })}
          />
        ))}
      </div>

      {open === "add" ? (
        <AddRow
          busy={busy}
          onCancel={() => setOpen(null)}
          onAdd={(a) => call(`/api/items/${code}/milestones`, {
            method: "POST", body: JSON.stringify(a),
          })}
        />
      ) : (
        <button className="ga-btn ga-btn-grey" style={{ marginTop: 10 }} disabled={busy}
          onClick={() => setOpen("add")}>
          + เพิ่มขั้นในแผนงาน
        </button>
      )}

      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8, marginBottom: 0 }}>
        เพิ่มหรือลบขั้นแล้ว <b>น้ำหนักทุกขั้นถูกเกลี่ยให้เท่ากันใหม่</b> — ความคืบหน้ารวมจึงเปลี่ยนตาม ·
        ลบได้เฉพาะขั้นที่ยัง 0%
      </p>

      {slipCount > 0 && (
        <p style={{
          fontSize: 12, marginTop: 8, marginBottom: 0,
          color: slipCount >= escalateAfter ? "var(--danger)" : "var(--warn-ink)",
          fontWeight: 600,
        }}>
          {slipCount >= escalateAfter
            ? `⛔ เลื่อนแผนครบ ${slipCount} ครั้ง — ยกให้ผู้ดูแลตัดสินแล้ว`
            : `เลื่อนแผนมา ${slipCount} ครั้ง · ครั้งที่ ${escalateAfter} จะยกให้ผู้ดูแล`}
          {canDeleteSlip && " · ลบประวัติที่บันทึกผิดได้ที่การ์ดประวัติการเลื่อนแผน"}
        </p>
      )}

      {error && <p style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 8 }}>⛔ {error}</p>}
      {note && <p style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 8 }}>{note}</p>}
    </div>
  );
}

function MilestoneRow({ m, today, busy, isOpen, onToggle, onSave, onSlip, onDelete }: {
  m: MS; today: string; busy: boolean; isOpen: boolean;
  onToggle: () => void;
  onSave: (p: { name?: string; plannedStart?: string; plannedEnd?: string }) => void;
  onSlip: (toDate: string, reason: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(m.name);
  const [start, setStart] = useState(m.plannedStart);
  const [slipTo, setSlipTo] = useState("");
  const [reason, setReason] = useState("");
  const late = m.plannedEnd < today && m.percentComplete < 100;

  return (
    <div style={{
      border: `1px solid ${late ? "var(--danger-line)" : "var(--line)"}`,
      background: late ? "var(--danger-bg)" : "var(--fill2)",
      borderRadius: 8, padding: "9px 12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12.5 }}>
          <b>{m.seq}.</b> {m.name}
          <span style={{ color: "var(--muted2)" }}> · {m.percentComplete}% · แผนจบ {m.plannedEnd}</span>
          {late && <b style={{ color: "var(--danger)" }}> ⛔ เลยกำหนด</b>}
        </span>
        <button className="ga-btn ga-btn-ghost" style={{ padding: "4px 10px", flex: "none" }}
          onClick={onToggle} disabled={busy}>
          {isOpen ? "ปิด" : "แก้"}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
            <label style={{ fontSize: 12, flex: "1 1 200px" }}>
              <span style={{ display: "block", color: "var(--muted)" }}>ชื่อขั้น</span>
              <input className="ga-input" style={{ width: "100%" }} value={name}
                onChange={(e) => setName(e.target.value)} />
            </label>
            <label style={{ fontSize: 12 }}>
              <span style={{ display: "block", color: "var(--muted)" }}>วันเริ่มตามแผน</span>
              <input className="ga-input" type="date" value={start}
                onChange={(e) => setStart(e.target.value)} />
            </label>
            <button className="ga-btn ga-btn-primary" disabled={busy}
              onClick={() => onSave({ name, plannedStart: start })}>
              บันทึก
            </button>
            {m.percentComplete === 0 && (
              <button className="ga-btn ga-btn-danger" disabled={busy} onClick={onDelete}>
                ลบขั้นนี้
              </button>
            )}
          </div>

          <div style={{
            borderTop: "1px dashed var(--line)", paddingTop: 10,
            display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end",
          }}>
            <label style={{ fontSize: 12 }}>
              <span style={{ display: "block", color: "var(--muted)" }}>
                เลื่อนวันจบเป็น (ต้องช้ากว่า {m.plannedEnd})
              </span>
              <input className="ga-input" type="date" value={slipTo} min={m.plannedEnd}
                onChange={(e) => setSlipTo(e.target.value)} />
            </label>
            <label style={{ fontSize: 12, flex: "1 1 240px" }}>
              <span style={{ display: "block", color: "var(--muted)" }}>เหตุผล (บังคับ)</span>
              <input className="ga-input" style={{ width: "100%" }} value={reason}
                placeholder="เช่น รอผลจัดซื้อจากหน่วยงานกลาง"
                onChange={(e) => setReason(e.target.value)} />
            </label>
            <button className="ga-btn ga-btn-grey" disabled={busy || !slipTo || reason.trim().length < 5}
              onClick={() => onSlip(slipTo, reason)}>
              บันทึกการเลื่อนแผน
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
            การเลื่อนวันให้ช้าลง <b>ต้องมาทางนี้พร้อมเหตุผล</b> — ระบบนับจำนวนครั้งไว้
            และเลื่อนแล้วสัญญาณ “เลยกำหนด” จะหายไปจริง แต่ประวัติการเลื่อนไม่หาย
          </p>
        </div>
      )}
    </div>
  );
}

function AddRow({ busy, onAdd, onCancel }: {
  busy: boolean;
  onAdd: (a: { name: string; plannedStart: string; plannedEnd: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <div style={{
      marginTop: 10, border: "1px solid var(--ok-line)", background: "var(--ok-bg)",
      borderRadius: 8, padding: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end",
    }}>
      <label style={{ fontSize: 12, flex: "1 1 200px" }}>
        <span style={{ display: "block", color: "var(--muted)" }}>ชื่อขั้นใหม่</span>
        <input className="ga-input" style={{ width: "100%" }} value={name}
          placeholder="เช่น ตรวจรับและทดสอบระบบ" onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={{ fontSize: 12 }}>
        <span style={{ display: "block", color: "var(--muted)" }}>วันเริ่ม</span>
        <input className="ga-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label style={{ fontSize: 12 }}>
        <span style={{ display: "block", color: "var(--muted)" }}>วันจบ</span>
        <input className="ga-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <button className="ga-btn ga-btn-primary"
        disabled={busy || name.trim().length < 3 || !start || !end}
        onClick={() => onAdd({ name, plannedStart: start, plannedEnd: end })}>
        เพิ่ม
      </button>
      <button className="ga-btn ga-btn-ghost" disabled={busy} onClick={onCancel}>ยกเลิก</button>
    </div>
  );
}

/** ลบประวัติการเลื่อนแผนที่บันทึกผิด — ทีมกลางเท่านั้น */
export function SlipRow({ code, slip, index, total, escalateAfter, canDelete }: {
  code: string;
  slip: { id: number; from: string; to: string; reason: string; by: string };
  index: number;
  total: number;
  escalateAfter: number;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ fontSize: 13, marginBottom: 6 }}>
      <b>ครั้งที่ {index + 1}</b> · {slip.from} → {slip.to}
      <span style={{ color: "var(--ink2)" }}> — {slip.reason}</span>
      <span style={{ color: "var(--muted2)", fontSize: 11.5 }}> (โดย {slip.by})</span>
      {index + 1 === total && total >= escalateAfter && (
        <b style={{ color: "var(--danger)" }}> ← ครั้งนี้ยกให้ผู้ดูแล</b>
      )}
      {canDelete && (
        <button className="ga-btn ga-btn-ghost" style={{ padding: "2px 8px", marginLeft: 8, fontSize: 11.5 }}
          disabled={busy}
          onClick={async () => {
            setBusy(true); setError(null);
            try {
              const res = await fetch(`/api/items/${code}/slips/${slip.id}`, { method: "DELETE" });
              const b = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
              startTransition(() => router.refresh());
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}>
          ลบ
        </button>
      )}
      {error && <div style={{ color: "var(--danger)", fontSize: 11.5 }}>⛔ {error}</div>}
    </div>
  );
}
