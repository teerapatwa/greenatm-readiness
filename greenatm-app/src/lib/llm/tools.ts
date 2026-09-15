import "server-only";
import type { ToolSpec } from "./client";

/**
 * Tool ชุดเล็กสำหรับทดสอบ TF6 — "endpoint คืน tool_calls จริงหรือไม่"
 *
 * ตั้งใจให้เป็น tool จริงที่มี implementation จริง ไม่ใช่ชื่อที่เขียนไว้ใน prompt
 * เอกสาร integration ทั้งสองฉบับเขียนตรงกันว่า
 *   "prompt ที่พูดถึง tool ไม่ใช่การเรียก tool"
 *
 * ชุดนี้เป็น read-only ทั้งหมด ตรงกับ PLAN §5.4 (agent หนึ่ง)
 * ข้อมูลเป็นตัวอย่างสังเคราะห์ — ยังไม่ต่อฐานข้อมูลจริงในขั้นนี้
 */

type Item = {
  id: string;
  name: string;
  category: string;
  achievedLevel: number;
  targetLevel: number;
  criteria: string[];
  evidence: { id: string; title: string; documentDate: string | null; tier: string | null }[];
};

const SAMPLE: Record<string, Item> = {
  "2.7": {
    id: "2.7",
    name: "การวัดผลประโยชน์ด้านเชื้อเพลิงจากการปรับปรุงเส้นทางบิน",
    category: "2 · ปฏิบัติการจราจรทางอากาศ",
    achievedLevel: 2,
    targetLevel: 3,
    criteria: [
      "มีวิธีวัดผลประโยชน์ที่ตกลงร่วมกับผู้มีส่วนได้เสีย",
      "มีผลการวัดจริงอย่างน้อยหนึ่งรอบ ลงนามรับรอง",
      "รายงานผลต่อผู้บริหารอย่างเป็นระบบ",
    ],
    evidence: [
      { id: "E-014", title: "รายงานผลการทดลอง ลงนาม 12 มิ.ย. 2569", documentDate: "2026-06-12", tier: null },
      { id: "E-021", title: "(ร่าง) แผนดำเนินการปี 2570", documentDate: "2026-08-02", tier: null },
    ],
  },
  "4.1": {
    id: "4.1",
    name: "การสื่อสารนโยบายสิ่งแวดล้อมภายในองค์กร",
    category: "4 · สื่อสารองค์กร",
    achievedLevel: 2,
    targetLevel: 3,
    criteria: ["มีแผนการสื่อสารที่อนุมัติแล้ว", "มีหลักฐานการดำเนินการจริงในรอบนี้"],
    evidence: [],
  },
};

export const TEST_TOOLS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_item",
      description:
        "ดึงข้อมูลรายการประเมิน GreenATM หนึ่งรายการ — ชื่อ เกณฑ์ ระดับที่ไปถึง ระดับเป้าหมาย และรายการหลักฐานที่แนบไว้",
      parameters: {
        type: "object",
        properties: {
          item_id: {
            type: "string",
            description: 'รหัสรายการ เช่น "2.7" หรือ "4.1"',
          },
        },
        required: ["item_id"],
        additionalProperties: false,
      },
    },
  },
];

export type ToolExecution = {
  name: string;
  args: unknown;
  ok: boolean;
  result: unknown;
  error: string | null;
};

/** ตรวจ argument ก่อน execute เสมอ — ไม่เชื่อสิ่งที่โมเดลส่งมา */
export function executeTool(name: string, rawArgs: string | object): ToolExecution {
  let args: any;
  try {
    args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : rawArgs;
  } catch {
    return { name, args: rawArgs, ok: false, result: null, error: "arguments ไม่ใช่ JSON ที่ถูกต้อง" };
  }

  if (name !== "get_item") {
    return { name, args, ok: false, result: null, error: `ไม่มี tool ชื่อ "${name}"` };
  }
  const itemId = args?.item_id;
  if (typeof itemId !== "string" || itemId.trim() === "") {
    return { name, args, ok: false, result: null, error: "ต้องระบุ item_id เป็นข้อความ" };
  }
  const item = SAMPLE[itemId.trim()];
  if (!item) {
    // ไม่มีข้อมูล = ตอบว่าไม่มี ไม่ใช่แต่งขึ้นมา (PLAN §5.3)
    return {
      name,
      args,
      ok: true,
      result: { found: false, message: `ไม่มีรายการรหัส "${itemId}" ในระบบ` },
      error: null,
    };
  }
  return { name, args, ok: true, result: { found: true, item }, error: null };
}

export const TOOL_NAMES = TEST_TOOLS.map((t) => t.function.name);
