/* メディアの申込み（CVの入口）。media/article-tracker.js が全ページで読み込む。
   1) 右下の枠: 媒体ごとに、その読者がいちばん受け取りやすい申込みを1つ。見本・題・ボタン・一言だけに絞る。
      受け取る物の見本（資料の表紙・業務図）と、中身の具体例3つ、受け取り方（送信後すぐ読める等）を見せる。
   2) 記事中の申込み（.mid-cta）にも、同じ見本と中身の具体例を足す。
   中身の具体例は、実在する資料・ページに書いてあることだけ（library/cases-2026.html・claude-code-security.html・gyomuzu-templates.html・companymap）。
   - 出す時: ページを2割読んだ時か、12秒たった時（一覧・ホームはスクロールを始めた時）
   - 記事中・記事末の申込みとフッターが見えている間は隠す。×で小さな札にたたむ（同じタブの間は維持）
   - 計測: media_dock_view／close／open。クリックは article-tracker.js の media_cta_click（cta_placement=dock） */
(function () {
  "use strict";
  if (window.__twCvDock) return;
  window.__twCvDock = true;

  var path = location.pathname;
  var seg = (path.match(/^\/media\/([a-z]+)\//) || [])[1] || "";
  var slug = (path.replace(/\.html$/, "").replace(/\/$/, "").split("/").pop()) || "";
  var isHub = /\/media\/([a-z]+\/)?(index(\.html)?)?$/.test(path);

  var GUIDE = {
    kind: "無料ダウンロード", img: "/media/cv/security.jpg", offer: "guide_claude_code_security",
    title: "Claude Code 企業導入 セキュリティ＆セットアップ実践ガイド",
    points: ["情シスの確認にそのまま使える10項目のチェックリスト", "情報漏洩・過剰な権限・外部依存の3大リスク", "権限・シークレット・監査ログなど5つの設計原則"],
    note: "送信後、その場で読めます（PDF保存も可）",
    cta: "無料で受け取る", mcta: "受け取る", href: "/library/?doc=security", short: "導入ガイドを受け取る", mt: "Claude Code 導入ガイド（無料）"
  };
  var CASES = {
    kind: "無料ダウンロード", img: "/media/cv/cases.jpg", offer: "guide_cases_2026",
    title: "2026年版 生成AI活用事例集",
    points: ["化学メーカー：新素材のアイデア出しを、発散から収束まで1時間で", "大手製薬：市場リサーチを内製化し、外注費を削減", "さくらインターネット：全社300名のAI研修"],
    note: "送信後、その場で読めます（PDF保存も可）",
    cta: "無料で受け取る", mcta: "受け取る", href: "/library/?doc=cases", short: "事例集を受け取る", mt: "生成AI活用事例集（無料）"
  };
  var TEMPLATES = {
    kind: "無料ダウンロード", img: "/media/cv/gyomuzu.jpg", offer: "guide_gyomuzu_templates",
    title: "部署別 業務図テンプレート集（AIに任せる工程の見つけ方つき）",
    points: ["経理・人事労務・カスタマー対応・総務法務・営業の5部署の業務図の例", "自社の業務をそのまま書き込める空の型", "AIに任せる工程を決める札の付け方（2つの質問）"],
    note: "送信後、その場で読めます（PDF保存も可）",
    cta: "無料で受け取る", mcta: "受け取る", href: "/library/?doc=gyomuzu", short: "業務図テンプレートを受け取る", mt: "部署別 業務図テンプレート集（無料）"
  };
  function companymap(where, img) {
    return {
      kind: "無料相談・30分", img: img || "/media/cv/companymap.jpg", offer: "companymap_consult",
      title: where + "の1つの業務を、30分のオンライン相談で業務図にします",
      points: ["仕事の流れを伺いながら、その場で一緒に描きます", "詰まっている所、AIに任せられる所まで1枚で分かります", "手順書やExcelがあれば、その場で使います（なくても描けます）"],
      note: "最初の1枚は無料。申込みの入力は1分です",
      cta: "無料で業務図をつくる", mcta: "申し込む", href: "/companymap/contact", short: "業務図を無料でつくる", mt: "最初の業務図を無料でつくる（30分）"
    };
  }
  var DIAG = { label: "まずは1分の生成AI活用度診断（登録不要）", href: "/ai-assessment.html", offer: "assessment" };

  var OFFERS = {
    kenshu: function () {
      if (/claude-code/.test(slug)) return Object.assign({}, GUIDE, { sub: { label: "Claude Code研修の内容を見る", href: "/training.html#claude-code", offer: "training_claude_code" } });
      if (/copilot|m365/.test(slug)) return Object.assign({}, CASES, { sub: { label: "Copilotの定着・研修を相談する", href: "/copilot.html#consult", offer: "consult_copilot" } });
      return Object.assign({}, CASES, { sub: DIAG });
    },
    shigyo: function () { return Object.assign(companymap("事務所", "/media/cv/companymap-shigyo.jpg"), { sub: DIAG }); },
    interview: function () { return Object.assign(companymap("部署"), { sub: { label: "CompanyMap AIを見る", href: "/companymap", offer: "companymap_lp" } }); },
    gyomuzu: function () { return Object.assign({}, TEMPLATES, { sub: { label: "自社の業務図を30分の無料相談でつくる", href: "/companymap/contact", offer: "companymap_consult" } }); },
    security: function () { return Object.assign({}, GUIDE, { sub: { label: "社内のAI利用ルールを相談する（30分・無料）", href: "/contact.html?type=consultation", offer: "consult_security" } }); },
    infra: function () { return Object.assign({}, GUIDE, { sub: DIAG }); },
    simulation: function () { return Object.assign({}, CASES, { sub: { label: "発売前の検証を相談する", href: "/launch-simulation/", offer: "launch_simulation" } }); }
  };
  var make = OFFERS[seg] || function () { return Object.assign({}, /token/.test(slug) ? GUIDE : CASES, { sub: DIAG }); };
  var o = make();
  var media = seg || "home";
  var DOCS = { security: GUIDE, cases: CASES, gyomuzu: TEMPLATES };

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
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pointsList(points, cls) {
    var ul = el("ul", cls);
    points.forEach(function (p) { ul.appendChild(el("li", "", p)); });
    return ul;
  }

  var A = "var(--electric,#005EFF)";
  var css =
    ".twd{position:fixed;right:20px;bottom:20px;z-index:60;font-family:var(--jp,'IBM Plex Sans JP',system-ui,sans-serif);color:var(--ink,#11161D);transition:opacity .35s,transform .35s}" +
    ".twd.off{opacity:0;transform:translateY(14px);pointer-events:none}" +
    ".twd-card{width:316px;background:#fff;border:1px solid rgba(13,17,23,.12);border-radius:16px;overflow:hidden;box-shadow:0 30px 70px -28px rgba(13,17,23,.5),0 2px 8px rgba(13,17,23,.06);position:relative}" +
    ".twd-img{display:block;width:100%;height:auto;aspect-ratio:680/300;object-fit:cover;background:#EEF3FF}" +
    ".twd-in{padding:14px 18px 14px}" +
    ".twd-k{display:inline-block;font-size:11.5px;font-weight:700;color:" + A + ";background:color-mix(in srgb," + A + " 9%,#fff);border-radius:999px;padding:3px 10px}" +
    ".twd-t{font-size:15px;font-weight:700;line-height:1.5;margin-top:8px;letter-spacing:-.01em}" +
    ".twd-p{list-style:none;margin:8px 0 0;padding:0}" +
    ".twd-p li{position:relative;padding-left:20px;font-size:12.5px;line-height:1.6;color:var(--ink-soft,#2A333F);margin-top:4px}" +
    ".twd-p li::before{content:'';position:absolute;left:2px;top:.42em;width:11px;height:11px;border-radius:50%;background:" + A + " url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.4l2.6 2.6L12 5.4' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") center/9px no-repeat}" +
    ".twd-b{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;background:" + A + ";color:#fff;text-decoration:none;font-size:14.5px;font-weight:700;border-radius:9px;padding:12px 14px;box-shadow:0 10px 20px -12px color-mix(in srgb," + A + " 80%,transparent);transition:transform .2s,background .2s}" +
    ".twd-b:hover{background:var(--electric-dark,#003DAA);transform:translateY(-1px)}" +
    ".twd-n{font-size:11.5px;color:var(--slate,#5A6677);text-align:center;margin-top:7px}" +
    ".twd-s{display:block;text-align:center;margin-top:8px;padding-top:9px;border-top:1px solid rgba(13,17,23,.08);font-size:12.5px;font-weight:600;color:var(--ink-soft,#2A333F);text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(13,17,23,.25)}" +
    ".twd-x{position:absolute;right:8px;top:8px;width:30px;height:30px;border:0;background:rgba(255,255,255,.92);border-radius:50%;cursor:pointer;color:#4B5563;font-size:17px;line-height:1;box-shadow:0 2px 6px rgba(13,17,23,.15)}.twd-x:hover{background:#fff}" +
    ".twd-mt,.twd-sm,.twd-th{display:none}" +
    ".twd-pill{display:none;align-items:center;gap:10px;border:0;cursor:pointer;background:var(--ink,#11161D);color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;border-radius:999px;padding:6px 18px 6px 6px;box-shadow:0 14px 34px -14px rgba(13,17,23,.6)}" +
    ".twd-pill img{width:34px;height:34px;border-radius:50%;object-fit:cover;object-position:52% 40%;background:#fff}" +
    ".twd.min .twd-card{display:none}.twd.min .twd-pill{display:inline-flex}" +
    "@media(max-width:760px){.twd{left:10px;right:10px;bottom:10px}" +
    ".twd-card{width:auto;display:grid;grid-template-columns:52px 1fr auto;gap:0 12px;align-items:center;padding:8px 40px 8px 8px}" +
    ".twd-img,.twd-k,.twd-t,.twd-p,.twd-n,.twd-s,.twd-lg{display:none}.twd-in{display:contents}" +
    ".twd-th{display:block;width:52px;height:52px;border-radius:10px;object-fit:cover;object-position:52% 40%;background:#EEF3FF}" +
    ".twd-mt{display:block;font-size:13.5px;font-weight:700;line-height:1.4}.twd-mt small{display:block;font-size:11px;font-weight:600;color:" + A + ";margin-bottom:1px}" +
    ".twd-sm{display:inline}.twd-b{margin:0;padding:10px 14px;font-size:13.5px;white-space:nowrap}" +
    ".twd-x{top:50%;transform:translateY(-50%);right:4px;box-shadow:none;background:none}.twd.min{left:auto}}" +
    /* 記事中の申込み（.mid-cta）に見本と中身を足した形 */
    ".mid-cta.rich{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px;align-items:center;padding:20px 22px}" +
    ".mid-cta.rich .mc-img{display:block;width:100%;height:auto;aspect-ratio:680/300;object-fit:cover;border-radius:10px;border:1px solid rgba(13,17,23,.08)}" +
    ".mid-cta.rich .mc-body{min-width:0}" +
    ".mid-cta.rich .mc-p{list-style:none;margin:8px 0 0;padding:0}.mid-cta.rich .mc-p li{position:relative;padding-left:18px;font-size:13px;line-height:1.65;color:var(--ink-soft,#2A333F);margin-top:3px}" +
    ".mid-cta.rich .mc-p li::before{content:'';position:absolute;left:2px;top:.5em;width:8px;height:8px;border-radius:50%;background:" + A + "}" +
    ".mid-cta.rich .btn{grid-column:2;justify-self:start}" +
    ".mid-cta.rich .mc-note{grid-column:2;font-size:12px;color:var(--slate,#5A6677);margin-top:-12px}" +
    "@media(max-width:720px){.mid-cta.rich{grid-template-columns:1fr;gap:14px}.mid-cta.rich .btn,.mid-cta.rich .mc-note{grid-column:1}.mid-cta.rich .mc-note{margin-top:-8px}}" +
    "@media(min-width:761px) and (max-height:760px){.twd-img{display:none}}" +
    "@media(prefers-reduced-motion:reduce){.twd,.twd-b{transition:none}}";

  function build() {
    var box = el("aside", "twd off");
    box.setAttribute("aria-label", o.kind);
    box.setAttribute("data-cta-placement", "dock");
    var card = el("div", "twd-card");
    var img = el("img", "twd-img"); img.src = o.img; img.alt = o.title + "の見本"; img.width = 680; img.height = 300; img.loading = "lazy";
    var th = el("img", "twd-th"); th.src = o.img; th.alt = ""; th.loading = "lazy";
    var inner = el("div", "twd-in");
    inner.appendChild(el("span", "twd-k", o.kind));
    inner.appendChild(el("div", "twd-t", o.title));
    // 右下は情報を絞る（見本・題・ボタン・一言だけ）。中身の具体例は記事中の申込みと受け取りフォームに出す
    var mt = el("div", "twd-mt"); mt.appendChild(el("small", "", o.kind)); mt.appendChild(document.createTextNode(o.mt));
    var b = el("a", "twd-b"); b.href = withUtm(o.href, "primary"); b.setAttribute("data-cta-offer", o.offer);
    b.appendChild(el("span", "twd-lg", o.cta + " →")); b.appendChild(el("span", "twd-sm", o.mcta));
    var x = el("button", "twd-x", "×"); x.type = "button"; x.setAttribute("aria-label", "小さくする");
    card.appendChild(img); card.appendChild(th); card.appendChild(inner); card.appendChild(mt); card.appendChild(b);
    inner.appendChild(b); inner.appendChild(el("div", "twd-n", o.note));
    card.appendChild(x);
    var pill = el("button", "twd-pill"); pill.type = "button"; pill.setAttribute("aria-label", "申込みを開く");
    var pi = el("img"); pi.src = o.img; pi.alt = ""; pill.appendChild(pi); pill.appendChild(el("span", "", o.short));
    box.appendChild(card); box.appendChild(pill);
    document.body.appendChild(box);
    // スマホの帯では、ボタンを帯の右端に置く（カードの直下の要素として並べ替える）
    var mq = window.matchMedia("(max-width:760px)");
    function place() { if (mq.matches) { card.insertBefore(b, x); } else { inner.insertBefore(b, inner.querySelector(".twd-n")); } }
    place(); if (mq.addEventListener) mq.addEventListener("change", place);
    return box;
  }

  // 記事中の申込み（その場で読める資料）に、見本と中身の具体例を足す
  function enrichMidCta() {
    document.querySelectorAll(".mid-cta").forEach(function (m) {
      if (m.classList.contains("rich")) return;
      var a = m.querySelector('a[href*="library/?doc="]'), d;
      if (a) d = DOCS[(a.getAttribute("href").match(/doc=([a-z]+)/) || [])[1]];
      else if ((a = m.querySelector('a[href*="companymap"]'))) d = companymap(seg === "shigyo" ? "事務所" : "部署", seg === "shigyo" ? "/media/cv/companymap-shigyo.jpg" : null);
      if (!a || !d) return;
      var img = el("img", "mc-img"); img.src = d.img; img.alt = d.title + "の見本"; img.loading = "lazy"; img.width = 680; img.height = 300;
      m.insertBefore(img, m.firstChild);
      var body = m.querySelector(".mc-body");
      var t = body && body.querySelector(".mc-t"); if (t) t.textContent = d.title;
      var desc = body && body.querySelector(".mc-d"); if (desc) desc.remove();
      if (body) body.appendChild(pointsList(d.points, "mc-p"));
      a.textContent = d.cta + " →";
      m.appendChild(el("div", "mc-note", d.note));
      m.classList.add("rich");
    });
  }

  var box, shown = false, blocked = 0;
  var KEY = "tw_dock_min";
  function isMin() { try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function setMin(v) { try { v ? sessionStorage.setItem(KEY, "1") : sessionStorage.removeItem(KEY); } catch (e) {} }
  function render() { if (box) box.classList.toggle("off", !shown || blocked > 0); }
  function show() {
    if (shown) return;
    shown = true;
    if (isMin()) box.classList.add("min");
    render();
    gaEvent("media_dock_view", { dock_state: isMin() ? "min" : "open" });
  }

  function init() {
    var st = el("style"); st.textContent = css; document.head.appendChild(st);
    enrichMidCta();
    box = build();
    box.querySelector(".twd-x").addEventListener("click", function () { box.classList.add("min"); setMin(true); gaEvent("media_dock_close"); });
    box.querySelector(".twd-pill").addEventListener("click", function () { box.classList.remove("min"); setMin(false); gaEvent("media_dock_open"); });

    // メール登録の枠（newsletter.js）は後から差し込まれることがあるので、差し込んだ側からも登録できるようにする
    var targets = document.querySelectorAll(".mid-cta, .art-cta, .mh-band, .inline-dx-cta, footer, .lb-cta, .nl-box");
    if ("IntersectionObserver" in window) {
      var seen = new Set();
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); });
        blocked = seen.size;
        render();
      }, { threshold: 0.15 });
      targets.forEach(function (t) { io.observe(t); });
      window.__twDockObserve = function (el) { io.observe(el); };
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
