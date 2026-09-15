#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_endpoint.py — feasibility check TF1–TF8 (PLAN.md §8)

ทดสอบ endpoint ของเวิร์กช็อปหนึ่งครั้งในนามทีม แล้วบันทึกผลตามจริง
ใช้ stdlib ล้วน ไม่ต้องติดตั้งอะไร  ->  python tools/check_endpoint.py

ตั้งค่าก่อนรัน (อย่าใส่ค่าลับลงในไฟล์ใด ๆ · อย่าวางลงแชทหรือสกรีนช็อต):
    set  LLM_BASE_URL=http://10.0.63.215:8000/v1      (Windows cmd)
    $env:LLM_BASE_URL="http://10.0.63.215:8000/v1"    (PowerShell)
    export LLM_BASE_URL=...                           (bash)
    LLM_MODEL=nemotron-3.5-lightning
    LLM_API_KEY=...        ถ้าจำเป็น
    LLM_TIMEOUT_MS=120000

เขียนผลลงไฟล์ tools/endpoint-test-result.md เอาไปแปะใน PLAN.md §8 ได้เลย

หลักการ: บันทึกผลตามจริงรวมข้อที่ไม่ผ่าน — ห้ามเอาคำตอบที่เขียนไว้ล่วงหน้ามาแสดง
แล้วบอกว่าต่อสำเร็จ (PLAN.md §8 · ไฟล์ integration ทั้งสองฉบับ)
"""
import json, os, ssl, sys, time, urllib.error, urllib.request

# คอนโซล Windows ตั้งต้นเป็น cp1252 พิมพ์ภาษาไทยไม่ได้ — บังคับ UTF-8 ก่อนพิมพ์อะไร
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE = (os.environ.get("LLM_BASE_URL") or "").rstrip("/")
MODEL = os.environ.get("LLM_MODEL") or ""
KEY = os.environ.get("LLM_API_KEY") or ""
TIMEOUT = int(os.environ.get("LLM_TIMEOUT_MS") or "120000") / 1000.0

RESULTS = []          # (id, หัวข้อ, PASS|FAIL|SKIP, รายละเอียด)
EVID = os.path.join("sample-data", "evidence")


def record(tid, title, status, detail):
    RESULTS.append((tid, title, status, detail))
    mark = {"PASS": "[PASS]", "FAIL": "[FAIL]", "SKIP": "[SKIP]"}[status]
    print("%s %-5s %s\n        %s" % (mark, tid, title, detail.replace("\n", "\n        ")))


def call(path, payload=None, timeout=None):
    """คืน (status_code, body_text) · ไม่โยน exception"""
    url = BASE + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Content-Type", "application/json")
    if KEY:
        req.add_header("Authorization", "Bearer " + KEY)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout or TIMEOUT, context=ctx) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:500]
    except Exception as e:
        return 0, "%s: %s" % (type(e).__name__, e)


def chat(messages, tools=None, max_tokens=700):
    body = {"model": MODEL, "messages": messages, "temperature": 0,
            "max_tokens": max_tokens, "stream": False,
            "chat_template_kwargs": {"enable_thinking": False}}
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    t0 = time.time()
    code, text = call("/chat/completions", body)
    return code, text, time.time() - t0


def read_evidence(eid):
    p = os.path.join(EVID, eid + ".md")
    if not os.path.exists(p):
        return None
    return open(p, encoding="utf-8").read()


# ── TF1 ───────────────────────────────────────────────────────────────────
def tf1():
    for path in ("/../health", "/models"):
        code, body = call(path, timeout=15)
        if code == 200:
            return record("TF1", "เซิร์ฟเวอร์ตอบกลับ", "PASS",
                          "%s -> HTTP 200" % (BASE + path))
    record("TF1", "เซิร์ฟเวอร์ตอบกลับ", "FAIL",
           "ติดต่อ %s ไม่ได้ (%s) — ตรวจว่าอยู่ในเครือข่ายเดียวกับ endpoint หรือยัง" % (BASE, body))


# ── TF2 ───────────────────────────────────────────────────────────────────
def tf2():
    code, body = call("/models", timeout=20)
    if code != 200:
        return record("TF2", "model alias ตรงกับเอกสาร", "FAIL",
                      "GET /v1/models -> HTTP %s · %s" % (code, body[:160]))
    try:
        ids = [m.get("id") for m in json.loads(body).get("data", [])]
    except Exception as e:
        return record("TF2", "model alias ตรงกับเอกสาร", "FAIL", "อ่าน JSON ไม่ได้: %s" % e)
    if MODEL in ids:
        record("TF2", "model alias ตรงกับเอกสาร", "PASS", "พบ '%s' ในรายการ: %s" % (MODEL, ids))
    else:
        record("TF2", "model alias ตรงกับเอกสาร", "FAIL",
               "ไม่พบ '%s' · ที่ served จริงคือ %s\n"
               "-> หยุดแล้วถาม facilitator ว่าต้องใช้ id ไหน ห้ามเดา" % (MODEL, ids))


# ── TF3 + TF4 ─────────────────────────────────────────────────────────────
def tf3_tf4():
    doc = read_evidence("E-005")
    if not doc:
        return record("TF3", "ตอบตรงประเด็น", "SKIP", "ไม่พบ sample-data/evidence/E-005.md")
    code, body, dt = chat([
        {"role": "system", "content": "ตอบเป็นภาษาไทย ใช้เฉพาะข้อมูลในเอกสารที่ให้มา ห้ามเดา"},
        {"role": "user", "content": doc + "\n\nจากเอกสารนี้ ผลการวัดครอบคลุมสนามบินใดบ้าง และได้ค่าเท่าไร"}])
    if code != 200:
        record("TF3", "ตอบตรงประเด็น", "FAIL", "HTTP %s · %s" % (code, body[:200]))
        return record("TF4", "คุณภาพภาษาไทย", "SKIP", "ข้ามเพราะ TF3 ไม่ผ่าน")
    try:
        ans = json.loads(body)["choices"][0]["message"]["content"] or ""
    except Exception as e:
        record("TF3", "ตอบตรงประเด็น", "FAIL", "โครงสร้างคำตอบผิดรูป: %s" % e)
        return record("TF4", "คุณภาพภาษาไทย", "SKIP", "ข้ามเพราะ TF3 ไม่ผ่าน")
    ok = ("VTBS" in ans) and ("42" in ans)
    record("TF3", "ตอบตรงประเด็น", "PASS" if ok else "FAIL",
           ("ตอบถูก (พบ VTBS และ 42%%) · %.1f วิ" % dt) if ok else
           ("ไม่พบ VTBS หรือ 42 ในคำตอบ · %.1f วิ\n>>> %s" % (dt, ans[:300])))
    thai = sum(1 for c in ans if "฀" <= c <= "๿")
    record("TF4", "คุณภาพภาษาไทย", "PASS" if thai > 40 else "FAIL",
           "อักษรไทย %d ตัวในคำตอบ%s" % (thai, "" if thai > 40 else " — ตอบไทยได้ไม่ดีพอ"))
    return ans


# ── TF5 — ข้อสำคัญที่สุด ──────────────────────────────────────────────────
def tf5():
    doc = read_evidence("E-010")
    if not doc:
        return record("TF5", "ร่างแผน -> ต้องได้ชั้น C", "SKIP", "ไม่พบ E-010.md")
    sysmsg = ("คุณคือผู้ช่วยจัดชั้นหลักฐาน ตอบเป็น JSON เท่านั้น: "
              '{"tier":"A|B|C|D","reason":"...","missing":["..."]}\n'
              "A = ผ่านการทวนสอบภายนอก หรือข้อมูลที่วัดได้พร้อมที่มา\n"
              "B = เอกสารภายในที่อนุมัติแล้ว\n"
              "C = ร่าง แผน สไลด์ ความตั้งใจ — แผนไม่ใช่หลักฐานผลลัพธ์\n"
              "D = ไม่มีเอกสาร มีแต่คำบอกเล่า")
    code, body, dt = chat([{"role": "system", "content": sysmsg},
                           {"role": "user", "content": doc}], max_tokens=400)
    if code != 200:
        return record("TF5", "ร่างแผน -> ต้องได้ชั้น C", "FAIL", "HTTP %s · %s" % (code, body[:200]))
    try:
        raw = json.loads(body)["choices"][0]["message"]["content"] or ""
        i, j = raw.find("{"), raw.rfind("}")
        obj = json.loads(raw[i:j + 1])
        tier = str(obj.get("tier", "")).strip().upper()[:1]
    except Exception as e:
        return record("TF5", "ร่างแผน -> ต้องได้ชั้น C", "FAIL",
                      "แกะ JSON ไม่ได้: %s\n>>> %s" % (e, body[:300]))
    if tier == "C":
        record("TF5", "ร่างแผน -> ต้องได้ชั้น C", "PASS",
               "ได้ชั้น C ถูกต้อง · เหตุผล: %s · %.1f วิ" % (str(obj.get("reason"))[:120], dt))
    else:
        record("TF5", "ร่างแผน -> ต้องได้ชั้น C", "FAIL",
               "ได้ชั้น %s (ต้องเป็น C)\n"
               ">>> ผลกระทบ: ย้ายกติกาเพดานชั้น C ไปบังคับใน backend "
               "ไม่ว่าโมเดลจะเสนออะไรมา (PLAN.md §8)" % tier)


# ── TF6 — ตัดสินว่าใช้ทางหลักหรือทางสำรอง §5.4 ────────────────────────────
TOOLS = [{"type": "function", "function": {
    "name": "list_evidence",
    "description": "คืนรายการเอกสารหลักฐานของรายการที่ระบุ",
    "parameters": {"type": "object",
                   "properties": {"item_id": {"type": "string", "description": "รหัสรายการ เช่น A-02"}},
                   "required": ["item_id"]}}}]


def tf6():
    code, body, dt = chat(
        [{"role": "system", "content": "คุณมีเครื่องมือให้เรียก ถ้าต้องใช้ข้อมูลให้เรียกเครื่องมือ อย่าเดาคำตอบ"},
         {"role": "user", "content": "รายการ A-02 มีเอกสารหลักฐานกี่ชิ้น"}], tools=TOOLS, max_tokens=300)
    if code != 200:
        return record("TF6", "tool_calls จริง", "FAIL", "HTTP %s · %s" % (code, body[:250]))
    try:
        msg = json.loads(body)["choices"][0]["message"]
    except Exception as e:
        return record("TF6", "tool_calls จริง", "FAIL", "โครงสร้างคำตอบผิดรูป: %s" % e)
    tc = msg.get("tool_calls")
    if not tc:
        return record("TF6", "tool_calls จริง", "FAIL",
                      "ไม่มีฟิลด์ tool_calls ในคำตอบ (โมเดลตอบเป็นข้อความแทน)\n"
                      ">>> ผลกระทบ: ใช้ทางสำรอง §5.4 — ลูปเลือก action ด้วย JSON ที่ validate ด้วย schema\n"
                      ">>> และต้องระบุตามจริงบนสไลด์ ห้ามอ้างว่าใช้ native tool calling")
    try:
        fn = tc[0]["function"]["name"]
        args = json.loads(tc[0]["function"].get("arguments") or "{}")
    except Exception as e:
        return record("TF6", "tool_calls จริง", "FAIL", "tool_calls มีแต่แกะ arguments ไม่ได้: %s" % e)
    ok = fn == "list_evidence" and isinstance(args.get("item_id"), str)
    record("TF6", "tool_calls จริง", "PASS" if ok else "FAIL",
           "เรียก %s(%s) · %.1f วิ%s" % (fn, args, dt, "" if ok else "  — ชื่อ tool หรือ arguments ไม่ตรง schema"))


# ── TF7 ───────────────────────────────────────────────────────────────────
def tf7():
    tf6res = [r for r in RESULTS if r[0] == "TF6"]
    if tf6res and tf6res[0][2] != "PASS":
        return record("TF7", "ลูป agent ครบ 1 รอบ", "SKIP",
                      "ข้ามเพราะ TF6 ไม่ผ่าน — ทดสอบลูปทางสำรองแทนตอนสร้าง M3")
    msgs = [{"role": "system", "content": "เรียกเครื่องมือเมื่อจำเป็น แล้วสรุปคำตอบจากผลที่ได้"},
            {"role": "user", "content": "รายการ A-02 มีเอกสารหลักฐานกี่ชิ้น"}]
    code, body, _ = chat(msgs, tools=TOOLS, max_tokens=300)
    try:
        msg = json.loads(body)["choices"][0]["message"]
        tc = msg["tool_calls"][0]
    except Exception as e:
        return record("TF7", "ลูป agent ครบ 1 รอบ", "FAIL", "รอบแรกล้มเหลว: %s" % e)
    msgs.append(msg)
    msgs.append({"role": "tool", "tool_call_id": tc.get("id", "call_1"),
                 "name": tc["function"]["name"],
                 "content": json.dumps({"count": 2, "ids": ["E-003", "E-004"]}, ensure_ascii=False)})
    code, body, dt = chat(msgs, tools=TOOLS, max_tokens=300)
    if code != 200:
        return record("TF7", "ลูป agent ครบ 1 รอบ", "FAIL", "รอบสอง HTTP %s · %s" % (code, body[:200]))
    try:
        ans = json.loads(body)["choices"][0]["message"].get("content") or ""
    except Exception as e:
        return record("TF7", "ลูป agent ครบ 1 รอบ", "FAIL", "รอบสองผิดรูป: %s" % e)
    ok = "2" in ans or "สอง" in ans
    record("TF7", "ลูป agent ครบ 1 รอบ", "PASS" if ok else "FAIL",
           "เลือก -> เรียก -> เห็นผล -> สรุปได้ · %.1f วิ\n>>> %s" % (dt, ans[:200]) if ok
           else "รับผล tool กลับไปแล้วแต่สรุปไม่ถูก\n>>> %s" % ans[:200])


# ── TF8 ───────────────────────────────────────────────────────────────────
def tf8():
    lat = [r for r in RESULTS if r[2] == "PASS" and "วิ" in r[3]]
    record("TF8", "latency พอเดโมได้", "PASS" if lat else "SKIP",
           "ดูตัวเลขวินาทีในแต่ละข้อข้างบน — ตัดสินเองว่ารับได้ไหมสำหรับเดโมสด "
           "(ไม่ใส่ตัวเลขประมาณการ)" if lat else "ไม่มีข้อที่ผ่านให้วัดเวลา")


# ── main ──────────────────────────────────────────────────────────────────
def main():
    if not BASE or not MODEL:
        print("!! ยังไม่ได้ตั้ง LLM_BASE_URL หรือ LLM_MODEL — อ่านวิธีตั้งค่าที่หัวไฟล์นี้")
        return 2
    print("=" * 74)
    print("check_endpoint.py — TF1–TF8 (PLAN.md §8)")
    print("BASE  :", BASE)
    print("MODEL :", MODEL)
    print("AUTH  :", "มี API key" if KEY else "ไม่ได้ตั้ง key")
    if BASE.startswith("http://") and KEY:
        print("\n!! คำเตือน: กำลังจะส่ง API key ผ่าน HTTP ธรรมดา")
        print("   ไฟล์ integration ห้ามไว้ — ขอ HTTPS หรือเส้นทางภายในที่อนุมัติก่อน")
        if input("   พิมพ์ 'yes' เพื่อยืนยันว่ารับความเสี่ยงนี้: ").strip().lower() != "yes":
            return 3
    print("=" * 74)

    tf1(); tf2(); tf3_tf4(); tf5(); tf6(); tf7(); tf8()

    n_pass = sum(1 for r in RESULTS if r[2] == "PASS")
    n_fail = sum(1 for r in RESULTS if r[2] == "FAIL")
    print("\n" + "=" * 74)
    print("สรุป: PASS %d · FAIL %d · SKIP %d"
          % (n_pass, n_fail, sum(1 for r in RESULTS if r[2] == "SKIP")))

    tf5r = [r for r in RESULTS if r[0] == "TF5"]
    tf6r = [r for r in RESULTS if r[0] == "TF6"]
    decisions = []
    if tf5r and tf5r[0][2] == "FAIL":
        decisions.append("TF5 ไม่ผ่าน -> **ย้ายเพดานชั้น C ไปบังคับใน backend** ไม่พึ่ง prompt")
    if tf6r and tf6r[0][2] == "FAIL":
        decisions.append("TF6 ไม่ผ่าน -> **ใช้ทางสำรอง §5.4** (ลูป JSON action) และระบุตามจริงบนสไลด์")
    elif tf6r and tf6r[0][2] == "PASS":
        decisions.append("TF6 ผ่าน -> **ใช้ทางหลัก §5.4** native tool calling")
    for d in decisions:
        print(" -> " + d.replace("**", ""))

    out = os.path.join("tools", "endpoint-test-result.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("# ผลทดสอบ endpoint — TF1–TF8\n\n")
        f.write("| | |\n|---|---|\n")
        f.write("| วันเวลาที่ทดสอบ | %s |\n" % time.strftime("%Y-%m-%d %H:%M:%S"))
        f.write("| Base URL | `%s` |\n" % BASE)
        f.write("| Model | `%s` |\n" % MODEL)
        f.write("| Auth | %s |\n" % ("มี API key" if KEY else "ไม่ได้ตั้ง key"))
        f.write("| ผลรวม | PASS %d · FAIL %d · SKIP %d |\n\n"
                % (n_pass, n_fail, sum(1 for r in RESULTS if r[2] == "SKIP")))
        f.write("| # | สิ่งที่ทดสอบ | ผล | รายละเอียด |\n|---|---|:---:|---|\n")
        for tid, title, st, detail in RESULTS:
            mark = {"PASS": "PASS", "FAIL": "**FAIL**", "SKIP": "SKIP"}[st]
            f.write("| %s | %s | %s | %s |\n"
                    % (tid, title, mark, detail.replace("\n", "<br>").replace("|", "\\|")))
        if decisions:
            f.write("\n## สิ่งที่ต้องตัดสินตามผลนี้\n\n")
            for d in decisions:
                f.write("- %s\n" % d)
        f.write("\n> บันทึกตามผลจริงรวมข้อที่ไม่ผ่าน · ห้ามแทนที่ข้อที่ล้มเหลวด้วยคำตอบที่เตรียมไว้\n")
        f.write("> แล้วอ้างว่าเชื่อมต่อสำเร็จ (PLAN.md §8)\n")
    print("\nเขียนผลลง %s — เอาไปแปะใน PLAN.md §8 ได้เลย" % out)
    return 1 if n_fail else 0


if __name__ == "__main__":
    sys.exit(main())
