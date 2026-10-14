const sampleAnswers = [
  4, 4,
  2, 3, 2, 3, 2, 3, 2, 2, 3,
  3, 3, 2, 3, 2,
  2, 3, 2, 3, 2, 2,
  4, 4, 5, 4,
];

const sampleOptionTitles = sampleAnswers.map((value, index) => {
  if (index < 2) return ["很不满意", "比较不满意", "中立", "比较满意", "很满意"][value - 1];
  return ["完全不符合", "比较不符合", "中立", "比较符合", "完全符合"][value - 1];
});

const profileCopy = {
  1: "“AI稳健型”通常反映本次作答中，AI更多被放在工具位置。你可能较能保留自主思考与现实联结；这一归类只描述一般使用方式。",
  2: "“AI共生型”通常反映本次作答中，AI较多参与思考、信息和情感活动。这样的使用方式并不少见，可以继续留意自主空间与现实联结的平衡。",
  3: "“AI矛盾型”通常反映本次作答中，一方面会借助AI完成任务，另一方面也在意人的独特价值。矛盾有时正体现了对自我方向的重视。",
  4: "“AI免疫型”通常反映本次作答中，对AI保持较强自主边界。保持清醒是一种资源，也可以继续观察是否给现实联结留有足够空间。",
};

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
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

function renderRiskDecision(selector, isPositive) {
  const element = document.querySelector(selector);
  element.textContent = isPositive ? "高风险" : "低风险";
  element.dataset.result = isPositive ? "positive" : "negative";
}

function drawRadar(canvas, dimensions) {
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 440;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  const radius = Math.min(width, height) * 0.32;
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
    const value = Math.max(0, Math.min(100, dimension.percentile)) / 100;
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

async function renderPreview() {
  try {
    const model = await window.MindExplorerModel.load();
    const result = window.MindExplorerModel.score(model, sampleAnswers, sampleOptionTitles);
    const average = Math.round(result.dimensions.reduce((sum, item) => sum + item.percentile, 0) / 4);
    document.querySelector("#preview-summary").textContent = `本次示例的四维平均百分位为 P${average}，空虚形态归入“${result.profile.name}”。各维度需要分别理解，结果不用于给个人作固定判断。`;
    document.querySelector("#preview-risk-prob").textContent = formatPercent(result.risk.probability);
    document.querySelector("#preview-risk-level").textContent = result.risk.level;
    document.querySelector("#preview-profile").textContent = result.profile.name;
    document.querySelector("#preview-risk-copy").textContent = `示例作答的空虚风险概率为 ${formatPercent(result.risk.probability)}，当前提示为“${result.risk.level}”。如果分数进入关注区间，类似感受在压力、变化或信息密集阶段并不少见，不代表个人存在缺陷。`;
    renderRiskDecision("#preview-screening-result", Boolean(result.risk.screen));
    renderRiskDecision("#preview-higher-result", Boolean(result.risk.clinic));
    document.querySelector("#preview-profile-title").textContent = result.profile.name;
    document.querySelector("#preview-profile-copy").textContent = profileCopy[result.profile.class] || "这一归类仅描述本次作答中呈现的与AI相处方式。";

    const dimensionContainer = document.querySelector("#preview-dimensions");
    dimensionContainer.innerHTML = "";
    result.dimensions.forEach((dimension, index) => {
      const article = document.createElement("article");
      article.innerHTML = `<div class="preview-dimension__top"><span>F${index + 1}</span><div><h3>${displayDimensionName(dimension.name)}</h3><p>能力分数 θ ${dimension.theta.toFixed(3)}</p></div><strong>P${Math.round(dimension.percentile)}</strong></div><p class="theta-explanation">${getThetaExplanation(dimension.theta)}</p><div class="preview-meter"><i style="width:${Math.max(2, dimension.percentile)}%"></i></div><p>${dimension.level}：${dimension.note}</p>`;
      dimensionContainer.appendChild(article);
    });
    const lowDimension = [...result.dimensions].sort((a, b) => a.percentile - b.percentile)[0];
    document.querySelector("#preview-strength").textContent = `在“${displayDimensionName(lowDimension.name)}”维度上，示例作答处于相对较低的关注水平，可作为当前可依靠的个人资源之一。`;
    drawRadar(document.querySelector("#preview-radar"), result.dimensions);
  } catch (error) {
    document.querySelector("#preview-summary").textContent = `模型预览暂时无法加载：${error.message}`;
  }
}

renderPreview();
