const questions = window.MIND_EXPLORER_QUESTIONS || [];
const supabaseConfig = window.MIND_EXPLORER_SUPABASE_CONFIG || {};

if (!questions.length) {
  throw new Error("Question data failed to load.");
}

const scaleOptions = [
  { value: 1, title: "很不满意", detail: "" },
  { value: 2, title: "比较不满意", detail: "" },
  { value: 3, title: "中立", detail: "" },
  { value: 4, title: "比较满意", detail: "" },
  { value: 5, title: "很满意", detail: "" },
];

const storageKey = "mind-explorer-research-state";
const reportDescriptions = {
  "综合结果": {
    low: "你的整体得分偏低，表示当前对问卷所涉及内容的满意度或认同程度较弱。",
    mid: "你的整体得分处于中等水平，表示当前状态较为平衡，仍有进一步观察和调整空间。",
    high: "你的整体得分较高，表示你对问卷所涉及内容整体呈现较积极、稳定的回应。",
  },
};

const suggestionBank = {
  "综合结果": "建议结合具体题目回看自己的选择，找出得分较低或最有感触的部分，作为后续调整的起点。",
};

const strengthBank = {
  "综合结果": "你已经完成了对当前状态的系统梳理，这本身就是自我理解的重要一步。",
};

const personalityJudgments = {
  1: {
    name: "清醒掌舵者",
    profile: "AI稳健型",
    summary: "你会使用 AI 提升效率，同时通常保留自己的判断，在技术便利与自我主导之间保持平衡。",
  },
  2: {
    name: "高频共鸣者",
    profile: "AI共生型",
    summary: "你较常与 AI 协作，有时也会从互动中获得陪伴与支持，能够较快适应新的技术工具。",
  },
  3: {
    name: "边界拉扯者",
    profile: "AI矛盾型",
    summary: "你在借助 AI 提升效率的同时，也可能关注自主性与个人价值，正在形成更清晰的使用边界。",
  },
  4: {
    name: "独立守界者",
    profile: "AI免疫型",
    summary: "你对 AI 保持较清晰的边界，通常更依赖自身判断与节奏，不容易被外部推荐牵引。",
  },
};

const screens = {
  welcome: document.querySelector("#welcome-screen"),
  question: document.querySelector("#question-screen"),
  report: document.querySelector("#report-screen"),
};

const state = {
  currentIndex: 0,
  answers: Array(questions.length).fill(null),
  startedAt: null,
  completedAt: null,
  respondent: {
    code: "",
    name: "",
    email: "",
    note: "",
  },
  report: null,
  consent: false,
  submission: {
    status: "idle",
    message: "尚未提交。",
    responseId: "",
    lastAttemptAt: "",
  },
};

let reportRecoveryPromise = null;

const progressCard = document.querySelector("#progress-card");
const progressRing = document.querySelector("#progress-ring");
const progressCurrent = document.querySelector("#progress-current");
const progressTotal = document.querySelector("#progress-total");
const sidebarTotal = document.querySelector("#sidebar-total");
const configBanner = document.querySelector("#config-banner");
const startButton = document.querySelector("#start-button");
const storageConsent = document.querySelector("#storage-consent");
const questionSectionLabel = document.querySelector("#question-section-label");
const questionText = document.querySelector("#question-text");
const questionCountCurrent = document.querySelector("#question-count-current");
const questionCountTotal = document.querySelector("#question-count-total");
const optionsContainer = document.querySelector("#options-container");
const nextButton = document.querySelector("#next-button");
const prevButton = document.querySelector("#prev-button");
const reportTotalScore = document.querySelector("#report-total-score");
const reportScoreLabel = document.querySelector("#report-score-label");
const reportSummaryText = document.querySelector("#report-summary-text");
const reportSubmissionStatus = document.querySelector("#report-submission-status");
const reportResponseCode = document.querySelector("#report-response-code");
const dimensionReportList = document.querySelector("#dimension-report-list");
const submissionDetailText = document.querySelector("#submission-detail-text");
const restartButton = document.querySelector("#restart-button");
const aiReportButton = document.querySelector("#ai-report-button");
const modelReport = document.querySelector("#model-report");
const abilityRadar = document.querySelector("#ability-radar");
const personalityJudgmentType = document.querySelector("#personality-judgment-type");
const personalityJudgmentName = document.querySelector("#personality-judgment-name");
const personalityJudgmentSummary = document.querySelector("#personality-judgment-summary");
const modelMetrics = document.querySelector("#model-metrics");

