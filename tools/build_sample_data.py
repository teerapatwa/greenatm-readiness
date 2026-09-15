# -*- coding: utf-8 -*-
"""
build_sample_data.py — สร้าง sample-data/manifest.json ตามโครงจริงของ GreenATM

ดึงชื่อหัวข้อ · คะแนน · objective รายระดับ จาก GreenATM_TopicsandLevelObjectives.pdf
(ต้องมี pdftotext) แล้วประกอบกับคะแนน raw สมมติที่ออกแบบไว้เพื่อการสาธิต

    python tools/build_sample_data.py

⚠️ ชื่อหัวข้อ · คะแนน · objective = ของจริงจากเอกสาร CANSO
   คะแนน raw · หลักฐาน · เจ้าของ = SYNTHETIC สร้างขึ้นเพื่อสาธิต
"""
import io, json, os, re, subprocess, sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, "GreenATM_TopicsandLevelObjectives.pdf")
TXT = os.path.join(ROOT, "tools", "_gatm.txt")

if not os.path.exists(TXT):
    subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", PDF, TXT], check=True)
raw = io.open(TXT, encoding="utf-8").read()
flat = re.sub(r"\s+", " ", raw)

# ── ชื่อหัวข้อ + คะแนน (ของจริง) ───────────────────────────────────────────
NAMES = {}
for m in re.finditer(r"(1\.\d+\.\d+) ([A-Z][^()]{3,70}?) \((\d+) pts\)", flat):
    NAMES.setdefault(m.group(1), (m.group(2).strip(), int(m.group(3))))
# หัวข้อที่ชื่อมีวงเล็บ — regex ข้างบนจับไม่ได้ เติมจากสารบัญของเอกสารเดียวกัน
NAMES.update({
    "1.2.1":  ("Flexible Use of Airspace (FUA)", 8),
    "1.2.4":  ("Airport Collaborative Decision Making (A-CDM)", 3),
    "1.2.5":  ("Continuous Climb Operations (CCO)", 5),
    "1.2.6":  ("Continuous Descent Operations (CDO)", 8),
    "1.2.7":  ("Performance Based Navigation (PBN)", 7),
    "1.2.10": ("Air Traffic Flow Management (ATFM)", 8),
})

# ── objective รายระดับ (ของจริง) ───────────────────────────────────────────
OBJ = {}
for m in re.finditer(r"^(1\.\d+\.\d+)\.(\d)\s+Level\s+(\d)\s*$", raw, re.M):
    seg = raw[m.end():m.end() + 1500]
    o = re.search(r"Objective\s+(.+?)(?:\n\s*\n|What this objective)", seg, re.S)
    if o:
        OBJ["%s|%s" % (m.group(1), m.group(3))] = " ".join(o.group(1).split())[:260]

CAT = {"1.1": ("Governance", "การกำกับดูแล"),
       "1.2": ("Improved ATM", "การปรับปรุงการจราจรทางอากาศ"),
       "1.3": ("Business Operations", "การดำเนินธุรกิจ")}

TH = {
 "1.1.1": "นโยบายและแผนด้านสิ่งแวดล้อม", "1.1.2": "ระบบจัดการสิ่งแวดล้อม",
 "1.1.3": "วัฒนธรรมองค์กรด้านสิ่งแวดล้อม", "1.1.4": "เป้าหมายด้านสิ่งแวดล้อม",
 "1.2.1": "การใช้ห้วงอากาศแบบยืดหยุ่น (FUA)", "1.2.2": "ข้อมูลอุตุนิยมวิทยา",
 "1.2.3": "การปรับปรุงการเฝ้าตรวจและการสื่อสาร", "1.2.4": "A-CDM ที่ท่าอากาศยาน",
 "1.2.5": "การไต่ระดับต่อเนื่อง (CCO)", "1.2.6": "การร่อนลงต่อเนื่อง (CDO)",
 "1.2.7": "การเดินอากาศตามสมรรถนะ (PBN)", "1.2.8": "ความจุทางวิ่ง",
 "1.2.9": "การปรับวิถีการบินให้เหมาะสม", "1.2.10": "การบริหารความคล่องตัวจราจร (ATFM)",
 "1.2.11": "การวิจัยและพัฒนา", "1.3.1": "การจัดการก๊าซเรือนกระจก",
 "1.3.2": "การบินตรวจสอบ CNS", "1.3.3": "การจัดซื้อจัดจ้างที่ยั่งยืน",
 "1.3.4": "กระบวนการเปลี่ยนแปลงห้วงอากาศ", "1.3.5": "การบริหารการเดินทาง",
}

