export type ImageCategory = "景点" | "小吃" | "美食" | "其他";

const CURATED_IMAGES: Record<string, string> = {
  断桥残雪:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Hangzhou_Skyline_from_Broken_Bridge.jpg/640px-Hangzhou_Skyline_from_Broken_Bridge.jpg",
  白堤:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Hangzhou_Skyline_from_Broken_Bridge.jpg/640px-Hangzhou_Skyline_from_Broken_Bridge.jpg",
  孤山:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Gushan_Island_Hangzhou.jpg/640px-Gushan_Island_Hangzhou.jpg",
  苏堤春晓:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Su_Causeway_in_Hangzhou.jpg/640px-Su_Causeway_in_Hangzhou.jpg",
  花港观鱼:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Hangzhou_West_Lake_Fish_Viewing_at_Flower_Pond.jpg/640px-Hangzhou_West_Lake_Fish_Viewing_at_Flower_Pond.jpg",
  雷峰塔:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Leifeng_Pagoda_in_Hangzhou.jpg/640px-Leifeng_Pagoda_in_Hangzhou.jpg",
  龙井村:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Longjing_tea_fields.jpg/640px-Longjing_tea_fields.jpg",
  九溪烟树:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Nine_Creeks_Meandering_Through_a_Misty_Forest.jpg/640px-Nine_Creeks_Meandering_Through_a_Misty_Forest.jpg",
  灵隐寺:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lingyin_Temple_2018.jpg/640px-Lingyin_Temple_2018.jpg",
  永福寺:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lingyin_Temple_2018.jpg/640px-Lingyin_Temple_2018.jpg",
  满陇桂雨:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Su_Causeway_in_Hangzhou.jpg/640px-Su_Causeway_in_Hangzhou.jpg",
  西湖:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/West_Lake%2C_Hangzhou%2C_China.jpg/640px-West_Lake%2C_Hangzhou%2C_China.jpg",
  故宫:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Forbidden_City_2013.jpg/640px-Forbidden_City_2013.jpg",
  长城:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling.jpg/640px-The_Great_Wall_of_China_at_Jinshanling.jpg",
  大熊猫:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Grosser_Panda.JPG/640px-Grosser_Panda.JPG",
  宽窄巷子:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Chengdu_Kuanzhai_Alley.jpg/640px-Chengdu_Kuanzhai_Alley.jpg",
};

const CATEGORY_GRADIENT: Record<ImageCategory, [string, string]> = {
  景点: ["#dbeafe", "#3b82f6"],
  小吃: ["#fef3c7", "#f59e0b"],
  美食: ["#fce7f3", "#ec4899"],
  其他: ["#e2e8f0", "#64748b"],
};

function normalizeName(name: string): string {
  return name
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[&＆].*/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function findCuratedImage(name: string): string | null {
  const normalized = normalizeName(name);
  if (CURATED_IMAGES[normalized]) return CURATED_IMAGES[normalized];

  for (const [key, url] of Object.entries(CURATED_IMAGES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return url;
    }
  }
  return null;
}

export function resolveTravelImage(
  name: string,
  category: ImageCategory = "其他"
): { src: string; isPlaceholder: boolean; gradient: [string, string] } {
  const curated = findCuratedImage(name);
  if (curated) {
    return { src: curated, isPlaceholder: false, gradient: CATEGORY_GRADIENT[category] };
  }

  const label = encodeURIComponent(normalizeName(name) || name);
  const [from, to] = CATEGORY_GRADIENT[category];
  const bg = from.replace("#", "");
  const fg = to.replace("#", "");
  return {
    src: `https://placehold.co/400x260/${bg}/${fg}?text=${label}`,
    isPlaceholder: true,
    gradient: CATEGORY_GRADIENT[category],
  };
}

export function categoryLabel(category: ImageCategory): string {
  const map: Record<ImageCategory, string> = {
    景点: "景区",
    小吃: "小吃",
    美食: "美食",
    其他: "推荐",
  };
  return map[category];
}
