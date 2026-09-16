"use client";

import { useState } from "react";

/**
 * ปุ่มส่งออกเอกสารรอบเดือน
 *
 * เลือกได้ 3 รูปแบบ — ทั้งหมดสร้างฝั่ง server จากข้อมูลจริง ไม่มี asset ภายนอก
 *   HTML  เปิดได้ทุกเครื่อง สั่งพิมพ์เป็น PDF ได้จากเบราว์เซอร์ · ไม่ต้องติดตั้งอะไรเพิ่ม
 *   MD    เอาไปวางต่อในเอกสารอื่นได้
 *   JSON  ให้ระบบอื่นอ่านต่อ
 *
 * ถ้ามีประโยคไหนไม่มีการอ้างอิง **การส่งออกจะล้มเหลว (HTTP 409)** ไม่ใช่เตือนแล้วโหลดไฟล์ให้อยู่ดี
 * นั่นคือ AC-10 และหน้าจอต้องแสดงความล้มเหลวนั้นตรง ๆ
 */
export function ReportExport() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const go = async (format: "html" | "md" | "json") => {
    setBusy(format); setError(null); setNote(null);
    try {
      const res = await fetch(`/api/report?format=${format}`, { cache: "no-store" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error([b.error, b.detail].filter(Boolean).join(" · ") || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1]
        ?? `report.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setNote(`ดาวน์โหลด ${name} แล้ว · ${(blob.size / 1024).toFixed(0)} KB`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="ga-btn ga-btn-primary" disabled={busy !== null} onClick={() => go("html")}>
          {busy === "html" ? "กำลังสร้าง…" : "ส่งออกเป็น HTML (พิมพ์เป็น PDF ได้)"}
        </button>
        <button className="ga-btn ga-btn-grey" disabled={busy !== null} onClick={() => go("md")}>
          Markdown
        </button>
        <button className="ga-btn ga-btn-ghost" disabled={busy !== null} onClick={() => go("json")}>
          JSON
        </button>
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--danger)" }}>⛔ {error}</p>}
      {note && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--accent)" }}>{note}</p>}
      <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
        ไฟล์ HTML เปิดได้โดยไม่ต้องต่ออินเทอร์เน็ต — ไม่มี asset จากภายนอก ·
        สั่งพิมพ์ในเบราว์เซอร์แล้วเลือก &ldquo;บันทึกเป็น PDF&rdquo; ได้เลย
      </p>
    </div>
  );
}