OWNER = {"1.1": "u-gov", "1.2": "u-ops", "1.3": "u-env"}

# ── คะแนน raw สมมติ [L1..L5] · ออกแบบให้ L1 100 · L2 93 · L3 58 · L4 8 ─────
# กฎ cliff: awarded ให้ถึงระดับต่ำสุดที่ยังไม่เต็ม · ระดับที่สูงกว่าได้ 0
RAW = {
 "1.1.1": [4, 4, 4, 2, 0], "1.1.2": [3, 3, 2, 0, 0],
 "1.1.3": [4, 4, 3, 0, 0], "1.1.4": [3, 3, 1, 0, 0],
 "1.2.1": [8, 8, 8, 0, 0], "1.2.2": [4, 4, 4, 1, 0],
 "1.2.3": [8, 8, 4, 0, 0], "1.2.4": [3, 3, 3, 3, 0],
 "1.2.5": [5, 5, 3, 0, 0], "1.2.6": [8, 8, 5, 0, 0],
 "1.2.7": [7, 7, 7, 0, 0], "1.2.8": [4, 4, 2, 0, 0],
 "1.2.9": [8, 6, 8, 0, 0],            # ⭐ cliff: L2 ไม่เต็ม → L3 ที่ทำไว้ 8 ได้ 0
 "1.2.10": [8, 8, 4, 0, 0],
 "1.2.11": [6, 4, 6, 0, 0],           # ⭐ cliff เหมือนกัน
 "1.3.1": [7, 7, 5, 0, 0], "1.3.2": [2, 2, 2, 2, 0],
 "1.3.3": [3, 2, 0, 0, 0], "1.3.4": [2, 2, 1, 0, 0], "1.3.5": [3, 1, 0, 0, 0],
}

# ── แผนงาน / กำหนดส่ง / ประวัติการเลื่อน (SYNTHETIC) ──────────────────────
# รอบส่งข้อมูล: ภายในวันที่ 5 ของเดือนถัดไป (app_setting.monthly_due_day)
CYCLE_DUE = "2026-09-05"

# topic -> (ส่งข้อมูลรอบนี้แล้วหรือยัง, วันอัปเดตล่าสุด)
SUBMITTED = {
 "1.1.1": ("2026-09-03", None), "1.1.2": ("2026-08-30", None),
 "1.1.3": (None, "2025-07-15"),            # ไม่ส่งรอบนี้ · หลักฐานเก่า 14 เดือน
 "1.1.4": ("2026-09-04", None),
 "1.2.1": ("2026-09-02", None), "1.2.2": ("2026-09-01", None),
 "1.2.3": (None, "2026-06-20"),            # ไม่ส่งรอบนี้
 "1.2.4": ("2026-09-04", None), "1.2.5": ("2026-09-03", None),
 "1.2.6": ("2026-08-20", None), "1.2.7": ("2026-09-05", None),
 "1.2.8": ("2026-09-02", None),
 "1.2.9": (None, "2026-04-03"),            # ⭐ ไม่ส่งรอบนี้ · เป็นหัวข้อที่ติด cliff
 "1.2.10": ("2026-09-01", None),
 "1.2.11": (None, "2026-05-12"),           # ⭐ ไม่ส่งรอบนี้ · ติด cliff เหมือนกัน
 "1.3.1": ("2026-08-31", None), "1.3.2": ("2026-09-04", None),
 "1.3.3": (None, "2026-03-11"),            # ไม่ส่งรอบนี้
 "1.3.4": ("2026-09-03", None),
 "1.3.5": (None, "2026-02-28"),            # ไม่ส่งรอบนี้ · ไม่มีหลักฐานเลย
}

