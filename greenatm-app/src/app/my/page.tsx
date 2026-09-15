import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee, profileFor } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { Forbidden, Shell } from "@/components/Shell";
import { Card, Chip, LevelSegments, MilestoneStrip, StatusPill, VERDICT } from "@/components/ui";
import { ConfirmCard } from "@/components/actions";

export const dynamic = "force-dynamic";

/**
 * งานของฉัน — โครงตาม MY TASKS ของไฟล์ทีม
 * ของทีม 4 คอลัมน์: รายการ · กำหนดส่ง · สถานะ · การดำเนินการ
 * ที่เราเพิ่ม: คอลัมน์ Suggestion แทรกก่อนการดำเนินการ
 *
 * ส่วน "รายการที่ถูกตีกลับ" ของไฟล์ทีม **ยังไม่แสดง** เพราะลูปตีกลับ (M4) ไม่ได้ทำ
 * — ไม่มีข้อมูลจริงก็ไม่ใส่ตัวอย่างค้างไว้บนหน้าจอ
 */
const GRID = "2fr .8fr .9fr 1.8fr 1.3fr";

export default async function MyPage() {
  const u = await currentUser();
  if (!canSee(u.role, "my")) {
    return (
      <Shell active="my">
        <Forbidden roleLabel={profileFor(u.role).label}
          what="เข้าหน้า “งานของฉัน” — หน้านี้เป็นของเจ้าของข้อมูลรายกอง" />
      </Shell>
    );
  }

  const v = buildView(u);
  const mine = v.myItems;
  const div = v.divisions.find((d) => d.id === u.divisionId);
  const notSubmitted = mine.filter((i) => !i.submittedThisCycle);

  return (
    <Shell active="my">
      <div style={{ marginBottom: 18 }}>
        <div className="ga-h1">งานของฉัน</div>
        <div className="ga-sub">
          {div?.name} · {u.title} · รอบปัจจุบัน: {v.meta.cycle} · กำหนดส่ง {v.meta.cycleDue}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          แสดง <b>{mine.length} รายการของกองคุณ</b> — อีก {v.items.length - mine.length} รายการเป็นของกองอื่น
          เปิดดูได้แต่แก้ไม่ได้
        </div>
      </div>

      {notSubmitted.length > 0 && (
        <div className="ga-banner-warn" style={{ marginBottom: 20 }}>
          มี {notSubmitted.length} รายการที่ยังไม่ส่งข้อมูลรอบนี้ — กำหนดส่ง {v.meta.cycleDue}
          {" (เหลือ "}{notSubmitted[0].daysToDue} วัน) · {notSubmitted.map((i) => i.code).join(" · ")}
        </div>
      )}

      {v.pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            รอคุณยืนยัน ({v.pending.length})
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
            ค่าจริงยังไม่เปลี่ยนจนกว่าคุณจะกด — ระบบและ agent ร่างได้ แต่เขียนเองไม่ได้
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {v.pending.map((p) => <ConfirmCard key={p.id} pending={p} />)}
          </div>
        </div>
      )}

      <div style={{
        background: "var(--card)", border: "1px solid var(--line)",
        borderRadius: 12, overflow: "hidden", marginBottom: 20,
      }}>
        <div className="ga-row-head" style={{ display: "grid", gridTemplateColumns: GRID, gap: 8 }}>
          <div>รายการ</div>
          <div>กำหนดส่ง</div>
          <div>สถานะ</div>
          <div>Suggestion จาก agent</div>
          <div>การดำเนินการ</div>
        </div>

        {mine.length === 0 ? (
          <div style={{ padding: "24px 18px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            กองของคุณไม่มีรายการในรอบนี้
          </div>
        ) : mine.map((i) => {
          const s = VERDICT[i.suggestion.verdict];
          return (
            <div key={i.code} className="ga-row"
              style={{ display: "grid", gridTemplateColumns: GRID, gap: 8 }}>
              <div>
                <Link href={`/item/${i.code}`}><b>{i.code}</b></Link> {i.name}
                <div style={{ fontSize: 11.5, color: "var(--muted2)", marginTop: 3 }}>
                  หลักฐาน {i.evidenceCount} · ยืนยันด้วยหลักฐาน {i.verified}%
                  {i.slipHistory.length > 0 && ` · เลื่อนแผน ${i.slipHistory.length} ครั้ง`}
                </div>
                <div style={{ marginTop: 4 }}>
                  <MilestoneStrip milestones={i.milestones} today={v.meta.today} />
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>
                {i.dueDate}
                {!i.submittedThisCycle && (
                  <div style={{
                    fontSize: 11.5,
                    color: i.daysToDue < 0 ? "var(--danger)" : "var(--warn-ink)",
                  }}>
                    {i.daysToDue < 0 ? `เลย ${-i.daysToDue} วัน` : `เหลือ ${i.daysToDue} วัน`}
                  </div>
                )}
              </div>

              <div>
                <StatusPill status={i.status}
                  title={`ตามปฏิทินควรคืบหน้า ${i.expected}% · ทำได้ ${i.progress}%`} />
                <div style={{ marginTop: 5 }}>
                  <LevelSegments achieved={i.achievedLevel} percentWithinNext={i.percentWithinNextLevel} />
                </div>
              </div>

              <div>
                <Chip glyph={s.glyph} label={s.label} color={s.color} />
                <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 5 }}>
                  {i.suggestion.reason}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/item/${i.code}`} className="ga-btn ga-btn-grey"
                  style={{ textDecoration: "none" }}>
                  กรอกข้อมูล
                </Link>
                <Link href={`/item/${i.code}`} className="ga-btn ga-btn-soft"
                  style={{ textDecoration: "none" }}>
                  แนบหลักฐาน
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          เกณฑ์ที่ใช้ตัดสิน Suggestion และสถานะ
        </summary>
        <div style={{ marginTop: 10 }}>
          <Card>
            <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 2 }}>
              <div><Chip {...VERDICT.needsfix} /> ไม่มีหลักฐานชั้น A/B ที่ยืนยันแล้ว — <b>ตรวจก่อนทุกเงื่อนไข</b></div>
              <div><Chip {...VERDICT.complete} /> ถึงเป้า <b>และ</b> มีหลักฐานยืนยันรองรับ</div>
              <div><Chip {...VERDICT.nearly} /> ความคืบหน้าในระดับถัดไป ≥ 80%</div>
              <div><Chip {...VERDICT.asked} /> มีเอกสารที่ยังไม่มีวันที่ในตัวเอกสาร</div>
              <div><Chip {...VERDICT.onplan} /> ไม่มีข้อกังวล</div>
              <div>
                <Chip {...VERDICT.escalate} /> เลื่อนแผน ≥ {v.settings.slip_escalate_after} ครั้ง —{" "}
                <b>ต่อท้ายเสมอ ไม่ให้การวินิจฉัยอื่นกลบ</b>
              </div>
            </div>

            <div className="ga-divider" style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 2 }}>
              <div><StatusPill status="delayed" /> มีขั้นเลยวันแผนแล้วยังไม่ 100% หรือเลยกำหนดส่งแล้วยังไม่ส่ง</div>
              <div>
                <StatusPill status="at_risk" /> ตามหลังปฏิทินเกิน{" "}
                <b>{v.settings.at_risk_threshold_points} จุด</b> — เกณฑ์นี้แก้ได้ที่หน้าแจ้งเตือน
              </div>
              <div><StatusPill status="on_track" /> นอกนั้น</div>
            </div>

            <p style={{
              marginTop: 10, marginBottom: 0, background: "var(--fill)", borderRadius: 8,
              padding: "8px 10px", fontSize: 12, color: "var(--ink2)",
            }}>
              ลำดับการตรวจ <b>หลักฐานมาก่อนเป้า</b> — ถ้าตรวจเป้าก่อน รายการที่ถึงระดับ 5 แต่ไม่มีหลักฐานเลย
              จะขึ้นว่า “เสร็จสมบูรณ์” ซึ่งขัดกับกฎข้อแรกของทั้งระบบ
              <br />
              ⚠️ วันนี้ Suggestion มาจาก<b>กฎในโค้ด ไม่ใช่โมเดล</b> — agent จะมาช่วยเรียบเรียงถ้อยคำในขั้นถัดไป
            </p>
          </Card>
        </div>
      </details>
    </Shell>
  );
}
