"use strict";

const STORAGE_KEYS = {
  statuses: "readertemplate:statuses",
  lastPoint: "readertemplate:last-point"
};

const STATUS_OPTIONS = ["未理解", "半懂", "已掌握"];

const state = {
  points: [],
  selectedId: null,
  savedStatuses: loadSavedStatuses()
};

const courseTitle = document.querySelector("#course-title");
const chapterList = document.querySelector("#chapter-list");
const content = document.querySelector("#content");
const meta = document.querySelector("#knowledge-meta");
const statusButtons = document.querySelector("#status-buttons");

initialize();

async function initialize() {
  content.replaceChildren(makeElement("p", "loading-message", "正在载入知识内容…"));

  try {
    const response = await fetch("data/reader.json");
    if (!response.ok) throw new Error(`无法读取数据文件（${response.status}）`);

    const data = await response.json();
    state.points = data.knowledgePoints;
    courseTitle.textContent = data.course;

    if (!Array.isArray(state.points)) {
      throw new Error("数据文件中的 knowledgePoints 格式错误。");
    }

    if (state.points.length === 0) {
      chapterList.replaceChildren();
      content.replaceChildren(
        makeElement("p", "loading-message", "阅读器还是空的。把标准 Markdown 放进 inbox，然后重新启动即可。")
      );
      meta.replaceChildren();
      statusButtons.replaceChildren();
      return;
    }

    const rememberedId = localStorage.getItem(STORAGE_KEYS.lastPoint);
    state.selectedId = state.points.some((point) => point.id === rememberedId)
      ? rememberedId
      : state.points[0].id;

    renderDirectory();
    renderCurrentPoint();
  } catch (error) {
    content.replaceChildren(
      makeElement("p", "error-message", `阅读器无法启动：${error.message} 请通过 start.bat 打开。`)
    );
  }
}

function loadSavedStatuses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.statuses)) || {};
  } catch {
    return {};
  }
}

function getCurrentPoint() {
  return state.points.find((point) => point.id === state.selectedId);
}

function getStatus(point) {
  return state.savedStatuses[point.id] || point.status;
}

function renderDirectory() {
  const chapters = new Map();
  state.points.forEach((point) => {
    if (!chapters.has(point.chapter)) chapters.set(point.chapter, []);
    chapters.get(point.chapter).push(point);
  });

  chapterList.replaceChildren();
  chapters.forEach((points, chapter) => {
    const group = document.createElement("section");
    group.className = "chapter-group";
    group.append(makeElement("h2", "chapter-title", chapter));

    const list = document.createElement("ol");
    list.className = "point-list";
    points.forEach((point, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "point-button";
      button.type = "button";
      button.dataset.id = point.id;
      button.setAttribute("aria-current", String(point.id === state.selectedId));

      const order = makeElement("span", "point-index", String(index + 1).padStart(2, "0"));
      button.append(order, document.createTextNode(point.title));
      button.addEventListener("click", () => selectPoint(point.id));
      item.append(button);
      list.append(item);
    });

    group.append(list);
    chapterList.append(group);
  });
}

function selectPoint(id) {
  state.selectedId = id;
  localStorage.setItem(STORAGE_KEYS.lastPoint, id);
  renderDirectory();
  renderCurrentPoint();
}

function renderCurrentPoint() {
  const point = getCurrentPoint();
  if (!point) return;

  content.replaceChildren();
  content.append(makeElement("h2", "knowledge-title", point.title));

  const sections = [
    ["①", "教材原意", point.textbook, ""],
    ["②", "我的理解", point.myUnderstanding, "knowledge-section--understanding"],
    ["③", "为什么", point.why, ""],
    ["④", "例子", point.example, ""],
    ["⑤", "易错点", point.mistakes, ""]
  ];

  sections.forEach(([number, label, value, modifier]) => {
    const section = document.createElement("section");
    section.className = `knowledge-section ${modifier}`.trim();
    const heading = document.createElement("h3");
    heading.className = "section-label";
    heading.append(makeElement("span", "section-number", number), document.createTextNode(label));
    const sectionBody = document.createElement("div");
sectionBody.className = "section-text";

const rawText = value || "待整理";

const mathBlocks = [];
const protectedText = rawText.replace(
  /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g,
  (match) => {
    const token = `@@MATH_${mathBlocks.length}@@`;
    mathBlocks.push(match);
    return token;
  }
);

let html = marked.parse(protectedText);

mathBlocks.forEach((math, index) => {
  html = html.replace(`@@MATH_${index}@@`, math);
});

sectionBody.innerHTML = html;

section.append(
  heading,
  sectionBody
);

renderMathInElement(sectionBody, {
  delimiters: [
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false }
  ],
  throwOnError: false
});
    content.append(section);
  });

  const mastery = document.createElement("section");
  mastery.className = "knowledge-section";
  mastery.append(makeSectionHeading("⑥", "掌握状态"));
  const statusLine = makeElement("p", "mastery-line", getStatus(point));
  statusLine.dataset.status = getStatus(point);
  statusLine.prepend(makeElement("span", "mastery-dot", ""));
  mastery.append(statusLine);
  content.append(mastery);

  renderMeta(point);
  renderStatusButtons(point);
}

function makeSectionHeading(number, label) {
  const heading = document.createElement("h3");
  heading.className = "section-label";
  heading.append(makeElement("span", "section-number", number), document.createTextNode(label));
  return heading;
}

function renderMeta(point) {
  const entries = [
    ["所属课程", point.course],
    ["所属章节", point.chapter],
    ["页码", point.page],
    ["掌握状态", getStatus(point)],
    ["最近修改时间", point.updated],
    ["标签", point.tags.join(" · ")]
  ];

  meta.replaceChildren();
  entries.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.append(makeElement("dt", "", label));
    const definition = makeElement("dd", label === "标签" ? "tag-list" : "", value);
    row.append(definition);
    meta.append(row);
  });
}

function renderStatusButtons(point) {
  statusButtons.replaceChildren();
  STATUS_OPTIONS.forEach((status) => {
    const button = makeElement("button", "status-button", status);
    button.type = "button";
    button.dataset.status = status;
    button.classList.toggle("is-active", status === getStatus(point));
    button.setAttribute("aria-pressed", String(status === getStatus(point)));
    button.addEventListener("click", () => updateStatus(point.id, status));
    statusButtons.append(button);
  });
}

function updateStatus(id, status) {
  state.savedStatuses[id] = status;
  localStorage.setItem(STORAGE_KEYS.statuses, JSON.stringify(state.savedStatuses));
  renderCurrentPoint();
}

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
