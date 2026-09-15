import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee, profileFor } from "@/lib/auth/perms";
import { trendView } from "@/lib/view";
import { Forbidden, Shell } from "@/components/Shell";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * แนวโน้มและคาดการณ์ — PLAN §5.7
 *
 * เงื่อนไขที่หน้านี้ถูกยอมรับ: สมมติฐานต้องอยู่บนหน้าจอเดียวกับตัวเลข
 * ถ้าตัดบล็อกสมมติฐานออก ต้องตัดการคาดการณ์ออกไปด้วย
 */
export default async function TrendPage() {
  const u = await currentUser();
  if (!canSee(u.role, "trend")) {
    return (
      <Shell active="trend">
        <Forbidden roleLabel={profileFor(u.role).label}
          what="เข้าหน้าแนวโน้ม — หน้านี้เป็นภาพระดับองค์กร สำหรับผู้ดูแลและผู้บริหาร" />
      </Shell>
    );
  }

  const t = trendView();
  const max = 5;

  return (
    <Shell active="trend">
      <h1 className="text-xl font-semibold">แนวโน้มและคาดการณ์ 3 ปี / 5 ปี</h1>

      <Card tone="warn" className="mt-3">
        <p className="text-[14px] font-bold">⚠ นี่คือการฉายภาพ ไม่ใช่คำมั่น</p>
        <p className="mt-1 text-[13px] text-[var(--ink2)]">
          และหัวข้อข่าวที่ซื่อสัตย์ไม่ใช่การคาดการณ์ — คือ{" "}
          <b>{t.stalled.length} จาก {t.items.length} รายการไม่ขยับระดับเลยตั้งแต่ปีที่แล้ว</b>{" "}
          การคาดการณ์เป็นผลพวงของอัตรานั้น
        </p>
      </Card>

      <section className="mt-4">
        <h2 className="text-[14px] font-semibold">ระดับเฉลี่ยทั้งองค์กร ตาม 3 ฉากทัศน์</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--page)] text-left text-[12px] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">ฉากทัศน์</th>
                {t.years.map((y) => (
                  <th key={y} className="px-3 py-2 text-center font-medium">
                    {y === 0 ? "วันนี้" : `+${y} ปี`}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">สัดส่วนที่ไปถึง</th>
              </tr>
            </thead>
            <tbody>
              {t.scenarios.map((sc) => (
                <tr key={sc.key} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2.5">
                    <b>{sc.label}</b>
                    <p className="text-[11.5px] text-[var(--muted)]">ความเร็ว × {sc.multiplier}</p>
                  </td>
                  {sc.byYear.map((val, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      <b className="text-[15px]">{val.toFixed(2)}</b>
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <div className="h-[8px] w-full rounded-sm bg-[var(--page)]">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${(sc.byYear[sc.byYear.length - 1] / max) * 100}%`,
                          background: sc.key === "stalled" ? "var(--danger)"
                            : sc.key === "faster" ? "var(--accent)" : "var(--teal)",
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                      {((sc.byYear[sc.byYear.length - 1] / max) * 100).toFixed(0)}% ของเพดาน (ระดับ 5)
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Card className="mt-4">
        <h2 className="text-[14px] font-semibold">สมมติฐานของตัวเลขข้างบน</h2>
        <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--page)] px-3 py-2.5 font-mono text-[12px] leading-relaxed">
{`ระดับที่คาด(ปี) = min( 5 , ระดับที่ได้ + ความคืบหน้าในระดับถัดไป/100 + max(0, ความเร็ว) × ปี )
ความเร็ว        = (ระดับที่ได้ − ระดับปีที่แล้ว) + ความคืบหน้าในระดับถัดไป/100`}
        </pre>
        <p className="mt-2.5 text-[13px] font-semibold">สิ่งที่สูตรนี้ไม่ได้คิด — เขียนไว้ตรงนี้ ไม่ซ่อนในเอกสาร</p>
        <ul className="mt-1.5 space-y-1 text-[12.5px] text-[var(--ink2)]">
          <li>· งบประมาณและกำลังคน และคำถามว่าเงินที่ทำให้ปีนี้เดินได้ จะมีต่อไหม</li>
          <li>· <b>ระดับสูงยากกว่าระดับต่ำ</b> — เส้นตรงที่ลากผ่านระดับ 1–2 จะประเมินระดับ 4–5 สูงเกินจริง</li>
          <li>· การเปลี่ยนเกณฑ์ของ CANSO หรือการแก้แบบฟอร์มภายในเอง</li>
          <li>· ความเกี่ยวโยงระหว่างรายการ และผลของ cliff rule ต่อคะแนนรับรอง</li>
          <li>
            · <b>ประวัติหนึ่งปีคือความเร็วเพียงจุดเดียว</b> — เป็นจุดที่อ่อนที่สุดของทั้งแบบจำลอง
            สองรอบจึงจะเถียงได้ หนึ่งรอบยังเถียงไม่ได้
          </li>
        </ul>
        <p className="mt-2 text-[12.5px] text-[var(--muted)]">
          รายการที่ความเร็วเป็นศูนย์ <b>ถูกคาดว่าอยู่ที่เดิม</b> ไม่ถูกปัดขึ้นตามค่าเฉลี่ยองค์กร
        </p>
      </Card>

      <Card tone="danger" className="mt-4">
        <h2 className="text-[14px] font-semibold">
          รายการที่ระดับไม่ขยับเลย ({t.stalled.length})
        </h2>
        <p className="mt-1 text-[12.5px] text-[var(--ink2)]">
          ถ้าปลดล็อกกลุ่มนี้ได้ ความเร็วรวมจะเปลี่ยนมากกว่าการเร่งรายการที่วิ่งอยู่แล้ว
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-3">
          {t.stalled.map((i) => (
            <li key={i.code}>
              <Link href={`/item/${i.code}`} className="underline">{i.code}</Link>
              <span className="text-[var(--muted)]"> · ระดับ {i.level}</span>
            </li>
          ))}
        </ul>
      </Card>

      <section className="mt-4">
        <h2 className="text-[14px] font-semibold">คาดการณ์รายรายการ</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--page)] text-left text-[12px] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">รายการ</th>
                <th className="px-3 py-2 text-center font-medium">ปีที่แล้ว</th>
                <th className="px-3 py-2 text-center font-medium">ปัจจุบัน</th>
                <th className="px-3 py-2 text-center font-medium">เป้า</th>
                <th className="px-3 py-2 text-center font-medium">ความเร็ว/ปี</th>
                <th className="px-3 py-2 text-center font-medium">+3 ปี</th>
                <th className="px-3 py-2 text-center font-medium">+5 ปี</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((i) => (
                <tr key={i.code} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2">
                    <Link href={`/item/${i.code}`} className="font-semibold underline">{i.code}</Link>{" "}
                    <span className="text-[12.5px]">{i.name}</span>
                    {i.stalled && (
                      <span className="ml-1 rounded-full border px-1.5 text-[11px]"
                        style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                        ไม่ขยับ
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">{i.lastYearLevel}</td>
                  <td className="px-3 py-2 text-center">{i.achievedLevel}</td>
                  <td className="px-3 py-2 text-center">{i.targetLevel}</td>
                  <td className="px-3 py-2 text-center" style={{ color: i.velocity <= 0 ? "var(--danger)" : undefined }}>
                    {i.velocity > 0 ? "+" : ""}{i.velocity.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">{i.p3.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center">
                    <b>{i.p5.toFixed(1)}</b>
                    {i.p5 < i.targetLevel && (
                      <p className="text-[11px]" style={{ color: "var(--warn)" }}>ยังไม่ถึงเป้า</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
