/* メディアの右下の申込み枠（CVの入口）。media/article-tracker.js が全ページで読み込む。
   媒体ごとに、その読者がいちばん受け取りやすい申込みを1つ（＋控えめな2つ目）出す。
   - 出す時: ページを2割読んだ時か、12秒たった時（一覧・ホームはスクロールを始めた時）
   - 記事中の申込み枠・記事末の申込み・フッターが見えている間は隠す（同じ申込みを重ねない）
   - ×で小さな札にたたむ（同じタブの間は、たたんだまま）。札を押すと開く
   - 計測: 表示 media_dock_view／たたむ media_dock_close。クリックは article-tracker.js の media_cta_click（cta_placement=dock） */
(function () {
  "use strict";
  if (window.__twCvDock) return;
  window.__twCvDock = true;

  var path = location.pathname;
  var seg = (path.match(/^\/media\/([a-z]+)\//) || [])[1] || "";
  var slug = (path.replace(/\.html$/, "").replace(/\/$/, "").split("/").pop()) || "";
  var isHub = /\/media\/([a-z]+\/)?(index(\.html)?)?$/.test(path);

  var GUIDE = { kind: "無料ダウンロード", title: "Claude Code 企業導入 セキュリティ＆セットアップ実践ガイド", desc: "3つのリスク、5つの設計原則、10項目のチェックリスト。情シスの審査に出せる形でまとめています。", cta: "ガイドを受け取る", href: "/library/?doc=security", short: "導入ガイドを受け取る", mt: "Claude Code 導入ガイド（無料）", mcta: "受け取る", offer: "guide_claude_code_security" };
  var CASES = { kind: "無料ダウンロード", title: "2026年版 生成AI活用事例集", desc: "化学・医薬・IT・建設など、成果につながった現場の5事例。社内の検討資料にそのまま使えます。", cta: "事例集を受け取る", href: "/library/?doc=cases", short: "事例集を受け取る", mt: "生成AI活用事例集（無料）", mcta: "受け取る", offer: "guide_cases_2026" };
  var DIAG = { label: "1分でできる生成AI活用度診断", href: "/ai-assessment.html", offer: "assessment" };

  var OFFERS = {
    kenshu: function () {
      if (/claude-code/.test(slug)) return Object.assign({}, GUIDE, { sub: { label: "Claude Code研修の内容を見る", href: "/training.html#claude-code", offer: "training_claude_code" } });
      if (/copilot|m365/.test(slug)) return Object.assign({}, CASES, { sub: { label: "Copilotの定着・研修を相談する", href: "/copilot.html#consult", offer: "consult_copilot" } });
      return Object.assign({}, CASES, { sub: DIAG });
    },
    shigyo: function () {
      return { kind: "無料相談・30分", title: "事務所の業務のどこにAIを使えるか、一緒に整理します", desc: "書面づくり・相談対応・確認の手順など、事務所の実務に合わせてお話しします。", cta: "無料相談を申し込む", href: "/contact.html?type=consultation", short: "30分の無料相談", mt: "事務所のAI活用を30分で相談", mcta: "申し込む", offer: "consult_shigyo", sub: { label: "まずは事例集を受け取る", href: CASES.href, offer: CASES.offer } };
    },
    interview: function () {
      return { kind: "CompanyMap AI", title: "最初の業務図を、無料相談の時間でおつくりします", desc: "部署の仕事の流れをAIの聞き取りで洗い出し、AIに任せられる所まで1枚にします。", cta: "無料で相談する", href: "/companymap/contact", short: "業務図を無料でつくる", mt: "最初の業務図を無料でつくる", mcta: "相談する", offer: "companymap_consult", sub: { label: "CompanyMap AIを見る", href: "/companymap", offer: "companymap_lp" } };
    },
    security: function () { return Object.assign({}, GUIDE, { sub: { label: "社内のAI利用ルールを相談する（30分・無料）", href: "/contact.html?type=consultation", offer: "consult_security" } }); },
    infra: function () { return Object.assign({}, GUIDE, { sub: DIAG }); },
    simulation: function () { return Object.assign({}, CASES, { sub: { label: "発売前の検証を相談する", href: "/launch-simulation/", offer: "launch_simulation" } }); }
  };
  var make = OFFERS[seg] || function () { return /token/.test(slug) ? Object.assign({}, GUIDE, { sub: DIAG }) : Object.assign({}, CASES, { sub: DIAG }); };
  var o = make();
  var media = seg || "home";

  function withUtm(href, content) {
    var u = new URL(href, location.origin);
    u.searchParams.set("utm_source", "techworker_media");
    u.searchParams.set("utm_medium", "dock");
    u.searchParams.set("utm_campaign", media);
    u.searchParams.set("utm_content", (isHub ? "hub" : slug) + "-" + content);
    return u.pathname + u.search + u.hash;
  }
  function gaEvent(name, params) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, Object.assign({ dock_offer: o.offer, dock_media: media, article_path: path, transport_type: "beacon" }, params || {}));
  }

  var css = ".twd{position:fixed;right:20px;bottom:20px;z-index:60;font-family:var(--jp,'IBM Plex Sans JP',system-ui,sans-serif);color:var(--ink,#11161D);transition:opacity .3s,transform .3s}" +
    ".twd[hidden]{display:none}.twd.off{opacity:0;transform:translateY(12px);pointer-events:none}" +
    ".twd-card{width:320px;background:var(--white,#FBFCFD);border:1px solid rgba(13,17,23,.12);border-radius:14px;padding:18px 18px 14px;box-shadow:0 24px 60px -24px rgba(13,17,23,.45),0 2px 8px rgba(13,17,23,.06);position:relative}" +
    ".twd-k{display:inline-block;font-size:11.5px;font-weight:700;color:var(--electric,#005EFF);background:color-mix(in srgb,var(--electric,#005EFF) 9%,#fff);border-radius:999px;padding:3px 10px}" +
    ".twd-t{font-size:15.5px;font-weight:700;line-height:1.55;margin-top:10px;letter-spacing:-.01em}" +
    ".twd-mt,.twd-sm{display:none}" +
    ".twd-d{font-size:12.5px;line-height:1.75;color:var(--slate,#5A6677);margin-top:6px}" +
    ".twd-b{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;background:var(--electric,#005EFF);color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;padding:11px 14px}" +
    ".twd-b:hover{background:var(--electric-dark,#003DAA)}" +
    ".twd-s{display:block;text-align:center;margin-top:9px;font-size:12.5px;font-weight:600;color:var(--ink-soft,#2A333F);text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(13,17,23,.25)}" +
    ".twd-x{position:absolute;right:6px;top:6px;width:30px;height:30px;border:0;background:none;border-radius:50%;cursor:pointer;color:#6B7280;font-size:18px;line-height:1}.twd-x:hover{background:rgba(13,17,23,.06)}" +
    ".twd-pill{display:none;align-items:center;gap:8px;border:0;cursor:pointer;background:var(--ink,#11161D);color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;border-radius:999px;padding:11px 18px;box-shadow:0 14px 34px -14px rgba(13,17,23,.6)}" +
    ".twd-pill i{width:8px;height:8px;border-radius:50%;background:var(--electric,#005EFF);box-shadow:0 0 0 3px rgba(255,255,255,.18)}" +
    ".twd.min .twd-card{display:none}.twd.min .twd-pill{display:inline-flex}" +
    "@media(max-width:760px){.twd{left:10px;right:10px;bottom:10px}.twd-card{width:auto;padding:12px 44px 12px 14px;display:grid;grid-template-columns:1fr auto;gap:2px 12px;align-items:center}" +
    ".twd-k,.twd-t,.twd-d,.twd-s,.twd-lg{display:none}.twd-mt{display:block;grid-column:1;font-size:14px;font-weight:700;line-height:1.4}.twd-sm{display:inline}" +
    ".twd-b{grid-column:2;margin:0;padding:10px 14px;font-size:13.5px;white-space:nowrap}.twd-card{padding:10px 42px 10px 14px}.twd-x{top:50%;transform:translateY(-50%)}.twd.min{left:auto}}" +
    "@media(prefers-reduced-motion:reduce){.twd{transition:none}}";

  function build() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    var box = document.createElement("aside");
    box.className = "twd off";
    box.setAttribute("aria-label", o.kind);
    box.setAttribute("data-cta-placement", "dock");
    box.innerHTML = '<div class="twd-card"><span class="twd-k"></span><div class="twd-t"></div><div class="twd-mt"></div><div class="twd-d"></div>' +
      '<a class="twd-b"></a>' + (o.sub ? '<a class="twd-s"></a>' : "") +
      '<button class="twd-x" type="button" aria-label="小さくする">×</button></div>' +
      '<button class="twd-pill" type="button" aria-label="申込みを開く"><i></i><span></span></button>';
    box.querySelector(".twd-k").textContent = o.kind;
    box.querySelector(".twd-t").textContent = o.title;
    box.querySelector(".twd-mt").textContent = o.mt || o.title;
    box.querySelector(".twd-d").textContent = o.desc;
    var b = box.querySelector(".twd-b");
    b.innerHTML = "<span class=\"twd-lg\"></span><span class=\"twd-sm\"></span>";
    b.querySelector(".twd-lg").textContent = o.cta + " →";
    b.querySelector(".twd-sm").textContent = o.mcta || o.cta;
    b.href = withUtm(o.href, "primary");
    b.setAttribute("data-cta-offer", o.offer);
    if (o.sub) {
      var s = box.querySelector(".twd-s");
      s.textContent = o.sub.label;
      s.href = withUtm(o.sub.href, "secondary");
      s.setAttribute("data-cta-offer", o.sub.offer);
    }
    box.querySelector(".twd-pill span").textContent = o.short;
    document.body.appendChild(box);
    return box;
  }

  var box, shown = false, blocked = 0;
  var KEY = "tw_dock_min";
  function isMin() { try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function setMin(v) { try { v ? sessionStorage.setItem(KEY, "1") : sessionStorage.removeItem(KEY); } catch (e) {} }

  function render() {
    if (!box) return;
    box.classList.toggle("off", !shown || blocked > 0);
  }
  function show() {
    if (shown) return;
    shown = true;
    if (isMin()) box.classList.add("min");
    render();
    gaEvent("media_dock_view", { dock_state: isMin() ? "min" : "open" });
  }

  function init() {
    box = build();
    box.querySelector(".twd-x").addEventListener("click", function () { box.classList.add("min"); setMin(true); gaEvent("media_dock_close"); });
    box.querySelector(".twd-pill").addEventListener("click", function () { box.classList.remove("min"); setMin(false); gaEvent("media_dock_open"); });

    var targets = document.querySelectorAll(".mid-cta, .art-cta, .mh-band, .inline-dx-cta, footer, .lb-cta");
    if ("IntersectionObserver" in window && targets.length) {
      var seen = new Set();
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); });
        blocked = seen.size;
        render();
      }, { threshold: 0.15 });
      targets.forEach(function (t) { io.observe(t); });
    }

    var root = document.documentElement;
    function onScroll() {
      var range = root.scrollHeight - root.clientHeight;
      var y = root.scrollTop || window.scrollY;
      if ((isHub && y > 320) || (!isHub && range > 0 && y / range >= 0.2)) { show(); removeEventListener("scroll", onScroll); }
    }
    addEventListener("scroll", onScroll, { passive: true });
    if (!isHub) setTimeout(show, 12000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