# แผนปิดช่องว่าง — เฉพาะหัวข้อที่กำลังทำอยู่ · มีประวัติการเลื่อน
PLANS = {
 "1.2.9": {"name": "ปิดช่องว่างระดับ 2 — จัดทำรายงานผลการใช้งานจริง",
           "plannedDate": "2026-08-15", "revisedDate": "2026-10-31", "percent": 45,
           "slips": [["2026-08-15", "2026-09-15", "รอข้อมูลจากกองปฏิบัติการ"],
                     ["2026-09-15", "2026-09-30", "รอข้อมูลจากกองปฏิบัติการ"],
                     ["2026-09-30", "2026-10-31", "รอข้อมูลจากกองปฏิบัติการ"]]},
 "1.2.11": {"name": "ปิดช่องว่างระดับ 2 — สรุปผลโครงการวิจัยที่ปิดแล้ว",
            "plannedDate": "2026-09-10", "revisedDate": "2026-10-15", "percent": 30,
            "slips": [["2026-09-10", "2026-10-15", "ผู้รับผิดชอบติดภารกิจอื่น"]]},
 "1.3.1": {"name": "ติดตั้งระบบผลิตไฟฟ้าพลังงานแสงอาทิตย์ 120 kWp",
           "plannedDate": "2026-09-30", "revisedDate": "2026-12-15", "percent": 35,
           "slips": [["2026-09-30", "2026-10-31", "รอหน้าต่างหยุดจ่ายไฟ"],
                     ["2026-10-31", "2026-11-30", "รอหน้าต่างหยุดจ่ายไฟ"],
                     ["2026-11-30", "2026-12-15", "รอหน้าต่างหยุดจ่ายไฟ"]]},
 "1.2.6": {"name": "ขยายการวัด CDO ไปยัง VTBD",
           "plannedDate": "2027-01-31", "revisedDate": None, "percent": 10, "slips": []},
 "1.1.3": {"name": "จัดอบรมความตระหนักรอบปี 2570",
           "plannedDate": "2027-03-31", "revisedDate": None, "percent": 0, "slips": []},
}

