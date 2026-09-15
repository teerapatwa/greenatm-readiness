"use client";

import { useRouter } from "next/navigation";

/**
 * dropdown เลือกรายการ — เข้าถึงได้ทั้ง 24 ข้อ
 *
 * ของเจ้าของข้อมูลแยกสองกลุ่มโดยเจตนา: ของกองตัวเอง (แก้ได้) กับของกองอื่น (อ่านอย่างเดียว)
 * เพื่อให้เห็นเส้นแบ่งสิทธิ์จาก dropdown ได้เลย ไม่ต้องเดา
 */
export function ItemPicker({ items, current, ownerMode, categories }: {
  items: { code: string; name: string; category: number; canWrite: boolean }[];
  current: string;
  ownerMode: boolean;
  categories: { num: number; name: string }[];
}) {
  const router = useRouter();
  const mine = items.filter((i) => i.canWrite);
  const others = items.filter((i) => !i.canWrite);

  return (
    <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>เลือกรายการ</span>
      <select
        className="ga-select" style={{ minWidth: 330, maxWidth: "100%" }}
        value={current}
        onChange={(e) => router.push(`/item/${e.target.value}`)}
      >
        {ownerMode ? (
          <>
            <optgroup label={`★ รายการของกองคุณ — แก้ได้ (${mine.length})`}>
              {mine.map((i) => <option key={i.code} value={i.code}>{i.code} · {i.name}</option>)}
            </optgroup>
            <optgroup label={`รายการของกองอื่น — อ่านอย่างเดียว (${others.length})`}>
              {others.map((i) => <option key={i.code} value={i.code}>{i.code} · {i.name}</option>)}
            </optgroup>
          </>
        ) : (
          categories.map((c) => (
            <optgroup key={c.num} label={`หมวด ${c.num} · ${c.name}`}>
              {items.filter((i) => i.category === c.num).map((i) => (
                <option key={i.code} value={i.code}>{i.code} · {i.name}</option>
              ))}
            </optgroup>
          ))
        )}
      </select>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>
        {ownerMode ? `${mine.length} ของกองคุณ · จากทั้งหมด ${items.length}` : `${items.length} รายการ`}
      </span>
    </label>
  );
}
