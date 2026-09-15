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
        <h1 className="text-xl font-semibold">แจ้งเตือน / Outbox</h1>
        <Card className="mt-4">
          <p className="text-[15px] font-semibold">ผู้บริหารไม่รับแจ้งเตือนรายรายการ</p>
          <p className="mt-2 text-[13px] text-[var(--ink2)]">
            ตั้งใจออกแบบไว้อย่างนี้ — ช่องทางที่ส่งทุกเรื่องถึงทุกคนจะถูกเลิกอ่านภายในสัปดาห์เดียว
            ผู้บริหารอ่านภาพรวมที่ <Link href="/" className="underline">หน้าแรก</Link> และ{" "}
            <Link href="/trend" className="underline">หน้าแนวโน้ม</Link> แทน
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
      <h1 className="text-xl font-semibold">แจ้งเตือน / Outbox</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink2)]">
        โค้ดคำนวณจากกำหนดส่ง · วันที่เอกสาร · แผนงาน · ประวัติการเลื่อน —{" "}
        <b>โมเดลไม่ได้ตัดสินว่าอะไรเป็นปัญหา</b> · ระบบ<b>ร่าง</b>ข้อความ <b>คนกดส่งเอง</b>
      </p>

      <Card tone="warn" className="mt-4">
        <p className="text-[13.5px] font-bold">
          {isMod ? "คิวของผู้ดูแล (ทีมกลาง)" : `ถึงกองของคุณ`} — {v.alerts.length} ฉบับ
          {urgent > 0 && <span style={{ color: "var(--danger)" }}> · ด่วน {urgent}</span>}
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--ink2)]">
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
        <p className="mt-1 text-[12.5px] text-[var(--ink2)]">
          กติกายกระดับ: ครั้งที่ 1 แจ้งให้ทราบ → ครั้งที่ 2 ขอข้อมูลเพิ่ม → ครั้งที่{" "}
          {v.settings.slip_escalate_after} ยกให้ผู้ดูแล <b>พร้อมประวัติทั้งหมด</b>
        </p>
      </Card>

      <section className="mt-4">
        <h2 className="text-[14px] font-semibold">รายการแจ้งเตือน</h2>
        {v.alerts.length === 0 ? (
          <div className="mt-2"><Empty>ไม่มีรายการค้าง</Empty></div>
        ) : (
          <ul className="mt-2 space-y-2">
            {v.alerts.map((a, i) => {
              const vb = VERB[a.verb];
              const item = v.items.find((x) => x.code === a.itemCode)!;
              return (
                <li key={i}>
                  <Card tone={a.verb === "ESCALATE" ? "danger" : undefined}>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-[11.5px] text-[var(--muted)]">{a.rule}</code>
                      <Chip glyph={vb.glyph} label={vb.label} color={vb.color} />
                      <b className="text-[13.5px]">{a.head}</b>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--ink2)]">{a.body}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      ถึง:{" "}
                      {a.toOwner
                        ? v.users.find((x) => x.id === a.toOwner)?.title
                        : <b style={{ color: "var(--warn)" }}>ไม่มีผู้รับ — รายการนี้ไม่มีเจ้าของในระบบ</b>}
                      {a.toModerator && " · + ผู้ดูแล"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/item/${a.itemCode}`}
                        className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[12.5px]"
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

      <section className="mt-5">
        <h2 className="text-[14px] font-semibold">📤 Outbox — ร่างข้อความ ({v.outbox.length})</h2>
        {v.outbox.length === 0 ? (
          <div className="mt-2">
            <Empty>
              {hasAbility(u.role, "draft_outbox")
                ? "ยังไม่มีร่างข้อความ — กด “ร่างข้อความ” จากรายการด้านบน"
                : "ยังไม่มีร่างข้อความ — ผู้ดูแลเป็นผู้ร่างและกดส่ง"}
            </Empty>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {v.outbox.map((m) => (
              <li key={m.id}>
                <Card tone={m.sentAt ? "ok" : undefined}>
                  <p className="text-[13px]">
                    <b>ถึง {v.users.find((x) => x.id === m.toDisplay)?.title ?? m.toDisplay}</b>{" "}
                    <code className="text-[11.5px] text-[var(--muted)]">{m.alertRule} · {m.itemCode}</code>
                    {m.sentAt && (
                      <span className="ml-2 text-[12px]" style={{ color: "var(--accent)" }}>
                        ✓ กดส่งแล้วโดย {m.sentBy}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[13px] font-medium">{m.subject}</p>
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-[12.5px] text-[var(--ink2)]">{m.body}</pre>
                  {!m.sentAt && hasAbility(u.role, "send_outbox") && (
                    <div className="mt-2"><SendButton id={m.id} /></div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 rounded-md bg-[var(--page)] px-3 py-2 text-[12.5px] text-[var(--ink2)]">
          ⚠️ ต้นแบบนี้ <b>ไม่ส่งอีเมล / LINE / Teams จริง</b> — ในโปรเจกต์ไม่มี SMTP หรือ credential
          ของช่องทางใดอยู่เลย จึงส่งออกนอกเครื่องไม่ได้แม้จะอยากส่ง · และ<b>ไม่มีปุ่มส่งทั้งหมด</b>
        </p>
      </section>

      {hasAbility(u.role, "set_setting") && (
        <section className="mt-5">
          <h2 className="text-[14px] font-semibold">เกณฑ์ที่ปรับได้จากหน้าจอ</h2>
          <p className="text-[12.5px] text-[var(--muted)]">
            แก้แล้วผลมีทันที ไม่ต้องแก้โค้ด ไม่ต้องรีสตาร์ต — ลองลด “เตือนล่วงหน้า” ให้ต่ำกว่า{" "}
            {v.items.find((i) => !i.submittedThisCycle)?.daysToDue ?? 5} วัน แล้วดูแจ้งเตือนหายไป
          </p>
          <Card className="mt-2">
            <SettingField settingKey="alert_lead_days" label="เตือนล่วงหน้าก่อนกำหนดส่ง"
              value={v.settings.alert_lead_days} suffix="วัน" />
            <SettingField settingKey="slip_escalate_after" label="เลื่อนแผนกี่ครั้งจึงยกระดับ"
              value={v.settings.slip_escalate_after} suffix="ครั้ง" />
            <SettingField settingKey="evidence_stale_months" label="หลักฐานเก่ากว่ากี่เดือนถือว่าล้าสมัย"
              value={v.settings.evidence_stale_months} suffix="เดือน" />
          </Card>
        </section>
      )}
    </Shell>
  );
}
