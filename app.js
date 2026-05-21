const questions = window.MIND_EXPLORER_QUESTIONS || [];
const supabaseConfig = window.MIND_EXPLORER_SUPABASE_CONFIG || {};

if (!questions.length) {
  throw new Error("Question data failed to load.");
}

const scaleOptions = [
  { value: 1, title: "完全不符合", detail: "与你的真实情况基本不一致" },
  { value: 2, title: "比较不符合", detail: "只有少部分时候会出现" },
  { value: 3, title: "不确定", detail: "介于两者之间，难以明确判断" },
  { value: 4, title: "比较符合", detail: "大多数时候与你的状态相近" },
  { value: 5, title: "完全符合", detail: "非常贴近你的真实感受" },
];

const storageKey = "mind-explorer-research-state";
const reportDescriptions = {
  "AI依赖": {
    low: "你对 AI 的依赖度较低，更倾向于依靠现实支持系统与自身判断。",
    mid: "你会在部分情境下依赖 AI，但整体仍保有一定的自主决策空间。",
    high: "你对 AI 的功能性或情感性依赖较高，建议留意现实关系与自我判断的平衡。",
  },
  "信息自主性": {
    low: "你在信息筛选与自主判断上容易受到外界干扰，建议训练辨别与整合能力。",
    mid: "你具备一定信息自主性，但在复杂环境中仍可能出现摇摆。",
    high: "你在信息筛选、自主判断与观点建立上表现稳定，具备较强的信息掌控感。",
  },
  "存在主义生死观念": {
    low: "你在生命意义、有限性与存在思考上可能仍较模糊，适合进一步探索自我价值感。",
    mid: "你对生死与存在议题有一定思考，但整体尚处于整理与建构阶段。",
    high: "你对生命意义与存在命题有较强的反思能力，能将其转化为自我理解资源。",
  },
  "未来方向": {
    low: "你在未来规划与方向感上可能存在较多不确定，建议从小目标开始重建掌控感。",
    mid: "你对未来有一定设想，但仍需要更稳定的行动路径与意义感支撑。",
    high: "你在未来方向、行动意义与个人独特性整合上较有优势，具备良好的发展潜力。",
  },
};

const suggestionBank = {
  "AI依赖": "尝试把一部分情绪支持与决策过程重新带回现实关系或纸笔整理中。",
  "信息自主性": "建立自己的信息筛选规则，例如记录来源、延迟判断、核对证据。",
  "存在主义生死观念": "用写作、阅读或谈话方式整理你对生命有限性和价值感的理解。",
  "未来方向": "把长期不确定拆成更小的可执行目标，逐步积累方向感与行动反馈。",
};

const strengthBank = {
  "AI依赖": "你在与技术工具的互动上保持了一定自我觉察。",
  "信息自主性": "你具备主动筛选信息与形成个人判断的基础能力。",
  "存在主义生死观念": "你愿意面对深层议题，这有助于形成更稳定的自我整合。",
  "未来方向": "你对未来保持关注，并具备把经验转化为成长线索的潜力。",
};

