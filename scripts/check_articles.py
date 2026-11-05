#!/usr/bin/env python3
"""
德文自學小教室：文章自動檢查腳本

依照 AGENTS.md 第 4、5、7 節的規則，檢查 content/ 底下所有文章。
用法（在專案根目錄執行）：
    python3 scripts/check_articles.py
只使用 Python 標準函式庫，不需要安裝任何套件。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLE_DIR = ROOT / "content" / "articles"
MANIFEST = ROOT / "content" / "articles.json"

# ---- 規則設定（必須和 AGENTS.md 一致） ----
LEVELS = {
    #       字數範圍      單字數範圍   文法點數範圍
    "A1": {"words": (60, 110), "vocab": (8, 12), "grammar": (2, 2)},
    "A2": {"words": (110, 170), "vocab": (10, 14), "grammar": (2, 3)},
    "B1": {"words": (170, 250), "vocab": (12, 16), "grammar": (3, 3)},
}
TAGS = {"日常生活", "交換生活", "德國文化", "節慶", "飲食", "交通", "生活知識"}
COLORS = {"amber", "rose", "sky", "moss", "plum"}
POS = {"n", "v", "adj", "adv", "prep", "phr", "other"}
GENDERS = {"der", "die", "das"}
COUNTS = {"c", "u", "cu"}
REGISTERS = {"du", "Sie"}
MANIFEST_KEYS = ["id", "number", "level", "title_de", "title_zh", "tags",
                 "minutes", "published", "cover"]
REQUIRED = ["id", "number", "level", "title_de", "title_zh", "tags", "register",
            "minutes", "published", "cover", "text", "vocab", "grammar", "quiz",
            "translation", "culture"]

VOCAB_MARK = re.compile(r"\{\{([^{}|]+)\|([^{}]+)\}\}")
GRAMMAR_MARK = re.compile(r"\[\[([^\[\]|]+)\|([^\[\]]+)\]\]")
FILENAME = re.compile(r"^(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)\.json$")
ID_RULE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
WORD = re.compile(r"[A-Za-zÄÖÜäöüß0-9]+(?:[-,][A-Za-zÄÖÜäöüß0-9]+)*")


def strip_marks(s):
    """把 {{顯示|id}} 和 [[顯示|id]] 換回顯示文字。"""
    s = VOCAB_MARK.sub(lambda m: m.group(1), s)
    return GRAMMAR_MARK.sub(lambda m: m.group(1), s)


def count_words(paragraphs):
    return sum(len(WORD.findall(strip_marks(p))) for p in paragraphs)


def check_article(path, errors, warnings):
    name = path.name
    err = lambda msg: errors.append(f"{name}: {msg}")
    warn = lambda msg: warnings.append(f"{name}: {msg}")

    m = FILENAME.match(name)
    if not m:
        err("檔名不符合「三位數編號-slug.json」格式")
    try:
        a = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        err(f"JSON 格式錯誤：{e}")
        return None

    missing = [k for k in REQUIRED if k not in a]
    if missing:
        err(f"缺少欄位：{', '.join(missing)}")
        return None

    # 基本資訊
    if a["id"] != path.stem:
        err(f"id「{a['id']}」和檔名不一致")
    if m and a["number"] != m.group(1):
        err(f"number「{a['number']}」和檔名編號不一致")
    level = a["level"]
    if level not in LEVELS:
        err(f"level「{level}」不是 A1／A2／B1")
        return a
    if not (1 <= len(a["tags"]) <= 3):
        err("tags 必須有 1–3 個")
    for t in a["tags"]:
        if t not in TAGS:
            err(f"tag「{t}」不在允許清單內")
    if a["register"] not in REGISTERS:
        err("register 只能是 du 或 Sie")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", a["published"]):
        err("published 必須是 YYYY-MM-DD")
    if a["cover"].get("color") not in COLORS:
        err(f"cover.color「{a['cover'].get('color')}」不在允許清單內")
    if not a["cover"].get("emoji"):
        err("cover.emoji 不可以空白")

    # 原文
    text = a["text"]
    full = "\n".join(text)
    if re.search(r"<[a-zA-Z/]", full):
        err("原文裡不可以有 HTML 標籤")
    if re.search(r"\{\{[^}]*\[\[|\[\[[^\]]*\{\{", full):
        err("標記不可以巢狀")
    if re.search(r"\b(z\. ?B\.|usw\.|bzw\.|Nr\.|ca\.)", full):
        err("原文不要使用縮寫（會影響逐句朗讀的切句）")
    leftover = re.sub(VOCAB_MARK, "", re.sub(GRAMMAR_MARK, "", full))
    if "{{" in leftover or "}}" in leftover or "[[" in leftover or "]]" in leftover:
        err("原文有不完整的 {{ }} 或 [[ ]] 標記")

    words = count_words(text)
    lo, hi = LEVELS[level]["words"]
    if not (lo <= words <= hi):
        err(f"德文字數 {words}，不在 {level} 的範圍 {lo}–{hi}")
    expected_minutes = max(1, round(words / 50))
    if a["minutes"] != expected_minutes:
        err(f"minutes 應為 {expected_minutes}（字數 {words} ÷ 50）")

    # 單字
    vocab = a["vocab"]
    vids = [v.get("id") for v in vocab]
    if len(vids) != len(set(vids)):
        err("vocab 的 id 有重複")
    lo, hi = LEVELS[level]["vocab"]
    if not (lo <= len(vocab) <= hi):
        err(f"單字 {len(vocab)} 個，不在 {level} 的範圍 {lo}–{hi}")
    for v in vocab:
        vid = v.get("id", "?")
        for k in ("id", "de", "pos", "zh"):
            if not v.get(k):
                err(f"單字 {vid} 缺少 {k}")
        if vid and not ID_RULE.match(vid):
            err(f"單字 id「{vid}」只能用小寫英文、數字和 -")
        if v.get("pos") not in POS:
            err(f"單字 {vid} 的 pos「{v.get('pos')}」不合法")
        if v.get("pos") == "n":
            if v.get("gender") not in GENDERS:
                err(f"名詞 {vid} 的 gender 必須是 der／die／das")
            if not v.get("plural"):
                err(f"名詞 {vid} 缺少 plural")
            if v.get("count") not in COUNTS:
                err(f"名詞 {vid} 的 count 必須是 c／u／cu")
            if v.get("count") == "u" and v.get("plural") != "—":
                err(f"不可數名詞 {vid} 的 plural 必須是 —")
            if v.get("count") == "cu" and not v.get("note"):
                err(f"名詞 {vid} 是 cu，note 必須說明兩種用法")
            if v.get("de", "")[:1].islower():
                err(f"名詞 {vid} 的 de 應該大寫開頭")
            if re.match(r"^(der|die|das) ", v.get("de", "")):
                err(f"名詞 {vid} 的 de 不要加冠詞")
        if v.get("pos") == "v" and not re.match(r"^.+ – (hat|ist) .+$", v.get("forms", "")):
            err(f"動詞 {vid} 的 forms 格式應為「…… – hat/ist ……」")

    # 文法
    grammar = a["grammar"]
    gids = [g.get("id") for g in grammar]
    lo, hi = LEVELS[level]["grammar"]
    if not (lo <= len(grammar) <= hi):
        err(f"文法點 {len(grammar)} 個，不在 {level} 的範圍 {lo}–{hi}")
    if gids != [f"g{i + 1}" for i in range(len(grammar))]:
        err("grammar 的 id 必須依序是 g1、g2、g3")
    for g in grammar:
        for k in ("title", "explain", "pattern"):
            if not g.get(k):
                err(f"文法 {g.get('id')} 缺少 {k}")
        ex = g.get("examples", [])
        if not (2 <= len(ex) <= 3):
            err(f"文法 {g.get('id')} 的例句要 2–3 句")
        for e in ex:
            if "**" not in e.get("de", ""):
                warn(f"文法 {g.get('id')} 有例句沒有用 **粗體** 標重點")
            if strip_marks(e.get("de", "")).replace("**", "") in strip_marks(full):
                err(f"文法 {g.get('id')} 的例句不可以照抄原文")

    # 標記對應
    used_v = {m.group(2) for m in VOCAB_MARK.finditer(full)}
    used_g = {m.group(2) for m in GRAMMAR_MARK.finditer(full)}
    for u in used_v - set(vids):
        err(f"原文標記了 {{{{…|{u}}}}}，但 vocab 裡沒有這個 id")
    for u in used_g - set(gids):
        err(f"原文標記了 [[…|{u}]]，但 grammar 裡沒有這個 id")
    for u in set(vids) - used_v:
        err(f"單字 {u} 沒有在原文中標記")
    for u in set(gids) - used_g:
        err(f"文法 {u} 沒有在原文中標記")

    # 測驗
    quiz = a["quiz"]
    if len(quiz) != 3:
        err("測驗必須剛好 3 題")
    answers = []
    for i, q in enumerate(quiz, 1):
        if len(q.get("options", [])) != 3:
            err(f"第 {i} 題必須有 3 個選項")
        if q.get("answer") not in (0, 1, 2):
            err(f"第 {i} 題的 answer 必須是 0、1 或 2")
        if not q.get("q") or not q.get("explain"):
            err(f"第 {i} 題缺少題目或解說")
        answers.append(q.get("answer"))
    if len(quiz) == 3 and len(set(answers)) == 1:
        err("3 題的正確答案位置全部一樣")

    # 翻譯
    if len(a["translation"]) != len(text):
        err(f"翻譯 {len(a['translation'])} 段，原文 {len(text)} 段，必須一樣")

    # 小知識
    c = a["culture"]
    if not (2 <= len(c.get("points", [])) <= 4):
        err("culture.points 要 2–4 段")
    if not (3 <= len(c.get("terms", [])) <= 6):
        err("culture.terms 要 3–6 個")

    a["_words"] = words
    return a


def main():
    errors, warnings = [], []
    files = sorted(ARTICLE_DIR.glob("*.json"))
    articles = {}
    for f in files:
        a = check_article(f, errors, warnings)
        if a:
            articles[a["id"]] = a

    # 編號連續
    numbers = sorted(int(a["number"]) for a in articles.values() if a["number"].isdigit())
    if numbers != list(range(1, len(numbers) + 1)):
        errors.append(f"文章編號沒有從 001 連續編號：{numbers}")

    # 清單一致
    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except Exception as e:
        errors.append(f"articles.json 讀取失敗：{e}")
        manifest = []
    mids = [m.get("id") for m in manifest]
    if len(mids) != len(set(mids)):
        errors.append("articles.json 有重複的 id")
    for aid in set(articles) - set(mids):
        errors.append(f"articles.json 沒有列出 {aid}")
    for mid in set(mids) - set(articles):
        errors.append(f"articles.json 列了 {mid}，但找不到對應的文章檔")
    for item in manifest:
        a = articles.get(item.get("id"))
        if not a:
            continue
        for k in MANIFEST_KEYS:
            if item.get(k) != a.get(k):
                errors.append(f"articles.json 中 {a['id']} 的 {k} 和文章不一致")
    order = [m.get("number") for m in manifest]
    if order != sorted(order, reverse=True):
        errors.append("articles.json 要依編號由新到舊排列（新的在最前面）")

    # 報告
    print(f"檢查了 {len(files)} 篇文章\n")
    for a in sorted(articles.values(), key=lambda x: x["number"]):
        print(f"  {a['number']}  {a['level']}  {a['title_de']:<32} "
              f"{a['_words']:>4} 字  單字 {len(a['vocab']):>2}  文法 {len(a['grammar'])}")
    print()
    for w in warnings:
        print(f"⚠️  {w}")
    if errors:
        for e in errors:
            print(f"❌ {e}")
        print(f"\n共 {len(errors)} 個錯誤，請修正後再執行一次。")
        sys.exit(1)
    print("✅ 全部通過！（德文正確性、翻譯和文化知識仍需依 AGENTS.md 第 7 節 B 人工確認）")


if __name__ == "__main__":
    main()
