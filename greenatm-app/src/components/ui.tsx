import type { Evidence, Item, Milestone, Verdict } from "@/lib/data/rules";

/**
 * ชิ้นส่วนหน้าจอ — ขนาดและสียึดตาม GreenATM Evidence Dashboard (standalone).html ของทีม
 *
 * กฎที่คงไว้: สถานะทุกอย่างมีสัญลักษณ์กำกับ ไม่ใช้สีเพียงอย่างเดียว
 */

export const LEVEL_FILL = ["#edf0ea", "#edf0ea", "#cfe4d5", "#8fc3a3", "#4f8a76", "#1f8a53"];

export const VERDICT: Record<Verdict, { glyph: string; label: string; color: string }> = {
  complete: { glyph: "✓", label: "เสร็จสมบูรณ์", color: "#1f8a53" },
  nearly:   { glyph: "◗", label: "ใกล้ถึงแล้ว",  color: "#4f8a76" },
  onplan:   { glyph: "—", label: "ตามแผน",       color: "#7c8a80" },
  needsfix: { glyph: "⚠", label: "ต้องแก้ไข",    color: "#b8860b" },
  asked:    { glyph: "?", label: "ขอข้อมูลเพิ่ม", color: "#b8860b" },
  escalate: { glyph: "⛔", label: "ยกระดับ",      color: "#c0392b" },
};

export const VERB: Record<string, { glyph: string; label: string; color: string }> = {
  NOTE:     { glyph: "⏱", label: "แจ้งให้ทราบ",       color: "#7c8a80" },
  ASK:      { glyph: "⚠", label: "ขอข้อมูลเพิ่ม",      color: "#b8860b" },
  ESCALATE: { glyph: "⛔", label: "ยกให้ผู้ดูแลตัดสิน", color: "#c0392b" },
};

export function Card({ children, tone, className = "", pad, style }: {
  children: React.ReactNode;
  tone?: "warn" | "danger" | "ok";
  className?: string;
  pad?: string;
  style?: React.CSSProperties;
}) {
  const bg = tone === "warn" ? "var(--warn-bg)" : tone === "danger" ? "var(--danger-bg)"
    : tone === "ok" ? "var(--ok-bg)" : "var(--card)";
  const bd = tone === "warn" ? "var(--warn-line)" : tone === "danger" ? "var(--danger-line)"
    : tone === "ok" ? "var(--ok-line)" : "var(--line)";
  return (
    <div className={className} style={{
      background: bg, border: `1px solid ${bd}`, borderRadius: 12, padding: pad ?? "20px 22px",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Chip({ glyph, label, color, title }: {
  glyph: string; label: string; color: string; title?: string;
}) {
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
      border: `1px solid ${color}`, color, borderRadius: 999,
      padding: "1px 8px", fontSize: 11.5, fontWeight: 600,
    }}>
      <span aria-hidden>{glyph}</span>{label}
    </span>
  );
}

/** ป้ายเล็กแบบที่ไฟล์ทีมใช้ในเซลล์ชื่อรายการ */
export function Tag({ children, tone = "ok" }: {
  children: React.ReactNode; tone?: "ok" | "warn" | "danger" | "muted";
}) {
  const map = {
    ok: ["var(--ok-bg)", "var(--ok-line)", "#166b40"],
    warn: ["var(--warn-bg)", "var(--warn-line)", "var(--warn-ink)"],
    danger: ["var(--danger-bg)", "var(--danger-line)", "var(--danger)"],
    muted: ["var(--fill)", "var(--line)", "var(--muted)"],
  }[tone];
  return (
    <span style={{
      background: map[0], border: `1px solid ${map[1]}`, color: map[2],
      borderRadius: 6, padding: "1px 6px", fontSize: 10.5, fontWeight: 700,
      marginLeft: 6, whiteSpace: "nowrap", display: "inline-block",
    }}>
      {children}
    </span>
  );
}

export function TierChip({ tier, confirmed }: { tier: string | null; confirmed: boolean }) {
  if (!tier) return <span style={{ fontSize: 12, color: "var(--muted)" }}>ยังไม่จัดชั้น</span>;
  const glyph = { A: "◆", B: "◇", C: "○", D: "✕" }[tier] ?? "•";
  const color = `var(--tier-${tier.toLowerCase()})`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color }}>
      <span aria-hidden>{glyph}</span>
      <b>ชั้น {tier}</b>
      <span style={{ color: "var(--muted)" }}>
        {confirmed ? "· ยืนยันแล้ว" : "· agent เสนอ รอยืนยัน"}
      </span>
    </span>
  );
}

