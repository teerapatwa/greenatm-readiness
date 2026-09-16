import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { hasAbility } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { auditFor, evidenceRow, slipRows, snapshot } from "@/lib/db/queries";
import { buildAlerts } from "@/lib/data/rules";
import { Shell } from "@/components/Shell";
import {
  Card, Chip, EvidenceCard, GapChecklist, HistoryList, LevelSegments, MilestoneBars,
  StatusPill, ThreeColumnRule, VERB, VERDICT,
} from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import { ItemAdmin } from "@/components/ItemAdmin";
import { MilestoneEditor, SlipRow } from "@/components/MilestoneEditor";
import { EvidenceDelete } from "@/components/EvidenceDelete";
import {
  ConfirmCard, EvidenceDateForm, EvidenceForm, ProgressForm, TierActions,
} from "@/components/actions";

export const dynamic = "force-dynamic";

/**
 * รายละเอียดรายการ — โครง 3 คอลัมน์ตาม ITEM DETAIL ของไฟล์ทีม
 *   ซ้าย   ความคืบหน้า (milestone) + แก้แผนงาน / เลื่อนแผน
 *   กลาง   หลักฐานที่แนบ · ข้อเสนอจาก Agent
 *   ขวา    ยังขาดอะไร + Suggestion + ประวัติ
 * ของเรา (กติกาสามคอลัมน์ · การ์ดยืนยัน · แก้ข้อมูลรายการ) ต่อด้านล่างเต็มความกว้าง
 */
