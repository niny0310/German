# 📗 德文自學小教室

給中文母語初學者的**德文分級閱讀網站**。每篇文章都是一段短短的德文，主題是德國的日常生活、交換生活與文化。

## 每篇文章都有

- 📖 **德文原文**：點單字看解釋，點黃色標記看文法；名詞依性別上色（der 藍、die 紅、das 綠）
- 🎧 **德語朗讀**：全文或逐句朗讀，速度 1.0× / 0.8× / 0.6×，正在唸的句子會反白
- 📝 **重點單字**：名詞附性別、複數、**可數／不可數**；動詞附現在式與現在完成式
- 📚 **核心文法**：說明、句型公式、例句
- ❓ **閱讀測驗**：三題選擇題，顯示總分，可以重新作答
- 🇹🇼 **全文中文翻譯**（預設收合）
- 💡 **德國生活小知識**

首頁可以依程度（A1／A2／B1）和主題篩選，讀過的文章會標示「已讀」。

## 這個專案怎麼「繼續做下去」

這個專案的核心是 [`AGENTS.md`](AGENTS.md)：一份寫給 AI 的專案說明書。它規定了程度標準、文章 JSON 格式、檔案命名、新增文章的 SOP 和檢查清單。

**版型和內容完全分開**：新增一篇文章只需要

1. 從 `templates/article-template.json` 複製一份，寫好內容，放進 `content/articles/`
2. 在 `content/articles.json` 最前面加一行
3. 執行 `python3 scripts/check_articles.py`，全部通過即完成

不需要修改任何 HTML、CSS 或 JavaScript。只要對 AI 說：

> 請先讀 AGENTS.md，然後新增一篇 A1 文章，主題是「在德國搭公車」。

AI 就能照同一套規則產出新的一頁。

## 專案結構

```
├── AGENTS.md                  專案規則（給 AI 讀）
├── CLAUDE.md                  指向 AGENTS.md
├── index.html                 首頁
├── article.html               共用文章頁（?id=文章編號）
├── assets/css/style.css
├── assets/js/                 home.js、article.js、speech.js
├── content/articles.json      文章清單
├── content/articles/*.json    每篇文章一個檔案
├── templates/                 新文章範本
└── scripts/check_articles.py  自動檢查腳本
```

## 在自己電腦上預覽

```bash
python3 -m http.server 8000
# 打開 http://localhost:8000
```

（直接雙擊 HTML 檔案無法讀取 JSON，要用本機伺服器開啟。）

## 技術

純 HTML / CSS / JavaScript，沒有框架、沒有建置步驟，可直接部署在 GitHub Pages。朗讀使用瀏覽器內建的 Web Speech API。所有文章皆為原創。
