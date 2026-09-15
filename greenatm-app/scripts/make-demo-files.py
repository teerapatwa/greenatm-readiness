# -*- coding: utf-8 -*-
"""
สร้างไฟล์หลักฐานตัวอย่างสำหรับเดโม — sample-data/demo-files/

ไฟล์เหล่านี้ใช้ลากเข้าช่อง "แนบหลักฐาน" ตอนสาธิต เพื่อให้เห็นเส้นทางจริง
ตั้งแต่อัปโหลด → agent เสนอชั้น → ทีมกลางยืนยัน → ค่า Verified ขยับ

⚠️ เนื้อหาทั้งหมดเป็น SYNTHETIC สร้างขึ้นเพื่อสาธิตเท่านั้น
   ไม่ใช่เอกสารจริงขององค์กร และไม่ได้อ้างผลการตรวจวัดจริง

ทำไมเป็น PDF/PNG จริง ไม่ใช่ .txt:
   กฎอัปโหลดใน src/app/api/evidence/route.ts รับเฉพาะ PDF / Word / รูปภาพ
   ถ้าทำเป็น .txt จะถูกปฏิเสธ แล้วเดโมจะสาธิตเส้นทางจริงไม่ได้

เนื้อในไฟล์ PDF เป็นภาษาอังกฤษ เพราะการฝังฟอนต์ไทยใน PDF ที่เขียนเองต้องใช้
ไลบรารีเพิ่ม ซึ่งขัดกับกฎ "ไม่พึ่งของข้างนอกเกินจำเป็น" — ชื่อไฟล์เป็นไทยได้ปกติ

    python scripts/make-demo-files.py
"""
import io, os, sys, zlib, struct

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

OUT = os.path.join("sample-data", "demo-files")


def pdf(lines):
    """PDF หน้าเดียวแบบเขียนไบต์ตรง — ไม่ต้องพึ่งไลบรารีภายนอก"""
    text = "BT /F1 11 Tf 56 760 Td 15 TL\n"
    for ln in lines:
        safe = ln.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        text += "(%s) Tj T*\n" % safe
    text += "ET"
    stream = text.encode("latin-1", "replace")

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"

    xref_at = len(out)
    out += b"xref\n0 %d\n" % (len(objs) + 1)
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objs) + 1, xref_at)
    return bytes(out)


def png(w, h, rgb):
    """PNG สีพื้นเรียบ — เล็กที่สุดที่ยังเป็นไฟล์ถูกต้อง"""
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


BANNER = "SYNTHETIC DEMO DOCUMENT - not a real organisational record"

# (ชื่อไฟล์, ชนิด, เนื้อหา, ใช้สาธิตอะไร)
FILES = [
    ("รายงานผลตรวจวัด_ลงนามแล้ว.pdf", "pdf", [
        BANNER, "",
        "AIR QUALITY MEASUREMENT REPORT",
        "Aeronautical Radio of Thailand - Environmental Unit",
        "",
        "Scope      : VTBS terminal area, 4 sampling points",
        "Method     : continuous monitoring, 30 consecutive days",
        "Result     : all parameters within the reference limits",
        "Coverage   : 100% of the declared scope",
        "",
        "Measured on   : 1 - 30 August 2026",
        "Report dated  : 10 September 2026",
        "Certified by  : external accredited laboratory (signed)",
        "",
        "-- This document states a MEASURED RESULT and is signed. --",
        "-- Expected screening tier: A                            --",
    ], "เส้นทางที่สำเร็จ — หลักฐานชั้น A · วันที่ในเอกสาร 2026-09-10"),

    ("ร่างแผนดำเนินการ_ยังไม่อนุมัติ.pdf", "pdf", [
        BANNER, "",
        "(DRAFT) ACTION PLAN - RENEWABLE ENERGY",
        "",
        "Status     : DRAFT, not yet approved by management",
        "Content    : intended activities, responsible units, target dates",
        "Result     : none yet - no activity has been carried out",
        "",
        "Drafted on : 5 September 2026",
        "",
        "-- A plan is not evidence of a result.        --",
        "-- Expected screening tier: C                 --",
    ], "เคส AC-02 — “แผนไม่ใช่หลักฐานผลลัพธ์” · ควรได้ชั้น C"),

    ("บันทึกการประชุมคณะทำงาน.pdf", "pdf", [
        BANNER, "",
        "MINUTES OF THE ENVIRONMENTAL WORKING GROUP",
        "",
        "Agenda     : progress of the CDO procedure trial",
        "Outcome    : trial completed at 2 of 3 runways",
        "Evidence   : operational log attached to the original minutes",
        "",
        "Meeting on : 28 August 2026",
        "Signed     : chair of the working group (unsigned copy)",
        "",
        "-- Official record of a result, partial scope, unsigned copy. --",
        "-- Expected screening tier: B                                 --",
    ], "หลักฐานชั้น B — เป็นผลลัพธ์จริงแต่ขอบเขตบางส่วน"),

    ("เอกสารไม่มีวันที่ในตัวเอกสาร.pdf", "pdf", [
        BANNER, "",
        "SUMMARY OF WASTE SEGREGATION ACTIVITY",
        "",
        "Scope      : head office building, all floors",
        "Result     : segregation bins installed, staff briefed",
        "",
        "NOTE: this document carries NO date anywhere in its body.",
        "",
        "-- The system must ASK for the document date.              --",
        "-- It must NOT infer the date from the upload timestamp    --",
        "-- or from the file's modification time.  (AC-03)          --",
    ], "เคส AC-03 — ไม่มีวันที่ ระบบต้องถาม ไม่เดา"),

    ("เอกสารเก่าเกิน12เดือน.pdf", "pdf", [
        BANNER, "",
        "ENERGY AUDIT SUMMARY",
        "",
        "Scope      : CNS equipment rooms",
        "Result     : baseline consumption recorded",
        "",
        "Document dated : 15 June 2025",
        "",
        "-- Older than evidence_stale_months (12). Must be flagged --",
        "-- as stale and must not count toward the verified level. --",
    ], "เคส AC-09 — ล้าสมัยเกิน 12 เดือน ต้องถูกตีตก"),

    ("ภาพหน้างานติดตั้งอุปกรณ์.png", "png", (168, 196, 176),
     "ภาพประกอบ — สนับสนุนเท่านั้น ไม่ใช่ผลลัพธ์โดยตรง · ควรได้ชั้น C"),

    ("แผนกู้สถานการณ์_หลังเลื่อนแผนครั้งที่3.pdf", "pdf", [
        BANNER, "",
        "RECOVERY PLAN - after the third reschedule",
        "",
        "Item       : 2.10 Trajectory optimization",
        "Cause      : the same budget approval has been pending 3 times",
        "Ask        : a decision on funding, not a faster schedule",
        "New target : 31 March 2027",
        "",
        "Prepared on : 14 September 2026",
        "",
        "-- Use with the 3rd-slip escalation demo. --",
    ], "ใช้คู่กับเดโมเลื่อนแผนครั้งที่ 3 — สิ่งที่ผู้ดูแลขอ"),
]

