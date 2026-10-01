/* Product-page behaviour: copy button, story viewer (picker, view switching, full screen). No dependencies. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---- copy-the-prompt button ---- */
  var copy = $("copy"), prompt = $("prompt-text");
  if (copy && prompt) {
    copy.addEventListener("click", function () {
      var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy prompt"; }, 1800); };
      var fallback = function () {
        var r = document.createRange(); r.selectNodeContents(prompt);
        var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        try { document.execCommand("copy"); done(); } catch (e) { copy.textContent = "Select and copy"; }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt.textContent).then(done, fallback); else fallback();
    });
  }

  /* ---- story viewer ---- */
  var dataEl = $("showcase-data"), frame = $("v-frame"), stage = $("v-stage");
  if (!dataEl || !frame || !stage) return;
  var stories = [];
  try { stories = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!stories.length) return;

  var LABEL = { graph: "Graph", timeline: "Timeline", read: "Read", outline: "Outline", list: "List" };
  var current = 0, currentView = null;
  var canFs = !!(stage.requestFullscreen || stage.webkitRequestFullscreen) && (document.fullscreenEnabled !== false);
  var fsBtn = $("v-fs"), exitBtn = $("v-exit");
  if (!canFs) { if (fsBtn) fsBtn.style.display = "none"; }

  function setText(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setView(v) {
    currentView = v;
    var hash = "#view=" + v;
    try { frame.contentWindow.location.hash = hash; } catch (e) { frame.src = stories[current].full + hash; }
    var bar = $("v-views");
    if (bar) Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === v)); });
    var full = $("v-full"); if (full) full.setAttribute("href", stories[current].full + hash);
  }

  function select(i, opts) {
    opts = opts || {};
    current = i; var s = stories[i];
    setText("v-title", s.title); setText("v-tagline", s.tagline); setText("v-stats", s.stats); setText("v-note", s.note);
    frame.setAttribute("title", "Live story: " + s.title);
    var bar = $("v-views");
    if (bar) {
      bar.textContent = "";
      s.views.forEach(function (v) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn small"; b.textContent = LABEL[v] || v; b.setAttribute("data-v", v); b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { setView(v); });
        bar.appendChild(b);
      });
    }
    var page = $("v-page"); if (page) page.setAttribute("href", s.page);
    var picks = document.querySelectorAll(".pick[data-slug]");
    Array.prototype.forEach.call(picks, function (p) { if (p.getAttribute("data-slug") === s.slug) p.setAttribute("aria-current", "true"); else p.removeAttribute("aria-current"); });
    var target = s.full + "#view=" + s.def;
    if (!opts.keepFrame) frame.src = target;
    currentView = s.def;
    if (bar) Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === s.def)); });
    var full = $("v-full"); if (full) full.setAttribute("href", target);
  }

  Array.prototype.forEach.call(document.querySelectorAll(".pick[data-slug]"), function (p) {
    p.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let modified clicks open the story page
      var slug = p.getAttribute("data-slug");
      for (var i = 0; i < stories.length; i++) if (stories[i].slug === slug) {
        e.preventDefault(); select(i);
        try { history.replaceState(null, "", "#s=" + slug); } catch (x) {}
        return;
      }
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-story-id]"), function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-story-id");
      try { frame.contentWindow.location.hash = "#story=" + id; } catch (e) { frame.src = stories[current].full + "#story=" + id; }
      stage.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  function enterFs() {
    var f = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (!f) { window.open($("v-full").getAttribute("href"), "_blank", "noopener"); return; }
    var p = f.call(stage);
    if (p && p.catch) p.catch(function () { window.open($("v-full").getAttribute("href"), "_blank", "noopener"); });
  }
  function exitFs() { var x = document.exitFullscreen || document.webkitExitFullscreen; if (x) x.call(document); }
  if (fsBtn) fsBtn.addEventListener("click", enterFs);
  if (exitBtn) exitBtn.addEventListener("click", exitFs);

  /* initial story: #s=<slug> deep link, else the one the page was built with (index 0 on the landing page) */
  var start = 0, m = /[#&]s=([^&]+)/.exec(location.hash);
  if (m) for (var i = 0; i < stories.length; i++) if (stories[i].slug === decodeURIComponent(m[1])) start = i;
  select(start, { keepFrame: !m || start === 0 });
  if (m && start !== 0) { var sec = $("stories"); if (sec) setTimeout(function () { sec.scrollIntoView(); }, 50); }
})();
