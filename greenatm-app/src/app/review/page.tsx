import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee, hasAbility, profileFor } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { auditCount } from "@/lib/db/queries";
import { Forbidden, Shell } from "@/components/Shell";
import { Card, StatusPill, TierChip, TierLegend } from "@/components/ui";
import { TierActions } from "@/components/actions";
import { ReviewTabs } from "@/components/ReviewTabs";
import { DemoTools } from "@/components/DemoTools";
import { OutboxCard } from "@/components/OutboxCard";

export const dynamic = "force-dynamic";

/**
 * ศูนย์ตรวจสอบ — โครงตาม REVIEW CENTER ของไฟล์ทีม
 * แท็บ pill พร้อมตัวนับ · แถวผลลัพธ์แบบ justify-content:space-between
 *
 * แท็บ "ร่างคำตอบรอตรวจ" ของไฟล์ทีม **ยังไม่มี** เพราะ M4/M5 ไม่ได้ทำ
 * แทนด้วย "ยังไม่มีหลักฐาน" ซึ่งมีข้อมูลจริงและเป็นเรื่องที่ต้องตัดสินใจจริง
 */
export default async function ReviewPage() {
  const u = await currentUser();
  if (!canSee(u.role, "review")) {
    return (
      <Shell active="review">
        <Forbidden roleLabel={profileFor(u.role).label}
          what="เข้าศูนย์ตรวจสอบ — หน้านี้เป็นของผู้ดูแล (ทีมกลาง)" />
      </Shell>
    );
  }

  const v = buildView(u);
  const queue = v.evidence.filter((e) => e.confirmedTier === null);
  const notSubmitted = v.items.filter((i) => !i.submittedThisCycle);
  const noEvidence = v.items.filter((i) => i.evidenceCount === 0);
  const unsent = v.outbox.filter((m) => !m.sentAt);
  const rowStyle = {
    background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10,
    padding: "14px 18px", display: "flex", justifyContent: "space-between",
    alignItems: "center", gap: 12, flexWrap: "wrap" as const,
  };

  return (
    <Shell active="review">
      <div style={{ marginBottom: 18 }}>
        <div className="ga-h1">ศูนย์ตรวจสอบ</div>
        <div className="ga-sub">
          {profileFor(u.role).label} — ยืนยันข้อเสนอของ agent, ติดตามกองที่ยังไม่ส่ง,
          ดูรายการที่ยังพิสูจน์ไม่ได้
        </div>
      </div>

      <div className="ga-banner-warn" style={{ marginBottom: 20 }}>
        ค่า Verified ทั้งองค์กรขยับจากหน้านี้ที่เดียว — agent เสนอได้ เจ้าของข้อมูลแนบหลักฐานได้
        แต่การยืนยันเป็นของ{profileFor(u.role).label} · ทุกการยืนยันบันทึกลง audit log
        (ปัจจุบัน {auditCount()} รายการ)
      </div>

      <ReviewTabs
        tabs={[
          { key: "tier", label: "รอยืนยันชั้นหลักฐาน", count: queue.length },
          { key: "notsub", label: "ยังไม่ส่ง", count: notSubmitted.length },
          { key: "noev", label: "ยังไม่มีหลักฐาน", count: noEvidence.length },
          { key: "outbox", label: "Outbox", count: unsent.length },
        ]}
        panels={{
          tier: queue.length === 0 ? (
            <div>
              <Empty>ไม่มีหลักฐานค้างรอยืนยัน</Empty>
              <div style={{ marginTop: 12 }}><TierLegend /></div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {queue.map((e) => (
                <div key={e.id} style={{
                  background: "var(--card)", border: "1px solid var(--line)",
                  borderRadius: 10, padding: "14px 18px",
                }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <Link href={`/item/${e.itemCode}`} style={{ fontWeight: 700, fontSize: 13 }}>
                      {e.itemCode}
                    </Link>
                    <TierChip tier={e.proposedTier} confirmed={false} />
                    <code style={{ fontSize: 11.5, color: "var(--muted2)" }}>{e.id}</code>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink2)" }}>
                    วันที่ในเอกสาร:{" "}
                    {e.documentDate ?? (
                      <b style={{ color: "var(--warn-ink)" }}>ไม่พบ — ต้องให้เจ้าของข้อมูลเติมก่อน</b>
                    )}
                  </div>
                  {e.proposedReason && (
                    <div style={{ marginTop: 6, fontSize: 12.5, color: "#3d4a43", lineHeight: 1.6 }}>
                      เหตุผลจาก Agent: {e.proposedReason}
                    </div>
                  )}
                  <TierActions evidenceId={e.id} proposedTier={e.proposedTier} />
                </div>
              ))}
              <div style={{ marginTop: 4 }}><TierLegend /></div>
            </div>
          ),

          notsub: notSubmitted.length === 0 ? (
            <Empty>ทุกกองส่งข้อมูลรอบนี้ครบแล้ว</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {notSubmitted.map((i) => (
                <div key={i.code} style={rowStyle}>
                  <div style={{ fontSize: 13 }}>
                    <Link href={`/item/${i.code}`}><b>{i.code}</b></Link> {i.name}
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {v.users.find((x) => x.id === i.ownerUserId)?.title ?? (
                        <b style={{ color: "var(--warn-ink)" }}>ไม่มีเจ้าของในระบบ — ไม่มีใครถูกเตือน</b>
                      )}
                      {" · "}
                      {i.daysToDue < 0 ? `เลยกำหนด ${-i.daysToDue} วัน` : `เหลือ ${i.daysToDue} วัน`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <StatusPill status={i.status} />
                    <Link href="/alerts" className="ga-btn ga-btn-grey" style={{ textDecoration: "none" }}>
                      สร้างร่างข้อความ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ),

          noev: (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
                รายการเหล่านี้จะเข้า “ทะเบียนหมายเหตุ” ท้ายเอกสารรอบเดือน — ไม่ถูกละไว้เงียบ ๆ
                <b> (เอกสารรอบเดือนยังไม่ได้ทำ — M5)</b>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {noEvidence.map((i) => (
                  <div key={i.code} style={rowStyle}>
                    <div style={{ fontSize: 13 }}>
                      <Link href={`/item/${i.code}`}><b>{i.code}</b></Link> {i.name}
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        ระดับ {i.achievedLevel} · เป้า {i.targetLevel}
                        {i.achievedLevel >= i.targetLevel && (
                          <b style={{ color: "var(--warn-ink)" }}> · ถึงเป้าแล้วแต่ไม่มีหลักฐานแม้ชิ้นเดียว</b>
                        )}
                      </div>
                    </div>
                    <StatusPill status={i.status} />
                  </div>
                ))}
              </div>
              {noEvidence.some((i) => i.achievedLevel >= i.targetLevel) && (
                <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5, color: "var(--warn-ink)" }}>
                  ⚠ มีรายการที่<b>ถึงเป้าแล้วแต่ไม่มีหลักฐาน</b> — Suggestion ของรายการเหล่านี้
                  ต้องไม่ขึ้นว่า “เสร็จสมบูรณ์” และในระบบนี้ไม่ขึ้น (AC-26)
                </p>
              )}
            </div>
          ),

          outbox: (
            <div>
              {v.outbox.length === 0 ? (
                <Empty>ยังไม่มีร่างข้อความ — ร่างได้จากหน้าแจ้งเตือน</Empty>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {v.outbox.map((m) => (
                    <OutboxCard
                      key={m.id}
                      m={m}
                      toTitle={v.users.find((x) => x.id === m.toDisplay)?.title ?? m.toDisplay}
                      canDraft={hasAbility(u.role, "draft_outbox")}
                      canSend={hasAbility(u.role, "send_outbox")}
                    />
                  ))}
                </div>
              )}
              <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5, color: "var(--ink2)" }}>
                ⚠️ ต้นแบบนี้ <b>ไม่ส่งอีเมล / LINE / Teams จริง</b> — ในโปรเจกต์ไม่มี credential
                ของช่องทางใดอยู่เลย · &ldquo;กดส่ง&rdquo; คือการบันทึกว่าคนตรวจแล้วและรับผิดชอบข้อความนี้
              </p>
            </div>
          ),
        }}
      />

      <div style={{ marginTop: 24 }}>
        <DemoTools />
      </div>
    </Shell>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      border: "1px dashed var(--line)", borderRadius: 10, padding: "22px 12px",
      textAlign: "center", fontSize: 13, color: "var(--muted)", margin: 0,
    }}>
      {children}
    </p>
  );
}
