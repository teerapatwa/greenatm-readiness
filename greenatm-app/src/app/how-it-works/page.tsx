import { currentUser } from "@/lib/auth/session";
import { buildView } from "@/lib/view";
import { Shell } from "@/components/Shell";
import { Card, ThreeColumnRule } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * หลักการทำงาน — เนื้อหาจากหน้า WORKFLOW ของไฟล์ทีม
 *
 * ของทีมเป็น "ประตูขออนุมัติก่อนลงมือทำหน้าจอ" พร้อมปุ่ม "ยืนยัน → ดูหน้าจอ"
 * หน้าที่นั้นจบไปแล้วเพราะหน้าจอสร้างเสร็จ จึง **ตัดปุ่มออก** และเก็บไว้เป็นหน้าอธิบายระบบ
 * ใช้ตอบคำถามแรกที่กรรมการจะถาม: "AI อยู่ตรงไหน และไม่อยู่ตรงไหน"
 *
 * ขั้นตอนอ้างจาก PLAN.en.md §4.1
 */

type Actor = "human" | "code" | "agent" | "model";

const ACTOR: Record<Actor, { label: string; fg: string; bg: string; bd: string }> = {
  human: { label: "คน",    fg: "var(--ink)",     bg: "var(--fill)",     bd: "var(--line)" },
  code:  { label: "โค้ด",   fg: "#166b40",        bg: "var(--ok-bg)",    bd: "var(--ok-line)" },
  agent: { label: "Agent",  fg: "var(--danger)",  bg: "var(--danger-bg)", bd: "var(--danger-line)" },
  model: { label: "โมเดล",  fg: "var(--warn-ink)", bg: "var(--warn-bg)",  bd: "var(--warn-line)" },
};

const STEPS: { n: number; actor: Actor; what: string; out: string; exc: string; built: boolean }[] = [
  { n: 1, actor: "code", what: "เปิดรอบ — แสดงรายการที่ต้องส่งและกำหนดส่ง",
    out: "รายการงานของกอง", exc: "ไม่มีรายการค้าง → บอกตรง ๆ ไม่ใช่หน้าว่าง", built: true },
  { n: 2, actor: "human", what: "เจ้าของข้อมูลกรอกความคืบหน้า",
    out: "แถว pending รอยืนยัน", exc: "ค่าเกิน 0–100 หรือวันที่ผิดรูป → ปฏิเสธ ไม่บันทึก", built: true },
  { n: 3, actor: "human", what: "กดยืนยันการ์ด — จุดเดียวที่ค่าจริงเปลี่ยน",
    out: "ค่าจริง + audit_log (actor = user id)", exc: "ไม่กด → ไม่มีอะไรเปลี่ยน (AC-17)", built: true },
  { n: 4, actor: "human", what: "แนบหลักฐาน (PDF / Word / รูป ไม่เกิน 10 MB)",
    out: "แถว evidence + ไฟล์บนดิสก์", exc: "ไม่พบวันที่ในเอกสาร → ถาม ไม่เดาจากวันอัปโหลด (AC-03)", built: true },
  { n: 5, actor: "code", what: "คำนวณความคืบหน้า สถานะ และระดับ",
    out: "progress · status · level", exc: "เป้าต่ำกว่าระดับที่ได้ → บันทึกไม่ได้", built: true },
  { n: 6, actor: "agent", what: "อ่านหลักฐานเทียบเกณฑ์ → เสนอชั้น A–D และบอกว่ายังขาดอะไร",
    out: "ข้อเสนอ สถานะ pending", exc: "ชนเพดาน tool call → รายงานว่าไม่สำเร็จ ไม่เดาให้จบ", built: false },
  { n: 7, actor: "human", what: "ทีมกลางยืนยันชั้น หรือแก้พร้อมเหตุผล",
    out: "confirmed_at → นับเข้าค่า Verified", exc: "ไม่ทำอะไร → ค้างที่ 'รอตรวจ'", built: true },
  { n: 8, actor: "model", what: "ร่างคำตอบจากหลักฐานที่ยืนยันแล้ว",
    out: "response สถานะ draft", exc: "ไม่มีหลักฐานชั้น A/B เลย → ไม่ร่าง", built: false },
  { n: 9, actor: "human", what: "ผู้บริหารอนุมัติ หรือตีกลับพร้อมเหตุผล",
    out: "อนุมัติ / กลับไปที่ทีมกลาง", exc: "—", built: false },
  { n: 10, actor: "code", what: "ประกอบเอกสารรอบเดือน + ทะเบียนหมายเหตุ",
    out: "ไฟล์ Word / PDF", exc: "มีข้อความที่ไม่มีการอ้างอิง → export ล้มเหลว (AC-10)", built: false },
  { n: 11, actor: "code", what: "แจ้งเตือนและจัดเส้นทาง — กำหนดส่ง · แผนงานเลยกำหนด · เลื่อนแผนซ้ำ",
    out: "alert + ร่างใน Outbox", exc: "แจ้งเตือนที่อ้างรายการไม่ได้ = บั๊ก ไม่ใช่คำเตือนที่ยอมรับได้", built: true },
  { n: 12, actor: "human", what: "ผู้ดูแลตรวจร่างแล้วกดส่งเอง",
    out: "บันทึกว่าส่งแล้ว", exc: "ต้นแบบไม่มีช่องทางส่งจริง — ส่งออกนอกเครื่องไม่ได้", built: true },
  { n: 13, actor: "code", what: "คาดการณ์ 3 และ 5 ปีจากอัตราปีที่ผ่านมา",
    out: "ตารางคาดการณ์ + สมมติฐาน", exc: "ความเร็ว ≤ 0 → คาดว่าอยู่ที่เดิม ไม่ปัดขึ้น", built: true },
];