# ── หลักฐาน 24 ชิ้น จับคู่กับหัวข้อ/ระดับจริง ──────────────────────────────
EV = [
 ("E-001", "1.1.1", 2, "บันทึกการประชุมคณะกรรมการ 2-2569.pdf", "2026-03-12", "B",
  "เอกสารภายในที่ผ่านการรับรองและลงนามแล้ว"),
 ("E-002", "1.1.4", 3, "(ร่าง) เป้าหมายระหว่างทาง.docx", "2026-08-05", "C",
  "ร่าง ยังไม่ผ่านความเห็นชอบ"),
 ("E-003", "1.1.2", 3, "บันทึกประชุมติดตามงาน 6-2569.pdf", "2026-08-28", "C",
  "บันทึกการประชุม ยังไม่ผ่านการรับรอง และไม่มีผลการตรวจติดตาม"),
 ("E-004", "1.1.2", 3, "สไลด์ความคืบหน้า EMS.pptx", "2026-08-30", "C",
  "สไลด์นำเสนอภายใน ไม่มีเอกสารอ้างอิงประกอบ"),
 ("E-005", "1.2.6", 3, "รายงานผลการทดลองวัด ENV-2569-041.pdf", "2026-06-18", "A",
  "ลงนามรับรอง มีข้อมูลที่วัดได้ ระบุขอบเขตชัดเจน"),
 ("E-006", "1.2.6", 2, "บันทึกอนุมัติวิธีคำนวณ ENV-2569-033.pdf", "2026-05-02", "B",
  "เอกสารภายในที่อนุมัติแล้ว"),
 ("E-007", "1.2.6", 4, "(ร่าง) แผนขยายไป VTBD.docx", "2026-08-20", "C",
  "ร่าง ยังไม่มีผู้รับผิดชอบและงบประมาณ"),
 ("E-008", "1.3.1", 3, "สรุปการคัดกรอง Scope 3.docx", "2026-07-15", "C",
  "เอกสารภายในเพื่อหารือ ไม่มีข้อมูลเชิงปริมาณประกอบ"),
 ("E-009", "1.3.1", 3, "บันทึกช่วยจำการรายงานด้วยวาจา.docx", "2026-08-22", "D",
  "เป็นการรายงานด้วยวาจา ไม่มีเอกสารประกอบ"),
 ("E-010", "1.3.1", 4, "(ร่าง) แผนดำเนินการลดพลังงาน 2570.docx", "2026-09-01", "C",
  "เป็นแผนที่ตั้งใจจะทำในอนาคต ไม่มีผลการวัดใด ๆ"),
 ("E-011", "1.3.1", 2, "รายงานผลตรวจวัดหลังปรับปรุง ENG-2569-118.pdf", "2026-07-30", "A",
  "ตรวจวัดโดยหน่วยงานภายนอก มีผลสอบเทียบเครื่องมือแนบ"),
 ("E-012", "1.3.1", 2, "บันทึกส่งมอบงาน ENG-2569-121.pdf", "2026-08-08", "B",
  "เอกสารภายในที่อนุมัติรับมอบงานแล้ว"),
 ("E-013", "1.3.1", 4, "บันทึกอนุมัติแผนงาน ENG-2569-055.pdf", "2026-02-14", "B",
  "อนุมัติแผน ไม่ใช่ผลลัพธ์"),
 ("E-014", "1.3.1", 4, "รายงานความคืบหน้า ส.ค. 2569.docx", "2026-08-31", "C",
  "รายงานภายใน ยังไม่ผ่านการรับรอง · ระบุการขอเลื่อนครั้งที่ 3"),
 ("E-015", "1.3.1", 3, "รายงานความครอบคลุมมิเตอร์ ENG-2569-097.pdf", "2026-06-25", "A",
  "ผ่านการตรวจสอบและรับรองจากหน่วยตรวจสอบภายใน · ระบุความครอบคลุม 60%"),
 ("E-016", "1.3.1", 3, "บันทึกอนุมัติแผนระยะที่ 2 ENG-2569-103.pdf", "2026-07-10", "B",
  "เอกสารภายในที่อนุมัติแล้ว"),
 ("E-017", "1.1.3", 3, "รายงานสรุปผลการอบรม HR-2568-214.pdf", "2025-07-15", "B",
  "อนุมัติแล้ว แต่ลงวันที่เกิน 12 เดือน"),
 ("E-018", "1.1.3", 4, "(ร่าง) กำหนดการอบรม 2570.docx", "2026-08-12", "C",
  "ร่าง ยังไม่ยืนยันงบประมาณ"),
 ("E-019", "1.1.3", 2, "รายงานต่อผู้มีส่วนได้เสีย ENV-2569-012.pdf", "2026-02-20", "B",
  "เอกสารภายในที่อนุมัติเผยแพร่แล้ว"),
 ("E-020", "1.1.3", 3, "บันทึกประชุมหารือแนวทางรายงาน 2569.docx", "2026-07-18", "C",
  "ยังไม่ได้ข้อสรุป"),
 ("E-021", "1.2.9", 3, "รายงานผลการศึกษาการลดเวลาวิ่งบนทางขับ.pdf", None, "ASK",
  "ไม่มีวันที่ในตัวเอกสาร → ระบบต้องถาม ห้ามเดาจากวันอัปโหลด"),
 ("E-022", "1.2.9", 2, "บันทึกอนุมัติแนวปฏิบัติ OPS-2569-078.pdf", "2026-04-03", "B",
  "เอกสารภายในที่อนุมัติแล้ว"),
 ("E-023", "1.2.6", 3, "หนังสือรับรองผลการทวนสอบ EXT-2569-009.pdf", "2026-08-05", "A",
  "ผ่านการทวนสอบจากหน่วยงานภายนอก"),
 ("E-024", "1.1.4", 4, "(ร่าง) โครงร่างรายงานความยั่งยืน 2569.docx", "2026-08-28", "C",
  "ร่างโครงร่าง ยังไม่มีเนื้อหา"),
]