sidebarTotal.textContent = String(questions.length);
questionCountTotal.textContent = String(questions.length);
progressTotal.textContent = `/ ${questions.length}`;

restoreState();
syncConnectionState();

if (!state.respondent.code) {
  state.respondent.code = generateRespondentCode();
}

storageConsent.checked = Boolean(state.consent);
startButton.disabled = !state.consent;
storageConsent.addEventListener("change", () => {
  state.consent = storageConsent.checked;
  startButton.disabled = !state.consent;
  persistState();
});

startButton.addEventListener("click", () => {
  if (!state.consent) return;
  if (!state.respondent.code) {
    state.respondent.code = generateRespondentCode();
  }
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString();
  }

  persistState();
  showQuestionScreen();
  renderQuestion();
});

prevButton.addEventListener("click", () => {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    renderQuestion();
    persistState();
  }
});

nextButton.addEventListener("click", async () => {
  if (state.answers[state.currentIndex] == null) {
    return;
  }

  if (state.currentIndex === questions.length - 1) {
    state.completedAt = new Date().toISOString();
    state.report = buildReport();
    showScreen("report");
    renderReport();
    persistState();
    await enrichReportWithModel();
    renderReport();
    persistState();
    await generatePersonalizedReport();
    await submitResponse();
    renderReport();
    persistState();
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
  persistState();
});

aiReportButton.addEventListener("click", (event) => {
  if (state.report?.ai?.status !== "success" || !state.report?.ai?.report) {
    event.preventDefault();
  }
});

restartButton.addEventListener("click", () => {
  const freshCode = generateRespondentCode();
  state.currentIndex = 0;
  state.answers = Array(questions.length).fill(null);
  state.startedAt = null;
  state.completedAt = null;
  state.respondent = {
    code: freshCode,
    name: "",
    email: "",
    note: "",
  };
  state.report = null;
  state.consent = false;
  storageConsent.checked = false;
  startButton.disabled = true;
  state.submission = {
    status: "idle",
    message: "尚未提交。",
    responseId: "",
    lastAttemptAt: "",
  };
  persistState();
  showScreen("welcome");
});

if (state.report) {
  progressCard.hidden = false;
  showScreen("report");
  renderReport();
  void recoverIncompleteReport();
} else if (state.answers.some((answer) => answer != null) || state.startedAt) {
  progressCard.hidden = false;
  showQuestionScreen();
  renderQuestion();
} else {
  showScreen("welcome");
}

function renderQuestion() {
  const question = questions[state.currentIndex];
  const currentAnswer = state.answers[state.currentIndex];
  const currentNumber = state.currentIndex + 1;
  const progress = Math.round((currentNumber / questions.length) * 360);

  questionSectionLabel.textContent = `QUESTION ${String(currentNumber).padStart(2, "0")}`;
  questionText.textContent = question.text;
  questionCountCurrent.textContent = String(currentNumber).padStart(2, "0");
  progressCurrent.textContent = String(currentNumber);
  progressRing.style.setProperty("--progress", `${progress}deg`);
  optionsContainer.innerHTML = "";
  const options = Array.isArray(question.options) && question.options.length
    ? question.options
    : scaleOptions;

  options.forEach((option, index) => {
    const optionValue = option.value ?? index + 1;
    const optionTitle = option.title || option.label || String(optionValue);
    const optionDetail = option.detail || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scale-option";
    if (currentAnswer === optionValue) {
      button.classList.add("is-selected");
    }
    button.innerHTML = `
      <div class="scale-option__left">
        <div class="scale-option__badge">${optionValue}</div>
        <div class="scale-option__content">
          <strong>${optionTitle}</strong>
          <span>${optionDetail}</span>
        </div>
      </div>
      <div class="scale-option__check">✓</div>
    `;
    button.addEventListener("click", () => {
      state.answers[state.currentIndex] = optionValue;
      renderQuestion();
      persistState();
    });
    optionsContainer.appendChild(button);
  });

  prevButton.disabled = state.currentIndex === 0;
  nextButton.disabled = currentAnswer == null;
  nextButton.innerHTML =
    state.currentIndex === questions.length - 1
      ? '完成并生成报告 <span>→</span>'
      : '下一题 <span>→</span>';
}

function buildReport() {
  const answeredQuestions = questions.map((question, index) => {
    const answer = state.answers[index];
    const dimension = question.dimension || "综合结果";
    const detail = question.detail || dimension;
    const reverse = Boolean(question.reverse);
    return {
      id: question.id,
      text: question.text,
      dimension,
      detail,
      reverse,
      answer,
      scoredAnswer: reverse ? 6 - answer : answer,
    };
  });

  const dimensionMap = new Map();
  const detailMap = new Map();

  answeredQuestions.forEach((item) => {
    aggregateScore(dimensionMap, item.dimension, item.scoredAnswer);
    aggregateScore(detailMap, item.detail, item.scoredAnswer);
  });

  const normalizedScores = {};
  const rawScores = {};
  const detailScores = {};

  Array.from(dimensionMap.entries()).forEach(([dimension, values]) => {
    rawScores[dimension] = roundToTwo(values.average);
    normalizedScores[dimension] = scaleToHundred(values.average);
  });

  Array.from(detailMap.entries()).forEach(([detail, values]) => {
    detailScores[detail] = scaleToHundred(values.average);
  });

  const totalAverage =
    answeredQuestions.reduce((sum, item) => sum + item.scoredAnswer, 0) / answeredQuestions.length;
  const totalScore = scaleToHundred(totalAverage);
  const rankedDimensions = Object.entries(normalizedScores).sort((left, right) => right[1] - left[1]);
  const lowDimensions = [...rankedDimensions].reverse().slice(0, 2);
  const highDimensions = rankedDimensions.slice(0, 2);

  return {
    totalScore,
    rawScores,
    normalizedScores,
    detailScores,
    answeredQuestions,
    durationSeconds: getDurationSeconds(),
    strengths: highDimensions.map(([dimension]) => strengthBank[dimension]),
    suggestions: lowDimensions.map(([dimension]) => suggestionBank[dimension]),
    summaryText: buildSummaryText(totalScore, rankedDimensions),
    model: null,
    modelStatus: "loading",
    modelError: "",
    ai: {
      status: "waiting",
      source: "",
      report: null,
      error: "",
    },
  };
}

function renderReport() {
  if (!state.report) {
    return;
  }

  progressCurrent.textContent = String(questions.length);
  progressRing.style.setProperty("--progress", "360deg");

  const modelResult = state.report.model;
  if (modelResult) {
    const averagePercentile = Math.round(
      modelResult.dimensions.reduce((sum, item) => sum + item.percentile, 0) /
        modelResult.dimensions.length,
    );
    reportTotalScore.textContent = String(averagePercentile);
    reportScoreLabel.textContent = "四维平均百分位 / 100";
    reportSummaryText.textContent = `你的四维平均百分位为 P${averagePercentile}。剖面结果为“${modelResult.profile.name}”。不同维度应分别理解，不用于给个人作定性判断。`;
  } else {
    reportTotalScore.textContent = state.report.modelStatus === "error" ? "--" : "…";
    reportScoreLabel.textContent = "模型综合观察 / 100";
    reportSummaryText.textContent = state.report.modelStatus === "error"
      ? "模型评分暂时未能完成，请下载作答数据后联系维护人员。"
      : "正在载入评分模型并计算常模百分位，请稍候。";
  }
  reportResponseCode.textContent = `受试者编号：${state.respondent.code} ｜ 用时：${formatDuration(state.report.durationSeconds)}`;
  reportSubmissionStatus.textContent = getSubmissionDisplayText();
  submissionDetailText.textContent = state.submission.message;
  const aiReady = state.report.ai?.status === "success" && state.report.ai?.report;
  const aiLoading = state.report.ai?.status === "loading";
  aiReportButton.classList.toggle("is-disabled", !aiReady);
  aiReportButton.setAttribute("aria-disabled", String(!aiReady));
  aiReportButton.tabIndex = aiReady ? 0 : -1;
  aiReportButton.textContent = aiReady
    ? "详细解读"
    : aiLoading
      ? "详细解读生成中…"
      : "详细解读暂不可用";

  dimensionReportList.innerHTML = "";
  const reportDimensions = modelResult
    ? modelResult.dimensions
    : Object.entries(state.report.normalizedScores).map(([name, percentile]) => ({
        name,
        percentile,
        theta: null,
        level: getLevelLabel(percentile),
        note: getDimensionDescription(name, percentile),
      }));
  reportDimensions.forEach((dimension) => {
    const score = dimension.percentile;
    const card = document.createElement("article");
    card.className = "report-dimension-card";
    card.innerHTML = `
      <div class="dimension-score-row">
        <div>
          <h3>${escapeHtml(displayDimensionName(dimension.name))}</h3>
          <p>${escapeHtml(dimension.level)}${dimension.theta == null ? "" : ` · 能力分数 θ ${dimension.theta.toFixed(3)}`}</p>
        </div>
        <strong>P${score}</strong>
      </div>
      ${dimension.theta == null ? "" : `<p class="theta-explanation">${escapeHtml(getThetaExplanation(dimension.theta))}</p>`}
      <div class="dimension-bar"><span style="width:${score}%"></span></div>
      <p class="dimension-note">${escapeHtml(dimension.note)}</p>
    `;
    dimensionReportList.appendChild(card);
  });

  renderModelReport(modelResult);
}

async function enrichReportWithModel() {
  if (!state.report || !window.MindExplorerModel) {
    if (state.report) {
      state.report.modelStatus = "error";
      state.report.modelError = "评分组件未加载";
    }
    return;
  }
  state.report.modelStatus = "loading";
  state.report.modelError = "";
  renderReport();
  persistState();
  try {
    let model;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        model = await window.MindExplorerModel.load();
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }
    if (!model) throw lastError || new Error("评分模型未能载入");
    const optionTitles = state.answers.map((answer, index) => getOptionTitle(questions[index], answer));
    state.report.model = window.MindExplorerModel.score(model, state.answers, optionTitles);
    state.report.modelStatus = "success";
    state.report.modelError = "";
  } catch (error) {
    state.report.modelStatus = "error";
    state.report.modelError = error.message;
  }
}

