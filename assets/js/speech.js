/* =========================================================
   德語朗讀：使用瀏覽器內建的語音合成（Web Speech API）
   不使用外部音檔，也不呼叫任何付費 API。
   ========================================================= */
(function () {
  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === "function";
  let germanVoice = null;
  let rate = 1;
  let runId = 0; // 每次開始新的朗讀就加一，用來忽略舊的回呼

  // 挑一個德語語音（瀏覽器的語音清單可能晚一點才載入）
  function pickVoice() {
    if (!supported) return;
    const voices = synth.getVoices();
    germanVoice =
      voices.find((v) => v.lang === "de-DE" && /google|natural|premium|enhanced/i.test(v.name)) ||
      voices.find((v) => v.lang === "de-DE") ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("de")) ||
      null;
  }
  if (supported) {
    pickVoice();
    synth.addEventListener?.("voiceschanged", pickVoice);
  }

  /**
   * 依序朗讀多段文字
   * @param {string[]} texts 要唸的句子
   * @param {object} opts { repeat: 每句唸幾次, onStart(i), onDone() }
   */
  function speakAll(texts, opts = {}) {
    if (!supported) return;
    stop();
    const myRun = ++runId;
    const repeat = opts.repeat || 1;
    const queue = [];
    texts.forEach((t, i) => { for (let r = 0; r < repeat; r++) queue.push({ t, i }); });

    queue.forEach((item, k) => {
      const u = new SpeechSynthesisUtterance(item.t);
      u.lang = "de-DE";
      if (germanVoice) u.voice = germanVoice;
      u.rate = rate;
      u.onstart = () => { if (myRun === runId && opts.onStart) opts.onStart(item.i); };
      u.onend = () => {
        if (myRun === runId && k === queue.length - 1 && opts.onDone) opts.onDone();
      };
      u.onerror = () => {
        if (myRun === runId && k === queue.length - 1 && opts.onDone) opts.onDone();
      };
      synth.speak(u);
    });
  }

  function speak(text, opts) { speakAll([text], opts); }

  function stop() {
    if (!supported) return;
    runId++;
    synth.cancel();
  }

  window.Speech = {
    supported,
    speak,
    speakAll,
    stop,
    setRate(r) { rate = r; },
    getRate() { return rate; },
    // 語音清單載入後才知道有沒有德語語音
    hasGermanVoice() { pickVoice(); return !!germanVoice; },
  };
})();
