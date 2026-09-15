import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreenATM Evidence & Readiness",
  description: "ระบบหลักฐานและความพร้อม GreenATM — ต้นแบบสำหรับเวิร์กช็อป",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <div className="sticky top-0 z-10 bg-[var(--warn)]/15 border-b border-[var(--line)] px-4 py-1.5 text-[13px] text-[var(--ink2)]">
          ⚠ ข้อมูลตัวอย่าง (Mockup) — ไม่ใช่สถานะจริงขององค์กร
        </div>
        {children}
      </body>
    </html>
  );
}
