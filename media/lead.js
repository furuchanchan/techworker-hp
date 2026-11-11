/* 記事の中で、その場で資料を受け取れる申込み枠（2026-11-11）。
   記事に <div class="tw-lead" data-offer="ai-contract-pack" data-campaign="<slug>" data-pos="mid|end"></div> を置くと、ここが中身を描く。
   入力は会社名・お名前・メールの3つだけ（電話・部署・役職は聞かない）。送ると /contact に media_document で届き（Notion と Slack）、
   その場で資料のリンクを出す。計測: media_lead_view（枠が見えた）・media_lead_start（入力を始めた）・generate_lead（送れた）。 */
(function () {
  "use strict";
  if (window.__twLead) return;
  window.__twLead = true;

  var OFFERS = {
    "ai-contract-pack": {
      title: "生成AIの法人契約 稟議パック",
      sub: "ChatGPT・Claude・Gemini・Copilot の料金比較表／稟議書の雛形／社内利用ルールの雛形",
      points: [
        "4社の法人プランの料金・最低席数・データの扱いを1枚に（公式で確認した日付つき）",
        "件名から承認者まで、［　］を埋めれば出せる稟議書の文例",
        "入力してよい情報・だめな情報を決める、社内利用ルールの雛形"
      ],
      url: "/library/ai-contract-pack.html",
      nl: "kenshu"
    },
    "gyomuzu-templates": {
      title: "部署別 業務図テンプレート集",
      sub: "経理・人事労務・カスタマー対応・総務法務・営業の業務図の例／自社用の空の型／AIに任せる範囲の札の付け方",
      points: [
        "5つの部署の仕事の流れを1枚の図にした例と、AIに任せる候補の工程・人が判断する工程の表",
        "自社の担当と工程を書き込める空の型（業務図の下書き・工程ごとの書き込み表）",
        "工程ごとに「AIが自動で／AIが下書き／人が行う」を決める3つの見方"
      ],
      url: "/library/gyomuzu-templates.html",
      nl: "gyomuzu"
    }
  };

  var CSS =
    ".tw-lead{margin:40px 0;border:1px solid var(--line,rgba(13,17,23,.1));border-radius:14px;background:#fff;padding:24px 22px;box-shadow:0 1px 0 rgba(13,17,23,.04)}" +
    ".tw-lead *{box-sizing:border-box}" +
    ".tw-lead .tl-kicker{font-size:12px;letter-spacing:.06em;color:var(--electric-dark,#8A6339);font-weight:700;margin:0 0 6px}" +
    ".tw-lead .tl-title{font-size:20px;line-height:1.45;font-weight:700;color:var(--ink,#0D1117);margin:0 0 4px}" +
    ".tw-lead .tl-sub{font-size:13.5px;color:var(--slate,#4A5059);margin:0 0 12px;line-height:1.7}" +
    ".tw-lead ul{margin:0 0 16px;padding:0;list-style:none}" +
    ".tw-lead ul li::before{display:none!important}" +
    ".tw-lead ul li{position:relative;padding-left:16px!important}" +
    ".tw-lead ul li::after{content:'';position:absolute;left:2px;top:.72em;width:6px;height:6px;border-radius:50%;background:var(--electric,#A47948)}" +
    ".tw-lead ul li{font-size:14px;line-height:1.75;margin:2px 0;padding:0;color:var(--ink-soft,#2B3038)}" +
    ".tw-lead form{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".tw-lead input[type=text],.tw-lead input[type=email]{width:100%;font:inherit;font-size:15px;padding:11px 12px;border:1px solid rgba(13,17,23,.22);border-radius:8px;background:#fff;color:var(--ink,#0D1117)}" +
    ".tw-lead input:focus{outline:2px solid var(--electric,#A47948);outline-offset:1px}" +
    ".tw-lead .tl-email{grid-column:1/-1}" +
    ".tw-lead .tl-row{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}" +
    ".tw-lead button{font:inherit;font-size:15px;font-weight:700;background:var(--ink,#0D1117);color:#fff;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}" +
    ".tw-lead button[disabled]{opacity:.6;cursor:wait}" +
    ".tw-lead .tl-fine{font-size:12px;color:var(--slate,#4A5059);line-height:1.6;margin:0}" +
    ".tw-lead .tl-fine a{color:inherit}" +
    ".tw-lead label.tl-nl{grid-column:1/-1;font-size:13px;color:var(--slate,#4A5059);display:flex;gap:8px;align-items:flex-start}" +
    ".tw-lead .tl-done a.tl-open{display:inline-block;margin:10px 0 6px;background:var(--electric-dark,#8A6339);color:#fff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 20px}" +
    ".tw-lead .tl-err{grid-column:1/-1;color:#B42318;font-size:13px;margin:0}" +
    "@media (max-width:560px){.tw-lead{padding:20px 16px}.tw-lead form{grid-template-columns:1fr}.tw-lead .tl-title{font-size:18px}.tw-lead button{width:100%}}";

  function ev(name, params) {
    if (typeof gtag === "function") { try { gtag("event", name, params); } catch (_) {} }
  }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  var STORE = "tw_lead_done";
  function done() { try { return localStorage.getItem(STORE) === "1"; } catch (_) { return false; } }
  function setDone() { try { localStorage.setItem(STORE, "1"); } catch (_) {} }

  function renderDone(box, offer) {
    var d = el("div", { class: "tl-done" });
    d.appendChild(el("p", { class: "tl-title" }, "お送りいただきありがとうございます"));
    d.appendChild(el("p", { class: "tl-sub" }, "資料は下のボタンからすぐに開けます。同じ内容をご登録のメールにもお送りする場合があります。"));
    var a = el("a", { class: "tl-open", href: offer.url, target: "_blank", rel: "noopener" }, "資料を開く");
    d.appendChild(a);
    var p = el("p", { class: "tl-fine" });
    p.appendChild(document.createTextNode("社内展開の進め方を相談したい場合は "));
    var k = el("a", { href: "https://kenshu.techworker.co.jp/contact/?utm_source=techworker_media&utm_medium=lead&utm_campaign=" + encodeURIComponent(box.dataset.campaign || "") }, "研修の無料相談（30分）");
    p.appendChild(k);
    p.appendChild(document.createTextNode(" へ。"));
    d.appendChild(p);
    box.innerHTML = "";
    box.appendChild(d);
  }

  function render(box) {
    var offer = OFFERS[box.dataset.offer];
    if (!offer) return;
    var camp = box.dataset.campaign || location.pathname;
    var pos = box.dataset.pos || "";
    box.setAttribute("id", box.id || "tw-lead-" + pos);
    if (done()) { renderDone(box, offer); return; }

    box.appendChild(el("p", { class: "tl-kicker" }, "無料で受け取る"));
    box.appendChild(el("p", { class: "tl-title" }, offer.title));
    box.appendChild(el("p", { class: "tl-sub" }, offer.sub));
    var ul = el("ul");
    offer.points.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    box.appendChild(ul);

    var f = el("form", { novalidate: "" });
    var company = el("input", { type: "text", name: "company", placeholder: "会社名", autocomplete: "organization", required: "", "aria-label": "会社名" });
    var name = el("input", { type: "text", name: "name", placeholder: "お名前", autocomplete: "name", required: "", "aria-label": "お名前" });
    var email = el("input", { type: "email", name: "email", placeholder: "会社のメールアドレス", autocomplete: "email", required: "", class: "tl-email", "aria-label": "メールアドレス" });
    var hp = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", style: "position:absolute;left:-9999px;width:1px;height:1px", "aria-hidden": "true" });
    var nlLabel = el("label", { class: "tl-nl" });
    var nl = el("input", { type: "checkbox", name: "nl" });
    nlLabel.appendChild(nl);
    nlLabel.appendChild(document.createTextNode("新着記事をメールで受け取る（週1回・いつでも停止できます）"));
    var row = el("div", { class: "tl-row" });
    var btn = el("button", { type: "submit" }, "資料を受け取る");
    var fine = el("p", { class: "tl-fine" });
    fine.innerHTML = '送信すると<a href="/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>に同意したものとします。しつこい営業はしません。';
    row.appendChild(btn);
    row.appendChild(fine);
    var err = el("p", { class: "tl-err", role: "alert" });
    [company, name, email, hp, nlLabel, row, err].forEach(function (x) { f.appendChild(x); });
    box.appendChild(f);

    var started = false;
    f.addEventListener("input", function () {
      if (started) return;
      started = true;
      ev("media_lead_start", { lead_offer: box.dataset.offer, lead_pos: pos, campaign: camp });
    });

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      err.textContent = "";
      var v = { company: company.value.trim(), name: name.value.trim(), email: email.value.trim() };
      if (!v.company || !v.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
        err.textContent = "会社名・お名前・メールアドレスを入れてください。";
        return;
      }
      if (hp.value) return;
      btn.disabled = true;
      btn.textContent = "送信中…";
      var payload = {
        name: v.name, company: v.company, email: v.email, phone: "", department: "", position: "",
        inquiry_type: "media_document",
        message: "【記事から資料】" + offer.title + "（記事: " + location.pathname + "／位置: " + pos + "）",
        source: "media"
      };
      if (window.twIntent) { try { Object.assign(payload, window.twIntent()); } catch (_) {} }
      fetch("/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json().catch(function () { return {}; });
        })
        .then(function (j) {
          if (j.lead !== false) ev("generate_lead", { inquiry_type: "media_document", source: "media", lead_offer: box.dataset.offer, lead_pos: pos, campaign: camp });
          if (nl.checked) {
            fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: v.email, topics: [offer.nl], page: location.pathname, hp: "" }) })
              .then(function (r) { if (r.ok) ev("newsletter_signup", { nl_topics: offer.nl, nl_placement: "media_lead", method: "media_lead" }); })
              .catch(function () {});
          }
          setDone();
          document.querySelectorAll(".tw-lead").forEach(function (b) { renderDone(b, OFFERS[b.dataset.offer] || offer); });
        })
        .catch(function (x) {
          console.error("lead submit failed", x);
          err.textContent = "送信できませんでした。時間をおいてもう一度お試しください。";
          btn.disabled = false;
          btn.textContent = "資料を受け取る";
        });
    });

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          if (x.isIntersecting) { ev("media_lead_view", { lead_offer: box.dataset.offer, lead_pos: pos, campaign: camp }); io.disconnect(); }
        });
      }, { threshold: 0.5 });
      io.observe(box);
    }
  }

  function init() {
    var boxes = document.querySelectorAll(".tw-lead");
    if (!boxes.length) return;
    var s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
    boxes.forEach(render);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
