/* メールで受け取る（テーマを選んで登録）。2026-10-01
 * ホーム・登録ページ: 4テーマを説明つきで並べる（full）
 * 各メディアの一覧・記事: 小さな枠で、そのメディアのテーマに最初からチェック（compact）
 * 登録は /api/newsletter（functions/api/newsletter.js）へ送る */
(function () {
  "use strict";
  if (window.__twNewsletterLoaded) return;
  window.__twNewsletterLoaded = true;

  var TOPICS = [
    { k: "gyomuzu", n: "業務図・AIの持ち場", d: "部署の業務を業務図にして、どの工程をAIに任せるかを決める方法" },
    { k: "kenshu", n: "AI研修・導入", d: "Copilot・Gemini・Claude Codeを法人で導入し、定着させるための費用・研修・稟議" },
    { k: "shigyo", n: "士業のAI活用", d: "税理士・社労士・行政書士などの事務所で、書面作成や相談対応にAIを使う方法" },
    { k: "interview", n: "AIインタビュー・業務の見える化", d: "従業員や顧客の声をAIで聞き取り、業務図や意思決定に使う方法" },
    { k: "security", n: "AIセキュリティ", d: "生成AIを社内で安全に使うためのルール・設定・守り方" }
  ];
  var BY_KEY = {};
  TOPICS.forEach(function (t) { BY_KEY[t.k] = t; });

  var path = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "").replace(/\/$/, "") || "/";
  var m = path.match(/^\/media(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?$/);
  if (!m) return;
  var seg = m[1] || "", slug = m[2] || "";

  var css =
    ".nl-box{position:relative;background:var(--white,#FBFCFD);border:1px solid var(--line-2,rgba(13,17,23,.18));border-radius:16px;padding:26px 28px;font-family:var(--jp,system-ui,sans-serif);color:var(--ink,#11161D)}" +
    ".nl-full{padding:40px 44px;margin-top:84px}" +
    ".nl-art{max-width:var(--measure,720px);margin:40px auto 0}" +
    ".nl-hubwrap{max-width:1100px;margin:56px auto 0;padding:0 48px}" +
    ".nl-k{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--electric,#005EFF)}" +
    ".nl-h{font-weight:700;font-size:clamp(21px,2.3vw,27px);letter-spacing:-.02em;line-height:1.45;margin-top:8px}" +
    ".nl-lead{font-size:14.5px;line-height:1.85;color:var(--slate,#5A6677);margin-top:8px;max-width:44em}" +
    ".nl-compact .nl-h{font-size:17px;margin-top:0;letter-spacing:-.01em}" +
    ".nl-compact .nl-lead{font-size:13.5px;margin-top:4px}" +
    ".nl-ts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:22px;border:0;padding:0}" +
    ".nl-t{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border:1px solid var(--line-2,rgba(13,17,23,.18));border-radius:12px;background:#fff;cursor:pointer;transition:border-color .15s,background .15s}" +
    ".nl-t:hover{border-color:var(--electric,#005EFF)}" +
    ".nl-t input{appearance:none;-webkit-appearance:none;flex:0 0 20px;width:20px;height:20px;margin:1px 0 0;border:1.5px solid var(--line-2,rgba(13,17,23,.18));border-radius:6px;background:#fff;display:grid;place-content:center;cursor:pointer}" +
    ".nl-t input:checked{background:var(--electric,#005EFF);border-color:var(--electric,#005EFF)}" +
    ".nl-t input:checked::after{content:'';width:10px;height:6px;border:2px solid #fff;border-top:0;border-right:0;transform:translateY(-1px) rotate(-45deg)}" +
    ".nl-t input:focus-visible{outline:2px solid var(--electric,#005EFF);outline-offset:2px}" +
    ".nl-t.on{border-color:var(--electric,#005EFF);background:color-mix(in srgb,var(--electric,#005EFF) 6%,#fff)}" +
    ".nl-tn{display:block;font-weight:700;font-size:15px;line-height:1.5}" +
    ".nl-td{display:block;font-size:13px;line-height:1.7;color:var(--slate,#5A6677);margin-top:3px}" +
    ".nl-compact .nl-ts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}" +
    ".nl-compact .nl-t{padding:7px 14px 7px 10px;border-radius:999px;align-items:center;gap:8px}" +
    ".nl-compact .nl-t input{flex-basis:16px;width:16px;height:16px;margin:0;border-radius:5px}" +
    ".nl-compact .nl-t input:checked::after{width:8px;height:5px}" +
    ".nl-compact .nl-tn{font-size:13.5px;font-weight:600}" +
    ".nl-compact .nl-td{display:none}" +
    ".nl-row{display:flex;gap:10px;margin-top:18px;max-width:560px}" +
    ".nl-in{flex:1;min-width:0;font:inherit;font-size:15px;padding:13px 14px;border:1px solid var(--line-2,rgba(13,17,23,.18));border-radius:8px;background:#fff;color:inherit}" +
    ".nl-in:focus{outline:2px solid var(--electric,#005EFF);outline-offset:1px}" +
    ".nl-btn{font:inherit;font-size:15px;font-weight:700;color:#fff;background:var(--ink,#11161D);border:0;border-radius:8px;padding:0 26px;cursor:pointer;white-space:nowrap;transition:background .15s}" +
    ".nl-btn:hover{background:var(--electric,#005EFF)}" +
    ".nl-btn[disabled]{opacity:.6;cursor:default}" +
    ".nl-note{font-size:12px;line-height:1.8;color:var(--slate,#5A6677);margin-top:10px}" +
    ".nl-note a{color:inherit}" +
    ".nl-msg{font-size:13.5px;font-weight:600;color:#C0362C;margin-top:6px}" +
    ".nl-msg:empty{display:none}" +
    ".nl-ok{margin-top:18px;padding:16px 18px;border-radius:12px;background:color-mix(in srgb,#0E7C66 8%,#fff);border:1px solid color-mix(in srgb,#0E7C66 35%,#fff);font-size:14.5px;line-height:1.8}" +
    ".nl-ok b{display:block;font-size:15.5px}" +
    ".nl-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}" +
    ".nl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}" +
    "@media(max-width:880px){.nl-hubwrap{padding:0 24px}}" +
    "@media(max-width:640px){.nl-hubwrap{padding:0 16px}.nl-box{padding:22px 18px}.nl-full{padding:28px 20px;margin-top:64px}.nl-ts{grid-template-columns:1fr}.nl-row{flex-direction:column}.nl-btn{padding:13px}}";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function gaEvent(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, Object.assign({ article_path: path, transport_type: "beacon" }, params));
  }

  function build(variant, checked, placement) {
    var full = variant === "full";
    var one = BY_KEY[checked[0]];
    var head = full
      ? '<p class="nl-k">メールで受け取る</p><h2 class="nl-h">読みたいテーマだけ、メールで届きます</h2>' +
        '<p class="nl-lead">5つのテーマから選べます。選んだテーマで新しい記事が出た週に、週1回まとめてお送りします。</p>'
      : '<h3 class="nl-h">' + (one && checked.length === 1 ? "「" + esc(one.n) + "」の新着を、メールで受け取る" : "読みたいテーマの新着を、メールで受け取る") + "</h3>" +
        '<p class="nl-lead">選んだテーマで新しい記事が出た週に、週1回まとめてお送りします。ほかのテーマも選べます。</p>';
    var ts = TOPICS.map(function (t) {
      var on = checked.indexOf(t.k) !== -1;
      return '<label class="nl-t' + (on ? " on" : "") + '"><input type="checkbox" name="topics" value="' + t.k + '"' + (on ? " checked" : "") + ">" +
        '<span><span class="nl-tn">' + esc(t.n) + '</span><span class="nl-td">' + esc(t.d) + "</span></span></label>";
    }).join("");
    var box = document.createElement("section");
    box.className = "nl-box " + (full ? "nl-full" : "nl-compact") + (placement === "article" ? " nl-art" : "");
    box.setAttribute("data-cta-placement", "newsletter");
    box.innerHTML = head +
      '<form class="nl-form" novalidate>' +
      '<fieldset class="nl-ts"><legend class="nl-sr">受け取るテーマ</legend>' + ts + "</fieldset>" +
      '<div class="nl-row"><input class="nl-in" type="email" name="email" placeholder="メールアドレス" autocomplete="email" aria-label="メールアドレス" required>' +
      '<button class="nl-btn" type="submit">登録する</button></div>' +
      '<input class="nl-hp" type="text" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="nl-msg" role="alert"></p>' +
      '<p class="nl-note">登録すると、<a href="/privacy.html">プライバシーポリシー</a>に沿ってメールアドレスを扱います。配信は、メールの下のリンクからいつでも止められます。</p>' +
      "</form>";
    wire(box, placement);
    return box;
  }

  function wire(box, placement) {
    var form = box.querySelector("form"), msg = box.querySelector(".nl-msg"), btn = box.querySelector(".nl-btn");
    form.addEventListener("change", function (e) {
      if (e.target.name === "topics") e.target.closest(".nl-t").classList.toggle("on", e.target.checked);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var topics = [].slice.call(form.querySelectorAll('input[name="topics"]:checked')).map(function (i) { return i.value; });
      var email = form.email.value.trim();
      if (!topics.length) { msg.textContent = "受け取るテーマを1つ以上選んでください。"; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "メールアドレスをご確認ください。"; form.email.focus(); return; }
      msg.textContent = "";
      btn.disabled = true;
      btn.textContent = "登録しています";
      fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, topics: topics, page: location.pathname, hp: form.hp.value })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; });
      }).then(function (res) {
        if (!res.ok) throw new Error(res.body.error || "failed");
        var names = topics.map(function (k) { return "「" + BY_KEY[k].n + "」"; }).join("");
        form.outerHTML = '<div class="nl-ok" role="status"><b>登録しました。</b>' + esc(names) + "の新着を、次の配信からお届けします。</div>";
        gaEvent("newsletter_signup", { nl_topics: topics.join(","), nl_placement: placement });
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = "登録する";
        msg.textContent = err.message === "invalid_email" ? "メールアドレスをご確認ください。" : "登録できませんでした。時間をおいて、もう一度お試しください。";
      });
    });
  }

  function insertBefore(el, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var ref = document.querySelector(selectors[i]);
      if (ref) { ref.parentNode.insertBefore(el, ref); return true; }
    }
    return false;
  }

  function init() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);

    var box, placed;
    var mine = BY_KEY[seg] ? [seg] : [];
    if (seg === "newsletter" && !slug) {
      var pre = new URLSearchParams(location.search).get("t");
      var slot = document.querySelector("[data-nl]");
      if (!slot) return;
      box = build("full", BY_KEY[pre] ? [pre] : [], "page");
      slot.replaceWith(box);
      placed = true;
    } else if (!seg) {
      box = build("full", [], "home");
      placed = insertBefore(box, [".mh-band", "footer"]);
    } else if (!slug && BY_KEY[seg]) {
      box = build("compact", mine, "hub");
      var wrap = document.createElement("div");
      wrap.className = "nl-hubwrap";
      wrap.appendChild(box);
      placed = insertBefore(wrap, ["#about", ".kn-legal", "footer"]);
    } else if (document.querySelector("article, .art-cta")) {
      // 記事（媒体の直下の記事も含む）。媒体のテーマが無ければチェック無しで出す
      box = build("compact", slug ? mine : [], "article");
      placed = insertBefore(box, [".back-list", ".related", "footer"]);
    }
    if (!placed) return;
    if (typeof window.__twDockObserve === "function") window.__twDockObserve(box);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
