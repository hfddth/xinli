(function (root, factory) {
  const runtime = factory();
  if (typeof module === "object" && module.exports) module.exports = runtime;
  root.MindExplorerModel = runtime;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const DIMENSION_GUIDANCE = {
    theta_F1: {
      high: "这通常反映你更常把部分认知任务交给 AI 协助完成。",
      low: "这通常反映你较常保留独立思考与判断空间。",
    },
    theta_F2: {
      high: "这通常反映信息密度较高时，你有时更容易感到意义被稀释。",
      low: "这通常反映你较能从信息中保留对自己重要的内容。",
    },
    theta_F3: {
      high: "这通常反映你有时更愿意从 AI 互动中获得陪伴或情绪支持；这种需要很常见，并不意味着你存在缺陷。",
      low: "这通常反映你的情感支持来源可能较为分散。",
    },
    theta_F4: {
      high: "这通常反映你有时会在 AI 带来的比较中重新确认自身价值；这种波动并不少见，也不代表个人存在缺陷。",
      low: "这通常反映你目前较能保持对自身价值与独特性的确认。",
    },
  };

  let modelPromise;

  async function fetchModel(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`模型加载失败 (${response.status})`);
      return await response.json();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("模型加载超时，请检查网络后重试");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function load(url = "./model/web_model.json?v=report-recovery-20260822-1") {
    if (!modelPromise) {
      modelPromise = fetchModel(url).catch((error) => {
        modelPromise = null;
        throw error;
      });
    }
    return modelPromise;
  }

  function dot(left, right) {
    let total = 0;
    for (let i = 0; i < left.length; i += 1) total += left[i] * right[i];
    return total;
  }

  function standardize(values, mean, scale) {
    return values.map((value, index) => (value - mean[index]) / (scale[index] || 1));
  }

  function softmax(values) {
    const max = Math.max(...values);
    const exps = values.map((value) => Math.exp(value - max));
    const sum = exps.reduce((total, value) => total + value, 0);
    return exps.map((value) => value / sum);
  }

  function sigmoid(value) {
    if (value >= 0) return 1 / (1 + Math.exp(-value));
    const exp = Math.exp(value);
    return exp / (1 + exp);
  }

  function evaluateTree(node, features) {
    let current = node;
    while (Array.isArray(current)) {
      const [featureIndex, threshold, defaultLeft, leftChild, rightChild] = current;
      const value = features[featureIndex];
      const goLeft = value == null || Number.isNaN(value) ? defaultLeft : value <= threshold;
      current = goLeft ? leftChild : rightChild;
    }
    return Number(current || 0);
  }

  function predictTheta(model, itemAnswers) {
    const features = standardize(itemAnswers, model.theta.scaler_mean, model.theta.scaler_scale);
    return model.theta.coef.map(
      (coefficients, index) => dot(coefficients, features) + model.theta.intercept[index],
    );
  }

  function percentile(sortedValues, value) {
    let low = 0;
    let high = sortedValues.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (sortedValues[mid] <= value) low = mid + 1;
      else high = mid;
    }
    return Math.round((low / sortedValues.length) * 1000) / 10;
  }

  function percentileLevel(value) {
    if (value >= 90) return "极高";
    if (value >= 75) return "偏高";
    if (value >= 50) return "中等偏高";
    if (value >= 25) return "中等偏低";
    return "偏低";
  }

  function predictProfile(model, itemAnswers) {
    const features = standardize(
      itemAnswers,
      model.profile.scaler_mean,
      model.profile.scaler_scale,
    );
    const classCount = Number(model.profile.num_class || model.profile.classes.length);
    let rawScores;
    if (model.profile.model_type === "logistic_multinomial") {
      rawScores = model.profile.coef.map(
        (coefficients, index) => dot(coefficients, features) + model.profile.intercept[index],
      );
    } else {
      rawScores = Array(classCount).fill(0);
      model.profile.trees.forEach((tree, index) => {
        rawScores[index % classCount] += evaluateTree(tree, features);
      });
    }
    const probabilities = softmax(rawScores);
    let bestIndex = 0;
    probabilities.forEach((value, index) => {
      if (value > probabilities[bestIndex]) bestIndex = index;
    });
    const profileClass = Number(model.profile.classes[bestIndex]);
    return {
      class: profileClass,
      name: model.profiles[String(profileClass)] || `剖面 ${profileClass}`,
      confidence: probabilities[bestIndex],
      probabilities,
    };
  }

  function demoFeatures(columns, demo) {
    return columns.map((column) => {
      if (column.startsWith("Q7_")) return demo.Q7 === column.slice(3) ? 1 : 0;
      if (column.startsWith("Q8_")) return demo.Q8 === column.slice(3) ? 1 : 0;
      return 0;
    });
  }

  function predictRisk(model, itemAnswers, thetaValues, demo) {
    const raw = [
      ...itemAnswers,
      ...thetaValues,
      ...demoFeatures(model.risk.demo_columns, demo),
    ];
    const features = standardize(raw, model.risk.scaler_mean, model.risk.scaler_scale);
    const probability = sigmoid(dot(model.risk.coef, features) + model.risk.intercept);
    const screeningThreshold = Number(
      model.risk.screening_threshold ?? model.risk.decision_threshold,
    );
    const clinicalThreshold = Number(
      model.risk.clinical_threshold ?? model.risk.decision_threshold,
    );
    const screen = probability >= screeningThreshold;
    const clinic = probability >= clinicalThreshold;
    return {
      probability,
      decisionThreshold: screeningThreshold,
      screeningThreshold,
      clinicalThreshold,
      screen,
      clinic,
      highRisk: screen,
      level: clinic ? "建议进一步关注" : screen ? "建议二次确认" : "当前无显著提醒",
      thresholdName: model.risk.name,
    };
  }

  function score(model, answers, optionTitles) {
    if (!Array.isArray(answers) || answers.length !== 26) {
      throw new Error("模型需要完整的 26 题答案。");
    }
    const reverseIndices = new Set(model.reverse_input_indices || []);
    const itemAnswers = answers.slice(2).map((answer, index) => {
      const value = Number(answer);
      return reverseIndices.has(index) ? 6 - value : value;
    });
    const thetaValues = predictTheta(model, itemAnswers);
    const dimensions = model.dimensions.map((dimension, index) => {
      const theta = thetaValues[index];
      const pct = percentile(model.norms[dimension.key], theta);
      const guidance = DIMENSION_GUIDANCE[dimension.key];
      return {
        key: dimension.key,
        name: dimension.name,
        theta: Math.round(theta * 1000) / 1000,
        percentile: pct,
        level: percentileLevel(pct),
        note: pct >= 50 ? guidance.high : guidance.low,
      };
    });
    const demo = { Q7: optionTitles[0], Q8: optionTitles[1] };
    return {
      dimensions,
      profile: predictProfile(model, itemAnswers),
      risk: predictRisk(model, itemAnswers, thetaValues, demo),
      performance: model.performance,
      sample: model.sample,
      version: model.version,
    };
  }

  return { load, score, evaluateTree, softmax };
});
