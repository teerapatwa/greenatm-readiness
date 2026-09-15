import type { Evidence, Item, Milestone, Verdict } from "@/lib/data/rules";

/**
 * ชิ้นส่วนหน้าจอที่ไม่มี state — FRONTEND.md §6
 * กฎ: สถานะทุกอย่างมีสัญลักษณ์กำกับเสมอ ไม่ใช้สีเพียงอย่างเดียว (§4.4)
 */

export const VERDICT: Record<Verdict, { glyph: string; label: string; color: string }> = {
  complete: { glyph: "✓", label: "เสร็จสมบูรณ์", color: "var(--ok)" },
  nearly:   { glyph: "◗", label: "ใกล้ถึงแล้ว",  color: "var(--accent2)" },
  onplan:   { glyph: "—", label: "ตามแผน",       color: "var(--muted)" },
  needsfix: { glyph: "⚠", label: "ต้องแก้ไข",    color: "var(--warn)" },
  asked:    { glyph: "?", label: "ขอข้อมูลเพิ่ม", color: "var(--ret)" },
  escalate: { glyph: "⛔", label: "ยกระดับ",      color: "var(--late)" },
};

export const VERB: Record<string, { glyph: string; label: string; color: string }> = {
  NOTE:     { glyph: "⏱", label: "แจ้งให้ทราบ",       color: "var(--muted)" },
  ASK:      { glyph: "⚠", label: "ขอข้อมูลเพิ่ม",      color: "var(--warn)" },
  ESCALATE: { glyph: "⛔", label: "ยกให้ผู้ดูแลตัดสิน", color: "var(--late)" },
};

export function Card({ children, tone, className = "" }: {
  children: React.ReactNode; tone?: "warn" | "late" | "ok"; className?: string;
}) {
  const border = tone ? `var(--${tone})` : "var(--line)";
  return (
    <div
      className={`rounded-lg border bg-[var(--card)] p-4 ${className}`}
      style={{ borderColor: border }}
    >
      {children}
    </div>
  );
}

export function Chip({ glyph, label, color, title }: {
  glyph: string; label: string; color: string; title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium"
      style={{ color, borderColor: color }}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </span>
  );
}

export function TierChip({ tier, confirmed }: { tier: string | null; confirmed: boolean }) {
  if (!tier) return <span className="text-[12px] text-[var(--muted)]">ยังไม่จัดชั้น</span>;
  const glyph = { A: "◆", B: "◇", C: "○", D: "✕" }[tier] ?? "•";
  const color = `var(--tier-${tier.toLowerCase()})`;
  return (
    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color }}>
      <span aria-hidden>{glyph}</span>
      <b>ชั้น {tier}</b>
      <span className="text-[var(--muted)]">{confirmed ? "· ยืนยันแล้ว" : "· agent เสนอ รอยืนยัน"}</span>
    </span>
  );
}

/** ระดับ 1–5 — ตัวเลขในวง ไม่ใช่สีล้วน */
export function LevelDots({ achieved, target }: { achieved: number; target: number }) {
  return (
    <span className="inline-flex gap-[3px]" aria-label={`ระดับ ${achieved} จากเป้า ${target}`}>
      {[1, 2, 3, 4, 5].map((L) => {
        const on = L <= achieved;
        const isTarget = L === target;
        return (
          <span
            key={L}
            className="grid h-[19px] w-[19px] place-items-center rounded-full text-[11px] font-semibold"
            style={{
              background: on ? "var(--accent)" : "transparent",
              color: on ? "#fff" : "var(--muted)",
              border: `1px ${isTarget && !on ? "dashed" : "solid"} ${
                on ? "var(--accent)" : isTarget ? "var(--accent)" : "var(--line)"
              }`,
            }}
          >
            {L}
          </span>
        );
      })}
    </span>
  );
}

/** แถบ milestone ย่อสำหรับตารางหน้าแรก */
export function MilestoneStrip({ milestones, today }: { milestones: Milestone[]; today: string }) {
  if (milestones.length === 0) {
    return <span className="text-[12px] text-[var(--muted)]">ไม่มีแผนงานย่อย</span>;
  }
  const done = milestones.filter((m) => m.percentComplete === 100).length;
  return (
    <span className="inline-flex items-center gap-1">
      {milestones.map((m) => {
        const late = m.plannedEnd < today && m.percentComplete < 100;
        const color = m.percentComplete === 100 ? "var(--ok)"
          : late ? "var(--late)"
          : m.percentComplete > 0 ? "var(--warn)" : "var(--line)";
        return (
          <span
            key={m.seq}
            title={`${m.name} · แผนจบ ${m.plannedEnd} · ${m.percentComplete}%${late ? " · เลยกำหนด" : ""}`}
            className="h-[7px] w-[16px] rounded-sm"
            style={{ background: color }}
          />
        );
      })}
      <span className="ml-1 text-[12px] text-[var(--muted)]">
        {done}/{milestones.length}
      </span>
    </span>
  );
}

