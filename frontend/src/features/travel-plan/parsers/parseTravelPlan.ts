import type { ImageCategory } from "../utils/imageResolver";

export interface ImageTagItem {
  name: string;
  category: ImageCategory;
  description: string;
}

export interface TimeSlot {
  period: string;
  title: string;
  refIds: number[];
  details: string[];
}

export interface DayPlan {
  day: number;
  title: string;
  slots: TimeSlot[];
  summary?: string;
}

export interface FoodItem {
  rank: number;
  name: string;
  description: string;
}

export interface PlanSection {
  key: string;
  title: string;
  content: string;
  days?: DayPlan[];
  foods?: FoodItem[];
  images?: ImageTagItem[];
}

export interface ParsedTravelPlan {
  isPlan: boolean;
  sections: PlanSection[];
  allImages: ImageTagItem[];
}

const SECTION_DEFS = [
  { key: "overview", pattern: /(?:^|\n)[#*\s]*[一1][、.．]\s*行程概览/im },
  { key: "weather", pattern: /(?:^|\n)[#*\s]*[二2][、.．]\s*季节/im },
  { key: "daily", pattern: /(?:^|\n)[#*\s]*[三3][、.．]\s*每日/im },
  { key: "food", pattern: /(?:^|\n)[#*\s]*[四4][、.．]\s*(?:美食|小吃)/im },
  { key: "spots", pattern: /(?:^|\n)[#*\s]*[五5][、.．]\s*景点/im },
  { key: "traffic", pattern: /(?:^|\n)[#*\s]*[六6][、.．]\s*交通/im },
  { key: "notes", pattern: /(?:^|\n)[#*\s]*[七7][、.．]\s*注意/im },
  { key: "budget", pattern: /(?:^|\n)[#*\s]*[八8][、.．]\s*预算/im },
  { key: "disclaimer", pattern: /(?:^|\n)[#*\s]*[九9][、.．]\s*免责/im },
  { key: "gallery", pattern: /(?:^|\n)[#*\s]*(?:十[、.．]\s*)?(?:关联图示|图示索引)/im },
];

const SECTION_TITLES: Record<string, string> = {
  overview: "行程概览",
  weather: "季节与天气适配",
  daily: "每日路线攻略",
  food: "美食推荐",
  spots: "景点预约与收费",
  traffic: "交通出行",
  notes: "注意事项",
  budget: "预算参考",
  gallery: "关联图示",
  disclaimer: "免责声明",
};

const IMG_TAG_RE = /@img\[([^|\]]+)\|([^|\]]+)\|([^\]]*)\]/g;

const TIME_PERIOD_RE =
  /^(?:[-*•]\s*)?\*{0,2}(上午|中午|下午|晚间|晚上|夜间|早餐|午餐|晚餐)[：:]\s*(.+?)\*{0,2}(?:[（(]详见汇总清单\s*#?([\d,\s#]+)[）)])?$/i;

const DAY_HEADER_RE =
  /^(?:#{1,4}\s*)?(?:Day\s*)?(\d+)\s*[：:]\s*(.+)$/i;

const FOOD_ITEM_RE =
  /^\s*(\d+)\.\s*\*{0,2}([^*：:]+?)\*{0,2}[：:]\s*(.+)$/;

/** 是否应按「完整旅行攻略」结构化渲染（细节追问如按 Day 分组的列表不算） */
export function isTravelPlanContent(content: string): boolean {
  const structuralKeys = new Set([
    "overview",
    "weather",
    "daily",
    "food",
    "spots",
    "traffic",
    "notes",
    "budget",
    "disclaimer",
  ]);
  const hits = SECTION_DEFS.filter(
    (s) => structuralKeys.has(s.key) && s.pattern.test(content)
  ).length;
  if (hits >= 3) return true;

  const hasOverview = SECTION_DEFS.find((s) => s.key === "overview")!.pattern.test(
    content
  );
  const hasDaily = SECTION_DEFS.find((s) => s.key === "daily")!.pattern.test(content);
  return hasOverview && hasDaily;
}

export function parseImageTags(text: string): ImageTagItem[] {
  const items: ImageTagItem[] = [];
  let match: RegExpExecArray | null;
  IMG_TAG_RE.lastIndex = 0;
  while ((match = IMG_TAG_RE.exec(text)) !== null) {
    const category = normalizeCategory(match[2].trim());
    items.push({
      name: match[1].trim(),
      category,
      description: match[3].trim(),
    });
  }
  return items;
}

function normalizeCategory(raw: string): ImageCategory {
  if (/景点|景区|名胜/.test(raw)) return "景点";
  if (/小吃|零食|点心/.test(raw)) return "小吃";
  if (/美食|餐饮|菜肴/.test(raw)) return "美食";
  return "其他";
}

const GALLERY_HEADER_RE =
  /(?:^|\n)[#*\s]*(?:十[、.．]\s*)?(?:关联图示|图示索引)/im;

function stripSectionHeader(text: string): string {
  return text
    .replace(
      /^(?:#{1,4}\s*|\*{1,2}\s*)?[一二三四五六七八九十\d]+[、.．]\s*[^\n]+/m,
      ""
    )
    .replace(/^---+$/gm, "")
    .trim();
}

/** 移除「关联图示」章节正文及 @img 标签，避免原样展示 */
export function stripGalleryFromText(text: string): string {
  const match = GALLERY_HEADER_RE.exec(text);
  if (match && match.index !== undefined) {
    return text.slice(0, match.index).trim();
  }
  return text.replace(IMG_TAG_RE, "").trim();
}

function parseRefIds(raw?: string): number[] {
  if (!raw) return [];
  return [...raw.matchAll(/#?(\d+)/g)].map((m) => Number(m[1]));
}

function parseDayPlans(content: string): DayPlan[] {
  const lines = content.split("\n");
  const days: DayPlan[] = [];
  let current: DayPlan | null = null;
  let currentSlot: TimeSlot | null = null;

  const flushSlot = () => {
    if (current && currentSlot) {
      current.slots.push(currentSlot);
      currentSlot = null;
    }
  };

  const flushDay = () => {
    flushSlot();
    if (current) {
      days.push(current);
      current = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "---") continue;

    const dayMatch = line.match(DAY_HEADER_RE);
    if (dayMatch) {
      flushDay();
      current = {
        day: Number(dayMatch[1]),
        title: dayMatch[2].replace(/\*+/g, "").trim(),
        slots: [],
      };
      continue;
    }

    const slotMatch = line.match(TIME_PERIOD_RE);
    if (slotMatch && current) {
      flushSlot();
      currentSlot = {
        period: slotMatch[1],
        title: slotMatch[2].replace(/\*+/g, "").trim(),
        refIds: parseRefIds(slotMatch[3]),
        details: [],
      };
      continue;
    }

    if (line.includes("当日交通小结") && current) {
      flushSlot();
      current.summary = line.replace(/^[-*•]\s*/, "").replace(/\*+/g, "");
      continue;
    }

    const detail = line
      .replace(/^[-*•]\s*/, "")
      .replace(/^\s+/, "")
      .replace(/\*+/g, "");
    if (!detail) continue;

    if (currentSlot) {
      currentSlot.details.push(detail);
    } else if (current && !current.summary) {
      if (!current.summary) current.summary = detail;
    }
  }

  flushDay();
  return days;
}

function parseFoodList(content: string): FoodItem[] {
  const items: FoodItem[] = [];
  for (const line of content.split("\n")) {
    const match = line.trim().match(FOOD_ITEM_RE);
    if (match) {
      items.push({
        rank: Number(match[1]),
        name: match[2].trim(),
        description: match[3].trim(),
      });
    }
  }
  return items;
}

function extractSpotNamesFromTable(content: string): ImageTagItem[] {
  const items: ImageTagItem[] = [];
  for (const line of content.split("\n")) {
    if (!line.includes("|")) continue;
    const cols = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cols.length < 2 || /景点|序号|:-/.test(cols[0])) continue;
    const name = cols[1]?.replace(/\*+/g, "").trim();
    if (name && name.length > 1) {
      items.push({ name, category: "景点", description: cols[6] || cols[5] || "" });
    }
  }
  return items;
}

function mergeImages(...groups: ImageTagItem[][]): ImageTagItem[] {
  const map = new Map<string, ImageTagItem>();
  for (const group of groups) {
    for (const item of group) {
      const key = item.name.replace(/\s+/g, "");
      if (!map.has(key)) map.set(key, item);
    }
  }
  return [...map.values()];
}

export function parseTravelPlan(content: string): ParsedTravelPlan {
  if (!isTravelPlanContent(content)) {
    return { isPlan: false, sections: [], allImages: [] };
  }

  const markers: Array<{ key: string; index: number }> = [];
  for (const def of SECTION_DEFS) {
    const match = def.pattern.exec(content);
    if (match) {
      markers.push({ key: def.key, index: match.index });
    }
  }

  markers.sort((a, b) => a.index - b.index);

  const sections: PlanSection[] = [];
  const imageGroups: ImageTagItem[][] = [];

  for (let i = 0; i < markers.length; i++) {
    const { key, index } = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].index : content.length;
    const raw = content.slice(index, end);
    const body = stripSectionHeader(raw);

    const section: PlanSection = {
      key,
      title: SECTION_TITLES[key] || key,
      content: key === "gallery" ? body.replace(IMG_TAG_RE, "").trim() : stripGalleryFromText(body),
    };

    if (key === "daily") {
      section.days = parseDayPlans(body);
    }
    if (key === "food") {
      section.foods = parseFoodList(body);
      imageGroups.push(
        section.foods.map((f) => ({
          name: f.name,
          category: "小吃" as ImageCategory,
          description: f.description.slice(0, 60),
        }))
      );
    }
    if (key === "spots") {
      imageGroups.push(extractSpotNamesFromTable(body));
    }
    if (key === "gallery") {
      section.images = parseImageTags(body);
      imageGroups.push(section.images);
    }

    sections.push(section);
  }

  const inlineImages = parseImageTags(content);
  if (inlineImages.length) imageGroups.push(inlineImages);

  return {
    isPlan: true,
    sections,
    allImages: mergeImages(...imageGroups),
  };
}
