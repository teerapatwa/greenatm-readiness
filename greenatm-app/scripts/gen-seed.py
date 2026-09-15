#!/usr/bin/env python3
"""
สร้าง sample-data/seed.json แบบกำหนดผลตายตัว (deterministic)

ข้อบกพร่องถูก "ปั้นใส่ข้อมูล" ก่อน ไม่ใช่เขียนเทสต์ให้ผ่านโค้ดทีหลัง (PLAN §6.2)
สคริปต์นี้ assert ค่าคงที่ของชุดข้อมูลตอนสร้าง — ถ้าแก้ข้อมูลแล้วตัวเลขเพี้ยน มันจะไม่ยอมเขียนไฟล์
"""
import json, os, sys, datetime as dt

# คอนโซล Windows เป็น cp1252 — พิมพ์ไทยแล้วพังถ้าไม่บังคับ UTF-8
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

TODAY = dt.date(2026, 9, 15)
CYCLE = "2026-09"
CYCLE_DUE = dt.date(2026, 9, 20)          # อีก 5 วัน → A-DUESOON ยิง · A-OVERDUE ไม่ยิง
D = lambda d: d.isoformat()

DIVISIONS = [
    {"id": "div1", "name": "สำนักนโยบายและแผน", "nameEn": "Policy & Planning Bureau", "category": 1},
    {"id": "div2", "name": "กองปฏิบัติการจราจรทางอากาศ", "nameEn": "ATC Operations Division", "category": 2},
    {"id": "div3", "name": "กองวิศวกรรมและซ่อมบำรุง", "nameEn": "Engineering & Maintenance Division", "category": 3},
    {"id": "div4", "name": "กองสื่อสารองค์กร", "nameEn": "Corporate Communications", "category": 4},
]

# ผู้ใช้เดโม 5 คน — ตำแหน่งเท่านั้น ไม่มีชื่อบุคคลสมมติ (PLAN §4.3.1)
USERS = [
    {"id": "u-owner1", "title": "หัวหน้าส่วนนโยบายสิ่งแวดล้อม", "role": "owner", "divisionId": "div1"},
    {"id": "u-owner2", "title": "หัวหน้าส่วนบริหารจัดการห้วงอากาศ", "role": "owner", "divisionId": "div2"},
    {"id": "u-owner3", "title": "หัวหน้าส่วนพลังงานและสาธารณูปโภค", "role": "owner", "divisionId": "div3"},
    {"id": "u-mod", "title": "ผู้ประสานงานระบบ GreenATM", "role": "central", "divisionId": None},
    {"id": "u-exec", "title": "ผู้บริหารที่รับผิดชอบงาน GreenATM", "role": "executive", "divisionId": None},
    # หมวด 4 ไม่มีผู้ใช้โดยเจตนา → แจ้งเตือน 5 รายการไม่ถึงใคร (PLAN §4.3.1 ข้อ 3)
]

CATEGORIES = [
    {"num": 1, "name": "นโยบายและการกำกับดูแล", "divisionId": "div1"},
    {"num": 2, "name": "ปฏิบัติการจราจรทางอากาศ", "divisionId": "div2"},
    {"num": 3, "name": "โครงสร้างพื้นฐานและพลังงาน", "divisionId": "div3"},
    {"num": 4, "name": "สื่อสารองค์กรและวัฒนธรรม", "divisionId": "div4"},
]

NAMES = {
    "1.1": "นโยบายสิ่งแวดล้อมที่ผ่านความเห็นชอบระดับบริหาร",
    "1.2": "เป้าหมายระหว่างทางสู่ Net Zero พร้อมตัวชี้วัด",
    "1.3": "ระบบจัดการสิ่งแวดล้อมและรอบการตรวจภายใน",
    "1.4": "การรายงานผลด้านสิ่งแวดล้อมต่อคณะกรรมการ",
    "2.1": "การลดระยะทางบินจากการปรับปรุงโครงสร้างเส้นทาง",
    "2.2": "การใช้ Continuous Climb Operations (CCO)",
    "2.3": "การใช้ Continuous Descent Operations (CDO)",
    "2.4": "การลดเวลาวิ่งบนทางขับ (taxi time)",
    "2.5": "การจัดการการรอคอยในอากาศ (holding)",
    "2.6": "การประสานงานการไหลจราจรกับสนามบิน",
    "2.7": "การวัดผลประโยชน์ด้านเชื้อเพลิงจากการปรับปรุงเส้นทางบิน",
    "2.8": "วิธีคำนวณผลประโยชน์ที่เป็นของ ANSP ตกลงร่วมกับผู้มีส่วนได้เสีย",
    "2.9": "การใช้ข้อมูลเรดาร์ย้อนหลังเพื่อวิเคราะห์ประสิทธิภาพเส้นทาง",
    "2.10": "การรายงานผลการดำเนินงานด้านสิ่งแวดล้อมรายไตรมาส",
    "2.11": "การฝึกอบรมผู้ควบคุมจราจรด้านการบินประหยัดเชื้อเพลิง",
    "2.12": "การทบทวนขั้นตอนปฏิบัติให้สอดคล้องแนวทาง CANSO",
    "3.1": "การติดตั้งมิเตอร์วัดพลังงานแยกอาคารและแยกวงจร",
    "3.2": "โครงการเพิ่มประสิทธิภาพระบบปรับอากาศ",
    "3.3": "การจัดทำบัญชีก๊าซเรือนกระจก Scope 1 และ 2",
    "3.4": "การใช้พลังงานหมุนเวียนในสถานีภูมิภาค",
    "4.1": "การสื่อสารนโยบายสิ่งแวดล้อมภายในองค์กร",
    "4.2": "การมีส่วนร่วมของพนักงานในโครงการสิ่งแวดล้อม",
    "4.3": "การเปิดเผยข้อมูลด้านสิ่งแวดล้อมต่อสาธารณะ",
    "4.4": "ความร่วมมือด้านสิ่งแวดล้อมกับสายการบินและสนามบิน",
}

