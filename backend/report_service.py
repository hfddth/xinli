from __future__ import annotations

import json
import os
import re
import sqlite3
import csv
import io
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


HOST = "127.0.0.1"
PORT = int(os.getenv("REPORT_SERVICE_PORT", "8000"))
MAX_BODY = 512_000
DB_PATH = os.getenv("REPORT_DB_PATH", "/var/lib/mind-explorer/responses.db")
NOTICE = "本报告为AI生成，仅供参考"

SYSTEM_PROMPT = """你是一名谨慎、温和的心理测评报告写作者。只输出 JSON，不要 Markdown。
报告不是医学意见。必须遵守：
1. 标签与评价只能中性或褒义，不得贬损、吓唬或给人定性。
2. 禁止使用：症状、障碍、疾病、诊断，以及任何同义的医学定性表达。
3. 因果关系只能使用“可能”“常见”“有时”“部分人可能”等不确定措辞。
4. 点评具体问题时，只能转述题目和用户原选项，不得据此推断性格或状态。
5. 维度偏高或偏低时使用“这通常反映”“这可能提示”等推测表达。
6. 维度偏高时要正常化感受，说明类似体验并不少见，不制造羞耻感。
7. 只依据提供的数据，不补充未出现的事实。
8. 必须包含固定说明：本报告为AI生成，仅供参考。

JSON 结构：
{
  "label": "生动易记的中性或褒义标签",
  "brief": "简短评估",
  "dimension_reports": [{"name":"维度","evaluation":"总体评价","specific_observations":["原题与原选项转述"]}],
  "situations": ["对学业、睡眠、关系或日常节奏的可能影响；没有证据则明确说未直接测量"],
  "strengths": ["数据中可见的客观长处与韧性"],
  "suggestions": ["不超过3条、具体且温和的可尝试步骤"],
  "profile_interpretation": "仅描述与AI相处方式的中性剖面解读，不作性格或状态定性",
  "reference_notice": "本报告为AI生成，仅供参考"
}
"""

REPLACEMENTS = {
    "症状": "体验线索",
    "障碍": "困扰",
    "疾病": "健康议题",
    "诊断": "定性判断",
    "导致": "可能带来",
    "造成": "有时可能带来",
    "证明": "可能提示",
    "说明你": "这可能反映你",
    "必然": "有时可能",
}


def connect_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    return connection


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with connect_db() as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS responses (
                id TEXT PRIMARY KEY,
                respondent_code TEXT NOT NULL UNIQUE,
                answers_json TEXT NOT NULL,
                scored_answers_json TEXT NOT NULL,
                model_result_json TEXT NOT NULL,
                personalized_report_json TEXT,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                started_at TEXT,
                completed_at TEXT,
                consent_version TEXT NOT NULL,
                consent_accepted_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)


def validate_submission(payload: dict) -> None:
    consent = payload.get("consent") or {}
    if consent.get("accepted") is not True:
        raise ValueError("storage consent is required")
    answers = payload.get("answers")
    if not isinstance(answers, list) or len(answers) != 26:
        raise ValueError("exactly 26 answers are required")
    for index, item in enumerate(answers, start=1):
        if item.get("id") != f"Q{index}" or item.get("answer") not in (1, 2, 3, 4, 5):
            raise ValueError("invalid answer data")
    code = str(payload.get("respondent_code", ""))
    if not re.fullmatch(r"ME-[A-Z0-9-]{8,40}", code):
        raise ValueError("invalid respondent code")


def save_submission(payload: dict) -> str:
    validate_submission(payload)
    now = datetime.now(timezone.utc).isoformat()
    record_id = uuid.uuid4().hex
    completed_at = str(payload.get("submitted_at") or now)[:80]
    values = (
        record_id,
        payload["respondent_code"],
        json.dumps(payload["answers"], ensure_ascii=False, separators=(",", ":")),
        "[]",
        "{}",
        None,
        0,
        None,
        completed_at,
        "answers-only-v1",
        None,
        now,
        now,
    )
    with connect_db() as connection:
        connection.execute("""
            INSERT INTO responses (
                id, respondent_code, answers_json, scored_answers_json,
                model_result_json, personalized_report_json, duration_seconds,
                started_at, completed_at, consent_version, consent_accepted_at,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(respondent_code) DO NOTHING
        """, values)
        row = connection.execute(
            "SELECT id FROM responses WHERE respondent_code = ?",
            (payload["respondent_code"],),
        ).fetchone()
    return row[0]