async function recoverIncompleteReport() {
  if (!state.report) return;
  if (reportRecoveryPromise) return reportRecoveryPromise;

  const needsModel = !state.report.model || state.report.modelStatus !== "success";
  const needsAi = state.report.ai?.status !== "success" || !state.report.ai?.report;
  if (!needsModel && !needsAi) return;

  reportRecoveryPromise = (async () => {
    let recoveredContent = false;
    if (needsModel) {
      await enrichReportWithModel();
      recoveredContent = Boolean(state.report?.model);
      renderReport();
      persistState();
    }

    if (state.report?.model && needsAi) {
      await generatePersonalizedReport();
      recoveredContent = true;
    }

    if (recoveredContent) {
      await submitResponse();
    }
    renderReport();
    persistState();
  })().finally(() => {
    reportRecoveryPromise = null;
  });

  return reportRecoveryPromise;
}

async function generatePersonalizedReport() {
  if (!state.report?.model) return;
  state.report.ai = { status: "loading", source: "", report: null, error: "" };
  renderReport();
  persistState();
  const responses = questions.map((question, index) => ({
    id: question.id,
    text: question.text,
    optionTitle: getOptionTitle(question, state.answers[index]),
    dimension: getModelDimensionForQuestion(index),
  }));
  try {
    const response = await fetch("./api/ai-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: state.report.model, responses }),
    });
    if (!response.ok) throw new Error(`报告服务返回 ${response.status}`);
    const result = await response.json();
    state.report.ai = {
      status: "success",
      source: result.source || "rule_fallback",
      report: result.report,
      error: result.warning || "",
    };
  } catch (error) {
    state.report.ai = { status: "error", source: "", report: null, error: error.message };
  }
  renderReport();
  persistState();
}

