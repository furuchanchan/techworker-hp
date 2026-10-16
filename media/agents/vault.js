/* エージェント保管庫：指示文のコピー、一覧の絞り込み、読書バーと目次 */
(function () {
  "use strict";

  document.querySelectorAll(".pr-copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var pre = document.getElementById(btn.getAttribute("data-copy"));
      if (!pre || !navigator.clipboard) return;
      navigator.clipboard.writeText(pre.textContent).then(function () {
        btn.textContent = "コピーしました";
        btn.classList.add("done");
        if (typeof window.gtag === "function") window.gtag("event", "vault_prompt_copy", { article_path: location.pathname });
        setTimeout(function () { btn.textContent = "コピー"; btn.classList.remove("done"); }, 2200);
      });
    });
  });

  var grid = document.getElementById("av-grid");
  if (grid) {
    var params = new URLSearchParams(location.search);
    var state = { dept: params.get("dept") || "", prod: params.get("prod") || "" };
    var count = document.getElementById("av-n");
    var empty = document.querySelector(".av-empty");
    var apply = function () {
      var n = 0;
      grid.querySelectorAll(".av-card").forEach(function (c) {
        var show = (!state.dept || c.getAttribute("data-dept") === state.dept) && (!state.prod || c.getAttribute("data-prod") === state.prod);
        c.hidden = !show;
        if (show) n++;
      });
      document.querySelectorAll(".av-f").forEach(function (b) {
        b.setAttribute("aria-pressed", String(state[b.getAttribute("data-kind")] === b.getAttribute("data-val")));
      });
      if (count) count.textContent = n;
      if (empty) empty.hidden = n !== 0;
    };
    document.querySelectorAll(".av-f").forEach(function (b) {
      b.addEventListener("click", function () {
        state[b.getAttribute("data-kind")] = b.getAttribute("data-val");
        var q = new URLSearchParams();
        if (state.dept) q.set("dept", state.dept);
        if (state.prod) q.set("prod", state.prod);
        history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + "#list");
        apply();
      });
    });
    apply();
  }

  var pb = document.getElementById("progress");
  if (pb) addEventListener("scroll", function () { var h = document.documentElement; var d = h.scrollHeight - h.clientHeight; pb.style.width = (d > 0 ? h.scrollTop / d * 100 : 0) + "%"; }, { passive: true });

  var links = {};
  document.querySelectorAll(".av-toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
  if (Object.keys(links).length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        for (var k in links) links[k].classList.remove("active");
        if (links[en.target.id]) links[en.target.id].classList.add("active");
      });
    }, { rootMargin: "-92px 0px -68% 0px", threshold: 0 });
    Object.keys(links).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }
})();
