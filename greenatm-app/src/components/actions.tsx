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

const btn = "rounded-md px-3 py-1.5 text-[13px] font-medium disabled:opacity-50";
const primary = `${btn} bg-[var(--accent)] text-white`;
const ghost = `${btn} border border-[var(--line)]`;

function Msg({ error, note }: { error: string | null; note: string | null }) {
  if (error) return <p className="mt-2 text-[12.5px]" style={{ color: "var(--late)" }}>⛔ {error}</p>;
  if (note) return <p className="mt-2 text-[12.5px] text-[var(--ink2)]">{note}</p>;
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
      className="max-w-[320px] rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[13px]"
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

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12.5px]">
          <span className="block text-[var(--muted)]">สิ่งที่จะอัปเดต</span>
          <select
            className="mt-1 rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1.5"
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
          <label className="text-[12.5px]">
            <span className="block text-[var(--muted)]">ขั้นที่</span>
            <select
              className="mt-1 max-w-[210px] rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1.5"
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

        <label className="text-[12.5px]">
          <span className="block text-[var(--muted)]">เปอร์เซ็นต์</span>
          <input
            type="number" min={0} max={100} value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="mt-1 w-[86px] rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1.5"
          />
        </label>

        <label className="text-[12.5px]">
          <span className="block text-[var(--muted)]">วันที่เสร็จจริง (ถ้ามี)</span>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1.5"
          />
        </label>

        <button
          className={primary} disabled={busy}
          onClick={() => run(() => send(`/api/items/${itemCode}/progress`, {
            body: JSON.stringify({
              field, milestoneSeq: seq, percent, actualDate: date || null,
            }),
          }))}
        >
          {busy ? "กำลังร่าง…" : "ตรวจก่อนบันทึก →"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        กดปุ่มนี้แล้ว <b>ค่าจริงยังไม่เปลี่ยน</b> — ระบบจะขึ้นการ์ดให้ตรวจก่อนยืนยัน
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
    <div className="rounded-lg border-2 p-3.5" style={{ borderColor: "var(--accent2)" }}>
      <p className="text-[12px] font-semibold text-[var(--accent2)]">
        รอคุณยืนยัน · ค่าจริงยังไม่เปลี่ยน
      </p>
      <p className="mt-1.5 text-[15px]">
        <code className="font-semibold">{pending.itemCode}</code> · {what}{" "}
        <span className="text-[var(--muted)]">{pending.oldValue}%</span>
        {" → "}
        <b>{pending.newValue}%</b>
        {pending.actualDate ? <span className="text-[var(--ink2)]"> · วันที่เสร็จ {pending.actualDate}</span> : null}
      </p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">
        ร่างโดย: {pending.draftedBy === "ai" ? "agent ผู้ช่วย (เสนอ ไม่ได้เขียน)" : pending.draftedBy}
      </p>
      <div className="mt-2.5 flex gap-2">
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

export function EvidenceForm({ itemCode }: { itemCode: string }) {
  const { run, busy, error, note } = useAction();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [noDate, setNoDate] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12.5px] grow">
          <span className="block text-[var(--muted)]">ชื่อเอกสารหลักฐาน</span>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น รายงานผลการตรวจวัด ลงนามแล้ว"
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1.5"
          />
        </label>
        <label className="text-[12.5px]">
          <span className="block text-[var(--muted)]">วันที่ในตัวเอกสาร</span>
          <input
            type="date" value={date} disabled={noDate}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 disabled:opacity-40"
          />
        </label>
        <button className={primary} disabled={busy || !title.trim()}
          onClick={() => run(() => send("/api/evidence", {
            body: JSON.stringify({ itemCode, title, documentDate: noDate ? null : date || null }),
          }))}>
          {busy ? "กำลังแนบ…" : "แนบหลักฐาน"}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--ink2)]">
        <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} />
        เอกสารนี้ไม่มีวันที่อยู่ในตัวเอกสารจริง ๆ
      </label>
      <p className="mt-1 text-[12px] text-[var(--muted)]">
        ไม่ใส่วันที่ก็แนบได้ — ระบบจะ<b>ถาม</b>ภายหลัง และ<b>ไม่เอาวันอัปโหลดมาใช้แทน</b>
      </p>
      <Msg error={error} note={note} />
    </div>
  );
}

