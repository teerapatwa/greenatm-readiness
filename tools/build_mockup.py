# -*- coding: utf-8 -*-
"""build_mockup.py — ฝัง sample-data/manifest.json ลง template แล้วได้ mockup.html"""
import io, json, os, sys
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = json.load(io.open(os.path.join(ROOT, "sample-data", "manifest.json"), encoding="utf-8"))
tpl = io.open(os.path.join(ROOT, "tools", "mockup_template.html"), encoding="utf-8").read()
out = tpl.replace("/*@@DATA@@*/", json.dumps(M, ensure_ascii=False))
assert "@@DATA@@" not in out
io.open(os.path.join(ROOT, "mockup.html"), "w", encoding="utf-8").write(out)
s = M["scoring"]
print("หัวข้อ %d · เต็ม %d คะแนน · ระดับที่ได้ Level %d" % (len(M["topics"]), s["totalPoints"], s["currentAccreditation"]))
print("awarded ต่อระดับ:", s["awardedByLevel"])
print("เขียน mockup.html (%d bytes)" % len(out))
