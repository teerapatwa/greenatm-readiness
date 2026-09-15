"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ลบหลักฐาน — ทีมกลางเท่านั้น
 *
 * ต้องกดยืนยันสองจังหวะ เพราะลบแล้วเอาคืนไม่ได้ (และไฟล์บนดิสก์ถูกลบด้วย)
 * ทุกการลบบันทึกใน audit_log พร้อมชื่อเรื่องและชั้นที่เคยยืนยันไว้
 */
export function EvidenceDelete({ evidenceId, title }: { evidenceId: string; title: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!armed) {
    return (
      <div style={{ marginTop: 8 }}>
        <button className="ga-btn ga-btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}
          onClick={() => setArmed(true)}>
          ลบหลักฐานนี้
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>
        ลบ <b>{title}</b> ถาวร? ไฟล์บนดิสก์จะถูกลบด้วย และเอาคืนไม่ได้
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button className="ga-btn ga-btn-danger" disabled={busy}
          onClick={async () => {
            setBusy(true); setError(null);
            try {
              const res = await fetch(`/api/evidence/${evidenceId}`, { method: "DELETE" });
              const b = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
              startTransition(() => router.refresh());
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
              setBusy(false);
            }
          }}>
          {busy ? "กำลังลบ…" : "ยืนยันลบ"}
        </button>
        <button className="ga-btn ga-btn-ghost" disabled={busy} onClick={() => setArmed(false)}>
          ยกเลิก
        </button>
      </div>
      {error && <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4 }}>⛔ {error}</p>}
    </div>
  );
}
