import { currentUser } from "@/lib/auth/session";
import { canSee } from "@/lib/auth/perms";
import { snapshot, settings } from "@/lib/db/queries";
import { buildReport, assertExportable, ReportError, type Report } from "@/lib/data/report";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * เอกสารสรุปรอบเดือน — ดูเนื้อหา (GET) และส่งออกเป็นไฟล์ (?format=)
 *
 * เนื้อหาทั้งหมดสร้างจากแถวในฐานข้อมูล **ไม่มีการเรียกโมเดล ไม่มีประโยคที่แต่งขึ้นเอง**
 * และผ่านประตู assertExportable ก่อนเสมอ — ประโยคที่ไม่มีการอ้างอิงทำให้ส่งออกล้มเหลว (AC-10)
 */
export async function GET(req: Request) {
  try {
    const u = await currentUser();
    // ใครเห็นหน้าแนวโน้มได้ ก็เห็นรายงานได้ — เป็นภาพรวมองค์กร ไม่ใช่ข้อมูลรายกอง
    if (!canSee(u.role, "trend")) {
      return fail(new Error("หน้านี้เป็นภาพระดับองค์กร สำหรับผู้ดูแลและผู้บริหาร"));
    }

    const r = buildReport(snapshot(), settings());
    const format = new URL(req.url).searchParams.get("format");
    if (!format) return ok(r);

    assertExportable(r); // ล้มก่อนเขียนไฟล์ ไม่ใช่เขียนไปแล้วค่อยเตือน

    const stamp = `${r.meta.cycle}`;
    if (format === "json") {
      return file(JSON.stringify(r, null, 2), `greenatm-report-${stamp}.json`, "application/json");
    }
    if (format === "md") {
      return file(toMarkdown(r), `greenatm-report-${stamp}.md`, "text/markdown");
    }
    if (format === "html") {
      return file(toHtml(r), `greenatm-report-${stamp}.html`, "text/html");
    }
    return fail(new Error(`รูปแบบ "${format}" ไม่รองรับ — ใช้ html, md หรือ json`));
  } catch (e) {
    if (e instanceof ReportError) {
      return Response.json(
        { error: e.message, detail: e.offenders.join(" · ") || null, exportBlocked: true },
        { status: 409 },
      );
    }
    return fail(e);
  }
}

