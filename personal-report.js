const storageKey = "mind-explorer-research-state";
const questions = window.MIND_EXPLORER_QUESTIONS || [];

const profileCards = {
  1: {
    name: "清醒掌舵者", profile: "AI稳健型", symbol: "舵",
    image: "./assets/personality-cards/clear-headed-navigator.png?v=portrait-20260823-1",
    quote: "AI 可以帮我加速，但方向盘仍然在我手里。",
    traits: ["自主思考", "边界清晰", "工具使用", "价值稳定"],
    feature: "你会使用 AI 提升效率，但通常保留自己的判断，不轻易把思考、情绪和选择权交给 AI。",
    strength: "你能够区分“AI 在帮我”和“AI 在替我”，在技术便利与自我主导之间保持平衡。",
    advice: "继续保持“先自己想，再让 AI 辅助，最后自己判断”的节奏。",
    copy: "本次作答通常反映你会把 AI 放在工具位置，同时保留自主思考与现实联结。继续保持自己的判断节奏即可。",
  },
  2: {
    name: "高频共鸣者", profile: "AI共生型", symbol: "伴",
    image: "./assets/personality-cards/high-frequency-resonator.png?v=portrait-20260823-1",
    quote: "AI 不只是我的工具，它已经成为我生活中的一个固定位置。",
    traits: ["高频连接", "情绪共鸣", "AI陪伴", "深度融合"],
    feature: "你高频使用 AI，不只把它当作工具，有时也会把它作为陪伴与支持的对象。",
    strength: "你适应新技术较快，善于与 AI 协作，可能从中获得效率提升与情绪价值。",
    advice: "保持共生，同时为现实关系和自主判断保留空间，不让 AI 成为唯一答案或唯一听众。",
    copy: "本次作答通常反映 AI 较多参与你的思考、信息或情感活动。这种方式并不少见，可以继续为自主判断与现实联结保留空间。",
  },
  3: {
    name: "边界拉扯者", profile: "AI矛盾型", symbol: "岔",
    image: "./assets/personality-cards/boundary-tugger.png?v=portrait-20260823-1",
    quote: "我越来越依赖 AI，却也越来越想知道：真正的我在哪里？",
    traits: ["自我拉扯", "价值追问", "AI借力", "边界重建"],
    feature: "你一边借助 AI 提升效率，一边也在思考：当 AI 越来越强时，我的独特价值在哪里？",
    strength: "这种矛盾通常反映你已经开始觉察边界问题，自我反思可能成为重建方向感的重要起点。",
    advice: "不必急着证明比 AI 更强，可以先找到真正值得由自己完成、并愿意长期投入的事情。",
    copy: "本次作答通常反映你一边借助 AI，一边也在意自主性与个人价值。这样的拉扯可能正说明你在认真寻找更清晰的边界。",
  },
  4: {
    name: "独立守界者", profile: "AI免疫型", symbol: "盾",
    image: "./assets/personality-cards/independent-guardian.png?v=portrait-20260823-1",
    quote: "技术可以改变世界，但不必替我决定我是谁。",
    traits: ["独立判断", "边界稳定", "低受干扰", "自我节奏"],
    feature: "你对 AI 保持较强的边界感，不容易被推荐牵着走，平时更依赖自身判断与节奏。",
    strength: "独立自主、价值稳定，可能帮助你在复杂信息环境中保持清晰与克制。",
    advice: "保持边界，但不必筑墙。成熟的自主，也包括知道何时自己做、何时可以借力。",
    copy: "本次作答通常反映你对 AI 保持较清晰的自主边界。这份清醒是一项资源，也可以继续观察是否为现实联结留有足够空间。",
  },
};

let activePersonalityCard = null;
let activeRespondentCode = "";

const dimensionInfo = {
  "认知替代": "这一维度关注你是否习惯让 AI 代替自己完成思考、判断与选择。适度借力很常见，关键是仍为自己的思考保留空间。",
  "信息边界渗透": "这一维度关注推荐与信息流是否挤压了主动选择。信息丰富不一定等于意义充盈，保留主动筛选可能更有帮助。",
  "信息意义稀释": "这一维度关注海量信息中是否有意义感变淡的体验。信息丰富不一定等于意义充盈，保留主动筛选可能更有帮助。",
  "情感依赖": "这一维度关注你是否较多向 AI 寻求陪伴与回应。向 AI 表达并不少见，同时保留现实关系中的交流通常更有支持感。",
  "情感支持": "这一维度关注你是否较多向 AI 寻求陪伴与回应。向 AI 表达并不少见，同时保留现实关系中的交流通常更有支持感。",
  "价值坚守": "这一维度关注你在技术快速变化中，对自身价值与独特性的确认。价值感有时会波动，持续回看自己的选择和投入可能带来方向感。",
};

