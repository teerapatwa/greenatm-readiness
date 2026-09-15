/**
 * บทบาทและสิทธิ์ — PLAN.en.md §4.3.1 · §5.5
 *
 * ไฟล์นี้เป็น "ความจริงชุดเดียว" ของสิทธิ์ ใช้ทั้งฝั่ง server (บังคับใช้)
 * และฝั่งหน้าจอ (แสดงให้เห็นว่าบทบาทนี้ทำอะไรได้/ไม่ได้)
 *
 * ⚠️ การบังคับใช้เกิดใน route handler ทุกครั้ง — การซ่อนเมนูไม่ใช่การกันสิทธิ์
 */

export type Role = "owner" | "central" | "executive";
export type Screen = "home" | "my" | "item" | "alerts" | "review" | "trend";

export type Ability =
  | "enter_progress"      // กรอกความคืบหน้า/แนบหลักฐาน (ของกองตัวเองเท่านั้น)
  | "confirm_tier"        // ยืนยันชั้นหลักฐาน → ค่า Verified ขยับ
  | "draft_outbox"        // ร่างข้อความแจ้งเตือน
  | "send_outbox"         // กดส่งร่าง
  | "set_target_level"    // ตั้งเป้าระดับของปี
  | "manage_item"         // แก้ชื่อหัวข้อ · มอบหมายผู้รับผิดชอบ · ปรับระดับที่ได้
  | "set_setting";        // แก้ค่าตั้งค่าระบบ

export type RoleProfile = {
  role: Role;
  label: string;
  screens: Screen[];
  abilities: Ability[];
  /** รับแจ้งเตือนช่องทางไหน — executive ไม่รับรายรายการโดยเจตนา */
  receives: "own-items" | "moderator-queue" | "none";
  can: string[];
  cannot: string[];
};

export const ROLES: Record<Role, RoleProfile> = {
  owner: {
    role: "owner",
    label: "เจ้าของข้อมูล",
    screens: ["home", "my", "item", "alerts"],
    abilities: ["enter_progress"],
    receives: "own-items",
    can: [
      "กรอกความคืบหน้าและแนบหลักฐาน — เฉพาะรายการของกองตัวเอง",
      "เห็น Suggestion ของ agent สำหรับรายการของตัวเอง",
      "รับแจ้งเตือนเรื่องหลักฐานของกองตัวเอง",
    ],
    cannot: [
      "ยืนยันชั้นหลักฐาน (Verified) — เป็นของทีมกลาง",
      "แก้รายการของกองอื่น — backend ตอบ 403 ถ้ายิงตรง",
      "ตั้งเป้าระดับของปี",
      "กดส่งข้อความถึงกองอื่น",
    ],
  },
  central: {
    role: "central",
    label: "ผู้ดูแล (ทีมกลาง)",
    screens: ["home", "item", "alerts", "review", "trend"],
    abilities: ["confirm_tier", "draft_outbox", "send_outbox", "set_setting", "enter_progress",
                "set_target_level", "manage_item"],
    receives: "moderator-queue",
    can: [
      "ยืนยันหรือแก้ชั้นหลักฐานพร้อมเหตุผล — ค่า Verified ขยับจากจุดนี้เท่านั้น",
      "เห็นทุกรายการทุกกอง และเห็นว่ากองไหนยังไม่ส่ง",
      "รับแจ้งเตือนเรื่องกำหนดส่ง แผนงานเลยกำหนด และการเลื่อนแผนซ้ำ",
      "ตรวจร่างข้อความใน Outbox แล้วกดส่งเอง",
      "ตั้งเป้าระดับของปี และปรับระดับที่ได้ (ต้องมีหลักฐานยืนยันรองรับ)",
      "แก้ชื่อหัวข้อ และมอบหมายผู้รับผิดชอบรายรายการ",
      "แก้ค่าตั้งค่าระบบ เช่น ระยะเตือนล่วงหน้า",
    ],
    cannot: [
      "ตั้งสถานะ On Track / At Risk เอง — โค้ดคำนวณ",
      "ปรับระดับที่ได้โดยไม่มีหลักฐานชั้น A/B ที่ยืนยันแล้ว",
      "อนุมัติคำตอบรอบเดือน",
      "ประกาศว่าองค์กรผ่านการประเมิน",
    ],
  },
  executive: {
    role: "executive",
    label: "ผู้บริหาร",
    screens: ["home", "item", "trend"],
    abilities: ["set_target_level"],
    receives: "none",
    can: [
      "เห็นภาพรวมทุกหมวด ระดับเทียบปีที่แล้ว และคาดการณ์ 3–5 ปี",
      "เปิดดูรายละเอียดและ timeline ของทุกรายการ",
      "ตั้งเป้าระดับของปี",
    ],
    cannot: [
      "แก้ข้อมูลความคืบหน้าหรือหลักฐานของกองใด",
      "ยืนยันชั้นหลักฐาน",
      "รับแจ้งเตือนรายรายการ — ผู้บริหารอ่านภาพรวม ไม่ถูกตาม",
    ],
  },
};

export const profileFor = (role: Role) => ROLES[role];
export const canSee = (role: Role, screen: Screen) => ROLES[role].screens.includes(screen);
export const hasAbility = (role: Role, a: Ability) => ROLES[role].abilities.includes(a);
