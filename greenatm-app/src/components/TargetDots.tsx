"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LEVEL_FILL } from "./ui";

/**
 * เป้าปีนี้ — ปุ่ม 5 ระดับ ตามที่ไฟล์ทีมออกแบบไว้ (`<button>` ต่อระดับ)
 *
 * ของทีมเป็นปุ่มที่กดไม่ได้ · ที่นี่กดได้จริงถ้าบทบาทมีสิทธิ์ (§5.5 ทีมกลาง + ผู้บริหาร)
 * ถ้าไม่มีสิทธิ์จะ render เป็นจุดอ่านอย่างเดียว ไม่ใช่ปุ่มที่กดแล้วเงียบ
 */
export function TargetDots({ code, achieved, target, lastYear, editable }: {
  code: string;
  achieved: number;
  target: number;
  lastYear: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = async (level: number) => {
    setBusy(level);
    setError(null);
    try {
      const res = await fetch(`/api/items/${code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetLevel: level }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error([b.error, b.detail].filter(Boolean).join(" · "));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((L) => {
          const on = L === target;
          const reached = L <= achieved;
          const blocked = L < achieved;
          const common: React.CSSProperties = {
            width: 28, height: 26, borderRadius: 6, fontSize: 11.5,
            fontWeight: on ? 800 : 600,
            background: on ? LEVEL_FILL[L] : reached ? "var(--fill)" : "var(--card)",
            color: on ? (L >= 4 ? "#fff" : "var(--ink)") : blocked ? "var(--muted2)" : "var(--ink2)",
            border: `1px solid ${on ? LEVEL_FILL[L] : "var(--line)"}`,
            display: "grid", placeItems: "center",
            fontVariantNumeric: "tabular-nums",
          };
          if (!editable) {
            return <div key={L} style={common} title={on ? `เป้าปีนี้: ระดับ ${L}` : `ระดับ ${L}`}>{L}</div>;
          }
          return (
            <button
              key={L}
              onClick={() => set(L)}
              disabled={busy !== null || blocked || on}
              title={
                blocked ? `ระดับ ${L} ต่ำกว่าระดับที่ได้แล้ว (${achieved}) — ตั้งเป็นเป้าไม่ได้`
                  : on ? `เป้าปีนี้อยู่ที่ระดับ ${L} แล้ว`
                  : `กดเพื่อตั้งเป้าปีนี้เป็นระดับ ${L}`
              }
              style={{
                ...common,
                cursor: blocked || on ? "default" : "pointer",
                opacity: busy !== null && busy !== L ? 0.5 : 1,
              }}
            >
              {busy === L ? "…" : L}
            </button>
          );
        })}
      </div>
      {target > lastYear && (
        <div style={{ fontSize: 10.5, color: "#166b40", marginTop: 3, fontWeight: 700 }}>
          สูงกว่าปีที่แล้ว ({lastYear})
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3, maxWidth: 190 }}>
          ⛔ {error}
        </div>
      )}
    </div>
  );
}