const defaultSuggestions = {
  "认知替代": "选择一个具体任务，练习先形成自己的初步答案，再请 AI 补充，最后由自己判断。",
  "信息边界渗透": "每天留出一小段不接收推荐信息的时间，主动选择一项真正想读或想做的内容。",
  "信息意义稀释": "每天留出一小段不接收推荐信息的时间，主动选择一项真正想读或想做的内容。",
  "情感依赖": "需要支持时，可以把一部分感受带回可信任的现实关系中交流。",
  "情感支持": "需要支持时，可以把一部分感受带回可信任的现实关系中交流。",
  "价值坚守": "记录三件由你亲自选择、愿意投入或觉得有意义的小事，逐步积累对自身价值的确认。",
};

function readState() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch (_error) {
    return null;
  }
}

function formatProbability(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "未提供";
}

function displayDimensionName(name) {
  return name === "价值坚守" ? "价值坚守（反向计分）" : name;
}

function getThetaExplanation(value) {
  const theta = Number(value);
  if (!Number.isFinite(theta)) return "";
  const distance = Math.abs(theta).toFixed(3);
  if (theta > 0.0005) return `θ 为 ${theta.toFixed(3)}，表示该维度能力分数高于平均水平 ${distance} 个标准差。`;
  if (theta < -0.0005) return `θ 为 ${theta.toFixed(3)}，表示该维度能力分数低于平均水平 ${distance} 个标准差。`;
  return `θ 为 ${theta.toFixed(3)}，表示该维度能力分数接近平均水平。`;
}

function getRiskDecision(risk, property, thresholdProperty) {
  if (typeof risk?.[property] === "boolean") return risk[property];
  const probability = Number(risk?.probability);
  const threshold = Number(risk?.[thresholdProperty]);
  return Number.isFinite(probability) && Number.isFinite(threshold) && probability >= threshold;
}