export default async function ItemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const u = await currentUser();
  const v = buildView(u);
  const item = v.items.find((i) => i.code === decodeURIComponent(code));
  if (!item) notFound();

  const ev = v.evidence.filter((e) => e.itemCode === item.code);
  const files = new Map(ev.map((e) => [e.id, evidenceRow(e.id)?.storedPath ?? null]));
  const owner = v.users.find((x) => x.id === item.ownerUserId);
  const div = v.divisions.find((d) => d.id === item.divisionId);
  const alerts = buildAlerts(snapshot()).filter((a) => a.itemCode === item.code);
  const history = auditFor("tracked_item", item.code).slice(0, 8);
  const slips = slipRows(item.code);
  const sug = VERDICT[item.suggestion.verdict];
  const pendingHere = v.pending.filter((p) => p.itemCode === item.code);
  const frontier = Math.min(5, item.achievedLevel + 1);
  const doneMs = item.milestones.filter((m) => m.percentComplete === 100).length;
  const canManage = hasAbility(u.role, "manage_item");
  const lastDone = [...item.milestones].reverse().find((m) => m.actualEnd);
  const cardTitle = { fontWeight: 700, fontSize: 13.5, color: "var(--ink)", marginBottom: 12 } as const;

  return (
    <Shell active="item">
      <div style={{ marginBottom: 14 }}>
        <ItemPicker
          items={v.items.map((i) => ({ code: i.code, name: i.name, category: i.category, canWrite: i.canWrite }))}
          current={item.code}
          ownerMode={u.role === "owner"}
          categories={v.categories}
        />
      </div>

      {u.role === "owner" && !item.canWrite && (
        <div className="ga-card-returned" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>
            403 — รายการนี้เป็นของ{div?.name} ไม่ใช่กองของคุณ
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 4 }}>
            ดูได้เพื่อความโปร่งใส แต่<b>ไม่มีปุ่มแก้ใด ๆ</b> และถ้ายิง{" "}
            <code>POST /api/items/{item.code}/progress</code> ตรง backend จะตอบ <b>403</b> —
            สิทธิ์อยู่ในโค้ดฝั่งเซิร์ฟเวอร์ ไม่ใช่การซ่อนปุ่ม
          </div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div className="ga-h1">{item.code} · {item.name}</div>
        <div className="ga-sub">
          หมวด {item.category} · {div?.name} · ผู้รับผิดชอบ{" "}
          <b>{owner?.title ?? "— ยังไม่มอบหมาย —"}</b> · อัปเดตล่าสุด {item.lastUpdated}
          {" · "}
          <StatusPill status={item.status}
            title={`ควรคืบหน้าตามปฏิทิน ${item.expected}% · ทำได้ ${item.progress}%`} />
          {!item.submittedThisCycle && (
            <b style={{ color: "var(--danger)" }}> · ยังไม่ส่งข้อมูลรอบนี้</b>
          )}
        </div>
      </div>

      <div className="ga-3col" style={{
        display: "grid", gridTemplateColumns: "1fr 1.3fr .9fr", gap: 16, alignItems: "start",
      }}>
        {/* ── ซ้าย: ความคืบหน้า (milestone) ── */}
        <Card pad="18px">
          <div style={cardTitle}>
            ความคืบหน้า (milestone) · {doneMs}/{item.milestones.length || "—"}
          </div>
          <MilestoneBars milestones={item.milestones} today={v.meta.today} />

          <div className="ga-divider" style={{ fontSize: 12.5, color: "var(--ink2)" }}>
            {lastDone ? (
              <>
                วันที่จริงที่เสร็จ: <b style={{ color: "var(--ink)" }}>{lastDone.actualEnd}</b>
                {" · แผนเดิม: "}{lastDone.plannedEnd}
                {lastDone.actualEnd! < lastDone.plannedEnd
                  ? " (ก่อนแผน)"
                  : lastDone.actualEnd! > lastDone.plannedEnd ? " (ช้ากว่าแผน)" : " (ตรงแผน)"}
              </>
            ) : (
              <>
                ยังไม่มีขั้นใดเสร็จสมบูรณ์ · ตามปฏิทินควรคืบหน้าแล้ว{" "}
                <b style={{ color: "var(--ink)" }}>{item.expected}%</b> ทำได้ {item.progress}%
              </>
            )}
          </div>

          {item.canWrite && (
            <div className="ga-divider">
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 10 }}>
                แก้แผนงาน
              </div>
              <MilestoneEditor
                code={item.code}
                milestones={item.milestones.map((m) => ({
                  seq: m.seq, name: m.name, plannedStart: m.plannedStart,
                  plannedEnd: m.plannedEnd, percentComplete: m.percentComplete,
                }))}
                escalateAfter={v.settings.slip_escalate_after}
                slipCount={slips.length}
                today={v.meta.today}
                canDeleteSlip={canManage}
              />
            </div>
          )}
        </Card>

        {/* ── กลาง: หลักฐาน ── */}
        <Card pad="18px">
          <div style={cardTitle}>หลักฐานที่แนบ · ข้อเสนอจาก Agent ({ev.length})</div>
          {ev.length === 0 ? (
            <p style={{
              border: "1px dashed var(--line)", borderRadius: 10, padding: "20px 12px",
              textAlign: "center", fontSize: 13, color: "var(--muted)", margin: 0,
            }}>
              ยังไม่มีหลักฐานแนบ — ระดับนี้จึงยังพิสูจน์ไม่ได้
            </p>
          ) : (
            ev.map((e) => (
              <EvidenceCard key={e.id} e={e} hasFile={files.get(e.id) !== null}>
                {!e.documentDate && item.canWrite && <EvidenceDateForm evidenceId={e.id} />}
                {hasAbility(u.role, "confirm_tier") ? (
                  <>
                    <TierActions evidenceId={e.id} proposedTier={e.proposedTier} />
                    <EvidenceDelete evidenceId={e.id} title={e.title} />
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                    {u.role === "owner"
                      ? "รอทีมกลางยืนยันชั้น — เจ้าของข้อมูลยืนยันเองไม่ได้"
                      : "ผู้บริหารไม่ยืนยันชั้นหลักฐาน"}
                  </p>
                )}
              </EvidenceCard>
            ))
          )}

          {item.canWrite && (
            <div className="ga-divider">
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 10 }}>
                แนบหลักฐานเพิ่ม
              </div>
              <EvidenceForm itemCode={item.code} />
            </div>
          )}
        </Card>

        {/* ── ขวา: ยังขาดอะไร + ประวัติ ── */}
        <Card pad="18px">
          <div style={cardTitle}>ยังขาดอะไร</div>
          <GapChecklist gaps={item.gaps} />

          <div className="ga-divider">
            <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", marginBottom: 8 }}>
              Suggestion จาก agent
            </div>
            <Chip glyph={sug.glyph} label={sug.label} color={sug.color} />
            <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12.5, color: "var(--ink2)" }}>
              {item.suggestion.reason}
            </p>
          </div>

          <div className="ga-divider">
            <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", marginBottom: 8 }}>
              ประวัติ
            </div>
            <HistoryList rows={history} />
            <p style={{ fontSize: 11, color: "var(--muted2)", marginTop: 8, marginBottom: 0 }}>
              <code>actor</code> เป็น user id เสมอ — ฐานข้อมูลมี CHECK ห้ามค่า <code>ai</code>
            </p>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14.5, marginBottom: 14 }}>
            กติกาหัวใจ — สามคอลัมน์ที่ห้ามรวมกัน
          </div>
          <ThreeColumnRule
            progress={item.progress}
            milestoneDone={doneMs}
            milestoneTotal={item.milestones.length}
            evidence={ev}
            verified={item.verified}
          />
        </Card>
      </div>

      {pendingHere.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {pendingHere.map((p) => <ConfirmCard key={p.id} pending={p} />)}
        </div>
      )}

      {item.canWrite && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <div style={cardTitle}>อัปเดตความคืบหน้า</div>
            <ProgressForm
              itemCode={item.code}
              milestones={item.milestones.map((m) => ({
                seq: m.seq, name: m.name, percentComplete: m.percentComplete,
              }))}
              percentWithinNextLevel={item.percentWithinNextLevel}
              frontierLevel={frontier}
            />
          </Card>
        </div>
      )}

      <div className="ga-2col" style={{
        marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
      }}>
        <Card>
          <div style={cardTitle}>ประวัติการเลื่อนแผน ({slips.length})</div>
          {slips.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>ไม่เคยเลื่อนแผน</p>
          ) : (
            <>
              {slips.map((sp, i) => (
                <SlipRow key={sp.id} code={item.code} slip={sp} index={i} total={slips.length}
                  escalateAfter={v.settings.slip_escalate_after} canDelete={canManage} />
              ))}
              {slips.length >= v.settings.slip_escalate_after &&
                new Set(slips.map((x) => x.reason)).size === 1 && (
                  <p style={{
                    marginTop: 8, marginBottom: 0, fontSize: 12.5,
                    fontWeight: 600, color: "var(--danger)",
                  }}>
                    ⛔ เหตุผลเดิมทุกครั้ง — นี่คือปัญหาเชิงโครงสร้าง ต้องการการตัดสินใจหรือทรัพยากร
                    ไม่ใช่การเร่งงาน
                  </p>
                )}
            </>
          )}

          <div className="ga-divider">
            <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", marginBottom: 8 }}>
              ระดับและความเร็ว
            </div>
            <LevelSegments achieved={item.achievedLevel} percentWithinNext={item.percentWithinNextLevel} />
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12.5, color: "var(--ink2)" }}>
              ปีที่แล้ว {item.lastYearLevel} · ตอนนี้ {item.achievedLevel} · เป้า {item.targetLevel}
              {item.achievedLevel < 5
                ? <> · งานของระดับ {frontier} ทำได้ {item.percentWithinNextLevel}%</>
                : <> · ระดับสูงสุดแล้ว</>}
              <br />ความเร็ว {item.velocity > 0 ? "+" : ""}{item.velocity.toFixed(2)} ระดับ/ปี
            </p>
          </div>
        </Card>

        <Card>
          <div style={cardTitle}>แจ้งเตือนของรายการนี้ ({alerts.length})</div>
          {alerts.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>ไม่มี</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.map((a, i) => {
                const vb = VERB[a.verb];
                return (
                  <div key={i} style={{ fontSize: 13 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <code style={{ fontSize: 11.5, color: "var(--muted2)" }}>{a.rule}</code>
                      <Chip glyph={vb.glyph} label={vb.label} color={vb.color} />
                    </div>
                    <div style={{ marginTop: 2 }}>{a.head}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      ถึง:{" "}
                      {a.toOwner
                        ? v.users.find((x) => x.id === a.toOwner)?.title
                        : <b style={{ color: "var(--warn-ink)" }}>ไม่มีผู้รับ — รายการนี้ไม่มีเจ้าของในระบบ</b>}
                      {a.toModerator && " · + ผู้ดูแล"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {(canManage || hasAbility(u.role, "set_target_level")) && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14.5, marginBottom: 12 }}>
              แก้ข้อมูลของรายการนี้
            </div>
            <ItemAdmin
              code={item.code}
              name={item.name}
              ownerUserId={item.ownerUserId}
              achievedLevel={item.achievedLevel}
              targetLevel={item.targetLevel}
              lastYearLevel={item.lastYearLevel}
              canManage={canManage}
              canSetTarget={hasAbility(u.role, "set_target_level")}
              hasConfirmedEvidence={ev.some((e) => e.confirmedTier === "A" || e.confirmedTier === "B")}
              confirmedCount={ev.filter((e) => e.confirmedTier === "A" || e.confirmedTier === "B").length}
              evidenceCount={ev.length}
              candidates={v.users
                .filter((x) => x.role === "owner" && x.divisionId === item.divisionId)
                .map((x) => ({ id: x.id, title: x.title }))}
            />
          </Card>
        </div>
      )}
    </Shell>
  );
}
