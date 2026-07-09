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
  submission: {
    status: "idle",
    message: "尚未提交。",
    responseId: "",
    lastAttemptAt: "",
  },
};

const progressCard = document.querySelector("#progress-card");
const progressRing = document.querySelector("#progress-ring");
const progressCurrent = document.querySelector("#progress-current");
const progressTotal = document.querySelector("#progress-total");
const sidebarTotal = document.querySelector("#sidebar-total");
const configBanner = document.querySelector("#config-banner");
const startButton = document.querySelector("#start-button");
const questionSectionLabel = document.querySelector("#question-section-label");
const questionText = document.querySelector("#question-text");
const questionCountCurrent = document.querySelector("#question-count-current");
const questionCountTotal = document.querySelector("#question-count-total");
const optionsContainer = document.querySelector("#options-container");
const nextButton = document.querySelector("#next-button");
const prevButton = document.querySelector("#prev-button");
const reportTotalScore = document.querySelector("#report-total-score");
const reportSummaryText = document.querySelector("#report-summary-text");
const reportSubmissionStatus = document.querySelector("#report-submission-status");
const reportResponseCode = document.querySelector("#report-response-code");
const dimensionReportList = document.querySelector("#dimension-report-list");
const strengthList = document.querySelector("#strength-list");
const suggestionList = document.querySelector("#suggestion-list");
const submissionDetailText = document.querySelector("#submission-detail-text");
const retrySubmitButton = document.querySelector("#retry-submit-button");
const downloadReportButton = document.querySelector("#download-report-button");
const restartButton = document.querySelector("#restart-button");

sidebarTotal.textContent = String(questions.length);
questionCountTotal.textContent = String(questions.length);
progressTotal.textContent = `/ ${questions.length}`;

restoreState();
syncConnectionState();

if (!state.respondent.code) {
  state.respondent.code = generateRespondentCode();
}

startButton.addEventListener("click", () => {
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
    await submitResponse();
    renderReport();
    persistState();
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
  persistState();
});

retrySubmitButton.addEventListener("click", async () => {
  retrySubmitButton.disabled = true;
  await submitResponse();
  renderReport();
  persistState();
  retrySubmitButton.disabled = false;
});

downloadReportButton.addEventListener("click", () => {
  if (!state.report) {
    return;
  }
  const payload = {
    respondent: state.respondent,
    report: state.report,
    submission: state.submission,
  };
  downloadJson(payload, `${state.respondent.code || "mind-explorer"}-report.json`);
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
  };
}

function renderReport() {
  if (!state.report) {
    return;
  }

  progressCurrent.textContent = String(questions.length);
  progressRing.style.setProperty("--progress", "360deg");

  reportTotalScore.textContent = String(state.report.totalScore);
  reportSummaryText.textContent = state.report.summaryText;
  reportResponseCode.textContent = `受试者编号：${state.respondent.code} ｜ 用时：${formatDuration(state.report.durationSeconds)}`;
  reportSubmissionStatus.textContent = getSubmissionDisplayText();
  submissionDetailText.textContent = state.submission.message;

  dimensionReportList.innerHTML = "";
  Object.entries(state.report.normalizedScores).forEach(([dimension, score]) => {
    const card = document.createElement("article");
    card.className = "report-dimension-card";
    card.innerHTML = `
      <div class="dimension-score-row">
        <div>
          <h3>${dimension}</h3>
          <p>${getLevelLabel(score)}</p>
        </div>
        <strong>${score}</strong>
      </div>
      <div class="dimension-bar"><span style="width:${score}%"></span></div>
      <p class="dimension-note">${getDimensionDescription(dimension, score)}</p>
    `;
    dimensionReportList.appendChild(card);
  });

  strengthList.innerHTML = "";
  state.report.strengths.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    strengthList.appendChild(li);
  });

  suggestionList.innerHTML = "";
  state.report.suggestions.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    suggestionList.appendChild(li);
  });

  retrySubmitButton.hidden = !hasSupabaseConfig() || state.submission.status !== "error";
}

async function submitResponse() {
  if (!state.report) {
    return;
  }

  if (!hasSupabaseConfig()) {
    state.submission.status = "skipped";
    state.submission.message = "报告已生成，可下载保存。";
    state.submission.lastAttemptAt = new Date().toISOString();
    return;
  }

  state.submission.status = "submitting";
  state.submission.message = "正在保存结果，请稍候...";
  renderReport();

  const payload = buildSubmissionPayload();
  try {
    const response = await fetch(`${stripTrailingSlash(supabaseConfig.projectUrl)}/rest/v1/questionnaire_responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Supabase returned ${response.status}`);
    }

    const result = await response.json();
    state.submission.status = "success";
    state.submission.lastAttemptAt = new Date().toISOString();
    state.submission.responseId = result?.[0]?.id || "";
    state.submission.message = state.submission.responseId
      ? `结果已保存，记录编号：${state.submission.responseId}`
      : "结果已保存。";
  } catch (error) {
    state.submission.status = "error";
    state.submission.lastAttemptAt = new Date().toISOString();
    state.submission.message = `保存失败：${error.message}`;
  }
}

function buildSubmissionPayload() {
  return {
    respondent_code: state.respondent.code,
    participant_name: state.respondent.name || null,
    participant_email: state.respondent.email || null,
    participant_note: state.respondent.note || null,
    answers: state.answers.map((answer, index) => ({
      id: questions[index].id,
      answer,
    })),
    scored_answers: state.report.answeredQuestions.map((item) => ({
      id: item.id,
      answer: item.answer,
      scored_answer: item.scoredAnswer,
    })),
    raw_scores: state.report.rawScores,
    normalized_scores: state.report.normalizedScores,
    detail_scores: state.report.detailScores,
    total_score: state.report.totalScore,
    reverse_count: state.report.answeredQuestions.filter((item) => item.reverse).length,
    duration_seconds: state.report.durationSeconds,
    submitted_at: state.completedAt,
    client_meta: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      started_at: state.startedAt,
      completed_at: state.completedAt,
      version: "research-supabase-v1",
    },
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

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