function renderRiskDecision(selector, isPositive) {
  const element = document.querySelector(selector);
  element.textContent = isPositive ? "高风险" : "低风险";
  element.dataset.result = isPositive ? "positive" : "negative";
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = [];
  let line = "";
  Array.from(String(text || "")).forEach((character) => {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawCanvasParagraph(context, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const lines = wrapCanvasText(context, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function drawPersonalityCard(card) {
  const canvas = document.querySelector("#personality-card-canvas");
  const context = canvas.getContext("2d");
  const navy = "#0b3767";
  const gold = "#d88912";
  const cream = "#fffaf2";
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#fffefa");
  background.addColorStop(1, "#fff5e7");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(216,137,18,.72)";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 30);
  context.stroke();

  context.fillStyle = navy;
  context.font = "600 48px 'Noto Serif SC', serif";
  context.fillText("Mind Explorer", 92, 112);
  context.fillStyle = gold;
  context.font = "28px 'Noto Serif SC', serif";
  context.fillText("AI时代心理探索计划", 94, 154);
  context.strokeStyle = gold;
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(42, 62, 38, 92, 14);
  context.stroke();
  context.beginPath();
  context.arc(61, 108, 10, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = gold;
  context.font = "26px 'Noto Serif SC', serif";
  context.fillText("SUMMARY REPORT", 64, 240);
  context.fillStyle = navy;
  context.font = "38px 'Noto Serif SC', serif";
  context.fillText("你的 AI 互动画像是", 64, 300);
  context.font = "600 82px 'Noto Serif SC', serif";
  context.fillText(card.name, 60, 400);
  context.fillStyle = gold;
  context.font = "42px 'Noto Serif SC', serif";
  context.fillText(card.profile, 64, 466);

  context.strokeStyle = "rgba(216,137,18,.38)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(870, 335, 132, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(870, 335, 94, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = cream;
  context.beginPath();
  context.arc(870, 335, 66, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = gold;
  context.stroke();
  context.fillStyle = gold;
  context.textAlign = "center";
  context.font = "600 64px 'Noto Serif SC', serif";
  context.fillText(card.symbol, 870, 358);
  context.textAlign = "left";

  context.fillStyle = navy;
  context.font = "30px 'Noto Serif SC', serif";
  context.fillText("“", 58, 548);
  context.font = "30px 'Noto Serif SC', serif";
  drawCanvasParagraph(context, card.quote, 96, 548, 870, 44, 2);

  const traitWidth = 220;
  card.traits.forEach((trait, index) => {
    const x = 62 + index * 244;
    context.fillStyle = "rgba(255,255,255,.68)";
    context.strokeStyle = "rgba(216,137,18,.34)";
    context.beginPath();
    context.roundRect(x, 635, traitWidth, 76, 16);
    context.fill();
    context.stroke();
    context.fillStyle = navy;
    context.textAlign = "center";
    context.font = "600 25px 'Noto Serif SC', serif";
    context.fillText(trait, x + traitWidth / 2, 682);
  });
  context.textAlign = "left";

  const panels = [
    ["你的特征", card.feature, "人"],
    ["你的优势", card.strength, "冠"],
    ["给你的建议", card.advice, "光"],
  ];
  panels.forEach(([title, copy, icon], index) => {
    const y = 752 + index * 220;
    context.fillStyle = "rgba(255,255,255,.7)";
    context.strokeStyle = "rgba(216,137,18,.28)";
    context.beginPath();
    context.roundRect(60, y, 960, 184, 20);
    context.fill();
    context.stroke();
    context.fillStyle = navy;
    context.beginPath();
    context.arc(124, y + 92, 42, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f2a718";
    context.textAlign = "center";
    context.font = "600 25px 'Noto Serif SC', serif";
    context.fillText(icon, 124, y + 101);
    context.textAlign = "left";
    context.fillStyle = navy;
    context.font = "600 31px 'Noto Serif SC', serif";
    context.fillText(title, 190, y + 67);
    context.font = "25px 'Noto Serif SC', serif";
    drawCanvasParagraph(context, copy, 390, y + 57, 585, 39, 3);
  });

  context.strokeStyle = gold;
  context.beginPath();
  context.moveTo(80, 1433);
  context.lineTo(360, 1433);
  context.moveTo(720, 1433);
  context.lineTo(1000, 1433);
  context.stroke();
  context.fillStyle = navy;
  context.textAlign = "center";
  context.font = "600 31px 'Noto Serif SC', serif";
  context.fillText("探索自我 · 理解未来", 540, 1445);
  context.font = "23px 'Noto Serif SC', serif";
  context.fillText("与 AI 共处，成长不迷失", 540, 1490);
  context.textAlign = "left";
  document.querySelector("#personality-card-image").src = canvas.toDataURL("image/png");
}

function levelAdvice(percentile, name) {
  const suggestion = defaultSuggestions[name] || "结合自己的真实体验，选择一个容易开始的小步骤进行观察。";
  if (percentile >= 90) return `本次结果处在较高区间。出现类似感受并不少见，也不说明个人存在缺陷。${suggestion}`;
  if (percentile >= 75) return `本次结果相对偏高，这通常提示该维度值得多留意。${suggestion}`;
  if (percentile >= 50) return `本次结果处在中等偏高区间，属于常见范围。${suggestion}`;
  if (percentile >= 25) return "本次结果处在中等偏低区间，通常反映你在这一维度保留了较多自主空间，可以继续保持。";
  return "本次结果处在较低区间，通常反映这一维度目前对你的影响较小，可作为现阶段的一项个人资源。";
}

function appendList(list, items) {
  list.innerHTML = "";
  items.filter(Boolean).forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
}

function optionTitle(question, answer) {
  const fallback = ["完全不符合", "比较不符合", "中立", "比较符合", "完全符合"];
  const options = Array.isArray(question?.options) && question.options.length ? question.options : fallback.map((title, index) => ({ value: index + 1, title }));
  const match = options.find((item, index) => Number(item.value ?? index + 1) === Number(answer));
  return match?.title || match?.label || fallback[Number(answer) - 1] || String(answer ?? "");
}

function drawRadar(canvas, dimensions) {
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 640;
  const height = Math.min(440, Math.max(340, width * 0.68));
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.height = `${height}px`;
  context.scale(ratio, ratio);
  const centerX = width / 2;
  const centerY = height / 2 + 6;
  const radius = Math.min(width, height) * 0.31;
  const angles = dimensions.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length);
  [0.25, 0.5, 0.75, 1].forEach((scale) => {
    context.beginPath();
    angles.forEach((angle, index) => {
      const x = centerX + Math.cos(angle) * radius * scale;
      const y = centerY + Math.sin(angle) * radius * scale;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.closePath();
    context.strokeStyle = "rgba(63, 94, 78, 0.18)";
    context.stroke();
  });
  angles.forEach((angle) => {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    context.strokeStyle = "rgba(63, 94, 78, 0.16)";
    context.stroke();
  });
  context.beginPath();
  dimensions.forEach((dimension, index) => {
    const value = Math.max(0, Math.min(100, Number(dimension.percentile))) / 100;
    const x = centerX + Math.cos(angles[index]) * radius * value;
    const y = centerY + Math.sin(angles[index]) * radius * value;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = "rgba(68, 112, 88, 0.2)";
  context.strokeStyle = "#3f7058";
  context.lineWidth = 2;
  context.fill();
  context.stroke();
  context.fillStyle = "#33473d";
  context.font = "600 14px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  dimensions.forEach((dimension, index) => {
    const x = centerX + Math.cos(angles[index]) * radius * 1.24;
    const y = centerY + Math.sin(angles[index]) * radius * 1.2;
    if (dimension.name === "价值坚守") {
      context.fillText("价值坚守", x, y - 9);
      context.fillText(`（反向计分） P${Math.round(dimension.percentile)}`, x, y + 9);
    } else {
      context.fillText(`${displayDimensionName(dimension.name)} P${Math.round(dimension.percentile)}`, x, y);
    }
  });
}

function render() {
  const state = readState();
  const model = state?.report?.model;
  if (!state?.report || !model?.dimensions?.length) {
    document.querySelector("#personal-report-empty").hidden = false;
    document.querySelector("#save-personal-report").disabled = true;
    return;
  }

  const reportElement = document.querySelector("#personal-report");
  reportElement.hidden = false;
  const card = profileCards[Number(model.profile?.class)] || profileCards[1];
  const average = Math.round(model.dimensions.reduce((sum, item) => sum + Number(item.percentile || 0), 0) / model.dimensions.length);
  const highest = [...model.dimensions].sort((left, right) => right.percentile - left.percentile)[0];
  document.querySelector("#personal-report-lead").textContent = `“${card.name}” · ${card.profile}`;
  document.querySelector("#personal-report-code").textContent = `报告编号：${state.respondent?.code || "未记录"}`;
  document.querySelector("#personal-report-date").textContent = `生成日期：${new Date(state.completedAt || Date.now()).toLocaleDateString("zh-CN")}`;
  document.querySelector("#personal-summary").textContent = `你的四维平均百分位为 P${average}，AI互动形态为“${model.profile?.name || card.profile}”。其中“${displayDimensionName(highest.name)}”的百分位相对较高。不同维度需要分别理解，结果仅反映本次作答。`;
  document.querySelector("#personal-risk-prob").textContent = formatProbability(model.risk?.probability);
  document.querySelector("#personal-risk-level").textContent = model.risk?.level || "研究性参考";
  document.querySelector("#personal-profile").textContent = model.profile?.name || card.profile;
  document.querySelector("#personal-personality").textContent = card.name;
  document.querySelector("#personal-risk-copy").textContent = `模型根据本次作答给出的研究性风险概率为 ${formatProbability(model.risk?.probability)}，当前提示为“${model.risk?.level || "研究性参考"}”。这只是一项筛查线索，不代表对个人的定性。`;
  renderRiskDecision("#personal-screening-result", getRiskDecision(model.risk, "screen", "screeningThreshold"));
  renderRiskDecision("#personal-higher-result", getRiskDecision(model.risk, "clinic", "clinicalThreshold"));
  document.querySelector("#personal-risk-advice").textContent = "如果结果进入较高关注区间，类似感受在压力、变化或信息密集时期并不少见。你可以先观察近期体验；如持续困扰，可以向可信任的人或具备资质的专业人员寻求支持。";

  const aiReport = state.report.ai?.report;
  const aiDimensions = Array.isArray(aiReport?.dimension_reports) ? aiReport.dimension_reports : [];
  const dimensionContainer = document.querySelector("#personal-dimensions");
  dimensionContainer.innerHTML = "";
  model.dimensions.forEach((dimension, index) => {
    const matched = aiDimensions.find((item) => item.name === dimension.name);
    const article = document.createElement("article");
    const scoreText = Number.isFinite(Number(dimension.theta)) ? `能力分数 θ ${Number(dimension.theta).toFixed(3)}` : "能力分数未提供";
    article.innerHTML = `<div class="preview-dimension__top"><span>F${index + 1}</span><div><h3></h3><p></p></div><strong>P${Math.round(dimension.percentile)}</strong></div><p class="theta-explanation"></p><div class="preview-meter"><i></i></div><p class="personal-dimension-intro"></p><p class="personal-dimension-advice"></p>`;
    article.querySelector("h3").textContent = displayDimensionName(dimension.name);
    article.querySelector(".preview-dimension__top p").textContent = `${scoreText} · ${dimension.level || "常模位置"}`;
    article.querySelector(".theta-explanation").textContent = getThetaExplanation(dimension.theta);
    article.querySelector(".preview-meter i").style.width = `${Math.max(2, Math.min(100, dimension.percentile))}%`;
    article.querySelector(".personal-dimension-intro").textContent = matched?.evaluation || dimension.note || dimensionInfo[dimension.name] || "这一维度需要结合具体作答与当前情境理解。";
    article.querySelector(".personal-dimension-advice").textContent = levelAdvice(Number(dimension.percentile), dimension.name);
    dimensionContainer.appendChild(article);
  });

  const observations = document.querySelector("#personal-observations");
  observations.innerHTML = "";
  const answered = (state.report.answeredQuestions || []).map((item, index) => ({ ...item, index })).filter((item) => item.index >= 2 && Number.isFinite(Number(item.answer)));
  answered.sort((left, right) => Math.abs(Number(right.answer) - 3) - Math.abs(Number(left.answer) - 3)).slice(0, 3).forEach((item) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = `你在“${item.text}”一题中选择了“${optionTitle(questions[item.index], item.answer)}”。`;
    observations.appendChild(paragraph);
  });

  document.querySelector("#personal-profile-symbol").textContent = card.symbol;
  document.querySelector("#personal-profile-title").textContent = `${card.name} · ${card.profile}`;
  document.querySelector("#personal-profile-copy").textContent = aiReport?.profile_interpretation || card.copy;
  activePersonalityCard = card;
  activeRespondentCode = state.respondent?.code || "mind-explorer";
  const supplements = document.querySelector("#personal-supplements");
  supplements.innerHTML = "";
  model.dimensions.forEach((dimension) => {
    const article = document.createElement("article");
    const heading = document.createElement("h3");
    const paragraph = document.createElement("p");
    heading.textContent = displayDimensionName(dimension.name);
    paragraph.textContent = dimensionInfo[dimension.name] || "该维度应结合具体作答和真实情境理解，不由单一分数作固定判断。";
    article.append(heading, paragraph);
    supplements.appendChild(article);
  });

  const lowest = [...model.dimensions].sort((left, right) => left.percentile - right.percentile)[0];
  const strengths = aiReport?.strengths?.length ? aiReport.strengths : [
    "你愿意完成本次测评并查看反馈，本身体现了自我观察与主动了解自己的意愿。",
    `在“${displayDimensionName(lowest.name)}”维度上，你的关注水平相对较低，这可能是现阶段可以依靠的一项个人资源。`,
  ];
  const suggestions = aiReport?.suggestions?.length ? aiReport.suggestions : [
    defaultSuggestions[highest.name] || "从一个容易开始的小步骤着手，观察它是否对你有帮助。",
    "把报告中最有共鸣的一点记下来，一周后再回看自己的实际感受是否变化。",
  ];
  appendList(document.querySelector("#personal-strengths"), strengths);
  appendList(document.querySelector("#personal-suggestions"), suggestions);
  drawRadar(document.querySelector("#personal-radar"), model.dimensions);
}

document.querySelector("#close-personal-report").addEventListener("click", () => {
  window.close();
  setTimeout(() => { if (!window.closed) window.location.href = "./index.html"; }, 120);
});
document.querySelector("#return-to-test").addEventListener("click", () => { window.location.href = "./index.html"; });
document.querySelector("#save-personal-report").addEventListener("click", () => { window.print(); });
document.querySelector("#view-personality-card").addEventListener("click", async () => {
  if (!activePersonalityCard) return;
  document.querySelector("#personality-card-image").src = activePersonalityCard.image;
  document.querySelector("#personality-card-dialog").showModal();
});
document.querySelector("#close-personality-card").addEventListener("click", () => {
  document.querySelector("#personality-card-dialog").close();
});
document.querySelector("#save-personality-card").addEventListener("click", () => {
  if (!activePersonalityCard) return;
  const cardImage = document.querySelector("#personality-card-image");
  const link = document.createElement("a");
  link.href = cardImage.src;
  link.download = `${activeRespondentCode}-${activePersonalityCard.name}-画像卡片.png`;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
});
window.addEventListener("resize", () => {
  const state = readState();
  if (state?.report?.model?.dimensions?.length) drawRadar(document.querySelector("#personal-radar"), state.report.model.dimensions);
});

render();
