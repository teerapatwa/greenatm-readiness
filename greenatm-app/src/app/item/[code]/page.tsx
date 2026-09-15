import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { hasAbility, profileFor } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { auditFor } from "@/lib/db/queries";
import { buildAlerts } from "@/lib/data/rules";
import { snapshot } from "@/lib/db/queries";
import { Shell } from "@/components/Shell";
import {
  Card, Chip, Empty, LevelDots, PairedFigures, SlipHistory, Timeline, TierChip, VERB, VERDICT,
} from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import {
  ConfirmCard, EvidenceDateForm, EvidenceForm, ProgressForm, TargetLevelField, TierActions,
} from "@/components/actions";

export const dynamic = "force-dynamic";

/** รายละเอียดรายการ — dropdown · timeline เต็ม · ประวัติการเลื่อน · หลักฐาน · 403 ถ้าไม่ใช่ของกอง */
export default async function ItemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const u = await currentUser();
  const v = buildView(u);
  const item = v.items.find((i) => i.code === decodeURIComponent(code));
  if (!item) notFound();

  const ev = v.evidence.filter((e) => e.itemCode === item.code);
  const owner = v.users.find((x) => x.id === item.ownerUserId);
  const alerts = buildAlerts(snapshot()).filter((a) => a.itemCode === item.code);
  const history = auditFor("tracked_item", item.code).slice(0, 6);
  const s = VERDICT[item.suggestion.verdict];
  const pendingHere = v.pending.filter((p) => p.itemCode === item.code);
  const frontier = Math.min(5, item.achievedLevel + 1);

  return (
    <Shell active="item">
      <ItemPicker
        items={v.items.map((i) => ({ code: i.code, name: i.name, category: i.category, canWrite: i.canWrite }))}
        current={item.code}
        ownerMode={u.role === "owner"}
        categories={v.categories}
      />

      {u.role === "owner" && !item.canWrite && (
        <div className="mt-3 rounded-lg border-2 p-4" style={{ borderColor: "var(--late)" }}>
          <p className="text-[15px] font-semibold" style={{ color: "var(--late)" }}>
            403 — รายการนี้เป็นของ{v.divisions.find((d) => d.id === item.divisionId)?.name} ไม่ใช่กองของคุณ
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--ink2)]">
            ดูได้เพื่อความโปร่งใส แต่<b>ไม่มีปุ่มแก้ใด ๆ</b> และถ้ายิง{" "}
            <code>POST /api/items/{item.code}/progress</code> ตรง backend จะตอบ <b>403</b> —
            สิทธิ์อยู่ในโค้ดฝั่งเซิร์ฟเวอร์ ไม่ใช่การซ่อนปุ่ม
          </p>
        </div>
      )}

      {u.role === "executive" && (
        <p className="mt-3 rounded-md bg-[var(--page)] px-3 py-2 text-[12.5px] text-[var(--ink2)]">
          มุมมองผู้บริหาร — <b>อ่านอย่างเดียว</b> ยกเว้นการตั้งเป้าระดับของปี
        </p>
      )}

      <h1 className="mt-4 text-xl font-semibold">{item.code} · {item.name}</h1>
      <p className="mt-1 text-[13px] text-[var(--ink2)]">
        หมวด {item.category} · {v.divisions.find((d) => d.id === item.divisionId)?.name} ·
        ผู้รับผิดชอบ <b>{owner?.title ?? "ไม่มีเจ้าของในระบบ"}</b>
        {!item.submittedThisCycle && (
          <span style={{ color: "var(--late)" }}> · ยังไม่ส่งข้อมูลรอบนี้</span>
        )}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="text-[13px] font-semibold">สองตัวเลขที่ระบบนี้ไม่ยอมรวมกัน</p>
          <div className="mt-2"><PairedFigures progress={item.progress} verified={item.verified} evidenceCount={ev.length} /></div>
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            ตัวเลขซ้าย<b>ดันตัวเลขขวาไม่ได้เลย</b> — ค่าขวาขยับเมื่อทีมกลางยืนยันหลักฐานชั้น A/B เท่านั้น
          </p>
        </Card>
        <Card>
          <p className="text-[12px] text-[var(--muted)]">ระดับที่ได้ / เป้าปีนี้</p>
          <div className="mt-1.5"><LevelDots achieved={item.achievedLevel} target={item.targetLevel} /></div>
          <p className="mt-2 text-[12.5px] text-[var(--ink2)]">
            ปีที่แล้ว {item.lastYearLevel} · ไประดับ {frontier} แล้ว {item.percentWithinNextLevel}%
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--ink2)]">
            คาดการณ์ 3 ปี <b>{(item.velocity > 0 ? Math.min(5, item.achievedLevel + item.percentWithinNextLevel / 100 + item.velocity * 3) : item.achievedLevel + item.percentWithinNextLevel / 100).toFixed(1)}</b>
            {" · "}ความเร็ว {item.velocity > 0 ? "+" : ""}{item.velocity.toFixed(2)}/ปี
          </p>
          {hasAbility(u.role, "set_target_level") && (
            <div className="mt-2.5 border-t border-[var(--line)] pt-2.5">
              <TargetLevelField itemCode={item.code} value={item.targetLevel} achieved={item.achievedLevel} />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-3">
        <p className="text-[13px] font-semibold">Suggestion จาก agent</p>
        <div className="mt-1.5"><Chip glyph={s.glyph} label={s.label} color={s.color} /></div>
        <p className="mt-2 text-[13.5px]">{item.suggestion.reason}</p>
      </Card>

      {pendingHere.length > 0 && (
        <div className="mt-3 space-y-2">
          {pendingHere.map((p) => <ConfirmCard key={p.id} pending={p} />)}
        </div>
      )}

      {item.canWrite && (
        <Card className="mt-3">
          <p className="text-[13px] font-semibold">อัปเดตความคืบหน้า</p>
          <div className="mt-2">
            <ProgressForm
              itemCode={item.code}
              milestones={item.milestones.map((m) => ({ seq: m.seq, name: m.name, percentComplete: m.percentComplete }))}
              percentWithinNextLevel={item.percentWithinNextLevel}
              frontierLevel={frontier}
            />
          </div>
        </Card>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <p className="text-[13px] font-semibold">Timeline แผนงาน</p>
          <div className="mt-2.5"><Timeline milestones={item.milestones} today={v.meta.today} /></div>
          <div className="mt-2 border-t border-[var(--line)] pt-2.5">
            <p className="text-[13px] font-semibold">ประวัติการเลื่อนแผน</p>
            <div className="mt-1.5">
              <SlipHistory item={item} escalateAfter={v.settings.slip_escalate_after} />
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-[13px] font-semibold">หลักฐานที่แนบ ({ev.length})</p>
          {ev.length === 0 ? (
            <div className="mt-2">
              <Empty>ยังไม่มีหลักฐานแนบ — ระดับนี้จึงยังพิสูจน์ไม่ได้</Empty>
            </div>
          ) : (
            <div className="mt-1.5">
              {ev.map((e) => (
                <div key={e.id} className="border-t border-[var(--line)] py-2.5 first:border-t-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TierChip tier={e.confirmedTier ?? e.proposedTier} confirmed={e.confirmedTier !== null} />
                    <code className="text-[11.5px] text-[var(--muted)]">{e.id}</code>
                  </div>
                  <p className="mt-1 text-[13.5px]">{e.title}</p>
                  <p className="text-[12px] text-[var(--ink2)]">
                    วันที่ในเอกสาร:{" "}
                    {e.documentDate ?? <b style={{ color: "var(--ret)" }}>ไม่พบในตัวเอกสาร — ระบบถาม ไม่เดาจากวันอัปโหลด</b>}
                  </p>
                  {e.proposedReason && (
                    <p className="mt-1 text-[12.5px] text-[var(--ink2)]">เหตุผลของ agent: {e.proposedReason}</p>
                  )}
                  {!e.documentDate && item.canWrite && <EvidenceDateForm evidenceId={e.id} />}
                  {hasAbility(u.role, "confirm_tier")
                    ? <TierActions evidenceId={e.id} proposedTier={e.proposedTier} />
                    : (
                      <p className="mt-1.5 text-[12px] text-[var(--muted)]">
                        {u.role === "owner"
                          ? "รอทีมกลางยืนยันชั้น — เจ้าของข้อมูลยืนยันเองไม่ได้"
                          : "ผู้บริหารไม่ยืนยันชั้นหลักฐาน"}
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}
          {item.canWrite && (
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <p className="text-[13px] font-semibold">แนบหลักฐานเพิ่ม</p>
              <div className="mt-2"><EvidenceForm itemCode={item.code} /></div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <p className="text-[13px] font-semibold">แจ้งเตือนของรายการนี้ ({alerts.length})</p>
          {alerts.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--muted)]">ไม่มี</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {alerts.map((a, i) => {
                const vb = VERB[a.verb];
                return (
                  <li key={i} className="text-[13px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <code className="text-[11.5px] text-[var(--muted)]">{a.rule}</code>
                      <Chip glyph={vb.glyph} label={vb.label} color={vb.color} />
                    </div>
                    <p className="mt-0.5">{a.head}</p>
                    <p className="text-[12px] text-[var(--muted)]">
                      ถึง: {a.toOwner ? v.users.find((x) => x.id === a.toOwner)?.title : <b style={{ color: "var(--warn)" }}>ไม่มีผู้รับ — รายการนี้ไม่มีเจ้าของในระบบ</b>}
                      {a.toModerator && " + ผู้ดูแล"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <p className="text-[13px] font-semibold">ประวัติการเปลี่ยนค่า (audit log)</p>
          {history.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--muted)]">ยังไม่มีการเปลี่ยนค่าในรายการนี้</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-[12.5px]">
              {history.map((h, i) => (
                <li key={i}>
                  <b>{h.action}</b> โดย <code>{h.actor}</code>
                  <span className="text-[var(--muted)]"> · {h.at.slice(0, 19).replace("T", " ")}</span>
                  <br />
                  <span className="text-[var(--ink2)]">{h.before} → {h.after}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            <code>actor</code> เป็น user id เสมอ — ฐานข้อมูลมี CHECK ห้ามค่า <code>ai</code> ในคอลัมน์นี้
          </p>
        </Card>
      </div>
    </Shell>
  );
}
