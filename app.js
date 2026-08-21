const STORAGE_KEY = "today-tags-records";
const THEME_KEY = "today-tags-theme";

const categories = [
  { key: "rating", name: "오늘 어땠어? 🌤", hint: "하나만 골라요", mode: "single", color: "#efa2bb", text: "#a34667", bg: "#fff1f5", tags: ["완전 좋았어 😍", "좋았어 🙂", "괜찮았어 😌", "그냥 그랬어 😐", "좀 힘들었어 😮‍💨", "진짜 별로였어 🫠"] },
  { key: "activities", name: "오늘 뭐 했어? ✨", hint: "여러 개 선택 가능", mode: "multiple", color: "#91c9bd", text: "#287c6d", bg: "#effaf7", tags: ["일했어 💼", "공부했어 📚", "운동했어 🏃", "놀았어 🎮", "쉬었어 🛋", "사람 만났어 👥", "집에 있었어 🏠", "특별한 일 있었어 🎉"] },
  { key: "body", name: "몸은 어땠어? 🫧", hint: "여러 개 선택 가능", mode: "multiple", color: "#92c5e8", text: "#36759d", bg: "#edf8ff", tags: ["컨디션 좋았어 💪", "가벼웠어 ✨", "나른했어 😪", "피곤했어 🥱", "잠이 부족했어 🌙", "몸이 무거웠어 🪨", "아팠어 🤒"] },
  { key: "state", name: "오늘 나는 어땠지? 🌿", hint: "여러 개 선택 가능", mode: "multiple", color: "#bda6df", text: "#72549a", bg: "#f7f0ff", tags: ["활기찼어 ⚡", "편안했어 😌", "집중 잘됐어 🎯", "여유 있었어 🌿", "멍했어 😵‍💫", "예민했어 😤", "답답했어 😮‍💨", "불안했어 😟", "좀 우울했어 🌧", "신났어 🎈"] },
  { key: "praise", name: "나 칭찬할 건? 🌟", hint: "선택사항 · 여러 개 가능", mode: "multiple", color: "#f2c477", text: "#a36b15", bg: "#fff8e8", tags: ["이건 좀 잘했다 💪", "새로운 거 해봤어 🌱", "나 좀 챙겼지 ❤️", "용기 냈다 🚀", "좋은 선택했어 👍"] }
];

const today = new Date();
const todayKey = dateKey(today);
let activeDate = new Date(today);
let activeDateKey = todayKey;
let selected = createEmptySelection();
let praiseDetails = {};
let praiseDetailsContainer;
let activeStatsDays = 7;
let showAllNews = false;

const el = {
  date: document.querySelector("#todayDate"), datePicker: document.querySelector("#recordDate"), todayButton: document.querySelector("#todayButton"),
  categories: document.querySelector("#tagCategories"),
  count: document.querySelector("#selectionCount"), save: document.querySelector("#saveButton"),
  remove: document.querySelector("#deleteButton"), status: document.querySelector("#statusMessage"),
  history: document.querySelector("#historyList"), theme: document.querySelector("#themeToggle"), template: document.querySelector("#categoryTemplate"),
  note: document.querySelector("#dailyNote"), noteCount: document.querySelector("#noteCount"),
  viewTabs: document.querySelectorAll(".view-tab"), recordView: document.querySelector("#recordView"), statsView: document.querySelector("#statsView"),
  rangeButtons: document.querySelectorAll(".range-button"), recordedDays: document.querySelector("#recordedDays"),
  recordRate: document.querySelector("#recordRate"), topRating: document.querySelector("#topRating"), topActivity: document.querySelector("#topActivity"),
  topBody: document.querySelector("#topBody"), praiseCount: document.querySelector("#praiseCount"), moodChart: document.querySelector("#moodChart"),
  chartEmpty: document.querySelector("#chartEmpty"), reviewButton: document.querySelector("#reviewButton"), reviewResult: document.querySelector("#reviewResult"),
  newsList: document.querySelector("#newsList"), newsCount: document.querySelector("#newsCount"),
  newsMoreButton: document.querySelector("#newsMoreButton")
};

