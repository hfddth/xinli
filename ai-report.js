const storageKey = "mind-explorer-research-state";
const sourceElement = document.querySelector("#ai-reader-source");
const metaElement = document.querySelector("#ai-reader-meta");
const contentElement = document.querySelector("#ai-reader-content");
const emptyElement = document.querySelector("#ai-reader-empty");
const emptyCopyElement = document.querySelector("#ai-reader-empty-copy");
const saveButton = document.querySelector("#save-ai-report");

let currentState = null;

function displayDimensionName(name) {
  return name === "价值坚守" ? "价值坚守（反向计分）" : name;
}

const personalityCards = {
  1: {
    name: "清醒掌舵者",
    profile: "AI稳健型",
    symbol: "舵",
    quote: "AI 可以帮我加速，但方向盘仍然在我手里。",
    traits: ["自主思考", "边界清晰", "工具使用", "价值稳定"],
    feature: "你会使用 AI 提升效率，但通常保留自己的判断，不轻易把思考、情绪和选择权交给 AI。",
    strength: "你能够区分“AI 在帮我”和“AI 在替我”，在技术便利与自我主导之间保持平衡。",
    advice: "继续保持“先自己想，再让 AI 辅助，最后自己判断”的节奏。",
  },
  2: {
    name: "高频共鸣者",
    profile: "AI共生型",
    symbol: "伴",
    quote: "AI 不只是我的工具，它已经成为我生活中的一个固定位置。",
    traits: ["高频连接", "情绪共鸣", "AI陪伴", "深度融合"],
    feature: "你高频使用 AI，不只把它当作工具，有时也会把它作为陪伴与支持的对象。",
    strength: "你适应新技术较快，善于与 AI 协作，可能从中获得效率提升与情绪价值。",
    advice: "保持共生，同时为现实关系和自主判断保留空间，不让 AI 成为唯一答案或唯一听众。",
  },
  3: {
    name: "边界拉扯者",
    profile: "AI矛盾型",
    symbol: "岔",
    quote: "我越来越依赖 AI，却也越来越想知道：真正的我在哪里？",
    traits: ["自我拉扯", "价值追问", "AI借力", "边界重建"],
    feature: "你一边借助 AI 提升效率，一边也在思考：当 AI 越来越强时，我的独特价值在哪里？",
    strength: "这种矛盾通常反映你已经开始觉察边界问题，自我反思可能成为重建方向感的重要起点。",
    advice: "不必急着证明比 AI 更强，可以先找到真正值得由自己完成、并愿意长期投入的事情。",
  },
  4: {
    name: "独立守界者",
    profile: "AI免疫型",
    symbol: "盾",
    quote: "技术可以改变世界，但不必替我决定我是谁。",
    traits: ["独立判断", "边界稳定", "低受干扰", "自我节奏"],
    feature: "你对 AI 保持较强的边界感，不容易被推荐牵着走，平时更依赖自身判断与节奏。",
    strength: "独立自主、价值稳定，可能帮助你在复杂信息环境中保持清晰与克制。",
    advice: "保持边界，但不必筑墙。成熟的自主，也包括知道何时自己做、何时可以借力。",
  },
};

function readState() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch (_error) {
    return null;
  }
}

function appendSection(title, paragraphs = [], items = []) {
  if (!paragraphs.filter(Boolean).length && !items.filter(Boolean).length) return;
  const section = document.createElement("section");
  section.className = "ai-reader-section";
  const heading = document.createElement("h2");
  heading.textContent = title;
  section.appendChild(heading);
  paragraphs.filter(Boolean).forEach((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    section.appendChild(paragraph);
  });
  const validItems = items.filter(Boolean);
  if (validItems.length) {
    const list = document.createElement("ul");
    validItems.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
    section.appendChild(list);
  }
  contentElement.appendChild(section);
}

function showEmpty(message) {
  document.querySelector(".personality-card").hidden = true;
  contentElement.innerHTML = "";
  emptyElement.hidden = false;
  emptyCopyElement.textContent = message;
  saveButton.disabled = true;
}

