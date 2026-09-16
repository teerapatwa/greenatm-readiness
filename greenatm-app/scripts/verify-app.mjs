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

/*
  สภาพชั้นหลักฐานตั้งต้น + ฟังก์ชันคืนค่า

  อยู่นอก try เพราะต้องเรียกใน finally ด้วย — ถ้าชุดทดสอบล้มกลางคันแล้วไม่คืนค่า
  ข้อมูลจะเพี้ยนค้าง แล้วรอบถัดไปจะล้มเร็วกว่าเดิม กลายเป็นวงจรที่ซ่อมตัวเองไม่ได้
*/
/*
  ตาข่ายชั้นแรก: สำรองทั้งฐานข้อมูลก่อนเริ่ม แล้วย้อนกลับใน finally

  คืนชั้นหลักฐานอย่างเดียวไม่พอ — ชุดตรวจแตะความคืบหน้า ขั้นของแผน หลักฐานที่สร้างใหม่
  และ audit ด้วย ถ้าล้มกลางคันสิ่งเหล่านั้นค้างอยู่ แล้ว verify:seed รอบถัดไปจะไม่ผ่าน
  (เคยเจอจริง: milestone เลยกำหนดกลายเป็น 3 จาก 2 · แจ้งเตือนถึงผู้ดูแล 9 จาก 8)
*/
const GUARD = "ก่อนชุดตรวจอัตโนมัติ";
let guard = null;
let guardName = GUARD;

