# Mind Explorer 心理探索测评

本仓库保存腾讯云线上项目的可部署源码，包括：

- 问卷首页、26 道题目与作答逻辑
- 计分模型、四维结果、雷达图和风险提示
- AI 个体报告、详细解读与画像卡片
- Python 问卷保存/报告服务
- Nginx 与 systemd 部署配置
- 仅限服务器本机访问的问卷管理与导出页面

## 目录

- `index.html`、`app.js`、`styles.css`：问卷主站
- `data/`、`model/`、`model-runtime.js`：题目与评分模型
- `personal-report.*`、`ai-report.*`、`report-preview.*`：报告页面
- `assets/personality-cards/`：四类画像卡片
- `backend/`：Python 后端服务与环境变量示例
- `deploy/`：腾讯云 OpenCloudOS/Nginx/systemd 部署文件

## 数据与密钥

问卷作答属于敏感数据，不提交到 GitHub。线上 SQLite 数据库默认位于：

```text
/var/lib/mind-explorer/responses.db
```

仓库已通过 `.gitignore` 排除数据库、CSV 导出、日志、缓存和真实环境变量。配置 AI 服务时，请复制 `backend/ai.env.example` 到服务器安全位置并填写，禁止把真实 API Key 提交到仓库。

## 部署

服务器部署脚本位于 `deploy/install.sh`。部署前请检查：

1. 站点目录为 `/www/wwwroot/xinli`。
2. Python 服务文件安装到 `/opt/mind-explorer/report_service.py`。
3. 数据目录 `/var/lib/mind-explorer` 仅允许服务账户访问。
4. 公网仅开放普通 `/api/`；`/api/admin/` 和管理页只允许通过服务器本机端口 `8088` 访问。

生产数据应单独做加密备份，不应通过 Git 仓库同步。