os.makedirs(OUT, exist_ok=True)
written = []
for name, kind, payload, purpose in FILES:
    path = os.path.join(OUT, name)
    data = pdf(payload) if kind == "pdf" else png(640, 420, payload)
    with open(path, "wb") as f:
        f.write(data)
    written.append((name, len(data), purpose))

# ใบสรุปให้คนเดโมอ่าน
readme = ["# ไฟล์หลักฐานตัวอย่างสำหรับเดโม", "",
          "สร้างด้วย `python scripts/make-demo-files.py` · **ทั้งหมดเป็น SYNTHETIC**",
          "ไม่ใช่เอกสารจริงขององค์กร และไม่ได้อ้างผลการตรวจวัดจริง", "",
          "| ไฟล์ | ขนาด | ใช้สาธิตอะไร |", "|---|---:|---|"]
for name, size, purpose in written:
    readme.append("| `%s` | %s | %s |" % (name, "%.1f KB" % (size / 1024), purpose))
readme += ["", "## ลำดับที่แนะนำตอนสาธิต", "",
           "1. เข้าเป็น **หัวหน้าส่วนพลังงานและสาธารณูปโภค** (กองวิศวกรรม) เปิดข้อ **3.2**",
           "2. แนบ `ร่างแผนดำเนินการ_ยังไม่อนุมัติ.pdf` → ควรได้ชั้น C · “แผนไม่ใช่หลักฐานผลลัพธ์”",
           "3. แนบ `เอกสารไม่มีวันที่ในตัวเอกสาร.pdf` → ระบบ**ถาม**วันที่ ไม่เดาจากวันอัปโหลด",
           "4. แนบ `รายงานผลตรวจวัด_ลงนามแล้ว.pdf` ใส่วันที่ในเอกสาร 2026-09-10",
           "5. สลับเป็น **ผู้ประสานงานระบบ GreenATM** → ศูนย์ตรวจสอบ → ยืนยันชั้น **A**",
           "   → **ค่า Verified ขยับ** แต่ตัวเลขงานคืบหน้าไม่เปลี่ยน (AC-01)",
           "6. กลับเป็นเจ้าของข้อมูล → **เลื่อนแผน** ครั้งที่ 1 · 2 · 3 พร้อมเหตุผลเดิม",
           "   → ครั้งที่ 3 ยกให้ผู้ดูแล · แนบ `แผนกู้สถานการณ์_หลังเลื่อนแผนครั้งที่3.pdf`",
           "",
           "> เล่นจบแล้วกด **ย้อนกลับ** ที่ศูนย์ตรวจสอบ → เครื่องมือสำหรับเดโม",
           "> เพื่อคืนฐานข้อมูลเป็นสภาพก่อนเล่น"]
with io.open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(readme) + "\n")

print("สร้างไฟล์เดโม %d ไฟล์ที่ %s" % (len(written), OUT))
for name, size, _ in written:
    print("   %-52s %6.1f KB" % (name, size / 1024))
