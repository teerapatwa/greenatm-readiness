import type { Evidence, Item, Seed, Settings } from "./rules";
import { progressPercent, verifiedPercent, statusFor, STATUS_LABEL } from "./rules";

/**
 * เอกสารสรุปรอบเดือน — R11 · AC-10 · AC-15
 *
 * กฎการอ้างอิงมาจาก PLAN §5.6 และบังคับไว้ที่นี่ ไม่ใช่ฝากไว้กับคนเขียนหน้าจอ:
 *
 *  · มีหลักฐานชั้น A/B ที่ยืนยันแล้ว → ข้อความ + การอ้างอิง [E-014]
 *  · มีแต่ชั้น C → ต้องเขียนว่า "อยู่ระหว่างดำเนินการ" + อ้างอิง + **บอกว่ายังไม่นับ**
 *  · ไม่มีหลักฐานเลย → 🔴 **ห้ามหายไปเงียบ ๆ** ต้องขึ้นทะเบียนหมายเหตุพร้อมเจ้าของและวันที่อัปเดตล่าสุด
 *  · ประโยคที่ไม่มีการอ้างอิง → **ส่งออกไม่ผ่าน ต้องโยน error** ไม่ใช่เตือนแล้วปล่อยผ่าน (AC-10)
 *
 * ทะเบียนหมายเหตุคือหัวใจของทั้งระบบ — สิ่งที่ไม่มีหลักฐานคือสิ่งที่หายจากรายงานง่ายที่สุด
 * การบังคับให้มันปรากฏ คือคุณค่าหลักของเครื่องมือนี้
 *
 * ทั้งไฟล์เป็น pure function ไม่มีการเรียกโมเดล — เนื้อหาทุกบรรทัดสืบกลับไปหาแถวในฐานข้อมูลได้
 */

export type Citation = { evidenceId: string; title: string; documentDate: string | null; tier: string };

export type Statement = {
  itemCode: string;
  itemName: string;
  /** ข้อความที่จะปรากฏในเอกสาร */
  text: string;
  /** ต้องมีอย่างน้อยหนึ่งรายการเสมอ ไม่งั้นส่งออกไม่ผ่าน */
  citations: Citation[];
  /** ชั้น C อ้างได้ แต่ต้องกำกับว่ายังไม่นับเข้าค่า Verified */
  notCounted: boolean;
  achievedLevel: number;
  targetLevel: number;
  verified: number;
};

export type Remark = {
  itemCode: string;
  itemName: string;
  reason: string;
  ownerTitle: string;
  lastUpdated: string;
  achievedLevel: number;
  targetLevel: number;
  status: string;
};

export type ReportSection = {
  categoryNum: number;
  categoryName: string;
  divisionName: string;
  statements: Statement[];
  /** ข้อในหมวดนี้ที่ตกไปอยู่ทะเบียนหมายเหตุ — นับไว้ให้เห็นในหัวหมวด */
  remarkCount: number;
};

export type Report = {
  meta: {
    cycle: string;
    generatedFor: string;
    today: string;
    synthetic: boolean;
    note: string;
  };
  summary: {
    totalItems: number;
    withCitation: number;
    inRemarks: number;
    meanLevel: number;
    meanLast: number;
    verifiedItems: number;
    notSubmitted: number;
    delayed: number;
  };
  sections: ReportSection[];
  remarks: Remark[];
  /** เอกสารทุกฉบับที่ถูกอ้างถึง — ภาคผนวก */
  sources: Citation[];
};

export class ReportError extends Error {
  readonly offenders: string[];
  constructor(message: string, offenders: string[]) {
    super(message);
    this.name = "ReportError";
    this.offenders = offenders;
  }
}

const fmtTier = (t: string) => `ชั้น ${t}`;

function citationOf(e: Evidence): Citation {
  return {
    evidenceId: e.id,
    title: e.title,
    documentDate: e.documentDate,
    tier: e.confirmedTier ?? "?",
  };
}

/**
 * สร้างเนื้อหารายงานจากข้อมูลจริงในฐานข้อมูล
 *
 * ไม่มีการแต่งข้อความขึ้นเอง — ทุกประโยคประกอบจากค่าที่อยู่ในแถวข้อมูล
 * ข้อไหนไม่มีหลักฐานที่ยืนยันแล้ว **ไม่เขียนประโยคให้** แต่ส่งไปทะเบียนหมายเหตุแทน
 */
