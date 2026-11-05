/* =========================================================
   文章頁：依網址 ?id= 讀取 content/articles/<id>.json 並渲染
   區塊順序固定（見 AGENTS.md 第 8 節）。
   新增文章時「不需要」修改這個檔案。
   ========================================================= */
(function () {
  const POS = { n: "名詞", v: "動詞", adj: "形容詞", adv: "副詞", prep: "介系詞", phr: "片語", other: "其他" };
  const COUNT = { c: "可數", u: "不可數", cu: "可數／不可數" };
  const LEVEL = { A1: "入門 A1", A2: "初級 A2", B1: "中級 B1" };
  const SPEEDS = [1, 0.8, 0.6];
  const MARK = /\{\{([^{}|]+)\|([^{}]+)\}\}|\[\[([^\[\]|]+)\|([^\[\]]+)\]\]/g;
  // 切句：句號／問號／驚嘆號（可接引號）後面接空白和大寫字母、數字或引號。
  // 數字後面的句號（例如 11. November）不切。
  const SENTENCE_SPLIT = /(?<=[^\d\s][.!?][“”"]?)\s+(?=[„"A-ZÄÖÜ0-9])/;

  const main = document.getElementById("main");
  const pop = document.getElementById("pop");
  let A = null;                 // 目前文章資料
  let vocabById = {};
  let grammarById = {};
  let sentenceEls = [];         // 全文的句子元素（依順序）

  /* ---------- 小工具 ---------- */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  const plain = (s) => s.replace(MARK, (_, v1, _v, g1) => v1 ?? g1);

  // 把 **粗體** 轉成 <strong>，其餘一律當純文字
  function withBold(text) {
    const frag = document.createDocumentFragment();
    text.split(/\*\*(.+?)\*\*/).forEach((part, i) => {
      frag.append(i % 2 ? el("strong", {}, part) : document.createTextNode(part));
    });
    return frag;
  }

  function nounWithArticle(v) {
    return v.pos === "n" ? `${v.gender} ${v.de}` : v.de;
  }
  function genderClass(v) {
    return v.pos === "n" ? `g-${v.gender}` : "";
  }
  function pluralNode(v) {
    if (v.pos !== "n") return el("span", { class: "meta" }, v.forms || "—");
    if (v.plural === "—") return el("span", { class: "meta" }, "—");
    return el("span", { class: "g-pl", lang: "de" }, v.plural);
  }
  function countNode(v) {
    return v.pos === "n" ? el("span", { class: `count count--${v.count}` }, COUNT[v.count]) : null;
  }
  function speakBtn(text, label) {
    return el("button", {
      class: "icon-btn", type: "button", "aria-label": `朗讀 ${label || text}`,
      onclick: (e) => { e.stopPropagation(); Speech.speak(text); },
    }, "🔊");
  }

  /* ---------- 已讀紀錄 ---------- */
  function markRead(id) {
    try {
      const s = new Set(JSON.parse(localStorage.getItem("dk-read") || "[]"));
      s.add(id);
      localStorage.setItem("dk-read", JSON.stringify([...s]));
    } catch { /* 無法存取 localStorage 時忽略 */ }
  }

  /* ---------- 1. 標題區 ---------- */
  function renderHead() {
    return el("header", { class: "article-head" },
      el("div", { class: `article-head__cover cover--${A.cover.color}`, "aria-hidden": "true" }, A.cover.emoji),
      el("div", {},
        el("div", { class: "article-head__no" }, `NO. ${A.number}`),
        el("h1", { lang: "de" }, A.title_de),
        el("p", { class: "article-head__zh" }, A.title_zh),
        el("div", { class: "article-head__tags" },
          el("span", { class: `badge badge--${A.level}` }, LEVEL[A.level]),
          A.tags.map((t) => el("span", { class: "tag" }, t)),
          el("span", { class: "tag" }, A.register === "Sie" ? "對話用 Sie（敬稱）" : "對話用 du（你）"),
          el("span", { class: "meta" }, `約 ${A.minutes} 分鐘`))));
  }

  /* ---------- 2. 德文原文 ---------- */
  function renderTokens(str) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of str.matchAll(MARK)) {
      if (m.index > last) frag.append(str.slice(last, m.index));
      if (m[1] !== undefined) {
        const v = vocabById[m[2]];
        frag.append(el("button", {
          class: `w ${v ? genderClass(v) : ""}`, type: "button", "data-vocab": m[2],
          "aria-label": `${m[1]}：查看單字解釋`,
        }, m[1]));
      } else {
        frag.append(el("button", {
          class: "gm", type: "button", "data-grammar": m[4],
          "aria-label": `${m[3]}：查看文法解釋`,
        }, m[3]));
      }
      last = m.index + m[0].length;
    }
    if (last < str.length) frag.append(str.slice(last));
    return frag;
  }

  function renderReading() {
    sentenceEls = [];
    const reading = el("div", { class: "reading", lang: "de" });
    A.text.forEach((para) => {
      const p = el("p");
      para.split(SENTENCE_SPLIT).forEach((s, i) => {
        if (i > 0) p.append(" ");
        const idx = sentenceEls.length;
        const span = el("span", { class: "sentence" },
          Speech.supported
            ? el("button", {
                class: "say", type: "button", "aria-label": "朗讀這一句",
                onclick: () => speakFrom(idx, true),
              }, "🔊")
            : null,
          renderTokens(s));
        span.dataset.say = plain(s);
        sentenceEls.push(span);
        p.append(span);
      });
      reading.append(p);
    });
    return el("section", { class: "block", "aria-labelledby": "h-text" },
      el("h2", { id: "h-text" }, "📖 德文原文"),
      el("p", { class: "block__hint" },
        "點有底線的單字看解釋（顏色代表名詞性別），點黃色標記看文法；點句子前的 🔊 只聽那一句。"),
      reading);
  }

  /* ---------- 3. 全文朗讀 ---------- */
  function clearSpeaking() { sentenceEls.forEach((s) => s.classList.remove("is-speaking")); }

  function speakFrom(start, onlyOne) {
    const list = onlyOne ? [sentenceEls[start]] : sentenceEls.slice(start);
    Speech.speakAll(list.map((s) => s.dataset.say), {
      onStart: (i) => { clearSpeaking(); list[i].classList.add("is-speaking"); },
      onDone: clearSpeaking,
    });
  }

  function renderPlayer() {
    const block = el("section", { class: "block", "aria-labelledby": "h-audio" },
      el("h2", { id: "h-audio" }, "🎧 全文朗讀"));
    if (!Speech.supported) {
      block.append(el("p", { class: "notice" }, "你的瀏覽器不支援語音朗讀，建議改用 Chrome、Edge 或 Safari。"));
      return block;
    }
    const speedBtns = SPEEDS.map((r) => el("button", {
      class: "chip", type: "button", "aria-pressed": String(r === Speech.getRate()),
      onclick: (e) => {
        Speech.setRate(r);
        speedBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
      },
    }, `${r.toFixed(1)}×`));
    block.append(el("div", { class: "player" },
      el("button", { class: "btn", type: "button", onclick: () => speakFrom(0, false) }, "▶ 播放全文"),
      el("button", { class: "btn btn--ghost", type: "button", onclick: () => { Speech.stop(); clearSpeaking(); } }, "■ 停止"),
      el("div", { class: "speed", role: "group", "aria-label": "朗讀速度" },
        el("span", { class: "speed__label" }, "速度"), speedBtns)));
    const notice = el("p", { class: "notice", hidden: true },
      "找不到德語語音，朗讀可能會用其他語言的發音。可以在系統設定中加入德語（Deutsch）語音。");
    block.append(notice);
    // 語音清單可能晚一點才載入，稍等再檢查
    setTimeout(() => { if (!Speech.hasGermanVoice()) notice.hidden = false; }, 1500);
    return block;
  }

  /* ---------- 4. 重點單字 ---------- */
  function renderVocab() {
    const rows = A.vocab.map((v) => el("div", { class: "vocab__row" },
      el("div", { class: "vocab__word", lang: "de" },
        v.pos === "n" ? el("small", { class: genderClass(v) }, `${v.gender} `) : null,
        el("span", { class: genderClass(v) }, v.de)),
      el("div", { class: "vocab__pos meta" }, POS[v.pos]),
      el("div", { class: "vocab__plural" }, pluralNode(v)),
      el("div", { class: "vocab__count" }, countNode(v)),
      el("div", { class: "vocab__zh" }, v.zh),
      Speech.supported ? speakBtn(nounWithArticle(v)) : el("span"),
      el("div", { class: "vocab__note" }, v.note || "")));

    const tools = Speech.supported
      ? el("div", { class: "vocab-tools" },
          el("button", { class: "btn", type: "button",
            onclick: () => Speech.speakAll(A.vocab.map(nounWithArticle), { repeat: 2 }) }, "▶ 依序朗讀（每個唸兩次）"),
          el("button", { class: "btn btn--ghost", type: "button", onclick: () => Speech.stop() }, "■ 停止"))
      : null;

    return el("section", { class: "block", "aria-labelledby": "h-vocab" },
      el("h2", { id: "h-vocab" }, "📝 重點單字"),
      el("p", { class: "block__hint" }, "名詞依性別上色：der 藍、die 紅、das 綠。複數欄若是動詞，顯示「第三人稱單數 – 現在完成式」。"),
      tools,
      el("div", { class: "vocab" },
        el("div", { class: "vocab__row vocab__row--head", "aria-hidden": "true" },
          el("div", {}, "單字"), el("div", {}, "詞性"), el("div", {}, "複數／動詞變化"),
          el("div", {}, "可數"), el("div", {}, "中文"), el("div", {}, "")),
        rows));
  }

  /* ---------- 5. 核心文法 ---------- */
  function renderGrammar() {
    return el("section", { class: "block", "aria-labelledby": "h-grammar" },
      el("h2", { id: "h-grammar" }, "📚 核心文法"),
      A.grammar.map((g, i) => el("article", { class: "grammar", id: `grammar-${g.id}` },
        el("h3", {}, el("span", { class: "grammar__no" }, String(i + 1).padStart(2, "0")), g.title),
        el("p", { style: "margin:0" }, g.explain),
        el("div", { class: "grammar__pattern" }, g.pattern),
        el("ul", { class: "examples" }, g.examples.map((ex) => el("li", {},
          el("span", { class: "de", lang: "de" }, withBold(ex.de)),
          el("span", { class: "zh" }, ex.zh)))))));
  }

  /* ---------- 6. 閱讀測驗 ---------- */
  function renderQuiz() {
    const block = el("section", { class: "block", "aria-labelledby": "h-quiz" },
      el("h2", { id: "h-quiz" }, "❓ 閱讀測驗"),
      el("p", { class: "block__hint" }, "先不要看翻譯，試著從德文原文找答案。"));
    const results = new Array(A.quiz.length).fill(null);
    const scoreBox = el("div", { class: "score", hidden: true });

    function updateScore() {
      if (results.some((r) => r === null)) { scoreBox.hidden = true; return; }
      const right = results.filter(Boolean).length;
      scoreBox.replaceChildren(
        el("span", {}, `你答對了 ${right} / ${results.length} 題` + (right === results.length ? "，Super! 🎉" : "，再讀一次原文試試看！")),
        el("button", { class: "btn", type: "button", onclick: () => {
          block.replaceWith(renderQuiz());
        } }, "重新作答"));
      scoreBox.hidden = false;
    }

    A.quiz.forEach((q, qi) => {
      const name = `q${qi}`;
      const opts = q.options.map((o, oi) => el("label", { class: "q__opt" },
        el("input", { type: "radio", name, value: String(oi) }), o));
      const result = el("div", { class: "q__result", "aria-live": "polite" });
      const check = el("button", { class: "btn btn--ghost", type: "button", onclick: () => {
        const picked = block.querySelector(`input[name="${name}"]:checked`);
        if (!picked) { result.textContent = "請先選一個答案。"; return; }
        const ok = Number(picked.value) === q.answer;
        results[qi] = ok;
        opts.forEach((lab, oi) => {
          lab.querySelector("input").disabled = true;
          if (oi === q.answer) lab.classList.add("is-correct");
          else if (lab.contains(picked)) lab.classList.add("is-wrong");
        });
        check.disabled = true;
        result.replaceChildren(
          el("b", { class: ok ? "ok" : "no" }, ok ? "✓ 答對了！ " : "✗ 再想想～ "),
          q.explain);
        updateScore();
      } }, "確認答案");
      block.append(el("div", { class: "q" },
        el("p", { class: "q__title" }, `${qi + 1}. ${q.q}`),
        el("div", { class: "q__opts" }, opts),
        check, result));
    });
    block.append(scoreBox);
    return block;
  }

  /* ---------- 7. 全文翻譯 ---------- */
  function renderTranslation() {
    return el("section", { class: "block" },
      el("details", { class: "translation" },
        el("summary", {}, "🇹🇼 全文中文翻譯"),
        A.translation.map((t) => el("p", {}, t))));
  }

  /* ---------- 8. 德國生活小知識 ---------- */
  function renderCulture() {
    const c = A.culture;
    return el("section", { class: "block culture", "aria-labelledby": "h-culture" },
      el("h2", { id: "h-culture" }, `💡 ${c.title}`),
      c.points.map((p) => [el("h3", {}, p.heading), el("p", {}, p.body)]),
      el("div", { class: "terms" }, c.terms.map((t) => el("span", { class: "term" },
        el("span", { lang: "de" }, t.de), t.zh))));
  }

  /* ---------- 9. 上一篇／下一篇 ---------- */
  function renderPager(list) {
    const sorted = list.slice().sort((a, b) => a.number.localeCompare(b.number));
    const i = sorted.findIndex((x) => x.id === A.id);
    const prev = sorted[i - 1], next = sorted[i + 1];
    const link = (a, cls, label) => a
      ? el("a", { class: cls, href: `article.html?id=${encodeURIComponent(a.id)}` },
          el("small", {}, label), el("b", { lang: "de" }, a.title_de), " ", el("span", { class: "meta" }, a.title_zh))
      : null;
    return el("nav", { class: "pager", "aria-label": "其他文章" },
      link(prev, "prev", "← 上一篇"), link(next, "next", "下一篇 →"));
  }

  /* ---------- 單字／文法小視窗 ---------- */
  function openPop(target) {
    pop.replaceChildren();
    const close = el("button", { class: "pop__close", type: "button", "aria-label": "關閉", onclick: closePop }, "×");
    if (target.dataset.vocab) {
      const v = vocabById[target.dataset.vocab];
      if (!v) return;
      pop.append(
        el("div", { class: "pop__head" },
          el("span", { class: `pop__word ${genderClass(v)}`, lang: "de" }, nounWithArticle(v)),
          Speech.supported ? speakBtn(nounWithArticle(v)) : null,
          close),
        el("div", { class: "pop__line" },
          el("span", {}, POS[v.pos]),
          v.pos === "n" ? [el("span", {}, "· 複數"), pluralNode(v), countNode(v)] : null,
          v.pos === "v" ? el("span", { lang: "de" }, `· ${v.forms}`) : null),
        el("p", { class: "pop__zh" }, v.zh),
        v.note ? el("p", { class: "pop__note" }, v.note) : null);
    } else {
      const g = grammarById[target.dataset.grammar];
      if (!g) return;
      pop.append(
        el("div", { class: "pop__head" }, el("b", {}, "📚 文法"), close),
        el("p", { class: "pop__zh" }, g.title),
        el("p", { class: "pop__note" }, g.pattern),
        el("p", { style: "margin:8px 0 0" },
          el("a", { href: `#grammar-${g.id}`, onclick: (e) => {
            e.preventDefault(); closePop();
            const sec = document.getElementById(`grammar-${g.id}`);
            sec.scrollIntoView({ behavior: "smooth", block: "start" });
            sec.classList.remove("is-flash"); void sec.offsetWidth; sec.classList.add("is-flash");
          } }, "看完整說明 ↓")));
    }
    pop.hidden = false;
    // 位置：出現在被點的字下方，並保持在畫面內
    const r = target.getBoundingClientRect();
    const w = pop.offsetWidth;
    let left = r.left + window.scrollX + r.width / 2 - w / 2;
    left = Math.max(12 + window.scrollX, Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 12));
    pop.style.left = `${left}px`;
    pop.style.top = `${r.bottom + window.scrollY + 8}px`;
    pop.dataset.owner = target.dataset.vocab || target.dataset.grammar;
    close.focus({ preventScroll: true });
  }
  function closePop() { pop.hidden = true; }

  document.addEventListener("click", (e) => {
    const t = e.target.closest(".w, .gm");
    if (t) { openPop(t); return; }
    if (!pop.hidden && !pop.contains(e.target)) closePop();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });

  /* ---------- 錯誤畫面 ---------- */
  function showError(msg) {
    main.replaceChildren(el("div", { class: "error" },
      el("h1", {}, "😢 找不到這篇文章"),
      el("p", {}, msg),
      el("p", {}, el("a", { href: "index.html" }, "← 回到文章列表"))));
  }

  /* ---------- 主程式 ---------- */
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    showError("網址裡的文章編號不正確。");
    return;
  }

  Promise.all([
    fetch(`content/articles/${id}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch("content/articles.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ])
    .then(([article, list]) => {
      A = article;
      vocabById = Object.fromEntries(A.vocab.map((v) => [v.id, v]));
      grammarById = Object.fromEntries(A.grammar.map((g) => [g.id, g]));
      document.title = `${A.title_de}｜${A.title_zh}｜德文自學小教室`;
      main.replaceChildren(
        el("a", { class: "back", href: "index.html#all" }, "← 回到文章列表"),
        renderHead(),
        renderReading(),
        renderPlayer(),
        renderVocab(),
        renderGrammar(),
        renderQuiz(),
        renderTranslation(),
        renderCulture(),
        renderPager(list));
      markRead(A.id);
    })
    .catch(() => showError("文章載入失敗。如果你是直接雙擊打開 HTML 檔，請改用本機伺服器：python3 -m http.server 8000"));
})();