const screens = {
  welcome: document.querySelector("#welcome-screen"),
  profile: document.querySelector("#profile-screen"),
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
const dbStatusText = document.querySelector("#db-status-text");
const connectionPill = document.querySelector("#connection-pill");
const configBanner = document.querySelector("#config-banner");
const startButton = document.querySelector("#start-button");
const profileBackButton = document.querySelector("#profile-back-button");
const profileForm = document.querySelector("#profile-form");
const respondentCodeInput = document.querySelector("#respondent-code");
const participantNameInput = document.querySelector("#participant-name");
const participantEmailInput = document.querySelector("#participant-email");
const participantNoteInput = document.querySelector("#participant-note");
const consentCheckbox = document.querySelector("#consent-checkbox");
const questionSectionLabel = document.querySelector("#question-section-label");
const questionText = document.querySelector("#question-text");
const questionCountCurrent = document.querySelector("#question-count-current");
const questionCountTotal = document.querySelector("#question-count-total");
const optionsContainer = document.querySelector("#options-container");
const dimensionTag = document.querySelector("#dimension-tag");
const dimensionSubtag = document.querySelector("#dimension-subtag");
const reverseTag = document.querySelector("#reverse-tag");
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

hydrateProfileForm();

startButton.addEventListener("click", () => {
  showScreen("profile");
});

profileBackButton.addEventListener("click", () => {
  showScreen("welcome");
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.respondent.code = respondentCodeInput.value.trim();
  state.respondent.name = participantNameInput.value.trim();
  state.respondent.email = participantEmailInput.value.trim();
  state.respondent.note = participantNoteInput.value.trim();

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
  consentCheckbox.checked = false;
  hydrateProfileForm();
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
  dimensionTag.textContent = question.dimension;
  dimensionSubtag.textContent = question.detail;
  reverseTag.textContent = question.reverse ? "含反向计分" : "正向计分";

  optionsContainer.innerHTML = "";
  scaleOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scale-option";
    if (currentAnswer === option.value) {
      button.classList.add("is-selected");
    }
    button.innerHTML = `
      <div class="scale-option__left">
        <div class="scale-option__badge">${option.value}</div>
        <div class="scale-option__content">
          <strong>${option.title}</strong>
          <span>${option.detail}</span>
        </div>
      </div>
      <div class="scale-option__check">✓</div>
    `;
    button.addEventListener("click", () => {
      state.answers[state.currentIndex] = option.value;
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
    return {
      id: question.id,
      text: question.text,
      dimension: question.dimension,
      detail: question.detail,
      reverse: question.reverse,
      answer,
      scoredAnswer: question.reverse ? 6 - answer : answer,
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

  retrySubmitButton.hidden = hasSupabaseConfig() && state.submission.status === "success";
}

async function submitResponse() {
  if (!state.report) {
    return;
  }

  if (!hasSupabaseConfig()) {
    state.submission.status = "skipped";
    state.submission.message = "当前未填写 Supabase 配置，报告已生成，但没有写入数据库。";
    state.submission.lastAttemptAt = new Date().toISOString();
    return;
  }

  state.submission.status = "submitting";
  state.submission.message = "正在提交到 Supabase，请稍候...";
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
      ? `已成功写入数据库，记录 ID：${state.submission.responseId}`
      : "已成功写入数据库。";
  } catch (error) {
    state.submission.status = "error";
    state.submission.lastAttemptAt = new Date().toISOString();
    state.submission.message = `提交失败：${error.message}`;
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
  return `你的综合得分为 ${totalScore} 分，整体水平处于“${totalLevel}”。当前优势更集中在“${topDimension}”，你已经展现出一定的自我理解与调节基础。`;
}

function getSubmissionDisplayText() {
  switch (state.submission.status) {
    case "success":
      return "数据库提交成功，结果已完成在线收集。";
    case "error":
      return "数据库提交失败，当前仅保留本地报告。";
    case "skipped":
      return "当前为演示模式，报告未写入数据库。";
    case "submitting":
      return "正在提交数据，请稍候。";
    default:
      return "结果已生成，等待提交。";
  }
}

function showQuestionScreen() {
  progressCard.hidden = false;
  showScreen("question");
}

function showScreen(target) {
  Object.entries(screens).forEach(([name, element]) => {
    element.classList.toggle("screen--active", name === target);
  });
}

function hydrateProfileForm() {
  respondentCodeInput.value = state.respondent.code;
  participantNameInput.value = state.respondent.name;
  participantEmailInput.value = state.respondent.email;
  participantNoteInput.value = state.respondent.note;
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
  if (hasSupabaseConfig()) {
    dbStatusText.textContent = "已配置";
    connectionPill.textContent = "Supabase 在线收数模式";
    configBanner.textContent = "已检测到 Supabase 配置，作答完成后会尝试写入数据库。";
  } else {
    dbStatusText.textContent = "未连接";
    connectionPill.textContent = "离线演示模式";
    configBanner.textContent = "当前还没有填写 Supabase 配置，问卷仍可演示，但不会真正写入数据库。";
  }
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
