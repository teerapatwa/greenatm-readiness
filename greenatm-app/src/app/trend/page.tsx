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
      <h1 className="ga-h1">แนวโน้มและคาดการณ์ 3 ปี / 5 ปี</h1>

      <Card tone="warn" style={{ marginTop: 12 }}>
        <p className="text-[14px] font-bold">⚠ นี่คือการฉายภาพ ไม่ใช่คำมั่น</p>
        <p className="ga-sub">
          และหัวข้อข่าวที่ซื่อสัตย์ไม่ใช่การคาดการณ์ — คือ{" "}
          <b>{t.stalled.length} จาก {t.items.length} รายการไม่ขยับระดับเลยตั้งแต่ปีที่แล้ว</b>{" "}
          การคาดการณ์เป็นผลพวงของอัตรานั้น
        </p>
      </Card>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>ระดับเฉลี่ยทั้งองค์กร ตาม 3 ฉากทัศน์</h2>
        <div style={{ marginTop: 8, overflowX: "auto", border: "1px solid var(--line)", borderRadius: 12, background: "var(--card)" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead className="ga-thead" style={{ background: "var(--fill2)", textAlign: "left" }}>
              <tr>
                <th style={{ padding: "9px 12px" }}>ฉากทัศน์</th>
                {t.years.map((y) => (
                  <th key={y} style={{ padding: "9px 12px", textAlign: "center" }}>
                    {y === 0 ? "วันนี้" : `+${y} ปี`}
                  </th>
                ))}
                <th style={{ padding: "9px 12px" }}>สัดส่วนที่ไปถึง</th>
              </tr>
            </thead>
            <tbody>
              {t.scenarios.map((sc) => (
                <tr key={sc.key} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <b>{sc.label}</b>
                    <p style={{ fontSize: 11.5, color: "var(--muted)" }}>ความเร็ว × {sc.multiplier}</p>
                  </td>
                  {sc.byYear.map((val, i) => (
                    <td key={i} style={{ padding: "10px 12px", textAlign: "center" }}>
                      <b style={{ fontSize: 15 }}>{val.toFixed(2)}</b>
                    </td>
                  ))}
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ height: 8, width: "100%", borderRadius: 3, background: "var(--l1)" }}>
                      <div
                        style={{
                          height: "100%", borderRadius: 3,
                          width: `${(sc.byYear[sc.byYear.length - 1] / max) * 100}%`,
                          background: sc.key === "stalled" ? "var(--danger)"
                            : sc.key === "faster" ? "var(--accent)" : "var(--teal)",
                        }}
                      />
                    </div>
                    <p style={{ marginTop: 4, fontSize: 11.5, color: "var(--muted)" }}>
                      {((sc.byYear[sc.byYear.length - 1] / max) * 100).toFixed(0)}% ของเพดาน (ระดับ 5)
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Card style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>สมมติฐานของตัวเลขข้างบน</h2>
        <pre style={{ marginTop: 8, overflowX: "auto", background: "var(--fill)", borderRadius: 8, padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.7 }}>
{`ระดับที่คาด(ปี) = min( 5 , ระดับที่ได้ + ความคืบหน้าในระดับถัดไป/100 + max(0, ความเร็ว) × ปี )
ความเร็ว        = (ระดับที่ได้ − ระดับปีที่แล้ว) + ความคืบหน้าในระดับถัดไป/100`}
        </pre>
        <p style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>สิ่งที่สูตรนี้ไม่ได้คิด — เขียนไว้ตรงนี้ ไม่ซ่อนในเอกสาร</p>
        <ul style={{ marginTop: 6, fontSize: 12.5, color: "var(--ink2)", listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>· งบประมาณและกำลังคน และคำถามว่าเงินที่ทำให้ปีนี้เดินได้ จะมีต่อไหม</li>
          <li>· <b>ระดับสูงยากกว่าระดับต่ำ</b> — เส้นตรงที่ลากผ่านระดับ 1–2 จะประเมินระดับ 4–5 สูงเกินจริง</li>
          <li>· การเปลี่ยนเกณฑ์ของ CANSO หรือการแก้แบบฟอร์มภายในเอง</li>
          <li>· ความเกี่ยวโยงระหว่างรายการ และผลของ cliff rule ต่อคะแนนรับรอง</li>
          <li>
            · <b>ประวัติหนึ่งปีคือความเร็วเพียงจุดเดียว</b> — เป็นจุดที่อ่อนที่สุดของทั้งแบบจำลอง
            สองรอบจึงจะเถียงได้ หนึ่งรอบยังเถียงไม่ได้
          </li>
        </ul>
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
          รายการที่ความเร็วเป็นศูนย์ <b>ถูกคาดว่าอยู่ที่เดิม</b> ไม่ถูกปัดขึ้นตามค่าเฉลี่ยองค์กร
        </p>
      </Card>

      <Card tone="danger" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          รายการที่ระดับไม่ขยับเลย ({t.stalled.length})
        </h2>
        <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink2)" }}>
          ถ้าปลดล็อกกลุ่มนี้ได้ ความเร็วรวมจะเปลี่ยนมากกว่าการเร่งรายการที่วิ่งอยู่แล้ว
        </p>
        <ul style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "4px 16px", fontSize: 12.5, listStyle: "none", padding: 0 }}>
          {t.stalled.map((i) => (
            <li key={i.code}>
              <Link href={`/item/${i.code}`} >{i.code}</Link>
              <span style={{ color: "var(--muted)" }}> · ระดับ {i.level}</span>
            </li>
          ))}
        </ul>
      </Card>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>คาดการณ์รายรายการ</h2>
        <div style={{ marginTop: 8, overflowX: "auto", border: "1px solid var(--line)", borderRadius: 12, background: "var(--card)" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead className="ga-thead" style={{ background: "var(--fill2)", textAlign: "left" }}>
              <tr>
                <th style={{ padding: "9px 12px" }}>รายการ</th>
                <th style={{ padding: "9px 12px", textAlign: "center" }}>ปีที่แล้ว</th>
                <th style={{ padding: "9px 12px", textAlign: "center" }}>ปัจจุบัน</th>
                <th style={{ padding: "9px 12px", textAlign: "center" }}>เป้า</th>
                <th style={{ padding: "9px 12px", textAlign: "center" }}>ความเร็ว/ปี</th>
                <th style={{ padding: "9px 12px", textAlign: "center" }}>+3 ปี</th>
                <th style={{ padding: "9px 12px", textAlign: "center" }}>+5 ปี</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((i) => (
                <tr key={i.code} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "9px 12px" }}>
                    <Link href={`/item/${i.code}`} style={{ fontWeight: 700 }}>{i.code}</Link>{" "}
                    <span className="text-[12.5px]">{i.name}</span>
                    {i.stalled && (
                      <span style={{ marginLeft: 4, border: "1px solid", borderRadius: 999, padding: "0 6px", fontSize: 11, borderColor: "var(--danger)", color: "var(--danger)" }}>
                        ไม่ขยับ
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>{i.lastYearLevel}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>{i.achievedLevel}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>{i.targetLevel}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center", color: i.velocity <= 0 ? "var(--danger)" : undefined }}>
                    {i.velocity > 0 ? "+" : ""}{i.velocity.toFixed(2)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>{i.p3.toFixed(1)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
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