def parse_json_field(value, fallback):
    if value in (None, ""):
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def response_summary(row: sqlite3.Row) -> dict:
    answers = parse_json_field(row["answers_json"], [])
    return {
        "id": row["id"],
        "respondent_code": row["respondent_code"],
        "answer_count": len(answers),
        "completed_at": row["completed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_responses(limit: int = 200) -> dict:
    safe_limit = max(1, min(int(limit), 500))
    with connect_db() as connection:
        connection.row_factory = sqlite3.Row
        total = connection.execute("SELECT COUNT(*) FROM responses").fetchone()[0]
        today = connection.execute(
            "SELECT COUNT(*) FROM responses WHERE date(created_at) = date('now')"
        ).fetchone()[0]
        rows = connection.execute(
            """SELECT id, respondent_code, answers_json,
                      completed_at, created_at, updated_at
               FROM responses ORDER BY created_at DESC LIMIT ?""",
            (safe_limit,),
        ).fetchall()
    return {"total": total, "today": today, "records": [response_summary(row) for row in rows]}


def get_response(record_id: str) -> dict | None:
    if not re.fullmatch(r"[0-9a-f]{32}", record_id):
        return None
    with connect_db() as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute("SELECT * FROM responses WHERE id = ?", (record_id,)).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "respondent_code": row["respondent_code"],
        "answers": parse_json_field(row["answers_json"], []),
        "scored_answers": parse_json_field(row["scored_answers_json"], []),
        "model_result": parse_json_field(row["model_result_json"], {}),
        "personalized_report": parse_json_field(row["personalized_report_json"], None),
        "duration_seconds": row["duration_seconds"],
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
        "consent_version": row["consent_version"],
        "consent_accepted_at": row["consent_accepted_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def export_responses_csv() -> bytes:
    headers = [
        "记录编号", "匿名编号", "完成时间", "保存时间",
        *[f"Q{index}" for index in range(1, 27)],
    ]
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)
    with connect_db() as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute("SELECT * FROM responses ORDER BY created_at DESC").fetchall()
    for row in rows:
        answers = parse_json_field(row["answers_json"], [])
        answer_map = {item.get("id"): item.get("answer") for item in answers if isinstance(item, dict)}
        writer.writerow([
            row["id"], row["respondent_code"], row["completed_at"], row["created_at"],
            *[answer_map.get(f"Q{index}", "") for index in range(1, 27)],
        ])
    return ("\ufeff" + output.getvalue()).encode("utf-8")


def sanitize_text(value: str) -> str:
    text = str(value).strip()
    for source, target in REPLACEMENTS.items():
        text = text.replace(source, target)
    return text


def sanitize(value):
    if isinstance(value, str):
        return sanitize_text(value)
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize(item) for key, item in value.items()}
    return value


def fallback_report(payload: dict) -> dict:
    model = payload.get("model") or {}
    dimensions = model.get("dimensions") or []
    responses = payload.get("responses") or []
    sorted_dimensions = sorted(dimensions, key=lambda item: item.get("percentile", 0), reverse=True)
    strongest = sorted_dimensions[0] if sorted_dimensions else {"name": "自我观察", "percentile": 50}
    risk = model.get("risk") or {}

    if strongest.get("name") == "价值坚守" and strongest.get("percentile", 100) < 40:
        label = "价值锚点探索者"
    elif risk.get("highRisk"):
        label = "正在重整节奏的探索者"
    else:
        label = "稳步校准的探索者"

    brief = (
        "结果提示你近期可能更需要留意内在节奏与支持来源。类似体验在压力、变化或信息密集阶段并不少见，"
        "分数只用于帮助观察，不代表对个人作出定性判断。"
        if risk.get("highRisk")
        else "结果呈现出一组有高有低的个人倾向，可作为理解自己如何使用 AI、筛选信息和维持价值方向的线索。"
    )

    dimension_reports = []
    for dimension in dimensions:
        matching_responses = [
            item for item in responses if item.get("dimension") == dimension.get("name")
        ]
        observations = []
        for item in matching_responses[:2]:
            question = sanitize_text(item.get("text", ""))
            option = sanitize_text(item.get("optionTitle", ""))
            if question and option:
                observations.append(f"在“{question}”这一题上，你选择了“{option}”。")
        dimension_reports.append({
            "name": sanitize_text(dimension.get("name", "维度")),
            "evaluation": sanitize_text(dimension.get("note", "该结果可作为后续自我观察的线索。")),
            "specific_observations": observations,
        })

    strengths = []
    for dimension in sorted_dimensions:
        if dimension.get("name") == "价值坚守" and dimension.get("percentile", 100) < 50:
            strengths.append("你的作答反映出对个人价值与独特性的相对稳定确认。")
        elif dimension.get("name") == "认知替代" and dimension.get("percentile", 100) < 50:
            strengths.append("你的作答反映出一定的独立思考与判断空间。")
        if len(strengths) >= 2:
            break
    if not strengths:
        strengths.append("你愿意完成系统作答并查看反馈，本身体现了自我观察与调整意愿。")

    return {
        "label": label,
        "brief": brief,
        "dimension_reports": dimension_reports,
        "situations": [
            "问卷没有直接测量学业表现、睡眠时长或关系质量；部分人可能在压力较大时感到注意分配或作息节奏受到影响，建议结合自己的实际体验观察。"
        ],
        "strengths": strengths,
        "suggestions": [
            "可以从一个具体场景开始练习“先自己想，再请 AI 补充”。",
            "如果信息过密让你疲惫，可以为自己保留一段不接收推送的安静时间。",
            "有需要时，可尝试把部分感受带回可信任的现实关系中交流。",
        ],
        "profile_interpretation": (
            f"模型将本次作答归入“{sanitize_text((model.get('profile') or {}).get('name', '未命名剖面'))}”。"
            "这一归类只描述本次作答中呈现的与 AI 相处方式，不代表对个人作出固定判断。"
        ),
        "reference_notice": NOTICE,
    }


def parse_ai_json(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.I)
    result = json.loads(cleaned)
    if not isinstance(result, dict):
        raise ValueError("AI response is not an object")
    result["reference_notice"] = NOTICE
    return sanitize(result)


def call_ai(payload: dict) -> dict | None:
    api_key = os.getenv("AI_API_KEY", "").strip()
    model_name = os.getenv("AI_MODEL", "").strip()
    if not api_key or not model_name:
        return None
    base_url = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    safe_payload = {
        "model": payload.get("model", {}),
        "responses": payload.get("responses", []),
    }
    request_body = {
        "model": model_name,
        "temperature": 0.35,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(safe_payload, ensure_ascii=False)},
        ],
    }
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(request_body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        body = json.loads(response.read().decode("utf-8"))
    content = body["choices"][0]["message"]["content"]
    return parse_ai_json(content)


class Handler(BaseHTTPRequestHandler):
    server_version = "MindExplorerReport/1.0"

    def send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_bytes(self, status: int, data: bytes, content_type: str, filename: str | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            try:
                with connect_db() as connection:
                    connection.execute("SELECT 1 FROM responses LIMIT 1").fetchone()
                storage_ready = True
            except sqlite3.Error:
                storage_ready = False
            self.send_json(200, {
                "ok": True,
                "aiConfigured": bool(os.getenv("AI_API_KEY") and os.getenv("AI_MODEL")),
                "storageReady": storage_ready,
            })
            return
        if parsed.path == "/admin/responses":
            params = parse_qs(parsed.query)
            try:
                limit = int((params.get("limit") or ["200"])[0])
            except ValueError:
                limit = 200
            self.send_json(200, list_responses(limit))
            return
        match = re.fullmatch(r"/admin/responses/([0-9a-f]{32})", parsed.path)
        if match:
            record = get_response(match.group(1))
            if record is None:
                self.send_json(404, {"error": "not_found"})
            else:
                self.send_json(200, record)
            return
        if parsed.path == "/admin/export.csv":
            stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            self.send_bytes(200, export_responses_csv(), "text/csv; charset=utf-8", f"mind-explorer-{stamp}.csv")
            return
        self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path not in ("/ai-report", "/responses"):
            self.send_json(404, {"error": "not_found"})
            return
        payload = {}
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("invalid request size")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if self.path == "/responses":
                record_id = save_submission(payload)
                self.send_json(201, {"ok": True, "id": record_id})
                return
            report = call_ai(payload)
            source = "ai" if report else "rule_fallback"
            self.send_json(200, {"source": source, "report": report or fallback_report(payload)})
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": sanitize_text(str(error))})
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            fallback = fallback_report(payload if isinstance(payload, dict) else {})
            self.send_json(200, {"source": "rule_fallback", "report": fallback, "warning": "AI 服务暂时不可用，已显示安全的规则化报告。"})
        except sqlite3.Error:
            self.send_json(500, {"error": "storage_error"})

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    init_db()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
