import { NextResponse } from "next/server";
import { snapshot } from "@/lib/db/queries";
import { buildAlerts, alertCounts } from "@/lib/data/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ข้อมูลทั้งชุดจากฐานข้อมูล + แจ้งเตือนที่ derive จากกฎ (ไม่ได้เก็บไว้ในตาราง) */
export async function GET() {
  const seed = snapshot();
  const alerts = buildAlerts(seed);
  return NextResponse.json({ ...seed, alerts, alertCounts: alertCounts(alerts) });
}
