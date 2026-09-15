import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { Forbidden, Shell } from "@/components/Shell";
import { Card, Chip, Empty, LevelSegments, MilestoneStrip, VERDICT } from "@/components/ui";
import { ConfirmCard } from "@/components/actions";

export const dynamic = "force-dynamic";

/** งานของฉัน — คอลัมน์ Suggestion คือเหตุผลที่หน้านี้มีอยู่ */
export default async function MyPage() {
  const u = await currentUser();
  if (!canSee(u.role, "my")) {
    return (
      <Shell active="my">
        <Forbidden roleLabel={u.role === "central" ? "ผู้ดูแล (ทีมกลาง)" : "ผู้บริหาร"}
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
      <h1 className="text-xl font-semibold">งานของฉัน</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink2)]">
        <b>{div?.name}</b> · {u.title} · {mine.length} รายการ · รอบ {v.meta.cycle} · กำหนดส่ง {v.meta.cycleDue}
      </p>
      <p className="mt-1 text-[12.5px] text-[var(--muted)]">
        หน้านี้แสดง<b>เฉพาะรายการของกองคุณ</b> — อีก {v.items.length - mine.length} รายการเป็นของกองอื่น
        เปิดดูได้แต่แก้ไม่ได้
      </p>

      {v.pending.length > 0 && (
        <section className="mt-4">
          <h2 className="text-[14px] font-semibold">รอคุณยืนยัน ({v.pending.length})</h2>
          <p className="text-[12.5px] text-[var(--muted)]">
            ค่าจริงยังไม่เปลี่ยนจนกว่าคุณจะกด — ระบบและ agent ร่างได้ แต่เขียนเองไม่ได้
          </p>
          <div className="mt-2 space-y-2">
            {v.pending.map((p) => <ConfirmCard key={p.id} pending={p} />)}
          </div>
        </section>
      )}

      {notSubmitted.length > 0 && (
        <Card tone="danger" className="mt-4">
          <p className="text-[13.5px] font-bold" style={{ color: "var(--danger)" }}>
            มี {notSubmitted.length} รายการที่ยังไม่ส่งข้อมูลรอบนี้
          </p>
          <p className="text-[12.5px] text-[var(--ink2)]">
            {notSubmitted.map((i) => i.code).join(" · ")} — เหลืออีก {notSubmitted[0].daysToDue} วันถึงกำหนด
          </p>
        </Card>
      )}

      {mine.length === 0 ? (
        <Empty>กองของคุณไม่มีรายการในรอบนี้</Empty>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--page)] text-left text-[12px] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">รายการ</th>
                <th className="px-3 py-2 font-medium">กำหนดส่ง</th>
                <th className="px-3 py-2 font-medium">ระดับ / แผนงาน</th>
                <th className="px-3 py-2 font-medium" style={{ width: "34%" }}>
                  Suggestion จาก agent
                </th>
                <th className="px-3 py-2 font-medium">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((i) => {
                const s = VERDICT[i.suggestion.verdict];
                return (
                  <tr key={i.code} className="border-t border-[var(--line)] align-top">
                    <td className="px-3 py-3">
                      <Link href={`/item/${i.code}`} className="font-semibold underline">{i.code}</Link>{" "}
                      {i.name}
                      <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                        หลักฐาน {i.evidenceCount} ฉบับ · ยืนยันด้วยหลักฐาน {i.verified}%
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[12.5px]">
                      {i.dueDate}
                      {!i.submittedThisCycle && (
                        <p className="text-[11.5px]" style={{ color: i.daysToDue < 0 ? "var(--danger)" : "var(--warn)" }}>
                          {i.daysToDue < 0 ? `เลย ${-i.daysToDue} วัน` : `เหลือ ${i.daysToDue} วัน`}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <LevelSegments achieved={i.achievedLevel} percentWithinNext={i.percentWithinNextLevel} />
                      <div className="mt-1.5"><MilestoneStrip milestones={i.milestones} today={v.meta.today} /></div>
                    </td>
                    <td className="px-3 py-3">
                      <Chip glyph={s.glyph} label={s.label} color={s.color} />
                      <p className="mt-1.5 text-[12.5px] text-[var(--ink2)]">{i.suggestion.reason}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/item/${i.code}`}
                        className="inline-block rounded-md bg-[var(--accent)] px-2.5 py-1 text-[12.5px] text-white"
                      >
                        เปิดเพื่ออัปเดต
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Card className="mt-4">
        <p className="text-[13px] font-semibold">เกณฑ์ที่ใช้ตัดสิน Suggestion</p>
        <ul className="mt-2 space-y-1 text-[12.5px] text-[var(--ink2)]">
          <li><Chip {...VERDICT.needsfix} /> ไม่มีหลักฐานชั้น A/B ที่ยืนยันแล้ว — <b>ตรวจก่อนทุกเงื่อนไข</b></li>
          <li><Chip {...VERDICT.complete} /> ถึงเป้า <b>และ</b> มีหลักฐานยืนยันรองรับ</li>
          <li><Chip {...VERDICT.nearly} /> ความคืบหน้าในระดับถัดไป ≥ 80%</li>
          <li><Chip {...VERDICT.asked} /> มีเอกสารที่ยังไม่มีวันที่ในตัวเอกสาร</li>
          <li><Chip {...VERDICT.onplan} /> ไม่มีข้อกังวล</li>
          <li>
            <Chip {...VERDICT.escalate} /> เลื่อนแผน ≥ {v.settings.slip_escalate_after} ครั้ง —{" "}
            <b>ต่อท้ายเสมอ ไม่ให้การวินิจฉัยอื่นกลบ</b>
          </li>
        </ul>
        <p className="mt-2.5 rounded-md bg-[var(--page)] px-2.5 py-2 text-[12px] text-[var(--ink2)]">
          ลำดับการตรวจ <b>หลักฐานมาก่อนเป้า</b> — ถ้าตรวจเป้าก่อน รายการที่ถึงระดับ 5 แต่ไม่มีหลักฐานเลย
          จะขึ้นว่า “เสร็จสมบูรณ์” ซึ่งขัดกับกฎข้อแรกของระบบทั้งระบบ
        </p>
        <p className="mt-2 text-[12px] text-[var(--muted)]">
          ⚠️ วันนี้ Suggestion มาจาก<b>กฎในโค้ด ไม่ใช่โมเดล</b> — agent จะมาช่วยเรียบเรียงถ้อยคำในขั้นถัดไป
          แต่การตัดสินว่าเข้าเงื่อนไขไหนยังอยู่ในโค้ด
        </p>
      </Card>
    </Shell>
  );
}
