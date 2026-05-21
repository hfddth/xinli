const supabaseConfig = window.MIND_EXPLORER_SUPABASE_CONFIG || {};

const form = document.querySelector("#admin-export-form");
const tokenInput = document.querySelector("#admin-token");
const formatSelect = document.querySelector("#export-format");
const statusText = document.querySelector("#admin-status-text");
const functionStatus = document.querySelector("#admin-function-status");
const previewEndpointButton = document.querySelector("#preview-endpoint-button");

if (supabaseConfig.projectUrl && supabaseConfig.exportFunctionName) {
  functionStatus.textContent = "已配置";
} else {
  functionStatus.textContent = "未配置";
}

previewEndpointButton.addEventListener("click", () => {
  if (!hasFunctionConfig()) {
    statusText.textContent = "当前未配置 projectUrl 或 exportFunctionName，请先填写 supabase-config.js。";
    return;
  }
  statusText.textContent = `导出接口：${getFunctionUrl()}`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!hasFunctionConfig()) {
    statusText.textContent = "当前还没有配置 Supabase 导出接口。";
    return;
  }

  const adminToken = tokenInput.value.trim();
  if (!adminToken) {
    statusText.textContent = "请输入管理员导出令牌。";
    return;
  }

  const format = formatSelect.value;
  statusText.textContent = "正在请求导出文件，请稍候...";

  try {
    const response = await fetch(getFunctionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.anonKey || "",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify({ format }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Export failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const extension = format === "json" ? "json" : "csv";
    const fileName = `mind-explorer-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extension}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    statusText.textContent = `导出成功，文件名：${fileName}`;
  } catch (error) {
    statusText.textContent = `导出失败：${error.message}`;
  }
});

function hasFunctionConfig() {
  return Boolean(supabaseConfig.projectUrl && supabaseConfig.exportFunctionName);
}

function getFunctionUrl() {
  return `${supabaseConfig.projectUrl.replace(/\/+$/, "")}/functions/v1/${supabaseConfig.exportFunctionName}`;
}
