import { NextResponse } from "next/server";
import { SESSION_COOKIE, currentUser } from "@/lib/auth/session";
import { profileFor } from "@/lib/auth/perms";
import { userById, users } from "@/lib/db/queries";
import { fail, jsonBody, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ผู้ใช้ปัจจุบัน + รายชื่อผู้ใช้ให้สลับ (ตัวสลับบทบาทของเดโม ไม่ใช่ระบบล็อกอิน) */
export async function GET() {
  try {
    const u = await currentUser();
    return ok({
      current: { ...u, profile: profileFor(u.role) },
      users: users(),
      isRealAuthentication: false,
      note: "ตัวสลับผู้ใช้ของเดโม ไม่ใช่การยืนยันตัวตนจริง — แต่สิทธิ์ถูกบังคับที่ฝั่ง server",
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await jsonBody<{ userId?: string }>(req);
    const id = str(body.userId, "userId");
    const u = userById(id);
    if (!u) return fail(new Error(`ไม่รู้จักผู้ใช้ ${id}`));
    const res = NextResponse.json({ current: { ...u, profile: profileFor(u.role) } });
    res.cookies.set(SESSION_COOKIE, u.id, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (e) {
    return fail(e);
  }
}