export default async function HowItWorksPage() {
  const u = await currentUser();
  const v = buildView(u);
  const byActor = (a: Actor) => STEPS.filter((s) => s.actor === a).length;
  const th = {
    padding: "9px 12px", textAlign: "left" as const,
  };

  return (
    <Shell active="home">
      <div style={{ marginBottom: 18 }}>
        <div className="ga-h1">หลักการทำงาน — หนึ่งรอบของระบบ</div>
        <div className="ga-sub">
          สรุปจาก PLAN §4.1 · {STEPS.length} ขั้นตอน 4 ประเภทผู้ทำ (คน / โค้ด / Agent / โมเดล) ·
          ผลลัพธ์ทุกขั้นตอนตรวจย้อนกลับได้
        </div>
      </div>

      <div style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(["human", "code", "agent", "model"] as Actor[]).map((a) => (
          <div key={a} style={{
            background: ACTOR[a].bg, border: `1px solid ${ACTOR[a].bd}`,
            borderRadius: 10, padding: "10px 16px", minWidth: 140,
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: ACTOR[a].fg }}>
              {ACTOR[a].label}{a === "agent" && " ⭐ หัวใจของระบบ"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }} className="tnum">
              {byActor(a)} <span style={{ fontSize: 12, color: "var(--muted2)" }}>ขั้น</span>
            </div>
          </div>
        ))}
      </div>

      <Card style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
          <thead className="ga-thead" style={{ background: "var(--fill2)" }}>
            <tr>
              <th style={{ ...th, width: 34 }}>#</th>
              <th style={{ ...th, width: 86 }}>ผู้ทำ</th>
              <th style={th}>ทำอะไร</th>
              <th style={th}>ผลลัพธ์</th>
              <th style={th}>ข้อยกเว้น</th>
            </tr>
          </thead>
          <tbody>
            {STEPS.map((s) => (
              <tr key={s.n} style={{
                borderTop: "1px solid var(--line)",
                background: s.built ? undefined : "var(--fill2)",
                opacity: s.built ? 1 : 0.72,
              }}>
                <td style={{ padding: "9px 12px", fontWeight: 700 }} className="tnum">{s.n}</td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{
                    background: ACTOR[s.actor].bg, border: `1px solid ${ACTOR[s.actor].bd}`,
                    color: ACTOR[s.actor].fg, borderRadius: 6, padding: "1px 7px",
                    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    {ACTOR[s.actor].label}
                  </span>
                </td>
                <td style={{ padding: "9px 12px" }}>
                  {s.what}
                  {!s.built && (
                    <b style={{ color: "var(--warn-ink)", fontSize: 11.5 }}> · ยังไม่ได้ทำ</b>
                  )}
                </td>
                <td style={{ padding: "9px 12px", color: "var(--ink2)" }}>{s.out}</td>
                <td style={{ padding: "9px 12px", color: "var(--muted)", fontSize: 12 }}>{s.exc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14.5, marginBottom: 14 }}>
          กติกาหัวใจ — สามคอลัมน์ที่ห้ามรวมกัน
        </div>
        <ThreeColumnRule
          progress={80}
          milestoneDone={8}
          milestoneTotal={10}
          evidence={[
            { id: "E-101", itemCode: "-", title: "(ร่าง) แผนดำเนินการ", documentDate: "2026-08-01",
              uploadDate: "2026-08-02", proposedTier: "C", proposedReason: null,
              confirmedTier: null, confirmedBy: null },
            { id: "E-102", itemCode: "-", title: "บันทึกการประชุม", documentDate: "2026-08-10",
              uploadDate: "2026-08-11", proposedTier: "C", proposedReason: null,
              confirmedTier: null, confirmedBy: null },
          ]}
          verified={0}
        />
      </Card>

      <div className="ga-banner-warn">
        <div style={{ marginBottom: 6 }}>สิ่งที่ยังไม่ได้พิสูจน์ — พูดไว้ก่อน ไม่ให้ไปเจอบนเวที</div>
        <div style={{ fontWeight: 400, fontSize: 12.5, lineHeight: 1.9 }}>
          · <b>ขั้นที่ 6 (Agent) ยังไม่เคยรันกับ endpoint จริง</b> — DGX เป็น IP ภายใน
          ยิงไม่ถึงจากเครื่องที่พัฒนา · ตาราง <code>agent_run</code> ยังว่างเปล่า
          <br />
          · <b>คอลัมน์ Suggestion มาจากกฎในโค้ด ไม่ใช่โมเดล</b> — อย่าเรียกว่า AI
          <br />
          · ขั้นที่ 8–10 (ร่างคำตอบ · อนุมัติ/ตีกลับ · เอกสารรอบเดือน) ยังไม่ได้ทำ
          <br />
          · แจ้งเตือนร่างลง Outbox เท่านั้น — ในโปรเจกต์ไม่มี credential ของช่องทางใดอยู่เลย
          <br />
          · ข้อมูลทั้งหมดเป็น SYNTHETIC ตามแบบฟอร์ม {v.meta.formRef}
        </div>
      </div>
    </Shell>
  );
}
