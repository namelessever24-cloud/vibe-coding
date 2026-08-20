const RSS_SEARCH_URL = "https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko";

const NEWS_CATEGORIES = [
  ["생활·사회", "날씨 OR 건강 OR 생활 OR 교육 OR 환경"],
  ["문화·연예", "문화 OR 영화 OR 음악 OR 공연 OR 전시"],
  ["과학·IT", "과학 OR 인공지능 OR IT OR 우주 OR 기술"],
  ["경제·세계", "경제 OR 금융 OR 산업 OR 세계 OR 국제"],
  ["정치", "정치 OR 국회 OR 정부 OR 선거"]
];

const POLITICS_KEYWORDS = /대통령|국회|국정|정당|정치|선거|대선|총선|민주당|국민의힘|조국혁신당|개혁신당|의원|당대표|원내대표|청와대|특검|탄핵/;

function decodeXml(value = "") {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => entities[entity])
    .trim();
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function kstDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseItems(xml, todayKey, category) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].flatMap((match) => {
    const block = match[1];
    const published = new Date(readTag(block, "pubDate"));
    if (Number.isNaN(published.getTime()) || kstDateKey(published) !== todayKey) return [];

    const source = readTag(block, "source");
    const fullTitle = readTag(block, "title");
    const suffix = source ? ` - ${source}` : "";
    const title = suffix && fullTitle.endsWith(suffix) ? fullTitle.slice(0, -suffix.length) : fullTitle;
    if (!title || (category !== "정치" && POLITICS_KEYWORDS.test(title))) return [];

    return [{
      title,
      category,
      source,
      published_at: published.toISOString(),
      google_news_url: readTag(block, "link")
    }];
  });
}

async function collectTodayNews() {
  const todayKey = kstDateKey(new Date());
  const feeds = await Promise.allSettled(NEWS_CATEGORIES.map(async ([category, query]) => {
    const url = RSS_SEARCH_URL.replace("{query}", encodeURIComponent(query));
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ko-KR,ko;q=0.9" }
    });
    if (!response.ok) throw new Error(`${category} RSS ${response.status}`);
    return [category, await response.text()];
  }));

  const items = [];
  const seenTitles = new Set();
  feeds.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const [category, xml] = result.value;
    const candidate = parseItems(xml, todayKey, category).find((item) => {
      const normalized = item.title.replace(/\s+/g, "").toLowerCase();
      if (seenTitles.has(normalized)) return false;
      seenTitles.add(normalized);
      return true;
    });
    if (candidate) items.push(candidate);
  });

  return { date: todayKey, items };
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  try {
    const news = await collectTodayNews();
    if (!news.items.length) return response.status(502).json({ error: "오늘 뉴스를 가져오지 못했습니다." });

    response.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return response.status(200).json({
      ...news,
      collected_at: new Date().toISOString(),
      source: "Google 뉴스 RSS · 분야별 균형 선별"
    });
  } catch (error) {
    return response.status(500).json({ error: "뉴스를 불러오는 중 문제가 생겼습니다." });
  }
};