/**
 * แถบ "สถานะปัจจุบัน" — 5 ช่องเล็กเรียงกัน แบบเดียวกับไฟล์ทีม
 * ช่องที่ได้แล้วทึบ ช่องถัดไปแสดงความคืบหน้าบางส่วน
 */
export function LevelSegments({ achieved, percentWithinNext }: {
  achieved: number; percentWithinNext: number;
}) {
  return (
    <div style={{ display: "flex", gap: 3 }} aria-label={`ระดับ ${achieved}`}>
      {[1, 2, 3, 4, 5].map((L) => {
        const done = L <= achieved;
        const next = L === achieved + 1;
        return (
          <div key={L} title={done ? `ได้ระดับ ${L}` : next ? `กำลังไประดับ ${L} · ${percentWithinNext}%` : `ระดับ ${L}`}
            style={{
              width: 15, height: 20, borderRadius: 3, overflow: "hidden",
              background: done ? LEVEL_FILL[L] : "var(--l1)",
              border: `1px solid ${done ? LEVEL_FILL[L] : "var(--line)"}`,
              position: "relative",
            }}>
            {next && percentWithinNext > 0 && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: `${percentWithinNext}%`, background: "var(--l3)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** แถบการกระจายตัวของ Level — การ์ดบนสุดของหน้าแรกในไฟล์ทีม */
export function LevelDistribution({ counts, height = 14, legend = true }: {
  counts: number[]; height?: number; legend?: boolean;
}) {
  const total = counts.reduce((s, x) => s + x, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height, borderRadius: height / 2, overflow: "hidden" }}>
        {counts.map((n, idx) =>
          n === 0 ? null : (
            <div key={idx} title={`ระดับ ${idx + 1} · ${n} ข้อ`}
              style={{ width: `${(n / total) * 100}%`, background: LEVEL_FILL[idx + 1] }} />
          ))}
      </div>
      {legend && (
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          {counts.map((n, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink2)" }}>
              <span style={{
                width: 9, height: 9, borderRadius: 2, background: LEVEL_FILL[idx + 1],
                border: `1px solid ${idx === 0 ? "var(--line)" : LEVEL_FILL[idx + 1]}`, display: "inline-block",
              }} />
              Level {idx + 1} ({n})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** แถบ milestone ย่อ — ส่วนที่เราเพิ่ม ใช้ token ชุดเดียวกัน */
export function MilestoneStrip({ milestones, today }: { milestones: Milestone[]; today: string }) {
  if (milestones.length === 0) {
    return <span style={{ fontSize: 11.5, color: "var(--muted2)" }}>ไม่มีแผนงานย่อย</span>;
  }
  const done = milestones.filter((m) => m.percentComplete === 100).length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {milestones.map((m) => {
        const late = m.plannedEnd < today && m.percentComplete < 100;
        const bg = m.percentComplete === 100 ? "var(--accent)"
          : late ? "var(--danger)"
          : m.percentComplete > 0 ? "var(--warn)" : "var(--line)";
        return (
          <span key={m.seq}
            title={`${m.name} · แผนจบ ${m.plannedEnd} · ${m.percentComplete}%${late ? " · เลยกำหนด" : ""}`}
            style={{ width: 14, height: 6, borderRadius: 2, background: bg, display: "inline-block" }} />
        );
      })}
      <span style={{ marginLeft: 3, fontSize: 11, color: "var(--muted2)" }} className="tnum">
        {done}/{milestones.length}
      </span>
    </span>
  );
}

export function Timeline({ milestones, today }: { milestones: Milestone[]; today: string }) {
  if (milestones.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--muted)" }}>
      รายการนี้ยังไม่มีแผนงานย่อย — จึงไม่มี milestone ให้ติดตาม
    </p>;
  }
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {milestones.map((m, idx) => {
        const late = m.plannedEnd < today && m.percentComplete < 100;
        const done = m.percentComplete === 100;
        const color = done ? "var(--accent)" : late ? "var(--danger)"
          : m.percentComplete > 0 ? "var(--warn)" : "var(--muted2)";
        return (
          <li key={m.seq} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{
                width: 24, height: 24, borderRadius: 999, background: color, color: "#fff",
                display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flex: "none",
              }}>
                {done ? "✓" : m.seq}
              </span>
              {idx < milestones.length - 1 && (
                <span style={{ width: 1, flexGrow: 1, minHeight: 22, background: "var(--line)" }} />
              )}
            </div>
            <div style={{ paddingBottom: 16, paddingTop: 2 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{m.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink2)" }}>
                แผน {m.plannedStart} → {m.plannedEnd}
                {m.actualEnd ? ` · เสร็จจริง ${m.actualEnd}` : ""}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: late ? "var(--danger)" : "var(--ink2)" }}>
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
    return <p style={{ fontSize: 13, color: "var(--muted)" }}>ไม่เคยเลื่อนแผน</p>;
  }
  const reasons = new Set(item.slipHistory.map((s) => s.reason));
  return (
    <div>
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {item.slipHistory.map((s, i) => (
          <li key={i} style={{ fontSize: 13, marginBottom: 5 }}>
            <b>ครั้งที่ {i + 1}</b> · {s.from} → {s.to}
            <span style={{ color: "var(--ink2)" }}> — {s.reason}</span>
          </li>
        ))}
      </ol>
      {item.slipHistory.length >= escalateAfter && reasons.size === 1 && (
        <p style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--danger)" }}>
          ⛔ เลื่อนครบ {item.slipHistory.length} ครั้งด้วยเหตุผลเดิมทุกครั้ง — นี่คือปัญหาเชิงโครงสร้าง
          ต้องการการตัดสินใจหรือทรัพยากร ไม่ใช่การเร่งงาน
        </p>
      )}
    </div>
  );
}

/** สามคอลัมน์ที่ห้ามรวมกัน — คัดลอกโครงและถ้อยคำจากไฟล์ทีม */
export function ThreeColumnRule({ progress, milestoneDone, milestoneTotal, evidence, verified }: {
  progress: number; milestoneDone: number; milestoneTotal: number;
  evidence: Evidence[]; verified: number;
}) {
  const countable = evidence.filter((e) => e.confirmedTier === "A" || e.confirmedTier === "B").length;
  const tiers = [...new Set(evidence.map((e) => e.confirmedTier ?? e.proposedTier).filter(Boolean))];
  const box: React.CSSProperties = { background: "var(--fill)", borderRadius: 10, padding: 16 };
  const arrow = { fontSize: 20, color: "var(--danger)", fontWeight: 700 } as React.CSSProperties;
  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr",
        gap: 14, alignItems: "center",
      }}>
        <div style={box}>
          <div className="ga-label">ความคืบหน้างาน (เจ้าของกรอก)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }} className="tnum">
            {progress}%
          </div>
          <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 2 }}>
            {milestoneTotal > 0 ? `${milestoneDone}/${milestoneTotal} milestone` : "ไม่มีแผนงานย่อย"}
          </div>
        </div>
        <div style={arrow} aria-hidden>✕</div>
        <div style={box}>
          <div className="ga-label">หลักฐาน (agent จัดชั้น)</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 6 }}>
            {evidence.length === 0
              ? "ไม่มีเลย"
              : `${evidence.length} ชิ้น · ชั้น ${tiers.join("/")}`}
          </div>
          <div style={{
            fontSize: 12, marginTop: 2, fontWeight: 600,
            color: countable === 0 ? "var(--danger)" : "var(--accent)",
          }}>
            {countable === 0 ? "ยังไม่นับ" : `นับได้ ${countable} ชิ้น`}
          </div>
        </div>
        <div style={arrow} aria-hidden>✕</div>
        <div style={box}>
          <div className="ga-label">การยืนยัน (คนอนุมัติ)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }} className="tnum">
            {verified}%
          </div>
          <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 2 }}>
            {verified === 0 ? "ยังไม่ยืนยัน" : "ยืนยันแล้ว"}
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--line)",
        fontSize: 12.5, color: "var(--ink2)",
      }}>
        ▲ ตัวเลขงานคืบหน้าไม่ดันตัวเลขยืนยันด้วยหลักฐานให้ขึ้นได้เลย —{" "}
        <b style={{ color: "var(--ink)" }}>ระบบไม่แปลง % งานเสร็จ เป็นความพร้อมโดยอัตโนมัติ</b>{" "}
        (เคสทดสอบ AC-01)
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      border: "1px dashed var(--line)", borderRadius: 10, padding: "22px 12px",
      textAlign: "center", fontSize: 13, color: "var(--muted)", margin: 0,
    }}>
      {children}
    </p>
  );
}