CODES = list(NAMES.keys())

# ── ระดับที่ไปถึง ─────────────────────────────────────────────────────────────
# รวม 44 จาก 24 รายการ → เฉลี่ย 1.83 · ปีที่แล้วรวม 39 → 1.62 · ขยับ 5 รายการ
LEVEL = {c: 1 for c in CODES}
for c in ["1.1", "1.3", "2.1", "2.3", "2.5", "2.7", "2.9", "3.1", "3.3", "4.3", "4.4", "2.6"]:
    LEVEL[c] = 2
LEVEL["2.11"] = 5
LEVEL["2.12"] = 5
MOVED = {"1.2", "2.3", "2.5", "2.7", "3.1"}      # 5 รายการที่ขยับ → 19 รายการนิ่ง
LAST_YEAR = {c: (LEVEL[c] - 1 if c in MOVED else LEVEL[c]) for c in CODES}
TARGET = {c: min(5, LEVEL[c] + 1) for c in CODES}
TARGET["2.11"] = 5
TARGET["2.12"] = 5

# % ความคืบหน้าภายในระดับถัดไป — เจ้าของกรอกเอง ไม่มีผลต่อตัวเลขที่ยืนยันแล้ว
PCT = {c: 0 for c in CODES}
PCT.update({"1.1": 30, "1.2": 45, "1.3": 20, "2.1": 25, "2.3": 60, "2.5": 15,
            "2.7": 70, "2.8": 35, "2.9": 10, "3.1": 55, "3.3": 40, "4.3": 20,
            "4.1": 100})   # ⭐ AC-01 — รายงานว่าเสร็จ 100% แต่หลักฐานนับได้ 0

NOT_SUBMITTED = {"1.4", "2.4", "2.6", "4.2"}      # 4 รายการ ครบกำหนดอีก 5 วัน
LATE_MILESTONE = {"2.2", "2.9"}                    # 2 รายการ milestone เลยวันแผน
SLIP3 = {"2.10", "3.3"}                            # เลื่อนครั้งที่ 3 → ESCALATE ถึง moderator
SLIP1 = {"2.5", "3.1"}                             # เลื่อนครั้งแรก → ไม่รบกวน moderator
NO_EVIDENCE = {"1.4", "2.4", "2.6", "2.11", "2.12", "2.1", "2.2", "3.1", "3.4",
               "4.1", "4.2", "4.3", "4.4"}         # 13 รายการ
NO_DATE = {"2.10", "3.3"}                          # เอกสารไม่มีวันที่ในตัวเอง
STALE = {"2.9", "3.2"}                             # เอกสารเก่ากว่า 12 เดือน

SLIP_REASON = "รอผลการพิจารณางบประมาณ"

