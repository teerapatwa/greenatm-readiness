import "server-only";
import {
  buildAlerts, alertCounts, progressPercent, verifiedPercent, suggestion,
  projectedLevel, velocity, stalledItems, SCENARIOS, orgAverage,
  statusFor, expectedPercent, gapsFor,
  type Alert, type Item, type Status, type Gap,
} from "@/lib/data/rules";
import { snapshot, openPendingFor, outbox, evidence as allEvidence, agentRunCount } from "@/lib/db/queries";
import { profileFor } from "@/lib/auth/perms";
import { canWriteItem, type CurrentUser } from "@/lib/auth/session";

/**
 * ประกอบข้อมูลสำหรับหน้าจอ — "กรองตามผู้ใช้" เกิดที่นี่ที่เดียว
 *
 * เจ้าของข้อมูล: อ่านได้ทุกรายการ แต่ myItems มีแค่ของกองตัวเอง และ canWrite เป็นเท็จสำหรับของกองอื่น
 * ผู้ดูแล: เห็นทุกอย่าง · คิวแจ้งเตือนเฉพาะที่ส่งถึงผู้ดูแล
 * ผู้บริหาร: เห็นทุกอย่าง แต่ไม่รับแจ้งเตือนรายรายการเลย (§4.3.1 ข้อ 2)
 */

export type ItemView = Item & {
  progress: number;
  /** ความคืบหน้าที่ควรได้แล้วตามปฏิทิน — ใช้เทียบเพื่อหาสถานะ */
  expected: number;
  status: Status;
  verified: number;
  suggestion: ReturnType<typeof suggestion>;
  gaps: Gap[];
  velocity: number;
  forecast1: number;
  canWrite: boolean;
  isMine: boolean;
  evidenceCount: number;
  daysToDue: number;
};

const DAY = 86_400_000;
const dayDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

export function alertsFor(u: CurrentUser, all: Alert[]): Alert[] {
  const receives = profileFor(u.role).receives;
  if (receives === "none") return [];
  if (receives === "moderator-queue") return all.filter((a) => a.toModerator);
  return all.filter((a) => a.toOwner === u.id);
}

export function buildView(u: CurrentUser) {
  const seed = snapshot();
  const ev = seed.evidence;
  const all = buildAlerts(seed);

  const items: ItemView[] = seed.items.map((it) => ({
    ...it,
    progress: progressPercent(it),
    expected: expectedPercent(it, seed.meta.today),
    status: statusFor(it, seed.settings, seed.meta.today),
    verified: verifiedPercent(it, ev),
    suggestion: suggestion(it, ev, seed.settings),
    gaps: gapsFor(it, ev, seed.settings, seed.meta.today),
    velocity: velocity(it),
    forecast1: projectedLevel(it, 1),
    canWrite: canWriteItem(u, it.code),
    isMine: it.ownerUserId === u.id,
    evidenceCount: ev.filter((e) => e.itemCode === it.code).length,
    daysToDue: dayDiff(seed.meta.today, it.dueDate),
  }));

  const mine = u.role === "owner" ? items.filter((i) => i.isMine) : items;

  return {
    meta: seed.meta,
    settings: seed.settings,
    categories: seed.categories,
    divisions: seed.divisions,
    users: seed.users,
    user: { ...u, profile: profileFor(u.role) },
    items,
    myItems: mine,
    evidence: ev,
    alerts: alertsFor(u, all),
    allAlertCounts: alertCounts(all),
    pending: openPendingFor(u.id),
    outbox: outbox(),
    // จำนวนครั้งที่ agent ทำงาน — หลักฐานว่า agent ทำงานจริง ตรวจย้อนได้ (AC-06)
    agentRuns: agentRunCount(),
    org: {
      meanNow: avg(items.map((i) => i.achievedLevel)),
      meanLast: avg(items.map((i) => i.lastYearLevel)),
      stalled: stalledItems(items).length,
      notSubmitted: items.filter((i) => !i.submittedThisCycle).length,
      unowned: items.filter((i) => !i.ownerUserId).length,
      delayed: items.filter((i) => i.status === "delayed").length,
      atRisk: items.filter((i) => i.status === "at_risk").length,
      /** รายการที่มีหลักฐานชั้น A/B ที่ยืนยันแล้วอย่างน้อยหนึ่งชิ้น */
      withVerified: items.filter((i) => i.verified > 0).length,
    },
  };
}

export function trendView() {
  const seed = snapshot();
  const items = seed.items;
  const years = [0, 1, 3, 5];
  return {
    meta: seed.meta,
    years,
    scenarios: SCENARIOS.map((sc) => ({
      ...sc,
      byYear: years.map((y) => orgAverage(items, y, sc.multiplier)),
    })),
    items: items.map((it) => ({
      code: it.code, name: it.name, category: it.category,
      achievedLevel: it.achievedLevel, lastYearLevel: it.lastYearLevel,
      targetLevel: it.targetLevel, velocity: velocity(it),
      p3: projectedLevel(it, 3), p5: projectedLevel(it, 5),
      stalled: it.achievedLevel === it.lastYearLevel,
    })),
    stalled: stalledItems(items).map((i) => ({ code: i.code, name: i.name, level: i.achievedLevel })),
    categories: seed.categories,
  };
}

export function evidenceOf(code: string) {
  return allEvidence().filter((e) => e.itemCode === code);
}

function avg(a: number[]) {
  return a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length;
}