function renderModelReport(modelResult) {
  modelReport.hidden = !modelResult;
  if (!modelResult) return;
  const judgment = personalityJudgments[Number(modelResult.profile?.class)] || personalityJudgments[1];
  personalityJudgmentType.textContent = judgment.profile;
  personalityJudgmentName.textContent = judgment.name;
  personalityJudgmentSummary.textContent = judgment.summary;
  const performance = modelResult.performance || {};
  modelMetrics.textContent = `模型验证：剖面分类 F1 ${Number(performance.profile_f1_macro || 0).toFixed(3)}，空虚风险 AUC ${Number(performance.risk_auc || 0).toFixed(3)}；结果仅用于研究性参考。`;
  drawRadar(abilityRadar, modelResult.dimensions);
}

function drawRadar(canvas, dimensions) {
  if (!canvas || !dimensions?.length) return;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  const radius = Math.min(width, height) * 0.34;
  const count = dimensions.length;
  const pointAt = (index, scale) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    return [centerX + Math.cos(angle) * radius * scale, centerY + Math.sin(angle) * radius * scale];
  };
  context.clearRect(0, 0, width, height);
  context.font = "16px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let ring = 1; ring <= 4; ring += 1) {
    context.beginPath();
    for (let index = 0; index < count; index += 1) {
      const [x, y] = pointAt(index, ring / 4);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath();
    context.strokeStyle = "rgba(28, 63, 66, 0.18)";
    context.stroke();
  }
  dimensions.forEach((dimension, index) => {
    const [axisX, axisY] = pointAt(index, 1);
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(axisX, axisY);
    context.strokeStyle = "rgba(28, 63, 66, 0.15)";
    context.stroke();
    const [labelX, labelY] = pointAt(index, 1.18);
    context.fillStyle = "#173f40";
    if (dimension.name === "价值坚守") {
      context.fillText("价值坚守", labelX, labelY - 9);
      context.fillText(`（反向计分） P${dimension.percentile}`, labelX, labelY + 9);
    } else {
      context.fillText(`${displayDimensionName(dimension.name)} P${dimension.percentile}`, labelX, labelY);
    }
  });
  context.beginPath();
  dimensions.forEach((dimension, index) => {
    const [x, y] = pointAt(index, Math.max(0.02, dimension.percentile / 100));
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = "rgba(46, 139, 130, 0.22)";
  context.strokeStyle = "#2e8b82";
  context.lineWidth = 3;
  context.fill();
  context.stroke();
}

function getOptionTitle(question, answer) {
  const options = Array.isArray(question.options) && question.options.length ? question.options : scaleOptions;
  const option = options.find((item, index) => Number(item.value ?? index + 1) === Number(answer));
  return option?.title || option?.label || String(answer ?? "");
}

function getModelDimensionForQuestion(index) {
  if (index < 2) return "背景信息";
  if (index < 11) return "认知替代";
  if (index < 16) return "信息边界渗透";
  if (index < 22) return "情感依赖";
  return "价值坚守";
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

async function submitResponse() {
  if (!state.report) {
    return;
  }

  state.submission.status = "submitting";
  state.submission.message = "正在匿名保存到腾讯云，请稍候...";
  renderReport();

  const payload = buildSubmissionPayload();
  try {
    const response = await fetch("./api/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `服务器返回 ${response.status}`);
    }

    const result = await response.json();
    state.submission.status = "success";
    state.submission.lastAttemptAt = new Date().toISOString();
    state.submission.responseId = result.id || "";
    state.submission.message = state.submission.responseId
      ? `匿名结果已保存到腾讯云，记录编号：${state.submission.responseId}`
      : "匿名结果已保存到腾讯云。";
  } catch (error) {
    state.submission.status = "error";
    state.submission.lastAttemptAt = new Date().toISOString();
    state.submission.message = `保存失败：${error.message}`;
  }
}

function buildSubmissionPayload() {
  return {
    respondent_code: state.respondent.code,
    consent: {
      accepted: Boolean(state.consent),
      version: "anonymous-storage-v1",
      accepted_at: state.startedAt,
    },
    answers: state.answers.map((answer, index) => ({
      id: questions[index].id,
      answer,
    })),
    submitted_at: state.completedAt,
  };
}

function aggregateScore(map, key, value) {
  const previous = map.get(key) || { total: 0, count: 0, average: 0 };
  const total = previous.total + value;
  const count = previous.count + 1;
  map.set(key, {
    total,
    count,
    average: total / count,
  });
}

function scaleToHundred(averageValue) {
  return Math.round(((averageValue - 1) / 4) * 100);
}

function roundToTwo(number) {
  return Math.round(number * 100) / 100;
}

function getLevelLabel(score) {
  if (score >= 85) return "突出";
  if (score >= 70) return "良好";
  if (score >= 55) return "中等";
  if (score >= 40) return "偏低";
  return "需要关注";
}

function getDimensionDescription(dimension, score) {
  const bucket = reportDescriptions[dimension];
  if (!bucket) {
    return "该维度暂无预设描述。";
  }
  if (score >= 75) return bucket.high;
  if (score >= 50) return bucket.mid;
  return bucket.low;
}

function buildSummaryText(totalScore, rankedDimensions) {
  const topDimension = rankedDimensions[0]?.[0] || "整体状态";
  const totalLevel = getLevelLabel(totalScore);
  if (rankedDimensions.length === 1 && topDimension === "综合结果") {
    return `你的综合得分为 ${totalScore} 分，整体水平处于“${totalLevel}”。这份报告反映的是全部题目的综合作答情况，可作为自我观察与后续整理的参考。`;
  }
  return `你的综合得分为 ${totalScore} 分，整体水平处于“${totalLevel}”。当前优势更集中在“${topDimension}”，你已经展现出一定的自我理解与调节基础。`;
}

function getSubmissionDisplayText() {
  switch (state.submission.status) {
    case "success":
      return "结果已保存，报告可下载留存。";
    case "error":
      return "结果暂未在线保存，当前报告仍可下载留存。";
    case "skipped":
      return "报告已生成，可下载保存。";
    case "submitting":
      return "正在保存结果，请稍候。";
    default:
      return "结果已生成，等待提交。";
  }
}

function showQuestionScreen() {
  progressCard.hidden = false;
  showScreen("question");
}

function showScreen(target) {
  document.body.dataset.screen = target;
  Object.entries(screens).forEach(([name, element]) => {
    element.classList.toggle("screen--active", name === target);
  });
  window.scrollTo(0, 0);
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function restoreState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    state.currentIndex = Number.isInteger(parsed.currentIndex) ? parsed.currentIndex : 0;
    state.answers = Array.isArray(parsed.answers) && parsed.answers.length === questions.length
      ? parsed.answers
      : Array(questions.length).fill(null);
    if (state.currentIndex < 0 || state.currentIndex >= questions.length) {
      state.currentIndex = 0;
    }
    state.startedAt = parsed.startedAt || null;
    state.completedAt = parsed.completedAt || null;
    state.consent = Boolean(parsed.consent);
    state.respondent = {
      code: parsed.respondent?.code || "",
      name: parsed.respondent?.name || "",
      email: parsed.respondent?.email || "",
      note: parsed.respondent?.note || "",
    };
    state.report = parsed.report || null;
    state.submission = {
      status: parsed.submission?.status || "idle",
      message: parsed.submission?.message || "尚未提交。",
      responseId: parsed.submission?.responseId || "",
      lastAttemptAt: parsed.submission?.lastAttemptAt || "",
    };
  } catch (_error) {
    localStorage.removeItem(storageKey);
  }
}

function syncConnectionState() {
  configBanner.textContent = "作答前请确认你处于相对安静的环境，并尽量按照第一感受选择。";
}

function hasSupabaseConfig() {
  return Boolean(supabaseConfig.projectUrl && supabaseConfig.anonKey);
}

function generateRespondentCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ME-${datePart}-${timePart}-${randomPart}`;
}

function getDurationSeconds() {
  if (!state.startedAt || !state.completedAt) {
    return 0;
  }
  const start = new Date(state.startedAt).getTime();
  const end = new Date(state.completedAt).getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

function formatDuration(totalSeconds) {
  if (!totalSeconds) {
    return "未记录";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${seconds}秒`;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
