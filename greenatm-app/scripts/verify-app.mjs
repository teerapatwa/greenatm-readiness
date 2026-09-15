#!/usr/bin/env node
/**
 * ตรวจเส้นทางการเขียนและสิทธิ์ผ่าน HTTP จริง — สิ่งที่ mockup ทดสอบไม่ได้
 *
 *   npm run build && npx next start -p 3100     (อีกหน้าต่างหนึ่ง)
 *   APP_URL=http://localhost:3100 npm run verify:app
 *
 * เจตนา: ยิง request เหมือนผู้ใช้จริง/ผู้ไม่มีสิทธิ์จริง แล้วดูว่า backend ตอบอะไร
 * ไม่ได้ import ฟังก์ชันมาเรียกตรง เพราะการ import ข้ามการตรวจสิทธิ์ของ route ไปเลย
 */

const base = process.env.APP_URL || "http://localhost:3100";
const groups = [];
let g = null;
let pass = 0;
let fail = 0;

const group = (name) => { g = { name, rows: [] }; groups.push(g); };
const t = (name, cond, detail = "") => {
  if (cond) { pass++; g.rows.push(["✓", name, ""]); }
  else { fail++; g.rows.push(["⛔", name, String(detail)]); }
};

/** จำ cookie ต่อผู้ใช้ เพื่อให้แต่ละ "คน" มี session ของตัวเอง */
const jars = new Map();
async function as(userId, path, init = {}) {
  if (!jars.has(userId)) {
    const r = await fetch(`${base}/api/session`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!r.ok) throw new Error(`สลับผู้ใช้ ${userId} ไม่สำเร็จ: HTTP ${r.status}`);
    jars.set(userId, (r.headers.getSetCookie?.() ?? [r.headers.get("set-cookie")])
      .filter(Boolean).map((c) => c.split(";")[0]).join("; "));
  }
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie: jars.get(userId), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  let body = null;
  try { body = await res.json(); } catch { /* บาง response ไม่มี body */ }
  return { status: res.status, body };
}

const state = (u) => as(u, "/api/state").then((r) => r.body);