export function EvidenceDateForm({ evidenceId }: { evidenceId: string }) {
  const { run, busy, error } = useAction();
  const [date, setDate] = useState("");
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <input
        type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[13px]"
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

/** ยืนยัน/แก้ชั้นหลักฐาน — ทีมกลางเท่านั้น ค่า Verified ขยับจากจุดนี้ */
export function TierActions({ evidenceId, proposedTier }: { evidenceId: string; proposedTier: string | null }) {
  const { run, busy, error, note } = useAction();
  const [tier, setTier] = useState(proposedTier ?? "C");
  const [reason, setReason] = useState("");
  const overriding = proposedTier !== null && tier !== proposedTier;

  const patch = () => run(async () => {
    const res = await fetch(`/api/evidence/${evidenceId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier, reason: reason || undefined }),
    });
    const b = await res.json();
    if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
    return { note: b.countsTowardVerified
      ? `ยืนยันชั้น ${b.confirmedTier} — นับเข้าค่า Verified แล้ว`
      : `ยืนยันชั้น ${b.confirmedTier} — ชั้นนี้ไม่นับเข้าค่า Verified` };
  });

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[13px]"
          value={tier} onChange={(e) => setTier(e.target.value)}
        >
          {["A", "B", "C", "D"].map((t) => <option key={t} value={t}>ชั้น {t}</option>)}
        </select>
        {overriding && (
          <input
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="เหตุผลที่แก้จากที่ agent เสนอ (บังคับ)"
            className="min-w-[260px] grow rounded-md border px-2 py-1 text-[13px]"
            style={{ borderColor: "var(--warn)" }}
          />
        )}
        <button className={primary} disabled={busy} onClick={patch}>
          {overriding ? "แก้พร้อมเหตุผล" : "ยืนยันชั้นนี้"}
        </button>
      </div>
      {overriding && (
        <p className="mt-1 text-[12px]" style={{ color: "var(--warn)" }}>
          กำลังแก้จากชั้น {proposedTier} ที่ agent เสนอ → ต้องระบุเหตุผล ระบบบันทึกทั้งค่าเดิมและค่าใหม่
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
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="min-w-[230px] text-[13px]">{label}</span>
      <input
        type="number" value={v} onChange={(e) => setV(Number(e.target.value))}
        className="w-[80px] rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[13px]"
      />
      {suffix && <span className="text-[12.5px] text-[var(--muted)]">{suffix}</span>}
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

export function TargetLevelField({ itemCode, value, achieved }: {
  itemCode: string; value: number; achieved: number;
}) {
  const { run, busy, error, note } = useAction();
  const [v, setV] = useState(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px]">เป้าระดับของปีนี้</span>
      <select
        className="rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[13px]"
        value={v} onChange={(e) => setV(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map((L) => (
          <option key={L} value={L} disabled={L < achieved}>
            ระดับ {L}{L < achieved ? " (ต่ำกว่าที่ได้แล้ว)" : ""}
          </option>
        ))}
      </select>
      <button className={ghost} disabled={busy || v === value}
        onClick={() => run(async () => {
          const res = await fetch(`/api/items/${itemCode}/target`, {
            method: "PATCH", headers: { "content-type": "application/json" },
            body: JSON.stringify({ targetLevel: v }),
          });
          const b = await res.json();
          if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
          return { note: `ตั้งเป้าเป็นระดับ ${b.targetLevel} แล้ว` };
        })}>
        บันทึกเป้า
      </button>
      <Msg error={error} note={note} />
    </div>
  );
}
