const recordsBody = document.querySelector("#admin-records");
const statusText = document.querySelector("#admin-status");
const searchInput = document.querySelector("#admin-search");
const detailDialog = document.querySelector("#admin-detail");
const detailContent = document.querySelector("#admin-detail-content");
let records = [];

document.querySelector("#refresh-admin").addEventListener("click", loadRecords);
document.querySelector("#close-detail").addEventListener("click", () => detailDialog.close());
searchInput.addEventListener("input", renderRecords);
recordsBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-record-id]");
  if (button) loadDetail(button.dataset.recordId);
});

loadRecords();
setInterval(loadRecords, 15000);

async function loadRecords() {
  statusText.textContent = "正在同步…";
  try {
    const response = await fetch("./api/admin/responses?limit=500", { cache: "no-store" });
    if (!response.ok) throw new Error(`服务器返回 ${response.status}`);
    const data = await response.json();
    records = data.records || [];
    document.querySelector("#total-count").textContent = data.total ?? 0;
    document.querySelector("#today-count").textContent = data.today ?? 0;
    document.querySelector("#last-sync").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    statusText.textContent = `已同步 ${records.length} 条最近记录`;
    renderRecords();
  } catch (error) {
    statusText.textContent = `读取失败：${error.message}`;
  }
}

function renderRecords() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = records.filter((record) =>
    !query || record.id.toLowerCase().includes(query) || record.respondent_code.toLowerCase().includes(query)
  );
  if (!filtered.length) {
    recordsBody.innerHTML = '<tr><td colspan="4">没有匹配的提交记录。</td></tr>';
    return;
  }
  recordsBody.innerHTML = filtered.map((record) => `
    <tr>
      <td>${escapeHtml(formatDate(record.completed_at || record.created_at))}</td>
      <td><code>${escapeHtml(record.respondent_code)}</code></td>
      <td>${Number(record.answer_count || 0)} 题</td>
      <td><button class="admin-detail-button" type="button" data-record-id="${record.id}">查看</button></td>
    </tr>`).join("");
}

async function loadDetail(recordId) {
  detailContent.innerHTML = "<p>正在加载详情…</p>";
  detailDialog.showModal();
  try {
    const response = await fetch(`./api/admin/responses/${encodeURIComponent(recordId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`服务器返回 ${response.status}`);
    renderDetail(await response.json());
  } catch (error) {
    detailContent.innerHTML = `<p>读取失败：${escapeHtml(error.message)}</p>`;
  }
}

function renderDetail(record) {
  const answers = record.answers || [];
  detailContent.innerHTML = `
    <section class="admin-detail-meta">
      <p><strong>记录编号：</strong><code>${escapeHtml(record.id)}</code></p>
      <p><strong>匿名编号：</strong><code>${escapeHtml(record.respondent_code)}</code></p>
      <p><strong>完成时间：</strong>${escapeHtml(formatDate(record.completed_at || record.created_at))}</p>
    </section>
    <h3>26 题原始作答</h3>
    <div class="admin-answer-grid">${answers.map((item) => `<span><b>${escapeHtml(item.id)}</b>${escapeHtml(item.answer)}</span>`).join("")}</div>`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