function render() {
  currentState = readState();
  const ai = currentState?.report?.ai;
  if (!ai || ai.status !== "success" || !ai.report) {
    const message = ai?.status === "loading"
      ? "AI 个性化解读正在生成，请稍候，本页会自动更新。"
      : ai?.status === "error"
      ? `个性化解读暂未生成：${ai.error || "服务暂不可用"}`
      : "请先完成测评，报告生成后再从结果页进入。";
    showEmpty(message);
    return;
  }

  document.querySelector(".personality-card").hidden = false;
  emptyElement.hidden = true;
  saveButton.disabled = false;
  contentElement.innerHTML = "";
  const report = ai.report;
  sourceElement.textContent = ai.source === "ai" ? "AI 生成" : "安全规则报告";
  const profile = currentState.report.model?.profile;
  const card = personalityCards[Number(profile?.class)] || personalityCards[1];
  const cardElement = document.querySelector("#personality-card");
  cardElement.dataset.profile = String(Number(profile?.class) || 1);
  document.querySelector("#personality-name").textContent = card.name;
  document.querySelector("#personality-profile").textContent = card.profile;
  document.querySelector("#personality-symbol").textContent = card.symbol;
  document.querySelector("#personality-quote").textContent = card.quote;
  document.querySelector("#personality-feature").textContent = card.feature;
  document.querySelector("#personality-strength").textContent = card.strength;
  document.querySelector("#personality-advice").textContent = card.advice;
  const traitContainer = document.querySelector("#personality-traits");
  traitContainer.innerHTML = "";
  card.traits.forEach((trait) => {
    const item = document.createElement("span");
    item.textContent = trait;
    traitContainer.appendChild(item);
  });
  metaElement.textContent = [
    currentState.respondent?.code ? `报告编号：${currentState.respondent.code}` : "",
    profile?.name ? `剖面类别：${profile.name}` : "",
  ].filter(Boolean).join(" · ");

  (report.dimension_reports || []).forEach((dimension) => {
    appendSection(displayDimensionName(dimension.name), [dimension.evaluation], dimension.specific_observations || []);
  });
  appendSection("情境影响线索", [], report.situations || []);
  appendSection("客观优势与韧性", [], report.strengths || []);
  appendSection("可尝试的小步骤", [], report.suggestions || []);
  appendSection("空虚形态解读", [report.profile_interpretation], []);
}

window.addEventListener("storage", (event) => {
  if (event.key === storageKey) render();
});

const refreshTimer = window.setInterval(() => {
  const latest = readState();
  if (latest?.report?.ai?.status === "success" && latest.report.ai.report) {
    window.clearInterval(refreshTimer);
    render();
  }
}, 800);

function buildDownloadText() {
  const report = currentState.report.ai.report;
  const profile = currentState.report.model?.profile;
  const card = personalityCards[Number(profile?.class)] || personalityCards[1];
  const lines = [
    "AI 互动画像卡",
    card.name,
    card.profile,
    "",
    card.quote,
    `关键词：${card.traits.join("、")}`,
    "",
    `你的特征：${card.feature}`,
    `你的优势：${card.strength}`,
    `给你的建议：${card.advice}`,
    "",
    "AI 个性化解读",
    report.label || "个性化观察",
    report.brief || "",
  ];
  (report.dimension_reports || []).forEach((dimension) => {
    lines.push("", displayDimensionName(dimension.name), dimension.evaluation || "");
    (dimension.specific_observations || []).forEach((item) => lines.push(`- ${item}`));
  });
  [["情境影响线索", report.situations], ["客观优势与韧性", report.strengths], ["可尝试的小步骤", report.suggestions]].forEach(([title, items]) => {
    if (!items?.length) return;
    lines.push("", title);
    items.forEach((item) => lines.push(`- ${item}`));
  });
  if (report.profile_interpretation) lines.push("", "空虚形态解读", report.profile_interpretation);
  return lines.join("\n");
}

document.querySelector("#close-ai-report").addEventListener("click", () => {
  window.close();
  setTimeout(() => {
    if (!window.closed) window.location.href = "./index.html";
  }, 120);
});

document.querySelector("#return-to-test").addEventListener("click", () => {
  window.location.href = "./index.html";
});

saveButton.addEventListener("click", () => {
  if (!currentState?.report?.ai?.report) return;
  const blob = new Blob([buildDownloadText()], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${currentState.respondent?.code || "mind-explorer"}-AI个性化解读.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
});

render();
