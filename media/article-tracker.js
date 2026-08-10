(function () {
  "use strict";

  if (window.__techworkerMediaTrackerLoaded) return;
  window.__techworkerMediaTrackerLoaded = true;

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
    if (href.indexOf("contact") !== -1 || href.indexOf("appointments") !== -1) return "consultation";
    if (href.indexOf("ai-assessment") !== -1) return "assessment";
    if (href.indexOf("library") !== -1 || anchor.hasAttribute("download")) return "download";
    if (/training|new-business|launch-simulation|coesignal/.test(href)) return "service";
    if (href.indexOf("/media/") !== -1 || href.indexOf(".html") !== -1) return "internal";
    return "other";
  }

  document.addEventListener("click", function (event) {
    var anchor = event.target.closest && event.target.closest("a[href]");
    if (!anchor) return;
    var kind = kindFor(anchor);
    if (["consultation", "assessment", "download", "service"].indexOf(kind) === -1) return;
    send("media_cta_click", {
      cta_kind: kind,
      cta_text: (anchor.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      cta_destination: anchor.href.slice(0, 200)
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
})();