function dateKey(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function createEmptySelection() {
  return { rating: "", activities: new Set(), state: new Set(), body: new Set(), praise: new Set() };
}

function normalizeRecord(record) {
  const empty = { rating: "", activities: [], body: [], state: [], praise: [], praiseDetails: {}, note: "", legacyTags: [] };
  if (Array.isArray(record)) return { ...empty, legacyTags: record };
  if (!record || typeof record !== "object") return empty;
  const savedState = Array.isArray(record.state) ? record.state : [];
  const savedBody = Array.isArray(record.body) ? record.body : [];
  const migratedBodyFromState = savedState.filter((tag) => tag === "피곤했어 🥱");
  const bodyTagMap = {
    "괜찮았어 🙂": "컨디션 좋았어 💪",
    "나른했어 🫧": "나른했어 😪",
    "몸이 안 좋았어 🤒": "아팠어 🤒"
  };
  const body = [...savedBody, ...migratedBodyFromState]
    .filter((tag) => tag !== "활기찼어 ⚡")
    .map((tag) => bodyTagMap[tag] || tag);
  const mentalState = savedState.filter((tag) => !migratedBodyFromState.includes(tag));
  const state = savedState.includes("활기찼어 ⚡") || savedBody.includes("활기찼어 ⚡")
    ? ["활기찼어 ⚡", ...mentalState.filter((tag) => tag !== "활기찼어 ⚡")]
    : mentalState;
  const praise = Array.isArray(record.praise)
    ? record.praise.map((tag) => tag === "끝까지 해냈어 💪" ? "이건 좀 잘했다 💪" : tag)
    : [];
  const savedPraiseDetails = record.praiseDetails && typeof record.praiseDetails === "object" && !Array.isArray(record.praiseDetails)
    ? record.praiseDetails
    : {};
  const normalizedPraiseDetails = {};
  praise.forEach((tag) => {
    const originalTag = tag === "이건 좀 잘했다 💪" ? "끝까지 해냈어 💪" : tag;
    const value = savedPraiseDetails[tag] ?? savedPraiseDetails[originalTag];
    if (typeof value === "string" && value.trim()) normalizedPraiseDetails[tag] = value;
  });
  if (!Object.keys(normalizedPraiseDetails).length && typeof record.praiseDetail === "string" && record.praiseDetail.trim() && praise.length) {
    normalizedPraiseDetails[praise[0]] = record.praiseDetail;
  }
  return {
    rating: typeof record.rating === "string" ? record.rating : "",
    activities: Array.isArray(record.activities) ? record.activities : [],
    body: [...new Set(body)],
    state: [...new Set(state)],
    praise,
    praiseDetails: normalizedPraiseDetails,
    note: typeof record.note === "string" ? record.note : "",
    legacyTags: Array.isArray(record.tags) ? record.tags : []
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date);
}

function shortDate(date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
}

function updateActiveDateUI() {
  const isToday = activeDateKey === todayKey;
  el.date.textContent = formatDate(activeDate);
  el.datePicker.value = activeDateKey;
  el.todayButton.disabled = isToday;
  el.save.textContent = isToday ? "오늘 기록 저장하기" : "이 날짜 기록 저장하기";
  el.remove.textContent = isToday ? "오늘 기록 삭제" : "이 날짜 기록 삭제";
}

function selectRecordDate(value) {
  if (!value || value > todayKey) return;
  activeDate = new Date(`${value}T12:00:00`);
  activeDateKey = value;
  updateActiveDateUI();
  loadActiveDate();
  showAllNews = false;
  renderNews();
  renderHistory();
}

function renderNews() {
  const archive = window.NEWS_ARCHIVE || {};
  const day = archive[activeDateKey];
  const items = Array.isArray(day?.items) ? day.items : [];
  el.newsList.innerHTML = "";
  el.newsCount.textContent = items.length ? `${items.length}건` : "";

  if (!items.length) {
    el.newsList.hidden = false;
    const empty = document.createElement("li");
    empty.className = "news-empty";
    empty.textContent = "이 날짜에 저장된 뉴스가 아직 없어요.";
    el.newsList.append(empty);
    el.newsMoreButton.hidden = true;
    return;
  }

  el.newsList.hidden = !showAllNews;
  items.forEach((item) => {
    const row = document.createElement("li");
    row.className = "news-item";
    const link = document.createElement("a");
    link.href = item.google_news_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title;
    row.append(link);
    el.newsList.append(row);
  });

  el.newsMoreButton.hidden = false;
  el.newsMoreButton.setAttribute("aria-expanded", String(showAllNews));
  el.newsMoreButton.textContent = showAllNews ? "접기 ⌃" : "펼쳐보기 ⌄";
}

async function loadLatestNews() {
  if (!/^https?:$/.test(window.location.protocol)) return;

  const hasTodayNews = Array.isArray(window.NEWS_ARCHIVE?.[todayKey]?.items);
  if (!hasTodayNews) el.newsCount.textContent = "불러오는 중";

  try {
    const response = await fetch(`/api/news?date=${todayKey}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`뉴스 API ${response.status}`);
    const news = await response.json();
    if (!news.date || !Array.isArray(news.items)) throw new Error("올바르지 않은 뉴스 데이터");

    window.NEWS_ARCHIVE = window.NEWS_ARCHIVE || {};
    window.NEWS_ARCHIVE[news.date] = {
      collected_at: news.collected_at,
      source: news.source,
      items: news.items
    };
    renderNews();
  } catch (error) {
    console.warn("자동 뉴스 업데이트를 건너뛰었습니다.", error);
    renderNews();
  }
}

function renderCategories() {
  categories.forEach((category) => {
    const card = el.template.content.cloneNode(true);
    const section = card.querySelector(".category-card");
    section.style.setProperty("--category", category.color);
    section.style.setProperty("--category-text", category.text);
    section.style.setProperty("--category-bg", category.bg);
    section.style.setProperty("--category-border", `${category.color}80`);
    card.querySelector("h3").textContent = category.name;
    card.querySelector(".category-hint").textContent = category.hint;
    const chipList = card.querySelector(".chip-list");
    category.tags.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-chip";
      button.textContent = tag;
      button.dataset.category = category.key;
      button.dataset.tag = tag;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => toggleTag(category, tag));
      chipList.append(button);
    });
    if (category.key === "praise") addPraiseDetailField(section);
    el.categories.append(card);
  });
}

function addPraiseDetailField(section) {
  praiseDetailsContainer = document.createElement("div");
  praiseDetailsContainer.className = "praise-details";
  praiseDetailsContainer.hidden = true;
  section.append(praiseDetailsContainer);
}

function toggleTag(category, tag) {
  if (category.mode === "single") {
    selected[category.key] = selected[category.key] === tag ? "" : tag;
  } else {
    selected[category.key].has(tag) ? selected[category.key].delete(tag) : selected[category.key].add(tag);
  }
  if (category.key === "praise" && selected.praise.size === 0) {
    praiseDetails = {};
  } else if (category.key === "praise" && !selected.praise.has(tag)) {
    delete praiseDetails[tag];
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  document.querySelectorAll(".tag-chip").forEach((chip) => {
    const category = categories.find((item) => item.key === chip.dataset.category);
    const isSelected = category.mode === "single"
      ? selected[category.key] === chip.dataset.tag
      : selected[category.key].has(chip.dataset.tag);
    chip.classList.toggle("selected", isSelected);
    chip.setAttribute("aria-pressed", String(isSelected));
  });
  renderPraiseDetailFields();
  const count = Number(Boolean(selected.rating)) + selected.activities.size + selected.state.size + selected.body.size + selected.praise.size;
  el.count.textContent = `${count}개 선택`;
}

function renderPraiseDetailFields() {
  praiseDetailsContainer.innerHTML = "";
  praiseDetailsContainer.hidden = selected.praise.size === 0;
  const praiseCategory = categories.find((category) => category.key === "praise");
  praiseCategory.tags.filter((tag) => selected.praise.has(tag)).forEach((tag, index) => {
    const item = document.createElement("div"); item.className = "praise-detail-item";
    const label = document.createElement("label"); label.htmlFor = `praiseDetail${index}`; label.textContent = tag;
    const row = document.createElement("div"); row.className = "praise-detail-row";
    const input = document.createElement("input");
    input.id = `praiseDetail${index}`;
    input.type = "text";
    input.maxLength = 40;
    input.placeholder = "짧게 남겨봐";
    input.value = praiseDetails[tag] || "";
    const count = document.createElement("span"); count.className = "praise-detail-count"; count.textContent = `${input.value.length} / 40`;
    input.addEventListener("input", () => {
      praiseDetails[tag] = input.value;
      count.textContent = `${input.value.length} / 40`;
    });
    row.append(input, count);
    item.append(label, row);
    praiseDetailsContainer.append(item);
  });
}

function saveActiveDate() {
  const records = getRecords();
  records[activeDateKey] = {
    rating: selected.rating,
    activities: [...selected.activities],
    body: [...selected.body],
    state: [...selected.state],
    praise: [...selected.praise],
    praiseDetails: Object.fromEntries([...selected.praise]
      .filter((tag) => praiseDetails[tag]?.trim())
      .map((tag) => [tag, praiseDetails[tag].trim()])),
    note: el.note.value.trim()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  const count = Number(Boolean(selected.rating)) + selected.activities.size + selected.state.size + selected.body.size + selected.praise.size;
  const dateLabel = activeDateKey === todayKey ? "오늘의 기록" : `${shortDate(activeDate)} 기록`;
  showStatus(count || el.note.value.trim() ? `${dateLabel}을 저장했어요!` : "빈 기록으로 저장했어요. 나중에 다시 채워도 괜찮아요.");
  renderHistory();
  renderStats(activeStatsDays);
}

function deleteActiveDate() {
  const records = getRecords();
  if (!(activeDateKey in records)) { showStatus("삭제할 기록이 아직 없어요."); return; }
  delete records[activeDateKey];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  selected = createEmptySelection();
  praiseDetails = {};
  el.note.value = "";
  updateSelectionUI();
  updateNoteCount();
  showStatus(`${shortDate(activeDate)} 기록을 삭제했어요.`);
  renderHistory();
  renderStats(activeStatsDays);
}

function loadActiveDate() {
  selected = createEmptySelection();
  praiseDetails = {};
  el.note.value = "";
  updateNoteCount();
  const saved = getRecords()[activeDateKey];
  if (saved) {
    const record = normalizeRecord(saved);
    selected = {
      rating: record.rating,
      activities: new Set(record.activities),
      body: new Set(record.body),
      state: new Set(record.state),
      praise: new Set(record.praise)
    };
    praiseDetails = { ...record.praiseDetails };
    el.note.value = record.note;
    updateNoteCount();
    showStatus(`저장된 ${shortDate(activeDate)} 기록을 불러왔어요.`);
  } else {
    showStatus(activeDateKey === todayKey ? "" : `${shortDate(activeDate)}의 새 기록을 작성해 보세요.`);
  }
  updateSelectionUI();
}

function renderHistory() {
  const records = getRecords();
  el.history.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = dateKey(date);
    const saved = records[key];
    const record = saved ? normalizeRecord(saved) : null;
    const tagGroups = record ? getTagGroups(record) : [];
    const detailGroups = tagGroups.filter((group) => group.label !== "오늘 어땠어?");
    const summaryTags = detailGroups.flatMap((group) => group.tags);
    const visibleSummaryTags = detailGroups.map((group) => group.tags[0]).slice(0, 4);
    const expandable = detailGroups.length > 0;
    const card = document.createElement("article");
    card.className = `history-card${key === todayKey ? " today" : ""}${key === activeDateKey ? " selected-date" : ""}${expandable ? " expandable" : ""}`;
    card.innerHTML = `
      <div class="history-date-row">
        <span class="history-date">${shortDate(date)}</span>
        <div class="history-date-actions">
          ${key === todayKey ? '<span class="today-badge">TODAY</span>' : ""}
          ${expandable ? '<span class="history-expand-hint">상세 보기 ⌄</span>' : ""}
        </div>
      </div>`;
    if (tagGroups.length) {
      const summary = document.createElement("div"); summary.className = "history-summary";
      if (record.rating) {
        const rating = document.createElement("span"); rating.className = "history-rating"; rating.textContent = record.rating;
        summary.append(rating);
      }
      if (summaryTags.length) {
        const summaryBox = document.createElement("div"); summaryBox.className = "history-summary-tags";
        visibleSummaryTags.forEach((tag) => {
          const item = document.createElement("span"); item.className = "history-summary-tag"; item.textContent = tag;
          summaryBox.append(item);
        });
        if (summaryTags.length > visibleSummaryTags.length) {
          const more = document.createElement("span"); more.className = "history-summary-tag history-more"; more.textContent = `+${summaryTags.length - visibleSummaryTags.length}`;
          summaryBox.append(more);
        }
        summary.append(summaryBox);
      }
      card.append(summary);

      const details = document.createElement("div"); details.className = "history-details"; details.hidden = true;
      detailGroups.forEach(({ label, tags }) => {
        const group = document.createElement("div"); group.className = "history-tag-group";
        const groupLabel = document.createElement("span"); groupLabel.className = "history-tag-label"; groupLabel.textContent = label;
        group.append(groupLabel);
        tags.forEach((tag) => { const item = document.createElement("span"); item.className = "history-tag"; item.textContent = tag; group.append(item); });
        details.append(group);
      });
      if (expandable) card.append(details);
    } else {
      const message = document.createElement("p"); message.className = "empty-record";
      message.textContent = record ? "선택한 태그가 없는 기록이에요." : "아직 기록이 없어요. 오늘을 가볍게 남겨 볼까요?";
      card.append(message);
    }
    if (record?.note) {
      const note = document.createElement("p"); note.className = "history-note"; note.textContent = `“${record.note}”`;
      card.append(note);
    }
    if (expandable) setupHistoryToggle(card);
    el.history.append(card);
  }
}

function setupHistoryToggle(card) {
  const details = card.querySelector(".history-details");
  const hint = card.querySelector(".history-expand-hint");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", "false");

  const toggle = () => {
    const expanded = card.getAttribute("aria-expanded") === "true";
    card.setAttribute("aria-expanded", String(!expanded));
    card.classList.toggle("expanded", !expanded);
    details.hidden = expanded;
    hint.textContent = expanded ? "상세 보기 ⌄" : "접기 ⌃";
  };

  card.addEventListener("click", toggle);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
}

function getTagGroups(record) {
  const groups = [
    { label: "오늘 어땠어?", tags: record.rating ? [record.rating] : [] },
    { label: "오늘 뭐 했어?", tags: record.activities },
    { label: "몸 상태", tags: record.body },
    { label: "오늘 나는", tags: record.state },
    { label: "칭찬", tags: record.praise.map((tag) => record.praiseDetails[tag] ? `${tag} — ${record.praiseDetails[tag]}` : tag) },
    { label: "이전 태그", tags: record.legacyTags }
  ];
  return groups.filter((group) => group.tags.length);
}

function switchView(view) {
  const showStats = view === "stats";
  el.recordView.hidden = showStats;
  el.statsView.hidden = !showStats;
  el.viewTabs.forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  if (showStats) renderStats(activeStatsDays);
}

function getRecordsForDays(days) {
  const records = getRecords();
  const entries = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = dateKey(date);
    if (Object.prototype.hasOwnProperty.call(records, key)) {
      entries.push({ key, date, record: normalizeRecord(records[key]) });
    }
  }
  return entries;
}

function getTopValue(values) {
  if (!values.length) return "아직 없음";
  const counts = values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function renderStats(days) {
  activeStatsDays = days;
  const entries = getRecordsForDays(days);
  const ratings = entries.map(({ record }) => record.rating).filter(Boolean);
  const activities = entries.flatMap(({ record }) => record.activities);
  const bodyTags = entries.flatMap(({ record }) => record.body);
  const praises = entries.flatMap(({ record }) => record.praise);

  el.recordedDays.textContent = `${entries.length}일`;
  el.recordRate.textContent = entries.length ? `${days}일 중 ${Math.round(entries.length / days * 100)}% 기록` : "오늘부터 시작해봐요";
  el.topRating.textContent = getTopValue(ratings);
  el.topActivity.textContent = getTopValue(activities);
  el.topBody.textContent = getTopValue(bodyTags);
  el.praiseCount.textContent = `${praises.length}번`;
  renderMoodChart(entries);
}

function renderMoodChart(entries) {
  const ratingScores = {
    "완전 좋았어 😍": 6,
    "좋았어 🙂": 5,
    "괜찮았어 😌": 4,
    "그냥 그랬어 😐": 3,
    "좀 힘들었어 😮‍💨": 2,
    "진짜 별로였어 🫠": 1
  };
  const ratedEntries = entries.filter(({ record }) => ratingScores[record.rating]);
  el.moodChart.innerHTML = "";
  el.chartEmpty.hidden = ratedEntries.length > 0;
  el.moodChart.hidden = ratedEntries.length === 0;

  ratedEntries.forEach(({ date, record }) => {
    const score = ratingScores[record.rating];
    const column = document.createElement("div"); column.className = "mood-column";
    column.title = `${shortDate(date)} · ${record.rating}`;
    const bar = document.createElement("span"); bar.className = "mood-bar"; bar.style.height = `${score * 17}px`;
    const label = document.createElement("span"); label.className = "mood-day"; label.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
    column.append(bar, label);
    el.moodChart.append(column);
  });
}

function createWeeklyReview() {
  const entries = getRecordsForDays(7);
  const ratings = entries.map(({ record }) => record.rating).filter(Boolean);
  const activities = entries.flatMap(({ record }) => record.activities);
  const bodyTags = entries.flatMap(({ record }) => record.body);
  const stateTags = entries.flatMap(({ record }) => record.state);
  const praises = entries.flatMap(({ record }) => record.praise);

  let summary = "아직 이번 주 기록이 없어요. 하루만 기록해도 회고를 만들 수 있어요.";
  let goodPoint = "기록을 시작하려는 마음부터 충분히 좋은 출발이에요.";
  let suggestion = "오늘의 기분 하나만 가볍게 남겨보세요.";

  if (entries.length) {
    const topRating = getTopValue(ratings);
    const topActivity = getTopValue(activities);
    summary = ratings.length
      ? `${entries.length}일을 기록했고, 가장 많았던 평가는 ‘${topRating}’였어요.`
      : `${entries.length}일의 기록이 쌓였어요. 다음에는 하루 평가도 함께 남겨보세요.`;
    goodPoint = praises.length
      ? `스스로 칭찬할 일을 ${praises.length}번 발견했어요. 작은 성취를 잘 알아봐 줬네요.`
      : topActivity !== "아직 없음"
        ? `‘${topActivity}’을 중심으로 하루를 꾸준히 보냈어요.`
        : "짧게라도 나의 하루를 돌아본 점이 좋았어요.";

    const tiredCount = bodyTags.filter((tag) => /피곤|잠이 부족|무거웠|아팠/.test(tag)).length;
    const heavyMindCount = stateTags.filter((tag) => /예민|답답|불안|우울/.test(tag)).length;
    if (tiredCount >= 2) suggestion = "다음 주에는 하루 한 번, 쉬는 시간을 먼저 일정에 넣어보세요.";
    else if (heavyMindCount >= 2) suggestion = "다음 주에는 마음이 복잡한 날 한 줄 메모로 생각을 내려놓아 보세요.";
    else if (!praises.length) suggestion = "다음 주에는 사소해도 나를 칭찬할 일 하나를 찾아보세요.";
    else suggestion = "지금의 흐름을 유지하면서 가장 편안했던 하루를 한 번 더 만들어보세요.";
  }

  renderReviewResult([
    { title: "이번 주", text: summary },
    { title: "잘한 점", text: goodPoint },
    { title: "다음 주 한 가지", text: suggestion }
  ]);
}

function renderReviewResult(lines) {
  el.reviewResult.innerHTML = "";
  lines.forEach(({ title, text }) => {
    const line = document.createElement("p"); line.className = "review-line";
    const heading = document.createElement("strong"); heading.textContent = `${title} · `;
    line.append(heading, document.createTextNode(text));
    el.reviewResult.append(line);
  });
  el.reviewResult.hidden = false;
}

function showStatus(message) {
  el.status.textContent = message;
}

function updateNoteCount() {
  el.noteCount.textContent = `${el.note.value.length} / 80`;
}

function setTheme(theme) {
  const dark = theme === "dark";
  document.body.classList.toggle("dark", dark);
  el.theme.querySelector("span").textContent = dark ? "☀" : "☾";
  el.theme.setAttribute("aria-label", dark ? "라이트 모드 켜기" : "다크 모드 켜기");
  localStorage.setItem(THEME_KEY, theme);
}

el.datePicker.max = todayKey;
el.datePicker.addEventListener("change", () => selectRecordDate(el.datePicker.value));
el.todayButton.addEventListener("click", () => selectRecordDate(todayKey));
el.save.addEventListener("click", saveActiveDate);
el.remove.addEventListener("click", deleteActiveDate);
el.note.addEventListener("input", updateNoteCount);
el.theme.addEventListener("click", () => setTheme(document.body.classList.contains("dark") ? "light" : "dark"));
el.viewTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
el.rangeButtons.forEach((button) => button.addEventListener("click", () => {
  el.rangeButtons.forEach((item) => item.classList.toggle("active", item === button));
  renderStats(Number(button.dataset.days));
}));
el.reviewButton.addEventListener("click", createWeeklyReview);
el.newsMoreButton.addEventListener("click", () => { showAllNews = !showAllNews; renderNews(); });

renderCategories();
setTheme(localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
updateActiveDateUI();
loadActiveDate();
renderNews();
loadLatestNews();
renderHistory();
renderStats(7);
