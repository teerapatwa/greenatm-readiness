import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { canSee, profileFor, type Screen } from "@/lib/auth/perms";
import { buildView } from "@/lib/view";
import { UserSwitcher } from "./actions";

/**
 * โครงหน้าจอ + เมนูตามสิทธิ์ — PLAN §4.3.1
 *
 * แถบข้างแสดง "ทำอะไรได้/ไม่ได้" ของบทบาทนั้นเสมอ
 * เพราะสิทธิ์ที่มองไม่เห็นคือสิทธิ์ที่ไม่มีใครเชื่อว่ามีอยู่
 */

const NAV: { key: Screen; href: string; label: string }[] = [
  { key: "home",   href: "/",        label: "หน้าแรก" },
  { key: "my",     href: "/my",      label: "งานของฉัน" },
  { key: "item",   href: "/item",    label: "รายละเอียดรายการ" },
  { key: "alerts", href: "/alerts",  label: "แจ้งเตือน / Outbox" },
  { key: "review", href: "/review",  label: "ศูนย์ตรวจสอบ" },
  { key: "trend",  href: "/trend",   label: "แนวโน้มและคาดการณ์" },
];

export async function Shell({ active, children }: { active: Screen; children: React.ReactNode }) {
  const u = await currentUser();
  const v = buildView(u);
  const p = profileFor(u.role);
  const alertCount = v.alerts.length;

  return (
    <div className="min-h-screen">
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--line)", background: "var(--card)", padding: "10px 16px" }}>
        <div className="flex items-center gap-2.5">
          <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700 }}>
            GA
          </span>
          <div>
            <p className="text-[14.5px] font-semibold leading-tight">GreenATM Evidence &amp; Readiness</p>
            <p style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {v.meta.formRef} · รอบ {v.meta.cycle} · อ้างอิงวันที่ {v.meta.today}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>เข้าใช้เป็น</span>
          <UserSwitcher users={v.users} currentId={u.id} />
          <span
            className="rounded-full border px-2 py-0.5 text-[11.5px]"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            {p.label}
          </span>
        </div>
      </header>

      <div className="flex">
        <nav className="ga-nav" style={{ width: 236, flex: "none", borderRight: "1px solid var(--line)", background: "var(--card)", padding: "16px 0" }}>
          <p className="ga-eyebrow" style={{ padding: "0 16px 4px" }}>
            {u.divisionId ? v.divisions.find((d) => d.id === u.divisionId)?.name : p.label}
          </p>
          <p style={{ padding: "0 16px 12px", fontSize: 12, color: "var(--ink2)" }}>{u.title}</p>

          <p className="ga-eyebrow" style={{ padding: "0 16px 4px" }}>เมนู</p>
          <ul>
            {NAV.map((n, idx) => {
              const allowed = canSee(u.role, n.key);
              const on = active === n.key;
              const badge = n.key === "alerts" && allowed && alertCount > 0 ? alertCount : null;
              const inner = (
                <span className="flex items-center justify-between gap-2">
                  <span>{idx + 1} · {n.label}</span>
                  {badge !== null && (
                    <span className="rounded-full px-1.5 text-[11px] text-white" style={{ background: "var(--danger)" }}>
                      {badge}
                    </span>
                  )}
                </span>
              );
              return (
                <li key={n.key}>
                  {allowed ? (
                    <Link
                      href={n.href}
                      className="block border-l-2 px-4 py-2 text-[13.5px]"
                      style={{
                        borderColor: on ? "var(--accent)" : "transparent",
                        background: on ? "var(--page)" : undefined,
                        fontWeight: on ? 700 : 400,
                      }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <span
                      title="บทบาทนี้ไม่มีสิทธิ์เข้าหน้านี้"
                      className="block cursor-not-allowed border-l-2 border-transparent px-4 py-2 text-[13.5px] opacity-35"
                    >
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="ga-eyebrow" style={{ marginTop: 20, padding: "0 16px 6px" }}>
            สิทธิ์ของบทบาทนี้
          </p>
          <ul className="space-y-1 px-4 text-[11.5px] leading-snug">
            {p.can.map((x) => (
              <li key={x} style={{ color: "var(--accent)" }}>✓ <span style={{ color: "var(--ink2)" }}>{x}</span></li>
            ))}
            {p.cannot.map((x) => (
              <li key={x} style={{ color: "var(--muted)" }}>✕ {x}</li>
            ))}
          </ul>
          <p style={{ marginTop: 16, padding: "0 16px", fontSize: 11, color: "var(--muted)" }}>
            ตัวสลับผู้ใช้นี้<b>ไม่ใช่ระบบยืนยันตัวตน</b> — แต่สิทธิ์ถูกบังคับที่ฝั่ง server
            ยิง request ตรงก็ได้ 403
          </p>

          <div style={{ marginTop: 18, padding: "0 16px" }}>
            <Link href="/how-it-works"
              style={{ fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              หลักการทำงาน — หนึ่งรอบของระบบ →
            </Link>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--muted)" }}>
              ขั้นไหนเป็นคน โค้ด Agent หรือโมเดล
            </p>
          </div>
        </nav>

        <main className="min-w-0 grow px-5 py-6">{children}</main>
      </div>

      <footer style={{ borderTop: "1px solid var(--line)", padding: "12px 20px", fontSize: 11.5, color: "var(--muted)" }}>
        ข้อมูลสังเคราะห์ทั้งหมด · โครงตาม {v.meta.formRef} ·
        กฎทุกข้อคำนวณด้วยโค้ดใน <code>src/lib/data/rules.ts</code> — ไม่มีการเรียกโมเดลในเส้นทางเหล่านี้
      </footer>
    </div>
  );
}

/** หน้าที่บทบาทนี้เข้าไม่ได้ — ตอบแบบเดียวกับที่ backend ตอบ */
export function Forbidden({ roleLabel, what }: { roleLabel: string; what: string }) {
  return (
    <div>
      <h1 className="ga-h1">ไม่มีสิทธิ์เข้าหน้านี้</h1>
      <div
        className="mt-4 rounded-lg border-2 p-4"
        style={{ borderColor: "var(--danger)" }}
      >
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--danger)" }}>
          403 — บทบาท “{roleLabel}” ไม่มีสิทธิ์{what}
        </p>
        <p style={{ marginTop: 8, fontSize: 13, color: "var(--ink2)" }}>
          การตรวจสิทธิ์อยู่ที่ฝั่ง server <b>ไม่ใช่การซ่อนปุ่ม</b> — ยิง request ไปที่ API ตรง ๆ
          ก็ได้ 403 เหมือนกัน สลับผู้ใช้ที่มุมขวาบนเพื่อดูมุมมองของบทบาทอื่น
        </p>
      </div>
    </div>
  );
}
