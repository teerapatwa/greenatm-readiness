import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { hasAbility } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { Shell } from "@/components/Shell";
import {
  Card, Chip, LevelDistribution, LevelSegments, MilestoneStrip, Tag, VERDICT,
} from "@/components/ui";
import { TargetDots } from "@/components/TargetDots";

export const dynamic = "force-dynamic";

/**
 * หน้าแรก — โครงและขนาดยึดตาม GreenATM Evidence Dashboard (standalone).html
 *
 * ของทีม 5 คอลัมน์: รายการ · สถานะปัจจุบัน · ปีที่แล้ว · เป้าปีนี้ (ทีมกลาง) · คาดการณ์
 * ที่เราเพิ่ม 2 คอลัมน์: ผู้รับผิดชอบ · timeline/milestone (ตามที่ขอไว้)
 * และปุ่มเป้าของทีมซึ่งเดิมกดไม่ได้ ที่นี่กดได้จริงถ้ามีสิทธิ์
 */

const GRID = "2fr 1.05fr .95fr 128px 60px 172px 70px";

export default async function HomePage() {
  const u = await currentUser();
  const v = buildView(u);
  const today = v.meta.today;
  const canSetTarget = hasAbility(u.role, "set_target_level");

  const dist = [1, 2, 3, 4, 5].map((L) => v.items.filter((i) => i.achievedLevel === L).length);

  return (
    <Shell active="home">
      {/* ── หัวหน้า ── */}
      <div style={{ marginBottom: 20 }}>
        <div className="ga-h1">หน้าแรก — ภาพรวมระดับ GreenATM ตามหมวดหมู่</div>
        <div className="ga-sub">
          จัดกลุ่มตามแบบประเมิน {v.meta.formRef} · เทียบระดับปีที่แล้ว เป้าที่ทีมกลางกำหนด
          และคาดการณ์จากอัตราปัจจุบัน · <b>แถวสีเขียวอ่อน = เป้าปีนี้สูงกว่าปีที่แล้ว</b>
          {u.role === "owner" && <> · แก้ได้เฉพาะ {v.myItems.length} รายการของกองคุณ</>}
          {u.role === "executive" && <> · มุมมองอ่านอย่างเดียว ยกเว้นการตั้งเป้า</>}
        </div>
      </div>

      {/* ── แถบสรุปทั้งองค์กร + การกระจายตัวของ Level ── */}
      <div style={{ marginBottom: 22 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <div>
              <div className="ga-label">ข้อประเมินทั้งหมด</div>
              <div className="ga-stat tnum">{v.items.length} ข้อ</div>
            </div>
            <div>
              <div className="ga-label">Level เฉลี่ยทั้งองค์กร</div>
              <div className="ga-stat tnum" style={{ color: "var(--accent)" }}>
                {v.org.meanNow.toFixed(2)}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted2)" }}>
                ปีที่แล้ว {v.org.meanLast.toFixed(2)} ·{" "}
                <b style={{ color: "var(--accent)" }}>
                  +{(v.org.meanNow - v.org.meanLast).toFixed(2)}
                </b>
              </div>
            </div>
            <div>
              <div className="ga-label">ไม่ขยับระดับจากปีที่แล้ว</div>
              <div className="ga-stat tnum" style={{ color: "var(--warn)" }}>
                {v.org.stalled}
                <span style={{ fontSize: 15, color: "var(--muted2)" }}>/{v.items.length}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted2)" }}>
                นี่คือสิ่งที่ค้นพบ ค่าเฉลี่ยเป็นผลพวง
              </div>
            </div>
            <div>
              <div className="ga-label">ยังไม่ส่งรอบนี้</div>
              <div className="ga-stat tnum" style={{ color: "var(--danger)" }}>
                {v.org.notSubmitted}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted2)" }}>กำหนด {v.meta.cycleDue}</div>
            </div>
            <div>
              <div className="ga-label">แจ้งเตือนถึงคุณ</div>
              <div className="ga-stat tnum">{v.alerts.length}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted2)" }}>
                {u.role === "executive" ? "ผู้บริหารไม่รับรายรายการ"
                  : `จากทั้งระบบ ${v.allAlertCounts.moderator + v.allAlertCounts.ownerTotal} ฉบับ`}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="ga-label" style={{ marginBottom: 6 }}>
                การกระจายตัวของ Level (1–5) ทุกหมวดหมู่
              </div>
              <LevelDistribution counts={dist} />
            </div>
          </div>
        </Card>
      </div>

      {/* ── รายหมวด ── */}
      {v.categories.map((c) => {
        const list = v.items.filter((i) => i.category === c.num);
        const div = v.divisions.find((d) => d.id === c.divisionId);
        const mean = list.reduce((s, i) => s + i.achievedLevel, 0) / (list.length || 1);
        const catDist = [1, 2, 3, 4, 5].map((L) => list.filter((i) => i.achievedLevel === L).length);

        return (
          <div key={c.num} style={{ marginBottom: 16 }}>
            <Card>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                flexWrap: "wrap", gap: 10, marginBottom: 14,
              }}>
                <div>
                  <div className="ga-eyebrow">หมวดหมู่ {c.num}</div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 1 }}>
                    {div?.nameEn} · {list.length} ข้อ · {div?.name}
                    {list.every((i) => !i.ownerUserId) && (
                      <b style={{ color: "var(--warn)" }}> · ยังไม่มีผู้ใช้เจ้าของข้อมูลในหมวดนี้</b>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="ga-label">Level เฉลี่ยหมวดนี้</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }} className="tnum">
                    {mean.toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <LevelDistribution counts={catDist} height={8} legend={false} />
              </div>

              {/* หัวคอลัมน์ */}
              <div className="ga-thead" style={{
                display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "0 12px 6px",
              }}>
                <div>รายการ</div>
                <div>ผู้รับผิดชอบ</div>
                <div>timeline / milestone</div>
                <div>สถานะปัจจุบัน</div>
                <div>ปีที่แล้ว</div>
                <div>เป้าปีนี้ (ทีมกลาง)</div>
                <div>คาดการณ์</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {list.map((i) => {
                  const stretch = i.targetLevel > i.lastYearLevel;
                  const owner = v.users.find((x) => x.id === i.ownerUserId);
                  const sug = VERDICT[i.suggestion.verdict];
                  const note =
                    i.slipHistory.length >= v.settings.slip_escalate_after
                      ? { icon: "⛔", text: `เลื่อนแผน ${i.slipHistory.length} ครั้งด้วยเหตุผลเดิม — ต้องการการตัดสินใจ`, tone: "danger" }
                      : i.evidenceCount === 0 && i.achievedLevel >= i.targetLevel
                      ? { icon: "⚠", text: "ถึงเป้าแล้วแต่ไม่มีหลักฐานแม้ชิ้นเดียว — ยังพิสูจน์ไม่ได้", tone: "warn" }
                      : !i.submittedThisCycle
                      ? { icon: "⚠", text: `ยังไม่ส่งข้อมูลรอบนี้ · เหลือ ${i.daysToDue} วัน`, tone: "warn" }
                      : null;

                  return (
                    <div key={i.code} style={{
                      background: i.isMine ? "#f6fbf7" : stretch ? "#f2f9f4" : "var(--card)",
                      border: `1px solid ${i.isMine ? "var(--ok-line)" : "transparent"}`,
                      borderRadius: 8, padding: "9px 12px",
                    }}>
                      <div style={{
                        display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center",
                      }}>
                        <div style={{ fontSize: 13, color: "var(--ink)" }}>
                          <Link href={`/item/${i.code}`}><b>{i.code}</b></Link> {i.name}
                          {stretch && <Tag tone="ok">เป้าสูงกว่าปีที่แล้ว</Tag>}
                          {i.isMine && <Tag tone="ok">ของกองคุณ</Tag>}
                          {!i.ownerUserId && <Tag tone="muted">ไม่มีเจ้าของ</Tag>}
                        </div>

                        <div style={{ fontSize: 11.5, color: "var(--ink2)" }}>
                          {owner?.title ?? <span style={{ color: "var(--muted2)" }}>— ยังไม่มอบหมาย —</span>}
                        </div>

                        <div><MilestoneStrip milestones={i.milestones} today={today} /></div>

                        <div>
                          {/* บรรทัดเดียวแนวนอนแบบไฟล์ทีม — คำอธิบายยาวอยู่ใน tooltip
                              และในบล็อก "อ่านตารางนี้อย่างไร" ท้ายหน้า */}
                          <LevelSegments achieved={i.achievedLevel}
                            percentWithinNext={i.percentWithinNextLevel} showPercent />
                        </div>

                        <div style={{
                          fontSize: 15, fontWeight: 800, color: "var(--muted2)", textAlign: "center",
                        }} className="tnum">
                          {i.lastYearLevel}
                        </div>

                        <div>
                          <TargetDots code={i.code} achieved={i.achievedLevel}
                            target={i.targetLevel} lastYear={i.lastYearLevel} editable={canSetTarget} />
                        </div>

                        <div style={{
                          textAlign: "center", fontSize: 15, fontWeight: 800,
                          color: i.forecast1 < i.targetLevel ? "var(--warn)" : "var(--accent)",
                        }} className="tnum">
                          {i.forecast1.toFixed(1)}
                          {i.forecast1 < i.targetLevel && (
                            <div style={{ fontSize: 10, fontWeight: 600 }}>ต่ำกว่าเป้า</div>
                          )}
                        </div>
                      </div>

                      {note && (
                        <div style={{
                          marginTop: 6, fontSize: 11.5, fontWeight: 600,
                          color: note.tone === "danger" ? "var(--danger)" : "var(--warn-ink)",
                        }}>
                          {note.icon} {note.text}
                        </div>
                      )}

                      {i.isMine && (
                        <div style={{ marginTop: 6 }}>
                          <Chip glyph={sug.glyph} label={sug.label} color={sug.color} />
                          <span style={{ fontSize: 11.5, color: "var(--ink2)", marginLeft: 8 }}>
                            {i.suggestion.reason}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        );
      })}

      <Card style={{ marginTop: 4 }} pad="14px 18px">
        <div className="ga-label" style={{ marginBottom: 6 }}>อ่านตารางนี้อย่างไร</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--ink2)", lineHeight: 1.85 }}>
          <li>
            <b>สถานะปัจจุบัน</b> — ช่องทึบ = ระดับที่ได้แล้ว · ช่องถัดไปที่เติมบางส่วน =
            <b> งานของระดับถัดไปทำไปแล้วกี่เปอร์เซ็นต์</b> เช่น “ระดับ 2 · งานของระดับ 3 ทำได้ 30%”
            หมายถึงยังได้ระดับ 2 อยู่ แต่เกณฑ์ของระดับ 3 เดินไปแล้ว 30%
            <br />
            <span style={{ color: "var(--muted)" }}>
              เปอร์เซ็นต์นี้<b>ไม่ทำให้ระดับขึ้นเอง</b> — ถึง 100% ก็ยังต้องมีหลักฐานชั้น A/B
              ที่ทีมกลางยืนยันก่อน (เคสทดสอบ AC-01)
            </span>
          </li>
          <li>
            <b>เป้าปีนี้</b> — ระดับที่ทีมกลางตั้งไว้ว่าปีนี้ต้องไปถึง ·
            {hasAbility(u.role, "set_target_level")
              ? " กดตัวเลขเพื่อตั้งได้เลย · ระดับที่ต่ำกว่าระดับที่ได้แล้วกดไม่ได้"
              : " การตั้งเป้าเป็นของทีมกลางและผู้บริหาร"}
          </li>
          <li>
            <b>คาดการณ์</b> — ฉายภาพ 1 ปีจากอัตราของปีที่ผ่านมา <b>ไม่ใช่คำมั่น</b> ·
            ดูสมมติฐานทั้งหมดที่หน้าแนวโน้ม
          </li>
        </ul>
      </Card>
    </Shell>
  );
}
