import { snapshot } from "@/lib/db/queries";
import { buildAlerts, alertCounts, progressPercent, verifiedPercent, suggestion, stalledItems } from "@/lib/data/rules";

export const dynamic = "force-dynamic";

const VERDICT: Record<string, { glyph: string; label: string; color: string }> = {
  complete: { glyph: "✓", label: "เสร็จสมบูรณ์", color: "var(--ok)" },
  nearly: { glyph: "◗", label: "ใกล้ถึงแล้ว", color: "var(--accent2)" },
  onplan: { glyph: "—", label: "ตามแผน", color: "var(--muted)" },
  needsfix: { glyph: "⚠", label: "ต้องแก้ไข", color: "var(--warn)" },
  asked: { glyph: "?", label: "ขอข้อมูลเพิ่ม", color: "var(--ret)" },
  escalate: { glyph: "⛔", label: "ยกระดับ", color: "var(--late)" },
};

export default function SeedCheck() {
  const SEED = snapshot();
  const items = SEED.items;
  const alerts = buildAlerts(SEED);
  const counts = alertCounts(alerts);
  const stalled = stalledItems(items);
  const mean = items.reduce((s, i) => s + i.achievedLevel, 0) / items.length;
  const meanLast = items.reduce((s, i) => s + i.lastYearLevel, 0) / items.length;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-xl font-semibold">ชุดข้อมูลตัวอย่าง — ตรวจด้วยตา</h1>
      <p className="mt-1 text-[14px] text-[var(--ink2)]">
        {SEED.meta.note} · อ้างอิงแบบฟอร์ม {SEED.meta.formRef} · วันที่อ้างอิง {SEED.meta.today}
      </p>

      {/* หัวข้อข่าวที่ซื่อสัตย์คือการนิ่ง ไม่ใช่ค่าเฉลี่ย (PLAN §5.7) */}
      <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        <p className="text-[15px]">
          <b className="text-[22px]">{stalled.length} จาก {items.length} รายการ</b>{" "}
          ไม่ขยับระดับเลยตั้งแต่ปีที่แล้ว
        </p>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          ระดับเฉลี่ย {mean.toFixed(2)} · ปีที่แล้ว {meanLast.toFixed(2)} — ค่าเฉลี่ยคือผลพวง การนิ่งคือสิ่งที่ค้นพบ
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          ["ถึง moderator", counts.moderator, "ต้องน้อยกว่าเจ้าของเสมอ"],
          ["ถึงเจ้าของ", counts.ownerTotal, "รวมที่ยังไม่มีผู้รับ"],
          ["ไม่มีผู้รับ", counts.orphan, "หมวด 4 ยังไม่มีเจ้าของในระบบ"],
          ["ถึงผู้บริหาร", counts.executive, "ผู้บริหารไม่ถูกเรียกรายข้อ"],
        ].map(([label, n, note]) => (
          <div key={String(label)} className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[13px] text-[var(--muted)]">{label}</div>
            <div className="text-[24px] font-semibold">{String(n)}</div>
            <div className="mt-0.5 text-[12px] text-[var(--muted)]">{note}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-[15px] font-semibold">รายการทั้งหมด</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="pb-2 pr-3 font-medium">รหัส</th>
              <th className="pb-2 pr-3 font-medium">รายการ</th>
              <th className="pb-2 pr-3 font-medium">เจ้าของ</th>
              <th className="pb-2 pr-3 font-medium">ปีที่แล้ว</th>
              <th className="pb-2 pr-3 font-medium">ตอนนี้</th>
              <th className="pb-2 pr-3 font-medium">เป้า</th>
              <th className="pb-2 pr-3 font-medium">งานคืบหน้า</th>
              <th className="pb-2 pr-3 font-medium">ยืนยันแล้ว</th>
              <th className="pb-2 font-medium">Suggestion</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const s = suggestion(it, SEED.evidence, SEED.settings);
              const v = VERDICT[s.verdict];
              const owner = SEED.users.find((u) => u.id === it.ownerUserId);
              return (
                <tr key={it.code} className="border-t border-[var(--line)] align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{it.code}</td>
                  <td className="py-1.5 pr-3">{it.name}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {owner ? owner.title : <span className="text-[var(--late)]">ไม่มีเจ้าของ</span>}
                  </td>
                  <td className="py-1.5 pr-3">{it.lastYearLevel}</td>
                  <td className="py-1.5 pr-3">
                    {it.achievedLevel}
                    {it.achievedLevel === it.lastYearLevel && (
                      <span className="ml-1 text-[var(--muted)]">นิ่ง</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">{it.targetLevel}</td>
                  <td className="py-1.5 pr-3 text-[var(--ink2)]">{progressPercent(it)}%</td>
                  <td className="py-1.5 pr-3 font-medium" style={{ color: "var(--accent2)" }}>
                    {verifiedPercent(it, SEED.evidence)}%
                  </td>
                  <td className="py-1.5" style={{ color: v.color }} title={s.reason}>
                    {v.glyph} {v.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        ⚠ คอลัมน์ Suggestion มาจากกฎในโค้ด ไม่ใช่ผลจากโมเดล · เลื่อนเมาส์ทับเพื่อดูเหตุผลที่กฎยิง
      </p>

      <h2 className="mt-8 text-[15px] font-semibold">แจ้งเตือนทั้งหมด ({alerts.length})</h2>
      <ul className="mt-2 space-y-1 text-[13px]">
        {alerts.map((a, i) => (
          <li key={i} className="flex flex-wrap gap-2 border-b border-[var(--line)] py-1.5">
            <span className="w-[92px] shrink-0 text-[var(--muted)]">{a.rule}</span>
            <span className="w-[80px] shrink-0 font-medium">{a.verb}</span>
            <span className="flex-1 min-w-[240px]">{a.head} — {a.body}</span>
            <span className="shrink-0 text-[var(--muted)]">
              {a.toOwner ? "เจ้าของ" : <b className="text-[var(--late)]">ไม่มีผู้รับ</b>}
              {a.toModerator && " + moderator"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