/** timeline เต็มในหน้ารายละเอียด */
export function Timeline({ milestones, today }: { milestones: Milestone[]; today: string }) {
  if (milestones.length === 0) {
    return (
      <p className="text-[13px] text-[var(--muted)]">
        รายการนี้ยังไม่มีแผนงานย่อย — จึงไม่มี milestone ให้ติดตาม
      </p>
    );
  }
  return (
    <ol className="space-y-0">
      {milestones.map((m, idx) => {
        const late = m.plannedEnd < today && m.percentComplete < 100;
        const done = m.percentComplete === 100;
        const color = done ? "var(--ok)" : late ? "var(--late)" : m.percentComplete > 0 ? "var(--warn)" : "var(--muted)";
        return (
          <li key={m.seq} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ background: color }}
              >
                {done ? "✓" : m.seq}
              </span>
              {idx < milestones.length - 1 && (
                <span className="w-px grow" style={{ background: "var(--line)", minHeight: 22 }} />
              )}
            </div>
            <div className="pb-4 pt-0.5">
              <p className="text-[14px] font-medium">{m.name}</p>
              <p className="text-[12.5px] text-[var(--ink2)]">
                แผน {m.plannedStart} → {m.plannedEnd}
                {m.actualEnd ? ` · เสร็จจริง ${m.actualEnd}` : ""}
              </p>
              <p className="text-[12.5px]" style={{ color: late ? "var(--late)" : "var(--ink2)" }}>
                {late ? `⚠ เลยกำหนดแผน · ทำได้ ${m.percentComplete}%` : `ทำได้ ${m.percentComplete}%`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SlipHistory({ item, escalateAfter }: { item: Item; escalateAfter: number }) {
  if (item.slipHistory.length === 0) {
    return <p className="text-[13px] text-[var(--muted)]">ไม่เคยเลื่อนแผน</p>;
  }
  const reasons = new Set(item.slipHistory.map((s) => s.reason));
  return (
    <div>
      <ol className="space-y-1.5">
        {item.slipHistory.map((s, i) => (
          <li key={i} className="text-[13px]">
            <b>ครั้งที่ {i + 1}</b> · {s.from} → {s.to}
            <span className="text-[var(--ink2)]"> — {s.reason}</span>
          </li>
        ))}
      </ol>
      {item.slipHistory.length >= escalateAfter && reasons.size === 1 && (
        <p className="mt-2 text-[13px] font-medium" style={{ color: "var(--late)" }}>
          ⛔ เลื่อนครบ {item.slipHistory.length} ครั้งด้วยเหตุผลเดิมทุกครั้ง — นี่คือปัญหาเชิงโครงสร้าง
          ต้องการการตัดสินใจหรือทรัพยากร ไม่ใช่การเร่งงาน
        </p>
      )}
    </div>
  );
}

/** สองตัวเลขที่ห้ามรวมกัน — §4.2 */
export function PairedFigures({ progress, verified, evidenceCount }: {
  progress: number; verified: number; evidenceCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md border border-[var(--line)] p-3">
        <p className="text-[12px] text-[var(--muted)]">งานคืบหน้า (เจ้าของกรอก)</p>
        <p className="text-[24px] font-bold">{progress}%</p>
        <p className="text-[11.5px] text-[var(--muted)]">จากน้ำหนักของ milestone</p>
      </div>
      <div className="rounded-md border p-3" style={{ borderColor: verified === 0 ? "var(--warn)" : "var(--line)" }}>
        <p className="text-[12px] text-[var(--muted)]">ยืนยันด้วยหลักฐาน</p>
        <p className="text-[24px] font-bold" style={{ color: verified === 0 ? "var(--warn)" : "var(--accent2)" }}>
          {verified}%
        </p>
        <p className="text-[11.5px] text-[var(--muted)]">
          {evidenceCount === 0
            ? "ไม่มีหลักฐานเลย"
            : `จาก ${evidenceCount} เอกสาร · นับเฉพาะชั้น A/B ที่ยืนยันแล้ว`}
        </p>
      </div>
    </div>
  );
}

export function EvidenceRow({ e }: { e: Evidence }) {
  return (
    <div className="border-t border-[var(--line)] py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <TierChip tier={e.confirmedTier ?? e.proposedTier} confirmed={e.confirmedTier !== null} />
        <code className="text-[12px] text-[var(--muted)]">{e.id}</code>
      </div>
      <p className="mt-1 text-[13.5px]">{e.title}</p>
      <p className="text-[12px] text-[var(--ink2)]">
        วันที่ในเอกสาร:{" "}
        {e.documentDate ?? (
          <b style={{ color: "var(--ret)" }}>ไม่พบในตัวเอกสาร — ระบบต้องถาม ไม่เดาจากวันอัปโหลด</b>
        )}
      </p>
      {e.proposedReason && (
        <p className="mt-1 text-[12.5px] text-[var(--ink2)]">เหตุผลที่ agent เสนอ: {e.proposedReason}</p>
      )}
    </div>
  );
}

export function Banner({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "late" | "ok" }) {
  return (
    <div
      className="rounded-md border px-3 py-2 text-[13px]"
      style={{ borderColor: `var(--${tone})`, color: "var(--ink)" }}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-[var(--line)] px-3 py-6 text-center text-[13px] text-[var(--muted)]">
      {children}
    </p>
  );
}
