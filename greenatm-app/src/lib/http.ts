import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth/session";

/**
 * สัญญาการตอบกลับของ API ทุกเส้นทาง
 * ข้อผิดพลาดต้อง "อ่านรู้เรื่อง" — ไม่ใช่ 500 เปล่า ๆ ให้คนเดาเอง
 */
export function ok(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function fail(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, detail: err.detail ?? null }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
  // ค่าที่ validate ไม่ผ่านคือคำขอที่ผิด ไม่ใช่เซิร์ฟเวอร์พัง
  return NextResponse.json({ error: message, detail: null }, { status: 400 });
}

export async function jsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "ต้องส่ง body เป็น JSON");
  }
}

export const num = (v: unknown, name: string): number => {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new HttpError(400, `${name} ต้องเป็นตัวเลข`);
  return x;
};

export const str = (v: unknown, name: string): string => {
  if (typeof v !== "string" || v.trim() === "") throw new HttpError(400, `ต้องระบุ ${name}`);
  return v;
};