function file(body: string, name: string, type: string) {
  return new Response(body, {
    headers: {
      "content-type": `${type}; charset=utf-8`,
      // ชื่อไฟล์เป็น ASCII ล้วน — กันปัญหา header บนเครื่องที่ไม่ใช่ UTF-8
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

const BANNER =
  "ข้อมูลสังเคราะห์เพื่อการสาธิตเท่านั้น ไม่ใช่สถานะจริงขององค์กร · " +
  "ผู้รับผิดชอบเป็นชื่อตำแหน่ง ไม่ใช่ชื่อบุคคลจริง";

function toMarkdown(r: Report): string {
  const L: string[] = [];
  L.push(`# เอกสารสรุปความพร้อมด้านหลักฐาน — รอบ ${r.meta.cycle}`);
  L.push("");
  L.push(`> ⚠️ **${BANNER}**`);
  L.push(`> สร้างเมื่อ ${r.meta.today} · กำหนดส่งรอบนี้ ${r.meta.generatedFor}`);
  L.push("");
  L.push("## สรุปผู้บริหาร");
  L.push("");
  L.push("| | |");
  L.push("|---|---|");
  L.push(`| ข้อประเมินทั้งหมด | ${r.summary.totalItems} |`);
  L.push(`| มีข้อความพร้อมการอ้างอิง | **${r.summary.withCitation}** |`);
  L.push(`| อยู่ในทะเบียนหมายเหตุ | **${r.summary.inRemarks}** |`);
  L.push(`| Level เฉลี่ย | ${r.summary.meanLevel.toFixed(2)} (เดิม ${r.summary.meanLast.toFixed(2)}) |`);
  L.push(`| มีหลักฐานยืนยันแล้วอย่างน้อยหนึ่งฉบับ | ${r.summary.verifiedItems} |`);
  L.push(`| ยังไม่ส่งข้อมูลรอบนี้ | ${r.summary.notSubmitted} |`);
  L.push(`| สถานะช้ากว่าแผน | ${r.summary.delayed} |`);
  L.push("");

  for (const s of r.sections) {
    L.push(`## หมวด ${s.categoryNum} · ${s.categoryName}`);
    L.push(`*${s.divisionName}*`);
    L.push("");
    if (s.statements.length === 0) {
      L.push("_ไม่มีรายการใดในหมวดนี้ที่มีหลักฐานยืนยันแล้ว — ดูทะเบียนหมายเหตุท้ายเอกสาร_");
    }
    for (const st of s.statements) {
      const cites = st.citations.map((c) => `[${c.evidenceId}]`).join(" ");
      L.push(`- **${st.itemCode} ${st.itemName}** — ${st.text} ${cites}`);
      if (st.notCounted) {
        L.push(`  - ⚠️ *เอกสารชั้น C ยังไม่นับเข้าค่าหลักฐานที่ยืนยันแล้ว — แผนไม่ใช่หลักฐานของผลลัพธ์*`);
      }
    }
    if (s.remarkCount > 0) {
      L.push("");
      L.push(`> หมวดนี้มีอีก **${s.remarkCount}** รายการอยู่ในทะเบียนหมายเหตุ`);
    }
    L.push("");
  }

  L.push("---");
  L.push("");
  L.push(`## 🔴 ทะเบียนหมายเหตุ — ${r.remarks.length} รายการที่ยังพิสูจน์ไม่ได้`);
  L.push("");
  L.push("> รายการเหล่านี้**ไม่ถูกละไว้เงียบ ๆ** การบังคับให้สิ่งที่ไม่มีหลักฐานปรากฏในรายงาน");
  L.push("> คือเหตุผลหลักที่เครื่องมือนี้มีอยู่");
  L.push("");
  L.push("| ข้อ | รายการ | เหตุผล | ผู้รับผิดชอบ | อัปเดตล่าสุด | ระดับ | สถานะ |");
  L.push("|---|---|---|---|---|:-:|---|");
  for (const m of r.remarks) {
    L.push(
      `| ${m.itemCode} | ${m.itemName} | ${m.reason} | ${m.ownerTitle} | ${m.lastUpdated} | ` +
        `${m.achievedLevel} → ${m.targetLevel} | ${m.status} |`,
    );
  }
  L.push("");
  L.push("---");
  L.push("");
  L.push(`## ภาคผนวก · เอกสารที่ถูกอ้างถึง (${r.sources.length} ฉบับ)`);
  L.push("");
  L.push("| รหัส | ชื่อเอกสาร | วันที่ในเอกสาร | ชั้นที่ยืนยันแล้ว |");
  L.push("|---|---|---|:-:|");
  for (const c of r.sources) {
    L.push(`| ${c.evidenceId} | ${c.title} | ${c.documentDate ?? "— ไม่ระบุ —"} | ${c.tier} |`);
  }
  L.push("");
  L.push("---");
  L.push("");
  L.push("*เอกสารนี้สร้างจากข้อมูลในระบบโดยตรง ทุกข้อความสืบกลับไปหาเอกสารต้นทางได้*");
  L.push("*ไม่มีประโยคใดในเอกสารนี้แต่งขึ้นโดยโมเดลภาษา*");
  return L.join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toHtml(r: Report): string {
  /*
    HTML เดี่ยว ๆ ไม่มี asset ภายนอก — เปิดบนเครื่องที่ไม่มีเน็ตได้ และสั่งพิมพ์เป็น PDF ได้จากเบราว์เซอร์
    เป็นทางที่ถูกกติกาที่สุด: ไม่ต้องพึ่ง CDN และไม่ต้องติดตั้งไลบรารีสร้าง PDF เพิ่ม
  */
  const rows = (arr: string[][]) =>
    arr.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n");

  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<title>เอกสารสรุปความพร้อมด้านหลักฐาน — รอบ ${esc(r.meta.cycle)}</title>
<style>
  body { font-family: "Noto Sans Thai", "Leelawadee UI", system-ui, sans-serif;
         color: #152922; max-width: 900px; margin: 32px auto; padding: 0 20px; line-height: 1.7; }
  h1 { font-size: 22px; } h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #e2e6e0; padding-bottom: 6px; }
  .warn { background: #fff5e0; border: 1px solid #f0d9a8; border-radius: 8px; padding: 12px 16px; font-size: 13.5px; color: #7a5c12; }
  .remarks { background: #fdf2f0; border: 1px solid #f0c3bb; border-left: 4px solid #c0392b; border-radius: 8px; padding: 12px 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 8px; }
  th, td { border: 1px solid #e2e6e0; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f7f8f6; font-size: 11.5px; text-transform: uppercase; color: #7c8a80; }
  code { background: #f1f3ef; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  li { margin-bottom: 8px; } .nc { color: #7a5c12; font-size: 12.5px; }
  .muted { color: #7c8a80; font-size: 12.5px; }
  @media print { body { margin: 0; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head><body>

<h1>เอกสารสรุปความพร้อมด้านหลักฐาน — รอบ ${esc(r.meta.cycle)}</h1>
<p class="warn">⚠️ <b>${esc(BANNER)}</b><br>สร้างเมื่อ ${esc(r.meta.today)} · กำหนดส่งรอบนี้ ${esc(r.meta.generatedFor)}</p>

<h2>สรุปผู้บริหาร</h2>
<table>${rows([
    ["ข้อประเมินทั้งหมด", String(r.summary.totalItems)],
    ["มีข้อความพร้อมการอ้างอิง", `<b>${r.summary.withCitation}</b>`],
    ["อยู่ในทะเบียนหมายเหตุ", `<b>${r.summary.inRemarks}</b>`],
    ["Level เฉลี่ย", `${r.summary.meanLevel.toFixed(2)} (เดิม ${r.summary.meanLast.toFixed(2)})`],
    ["มีหลักฐานยืนยันแล้วอย่างน้อยหนึ่งฉบับ", String(r.summary.verifiedItems)],
    ["ยังไม่ส่งข้อมูลรอบนี้", String(r.summary.notSubmitted)],
    ["สถานะช้ากว่าแผน", String(r.summary.delayed)],
  ])}</table>

${r.sections.map((s) => `
<h2>หมวด ${s.categoryNum} · ${esc(s.categoryName)}</h2>
<p class="muted">${esc(s.divisionName)}</p>
${s.statements.length === 0
      ? `<p class="muted"><i>ไม่มีรายการใดในหมวดนี้ที่มีหลักฐานยืนยันแล้ว — ดูทะเบียนหมายเหตุท้ายเอกสาร</i></p>`
      : `<ul>${s.statements.map((st) => `
  <li><b>${esc(st.itemCode)} ${esc(st.itemName)}</b> — ${esc(st.text)}
      ${st.citations.map((c) => `<code>[${esc(c.evidenceId)}]</code>`).join(" ")}
      ${st.notCounted ? `<div class="nc">⚠️ เอกสารชั้น C ยังไม่นับเข้าค่าหลักฐานที่ยืนยันแล้ว — แผนไม่ใช่หลักฐานของผลลัพธ์</div>` : ""}
  </li>`).join("")}</ul>`}
${s.remarkCount > 0 ? `<p class="muted">หมวดนี้มีอีก <b>${s.remarkCount}</b> รายการอยู่ในทะเบียนหมายเหตุ</p>` : ""}
`).join("")}

<h2>🔴 ทะเบียนหมายเหตุ — ${r.remarks.length} รายการที่ยังพิสูจน์ไม่ได้</h2>
<p class="remarks">รายการเหล่านี้<b>ไม่ถูกละไว้เงียบ ๆ</b> — การบังคับให้สิ่งที่ไม่มีหลักฐานปรากฏในรายงาน
คือเหตุผลหลักที่เครื่องมือนี้มีอยู่</p>
<table>
<tr><th>ข้อ</th><th>รายการ</th><th>เหตุผล</th><th>ผู้รับผิดชอบ</th><th>อัปเดตล่าสุด</th><th>ระดับ</th><th>สถานะ</th></tr>
${rows(r.remarks.map((m) => [
    esc(m.itemCode), esc(m.itemName), esc(m.reason), esc(m.ownerTitle),
    esc(m.lastUpdated), `${m.achievedLevel} → ${m.targetLevel}`, esc(m.status),
  ]))}
</table>

<h2>ภาคผนวก · เอกสารที่ถูกอ้างถึง (${r.sources.length} ฉบับ)</h2>
<table>
<tr><th>รหัส</th><th>ชื่อเอกสาร</th><th>วันที่ในเอกสาร</th><th>ชั้นที่ยืนยันแล้ว</th></tr>
${rows(r.sources.map((c) => [
    `<code>${esc(c.evidenceId)}</code>`, esc(c.title),
    c.documentDate ? esc(c.documentDate) : "<i>— ไม่ระบุ —</i>", esc(c.tier),
  ]))}
</table>

<p class="muted" style="margin-top:28px">
เอกสารนี้สร้างจากข้อมูลในระบบโดยตรง ทุกข้อความสืบกลับไปหาเอกสารต้นทางได้ ·
<b>ไม่มีประโยคใดในเอกสารนี้แต่งขึ้นโดยโมเดลภาษา</b>
</p>
</body></html>`;
}
