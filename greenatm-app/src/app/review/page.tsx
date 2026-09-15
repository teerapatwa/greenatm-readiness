import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee, profileFor } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { auditCount } from "@/lib/db/queries";
import { Forbidden, Shell } from "@/components/Shell";
import { Card, Chip, Empty, TierChip, VERDICT } from "@/components/ui";
import { TierActions } from "@/components/actions";

export const dynamic = "force-dynamic";

/** ศูนย์ตรวจสอบ — ค่า Verified ทั้งองค์กรขยับจากหน้านี้ที่เดียว */
export default async function ReviewPage() {
  const u = await currentUser();
  if (!canSee(u.role, "review")) {
    return (
      <Shell active="review">
        <Forbidden roleLabel={profileFor(u.role).label} what="เข้าศูนย์ตรวจสอบ — หน้านี้เป็นของผู้ดูแล (ทีมกลาง)" />
      </Shell>
    );
  }

  const v = buildView(u);
  const queue = v.evidence.filter((e) => e.confirmedTier === null);
  const notSubmitted = v.items.filter((i) => !i.submittedThisCycle);
  const noEvidence = v.items.filter((i) => i.evidenceCount === 0);

  return (
    <Shell active="review">
      <h1 className="text-xl font-semibold">ศูนย์ตรวจสอบ</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink2)]">
        ยืนยันข้อเสนอของ agent · ติดตามกองที่ยังไม่ส่ง · ดูรายการที่ยังพิสูจน์ไม่ได้
      </p>
      <Card tone="warn" className="mt-3">
        <p className="text-[13.5px]">
          <b>ค่า Verified ทั้งองค์กรขยับจากหน้านี้ที่เดียว</b> — agent เสนอได้ เจ้าของข้อมูลแนบหลักฐานได้
          แต่การยืนยันเป็นของ{profileFor(u.role).label} · ทุกการยืนยันบันทึกลง audit log
          (ปัจจุบัน {auditCount()} รายการ)
        </p>
      </Card>

      <section className="mt-5">
        <h2 className="text-[14px] font-semibold">รอยืนยันชั้นหลักฐาน ({queue.length})</h2>
        {queue.length === 0 ? (
          <div className="mt-2"><Empty>ไม่มีหลักฐานค้างรอยืนยัน</Empty></div>
        ) : (
          <ul className="mt-2 space-y-2">
            {queue.map((e) => {
              const item = v.items.find((i) => i.code === e.itemCode)!;
              return (
                <li key={e.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/item/${e.itemCode}`} className="text-[13px] font-semibold underline">
                        {e.itemCode}
                      </Link>
                      <TierChip tier={e.proposedTier} confirmed={false} />
                      <code className="text-[11.5px] text-[var(--muted)]">{e.id}</code>
                    </div>
                    <p className="mt-1 text-[13.5px]">{e.title}</p>
                    <p className="text-[12px] text-[var(--ink2)]">
                      วันที่ในเอกสาร:{" "}
                      {e.documentDate ?? <b style={{ color: "var(--warn)" }}>ไม่พบ — ต้องให้เจ้าของข้อมูลเติมก่อน</b>}
                    </p>
                    {e.proposedReason && (
                      <p className="mt-1 text-[12.5px] text-[var(--ink2)]">เหตุผลของ agent: {e.proposedReason}</p>
                    )}
                    <TierActions evidenceId={e.id} proposedTier={e.proposedTier} />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="text-[14px] font-semibold">ยังไม่ส่งข้อมูลรอบนี้ ({notSubmitted.length})</h2>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {notSubmitted.map((i) => (
              <li key={i.code}>
                <Link href={`/item/${i.code}`} className="font-semibold underline">{i.code}</Link> {i.name}
                <p className="text-[12px] text-[var(--muted)]">
                  {v.users.find((x) => x.id === i.ownerUserId)?.title ?? (
                    <b style={{ color: "var(--warn)" }}>ไม่มีเจ้าของในระบบ — ไม่มีใครถูกเตือน</b>
                  )}
                  {" · "}
                  {i.daysToDue < 0 ? `เลยกำหนด ${-i.daysToDue} วัน` : `เหลือ ${i.daysToDue} วัน`}
                </p>
              </li>
            ))}
          </ul>
          <Link href="/alerts" className="mt-2.5 inline-block rounded-md bg-[var(--accent)] px-2.5 py-1 text-[12.5px] text-white">
            ไปหน้าแจ้งเตือนเพื่อร่างข้อความ →
          </Link>
        </Card>

        <Card>
          <h2 className="text-[14px] font-semibold">ยังไม่มีหลักฐานเลย ({noEvidence.length})</h2>
          <p className="text-[12.5px] text-[var(--muted)]">
            รายการเหล่านี้จะเข้า “ทะเบียนหมายเหตุ” ท้ายเอกสารรอบเดือน — ไม่ถูกละไว้เงียบ ๆ
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
            {noEvidence.map((i) => (
              <li key={i.code}>
                <Link href={`/item/${i.code}`} className="underline">{i.code}</Link>
                <span className="text-[var(--muted)]">
                  {" "}· L{i.achievedLevel}{i.achievedLevel >= i.targetLevel ? " ถึงเป้า!" : ""}
                </span>
              </li>
            ))}
          </ul>
          {noEvidence.some((i) => i.achievedLevel >= i.targetLevel) && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--warn)" }}>
              ⚠ มีรายการที่<b>ถึงเป้าแล้วแต่ไม่มีหลักฐานแม้ชิ้นเดียว</b> — Suggestion ของรายการเหล่านี้
              ต้องไม่ขึ้นว่า “เสร็จสมบูรณ์” และในระบบนี้ไม่ขึ้น
            </p>
          )}
        </Card>
      </div>
    </Shell>
  );
}