async function takeGuard() {
  /*
    เจอจุดกันข้อมูลค้างจากรอบก่อน = รอบนั้นถูก kill กลางคัน

    **ห้ามย้อนกลับไปหาอัตโนมัติ** — เคยทำแล้วพัง: ระหว่างนั้นคนแนบหลักฐานจริงเข้ามา
    การย้อนกลับจึงลบงานของคนทิ้งไปด้วย · ชุดตรวจไม่มีสิทธิ์ตัดสินใจแทนคนว่าข้อมูลไหนทิ้งได้
    ให้บอกแล้วเก็บไฟล์นั้นไว้ ให้คนเลือกเองว่าจะย้อนหรือไม่
  */
  const stale = (await as("u-mod", "/api/demo/snapshots")).body?.snapshots
    ?.find((s) => s.name.startsWith(GUARD));
  if (stale) {
    console.log(`\n⚠ พบจุดกันข้อมูลค้างจากรอบก่อนที่ถูกปิดกลางคัน: "${stale.name}"`);
    console.log("   ชุดตรวจ**ไม่ย้อนกลับให้อัตโนมัติ** เพราะอาจมีงานที่คนทำเพิ่มหลังจากนั้น");
    console.log("   ถ้าข้อมูลดูเพี้ยน ให้ย้อนเองที่ศูนย์ตรวจสอบ → เครื่องมือเดโม\n");
  }
  // ชื่อไม่ซ้ำกันทุกรอบ — ของค้างจากรอบก่อนจึงไม่ถูกทับหรือถูกลบโดยบังเอิญ
  guardName = `${GUARD} ${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
  const r = await as("u-mod", "/api/demo/snapshots", {
    method: "POST", body: JSON.stringify({ name: guardName }),
  });
  guard = r.status < 300 ? guardName : null;
  return r;
}

async function releaseGuard() {
  if (!guard) return { ok: false, skipped: true };
  const name = guard;
  guard = null; // กันเรียกซ้ำจาก finally หลังจากเรียกไปแล้ว
  const r = await as("u-mod", `/api/demo/snapshots/${encodeURIComponent(name)}`, { method: "POST" });
  // ลบทั้งจุดกันข้อมูลและสำเนากันพลาดที่การย้อนสร้างให้ ไม่ทิ้งไฟล์ค้างไว้
  for (const n of [name, r.body?.safetyCopy].filter(Boolean)) {
    await as("u-mod", `/api/demo/snapshots/${encodeURIComponent(n)}`, { method: "DELETE" });
  }
  return { ok: r.status < 300, error: r.body?.error };
}

let tierBaseline = [];
async function restoreTiers() {
  if (tierBaseline.length === 0) return { restored: false, drift: [], unconfirmed: -1 };
  for (const b of tierBaseline) {
    const now = (await state("u-mod")).evidence.find((e) => e.id === b.id);
    if (!now || now.confirmedTier === b.confirmedTier) continue;
    await as("u-mod", `/api/evidence/${b.id}`, {
      method: "PATCH",
      body: JSON.stringify(
        b.confirmedTier === null
          ? { tier: null, reason: "คืนสภาพหลังชุดทดสอบ" }
          : { tier: b.confirmedTier, reason: "คืนสภาพหลังชุดทดสอบ" }),
    });
  }
  const after = (await state("u-mod")).evidence;
  const drift = tierBaseline.filter((b) => {
    const now = after.find((e) => e.id === b.id);
    return now && now.confirmedTier !== b.confirmedTier;
  });
  return {
    restored: true, drift,
    unconfirmed: after.filter((e) => e.confirmedTier === null).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
let code = 0;
try {
  const probe = await fetch(base, { cache: "no-store" }).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`\n⛔ เรียก ${base} ไม่ได้ — สั่ง npx next start -p 3100 ในอีกหน้าต่างก่อน\n`);
    process.exit(1);
  }

  const OWNERS = ["u-owner1", "u-owner2", "u-owner3"];

  /*
    จำสภาพชั้นหลักฐานตั้งแต่ต้น แล้วคืนตอนจบ

    เคยพลาด: เทสต์ยืนยันชั้นแล้วไม่ถอนคืน ทำให้หลักฐานที่ยังไม่ยืนยันหมดไปจาก 11 เหลือ 0
    รอบถัดไปจึงหา unconf ไม่เจอแล้วล้มทั้งชุด · และ verify:seed ที่ยืนยันว่า
    "3.2 ต้องมี Verified = 0" ก็ไม่ผ่าน
  */
  const guarded = await takeGuard();
  if (guarded.status >= 300) {
    console.error(`\n⛔ สำรองฐานข้อมูลก่อนทดสอบไม่สำเร็จ: ${guarded.body?.error ?? guarded.status}`);
    console.error("   ชุดตรวจนี้แก้ข้อมูลจริง จึงไม่ยอมเริ่มถ้ายังไม่มีทางย้อนกลับ\n");
    process.exit(1);
  }

  tierBaseline = (await as("u-mod", "/api/state")).body.evidence
    .map((e) => ({ id: e.id, confirmedTier: e.confirmedTier }));
  const evidenceAtStart = new Set(tierBaseline.map((b) => b.id));
  /*
    จำนวนแจ้งเตือนตั้งต้น — อ่านจากของจริง ไม่ผูกกับเลข 27 ของ seed
    เพราะฐานข้อมูลที่ใช้ซ้อมจะมีหลักฐานที่คนเพิ่มเข้ามาเอง แล้วจำนวนแจ้งเตือนก็เปลี่ยนตาม
    ชุดตรวจนี้มีหน้าที่ยืนยันว่า "คืนสภาพครบ" ไม่ใช่ยืนยันว่า "ข้อมูลเป็น seed"
    (หน้าที่หลังเป็นของ verify:seed)
  */
  const alertsAtStart = (await state("u-mod")).allAlertCounts.ownerTotal;

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
  /*
    ถ้าไม่เหลือหลักฐานที่ยังไม่ยืนยันเลย (เช่นรอบก่อนล้มก่อนถึงขั้นคืนค่า)
    ให้เพิกถอนคืนมาหนึ่งชิ้นก่อน ดีกว่าล้มทั้งชุดเพราะสภาพข้อมูลตั้งต้น
  */
  let unconf = mod.evidence.find((e) => e.confirmedTier === null && e.proposedTier);
  if (!unconf) {
    const victim = mod.evidence.find((e) => e.proposedTier);
    if (victim) {
      await as("u-mod", `/api/evidence/${victim.id}`, {
        method: "PATCH",
        body: JSON.stringify({ tier: null, reason: "เตรียมสภาพให้ชุดทดสอบ" }),
      });
      unconf = (await state("u-mod")).evidence.find((e) => e.id === victim.id);
    }
  }
  t("มีหลักฐานที่ยังไม่ยืนยันให้ทดสอบ", !!unconf && !unconf.confirmedTier,
    "ไม่มีเลย แม้พยายามเพิกถอนคืนแล้ว");
  if (!unconf) throw new Error("ไม่มีหลักฐานที่ยังไม่ยืนยัน — สั่ง npm run db:reset ก่อน");
  const rTierOwner = await as("u-owner2", `/api/evidence/${unconf.id}`, {
    method: "PATCH", body: JSON.stringify({ tier: "A" }),
  });
  t("เจ้าของข้อมูลยืนยันชั้นหลักฐาน → 403", rTierOwner.status === 403, `ได้ ${rTierOwner.status}`);
  const rTierExec = await as("u-exec", `/api/evidence/${unconf.id}`, {
    method: "PATCH", body: JSON.stringify({ tier: "A" }),
  });
  t("ผู้บริหารยืนยันชั้นหลักฐาน → 403", rTierExec.status === 403, `ได้ ${rTierExec.status}`);
  const rTargetOwner = await as("u-owner2", `/api/items/${views["u-owner2"].myItems[0].code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
  });
  t("เจ้าของข้อมูลตั้งเป้าระดับ → 403", rTargetOwner.status === 403, `ได้ ${rTargetOwner.status}`);
  const rNameOwner = await as("u-owner2", `/api/items/${views["u-owner2"].myItems[0].code}`, {
    method: "PATCH", body: JSON.stringify({ name: "ชื่อที่เจ้าของข้อมูลพยายามแก้" }),
  });
  t("เจ้าของข้อมูลแก้ชื่อหัวข้อ → 403", rNameOwner.status === 403, `ได้ ${rNameOwner.status}`);
  const rOwnerAssign = await as("u-owner2", `/api/items/${views["u-owner2"].myItems[0].code}`, {
    method: "PATCH", body: JSON.stringify({ ownerUserId: "u-owner1" }),
  });
  t("เจ้าของข้อมูลมอบหมายผู้รับผิดชอบ → 403", rOwnerAssign.status === 403, `ได้ ${rOwnerAssign.status}`);
  const rExecName = await as("u-exec", `/api/items/${exec.items[0].code}`, {
    method: "PATCH", body: JSON.stringify({ name: "ผู้บริหารพยายามแก้ชื่อ" }),
  });
  t("ผู้บริหารแก้ชื่อหัวข้อ → 403 (ตั้งเป้าได้ แต่แก้หัวข้อไม่ได้)", rExecName.status === 403, `ได้ ${rExecName.status}`);

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
  const lowTarget = await as("u-exec", `/api/items/${itemForTarget.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 1 }),
  });
  t("ตั้งเป้าต่ำกว่าระดับที่ได้แล้ว → ปฏิเสธ", lowTarget.status >= 400, `ได้ ${lowTarget.status}`);
  const okTarget = await as("u-exec", `/api/items/${itemForTarget.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
  });
  t("ผู้บริหารตั้งเป้าที่ถูกต้องได้", okTarget.status === 200, okTarget.body?.error);

  group("§5.5 · ทีมกลางแก้หัวข้อ · มอบหมายผู้รับผิดชอบ · ตั้งเป้า (ที่ผู้ใช้แจ้งว่าทำไม่ได้)");
  const orphan = mod.items.find((i) => !i.ownerUserId);
  t(`ยังมีรายการที่ไม่มีเจ้าของให้มอบหมาย (${orphan?.code})`, !!orphan);
  const origOrphan = { target: orphan.targetLevel, name: orphan.name };
  const modTarget = await as("u-mod", `/api/items/${orphan.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 4 }),
  });
  t("ผู้ดูแลตั้งเป้าระดับได้ (ตาม PLAN §5.5)", modTarget.status === 200, modTarget.body?.error);
  t("เป้าเปลี่ยนเป็น 4 จริง", modTarget.body?.item?.targetLevel === 4, modTarget.body?.item?.targetLevel);

  const rename = await as("u-mod", `/api/items/${orphan.code}`, {
    method: "PATCH", body: JSON.stringify({ name: origOrphan.name + " (ปรับชื่อโดยทีมกลาง)" }),
  });
  t("ผู้ดูแลแก้ชื่อหัวข้อได้", rename.status === 200, rename.body?.error);
  t("ชื่อใหม่ถูกบันทึก", rename.body?.item?.name?.includes("ปรับชื่อโดยทีมกลาง"));
  const tooShort = await as("u-mod", `/api/items/${orphan.code}`, {
    method: "PATCH", body: JSON.stringify({ name: "ก" }),
  });
  t("ชื่อสั้นเกินไป → ปฏิเสธ", tooShort.status >= 400, `ได้ ${tooShort.status}`);

  const wrongDiv = mod.users.find((x) => x.role === "owner" && x.divisionId !== orphan.divisionId);
  const badAssign = await as("u-mod", `/api/items/${orphan.code}`, {
    method: "PATCH", body: JSON.stringify({ ownerUserId: wrongDiv.id }),
  });
  t("มอบหมายให้คนจากกองอื่น → ปฏิเสธพร้อมเหตุผล", badAssign.status >= 400,
    badAssign.body?.error);
  t("เหตุผลบอกว่าสิทธิ์จะตรวจไม่ผ่าน", /สิทธิ์จะตรวจไม่ผ่าน/.test(badAssign.body?.error ?? ""));
  const notOwnerRole = await as("u-mod", `/api/items/${orphan.code}`, {
    method: "PATCH", body: JSON.stringify({ ownerUserId: "u-exec" }),
  });
  t("มอบหมายให้ผู้บริหาร → ปฏิเสธ", notOwnerRole.status >= 400, notOwnerRole.body?.error);

  group("§5.5 · ระดับที่ได้ขยับด้วยหลักฐาน ไม่ใช่ด้วยการกรอก");
  const noEv = mod.items.find((i) => i.evidenceCount === 0 && i.achievedLevel < 5);
  const raiseTgt = await as("u-mod", `/api/items/${noEv.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
  });
  t(`ตั้งเป้า ${noEv.code} เป็น 5 ได้`, raiseTgt.status === 200, raiseTgt.body?.error);
  const raiseNoEv = await as("u-mod", `/api/items/${noEv.code}`, {
    method: "PATCH", body: JSON.stringify({ achievedLevel: noEv.achievedLevel + 1 }),
  });
  t("ขึ้นระดับโดยไม่มีหลักฐานยืนยัน → ปฏิเสธ", raiseNoEv.status >= 400, raiseNoEv.body?.error);
  t("เหตุผลบอกว่าต้องมีหลักฐานชั้น A/B",
    /หลักฐานชั้น A\/B/.test(raiseNoEv.body?.error ?? ""), raiseNoEv.body?.error);
  const withEv = (await state("u-mod")).items.find(
    (i) => i.achievedLevel < 5 &&
      mod.evidence.some((e) => e.itemCode === i.code && (e.confirmedTier === "A" || e.confirmedTier === "B")));
  if (withEv) {
    // เก็บค่าเดิมไว้คืนทีหลัง — เทสต์ต้องไม่ทำข้อมูลเดโมเพี้ยนเมื่อรันซ้ำ
    const orig = { achieved: withEv.achievedLevel, target: withEv.targetLevel };
    await as("u-mod", `/api/items/${withEv.code}`, {
      method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
    });
    const raiseOk = await as("u-mod", `/api/items/${withEv.code}`, {
      method: "PATCH", body: JSON.stringify({ achievedLevel: orig.achieved + 1 }),
    });
    t(`ขึ้นระดับ ${withEv.code} ได้เพราะมีหลักฐานยืนยันรองรับ`, raiseOk.status === 200, raiseOk.body?.error);
    t("ระดับใหม่ถูกบันทึก", raiseOk.body?.item?.achievedLevel === orig.achieved + 1);
    // คืนค่าเดิม: ต้องลดระดับก่อน แล้วจึงลดเป้า (เป้าห้ามต่ำกว่าระดับที่ได้)
    await as("u-mod", `/api/items/${withEv.code}`, {
      method: "PATCH", body: JSON.stringify({ achievedLevel: orig.achieved }),
    });
    await as("u-mod", `/api/items/${withEv.code}`, {
      method: "PATCH", body: JSON.stringify({ targetLevel: orig.target }),
    });
    const restored = (await state("u-mod")).items.find((i) => i.code === withEv.code);
    t(`คืนค่า ${withEv.code} กลับเป็นเดิมแล้ว — รันเทสต์ซ้ำได้ไม่ทำข้อมูลเพี้ยน`,
      restored.achievedLevel === orig.achieved && restored.targetLevel === orig.target,
      `ได้ ${restored.achievedLevel}/${restored.targetLevel} ต้องได้ ${orig.achieved}/${orig.target}`);
  }
  const overTarget = await as("u-mod", `/api/items/${noEv.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 2, achievedLevel: 5 }),
  });
  t("ระดับที่ได้สูงกว่าเป้า → ปฏิเสธ", overTarget.status >= 400, overTarget.body?.error);

  // คืนค่าที่เทสต์กลุ่มนี้แก้ไว้ ให้ข้อมูลเดโมกลับเป็นเดิม
  await as("u-mod", `/api/items/${orphan.code}`, {
    method: "PATCH", body: JSON.stringify({ name: origOrphan.name, targetLevel: origOrphan.target }),
  });
  await as("u-mod", `/api/items/${noEv.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: noEv.targetLevel }),
  });
  await as("u-exec", `/api/items/${itemForTarget.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: itemForTarget.targetLevel }),
  });
  const back = await state("u-mod");
  t("คืนค่าทุกรายการที่เทสต์แก้ กลับเป็นเดิมครบ",
    back.items.find((i) => i.code === orphan.code).name === origOrphan.name &&
    back.items.find((i) => i.code === orphan.code).targetLevel === origOrphan.target &&
    back.items.find((i) => i.code === noEv.code).targetLevel === noEv.targetLevel &&
    back.items.find((i) => i.code === itemForTarget.code).targetLevel === itemForTarget.targetLevel);

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

  /*
    คืนค่า milestone กลับเป็นค่าเดิม
    ถ้าไม่คืน: ขั้นที่เคย 100% จะค้างที่ 95% → กลายเป็น "เลยกำหนดแผน"
    → เกิดแจ้งเตือน A-MILESTONE เพิ่ม → verify:seed ที่ยืนยันจำนวนแจ้งเตือนแบบเป๊ะจะไม่ผ่าน
    เทสต์ต้องไม่ทำให้เทสต์อีกชุดพัง
  */
  const back1 = await as("u-owner3", `/api/items/${targetItem}/progress`, {
    method: "POST",
    body: JSON.stringify({ field: "milestone_percent", milestoneSeq: seq, percent: before }),
  });
  await as("u-owner3", `/api/pending/${back1.body.pending.id}`, { method: "POST" });
  const restoredMs = (await state("u-owner3")).myItems.find((i) => i.code === targetItem);
  t(`คืนค่า milestone ${targetItem} ขั้นที่ ${seq} กลับเป็น ${before}%`,
    restoredMs.milestones.find((m) => m.seq === seq).percentComplete === before,
    `ได้ ${restoredMs.milestones.find((m) => m.seq === seq).percentComplete}`);

  const pctBack = await as("u-owner3", `/api/items/${targetItem}/progress`, {
    method: "POST",
    body: JSON.stringify({
      field: "percent_within_next_level",
      percent: mineBefore.percentWithinNextLevel,
    }),
  });
  await as("u-owner3", `/api/pending/${pctBack.body.pending.id}`, { method: "POST" });
  t("คืนค่า % ไประดับถัดไปกลับเป็นเดิม",
    (await state("u-owner3")).myItems.find((i) => i.code === targetItem)
      .percentWithinNextLevel === mineBefore.percentWithinNextLevel);

  const alertsNow = (await state("u-mod")).alerts.filter((a) => a.rule === "A-MILESTONE").length;
  t(`ไม่สร้างแจ้งเตือน milestone เพิ่มจากการทดสอบ (${alertsNow} ฉบับ)`, alertsNow === 2, alertsNow);

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

  // ── สถานะ On Track / At Risk / Delayed (R5 · เดิมไม่มีเลย) ───────────────
  group("R5 · สถานะที่โค้ดคำนวณ · at_risk_threshold_points ต้องมีคนอ่าน");
  const sv = await state("u-mod");
  t("ทุกรายการมีสถานะ", sv.items.every((i) => ["on_track", "at_risk", "delayed"].includes(i.status)));
  t("ทุกรายการมี expected (ความคืบหน้าที่ควรได้ตามปฏิทิน)",
    sv.items.every((i) => typeof i.expected === "number"));
  const lateMs = sv.items.filter((i) =>
    i.milestones.some((m) => m.plannedEnd < sv.meta.today && m.percentComplete < 100));
  t(`ข้อที่มีแผนงานเลยกำหนด ต้องเป็น delayed (${lateMs.length} ข้อ)`,
    lateMs.length > 0 && lateMs.every((i) => i.status === "delayed"),
    lateMs.map((i) => `${i.code}:${i.status}`).join(" "));
  /*
    ทดสอบว่า at_risk_threshold_points "มีคนอ่านจริง" โดยไม่ผูกกับการกระจายตัวของข้อมูล

    วิธีเดิมที่ผิด: ลดเกณฑ์เป็น 1 แล้วคาดว่าจำนวนต้องเปลี่ยน — ใช้ไม่ได้ เพราะช่องว่าง
    ของข้อมูลชุดนี้เป็น 0 หรือ ~18 ไม่มีข้อไหนอยู่ระหว่าง 1–15 จำนวนจึงไม่เปลี่ยน
    วิธีนี้: ตั้งเกณฑ์ให้ต่ำกว่าช่องว่างที่เล็กที่สุด และสูงกว่าช่องว่างที่ใหญ่ที่สุด
    แล้วดูว่าผลพลิกทั้งสองทาง
  */
  const origThreshold = sv.settings.at_risk_threshold_points;
  const notDelayed = sv.items.filter((i) => i.status !== "delayed");
  const gaps = notDelayed.map((i) => i.expected - i.progress).filter((g) => g > 0);
  const maxGap = gaps.length ? Math.max(...gaps) : 0;
  t(`มีข้อที่ตามหลังปฏิทิน (ช่องว่างสูงสุด ${maxGap} จุด)`, maxGap > 0, maxGap);

  const setTh = (v) => as("u-mod", "/api/settings", {
    method: "PATCH", body: JSON.stringify({ key: "at_risk_threshold_points", value: v }),
  });
  const riskCount = async () =>
    (await state("u-mod")).items.filter((i) => i.status === "at_risk").length;

  await setTh(Math.max(1, maxGap - 1));
  const lowCount = await riskCount();
  t(`ตั้งเกณฑ์ต่ำกว่าช่องว่างสูงสุด → มีข้อขึ้น at_risk (${lowCount} ข้อ)`, lowCount > 0, lowCount);

  await setTh(maxGap + 5);
  const highCount = await riskCount();
  t(`ตั้งเกณฑ์สูงกว่าช่องว่างทุกข้อ → ไม่มีข้อไหน at_risk (${highCount} ข้อ)`, highCount === 0, highCount);

  const ownerTh = await as("u-owner1", "/api/settings", {
    method: "PATCH", body: JSON.stringify({ key: "at_risk_threshold_points", value: 99 }),
  });
  t("เจ้าของข้อมูลแก้เกณฑ์นี้ -> 403", ownerTh.status === 403, `ได้ ${ownerTh.status}`);

  // คืนค่าที่อ่านมาจริง ไม่ใช่ตัวเลขที่เขียนตายไว้ — บทเรียนจากบั๊กเดิม
  await setTh(origThreshold);
  t(`คืนเกณฑ์กลับเป็น ${origThreshold} และจำนวน at_risk กลับเดิม (${riskBeforeRestore()})`,
    (await riskCount()) === sv.items.filter((i) => i.status === "at_risk").length);
  function riskBeforeRestore() {
    return sv.items.filter((i) => i.status === "at_risk").length;
  }

  group("ยังขาดอะไร (gapsFor) — แผงของไฟล์ทีมที่เดิมไม่มีข้อมูล");
  t("ทุกรายการมีรายการ gap", sv.items.every((i) => Array.isArray(i.gaps) && i.gaps.length > 0));
  t("ข้อที่ไม่มีหลักฐาน ต้องมี gap ที่ยังไม่ครบ",
    sv.items.filter((i) => i.evidenceCount === 0)
      .every((i) => i.gaps.some((g) => !g.done && /หลักฐาน/.test(g.text))));
  t("ข้อที่มีหลักฐานยืนยันแล้ว gap ข้อนั้นถูกขีดฆ่า",
    sv.items.filter((i) => i.verified > 0)
      .every((i) => i.gaps.some((g) => g.done && /ชั้น A/.test(g.text))));

  // ── แผนงาน: เพิ่ม / แก้ / ลบ ─────────────────────────────────────────────
  group("แก้แผนงาน — เพิ่ม · แก้ชื่อ · ลบ (ที่ผู้ใช้แจ้งว่าทำไม่ได้)");
  const own3 = await state("u-owner3");
  const target = own3.myItems.find((i) => i.milestones.length === 3);
  const msBefore = target.milestones.length;
  const progBefore = target.progress;

  const addMs = await as("u-owner3", `/api/items/${target.code}/milestones`, {
    method: "POST",
    body: JSON.stringify({ name: "ขั้นทดสอบจากชุดทดสอบ", plannedStart: "2027-03-01", plannedEnd: "2027-04-30" }),
  });
  t("เพิ่มขั้นในแผนงานได้", addMs.status === 201, addMs.body?.error);
  const newSeq = addMs.body?.seq;
  const afterAdd = (await state("u-owner3")).myItems.find((i) => i.code === target.code);
  t(`จำนวนขั้นเพิ่มจาก ${msBefore} เป็น ${afterAdd.milestones.length}`,
    afterAdd.milestones.length === msBefore + 1);
  t("น้ำหนักถูกเกลี่ยเท่ากันใหม่",
    new Set(afterAdd.milestones.map((m) => m.weight)).size === 1,
    afterAdd.milestones.map((m) => m.weight).join(" "));
  t(`ความคืบหน้ารวมเปลี่ยนตามน้ำหนักใหม่ (${progBefore}% to ${afterAdd.progress}%)`,
    afterAdd.progress !== progBefore);

  const short = await as("u-owner3", `/api/items/${target.code}/milestones`, {
    method: "POST", body: JSON.stringify({ name: "ก", plannedStart: "2027-01-01", plannedEnd: "2027-02-01" }),
  });
  t("ชื่อขั้นสั้นเกินไป -> ปฏิเสธ", short.status >= 400, `ได้ ${short.status}`);
  const badRange = await as("u-owner3", `/api/items/${target.code}/milestones`, {
    method: "POST", body: JSON.stringify({ name: "ช่วงวันผิด", plannedStart: "2027-05-01", plannedEnd: "2027-04-01" }),
  });
  t("วันจบมาก่อนวันเริ่ม -> ปฏิเสธ", badRange.status >= 400, `ได้ ${badRange.status}`);

  const msRename = await as("u-owner3", `/api/items/${target.code}/milestones/${newSeq}`, {
    method: "PATCH", body: JSON.stringify({ name: "ขั้นทดสอบ (แก้ชื่อแล้ว)" }),
  });
  t("แก้ชื่อขั้นได้", msRename.status === 200, msRename.body?.error);
  const pushLater = await as("u-owner3", `/api/items/${target.code}/milestones/${newSeq}`, {
    method: "PATCH", body: JSON.stringify({ plannedEnd: "2027-12-31" }),
  });
  t("เลื่อนวันจบให้ช้าลงผ่าน PATCH -> ปฏิเสธ (ต้องใช้ /slips)", pushLater.status >= 400,
    pushLater.body?.error);
  t("เหตุผลบอกให้ใช้ปุ่มเลื่อนแผน", /เลื่อนแผน/.test(pushLater.body?.error ?? ""));

  const started = afterAdd.milestones.find((m) => m.percentComplete > 0);
  const delStarted = await as("u-owner3", `/api/items/${target.code}/milestones/${started.seq}`, {
    method: "DELETE",
  });
  t(`ลบขั้นที่เริ่มแล้ว (${started.percentComplete}%) -> ปฏิเสธ`, delStarted.status >= 400,
    delStarted.body?.error);

  const crossMs = await as("u-owner1", `/api/items/${target.code}/milestones`, {
    method: "POST",
    body: JSON.stringify({ name: "กองอื่นพยายามเพิ่ม", plannedStart: "2027-01-01", plannedEnd: "2027-02-01" }),
  });
  t("เพิ่มขั้นในรายการของกองอื่น -> 403", crossMs.status === 403, `ได้ ${crossMs.status}`);

  const delOk = await as("u-owner3", `/api/items/${target.code}/milestones/${newSeq}`, { method: "DELETE" });
  t("ลบขั้นที่ยัง 0% ได้", delOk.status === 200, delOk.body?.error);
  const restoredMsCount = (await state("u-owner3")).myItems.find((i) => i.code === target.code);
  t(`คืนจำนวนขั้นกลับเป็น ${msBefore} และความคืบหน้ากลับเป็น ${progBefore}%`,
    restoredMsCount.milestones.length === msBefore && restoredMsCount.progress === progBefore,
    `${restoredMsCount.milestones.length} ขั้น · ${restoredMsCount.progress}%`);

  // ── AC-22 จริง: เลื่อนแผน 3 ครั้ง ────────────────────────────────────────
  group("AC-22 · บันทึกการเลื่อนแผน 1 -> 2 -> 3 ครั้ง จากข้อมูลจริง");
  const clean = (await state("u-owner3")).myItems.find((i) => i.slipHistory.length === 0);
  t("มีรายการที่ยังไม่เคยเลื่อนแผนให้ทดสอบ", !!clean, clean?.code);
  const ms1 = clean.milestones.find((m) => m.percentComplete < 100) ?? clean.milestones[0];

  const shortReason = await as("u-owner3", `/api/items/${clean.code}/slips`, {
    method: "POST", body: JSON.stringify({ milestoneSeq: ms1.seq, toDate: "2028-01-01", reason: "สั้น" }),
  });
  t("เลื่อนแผนโดยเหตุผลสั้นเกินไป -> ปฏิเสธ", shortReason.status >= 400, shortReason.body?.error);
  const earlier = await as("u-owner3", `/api/items/${clean.code}/slips`, {
    method: "POST",
    body: JSON.stringify({ milestoneSeq: ms1.seq, toDate: "2026-01-01", reason: "ย้อนอดีตไม่ได้" }),
  });
  t("เลื่อนไปวันที่เร็วกว่าเดิม -> ปฏิเสธ", earlier.status >= 400, earlier.body?.error);
  const crossSlip = await as("u-owner1", `/api/items/${clean.code}/slips`, {
    method: "POST",
    body: JSON.stringify({ milestoneSeq: ms1.seq, toDate: "2028-01-01", reason: "กองอื่นพยายามเลื่อน" }),
  });
  t("เลื่อนแผนของกองอื่น -> 403", crossSlip.status === 403, `ได้ ${crossSlip.status}`);

  const REASON = "รอผลการพิจารณางบประมาณจากสำนักงบ";
  for (const [n, date, wantVerb, wantMod] of [
    [1, "2027-06-30", "NOTE", false],
    [2, "2027-08-31", "ASK", true],
    [3, "2027-10-31", "ESCALATE", true],
  ]) {
    const slipRes = await as("u-owner3", `/api/items/${clean.code}/slips`, {
      method: "POST", body: JSON.stringify({ milestoneSeq: ms1.seq, toDate: date, reason: REASON }),
    });
    t(`เลื่อนครั้งที่ ${n} บันทึกได้`, slipRes.status === 201, slipRes.body?.error);
    t(`ครั้งที่ ${n} -> ${wantVerb}`, slipRes.body?.verb === wantVerb, slipRes.body?.verb);
    t(`ครั้งที่ ${n} ${wantMod ? "ถึงผู้ดูแล" : "ไม่รบกวนผู้ดูแล"}`,
      slipRes.body?.reachesModerator === wantMod, String(slipRes.body?.reachesModerator));
  }
  const withSlips = (await state("u-mod")).items.find((i) => i.code === clean.code);
  t("Suggestion ของรายการนี้เห็นการยกระดับ", withSlips.suggestion.escalated);
  t("แจ้งเตือน A-SLIP ของรายการนี้เป็น ESCALATE และถึงผู้ดูแล",
    (await state("u-mod")).alerts.some((a) => a.rule === "A-SLIP" && a.itemCode === clean.code
      && a.verb === "ESCALATE" && a.toModerator));
  t("gap เพิ่มข้อ ชี้แจงการเลื่อนแผน",
    withSlips.gaps.some((g) => /ชี้แจงการเลื่อนแผน/.test(g.text)));

  const slipList = (await as("u-mod", `/api/items/${clean.code}/slips`)).body.slips;
  t("อ่านประวัติการเลื่อนได้ 3 รายการ", slipList.length === 3, slipList.length);
  const ownerDelSlip = await as("u-owner3", `/api/items/${clean.code}/slips/${slipList[0].id}`, {
    method: "DELETE",
  });
  t("เจ้าของข้อมูลลบประวัติการเลื่อน -> 403", ownerDelSlip.status === 403, `ได้ ${ownerDelSlip.status}`);
  for (const sp of [...slipList].reverse()) {
    await as("u-mod", `/api/items/${clean.code}/slips/${sp.id}`, { method: "DELETE" });
  }
  const back2 = (await state("u-mod")).items.find((i) => i.code === clean.code);
  t("ผู้ดูแลลบประวัติคืนได้ครบ — ข้อมูลกลับเป็นเดิม",
    back2.slipHistory.length === 0, back2.slipHistory.length);
  t("วันแผนกลับเป็นวันเดิม",
    back2.milestones.find((m) => m.seq === ms1.seq).plannedEnd === ms1.plannedEnd,
    back2.milestones.find((m) => m.seq === ms1.seq).plannedEnd);

  // ── อัปโหลดไฟล์จริง (R4) ─────────────────────────────────────────────────
  group("R4 · อัปโหลดไฟล์จริง — ชนิด · ขนาด · ชื่อไฟล์ · ไม่แตะ document_date");
  const upItem = (await state("u-owner3")).myItems[0].code;
  const send = async (name, type, bytes, extra = {}) => {
    const fd = new FormData();
    fd.set("itemCode", extra.itemCode ?? upItem);
    fd.set("title", extra.title ?? "");
    fd.set("documentDate", extra.date ?? "");
    fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
    const upRes = await fetch(`${base}/api/evidence`, {
      method: "POST", body: fd, headers: { cookie: jars.get("u-owner3") }, cache: "no-store",
    });
    return { status: upRes.status, body: await upRes.json().catch(() => null) };
  };

  const okUp = await send("รายงานผลตรวจวัด.pdf", "application/pdf", 2048);
  t("อัปโหลด PDF ได้", okUp.status === 201, okUp.body?.error);
  t("บันทึก stored_path", !!okUp.body?.storedPath, okUp.body?.storedPath);
  const upId = okUp.body.id;
  const upRow = (await state("u-mod")).evidence.find((e) => e.id === upId);
  t("document_date ยังเป็น null แม้ไฟล์มี metadata (AC-03 ไม่ถอยหลัง)",
    upRow.documentDate === null, String(upRow.documentDate));
  const fileRes = await fetch(`${base}/api/evidence/${upId}/file`,
    { headers: { cookie: jars.get("u-mod") }, cache: "no-store" });
  t("ดาวน์โหลดไฟล์กลับได้",
    fileRes.ok && fileRes.headers.get("content-type") === "application/pdf",
    `${fileRes.status} ${fileRes.headers.get("content-type")}`);

  const badType = await send("script.exe", "application/x-msdownload", 100);
  t("ชนิดไฟล์ที่ไม่อนุญาต -> ปฏิเสธ", badType.status >= 400, badType.body?.error);
  const tooBig = await send("ใหญ่เกิน.pdf", "application/pdf", 11 * 1024 * 1024);
  t("ไฟล์เกิน 10 MB -> ปฏิเสธ", tooBig.status >= 400, tooBig.body?.error);
  const traversal = await send("../../../etc/passwd.pdf", "application/pdf", 64);
  t("ชื่อไฟล์มี ../ -> อัปโหลดได้แต่ชื่อถูกล้าง", traversal.status === 201, traversal.body?.error);
  t("path ที่เก็บไม่หลุดออกนอก sample-data/uploads",
    (traversal.body?.storedPath ?? "").startsWith("sample-data/uploads/")
    && !(traversal.body?.storedPath ?? "").includes(".."),
    traversal.body?.storedPath);
  const crossUp = await send("ของกองอื่น.pdf", "application/pdf", 64, { itemCode: "1.1" });
  t("อัปโหลดเข้ารายการของกองอื่น -> 403", crossUp.status === 403, `ได้ ${crossUp.status}`);

  // ── ลบหลักฐาน + คืนสภาพ ─────────────────────────────────────────────────
  group("DELETE หลักฐาน — ทีมกลางเท่านั้น · ทำให้ชุดทดสอบคืนสภาพตัวเองได้");
  const ownerDel = await as("u-owner3", `/api/evidence/${upId}`, { method: "DELETE" });
  t("เจ้าของข้อมูลลบหลักฐาน -> 403", ownerDel.status === 403, `ได้ ${ownerDel.status}`);
  const execDel = await as("u-exec", `/api/evidence/${upId}`, { method: "DELETE" });
  t("ผู้บริหารลบหลักฐาน -> 403", execDel.status === 403, `ได้ ${execDel.status}`);
  for (const id of [upId, traversal.body.id]) {
    const d = await as("u-mod", `/api/evidence/${id}`, { method: "DELETE" });
    t(`ผู้ดูแลลบ ${id} ได้`, d.status === 200, d.body?.error);
    t(`ไฟล์บนดิสก์ถูกลบด้วย (${id})`, d.body?.fileRemoved === true);
  }
  /*
    เก็บกวาดหลักฐานทุกชิ้นที่ชุดทดสอบสร้างขึ้น (id เกิน E-014 ของ seed)
    ไม่ใช่แค่ไฟล์ที่อัปโหลด — กลุ่ม AC-03/AC-04 ก็เพิ่มไว้ด้วย

    ข้อนี้คือเหตุผลที่ต้องมี DELETE /api/evidence/[id]:
    ถ้าไม่คืนสภาพ verify:seed ที่ยืนยันจำนวนแจ้งเตือนแบบเป๊ะจะไม่ผ่านเมื่อรันตามหลัง
  */
  /*
    ลบเฉพาะ "ที่ไม่ได้อยู่ตั้งแต่ต้น" — เดิมใช้เกณฑ์ว่าเลข id เกิน 14
    ซึ่งผิดทันทีที่ฐานข้อมูลมีแถวที่ id ไม่ได้เรียงติดกัน หรือมีของค้างจากรอบก่อน
    กลายเป็นลบข้อมูลตั้งต้นทิ้ง แล้วรอบถัดไปก็เพี้ยนตาม
  */
  for (const e of (await state("u-mod")).evidence) {
    if (!evidenceAtStart.has(e.id)) {
      await as("u-mod", `/api/evidence/${e.id}`, { method: "DELETE" });
    }
  }
  const finalEv = (await state("u-mod")).evidence;
  t(`ลบหลักฐานที่ชุดทดสอบเพิ่มคืนครบ — จำนวนกลับเป็น ${evidenceAtStart.size} เท่าตอนเริ่ม`,
    finalEv.length === evidenceAtStart.size, finalEv.length);
  t(`แจ้งเตือนกลับเป็นจำนวนเดิม (${alertsAtStart}) — ชุดตรวจไม่ทิ้งร่องรอย`,
    (await state("u-mod")).allAlertCounts.ownerTotal === alertsAtStart,
    (await state("u-mod")).allAlertCounts.ownerTotal);

  // ── เครื่องมือเดโม: สำรอง / ย้อนกลับ ─────────────────────────────────────
  group("เครื่องมือเดโม · สำรองและย้อนฐานข้อมูล — ผู้ดูแลเท่านั้น");
  const ownerSnap = await as("u-owner3", "/api/demo/snapshots");
  t("เจ้าของข้อมูลดูจุดสำรอง -> 403", ownerSnap.status === 403, `ได้ ${ownerSnap.status}`);
  const execSnap = await as("u-exec", "/api/demo/snapshots", {
    method: "POST", body: JSON.stringify({ name: "ผู้บริหารพยายามสำรอง" }),
  });
  t("ผู้บริหารสร้างจุดสำรอง -> 403", execSnap.status === 403, `ได้ ${execSnap.status}`);

  const listed = await as("u-mod", "/api/demo/snapshots");
  t("ผู้ดูแลดูรายการได้", listed.status === 200, listed.body?.error);
  t("มีจุดตั้งต้น baseline ให้ย้อนกลับเสมอ",
    (listed.body?.snapshots ?? []).some((s) => s.name === "baseline" && s.isBaseline));

  const shortName = await as("u-mod", "/api/demo/snapshots", {
    method: "POST", body: JSON.stringify({ name: "ก" }),
  });
  t("ชื่อจุดสำรองสั้นเกินไป -> ปฏิเสธ", shortName.status >= 400, shortName.body?.error);

  const snapName = "ทดสอบชุดตรวจ";
  const made = await as("u-mod", "/api/demo/snapshots", {
    method: "POST", body: JSON.stringify({ name: snapName }),
  });
  t("สร้างจุดสำรองได้", made.status === 201, made.body?.error);
  t("ชื่อไทยใช้ได้", made.body?.snapshot?.name === snapName, made.body?.snapshot?.name);
  t("ไฟล์จุดสำรองมีขนาดจริง", (made.body?.snapshot?.bytes ?? 0) > 10000, made.body?.snapshot?.bytes);

  // แก้ข้อมูลจริง แล้วย้อนกลับ ต้องได้ค่าเดิมคืน
  const snapItem = (await state("u-mod")).items.find((i) => i.targetLevel < 5);
  const beforeTarget = snapItem.targetLevel;
  const beforeEvidence = (await state("u-mod")).evidence.length;
  await as("u-mod", `/api/items/${snapItem.code}`, {
    method: "PATCH", body: JSON.stringify({ targetLevel: 5 }),
  });
  const addedEv = await as("u-mod", "/api/evidence", {
    method: "POST", body: JSON.stringify({ itemCode: snapItem.code, title: "เอกสารที่จะถูกย้อนทิ้ง" }),
  });
  const changed = await state("u-mod");
  t(`ข้อมูลเปลี่ยนจริงก่อนย้อน (เป้า ${beforeTarget} -> 5 · หลักฐาน ${beforeEvidence} -> ${changed.evidence.length})`,
    changed.items.find((i) => i.code === snapItem.code).targetLevel === 5
    && changed.evidence.length === beforeEvidence + 1);

  const restored = await as("u-mod", `/api/demo/snapshots/${encodeURIComponent(snapName)}`, {
    method: "POST",
  });
  t("ย้อนกลับสำเร็จ", restored.status === 200, restored.body?.error);
  t("ระบบสำรองสภาพก่อนย้อนให้อัตโนมัติ", !!restored.body?.safetyCopy, restored.body?.safetyCopy);

  const afterRestore = await state("u-mod");
  t(`เป้ากลับเป็น ${beforeTarget}`,
    afterRestore.items.find((i) => i.code === snapItem.code).targetLevel === beforeTarget,
    afterRestore.items.find((i) => i.code === snapItem.code).targetLevel);
  t(`จำนวนหลักฐานกลับเป็น ${beforeEvidence}`,
    afterRestore.evidence.length === beforeEvidence, afterRestore.evidence.length);
  t("อ่านข้อมูลต่อได้หลังย้อน (connection เปิดใหม่สำเร็จ)", afterRestore.items.length === 24);

  const delBaseline = await as("u-mod", "/api/demo/snapshots/baseline", { method: "DELETE" });
  t("ลบจุดตั้งต้น -> ปฏิเสธ", delBaseline.status >= 400, delBaseline.body?.error);
  const missing = await as("u-mod", "/api/demo/snapshots/ไม่มีอยู่จริง", { method: "POST" });
  t("ย้อนไปจุดที่ไม่มี -> ปฏิเสธ", missing.status >= 400, missing.body?.error);

  /*
    ลบเฉพาะจุดสำรองที่ "ชุดตรวจสร้างเอง" เท่านั้น

    เคยพลาด: ลบทุกอันที่ไม่ใช่ baseline ทำให้จุดสำรองที่คนเตรียมไว้ก่อนซ้อมเดโม
    หายไปพร้อมกัน — ชุดตรวจไม่มีสิทธิ์ลบของที่คนอื่นตั้งใจเก็บไว้
  */
  const MINE = new Set([snapName, restored.body?.safetyCopy].filter(Boolean));
  for (const s of (await as("u-mod", "/api/demo/snapshots")).body.snapshots) {
    if (MINE.has(s.name)) {
      await as("u-mod", `/api/demo/snapshots/${encodeURIComponent(s.name)}`, { method: "DELETE" });
    }
  }
  const cleaned = (await as("u-mod", "/api/demo/snapshots")).body.snapshots;
  t("ลบจุดสำรองที่ชุดตรวจสร้างคืนครบ",
    !cleaned.some((s) => MINE.has(s.name)),
    cleaned.map((s) => s.name).join(" "));
  t("จุดสำรองของคนอื่นไม่ถูกแตะ — ยังมี baseline อยู่",
    cleaned.some((s) => s.isBaseline));

  group("R11 · AC-10 / AC-15 · เอกสารรอบเดือน — ไม่มีข้อไหนหายไปเงียบ ๆ");
  {
    const rep = await as("u-mod", "/api/report");
    t("ผู้ดูแลดูเอกสารรอบเดือนได้", rep.status === 200, rep.body?.error);
    const R = rep.body;

    const owner = await as("u-owner3", "/api/report");
    t("เจ้าของข้อมูลดูเอกสารรอบเดือน → ปฏิเสธ", owner.status >= 400, `ได้ ${owner.status}`);
    const exec = await as("u-exec", "/api/report");
    t("ผู้บริหารดูได้ — เป็นภาพระดับองค์กร", exec.status === 200, `ได้ ${exec.status}`);

    /*
      หัวใจของ AC-10: ทุกข้อต้องอยู่ที่ใดที่หนึ่งเสมอ
      ถ้าผลรวมไม่ตรงกับจำนวนข้อทั้งหมด แปลว่ามีข้อที่หายไปจากเอกสารโดยไม่มีใครรู้
    */
    t(`ทุกข้ออยู่ที่ใดที่หนึ่ง — ${R.summary.withCitation} + ${R.summary.inRemarks} = ${R.summary.totalItems}`,
      R.summary.withCitation + R.summary.inRemarks === R.summary.totalItems,
      `${R.summary.withCitation} + ${R.summary.inRemarks}`);

    const statements = R.sections.flatMap((x) => x.statements);
    t("ทุกประโยคในเนื้อรายงานมีการอ้างอิงอย่างน้อยหนึ่งฉบับ (AC-15)",
      statements.length > 0 && statements.every((st) => st.citations.length > 0),
      statements.filter((st) => st.citations.length === 0).map((st) => st.itemCode).join(" "));

    t("อ้างอิงทุกฉบับเป็นหลักฐานที่ยืนยันแล้วเท่านั้น",
      statements.every((st) => st.citations.every((c) => ["A", "B", "C", "D"].includes(c.tier))));

    t("ประโยคที่อ้างชั้น C ต้องถูกกำกับว่ายังไม่นับ",
      statements.every((st) =>
        st.citations.every((c) => c.tier === "C") ? st.notCounted === true : true));

    t("รายการที่ไม่มีหลักฐานยืนยัน ต้องขึ้นทะเบียนหมายเหตุทุกข้อ (AC-10)",
      R.remarks.length > 0 && R.remarks.every((m) => m.itemCode && m.reason));
    t("ทะเบียนหมายเหตุบอกเจ้าของและวันที่อัปเดตล่าสุดครบทุกแถว",
      R.remarks.every((m) => !!m.ownerTitle && !!m.lastUpdated));

    const inBody = new Set(statements.map((st) => st.itemCode));
    const inRemarks = new Set(R.remarks.map((m) => m.itemCode));
    t("ไม่มีข้อไหนอยู่ทั้งสองที่พร้อมกัน",
      [...inBody].every((c) => !inRemarks.has(c)));
    t("เอกสารประกาศตัวว่าเป็นข้อมูลสังเคราะห์", R.meta.synthetic === true);

    // ── ส่งออก ───────────────────────────────────────────────────────────
    for (const fmt of ["html", "md", "json"]) {
      const res = await fetch(`${base}/api/report?format=${fmt}`, {
        headers: { cookie: "greenatm_user=u-mod" }, cache: "no-store",
      });
      const text = await res.text();
      t(`ส่งออก ${fmt} สำเร็จและมีเนื้อหาจริง`,
        res.status === 200 && text.length > 2000, `${res.status} · ${text.length} ตัวอักษร`);
      t(`ส่งออก ${fmt} แนบชื่อไฟล์มาให้ดาวน์โหลด`,
        (res.headers.get("content-disposition") ?? "").includes("attachment"));
      t(`ไฟล์ ${fmt} มีทะเบียนหมายเหตุอยู่จริง`,
        fmt === "json" ? text.includes('"remarks"') : text.includes("ทะเบียนหมายเหตุ"));
      t(`ไฟล์ ${fmt} ติดป้ายว่าเป็นข้อมูลสังเคราะห์`,
        fmt === "json" ? text.includes('"synthetic": true') : text.includes("สังเคราะห์"));
    }

    const bad = await as("u-mod", "/api/report?format=docx");
    t("รูปแบบที่ไม่รองรับ → ปฏิเสธ ไม่ใช่ส่งไฟล์เปล่ามาให้", bad.status >= 400, bad.body?.error);

    /*
      ไฟล์ HTML ต้องเปิดได้บนเครื่องที่ไม่มีอินเทอร์เน็ต — กฎห้าม asset จาก CDN ภายนอก
      ตรวจตรง ๆ ว่าไม่มี src/href ที่ชี้ออกนอกเครื่อง
    */
    const html = await (await fetch(`${base}/api/report?format=html`, {
      headers: { cookie: "greenatm_user=u-mod" },
    })).text();
    t("ไฟล์ HTML ไม่ดึง asset จากภายนอกเลย — เปิดบนเครือข่ายปิดได้",
      !/(src|href)\s*=\s*["']https?:/i.test(html));
  }

  // ── Outbox · คนต้องแก้และทิ้งร่างได้ ไม่ใช่แค่กดอนุมัติ ──────────────────
  group("§3.3 · คนแก้ร่างได้ ทิ้งได้ ไม่ใช่แค่กดส่ง");
  {
    const code = mod.alerts[0].itemCode;
    const made = await as("u-mod", "/api/outbox", {
      method: "POST",
      body: JSON.stringify({
        alertRule: "A-NOEV", itemCode: code,
        subject: "หัวเรื่องที่ระบบร่าง", body: "เนื้อความที่ระบบร่างไว้ ยังไม่มีคนตรวจ",
      }),
    });
    t("ร่างข้อความใหม่ได้", made.status === 201, made.body?.error);
    const id = made.body?.id;

    if (id) {
      for (const who of ["u-owner3", "u-exec"]) {
        const r = await as(who, `/api/outbox/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ subject: "แอบแก้", body: "แอบแก้เนื้อความให้ยาวพอผ่าน" }),
        });
        t(`${who} แก้ร่างข้อความ → 403`, r.status === 403, `ได้ ${r.status}`);
      }

      const tooShort = await as("u-mod", `/api/outbox/${id}`, {
        method: "PATCH", body: JSON.stringify({ subject: "ก", body: "สั้น" }),
      });
      t("แก้ด้วยข้อความสั้นเกินไป → ปฏิเสธ", tooShort.status === 400, tooShort.body?.error);

      const edited = await as("u-mod", `/api/outbox/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          subject: "หัวเรื่องที่คนแก้แล้ว",
          body: "เนื้อความที่คนตรวจแล้วแก้เอง ก่อนกดส่งจริง",
        }),
      });
      t("ผู้ดูแลแก้ข้อความก่อนส่งได้", edited.status === 200, edited.body?.error);

      const m = (await state("u-mod")).outbox.find((x) => x.id === id);
      t("ข้อความเปลี่ยนจริงตามที่แก้", m?.subject === "หัวเรื่องที่คนแก้แล้ว", m?.subject);
      t("บันทึกไว้ว่าคนเป็นผู้แก้ — แยกออกจากข้อความที่ระบบร่างล้วน",
        m?.editedBy === "u-mod" && !!m?.editedAt, `${m?.editedBy} · ${m?.editedAt}`);
      t("แก้แล้วยังไม่ถือว่าส่ง", m?.sentAt === null, m?.sentAt);

      /*
        ส่งแล้วต้องแก้และลบไม่ได้ — ข้อความที่กดส่งคือบันทึกว่าส่งอะไรออกไป
        แก้ย้อนหลังได้เมื่อไร บันทึกนั้นก็ใช้อ้างอิงไม่ได้อีกเลย
      */
      const sent = await as("u-mod", `/api/outbox/${id}`, { method: "POST" });
      t("กดส่งได้", sent.status === 200, sent.body?.error);
      const editAfter = await as("u-mod", `/api/outbox/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ subject: "แก้หลังส่งไปแล้ว", body: "พยายามแก้ย้อนหลังหลังกดส่ง" }),
      });
      t("แก้ร่างที่ส่งไปแล้ว → ปฏิเสธ", editAfter.status === 400, editAfter.body?.error);
      const delAfter = await as("u-mod", `/api/outbox/${id}`, {
        method: "DELETE", body: JSON.stringify({}),
      });
      t("ลบร่างที่ส่งไปแล้ว → ปฏิเสธ", delAfter.status === 400, delAfter.body?.error);

      // ร่างที่ยังไม่ส่ง ต้องทิ้งได้
      const throwaway = await as("u-mod", "/api/outbox", {
        method: "POST",
        body: JSON.stringify({
          alertRule: "A-NOEV", itemCode: code,
          subject: "ร่างที่ไม่ควรส่ง", body: "ร่างผิดรายการ ต้องทิ้งได้ ไม่ใช่ค้างอยู่ตลอดไป",
        }),
      });
      const discarded = await as("u-mod", `/api/outbox/${throwaway.body.id}`, {
        method: "DELETE", body: JSON.stringify({ reason: "ร่างผิดรายการ" }),
      });
      t("ทิ้งร่างที่ยังไม่ส่งได้", discarded.status === 200, discarded.body?.error);
      t("ร่างที่ทิ้งหายไปจริง",
        !(await state("u-mod")).outbox.some((x) => x.id === throwaway.body.id));

      const ownerDiscard = await as("u-owner3", `/api/outbox/${id}`, {
        method: "DELETE", body: JSON.stringify({}),
      });
      t("เจ้าของข้อมูลทิ้งร่าง → 403", ownerDiscard.status === 403, `ได้ ${ownerDiscard.status}`);
    }
  }

  // ── R6 · agent อ่านเอกสารแล้วเสนอชั้น ────────────────────────────────────
  group("R6 · agent เสนอชั้นหลักฐาน — เสนอเท่านั้น ไม่ใช่การยืนยัน");
  {
    const mine = views["u-owner3"].myItems[0].code;
    const made = await as("u-owner3", "/api/evidence", {
      method: "POST",
      body: JSON.stringify({ itemCode: mine, title: "(ร่าง) แผนสำหรับทดสอบ agent" }),
    });
    t("แนบหลักฐานเพื่อทดสอบได้", made.status === 201, made.body?.error);
    const evId = made.body?.id;

    if (evId) {
      const execTry = await as("u-exec", `/api/evidence/${evId}/propose-tier`, { method: "POST" });
      t("ผู้บริหารสั่ง agent เสนอชั้น → 403", execTry.status === 403, `ได้ ${execTry.status}`);
      const crossTry = await as("u-owner1", `/api/evidence/${evId}/propose-tier`, { method: "POST" });
      t("เจ้าของกองอื่นสั่ง agent เสนอชั้น → 403", crossTry.status === 403, `ได้ ${crossTry.status}`);

      const runsBefore = (await state("u-mod")).agentRuns;
      const verifiedBefore = (await state("u-mod")).items.find((i) => i.code === mine)?.verified;

      const r = await as("u-owner3", `/api/evidence/${evId}/propose-tier`, { method: "POST" });
      t("เรียก agent ได้ (ไม่ว่าโมเดลจะตอบหรือไม่)", r.status === 200, r.body?.error);

      /*
        ไม่ยืนยันว่า "ต้องเสนอชั้น A" เพราะนั่นคือการทดสอบคำตอบของโมเดล ซึ่งไม่ตายตัว
        สิ่งที่ต้องตายตัวคือ **กติกา** — เสนอแล้วต้องไม่ยืนยันให้เอง และต้องบันทึกร่องรอยไว้
      */
      const after = await state("u-mod");
      const evAfter = after.evidence.find((e) => e.id === evId);
      t("ยังไม่ถูกยืนยัน — การยืนยันยังเป็นของคน",
        evAfter && evAfter.confirmedTier === null, evAfter?.confirmedTier);
      t("ค่า Verified ไม่ขยับจากข้อเสนอของ agent",
        after.items.find((i) => i.code === mine)?.verified === verifiedBefore);
      t("บันทึกลง agent_run ทุกครั้ง แม้โมเดลจะล้ม (AC-06)",
        after.agentRuns === runsBefore + 1, `${runsBefore} → ${after.agentRuns}`);
      t("บอกตามจริงว่าอ่านเนื้อไฟล์ได้หรือไม่",
        typeof r.body?.read?.ok === "boolean" && (r.body.read.ok || !!r.body.read.reason),
        JSON.stringify(r.body?.read));
      if (r.body?.ok) {
        t("เสนอชั้นเป็น A/B/C/D เท่านั้น",
          ["A", "B", "C", "D"].includes(r.body.proposedTier), r.body.proposedTier);
        t("ข้อเสนอต้องมีเหตุผลติดมาด้วย",
          typeof r.body.proposedReason === "string" && r.body.proposedReason.length > 5,
          r.body.proposedReason);
      } else {
        t("ล้มแล้วต้องไม่เดาชั้นใส่ไว้แทน",
          r.body?.proposedTier === null && !!r.body?.error, JSON.stringify(r.body));
      }

      // ยืนยันแล้ว → ห้ามให้ agent มาเสนอทับ
      await as("u-mod", `/api/evidence/${evId}`, {
        method: "PATCH", body: JSON.stringify({ tier: "C", reason: "ทดสอบกฎ agent" }),
      });
      const afterConfirm = await as("u-owner3", `/api/evidence/${evId}/propose-tier`, { method: "POST" });
      t("ของที่ยืนยันแล้ว agent เสนอทับไม่ได้", afterConfirm.status === 400, `ได้ ${afterConfirm.status}`);

      await as("u-mod", `/api/evidence/${evId}`, { method: "DELETE" });
      t("ลบหลักฐานที่ใช้ทดสอบคืนแล้ว",
        !(await state("u-mod")).evidence.some((e) => e.id === evId));
    }
  }

  group("คืนสภาพชั้นหลักฐาน — ชุดทดสอบต้องไม่ทิ้งร่องรอย");
  const tierRestore = await restoreTiers();
  const baseUnconf = tierBaseline.filter((b) => b.confirmedTier === null).length;
  t("ชั้นหลักฐานทุกชิ้นกลับเป็นสภาพเดิม", tierRestore.drift.length === 0,
    tierRestore.drift.map((d) => d.id).join(" "));
  t(`จำนวนที่ยังไม่ยืนยันกลับเป็น ${baseUnconf}`,
    tierRestore.unconfirmed === baseUnconf, tierRestore.unconfirmed);
  const finalTiers = (await state("u-mod")).evidence;

  group("เพิกถอนชั้นที่ยืนยันผิด — ทีมกลางเท่านั้น");
  const toRevoke = finalTiers.find((e) => e.confirmedTier !== null);
  if (toRevoke) {
    const ownerRevoke = await as("u-owner1", `/api/evidence/${toRevoke.id}`, {
      method: "PATCH", body: JSON.stringify({ tier: null }),
    });
    t("เจ้าของข้อมูลเพิกถอนชั้น -> 403", ownerRevoke.status === 403, `ได้ ${ownerRevoke.status}`);
    const rev = await as("u-mod", `/api/evidence/${toRevoke.id}`, {
      method: "PATCH", body: JSON.stringify({ tier: null, reason: "ทดสอบการเพิกถอน" }),
    });
    t("ผู้ดูแลเพิกถอนได้", rev.status === 200, rev.body?.error);
    t(`ค่า Verified ลดลงตาม (${rev.body?.verifiedBefore}% -> ${rev.body?.verifiedAfter}%)`,
      (rev.body?.verifiedAfter ?? 100) < (rev.body?.verifiedBefore ?? 0));
    const again = await as("u-mod", `/api/evidence/${toRevoke.id}`, {
      method: "PATCH", body: JSON.stringify({ tier: null }),
    });
    t("เพิกถอนซ้ำที่ยังไม่เคยยืนยัน -> ปฏิเสธ", again.status >= 400, again.body?.error);
    // คืนกลับ
    await as("u-mod", `/api/evidence/${toRevoke.id}`, {
      method: "PATCH", body: JSON.stringify({ tier: toRevoke.confirmedTier, reason: "คืนสภาพ" }),
    });
    t("คืนชั้นเดิมกลับได้",
      (await state("u-mod")).evidence.find((e) => e.id === toRevoke.id).confirmedTier
        === toRevoke.confirmedTier);
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
  code = fail > 0 ? 2 : 0;
} catch (e) {
  console.error("\n⛔ เทสต์ล้ม:", e?.stack ?? e);
  code = 1;
} finally {
  /*
    คืนสภาพให้ได้เสมอ แม้ชุดทดสอบจะล้มกลางคัน
    นี่คือสิ่งที่กันไม่ให้ความล้มครั้งเดียว ทำให้ข้อมูลเดโมเพี้ยนถาวร
  */
  try {
    const g = await releaseGuard();
    if (!g.skipped && !g.ok) {
      console.error(`\n⚠ ย้อนฐานข้อมูลกลับไม่สำเร็จ: ${g.error ?? ""}`);
    }
    const r = await restoreTiers();
    if (r.restored && r.drift.length > 0) {
      console.error(`\n⚠ คืนชั้นหลักฐานไม่ครบ: ${r.drift.map((d) => d.id).join(" ")}`);
    }
  } catch (e2) {
    console.error("\n⚠ คืนสภาพชั้นหลักฐานไม่สำเร็จ:", e2?.message ?? e2);
  }
}
// process.exit ข้าม finally จึงต้องเรียกหลังบล็อกจบแล้วเท่านั้น
process.exit(code);
