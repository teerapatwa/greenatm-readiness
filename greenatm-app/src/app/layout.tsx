import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Green ATM Tracker",
  description: "ติดตามหลักฐานและความพร้อม Green ATM — ต้นแบบสำหรับเวิร์กช็อป",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--warn-bg)", borderBottom: "1px solid var(--warn-line)", padding: "6px 16px", fontSize: 13, color: "var(--warn-ink)", fontWeight: 600 }}>
          ⚠ ข้อมูลตัวอย่าง (Mockup) — ไม่ใช่สถานะจริงขององค์กร
        </div>
        {children}
      </body>
    </html>
  );
}