nums = sorted({k.split("|")[0] for k in OBJ}, key=lambda s: [int(x) for x in s.split(".")])
assert len(nums) == 20, "ต้องได้ 20 หัวข้อ แต่ได้ %d" % len(nums)

topics = []
for i, n in enumerate(nums, 1):
    name, pts = NAMES[n]
    cat = n.rsplit(".", 1)[0]
    rawpts = RAW[n]
    # กฎ cliff: awarded ถึงระดับต่ำสุดที่ยังไม่เต็ม
    awarded, stopped = [], False
    for L in range(5):
        if stopped:
            awarded.append(0)
        else:
            awarded.append(rawpts[L])
            if rawpts[L] < pts:
                stopped = True
    blocked = sum(rawpts[L] for L in range(5) if awarded[L] == 0 and rawpts[L] > 0)
    topics.append({
        "code": "T%02d" % i, "ref": n, "category": CAT[cat][0], "categoryTh": CAT[cat][1],
        "name": name, "nameTh": TH[n], "points": pts, "owner": OWNER[cat],
        "levels": [{"level": L + 1, "objective": OBJ.get("%s|%d" % (n, L + 1), ""),
                    "raw": rawpts[L], "awarded": awarded[L]} for L in range(5)],
        "blockedPoints": blocked,
        "dueDate": CYCLE_DUE,
        "submittedOn": SUBMITTED.get(n, (None, None))[0],
        "lastUpdate": SUBMITTED.get(n, (None, None))[0] or SUBMITTED.get(n, (None, None))[1],
        "plan": PLANS.get(n),
        "evidence": [{"id": e[0], "level": e[2], "file": e[3], "documentDate": e[4],
                      "expectedTier": e[5], "why": e[6],
                      "path": "evidence/%s.md" % e[0]} for e in EV if e[1] == n],
    })

byLevel = [sum(t["levels"][L]["awarded"] for t in topics) for L in range(5)]
byCat = {}
for c in ("Governance", "Improved ATM", "Business Operations"):
    byCat[c] = [sum(t["levels"][L]["awarded"] for t in topics if t["category"] == c) for L in range(5)]

PASS = 80
def achieved(T):
    """ได้ระดับ T ไหม — ทุกระดับ 1..T ต้องถึง 80 · เติมจากระดับบนได้ระดับเดียว"""
    short = [L for L in range(T) if byLevel[L] < PASS]
    if not short:
        return True, 0, 0
    if len(short) > 1:
        return False, sum(PASS - byLevel[L] for L in short), 0
    L = short[0]
    need = PASS - byLevel[L]
    pool = sum(byLevel[x] for x in range(L + 1, 5))
    return pool >= need, need, pool

summary = []
for T in range(1, 6):
    ok, need, pool = achieved(T)
    own = all(byLevel[L] >= PASS for L in range(T))
    summary.append({"level": T, "total": byLevel[T - 1],
                    "required": PASS, "short": max(0, PASS - byLevel[T - 1]),
                    "availableAbove": sum(byLevel[x] for x in range(T, 5)),
                    "achievedOwnRight": own, "achievedWithContribution": ok and not own,
                    "achieved": ok})
current = max([s["level"] for s in summary if s["achieved"]] or [0])
tot = sum(t["points"] for t in topics)
assert tot == 100, "คะแนนรวมต้องเป็น 100 แต่ได้ %d" % tot

