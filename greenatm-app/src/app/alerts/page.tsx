import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee, hasAbility, profileFor } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { Shell } from "@/components/Shell";
import { Card, Chip, Empty, VERB } from "@/components/ui";
import { DraftAlertButton, SendButton, SettingField } from "@/components/actions";

export const dynamic = "force-dynamic";

/** แจ้งเตือน + Outbox — ระบบร่าง คนกดส่ง */
export default async function AlertsPage() {
  const u = await currentUser();
  const p = profileFor(u.role);

  if (!canSee(u.role, "alerts")) {
    return (
      <Shell active="alerts">
        <h1 className="ga-h1">แจ้งเตือน / Outbox</h1>
        <Card style={{ marginTop: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>ผู้บริหารไม่รับแจ้งเตือนรายรายการ</p>
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--ink2)" }}>
            ตั้งใจออกแบบไว้อย่างนี้ — ช่องทางที่ส่งทุกเรื่องถึงทุกคนจะถูกเลิกอ่านภายในสัปดาห์เดียว
            ผู้บริหารอ่านภาพรวมที่ <Link href="/" >หน้าแรก</Link> และ{" "}
            <Link href="/trend" >หน้าแนวโน้ม</Link> แทน
          </p>
        </Card>
      </Shell>
    );
  }

  const v = buildView(u);
  const isMod = u.role === "central";
  const counts = v.allAlertCounts;
  const urgent = v.alerts.filter((a) => a.verb === "ESCALATE").length;

  return (
    <Shell active="alerts">
      <h1 className="ga-h1">แจ้งเตือน / Outbox</h1>
      <p className="ga-sub">
        โค้ดคำนวณจากกำหนดส่ง · วันที่เอกสาร · แผนงาน · ประวัติการเลื่อน —{" "}
        <b>โมเดลไม่ได้ตัดสินว่าอะไรเป็นปัญหา</b> · ระบบ<b>ร่าง</b>ข้อความ <b>คนกดส่งเอง</b>
      </p>

      <Card tone="warn" style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700 }}>
          {isMod ? "คิวของผู้ดูแล (ทีมกลาง)" : `ถึงกองของคุณ`} — {v.alerts.length} ฉบับ
          {urgent > 0 && <span style={{ color: "var(--danger)" }}> · ด่วน {urgent}</span>}
        </p>
        <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink2)" }}>
          {isMod ? (
            <>
              ผู้ดูแลได้รับ <b>{counts.moderator}</b> จากทั้งหมด{" "}
              <b>{counts.moderator + counts.ownerTotal}</b> ฉบับ — เรื่องหลักฐานรายเอกสาร
              ไม่ถูกส่งต่อมาที่นี่ <b>เพื่อไม่ให้คิวล้น</b> · ผู้บริหารได้ {counts.executive} ฉบับ
            </>
          ) : (
            <>เห็นเฉพาะแจ้งเตือนของรายการในกองคุณ — เรื่องกองอื่นไม่ถูกส่งมาที่นี่</>
          )}
        </p>
        <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink2)" }}>
          กติกายกระดับ: ครั้งที่ 1 แจ้งให้ทราบ → ครั้งที่ 2 ขอข้อมูลเพิ่ม → ครั้งที่{" "}
          {v.settings.slip_escalate_after} ยกให้ผู้ดูแล <b>พร้อมประวัติทั้งหมด</b>
        </p>
      </Card>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>รายการแจ้งเตือน</h2>
        {v.alerts.length === 0 ? (
          <div style={{ marginTop: 8 }}><Empty>ไม่มีรายการค้าง</Empty></div>
        ) : (
          <ul style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0 }}>
            {v.alerts.map((a, i) => {
              const vb = VERB[a.verb];
              const item = v.items.find((x) => x.code === a.itemCode)!;
              return (
                <li key={i}>
                  <Card tone={a.verb === "ESCALATE" ? "danger" : undefined}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <code style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.rule}</code>
                      <Chip glyph={vb.glyph} label={vb.label} color={vb.color} />
                      <b className="text-[13.5px]">{a.head}</b>
                    </div>
                    <p className="ga-sub">{a.body}</p>
                    <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                      ถึง:{" "}
                      {a.toOwner
                        ? v.users.find((x) => x.id === a.toOwner)?.title
                        : <b style={{ color: "var(--warn)" }}>ไม่มีผู้รับ — รายการนี้ไม่มีเจ้าของในระบบ</b>}
                      {a.toModerator && " · + ผู้ดูแล"}
                    </p>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <Link
                        href={`/item/${a.itemCode}`}
                        className="ga-btn ga-btn-grey" style={{ textDecoration: "none" }}
                      >
                        เปิดรายการ {a.itemCode}
                      </Link>
                      {hasAbility(u.role, "draft_outbox") && <DraftAlertButton alert={a} />}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>📤 Outbox — ร่างข้อความ ({v.outbox.length})</h2>
        {v.outbox.length === 0 ? (
          <div style={{ marginTop: 8 }}>
            <Empty>
              {hasAbility(u.role, "draft_outbox")
                ? "ยังไม่มีร่างข้อความ — กด “ร่างข้อความ” จากรายการด้านบน"
                : "ยังไม่มีร่างข้อความ — ผู้ดูแลเป็นผู้ร่างและกดส่ง"}
            </Empty>
          </div>
        ) : (
          <ul style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0 }}>
            {v.outbox.map((m) => (
              <li key={m.id}>
                <Card tone={m.sentAt ? "ok" : undefined}>
                  <p style={{ fontSize: 13 }}>
                    <b>ถึง {v.users.find((x) => x.id === m.toDisplay)?.title ?? m.toDisplay}</b>{" "}
                    <code style={{ fontSize: 11.5, color: "var(--muted)" }}>{m.alertRule} · {m.itemCode}</code>
                    {m.sentAt && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--accent)" }}>
                        ✓ กดส่งแล้วโดย {m.sentBy}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[13px] font-medium">{m.subject}</p>
                  <pre style={{ marginTop: 4, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, color: "var(--ink2)" }}>{m.body}</pre>
                  {!m.sentAt && hasAbility(u.role, "send_outbox") && (
                    <div style={{ marginTop: 8 }}><SendButton id={m.id} /></div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 8, background: "var(--fill)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "var(--ink2)" }}>
          ⚠️ ต้นแบบนี้ <b>ไม่ส่งอีเมล / LINE / Teams จริง</b> — ในโปรเจกต์ไม่มี SMTP หรือ credential
          ของช่องทางใดอยู่เลย จึงส่งออกนอกเครื่องไม่ได้แม้จะอยากส่ง · และ<b>ไม่มีปุ่มส่งทั้งหมด</b>
        </p>
      </section>

      {hasAbility(u.role, "set_setting") && (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>เกณฑ์ที่ปรับได้จากหน้าจอ</h2>
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
            แก้แล้วผลมีทันที ไม่ต้องแก้โค้ด ไม่ต้องรีสตาร์ต — ลองลด “เตือนล่วงหน้า” ให้ต่ำกว่า{" "}
            {v.items.find((i) => !i.submittedThisCycle)?.daysToDue ?? 5} วัน แล้วดูแจ้งเตือนหายไป
          </p>
          <Card style={{ marginTop: 8 }}>
            <SettingField settingKey="alert_lead_days" label="เตือนล่วงหน้าก่อนกำหนดส่ง"
              value={v.settings.alert_lead_days} suffix="วัน" />
            <SettingField settingKey="slip_escalate_after" label="เลื่อนแผนกี่ครั้งจึงยกระดับ"
              value={v.settings.slip_escalate_after} suffix="ครั้ง" />
            <SettingField settingKey="evidence_stale_months" label="หลักฐานเก่ากว่ากี่เดือนถือว่าล้าสมัย"
              value={v.settings.evidence_stale_months} suffix="เดือน" />
            <SettingField settingKey="at_risk_threshold_points" label="ตามหลังปฏิทินกี่จุดถือว่าเสี่ยง"
              value={v.settings.at_risk_threshold_points} suffix="จุด" />

            <div className="ga-divider">
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                ค่าที่ยังไม่มีผล — ผูกกับงานที่ยังไม่ได้ทำ
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.9 }}>
                <div>
                  <code>agent_max_tool_calls</code> = {v.settings.agent_max_tool_calls} ·{" "}
                  <code>agent_timeout_seconds</code> = {v.settings.agent_timeout_seconds}
                  <span style={{ color: "var(--warn-ink)", fontWeight: 600 }}>
                    {" "}← ยังไม่มีผล เพราะ agent loop (M3) ยังไม่เคยรันกับ endpoint จริง
                  </span>
                </div>
                <div>
                  <code>monthly_due_day</code> = {v.settings.monthly_due_day}
                  <span style={{ color: "var(--warn-ink)", fontWeight: 600 }}>
                    {" "}← ยังไม่มีผล เพราะเอกสารรอบเดือน (M5) ยังไม่ได้ทำ
                  </span>
                </div>
              </div>
              <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "var(--muted)" }}>
                แสดงแบบอ่านอย่างเดียวโดยเจตนา — <b>ช่องกรอกที่แก้แล้วไม่เกิดอะไร แย่กว่าไม่มีช่อง</b>
                เพราะอ่านเหมือนทำเสร็จแล้ว
              </p>
            </div>
          </Card>
        </section>
      )}
    </Shell>
  );
}
