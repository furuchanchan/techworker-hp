(function () {
  "use strict";

  if (window.__techworkerMediaTrackerLoaded) return;
  window.__techworkerMediaTrackerLoaded = true;

  // 問い合わせの流入元の記録（/assets/tw-track.js）が入っていない記事でも読み込む。
  // 記事は自動で作っているので、入れ忘れても入口の記事が記録から抜けないようにする
  if (!document.querySelector('script[src="/assets/tw-track.js"]')) {
    var tw = document.createElement("script");
    tw.src = "/assets/tw-track.js";
    document.head.appendChild(tw);
  }

  var path = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
  var title = document.title || "";
  var fired = {};

  function send(name, params) {
    if (fired[name] && name !== "media_cta_click") return;
    if (typeof window.gtag !== "function") return;
    fired[name] = true;
    window.gtag("event", name, Object.assign({
      article_path: path,
      article_title: title.slice(0, 100),
      transport_type: "beacon"
    }, params || {}));
  }

  function kindFor(anchor) {
    var href = (anchor.getAttribute("href") || "").toLowerCase();
    if (href.indexOf("type=document") !== -1) return "download";
    if (href.indexOf("contact") !== -1 || href.indexOf("appointments") !== -1) return "consultation";
    if (href.indexOf("ai-assessment") !== -1) return "assessment";
    if (href.indexOf("library") !== -1 || anchor.hasAttribute("download")) return "download";
    if (/training|new-business|launch-simulation|coesignal|companymap/.test(href)) return "service";
    if (href.indexOf("/media/") !== -1 || href.indexOf(".html") !== -1) return "internal";
    return "other";
  }

  // どの場所の申込みが押されたか（右下・記事中・記事末・ナビ・本文）
  function placementOf(anchor) {
    var el = anchor.closest("[data-cta-placement]");
    if (el) return el.getAttribute("data-cta-placement");
    if (anchor.closest(".mid-cta")) return "mid";
    if (anchor.closest(".art-cta")) return "end";
    if (anchor.closest("#nav, .mmenu")) return "nav";
    if (anchor.closest(".mh-band, .lb-cta")) return "band";
    return "body";
  }

  function addCoeSignalAttribution(anchor) {
    var url = new URL(anchor.href, location.href);
    if (url.hostname !== "coesignal.techworker.co.jp") return;
    if (!url.searchParams.has("utm_source")) url.searchParams.set("utm_source", "techworker");
    if (!url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", "owned_media");
    if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", "ai_interview_lab");
    if (!url.searchParams.has("utm_content")) {
      var pageSlug = path === "/media/interview" ? "portal" : path.split("/").pop();
      url.searchParams.set("utm_content", pageSlug || "media");
    }
    anchor.href = url.toString();
  }

  document.addEventListener("click", function (event) {
    var anchor = event.target.closest && event.target.closest("a[href]");
    if (!anchor) return;
    addCoeSignalAttribution(anchor);
    var kind = kindFor(anchor);
    if (["consultation", "assessment", "download", "service"].indexOf(kind) === -1) return;
    send("media_cta_click", {
      cta_kind: kind,
      cta_text: (anchor.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      cta_destination: anchor.href.slice(0, 200),
      cta_placement: placementOf(anchor),
      cta_offer: anchor.getAttribute("data-cta-offer") || ""
    });
  }, true);

  var maxDepth = 0;
  var engaged = false;
  var seconds = 0;
  var timer = setInterval(function () {
    if (!document.hidden) seconds += 5;
    if (!engaged && seconds >= 60 && maxDepth >= 50) {
      engaged = true;
      clearInterval(timer);
      send("media_engaged_read", { engaged_seconds: seconds, scroll_depth: maxDepth });
    }
  }, 5000);

  addEventListener("scroll", function () {
    var root = document.documentElement;
    var range = root.scrollHeight - root.clientHeight;
    if (range <= 0) return;
    maxDepth = Math.max(maxDepth, Math.round(root.scrollTop / range * 100));
  }, { passive: true });

  // 右下の申込み枠（媒体ごとの申込み）
  if (!document.querySelector('script[src="/media/cv-dock.js"]')) {
    var dock = document.createElement("script");
    dock.src = "/media/cv-dock.js";
    dock.defer = true;
    document.head.appendChild(dock);
  }

  // メールで受け取る（テーマを選んで登録する枠）
  if (!document.querySelector('script[src="/media/newsletter.js"]')) {
    var nl = document.createElement("script");
    nl.src = "/media/newsletter.js";
    nl.defer = true;
    document.head.appendChild(nl);
  }
})();