/** สถานะ pill — ไฟล์ทีมมีคอลัมน์ `สถานะ` ในหน้างานของฉัน */
export const STATUS_STYLE: Record<string, { glyph: string; label: string; fg: string; bg: string; bd: string }> = {
  on_track: { glyph: "●", label: "ตามแผน",    fg: "#166b40", bg: "var(--ok-bg)",     bd: "var(--ok-line)" },
  at_risk:  { glyph: "▲", label: "เสี่ยง",     fg: "var(--warn-ink)", bg: "var(--warn-bg)", bd: "var(--warn-line)" },
  delayed:  { glyph: "⛔", label: "ช้ากว่าแผน", fg: "var(--danger)", bg: "var(--danger-bg)", bd: "var(--danger-line)" },
};

export function StatusPill({ status, title }: { status: string; title?: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.on_track;
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
      background: s.bg, border: `1px solid ${s.bd}`, color: s.fg,
      borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 700,
    }}>
      <span aria-hidden>{s.glyph}</span>{s.label}
    </span>
  );
}

/** ความคืบหน้า (milestone) แบบไฟล์ทีม — ชื่อ+% แล้วแถบ 6px */
export function MilestoneBars({ milestones, today }: { milestones: Milestone[]; today: string }) {
  if (milestones.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
      ยังไม่มีแผนงานย่อย — เพิ่มขั้นได้ที่ปุ่มด้านล่าง
    </p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {milestones.map((m) => {
        const late = m.plannedEnd < today && m.percentComplete < 100;
        const fill = m.percentComplete === 100 ? "var(--accent)"
          : late ? "var(--danger)" : "var(--l3)";
        return (
          <div key={m.seq}>
            <div style={{
              display: "flex", justifyContent: "space-between", gap: 8,
              fontSize: 12.5, marginBottom: 4,
            }}>
              <span>{m.seq}. {m.name}{late && <span style={{ color: "var(--danger)" }}> ⛔</span>}</span>
              <span className="tnum" style={{ fontWeight: 700 }}>{m.percentComplete}%</span>
            </div>
            <div style={{ height: 6, background: "var(--l1)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${m.percentComplete}%`, background: fill }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 3 }}>
              แผน {m.plannedStart} → {m.plannedEnd}
              {m.actualEnd ? ` · เสร็จจริง ${m.actualEnd}` : late ? " · เลยกำหนดแล้ว" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** กล่องหลักฐานแบบไฟล์ทีม — ชั้น A/B พื้นเขียวอ่อน ชั้นอื่นพื้นเทา */
export function EvidenceCard({ e, hasFile, children }: {
  e: Evidence; hasFile?: boolean; children?: React.ReactNode;
}) {
  const tier = e.confirmedTier ?? e.proposedTier;
  const good = tier === "A" || tier === "B";
  const TIER_GLYPH: Record<string, string> = { A: "◆", B: "◇", C: "○", D: "✕" };
  const glyph = TIER_GLYPH[tier ?? ""] ?? "•";
  const color = tier ? `var(--tier-${tier.toLowerCase()})` : "var(--muted2)";
  return (
    <div style={{
      border: `1px solid ${good ? "var(--ok-line)" : "var(--line)"}`,
      background: good ? "#f6fbf7" : "var(--fill2)",
      borderRadius: 10, padding: 14, marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13, wordBreak: "break-word" }}>
            [{e.id}] {e.title}
            {hasFile
              ? <> · <a href={`/api/evidence/${e.id}/file`} target="_blank" rel="noopener"
                  style={{ fontWeight: 600 }}>เปิดไฟล์</a></>
              : <span style={{ color: "var(--muted2)", fontWeight: 400 }}> · ไม่มีไฟล์แนบ มีแต่ชื่อเรื่อง</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 2 }}>
            อัปโหลด {e.uploadDate} · วันที่ในเอกสาร{" "}
            {e.documentDate ?? <b style={{ color: "var(--warn-ink)" }}>ไม่พบ — ระบบถาม ไม่เดา</b>}
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, color,
          fontWeight: 800, fontSize: 14, flex: "none",
        }}>
          <span aria-hidden>{glyph}</span>{tier ?? "?"}
        </div>
      </div>
      {e.proposedReason && (
        <div style={{ fontSize: 12.5, color: "#3d4a43", marginTop: 10, lineHeight: 1.6 }}>
          เหตุผลจาก Agent: {e.proposedReason}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--muted2)", marginTop: 6 }}>
        {e.confirmedTier
          ? `ยืนยันชั้น ${e.confirmedTier} แล้วโดย ${e.confirmedBy}`
          : "agent เสนอ · รอทีมกลางยืนยัน — ค่า Verified ยังไม่ขยับ"}
      </div>
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

/** "ยังขาดอะไร" — ขีดฆ่าข้อที่ครบแล้วแบบไฟล์ทีม */
export function GapChecklist({ gaps }: { gaps: { text: string; done: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
      {gaps.map((g, i) => (
        <div key={i} style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          color: g.done ? "var(--muted2)" : "var(--ink)",
          textDecoration: g.done ? "line-through" : "none",
        }}>
          <span aria-hidden style={{ marginTop: 1, flex: "none" }}>{g.done ? "✓" : "☐"}</span>
          <span>{g.text}</span>
        </div>
      ))}
    </div>
  );
}

/** "ประวัติ" จาก audit_log */
export function HistoryList({ rows }: {
  rows: { actor: string; action: string; before: string | null; after: string | null; at: string }[];
}) {
  if (rows.length === 0) {
    return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
      ยังไม่มีการเปลี่ยนค่าในรายการนี้
    </p>;
  }
  const label: Record<string, string> = {
    confirm_progress: "ยืนยันความคืบหน้า", add_evidence: "แนบหลักฐาน",
    attach_file: "แนบไฟล์", confirm_tier: "ยืนยันชั้นหลักฐาน",
    set_evidence_date: "ระบุวันที่เอกสาร", delete_evidence: "ลบหลักฐาน",
    add_milestone: "เพิ่มขั้นแผนงาน", update_milestone: "แก้แผนงาน",
    delete_milestone: "ลบขั้นแผนงาน", record_slip: "เลื่อนแผน",
    delete_slip: "ลบประวัติการเลื่อน", set_target_level: "ตั้งเป้าระดับ",
    set_achieved_level: "ปรับระดับที่ได้", update_item_meta: "แก้ข้อมูลรายการ",
  };
  return (
    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
      {rows.map((h, i) => (
        <div key={i}>
          {h.at.slice(5, 10)} — {label[h.action] ?? h.action}{" "}
          <span style={{ color: "var(--muted2)" }}>โดย {h.actor}</span>
        </div>
      ))}
    </div>
  );
}
