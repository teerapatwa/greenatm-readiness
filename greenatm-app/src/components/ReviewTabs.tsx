"use client";

import { useState } from "react";

/** แท็บ pill พร้อมตัวนับ — ตาม REVIEW CENTER ของไฟล์ทีม */
export function ReviewTabs({ tabs, panels }: {
  tabs: { key: string; label: string; count: number }[];
  panels: Record<string, React.ReactNode>;
}) {
  const [on, setOn] = useState(tabs[0]?.key ?? "");
  return (
    <div>
      <div className="ga-tabs" style={{ marginBottom: 20 }}>
        {tabs.map((t) => (
          <button key={t.key} className="ga-tab" data-on={String(on === t.key)}
            onClick={() => setOn(t.key)}>
            {t.label} · {t.count}
          </button>
        ))}
      </div>
      {panels[on]}
    </div>
  );
}
