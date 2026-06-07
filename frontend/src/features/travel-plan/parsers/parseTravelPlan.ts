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

const IMG_TAG_RE = /@img\[([^|\]]+)\|([^|\]]+)\|([^\]]*)\]/g;

const GALLERY_NUM = String.raw`(?:[一二三四五六七八九十百廿卅\d]+[、.．]\s*)`;
const GALLERY_TITLE = String.raw`(?:关联图示|关联图片|图示索引)`;
/** 独立成行的关联图示章节标题（支持十一、十二等序号） */
const GALLERY_HEADER_LINE_RE = new RegExp(
  String.raw`(?:^|\n)\s*(?:#{1,4}\s*)?${GALLERY_NUM}?${GALLERY_TITLE}(?:\s*(?:$|\n))`,
  "im"
);
/** 句号/分号后紧跟的关联图示标题（模型偶发写在段末同一行） */
const GALLERY_HEADER_INLINE_RE = new RegExp(
  String.raw`[。；;！!?\?](?=\s*(?:#{1,4}\s*)?${GALLERY_NUM}?${GALLERY_TITLE})`,
  "im"
);

function findGalleryStart(text: string): number {
  let cutAt = -1;

  const lineMatch = GALLERY_HEADER_LINE_RE.exec(text);
  if (lineMatch?.index !== undefined) {
    cutAt = lineMatch.index;
  }

  GALLERY_HEADER_INLINE_RE.lastIndex = 0;
  const inlineMatch = GALLERY_HEADER_INLINE_RE.exec(text);
  if (inlineMatch?.index !== undefined) {
    const pos = inlineMatch.index + 1;
    if (cutAt === -1 || pos < cutAt) {
      cutAt = pos;
    }
  }

  return cutAt;
}

/** 章节标题行前缀：允许任意中文/阿拉伯序号，模型偶发会写「三、行程概览」等 */
const SECTION_LINE = String.raw`(?:^|\n)\s*(?:#{1,4}\s*)?(?:[一二三四五六七八九十百\d]+[、.．]\s*)?`;

function sectionPattern(keyword: string): RegExp {
  return new RegExp(`${SECTION_LINE}${keyword}`, "im");
}

const DAY_HEADER_COUNT_RE = /(?:^|\n)\s*(?:#{1,4}\s*)?Day\s*\d+\s*[：:]/gim;

const SECTION_DEFS = [
  { key: "overview", pattern: sectionPattern(String.raw`行程概览`) },
  { key: "weather", pattern: sectionPattern(String.raw`(?:季节|天气)`) },
  {
    key: "daily",
    pattern: sectionPattern(String.raw`(?:每日(?:合理|详细)?(?:路线|行程)|路线与攻略)`),
  },
  { key: "food", pattern: sectionPattern(String.raw`(?:美食|小吃)(?:推荐)?(?:清单)?`) },
  {
    key: "spots",
    pattern: sectionPattern(String.raw`景点(?:预约(?:与|及)?收费)?(?:汇总)?清单`),
  },
  { key: "traffic", pattern: sectionPattern(String.raw`交通(?:出行)?(?:建议)?`) },
  {
    key: "notes",
    pattern: sectionPattern(String.raw`注意(?:事项)?(?:与|及)?(?:必备物品)?`),
  },
  { key: "budget", pattern: sectionPattern(String.raw`预算(?:参考)?`) },
  { key: "disclaimer", pattern: sectionPattern(String.raw`免责(?:声明)?`) },
  { key: "gallery", pattern: GALLERY_HEADER_LINE_RE },
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

const TIME_PERIOD_RE =
  /^(?:[-*•]\s*)?\*{0,2}(上午|中午|下午|晚间|晚上|夜间|早餐|午餐|晚餐)[：:]\s*(.+?)\*{0,2}(?:[（(]详见(?:汇总|美食)清单\s*#?([\d,\s#]+)[）)])?$/i;

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
  if (hasOverview && hasDaily) return true;

  const dayHeaders = content.match(DAY_HEADER_COUNT_RE) ?? [];
  if (dayHeaders.length >= 2 && hits >= 1) return true;
  if (dayHeaders.length >= 1 && hasOverview) return true;

  return false;
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
  const cutAt = findGalleryStart(text);
  if (cutAt >= 0) {
    return text.slice(0, cutAt).trim();
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

    if (/交通(?:小贴士|小结)/.test(line) && current) {
      flushSlot();
      current.summary = line
        .replace(/^[-*•]\s*/, "")
        .replace(/\*+/g, "")
        .replace(/^当?日?交通(?:小贴士|小结)[：:]\s*/, "");
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

  if (!markers.some((m) => m.key === "gallery")) {
    const galleryStart = findGalleryStart(content);
    if (galleryStart >= 0) {
      markers.push({ key: "gallery", index: galleryStart });
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