M = {
 "_synthetic": True,
 "_warning": "ชื่อหัวข้อ · คะแนน · objective = ของจริงจาก CANSO GreenATM · "
             "คะแนน raw · หลักฐาน · เจ้าของ = SYNTHETIC สร้างขึ้นเพื่อสาธิตเท่านั้น",
 "_note_for_implementers": "expectedTier / blockedPoints มีไว้สำหรับ verify.py เท่านั้น "
                           "ห้ามส่งเข้า context ของโมเดล",
 "source": "GreenATM_TopicsandLevelObjectives.pdf · GreenATM_AccreditationGuide_2026.pdf (CANSO, v2.0 ส.ค. 2026)",
 "asOfDate": "2026-09-15", "cycle": "ก.ย. 2569",
 "scoring": {
   "totalPoints": tot, "passMark": 80, "levels": 5,
   "rule": "awarded ให้ถึงระดับต่ำสุดที่ยังไม่เต็ม · ระดับที่สูงกว่าได้ 0",
   "flowDown": "คะแนนเกินจากระดับสูงเติมระดับล่างได้ 'ระดับเดียว' เท่านั้น",
   "currentAccreditation": current, "targetAccreditation": current + 1,
   "awardedByLevel": byLevel, "awardedByCategory": byCat, "summary": summary,
 },
 "divisions": [{"id": "d-gov", "name": "สำนักนโยบายและแผน"},
               {"id": "d-ops", "name": "กองปฏิบัติการจราจรทางอากาศ"},
               {"id": "d-env", "name": "กองสิ่งแวดล้อมและวิศวกรรม"}],
 "users": [{"id": "u-gov", "name": "ผู้ส่งข้อมูล สำนักนโยบายและแผน", "division_id": "d-gov", "role": "submitter"},
           {"id": "u-ops", "name": "ผู้ส่งข้อมูล กองปฏิบัติการ", "division_id": "d-ops", "role": "submitter"},
           {"id": "u-env", "name": "ผู้ส่งข้อมูล กองสิ่งแวดล้อม", "division_id": "d-env", "role": "submitter"},
           {"id": "u-cen", "name": "ทีมกลาง", "division_id": "d-gov", "role": "central"},
           {"id": "u-exe", "name": "ผู้บริหาร", "division_id": "d-gov", "role": "executive"}],
 "app_setting": {"pass_mark": 80, "evidence_stale_months": 12,
                 "agent_max_tool_calls": 10, "agent_timeout_seconds": 60,
                 "monthly_due_day": 5, "alert_lead_days": 15,
                 "slip_escalate_after": 3, "stale_update_days": 30},
 "cycleDue": CYCLE_DUE,
 "topics": topics,
}
io.open(os.path.join(ROOT, "sample-data", "manifest.json"), "w", encoding="utf-8").write(
    json.dumps(M, ensure_ascii=False, indent=2))

print("หัวข้อ %d · คะแนนรวม %d" % (len(topics), tot))
print("awarded ต่อระดับ  L1 %d · L2 %d · L3 %d · L4 %d · L5 %d" % tuple(byLevel))
print("ระดับที่ได้ตอนนี้: Level %d" % current)
for s_ in summary:
    print("   L%d  %3d/100  ขาด %2d  เติมได้จากบน %2d  %s"
          % (s_["level"], s_["total"], s_["short"], s_["availableAbove"],
             "ได้" if s_["achieved"] else "ยังไม่ได้"))
blk = sorted([t for t in topics if t["blockedPoints"]], key=lambda t: -t["blockedPoints"])
print("คะแนนที่ทำไว้แล้วแต่ได้ 0 เพราะกฎ cliff:")
for t in blk:
    print("   %s %-42s ทำไว้ %d คะแนน แต่ติดที่ระดับล่างยังไม่เต็ม" % (t["code"], t["name"][:42], t["blockedPoints"]))
print("รวมที่ถูกบล็อก %d คะแนน" % sum(t["blockedPoints"] for t in blk))
