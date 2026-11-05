/* =========================================================
   首頁：讀取 content/articles.json，顯示最新文章與篩選列表
   新增文章時「不需要」修改這個檔案。
   ========================================================= */
(function () {
  const LEVELS = [
    { key: "A1", label: "入門 A1" },
    { key: "A2", label: "初級 A2" },
    { key: "B1", label: "中級 B1" },
  ];
  const FEATURED_COUNT = 2;

  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);
  let state = { level: params.get("level") || "", tag: params.get("tag") || "" };
  let articles = [];

  // 小工具：建立元素
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  // 已讀紀錄（讀不到也不影響網站）
  function readSet() {
    try { return new Set(JSON.parse(localStorage.getItem("dk-read") || "[]")); }
    catch { return new Set(); }
  }

  function levelLabel(key) {
    return (LEVELS.find((l) => l.key === key) || { label: key }).label;
  }

  function card(a, big = false, read = new Set()) {
    return el("a", { class: "card" + (big ? " card--big" : ""), href: `article.html?id=${encodeURIComponent(a.id)}` },
      el("div", { class: `card__cover cover--${a.cover.color}`, "aria-hidden": "true" },
        el("span", { class: "card__no" }, `NO. ${a.number}`),
        read.has(a.id) ? el("span", { class: "card__read" }, "已讀 ✓") : null,
        a.cover.emoji),
      el("div", { class: "card__body" },
        el("h3", { class: "card__title", lang: "de" }, a.title_de),
        el("p", { class: "card__zh" }, a.title_zh),
        el("div", { class: "card__foot" },
          el("span", { class: `badge badge--${a.level}` }, levelLabel(a.level)),
          ...a.tags.map((t) => el("span", { class: "tag" }, t)),
          el("span", { class: "meta" }, `約 ${a.minutes} 分鐘`))));
  }

  function chip(label, pressed, onClick) {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": String(pressed) }, label);
    b.addEventListener("click", onClick);
    return b;
  }

  function renderFilters() {
    const lv = $("#level-filter");
    lv.querySelectorAll(".chip").forEach((c) => c.remove());
    lv.append(chip("全部", !state.level, () => setState({ level: "" })));
    LEVELS.forEach((l) => lv.append(chip(l.label, state.level === l.key, () => setState({ level: l.key }))));

    const tg = $("#tag-filter");
    tg.querySelectorAll(".chip").forEach((c) => c.remove());
    const tags = [...new Set(articles.flatMap((a) => a.tags))];
    tg.append(chip("全部", !state.tag, () => setState({ tag: "" })));
    tags.forEach((t) => tg.append(chip(t, state.tag === t, () => setState({ tag: state.tag === t ? "" : t }))));
  }

  function renderList() {
    const read = readSet();
    const list = articles.filter((a) =>
      (!state.level || a.level === state.level) && (!state.tag || a.tags.includes(state.tag)));
    const box = $("#cards");
    box.replaceChildren();
    if (list.length === 0) {
      box.append(el("div", { class: "empty" },
        state.level ? `${levelLabel(state.level)} 的文章還在準備中，敬請期待！` : "沒有符合條件的文章。"));
    } else {
      list.forEach((a) => box.append(card(a, false, read)));
    }
    $("#count").textContent = `共 ${list.length} 篇`;
  }

  function setState(patch) {
    state = { ...state, ...patch };
    const p = new URLSearchParams();
    if (state.level) p.set("level", state.level);
    if (state.tag) p.set("tag", state.tag);
    history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
    renderFilters();
    renderList();
  }

  fetch("content/articles.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      // 依編號由新到舊排序（保險起見，不依賴清單順序）
      articles = data.slice().sort((a, b) => b.number.localeCompare(a.number));
      const read = readSet();
      const featured = $("#featured");
      articles.slice(0, FEATURED_COUNT).forEach((a) => featured.append(card(a, true, read)));
      renderFilters();
      renderList();
    })
    .catch(() => {
      $("#cards").append(el("div", { class: "empty" },
        "文章清單載入失敗。如果你是直接雙擊打開 HTML 檔，請改用本機伺服器：python3 -m http.server 8000"));
    });
})();
