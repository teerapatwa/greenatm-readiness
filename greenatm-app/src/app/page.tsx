import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { buildView } from "@/lib/view";
import { Shell } from "@/components/Shell";
import { Card, Chip, LevelDots, MilestoneStrip, VERDICT } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * หน้าแรก — ภาพรวมตามหมวดของ วว.นบ209
 *
 * ลำดับบนหน้าจอตั้งใจให้ "เรื่องที่ต้องตัดสินใจ" มาก่อนตัวเลขพาดหัว (FRONTEND §5.1)
 * และหัวข้อข่าวคือ **จำนวนรายการที่ไม่ขยับ** ไม่ใช่ค่าเฉลี่ยที่ดูดีขึ้น
 */
export default async function HomePage() {
  const u = await currentUser();
  const v = buildView(u);
  const today = v.meta.today;

  const decisions = [
    ...v.items.filter((i) => i.progress >= 67 && i.verified === 0 && i.evidenceCount === 0)
      .slice(0, 3)
      .map((i) => ({
        tone: "warn" as const, code: i.code,
        text: `งานคืบหน้า ${i.progress}% แต่ไม่มีหลักฐานที่นับได้เลย — ระดับที่ยืนยันยังเป็น 0`,
      })),
    ...v.items.filter((i) => i.slipHistory.length >= v.settings.slip_escalate_after)
      .map((i) => ({
        tone: "late" as const, code: i.code,
        text: `เลื่อนแผนครบ ${i.slipHistory.length} ครั้ง — ต้องการการตัดสินใจ ไม่ใช่การเร่ง`,
      })),
    ...(v.org.notSubmitted > 0
      ? [{
          tone: "warn" as const, code: "",
          text: `${v.org.notSubmitted} รายการยังไม่ส่งข้อมูลรอบนี้ · กำหนด ${v.meta.cycleDue}`,
        }]
      : []),
  ];

  return (
    <Shell active="home">
      <h1 className="text-xl font-semibold">หน้าแรก — ภาพรวมระดับ GreenATM ตามหมวด</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink2)]">
        {u.role === "owner"
          ? <>เห็นภาพรวมได้ทุกหมวด แต่<b>แก้ได้เฉพาะ {v.myItems.length} รายการของกองคุณ</b> (มีป้าย “ของกองคุณ”)</>
          : u.role === "central"
          ? <>เห็นและตรวจได้ทุกหมวด · ค่า Verified ขยับจากการยืนยันของบทบาทนี้เท่านั้น</>
          : <>มุมมองอ่านอย่างเดียว — ไม่มีปุ่มแก้ข้อมูลในทุกหน้า</>}
        {" · "}<b>กดที่แถวเพื่อดู timeline และรายละเอียด</b>
      </p>

      {decisions.length > 0 && (
        <Card tone="warn" className="mt-4">
          <p className="text-[13px] font-bold">📋 เรื่องที่ต้องตัดสินใจ — มาก่อนตัวเลขทุกตัว</p>
          <ul className="mt-2 space-y-1.5">
            {decisions.map((d, i) => (
              <li key={i} className="text-[13.5px]">
                <span aria-hidden style={{ color: `var(--${d.tone})` }}>
                  {d.tone === "late" ? "⛔" : "⚠"}
                </span>{" "}
                {d.code && (
                  <Link href={`/item/${d.code}`} className="font-semibold underline">
                    {d.code}
                  </Link>
                )}{" "}
                {d.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-[12px] text-[var(--muted)]">ไม่ขยับระดับเลยตั้งแต่ปีที่แล้ว</p>
          <p className="text-[26px] font-bold" style={{ color: "var(--warn)" }}>
            {v.org.stalled}<span className="text-[15px] text-[var(--muted)]">/{v.items.length}</span>
          </p>
          <p className="text-[11.5px] text-[var(--muted)]">นี่คือสิ่งที่ค้นพบ ค่าเฉลี่ยเป็นเพียงผลพวง</p>
        </Card>
        <Card>
          <p className="text-[12px] text-[var(--muted)]">ระดับเฉลี่ยทั้งองค์กร</p>
          <p className="text-[26px] font-bold">{v.org.meanNow.toFixed(2)}</p>
          <p className="text-[11.5px] text-[var(--muted)]">
            ปีที่แล้ว {v.org.meanLast.toFixed(2)} ·{" "}
            <b style={{ color: "var(--ok)" }}>+{(v.org.meanNow - v.org.meanLast).toFixed(2)}</b>
          </p>
        </Card>
        <Card>
          <p className="text-[12px] text-[var(--muted)]">ยังไม่ส่งรอบนี้</p>
          <p className="text-[26px] font-bold" style={{ color: "var(--late)" }}>{v.org.notSubmitted}</p>
          <p className="text-[11.5px] text-[var(--muted)]">กำหนด {v.meta.cycleDue}</p>
        </Card>
        <Card>
          <p className="text-[12px] text-[var(--muted)]">แจ้งเตือนถึงคุณ</p>
          <p className="text-[26px] font-bold">{v.alerts.length}</p>
          <p className="text-[11.5px] text-[var(--muted)]">
            {u.role === "executive"
              ? "ผู้บริหารไม่รับแจ้งเตือนรายรายการ"
              : `จากทั้งระบบ ${v.allAlertCounts.ownerTotal + v.allAlertCounts.moderator} ฉบับ`}
          </p>
        </Card>
      </div>

      {v.org.unowned > 0 && (
        <Card tone="warn" className="mt-4">
          <p className="text-[13.5px]">
            <b>{v.org.unowned} รายการไม่มีเจ้าของข้อมูลในระบบ</b> — และ{" "}
            <b>{v.allAlertCounts.orphan} ฉบับของแจ้งเตือนจึงไม่ถึงใครเลย</b>{" "}
            <span className="text-[var(--ink2)]">
              รายการที่ไม่มีเจ้าของ คือรายการที่ไม่มีใครมาอัปเดต — แสดงไว้ดีกว่ากลบด้วยผู้ใช้สมมติ
            </span>
          </p>
        </Card>
      )}

      {v.categories.map((c) => {
        const list = v.items.filter((i) => i.category === c.num);
        const div = v.divisions.find((d) => d.id === c.divisionId);
        const mean = list.reduce((s, i) => s + i.achievedLevel, 0) / (list.length || 1);
        return (
          <section key={c.num} className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-semibold">หมวด {c.num} · {c.name}</h2>
                <p className="text-[12.5px] text-[var(--ink2)]">
                  {list.length} รายการ · {div?.name}
                  {list.every((i) => !i.ownerUserId) && (
                    <b style={{ color: "var(--warn)" }}> · หมวดนี้ยังไม่มีผู้ใช้เจ้าของข้อมูลในเดโม</b>
                  )}
                </p>
              </div>
              <p className="text-[12.5px] text-[var(--muted)]">
                ระดับเฉลี่ยหมวดนี้ <b className="text-[17px] text-[var(--ink)]">{mean.toFixed(2)}</b>
              </p>
            </div>

            <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
              <table className="w-full text-[13px]">
                <thead className="bg-[var(--page)] text-left text-[12px] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">รายการ</th>
                    <th className="px-3 py-2 font-medium">ผู้รับผิดชอบ</th>
                    <th className="px-3 py-2 font-medium">timeline / milestone</th>
                    <th className="px-3 py-2 font-medium">ระดับปัจจุบัน</th>
                    <th className="px-3 py-2 text-center font-medium">ปีที่แล้ว</th>
                    <th className="px-3 py-2 text-center font-medium">เป้าปีนี้</th>
                    <th className="px-3 py-2 text-center font-medium">คาดการณ์ 1 ปี</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => {
                    const owner = v.users.find((x) => x.id === i.ownerUserId);
                    return (
                      <tr
                        key={i.code}
                        className="border-t border-[var(--line)] hover:bg-[var(--page)]"
                        style={i.isMine ? { background: "rgba(31,111,74,.05)" } : undefined}
                      >
                        <td className="px-3 py-2.5">
                          <Link href={`/item/${i.code}`} className="font-semibold underline">
                            {i.code}
                          </Link>{" "}
                          {i.name}
                          <span className="ml-1 inline-flex gap-1">
                            {i.isMine && (
                              <span className="rounded-full border px-1.5 text-[11px]"
                                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                                ของกองคุณ
                              </span>
                            )}
                            {!i.ownerUserId && (
                              <span className="rounded-full border px-1.5 text-[11px] text-[var(--muted)]"
                                style={{ borderColor: "var(--line)" }}>
                                ไม่มีเจ้าของในระบบ
                              </span>
                            )}
                            {!i.submittedThisCycle && (
                              <span className="rounded-full border px-1.5 text-[11px]"
                                style={{ borderColor: "var(--late)", color: "var(--late)" }}>
                                ยังไม่ส่ง
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12.5px] text-[var(--ink2)]">
                          {owner?.title ?? <span className="text-[var(--muted)]">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <MilestoneStrip milestones={i.milestones} today={today} />
                          {i.slipHistory.length >= v.settings.slip_escalate_after && (
                            <p className="mt-1 text-[11.5px]" style={{ color: "var(--late)" }}>
                              ⛔ เลื่อน {i.slipHistory.length} ครั้ง
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <LevelDots achieved={i.achievedLevel} target={i.targetLevel} />
                          <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                            ไประดับถัดไปแล้ว {i.percentWithinNextLevel}%
                            {i.verified === 0 && " · ยืนยันด้วยหลักฐาน 0%"}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-center">{i.lastYearLevel}</td>
                        <td className="px-3 py-2.5 text-center">{i.targetLevel}</td>
                        <td className="px-3 py-2.5 text-center">
                          <b>{i.forecast1.toFixed(1)}</b>
                          {i.forecast1 < i.targetLevel && (
                            <p className="text-[11px]" style={{ color: "var(--warn)" }}>ต่ำกว่าเป้า</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className="mt-6 text-[12px] text-[var(--muted)]">
        คอลัมน์ “คาดการณ์” คือการฉายภาพจากอัตราปีเดียว <b>ไม่ใช่คำมั่น</b> — ดูสมมติฐานทั้งหมดที่หน้าแนวโน้ม
      </p>
    </Shell>
  );
}
