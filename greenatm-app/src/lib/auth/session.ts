import "server-only";
import { cookies } from "next/headers";
import { itemByCode, userById, users } from "@/lib/db/queries";
import { hasAbility, profileFor, type Ability, type Role } from "./perms";

/**
 * "ตัวตน" ของผู้ใช้ในต้นแบบ — cookie เดียว ไม่ใช่การยืนยันตัวตนจริง
 *
 * ⚠️ พูดตรง ๆ บนหน้าจอด้วยว่านี่ไม่ใช่ authentication (PLAN §11.1 ข้อ 3)
 * แต่ **สิทธิ์ถูกบังคับใช้จริงในฝั่ง server** — ยิง request ตรงก็ไม่ผ่าน
 */

export const SESSION_COOKIE = "greenatm_user";
const DEFAULT_USER = "u-mod";

export type CurrentUser = {
  id: string;
  title: string;
  role: Role;
  divisionId: string | null;
};

export async function currentUser(): Promise<CurrentUser> {
  const jar = await cookies();
  const wanted = jar.get(SESSION_COOKIE)?.value ?? DEFAULT_USER;
  const u = userById(wanted) ?? userById(DEFAULT_USER) ?? users()[0];
  return { id: u.id, title: u.title, role: u.role, divisionId: u.divisionId };
}

/** ข้อผิดพลาดที่แปลงเป็น HTTP status ได้ — ใช้ใน route handler ทุกตัว */
export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly detail?: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function requireAbility(u: CurrentUser, a: Ability) {
  if (!hasAbility(u.role, a)) {
    throw new HttpError(
      403,
      `บทบาท "${profileFor(u.role).label}" ไม่มีสิทธิ์ทำสิ่งนี้`,
      `ต้องการสิทธิ์ ${a} · ดู PLAN §5.5`,
    );
  }
}

/**
 * รายการนี้เป็นของผู้ใช้คนนี้ไหม — ใช้ก่อนการเขียนทุกครั้ง
 * ทีมกลางแก้ของกองอื่นได้ (มี log) · เจ้าของข้อมูลแก้ได้เฉพาะของตัวเอง (AC-13 · AC-20)
 */
export function requireItemWriteAccess(u: CurrentUser, code: string) {
  const it = itemByCode(code);
  if (!it) throw new HttpError(404, `ไม่พบรายการ ${code}`);
  if (u.role === "central") return it;
  if (u.role !== "owner") {
    throw new HttpError(403, `บทบาท "${profileFor(u.role).label}" ไม่มีสิทธิ์แก้ข้อมูลรายการ`);
  }
  if (it.ownerUserId !== u.id) {
    throw new HttpError(
      403,
      `รายการ ${code} ไม่ใช่ของกองคุณ`,
      "สิทธิ์ตรวจที่ฝั่ง server ไม่ใช่การซ่อนปุ่ม — ยิง request ตรงก็ได้ 403 เหมือนกัน",
    );
  }
  return it;
}

/** อ่านได้ทุกรายการโดยเจตนา — เส้นแบ่งอยู่ที่การเขียน ไม่ใช่การอ่าน (§4.3.1 ข้อ 1) */
export function canWriteItem(u: CurrentUser, code: string): boolean {
  try {
    requireItemWriteAccess(u, code);
    return true;
  } catch {
    return false;
  }
}