export function buildReport(seed: Seed, settings: Settings): Report {
  const { items, evidence, categories, divisions, users, meta } = seed;
  const titleOf = (id: string | null) =>
    id ? users.find((u) => u.id === id)?.title ?? id : "— ไม่มีเจ้าของในระบบ —";

  const sections: ReportSection[] = [];
  const remarks: Remark[] = [];
  const sourceMap = new Map<string, Citation>();

  for (const cat of [...categories].sort((a, b) => a.num - b.num)) {
    const div = divisions.find((d) => d.id === cat.divisionId);
    const mine = items.filter((i) => i.category === cat.num);
    const statements: Statement[] = [];
    let remarkCount = 0;

    for (const it of mine) {
      const ev = evidence.filter((e) => e.itemCode === it.code);
      const confirmed = ev.filter((e) => e.confirmedTier !== null);
      const ab = confirmed.filter((e) => e.confirmedTier === "A" || e.confirmedTier === "B");
      const c = confirmed.filter((e) => e.confirmedTier === "C");

      if (ab.length > 0) {
        const cites = ab.map(citationOf);
        cites.forEach((x) => sourceMap.set(x.evidenceId, x));
        statements.push({
          itemCode: it.code,
          itemName: it.name,
          text:
            `อยู่ที่ระดับ ${it.achievedLevel} จากเป้าหมายระดับ ${it.targetLevel} · ` +
            `มีหลักฐานที่ผ่านการยืนยันแล้ว ${ab.length} ฉบับ (${ab.map((e) => fmtTier(e.confirmedTier!)).join(", ")}) ` +
            `คิดเป็น ${verifiedPercent(it, evidence)}% ของเอกสารที่แนบในรายการนี้`,
          citations: cites,
          notCounted: false,
          achievedLevel: it.achievedLevel,
          targetLevel: it.targetLevel,
          verified: verifiedPercent(it, evidence),
        });
        continue;
      }

      if (c.length > 0) {
        // ชั้น C อ้างได้ แต่ต้องเขียนว่ายังไม่นับ — ไม่งั้นอ่านเหมือนมีหลักฐานแล้ว
        const cites = c.map(citationOf);
        cites.forEach((x) => sourceMap.set(x.evidenceId, x));
        statements.push({
          itemCode: it.code,
          itemName: it.name,
          text:
            `อยู่ระหว่างดำเนินการ — มีเอกสารที่ยืนยันแล้วเป็นชั้น C ` +
            `(แผน ร่าง หรือความตั้งใจ) จำนวน ${c.length} ฉบับ · ` +
            `ความคืบหน้าที่เจ้าของข้อมูลรายงาน ${progressPercent(it)}%`,
          citations: cites,
          notCounted: true,
          achievedLevel: it.achievedLevel,
          targetLevel: it.targetLevel,
          verified: verifiedPercent(it, evidence),
        });
        continue;
      }

      /*
        ไม่มีหลักฐานที่ยืนยันแล้วเลย → ห้ามเขียนประโยคให้ในเนื้อรายงาน
        เพราะประโยคที่ไม่มีอะไรอ้างอิง คือประโยคที่ไม่ควรมีอยู่ในเอกสารฉบับนี้
        ส่งไปทะเบียนหมายเหตุแทน พร้อมชื่อเจ้าของและวันที่อัปเดตล่าสุด
      */
      remarkCount += 1;
      remarks.push({
        itemCode: it.code,
        itemName: it.name,
        reason:
          ev.length === 0
            ? "ยังไม่มีเอกสารแนบเลย"
            : `มีเอกสารแนบ ${ev.length} ฉบับ แต่ยังไม่มีฉบับใดผ่านการยืนยันชั้นจากทีมกลาง`,
        ownerTitle: titleOf(it.ownerUserId),
        lastUpdated: it.lastUpdated,
        achievedLevel: it.achievedLevel,
        targetLevel: it.targetLevel,
        status: STATUS_LABEL[statusFor(it, settings, meta.today)],
      });
    }

    sections.push({
      categoryNum: cat.num,
      categoryName: cat.name,
      divisionName: div?.name ?? "—",
      statements,
      remarkCount,
    });
  }

  const avg = (a: number[]) => (a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length);
  const withCitation = sections.reduce((s, x) => s + x.statements.length, 0);

  return {
    meta: {
      cycle: meta.cycle,
      generatedFor: meta.cycleDue,
      today: meta.today,
      synthetic: meta.synthetic,
      note: meta.note,
    },
    summary: {
      totalItems: items.length,
      withCitation,
      inRemarks: remarks.length,
      meanLevel: avg(items.map((i) => i.achievedLevel)),
      meanLast: avg(items.map((i) => i.lastYearLevel)),
      verifiedItems: items.filter((i) => verifiedPercent(i, evidence) > 0).length,
      notSubmitted: items.filter((i) => !i.submittedThisCycle).length,
      delayed: items.filter((i) => statusFor(i, settings, meta.today) === "delayed").length,
    },
    sections,
    remarks,
    sources: [...sourceMap.values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
  };
}

/**
 * ประตูก่อนส่งออก — AC-10
 *
 * ประโยคที่ไม่มีการอ้างอิงต้องทำให้ **ส่งออกไม่ผ่าน** ไม่ใช่เตือนแล้วปล่อยผ่าน
 * และทุกข้อต้องไปอยู่ที่ใดที่หนึ่ง: ถ้าไม่อยู่ในเนื้อรายงาน ต้องอยู่ในทะเบียนหมายเหตุ
 * ข้อที่หายไปทั้งสองที่ คือข้อที่เงียบหายจากรายงาน ซึ่งเป็นสิ่งที่ระบบนี้มีไว้เพื่อป้องกัน
 */
export function assertExportable(r: Report): void {
  const noCite = r.sections
    .flatMap((s) => s.statements)
    .filter((st) => st.citations.length === 0)
    .map((st) => st.itemCode);
  if (noCite.length > 0) {
    throw new ReportError(
      `ส่งออกไม่ได้ — มี ${noCite.length} ประโยคที่ไม่มีการอ้างอิงหลักฐาน`,
      noCite,
    );
  }

  const accounted = r.summary.withCitation + r.summary.inRemarks;
  if (accounted !== r.summary.totalItems) {
    throw new ReportError(
      `ส่งออกไม่ได้ — มี ${r.summary.totalItems - accounted} รายการที่ไม่ปรากฏทั้งในเนื้อรายงานและทะเบียนหมายเหตุ`,
      [],
    );
  }
}