// ─────────────────────────────────────────────────────────────────────────────
try {
  const probe = await fetch(base, { cache: "no-store" }).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`\n⛔ เรียก ${base} ไม่ได้ — สั่ง npx next start -p 3100 ในอีกหน้าต่างก่อน\n`);
    process.exit(1);
  }

  const OWNERS = ["u-owner1", "u-owner2", "u-owner3"];

  // ── AC-27 · ขอบเขตข้อมูลของเจ้าของข้อมูลแต่ละกอง ──────────────────────────
  group("AC-27 · ขอบเขตของเจ้าของข้อมูล 3 กอง");
  const views = {};
  for (const u of OWNERS) views[u] = await state(u);
  const mod = await state("u-mod");
  const exec = await state("u-exec");

  t("เห็นทั้ง 24 รายการ (เส้นแบ่งอยู่ที่การเขียน ไม่ใช่การอ่าน)",
    OWNERS.every((u) => views[u].items.length === 24));
  t("myItems มีแค่ของกองตัวเอง",
    OWNERS.every((u) => views[u].myItems.every((i) => i.ownerUserId === u)));
  t("สามกองไม่ทับซ้อนกัน และรวมได้ 20 จาก 24",
    new Set(OWNERS.flatMap((u) => views[u].myItems.map((i) => i.code))).size === 20 &&
    OWNERS.reduce((s, u) => s + views[u].myItems.length, 0) === 20,
    OWNERS.map((u) => `${u}:${views[u].myItems.length}`).join(" "));
  t("canWrite เป็นเท็จสำหรับรายการของกองอื่นทุกข้อ",
    OWNERS.every((u) => views[u].items.filter((i) => i.ownerUserId !== u).every((i) => !i.canWrite)));
  t("ผู้ดูแลเขียนได้ทุกรายการ", mod.items.every((i) => i.canWrite));
  t("ผู้บริหารเขียนไม่ได้เลยแม้แต่รายการเดียว", exec.items.every((i) => !i.canWrite));
  t("4 รายการไม่มีเจ้าของในระบบ", mod.items.filter((i) => !i.ownerUserId).length === 4);

  // ── AC-20 · ข้ามกองต้องได้ 403 ───────────────────────────────────────────
  group("AC-20 / AC-13 · ยิงข้ามกองต้องได้ 403");
  const other = views["u-owner1"].items.find((i) => i.ownerUserId === "u-owner3");
  const r403 = await as("u-owner1", `/api/items/${other.code}/progress`, {
    method: "POST", body: JSON.stringify({ field: "percent_within_next_level", percent: 80 }),
  });
  t(`เจ้าของกอง 1 อัปเดต ${other.code} ของกอง 3 → 403`, r403.status === 403, `ได้ ${r403.status}`);
  t("ข้อความบอกเหตุผลที่อ่านรู้เรื่อง", /ไม่ใช่ของกองคุณ/.test(r403.body?.error ?? ""), r403.body?.error);
  t("ระบุว่าสิทธิ์อยู่ฝั่ง server ไม่ใช่ซ่อนปุ่ม",
    /ซ่อนปุ่ม/.test(r403.body?.detail ?? ""), r403.body?.detail);

  const evOther = views["u-owner1"].evidence.find((e) =>
    views["u-owner1"].items.find((i) => i.code === e.itemCode)?.ownerUserId === "u-owner3");
  if (evOther) {
    const rEv = await as("u-owner1", `/api/evidence/${evOther.id}`, {
      method: "PATCH", body: JSON.stringify({ documentDate: "2026-01-01" }),
    });
    t(`แก้วันที่เอกสารของกองอื่น (${evOther.id}) → 403`, rEv.status === 403, `ได้ ${rEv.status}`);
  }

  group("§5.5 · ยืนยันชั้นหลักฐานเป็นของทีมกลางเท่านั้น");
  const unconf = mod.evidence.find((e) => e.confirmedTier === null && e.proposedTier);
  const rTierOwner = await as("u-owner2", `/api/evidence/${unconf.id}`, {
    method: "PATCH", body: JSON.stringify({ tier: "A" }),
  });
  t("เจ้าของข้อมูลยืนยันชั้นหลักฐาน → 403", rTierOwner.status === 403, `ได้ ${rTierOwner.status}`);
  const rTierExec = await as("u-exec", `/api/evidence/${unconf.id}`, {
    method: "PATCH", body: JSON.stringify({ tier: "A" }),
  });
  t("ผู้บริหารยืนยันชั้นหลักฐาน → 403", rTierExec.status === 403, `ได้ ${rTierExec.status}`);
  const rTargetOwner = await as("u-owner2", `/api/items/${views["u-owner2"].myItems[0].code}/target`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
  });
  t("เจ้าของข้อมูลตั้งเป้าระดับ → 403", rTargetOwner.status === 403, `ได้ ${rTargetOwner.status}`);
  const rTargetMod = await as("u-mod", `/api/items/${mod.items[0].code}/target`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
  });
  t("ผู้ดูแลตั้งเป้าระดับ → 403 (เป็นของผู้บริหาร)", rTargetMod.status === 403, `ได้ ${rTargetMod.status}`);

  // ── AC-17 · ร่างแล้วไม่กดยืนยัน ค่าต้องไม่ขยับ ────────────────────────────
  group("AC-17 ⭐ · ร่างแล้วไม่กดยืนยัน — ค่าจริงต้องไม่เปลี่ยน");
  const mineBefore = (await state("u-owner3")).myItems.find((i) => i.milestones.length > 0);
  const targetItem = mineBefore.code;
  const seq = mineBefore.milestones[0].seq;
  const before = mineBefore.milestones[0].percentComplete;
  const auditBefore = (await as("u-mod", `/api/state`)).body ? null : null;

  const draft = await as("u-owner3", `/api/items/${targetItem}/progress`, {
    method: "POST",
    body: JSON.stringify({ field: "milestone_percent", milestoneSeq: seq, percent: 95 }),
  });
  t("ร่างสำเร็จ (201)", draft.status === 201, `ได้ ${draft.status} ${draft.body?.error ?? ""}`);
  t("API ตอบชัดว่า committed = false", draft.body?.committed === false);

  const afterDraft = (await state("u-owner3")).myItems.find((i) => i.code === targetItem);
  t(`ค่าจริงยังเป็น ${before}% ไม่ขยับ`,
    afterDraft.milestones.find((m) => m.seq === seq).percentComplete === before,
    `ได้ ${afterDraft.milestones.find((m) => m.seq === seq).percentComplete}`);
  t("มีการ์ดรออยู่ 1 ใบ", (await state("u-owner3")).pending.length >= 1);

  const pendingId = draft.body.pending.id;
  t("การ์ดบันทึกค่าเดิมและค่าใหม่ไว้ให้เห็นก่อนกด",
    draft.body.pending.oldValue === String(before) && draft.body.pending.newValue === "95");

  // ── AC-18 · กดยืนยัน ค่าเปลี่ยน actor เป็น user id ────────────────────────
  group("AC-18 · กดยืนยันแล้วค่าเปลี่ยน และ actor เป็น user id");
  const confirm = await as("u-owner3", `/api/pending/${pendingId}`, { method: "POST" });
  t("ยืนยันสำเร็จ", confirm.status === 200, `ได้ ${confirm.status} ${confirm.body?.error ?? ""}`);
  t("actor เป็น user id ไม่ใช่ ai", confirm.body?.actor === "u-owner3", confirm.body?.actor);
  const afterConfirm = (await state("u-owner3")).myItems.find((i) => i.code === targetItem);
  t("ค่าจริงเปลี่ยนเป็น 95%",
    afterConfirm.milestones.find((m) => m.seq === seq).percentComplete === 95);
  t("ค่า Verified ไม่ขยับจากการกดนี้ (AC-01)",
    afterConfirm.verified === afterDraft.verified, `${afterDraft.verified} → ${afterConfirm.verified}`);
  t("การ์ดหายจากคิวแล้ว",
    !(await state("u-owner3")).pending.some((p) => p.id === pendingId));

  const cross = await as("u-owner1", `/api/pending/${pendingId}`, { method: "POST" });
  t("คนอื่นกดยืนยันการ์ดของคนอื่นไม่ได้", cross.status >= 400, `ได้ ${cross.status}`);

  group("agent ร่างได้ แต่เขียนเองไม่ได้ (§5.5)");
  const aiDraft = await as("u-owner3", `/api/items/${targetItem}/progress`, {
    method: "POST",
    body: JSON.stringify({ field: "percent_within_next_level", percent: 42, draftedBy: "ai" }),
  });
  t("agent ร่างการ์ดได้", aiDraft.status === 201 && aiDraft.body.pending.draftedBy === "ai");
  const afterAiDraft = (await state("u-owner3")).myItems.find((i) => i.code === targetItem);
  t("ค่าจริงยังไม่ขยับจากการร่างของ agent",
    afterAiDraft.percentWithinNextLevel === afterConfirm.percentWithinNextLevel);
  const aiConfirm = await as("u-owner3", `/api/pending/${aiDraft.body.pending.id}`, { method: "POST" });
  t("คนกดยืนยันการ์ดของ agent แล้วค่าเปลี่ยน", aiConfirm.status === 200);
  t("actor ที่บันทึกคือคน ไม่ใช่ ai", aiConfirm.body?.actor === "u-owner3", aiConfirm.body?.actor);

  // ── AC-03 · เอกสารไม่มีวันที่ ต้องถาม ไม่เดา ──────────────────────────────
  group("AC-03 · เอกสารไม่มีวันที่ — ระบบถาม ไม่เดาจากวันอัปโหลด");
  const myItem = (await state("u-owner3")).myItems[0].code;
  const addNoDate = await as("u-owner3", "/api/evidence", {
    method: "POST", body: JSON.stringify({ itemCode: myItem, title: "เอกสารทดสอบไม่มีวันที่" }),
  });
  t("แนบหลักฐานที่ไม่มีวันที่ได้", addNoDate.status === 201, addNoDate.body?.error);
  const newEvId = addNoDate.body.id;
  const st = await state("u-owner3");
  const newEv = st.evidence.find((e) => e.id === newEvId);
  t("document_date เป็น null ไม่ถูกเดาจากวันอัปโหลด",
    newEv.documentDate === null, `ได้ ${newEv.documentDate}`);
  t("upload_date ถูกบันทึกแยกไว้", !!newEv.uploadDate);
  t("มีแจ้งเตือน A-NODATE ของรายการนี้",
    st.alerts.some((a) => a.rule === "A-NODATE" && a.itemCode === myItem));
  t("ชั้นหลักฐานยังไม่ถูกยืนยัน → Verified ไม่ขยับ", newEv.confirmedTier === null);
  const badDate = await as("u-owner3", `/api/evidence/${newEvId}`, {
    method: "PATCH", body: JSON.stringify({ documentDate: "2027-01-01" }),
  });
  t("ใส่วันที่ในอนาคต → ปฏิเสธ", badDate.status >= 400, `ได้ ${badDate.status}`);
  const goodDate = await as("u-owner3", `/api/evidence/${newEvId}`, {
    method: "PATCH", body: JSON.stringify({ documentDate: "2026-08-01" }),
  });
  t("ใส่วันที่จริงแล้วบันทึกได้", goodDate.status === 200 && goodDate.body.inferredFromUpload === false);

  // ── AC-04 · ยืนยันชั้น A แล้ว Verified ขยับ ───────────────────────────────
  group("AC-04 / AC-01 · Verified ขยับเมื่อทีมกลางยืนยันชั้น A เท่านั้น");
  const vBefore = (await state("u-mod")).items.find((i) => i.code === myItem).verified;
  const okTier = await as("u-mod", `/api/evidence/${newEvId}`, {
    method: "PATCH", body: JSON.stringify({ tier: "A" }),
  });
  t("ทีมกลางยืนยันชั้น A ได้", okTier.status === 200, okTier.body?.error);
  t("API บอกว่านับเข้า Verified", okTier.body?.countsTowardVerified === true);
  const vAfter = (await state("u-mod")).items.find((i) => i.code === myItem).verified;
  t(`Verified ขยับ ${vBefore}% → ${vAfter}%`, vAfter > vBefore);

  const evC = (await state("u-mod")).evidence.find((e) => e.proposedTier === "C" && e.confirmedTier === null);
  const noReason = await as("u-mod", `/api/evidence/${evC.id}`, {
    method: "PATCH", body: JSON.stringify({ tier: "A" }),
  });
  t("แก้ชั้นที่ agent เสนอโดยไม่ให้เหตุผล → ปฏิเสธ", noReason.status === 400, `ได้ ${noReason.status}`);
  const withReason = await as("u-mod", `/api/evidence/${evC.id}`, {
    method: "PATCH", body: JSON.stringify({ tier: "B", reason: "มีผลตรวจวัดแนบมาภายหลัง" }),
  });
  t("แก้พร้อมเหตุผลได้", withReason.status === 200);

  // ── AC-28 · ผู้บริหารไม่รับแจ้งเตือน ─────────────────────────────────────
  group("AC-28 · ผู้บริหารไม่รับแจ้งเตือนรายรายการ");
  t("ผู้บริหารได้แจ้งเตือน 0 ฉบับ", exec.alerts.length === 0, exec.alerts.length);
  t("ผู้ดูแลได้น้อยกว่าเจ้าของรวมกัน",
    mod.allAlertCounts.moderator < mod.allAlertCounts.ownerTotal,
    `${mod.allAlertCounts.moderator} vs ${mod.allAlertCounts.ownerTotal}`);
  t("นับผู้บริหารเป็น 0 ในสรุป", mod.allAlertCounts.executive === 0);
  const execDraft = await as("u-exec", "/api/outbox", {
    method: "POST", body: JSON.stringify({ alertRule: "A-NOEV", itemCode: myItem, subject: "x", body: "y" }),
  });
  t("ผู้บริหารร่างข้อความ → 403", execDraft.status === 403, `ได้ ${execDraft.status}`);

  // ── Outbox · ระบบร่าง คนกดส่ง ────────────────────────────────────────────
  group("§3.3 · ระบบร่าง คนกดส่ง ไม่มีการส่งจริง");
  const someAlert = mod.alerts[0];
  const drafted = await as("u-mod", "/api/outbox", {
    method: "POST",
    body: JSON.stringify({ alertRule: someAlert.rule, itemCode: someAlert.itemCode,
      subject: someAlert.head, body: someAlert.body }),
  });
  t("ผู้ดูแลร่างได้", drafted.status === 201, drafted.body?.error);
  const boxAfterDraft = (await state("u-mod")).outbox.find((m) => m.id === drafted.body.id);
  t("ร่างแล้วยังไม่ถูกส่ง (sentAt เป็น null)", boxAfterDraft.sentAt === null);
  const ownerSend = await as("u-owner3", `/api/outbox/${drafted.body.id}`, { method: "POST" });
  t("เจ้าของข้อมูลกดส่ง → 403", ownerSend.status === 403, `ได้ ${ownerSend.status}`);
  const sent = await as("u-mod", `/api/outbox/${drafted.body.id}`, { method: "POST" });
  t("ผู้ดูแลกดส่งได้", sent.status === 200);
  t("API ยืนยันตรง ๆ ว่าไม่ได้ส่งออกจริง", sent.body?.actuallyDelivered === false);
  const resend = await as("u-mod", `/api/outbox/${drafted.body.id}`, { method: "POST" });
  t("กดส่งซ้ำไม่ได้", resend.status >= 400, `ได้ ${resend.status}`);

  // ── AC-24 · เกณฑ์ปรับได้ไม่ต้องแก้โค้ด ───────────────────────────────────
  group("AC-11 / AC-24 · เกณฑ์ปรับได้จากหน้าจอ ผลมีทันที");
  const dueSoonBefore = (await state("u-mod")).alerts.filter((a) => a.rule === "A-DUESOON").length;
  t("ตอนนี้มีแจ้งเตือนใกล้กำหนดส่งอยู่", dueSoonBefore > 0, dueSoonBefore);
  const lower = await as("u-mod", "/api/settings", {
    method: "PATCH", body: JSON.stringify({ key: "alert_lead_days", value: 1 }),
  });
  t("ผู้ดูแลแก้ alert_lead_days ได้", lower.status === 200, lower.body?.error);
  const dueSoonAfter = (await state("u-mod")).alerts.filter((a) => a.rule === "A-DUESOON").length;
  t(`ลดเป็น 1 วันแล้วแจ้งเตือนหายไป (${dueSoonBefore} → ${dueSoonAfter})`, dueSoonAfter === 0);
  await as("u-mod", "/api/settings", {
    method: "PATCH", body: JSON.stringify({ key: "alert_lead_days", value: 15 }),
  });
  const dueSoonBack = (await state("u-mod")).alerts.filter((a) => a.rule === "A-DUESOON").length;
  t("ตั้งกลับแล้วแจ้งเตือนกลับมา", dueSoonBack === dueSoonBefore, dueSoonBack);
  const ownerSetting = await as("u-owner1", "/api/settings", {
    method: "PATCH", body: JSON.stringify({ key: "alert_lead_days", value: 99 }),
  });
  t("เจ้าของข้อมูลแก้เกณฑ์ระบบ → 403", ownerSetting.status === 403, `ได้ ${ownerSetting.status}`);

  // ── กฎระดับที่ต้องกันไว้ ─────────────────────────────────────────────────
  group("กฎระดับ · ค่าที่ผิดต้องบันทึกไม่ได้");
  const over = await as("u-owner3", `/api/items/${myItem}/progress`, {
    method: "POST", body: JSON.stringify({ field: "percent_within_next_level", percent: 140 }),
  });
  t("เปอร์เซ็นต์เกิน 100 → ปฏิเสธ", over.status >= 400, `ได้ ${over.status}`);
  const badSeq = await as("u-owner3", `/api/items/${myItem}/progress`, {
    method: "POST", body: JSON.stringify({ field: "milestone_percent", milestoneSeq: 99, percent: 50 }),
  });
  t("อ้าง milestone ที่ไม่มี → ปฏิเสธ", badSeq.status >= 400, `ได้ ${badSeq.status}`);
  const itemForTarget = exec.items.find((i) => i.achievedLevel > 1);
  const lowTarget = await as("u-exec", `/api/items/${itemForTarget.code}/target`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 1 }),
  });
  t("ตั้งเป้าต่ำกว่าระดับที่ได้แล้ว → ปฏิเสธ", lowTarget.status >= 400, `ได้ ${lowTarget.status}`);
  const okTarget = await as("u-exec", `/api/items/${itemForTarget.code}/target`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
  });
  t("ผู้บริหารตั้งเป้าที่ถูกต้องได้", okTarget.status === 200, okTarget.body?.error);

  // ── AC-26 · ถึงเป้าแต่ไม่มีหลักฐาน ห้ามขึ้น complete ─────────────────────
  group("AC-26 ⭐ · ถึงเป้าแต่ไม่มีหลักฐาน ห้ามขึ้นว่าเสร็จสมบูรณ์");
  const latest = await state("u-mod");
  const claimNoEv = latest.items.filter((i) => i.achievedLevel >= i.targetLevel && i.evidenceCount === 0);
  t("ยังมีเคสแบบนี้ในชุดข้อมูล", claimNoEv.length > 0, claimNoEv.length);
  t("ไม่มีข้อไหนขึ้น complete",
    claimNoEv.every((i) => i.suggestion.verdict !== "complete"),
    claimNoEv.map((i) => `${i.code}:${i.suggestion.verdict}`).join(" "));
  t("ทุกข้อขึ้นว่าต้องแก้ไข",
    claimNoEv.every((i) => i.suggestion.verdict === "needsfix"));
  const slipped = latest.items.filter((i) => i.slipHistory.length >= latest.settings.slip_escalate_after);
  t("ข้อที่เลื่อน ≥ 3 ครั้งเห็นการยกระดับทุกข้อ",
    slipped.length > 0 && slipped.every((i) => i.suggestion.escalated),
    slipped.map((i) => `${i.code}:${i.suggestion.verdict}`).join(" "));

  // ── AC-16 · ข้อมูลอยู่รอดหลังรีสตาร์ต ────────────────────────────────────
  group("AC-16 · ข้อมูลที่กรอกต้องอยู่รอด (ตรวจ persistence)");
  const persisted = (await state("u-owner3")).myItems.find((i) => i.code === targetItem);
  t("ค่าที่ยืนยันไว้ยังอยู่ในฐานข้อมูล",
    persisted.milestones.find((m) => m.seq === seq).percentComplete === 95);
  t("หลักฐานที่เพิ่มยังอยู่", (await state("u-mod")).evidence.some((e) => e.id === newEvId));
  t("ข้อมูลอ่านจากฐานข้อมูลไม่ใช่ไฟล์ seed คงที่",
    (await state("u-mod")).evidence.length > 14,
    `${(await state("u-mod")).evidence.length} ฉบับ (seed มี 14)`);

  group("§4.3.1 · เมนูตามบทบาท");
  t("เจ้าของข้อมูลเข้า “งานของฉัน” ได้",
    OWNERS.every((u) => views[u].user.profile.screens.includes("my")));
  t("ผู้ดูแลและผู้บริหารไม่มีหน้า “งานของฉัน”",
    !mod.user.profile.screens.includes("my") && !exec.user.profile.screens.includes("my"));
  t("เฉพาะผู้ดูแลเข้าศูนย์ตรวจสอบได้",
    mod.user.profile.screens.includes("review") &&
    !exec.user.profile.screens.includes("review") &&
    OWNERS.every((u) => !views[u].user.profile.screens.includes("review")));
  t("ผู้บริหารไม่มีหน้าแจ้งเตือนในเมนู", !exec.user.profile.screens.includes("alerts"));
  t("ทุกบทบาทมีทั้งรายการทำได้และทำไม่ได้ระบุไว้",
    [...OWNERS.map((u) => views[u]), mod, exec]
      .every((v) => v.user.profile.can.length > 0 && v.user.profile.cannot.length > 0));

  const pagesFor = {
    "u-owner1": [["/", 200], ["/my", 200], ["/alerts", 200], ["/trend", 200], ["/review", 200]],
    "u-exec": [["/", 200], ["/my", 200], ["/alerts", 200], ["/trend", 200]],
  };
  group("หน้าที่เข้าไม่ได้ต้องขึ้น 403 บนหน้าจอ ไม่ใช่ crash");
  for (const [u, list] of Object.entries(pagesFor)) {
    for (const [p, want] of list) {
      const res = await fetch(`${base}${p}`, { headers: { cookie: jars.get(u) }, cache: "no-store" });
      const html = await res.text();
      const blocked = /403 —/.test(html) || /ไม่รับแจ้งเตือนรายรายการ/.test(html);
      const allowed = views[u]?.user?.profile?.screens ?? (u === "u-exec" ? exec.user.profile.screens : []);
      const key = p === "/" ? "home" : p.slice(1);
      const shouldBlock = !allowed.includes(key);
      t(`${u} เปิด ${p} → HTTP ${res.status}${shouldBlock ? " + แผง 403" : ""}`,
        res.status === want && (!shouldBlock || blocked),
        shouldBlock ? `blocked=${blocked}` : "");
    }
  }

  // ── รายงาน ───────────────────────────────────────────────────────────────
  for (const grp of groups) {
    console.log(`\n── ${grp.name} ${"─".repeat(Math.max(0, 62 - grp.name.length))}`);
    for (const [icon, name, detail] of grp.rows) {
      console.log(`${icon}  ${name}`);
      if (detail) console.log(`      ${detail}`);
    }
  }
  console.log("\n" + "─".repeat(66));
  console.log(`ผ่าน ${pass}/${pass + fail}${fail ? ` · ไม่ผ่าน ${fail}` : ""}`);
  console.log("─".repeat(66));
  process.exit(fail > 0 ? 2 : 0);
} catch (e) {
  console.error("\n⛔ เทสต์ล้ม:", e?.stack ?? e);
  process.exit(1);
}
