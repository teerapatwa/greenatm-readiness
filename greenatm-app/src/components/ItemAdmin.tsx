"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * แก้ข้อมูลของรายการ — หัวข้อ · ผู้รับผิดชอบ · ระดับที่ได้ · เป้าปีนี้
 *
 * แต่ละช่องเปิด/ปิดตามสิทธิ์ที่ส่งมาจาก server (§5.5)
 * แต่ **การกันจริงอยู่ที่ route handler** — component นี้แค่ไม่แสดงช่องที่ทำไม่ได้
 */
export function ItemAdmin({ code, name, ownerUserId, achievedLevel, targetLevel, lastYearLevel,
  canManage, canSetTarget, candidates, hasConfirmedEvidence }: {
  code: string;
  name: string;
  ownerUserId: string | null;
  achievedLevel: number;
  targetLevel: number;
  lastYearLevel: number;
  canManage: boolean;
  canSetTarget: boolean;
  /** เฉพาะผู้ใช้บทบาทเจ้าของข้อมูลที่สังกัดกองเดียวกับรายการนี้ */
  candidates: { id: string; title: string }[];
  hasConfirmedEvidence: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [nm, setNm] = useState(name);
  const [ow, setOw] = useState(ownerUserId ?? "");
  const [ach, setAch] = useState(achievedLevel);
  const [tgt, setTgt] = useState(targetLevel);

  const dirty =
    nm.trim() !== name ||
    (ow || null) !== ownerUserId ||
    ach !== achievedLevel ||
    tgt !== targetLevel;

  const save = async () => {
    setBusy(true); setError(null); setNote(null);
    const patch: Record<string, unknown> = {};
    if (canManage && nm.trim() !== name) patch.name = nm.trim();
    if (canManage && (ow || null) !== ownerUserId) patch.ownerUserId = ow || null;
    if (canSetTarget && tgt !== targetLevel) patch.targetLevel = tgt;
    if (canManage && ach !== achievedLevel) patch.achievedLevel = ach;
    try {
      const res = await fetch(`/api/items/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const b = await res.json();
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
      setNote(
        b.applied?.length
          ? `บันทึกแล้ว: ${b.applied.join(" · ")} — มีในประวัติ audit log`
          : "ไม่มีอะไรเปลี่ยน",
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field = "ga-input";

  return (
    <div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {canManage && (
          <label style={{ fontSize: 12.5, gridColumn: "1 / -1" }}>
            <span style={{ display: "block", color: "var(--muted)" }}>ชื่อหัวข้อ</span>
            <input value={nm} onChange={(e) => setNm(e.target.value)} className={field} style={{ marginTop: 4, width: "100%" }} />
          </label>
        )}

        {canManage && (
          <label style={{ fontSize: 12.5 }}>
            <span style={{ display: "block", color: "var(--muted)" }}>ผู้รับผิดชอบ</span>
            <select value={ow} onChange={(e) => setOw(e.target.value)} className={field} style={{ marginTop: 4, width: "100%" }}>
              <option value="">— ยังไม่มอบหมาย —</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {candidates.length === 0 && (
              <span style={{ marginTop: 4, display: "block", fontSize: 11.5, color: "var(--warn-ink)" }}>
                กองนี้ยังไม่มีผู้ใช้บทบาทเจ้าของข้อมูลในระบบ — ต้องเพิ่มผู้ใช้ก่อนจึงมอบหมายได้
              </span>
            )}
          </label>
        )}

        {canSetTarget && (
          <label style={{ fontSize: 12.5 }}>
            <span style={{ display: "block", color: "var(--muted)" }}>เป้าระดับของปีนี้</span>
            <select value={tgt} onChange={(e) => setTgt(Number(e.target.value))} className={field} style={{ marginTop: 4, width: "100%" }}>
              {[1, 2, 3, 4, 5].map((L) => (
                <option key={L} value={L} disabled={L < ach}>
                  ระดับ {L}
                  {L < ach ? " — ต่ำกว่าระดับที่ได้แล้ว" : ""}
                  {L > lastYearLevel ? " (สูงกว่าปีที่แล้ว)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {canManage && (
          <label style={{ fontSize: 12.5 }}>
            <span style={{ display: "block", color: "var(--muted)" }}>ระดับที่ได้</span>
            <select value={ach} onChange={(e) => setAch(Number(e.target.value))} className={field} style={{ marginTop: 4, width: "100%" }}>
              {[0, 1, 2, 3, 4, 5].map((L) => (
                <option key={L} value={L} disabled={L > tgt || (L > achievedLevel && !hasConfirmedEvidence)}>
                  {L === 0 ? "0 — ยังไม่ถึงระดับ 1" : `ระดับ ${L}`}
                  {L > tgt ? " — สูงกว่าเป้า" : ""}
                  {L > achievedLevel && !hasConfirmedEvidence ? " — ยังไม่มีหลักฐานรองรับ" : ""}
                </option>
              ))}
            </select>
            {!hasConfirmedEvidence && (
              <span style={{ marginTop: 4, display: "block", fontSize: 11.5, color: "var(--warn-ink)" }}>
                รายการนี้ยังไม่มีหลักฐานชั้น A/B ที่ยืนยันแล้ว — <b>ขึ้นระดับไม่ได้</b>
                {" "}ระดับขยับด้วยหลักฐาน ไม่ใช่ด้วยการกรอก
              </span>
            )}
          </label>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="ga-btn ga-btn-primary"
        >
          {busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
        </button>
        {dirty && !busy && (
          <button
            onClick={() => { setNm(name); setOw(ownerUserId ?? ""); setAch(achievedLevel); setTgt(targetLevel); setError(null); setNote(null); }}
            className="ga-btn ga-btn-ghost"
          >
            ย้อนกลับ
          </button>
        )}
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          ทุกการแก้บันทึกค่าก่อน/หลังลง audit log พร้อมชื่อผู้แก้
        </span>
      </div>

      {error && <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--danger)" }}>⛔ {error}</p>}
      {note && <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink2)" }}>{note}</p>}
    </div>
  );
}
