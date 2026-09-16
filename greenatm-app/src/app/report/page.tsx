import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee, profileFor } from "@/lib/auth/perms";
import { snapshot, settings } from "@/lib/db/queries";
import { buildReport } from "@/lib/data/report";
import { Forbidden, Shell } from "@/components/Shell";
import { Card } from "@/components/ui";
import { ReportExport } from "@/components/ReportExport";

export const dynamic = "force-dynamic";

/**
 * เอกสารสรุปรอบเดือน — R11 · AC-10 · AC-15
 *
 * หน้านี้แสดงสิ่งที่จะถูกส่งออก **ตรงตามที่จะออกจริง** ไม่ใช่ตัวอย่างคนละชุดกับไฟล์
 * ทุกข้อความมีการอ้างอิงติดอยู่ และข้อที่ไม่มีหลักฐานถูกบังคับให้ไปโผล่ที่ทะเบียนหมายเหตุ
 * ไม่มีทางที่รายการใดจะหายไปจากทั้งสองที่ — assertExportable กันไว้ตอนส่งออก
 */
export default async function ReportPage() {
  const u = await currentUser();
  if (!canSee(u.role, "trend")) {
    return (
      <Shell active="trend">
        <Forbidden roleLabel={profileFor(u.role).label}
          what="ดูเอกสารรอบเดือน — เป็นภาพระดับองค์กร สำหรับผู้ดูแลและผู้บริหาร" />
      </Shell>
    );
  }

  const r = buildReport(snapshot(), settings());

  return (
    <Shell active="trend">
      <div style={{ marginBottom: 18 }}>
        <div className="ga-h1">เอกสารสรุปความพร้อมด้านหลักฐาน — รอบ {r.meta.cycle}</div>
        <div className="ga-sub">
          สร้างจากข้อมูลในระบบโดยตรง · ทุกข้อความมีการอ้างอิงเอกสารต้นทาง ·
          <b> ไม่มีประโยคใดแต่งขึ้นโดยโมเดลภาษา</b>
        </div>
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>ส่งออกเอกสาร</div>
        <ReportExport />
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>สรุปผู้บริหาร</div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
          <Stat label="ข้อประเมินทั้งหมด" value={r.summary.totalItems} />
          <Stat label="มีข้อความพร้อมการอ้างอิง" value={r.summary.withCitation} tone="ok" />
          <Stat label="อยู่ในทะเบียนหมายเหตุ" value={r.summary.inRemarks} tone="warn" />
          <Stat label="Level เฉลี่ย" value={r.summary.meanLevel.toFixed(2)}
            sub={`เดิม ${r.summary.meanLast.toFixed(2)}`} />
          <Stat label="ยังไม่ส่งรอบนี้" value={r.summary.notSubmitted} tone="danger" />
        </div>
        <p style={{
          marginTop: 14, marginBottom: 0, fontSize: 12.5, color: "var(--ink2)",
          borderTop: "1px dashed var(--line)", paddingTop: 12,
        }}>
          {r.summary.withCitation} + {r.summary.inRemarks} = <b>{r.summary.totalItems}</b> —
          ทุกข้ออยู่ที่ใดที่หนึ่งเสมอ ไม่มีข้อไหนหายไปจากเอกสาร
          <b> ถ้าตัวเลขนี้ไม่ตรง ระบบจะปฏิเสธการส่งออก</b>
        </p>
      </Card>

      {r.sections.map((s) => (
        <Card key={s.categoryNum} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5 }}>
            หมวด {s.categoryNum} · {s.categoryName}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{s.divisionName}</div>

          {s.statements.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
              <i>ไม่มีรายการใดในหมวดนี้ที่มีหลักฐานยืนยันแล้ว — ทั้งหมดอยู่ในทะเบียนหมายเหตุ</i>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {s.statements.map((st) => (
                <div key={st.itemCode} style={{ fontSize: 13, lineHeight: 1.7 }}>
                  <Link href={`/item/${st.itemCode}`}><b>{st.itemCode}</b></Link>{" "}
                  <b>{st.itemName}</b>
                  <div style={{ color: "var(--ink2)" }}>
                    {st.text}{" "}
                    {st.citations.map((c) => (
                      <Link key={c.evidenceId} href={`/item/${st.itemCode}`}
                        title={`${c.title} · ชั้น ${c.tier} · ${c.documentDate ?? "ไม่ระบุวันที่"}`}
                        style={{
                          background: "var(--fill2)", border: "1px solid var(--line)",
                          borderRadius: 4, padding: "1px 5px", fontSize: 11.5,
                          fontFamily: "ui-monospace, monospace", marginRight: 4,
                          textDecoration: "none",
                        }}>
                        [{c.evidenceId}]
                      </Link>
                    ))}
                  </div>
                  {st.notCounted && (
                    <div style={{ fontSize: 12, color: "var(--warn-ink)" }}>
                      ⚠️ เอกสารชั้น C ยังไม่นับเข้าค่าหลักฐานที่ยืนยันแล้ว — แผนไม่ใช่หลักฐานของผลลัพธ์
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {s.remarkCount > 0 && (
            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: "var(--muted)" }}>
              หมวดนี้มีอีก <b>{s.remarkCount}</b> รายการอยู่ในทะเบียนหมายเหตุ
            </p>
          )}
        </Card>
      ))}

      <div className="ga-card-returned" style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--danger)" }}>
          🔴 ทะเบียนหมายเหตุ — {r.remarks.length} รายการที่ยังพิสูจน์ไม่ได้
        </div>
        <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink2)" }}>
          รายการเหล่านี้<b>ไม่ถูกละไว้เงียบ ๆ</b> — สิ่งที่ไม่มีหลักฐานคือสิ่งที่หายจากรายงานง่ายที่สุด
          การบังคับให้มันปรากฏ คือเหตุผลหลักที่เครื่องมือนี้มีอยู่
        </p>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead>
              <tr className="ga-thead">
                {["ข้อ", "รายการ", "เหตุผล", "ผู้รับผิดชอบ", "อัปเดตล่าสุด", "ระดับ", "สถานะ"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 9px", borderBottom: "1px solid var(--line)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.remarks.map((m) => (
                <tr key={m.itemCode}>
                  <td style={cell}><Link href={`/item/${m.itemCode}`}><b>{m.itemCode}</b></Link></td>
                  <td style={cell}>{m.itemName}</td>
                  <td style={cell}>{m.reason}</td>
                  <td style={cell}>{m.ownerTitle}</td>
                  <td style={cell}>{m.lastUpdated}</td>
                  <td style={{ ...cell, textAlign: "center" }}>{m.achievedLevel} → {m.targetLevel}</td>
                  <td style={cell}>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>
          ภาคผนวก · เอกสารที่ถูกอ้างถึง ({r.sources.length} ฉบับ)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {r.sources.map((c) => (
            <div key={c.evidenceId} style={{ fontSize: 12.5 }}>
              <code style={{ color: "var(--muted2)" }}>[{c.evidenceId}]</code> {c.title}
              <span style={{ color: "var(--muted)" }}>
                {" · "}ชั้น {c.tier}{" · "}{c.documentDate ?? "ไม่ระบุวันที่"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </Shell>
  );
}

const cell: React.CSSProperties = {
  padding: "6px 9px", borderBottom: "1px solid var(--line)", verticalAlign: "top",
};

function Stat({ label, value, sub, tone }: {
  label: string; value: string | number; sub?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  const color = tone === "ok" ? "var(--accent)"
    : tone === "warn" ? "var(--warn)"
      : tone === "danger" ? "var(--danger)" : undefined;
  return (
    <div>
      <div className="ga-label">{label}</div>
      <div className="ga-stat tnum" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--muted2)" }}>{sub}</div>}
    </div>
  );
}