def milestones(code):
    """
    ตั้งวันแผนไว้ให้ "ไม่มีใครเลยกำหนด" โดยค่าเริ่มต้น
    แล้วค่อยทำให้เลยกำหนดเฉพาะรายการใน LATE_MILESTONE —
    ไม่อย่างนั้นกฎ A-MILESTONE จะยิงทุกรายการ และตัวเลขที่ยืนยันไว้จะเพี้ยนทั้งชุด
    """
    plan = [
        ("2026-05-01", "2026-06-25"),   # ขั้นที่ 1 — จบแล้ว
        ("2026-09-25", "2026-11-20"),   # ขั้นที่ 2 — ยังไม่ถึงกำหนด
        ("2026-12-01", "2027-01-31"),   # ขั้นที่ 3 — ยังไม่เริ่ม
    ]
    out = []
    for i, (ps, pe) in enumerate(plan, start=1):
        done = 100 if i == 1 else (PCT[code] if i == 2 else 0)
        m = {
            "seq": i, "name": f"ขั้นที่ {i}", "weight": round(100 / len(plan), 2),
            "plannedStart": ps, "plannedEnd": pe,
            "actualStart": ps if done > 0 else None,
            "actualEnd": pe if done == 100 else None,
            "percentComplete": done,
        }
        if code in LATE_MILESTONE and i == 2:
            m["plannedEnd"] = D(TODAY - dt.timedelta(days=12))   # เลยวันแผนแล้วยังไม่ 100%
            m["plannedStart"] = D(TODAY - dt.timedelta(days=70))
            m["percentComplete"] = 40
            m["actualStart"] = D(TODAY - dt.timedelta(days=65))
            m["actualEnd"] = None
        out.append(m)
    return out

def slips(code):
    if code in SLIP3:
        return [
            {"from": "2026-05-30", "to": "2026-06-30", "reason": SLIP_REASON, "by": "owner", "at": "2026-05-20"},
            {"from": "2026-06-30", "to": "2026-07-31", "reason": SLIP_REASON, "by": "owner", "at": "2026-06-25"},
            {"from": "2026-07-31", "to": "2026-09-30", "reason": SLIP_REASON, "by": "owner", "at": "2026-07-28"},
        ]
    if code in SLIP1:
        return [{"from": "2026-06-30", "to": "2026-07-31", "reason": "รอเอกสารจากผู้รับเหมา", "by": "owner", "at": "2026-06-20"}]
    return []

EV_SPEC = {
    # code: [(title, documentDate, proposedTier, reason)]
    "1.1": [("มติคณะกรรมการอนุมัตินโยบายสิ่งแวดล้อม", "2026-02-18", "B", "เอกสารภายในที่อนุมัติแล้ว")],
    "1.2": [("(ร่าง) เป้าหมายระหว่างทาง ฉบับหารือ", "2026-07-02", "C", "เป็นร่าง ยังไม่ผ่านความเห็นชอบ")],
    "1.3": [("รายงานผลการตรวจภายใน รอบ 1/2569 ลงนาม", "2026-04-11", "A", "รายงานที่ผ่านการตรวจและลงนาม")],
    "2.3": [("รายงานอัตราการใช้ CDO ราย 3 เดือน ลงนาม", "2026-06-30", "A", "ผลวัดจริงพร้อมผู้ลงนาม"),
            ("สไลด์นำเสนอผลเบื้องต้น", "2026-05-12", "C", "สไลด์นำเสนอ ไม่ใช่ผลที่รับรอง")],
    "2.5": [("บันทึกการประชุมทบทวนการจัดการ holding", "2026-06-02", "B", "บันทึกภายในที่อนุมัติแล้ว")],
    "2.7": [("รายงานผลการทดลอง ลงนาม 12 มิ.ย. 2569", "2026-06-12", "A", "ผลวัดจริง ลงนามรับรอง ระบุขอบเขตชัด"),
            ("(ร่าง) แผนดำเนินการปี 2570", "2026-08-02", "C", "เป็นแผนล่วงหน้า ยังไม่มีผลการดำเนินการ")],
    "2.8": [("(ร่าง) วิธีคำนวณผลประโยชน์ ฉบับหารือ", "2026-08-20", "C", "ยังไม่ผ่านความเห็นชอบผู้มีส่วนได้เสีย")],
    "2.9": [("รายงานวิเคราะห์เส้นทาง ปี 2568", "2025-07-30", "B", "เอกสารภายใน แต่เก่ากว่า 12 เดือน")],
    "2.10": [("รายงานผลการดำเนินงานรายไตรมาส (ไม่ระบุวันที่ในเอกสาร)", None, None, None)],
    "3.2": [("(ร่าง) แผนปรับปรุงระบบปรับอากาศ ระยะที่ 1", "2025-08-14", "C", "เป็นแผน ไม่ใช่ผลลัพธ์ · และเก่ากว่า 12 เดือน"),
            ("(ร่าง) แผนปรับปรุงระบบปรับอากาศ ระยะที่ 2", "2026-05-09", "C", "เป็นแผน ยังไม่มีผลการดำเนินการ")],
    "3.3": [("ตารางคำนวณ Scope 1-2 (ไม่ระบุวันที่ในเอกสาร)", None, None, None)],
    "1.4": [], "2.1": [], "2.2": [], "2.4": [], "2.6": [], "2.11": [], "2.12": [],
    "3.1": [], "3.4": [], "4.1": [], "4.2": [], "4.3": [], "4.4": [],
}

