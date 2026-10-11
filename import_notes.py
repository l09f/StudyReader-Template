from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "reader.json"
INBOX = ROOT / "inbox"
ARCHIVE = ROOT / "archive"
BACKUPS = ROOT / "backups"

SECTION_TO_FIELD = {
    "教材原意": "textbook",
    "我的理解": "myUnderstanding",
    "为什么": "why",
    "例子": "example",
    "易错点": "mistakes",
    "掌握状态": "status",
}
META_TO_FIELD = {
    "所属课程": "course",
    "所属章节": "chapter",
    "页码": "page",
    "标签": "tags",
}
REQUIRED_HEADINGS = list(META_TO_FIELD) + list(SECTION_TO_FIELD)
STATUS_OPTIONS = {"未理解", "半懂", "已掌握"}


def normalize_text(value: str) -> str:
    return value.strip().replace("\r\n", "\n").replace("\r", "\n")


def parse_markdown(path: Path) -> dict:
    text = path.read_text(encoding="utf-8-sig")
    lines = text.splitlines()

    title = None
    sections: dict[str, list[str]] = {}
    current = None

    for raw in lines:
        line = raw.rstrip()

        if title is None:
            match = re.match(r"^#\s+(.+?)\s*$", line)
            if match:
                title = match.group(1).strip()
                continue

        match = re.match(r"^##\s+(.+?)\s*$", line)
        if match:
            current = match.group(1).strip()
            sections.setdefault(current, [])
            continue

        if current is not None:
            sections[current].append(raw)

    if not title:
        raise ValueError("缺少一级标题：请使用 '# 知识点标题'。")

    missing = [name for name in REQUIRED_HEADINGS if name not in sections]
    if missing:
        raise ValueError("缺少固定模块：" + "、".join(missing))

    values = {
        name: normalize_text("\n".join(sections[name]))
        for name in REQUIRED_HEADINGS
    }

    for meta_name in ("所属课程", "所属章节"):
        if not values[meta_name]:
            raise ValueError(f"{meta_name}不能为空。")

    status = values["掌握状态"]
    if status not in STATUS_OPTIONS:
        raise ValueError("掌握状态只能是：未理解 / 半懂 / 已掌握。")

    tags = [
        item.strip()
        for item in re.split(r"[，,、；;]+", values["标签"])
        if item.strip()
    ]

    return {
        "course": values["所属课程"],
        "chapter": values["所属章节"],
        "title": title,
        "page": values["页码"] or "待整理",
        "textbook": values["教材原意"] or "待整理",
        "myUnderstanding": values["我的理解"] or "待整理",
        "why": values["为什么"] or "待整理",
        "example": values["例子"] or "待整理",
        "mistakes": values["易错点"] or "待整理",
        "status": status,
        "tags": tags,
        "updated": datetime.now().strftime("%Y-%m-%d"),
    }


def next_id(points: list[dict]) -> str:
    max_num = 0
    for point in points:
        match = re.fullmatch(r"item-(\d+)", str(point.get("id", "")))
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"item-{max_num + 1:03d}"


def find_existing(points: list[dict], incoming: dict) -> dict | None:
    for point in points:
        if (
            point.get("course") == incoming["course"]
            and point.get("chapter") == incoming["chapter"]
            and point.get("title") == incoming["title"]
        ):
            return point
    return None


def unique_archive_path(src: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = ARCHIVE / f"{stamp}_{src.name}"
    counter = 2
    while target.exists():
        target = ARCHIVE / f"{stamp}_{counter}_{src.name}"
        counter += 1
    return target


def main() -> int:
    INBOX.mkdir(exist_ok=True)
    ARCHIVE.mkdir(exist_ok=True)
    BACKUPS.mkdir(exist_ok=True)

    files = sorted(INBOX.glob("*.md"))
    if not files:
        print("[ReaderTemplate] inbox 中没有待导入的 Markdown。")
        return 0

    data = json.loads(DATA_FILE.read_text(encoding="utf-8-sig"))
    points = data.setdefault("knowledgePoints", [])
    if not isinstance(points, list):
        raise RuntimeError("data/reader.json 中的 knowledgePoints 必须是数组。")

    parsed: list[tuple[Path, dict]] = []
    errors: list[str] = []

    for path in files:
        try:
            parsed.append((path, parse_markdown(path)))
        except Exception as exc:
            errors.append(f"- {path.name}: {exc}")

    if errors:
        print("[ReaderTemplate] 导入取消：发现格式问题。")
        print("\n".join(errors))
        print("修正后重新运行即可；原文件仍保留在 inbox。")
        return 1

    backup_name = f"reader_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    shutil.copy2(DATA_FILE, BACKUPS / backup_name)

    created = 0
    updated = 0

    for path, incoming in parsed:
        existing = find_existing(points, incoming)
        if existing is not None:
            existing_id = existing.get("id")
            existing.clear()
            existing.update({"id": existing_id, **incoming})
            updated += 1
            action = "更新"
        else:
            incoming = {"id": next_id(points), **incoming}
            points.append(incoming)
            created += 1
            action = "新增"

        print(f"[ReaderTemplate] {action}: {incoming['title']}")
        shutil.move(str(path), str(unique_archive_path(path)))

    if parsed:
        data["course"] = parsed[-1][1]["course"]

    DATA_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"[ReaderTemplate] 完成：新增 {created}，更新 {updated}。")
    print(f"[ReaderTemplate] 已备份原数据：backups/{backup_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
