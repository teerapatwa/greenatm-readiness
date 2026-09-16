import seedJson from "../../../sample-data/seed.json";
import type { Seed } from "./rules";

/** ข้อมูลตัวอย่างสังเคราะห์ — ยังไม่ต่อฐานข้อมูลจริง (PLAN §6.2) */
export const SEED = seedJson as unknown as Seed;

export const itemByCode = (code: string) => SEED.items.find((i) => i.code === code) ?? null;
export const evidenceOf = (code: string) => SEED.evidence.filter((e) => e.itemCode === code);
export const userById = (id: string | null) =>
  id ? SEED.users.find((u) => u.id === id) ?? null : null;
export const divisionById = (id: string) => SEED.divisions.find((d) => d.id === id) ?? null;
