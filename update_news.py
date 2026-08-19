#!/usr/bin/env python3
"""구글 뉴스 RSS를 받아 기분기록기의 날짜별 뉴스 보관함을 갱신한다."""

from __future__ import annotations

import json
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

RSS_SEARCH_URL = "https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko"
NEWS_CATEGORIES = (
    ("생활·사회", "날씨 OR 건강 OR 생활 OR 교육 OR 환경"),
    ("문화·연예", "문화 OR 영화 OR 음악 OR 공연 OR 전시"),
    ("과학·IT", "과학 OR 인공지능 OR IT OR 우주 OR 기술"),
    ("경제·세계", "경제 OR 금융 OR 산업 OR 세계 OR 국제"),
    ("정치", "정치 OR 국회 OR 정부 OR 선거"),
)
POLITICS_KEYWORDS = re.compile(
    r"대통령|국회|국정|정당|정치|선거|대선|총선|민주당|국민의힘|조국혁신당|"
    r"개혁신당|의원|당대표|원내대표|청와대|특검|탄핵"
)
KST = ZoneInfo("Asia/Seoul")
ROOT = Path(__file__).resolve().parent
JSON_PATH = ROOT / "news-archive.json"
JS_PATH = ROOT / "news-data.js"


def node_text(node, name):
    child = node.find(name)
    return child.text.strip() if child is not None and child.text else None


def fetch(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "ko-KR,ko;q=0.9"})
    with urlopen(request, timeout=30) as response:
        return response.read()


def parse_items(xml, now, category):
    root = ET.fromstring(xml)
    channel = root.find("channel")
    items = []
    if channel is None:
        return items

    for item in channel.findall("item"):
        published_text = node_text(item, "pubDate")
        if not published_text:
            continue
        published = parsedate_to_datetime(published_text).astimezone(KST)
        if published.date() != now.date():
            continue
        source_node = item.find("source")
        source = source_node.text.strip() if source_node is not None and source_node.text else None
        full_title = node_text(item, "title")
        suffix = f" - {source}" if source else ""
        title = full_title[:-len(suffix)] if suffix and full_title.endswith(suffix) else full_title
        if not title or (category != "정치" and POLITICS_KEYWORDS.search(title)):
            continue
        items.append({
            "title": title,
            "category": category,
            "source": source,
            "published_at": published.isoformat(timespec="seconds"),
            "google_news_url": node_text(item, "link"),
        })
    return items


def collect_today():
    now = datetime.now(KST)
    selected = []
    seen_titles = set()

    # 분야별 최신 기사 한 건씩만 골라 특정 분야가 목록을 독점하지 않게 한다.
    for category, query in NEWS_CATEGORIES:
        url = RSS_SEARCH_URL.format(query=quote_plus(query))
        try:
            candidates = parse_items(fetch(url), now, category)
        except (OSError, ET.ParseError, ValueError) as error:
            print(f"{category} 뉴스를 가져오지 못했습니다: {error}")
            continue

        for item in candidates:
            normalized_title = re.sub(r"\s+", "", item["title"]).lower()
            if normalized_title in seen_titles:
                continue
            seen_titles.add(normalized_title)
            selected.append(item)
            break

    return now, selected


def main():
    now, items = collect_today()
    try:
        archive = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        archive = {}
    if not items:
        print("오늘 뉴스를 가져오지 못해 기존 데이터를 유지합니다.")
        return

    archive[now.date().isoformat()] = {
        "collected_at": now.isoformat(timespec="seconds"),
        "source": "Google 뉴스 RSS · 분야별 균형 선별",
        "items": items,
    }
    serialized = json.dumps(archive, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(serialized + "\n", encoding="utf-8")
    JS_PATH.write_text(f"window.NEWS_ARCHIVE = {serialized};\n", encoding="utf-8")
    print(f"{now.date().isoformat()} 주요 뉴스 {len(items)}건을 기분기록기에 저장했습니다.")


if __name__ == "__main__":
    main()