def build():
    items, evidence, ev_no = [], [], 1
    for code in CODES:
        cat = int(code.split(".")[0])
        div = next(c["divisionId"] for c in CATEGORIES if c["num"] == cat)
        owner = next((u["id"] for u in USERS if u.get("divisionId") == div and u["role"] == "owner"), None)
        items.append({
            "code": code, "name": NAMES[code], "category": cat, "divisionId": div,
            "ownerUserId": owner,                     # หมวด 4 = None โดยเจตนา
            "achievedLevel": LEVEL[code], "lastYearLevel": LAST_YEAR[code],
            "targetLevel": TARGET[code], "percentWithinNextLevel": PCT[code],
            "submittedThisCycle": code not in NOT_SUBMITTED,
            "dueDate": D(CYCLE_DUE),
            "lastUpdated": D(TODAY - dt.timedelta(days=3 if code not in NOT_SUBMITTED else 41)),
            "milestones": milestones(code),
            "slipHistory": slips(code),
        })
        for (title, ddate, tier, reason) in EV_SPEC[code]:
            eid = f"E-{ev_no:03d}"; ev_no += 1
            evidence.append({
                "id": eid, "itemCode": code, "title": title,
                "documentDate": ddate,
                "uploadDate": D(TODAY - dt.timedelta(days=20)),
                "proposedTier": tier, "proposedReason": reason,
                "confirmedTier": tier if tier in ("A", "B") and code not in ("2.9",) else None,
                "confirmedBy": "u-mod" if tier in ("A", "B") and code not in ("2.9",) else None,
            })
    return {
        "meta": {
            "synthetic": True,
            "note": "ข้อมูลสังเคราะห์เพื่อการสาธิตเท่านั้น ไม่ใช่สถานะจริงขององค์กร",
            "today": D(TODAY), "cycle": CYCLE, "cycleDue": D(CYCLE_DUE),
            "formRef": "วว.นบ209_2569-14",
        },
        "settings": {
            "at_risk_threshold_points": 30, "alert_lead_days": 15, "monthly_due_day": 5,
            "evidence_stale_months": 12, "slip_escalate_after": 3,
            "agent_max_tool_calls": 10, "agent_timeout_seconds": 60,
        },
        "divisions": DIVISIONS, "categories": CATEGORIES, "users": USERS,
        "items": items, "evidence": evidence,
    }

data = build()

# ── ค่าคงที่ของชุดข้อมูล — ผิดเมื่อไรไม่ยอมเขียนไฟล์ ─────────────────────────
items = data["items"]
assert len(items) == 24, len(items)
tot = sum(i["achievedLevel"] for i in items)
assert tot == 44, f"ผลรวมระดับ = {tot} ต้องได้ 44 (เฉลี่ย 1.83)"
lastyr = sum(i["lastYearLevel"] for i in items)
assert lastyr == 39, f"ผลรวมปีที่แล้ว = {lastyr} ต้องได้ 39 (เฉลี่ย 1.62)"
stalled = sum(1 for i in items if i["achievedLevel"] == i["lastYearLevel"])
assert stalled == 19, f"รายการที่ไม่ขยับ = {stalled} ต้องได้ 19"
assert sum(1 for i in items if not i["submittedThisCycle"]) == 4
assert sum(1 for i in items if i["ownerUserId"] is None) == 4
percat = {c: sum(1 for i in items if i["category"] == c) for c in (1, 2, 3, 4)}
assert percat == {1: 4, 2: 12, 3: 4, 4: 4}, percat
no_ev = {i["code"] for i in items if not any(e["itemCode"] == i["code"] for e in data["evidence"])}
assert no_ev == NO_EVIDENCE, sorted(no_ev ^ NO_EVIDENCE)
assert {e["itemCode"] for e in data["evidence"] if e["documentDate"] is None} == NO_DATE
assert LEVEL["2.11"] == TARGET["2.11"] and "2.11" in NO_EVIDENCE   # AC-26 ต้องเกิดซ้ำได้
assert PCT["4.1"] == 100 and "4.1" in NO_EVIDENCE                  # AC-01
assert all(e["proposedTier"] == "C" for e in data["evidence"] if e["itemCode"] == "3.2")  # AC-02

out = os.path.join(os.path.dirname(__file__), "..", "sample-data", "seed.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"เขียน {os.path.relpath(out)} · {len(items)} รายการ · {len(data['evidence'])} เอกสาร")
print(f"ระดับเฉลี่ย {tot/24:.2f} · ปีที่แล้ว {lastyr/24:.2f} · ไม่ขยับ {stalled}/24")
