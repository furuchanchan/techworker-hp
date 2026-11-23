/* 記事の中で、その場で資料を受け取れる申込み枠（2026-11-11）。
   記事に <div class="tw-lead" data-offer="ai-contract-pack" data-campaign="<slug>" data-pos="mid|end"></div> を置くと、ここが中身を描く。
   入力は会社名・お名前・メールの3つだけ（電話・部署・役職は聞かない）。送ると /contact に media_document で届き（Notion と Slack）、
   その場で資料のリンクを出す。計測: media_lead_view（枠が見えた）・media_calc_use（試算を触った）・media_lead_open（入力を開いた）・media_lead_start（入力を始めた）・generate_lead（送れた）。
   2026-11-20: 稟議パックの記事の途中（data-pos="mid"）は、入力の要らない安全度チェック（研修サイト /check/）への案内に替えた。
   11/11〜11/19 に入力の枠は213回見られて入力開始0、申込みに届いた1件は安全度チェックを通っていたため。資料の枠は記事の後ろに残す（途中の枠しか無い記事には本文の最後に足す）。
   計測: media_check_view（案内が見えた）・media_check_click（押した）。 */
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
logos: [["/assets/logos/chatgpt.png", "ChatGPT"], ["/assets/logos/claude.svg", "Claude"], ["/assets/logos/gemini-2025.png", "Gemini"], ["/assets/copilot/microsoft/copilot.svg", "Microsoft 365 Copilot"]],
      img: "/library/figs/ai-contract-pack-table.jpg",
      imgAlt: "4社の法人プランの比較表。ChatGPT・Claude・Gemini・Microsoft 365 Copilot の入口の契約と、1人当たりの月額を並べた表。",
      url: "/library/ai-contract-pack.html",
      nl: "kenshu"
    },
    "copilot-ignite-sheet": {
      kicker: "Excel を無料で受け取る",
      title: "Copilot 稟議の追加分シート（Ignite 2026 対応）",
      sub: "人数を入れると、Copilot・Agent 365・クレジットの月額と年額が出ます",
      img: "/media/kenshu/figs/ignite-2026-copilot-sheet.png",
      imgAlt: "Excelの画面。Copilotを使う人数、Agent 365を付ける人数、クレジットの月の上限を入れると、費用の行ごとの月額と年額、合計が出る表。",
      points: [
        "席の料金・Agent 365・クレジットの上限を、月額と年額で1枚に（2026年11月18日に公式で確認した価格）",
        "2つの質問に答えると、Agent 365 の要否が出る",
        "稟議に足す行の文例と、今週決める5つの担当・期限の表"
      ],
logos: [["/assets/copilot/microsoft/copilot.svg", "Microsoft 365 Copilot"], ["/assets/copilot/microsoft/excel.svg", "Excel"]],
      calc: "copilot",
      url: "/library/copilot-ignite-sheet.html",
      nl: "kenshu"
    },
    "claude-cost-sheet": {
      kicker: "Excel を無料で受け取る",
      title: "Claude 法人契約の費用試算シート",
      sub: "人数と1人当たりの利用量を入れると、Team・Enterprise・API従量の月額と年額が出ます",
      img: "/media/kenshu/figs/claude-code-cost-sheet.png",
      imgAlt: "Excelの画面。為替、消費税率、1人当たりの利用量、契約ごとの人数を入れると、月額のドルと年額の円、合計が出る表。",
      points: [
        "Team Standard・Premium・Enterprise・API従量を、月額（ドル）と年額（円・税込）で1枚に（2026年11月20日に公式で確認した価格）",
        "件名から見直しの時期まで、［　］を埋めれば出せる稟議の行の文例",
        "契約を決めて稟議に載せるまでの5つの手順と、担当・期限の表"
      ],
logos: [["/assets/logos/claude.svg", "Claude"], ["/assets/copilot/microsoft/excel.svg", "Excel"]],
      calc: "claude",
      url: "/library/claude-cost-sheet.html",
      nl: "kenshu"
    },
    "gyomuzu-templates": {
      title: "部署別 業務図テンプレート集",
      sub: "経理・人事労務・カスタマー対応・総務法務・製造・営業の業務図の例／自社用の空の型／AIに任せる範囲の札の付け方",
      points: [
        "6つの部署の仕事の流れを1枚の図にした例と、AIに任せる候補の工程・人が判断する工程の表",
        "自社の担当と工程を書き込める空の型（業務図の下書き・工程ごとの書き込み表）",
        "工程ごとに「AIが自動で／AIが下書き／人が行う」を決める3つの見方"
      ],
img: "/library/figs/gyomuzu/accounting.png",
      imgAlt: "経理の月次の締めの業務図の例。各部署・経理担当・経理責任者・AIの段に、工程ごとの担当が並ぶ。",
      url: "/library/gyomuzu-templates.html",
      nl: "gyomuzu"
    }
  };

  var CSS =
    ".tw-lead{margin:40px 0;border:1px solid var(--line,rgba(13,17,23,.1));border-radius:14px;background:#fff;padding:24px 22px;box-shadow:0 1px 0 rgba(13,17,23,.04)}" +
    ".tw-lead *{box-sizing:border-box}" +
    ".tw-lead .tl-kicker{font-size:12px;letter-spacing:.06em;color:var(--electric-dark,#0047C2);font-weight:700;margin:0 0 6px}" +
    ".tw-lead .tl-lg{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 12px}" +
    ".tw-lead .tl-lg span{display:inline-flex;align-items:center;gap:8px;border:1px solid #D5D9E0;border-radius:6px;background:#fff;padding:5px 12px 5px 8px;font-size:13px;font-weight:700;color:var(--ink,#0D1117)}" +
    ".tw-lead .tl-lg img{display:block;height:22px;width:auto}" +
    ".tw-lead .tl-img{display:block;width:100%;height:auto;margin:14px 0 6px;border:1px solid #D9D9D9;border-radius:8px;background:#fff}" +
    ".tw-lead .tl-title{font-size:20px;line-height:1.45;font-weight:700;color:var(--ink,#0D1117);margin:0 0 4px}" +
    ".tw-lead .tl-sub{font-size:13.5px;color:var(--slate,#4A5059);margin:0 0 12px;line-height:1.7}" +
    ".tw-lead ul{margin:0 0 16px;padding:0;list-style:none}" +
    ".tw-lead ul li::before{display:none!important}" +
    ".tw-lead ul li{position:relative;padding-left:16px!important}" +
    ".tw-lead ul li::after{content:'';position:absolute;left:2px;top:.72em;width:6px;height:6px;border-radius:50%;background:var(--electric,#005EFF)}" +
    ".tw-lead ul li{font-size:14px;line-height:1.75;margin:2px 0;padding:0;color:var(--ink-soft,#2B3038)}" +
    ".tw-lead form{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".tw-lead input[type=text],.tw-lead input[type=email],.tw-lead input[type=tel]{width:100%;font:inherit;font-size:15px;padding:11px 12px;border:1px solid rgba(13,17,23,.22);border-radius:8px;background:#fff;color:var(--ink,#0D1117)}" +
    ".tw-lead input:focus{outline:2px solid var(--electric,#005EFF);outline-offset:1px}" +
    ".tw-lead .tl-row{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}" +
    ".tw-lead button{font:inherit;font-size:15px;font-weight:700;background:var(--electric,#005EFF);color:#fff;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}" +
    ".tw-lead button[disabled]{opacity:.6;cursor:wait}" +
    ".tw-lead .tl-fine{font-size:12px;color:var(--slate,#4A5059);line-height:1.6;margin:0}" +
    ".tw-lead .tl-fine a{color:inherit}" +
    ".tw-lead fieldset.tl-pains{grid-column:1/-1;border:0;padding:0;margin:4px 0 0;min-width:0}" +
    ".tw-lead .tl-pains legend{font-size:13px;font-weight:700;color:var(--ink,#0D1117);padding:0;margin:0 0 8px}" +
    ".tw-lead .tl-pains legend span{font-weight:400;color:var(--slate,#4A5059);margin-left:6px}" +
    ".tw-lead .tl-pains .tl-ps{display:flex;flex-wrap:wrap;gap:8px}" +
    ".tw-lead .tl-pains label{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;line-height:1.4;color:var(--ink,#0D1117);border:1px solid rgba(13,17,23,.22);border-radius:999px;padding:7px 13px;background:#fff;cursor:pointer}" +
    ".tw-lead .tl-pains label:has(input:checked){border-color:var(--ink,#0D1117);background:#f2f2f2;font-weight:700}" +
    ".tw-lead .tl-pains input[type=checkbox]{width:15px;height:15px;margin:0;accent-color:#0D1117}" +
    ".tw-lead .tl-pains input.tl-other{margin-top:8px}" +
    ".tw-lead .tl-need{grid-column:1/-1;font-size:13px;font-weight:700;color:var(--ink,#0D1117);margin:0}" +
    ".tw-lead .tl-done a.tl-open{display:inline-block;margin:10px 0 6px;background:var(--electric-dark,#0047C2);color:#fff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 20px}" +
    ".tw-lead .tl-err{grid-column:1/-1;color:#B42318;font-size:13px;margin:0}" +
    ".tw-lead a.tl-go{display:inline-block;margin:2px 0 12px;background:var(--electric,#005EFF);color:#fff;text-decoration:none;font-size:15px;font-weight:700;border-radius:8px;padding:12px 20px}" +
    ".tw-lead .tl-calc{margin:14px 0 4px;padding:16px;border-radius:10px;background:#f4f5f7}" +
    ".tw-lead .tl-ch{font-size:15px;font-weight:700;color:var(--ink,#0D1117);margin:0 0 10px}" +
    ".tw-lead .tl-cg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}" +
    ".tw-lead .tl-cg label{display:block;font-size:12.5px;font-weight:700;color:var(--slate,#4A5059)}" +
    ".tw-lead .tl-cg input{display:block;width:100%;margin-top:4px;font:inherit;font-size:17px;font-weight:700;padding:9px 10px;border:1px solid rgba(13,17,23,.22);border-radius:8px;background:#fff;color:var(--ink,#0D1117)}" +
    ".tw-lead .tl-co{display:flex;flex-wrap:wrap;gap:8px 28px;margin:14px 0 8px}" +
    ".tw-lead .tl-co span{display:block;font-size:12.5px;font-weight:700;color:var(--slate,#4A5059)}" +
    ".tw-lead .tl-co b{display:block;font-size:24px;line-height:1.3;color:var(--electric-dark,#0047C2);font-feature-settings:'tnum' 1}" +
    ".tw-lead .tl-cgo{margin-top:12px;background:var(--electric,#005EFF);font-size:16px;padding:13px 22px}" +
    ".tw-lead form[hidden]{display:none}" +
    "@media (max-width:560px){.tw-lead{padding:20px 16px}.tw-lead form{grid-template-columns:1fr}.tw-lead .tl-title{font-size:18px}.tw-lead button{width:100%}.tw-lead a.tl-go{display:block;text-align:center}}";

  // 申込みの枠で任意で選んでもらうお悩み（全資料で共通）。言葉は ~/founder-os/customer-voice/voices.jsonl の原文から
  var PAINS = [
    "使う業務が分からない人が多い",
    "使う人が一部に限られている",
    "費用や稟議の説明に困っている",
    "社内のルールや安全面を決めたい",
    "どのAI・契約を選ぶか迷っている",
    "社内の推進役を育てたい"
  ];

  // その場の試算（2026-11-20）。11/11〜11/19 は入力の枠が213回見られて入力開始0、届いた1件は入力の要らない安全度チェックを通っていた。
  // 名前を聞く前に、読者の数字で答えを1つ返す。押すと6項目の入力が開く。
  var CALCS = {
    claude: {
      head: "席の数を入れると、年額がその場で出ます",
      fields: [["s", "Team Standard の席", 10], ["p", "Team Premium の席", 3], ["r", "為替（1ドル＝円）", 155]],
      out: function (v) {
        var m = v.s * 20 + v.p * 100, y = Math.round(m * 12 * v.r * 1.1);
        return [["月額", m.toLocaleString("ja-JP") + " ドル"], ["年額（税込）", "約 " + y.toLocaleString("ja-JP") + " 円"]];
      },
      note: "単価は年払い・税抜で Standard 20ドル、Premium 100ドル（2026年11月20日に公式で確認）。為替は仮の値です。",
      go: "この試算を Excel で受け取る"
    },
    copilot: {
      head: "人数を入れると、年額がその場で出ます",
      fields: [["c", "Copilot を使う人数", 50], ["a", "Agent 365 を付ける人数", 0]],
      out: function (v) {
        var m = v.c * 4497 + v.a * 2248;
        return [["月額（税抜）", m.toLocaleString("ja-JP") + " 円"], ["年額（税抜）", (m * 12).toLocaleString("ja-JP") + " 円"]];
      },
      note: "単価は年払い・税抜の月額相当で Copilot 4,497円、Agent 365 2,248円（2026年11月18日に公式で確認）。対象の Microsoft 365 のライセンスは別です。",
      go: "この試算を Excel で受け取る"
    }
  };
  function renderCalc(box, kind, meta, onGo) {
    var c = CALCS[kind], w = el("div", { class: "tl-calc" });
    w.appendChild(el("p", { class: "tl-ch" }, c.head));
    var g = el("div", { class: "tl-cg" }), ins = {};
    c.fields.forEach(function (f) {
      var lb = el("label");
      lb.appendChild(el("span", null, f[1]));
      var i = el("input", { type: "number", inputmode: "numeric", min: "0", max: "100000", value: String(f[2]), "aria-label": f[1] });
      ins[f[0]] = i; lb.appendChild(i); g.appendChild(lb);
    });
    w.appendChild(g);
    var out = el("div", { class: "tl-co", "aria-live": "polite" });
    w.appendChild(out);
    function draw() {
      var v = {};
      for (var k in ins) v[k] = Math.max(0, Math.min(100000, Number(ins[k].value) || 0));
      out.innerHTML = "";
      c.out(v).forEach(function (r) {
        var d = el("div");
        d.appendChild(el("span", null, r[0])); d.appendChild(el("b", null, r[1])); out.appendChild(d);
      });
    }
    var used = false;
    g.addEventListener("input", function () {
      draw();
      if (!used) { used = true; ev("media_calc_use", meta); }
    });
    draw();
    w.appendChild(el("p", { class: "tl-fine" }, c.note));
    var b = el("button", { type: "button", class: "tl-cgo" }, c.go);
    b.addEventListener("click", function () { ev("media_lead_open", meta); b.hidden = true; onGo(); });
    w.appendChild(b);
    box.appendChild(w);
  }

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

  // 記事の途中：入力の要らない安全度チェックへの案内（中身は kenshu.techworker.co.jp/check/ に書いてあることだけ）
  function renderCheck(box, camp, packId) {
    var u = "https://kenshu.techworker.co.jp/check/?utm_source=techworker_media&utm_medium=article_mid&utm_campaign=" +
      encodeURIComponent((location.pathname.match(/^\/media\/([a-z]+)\//) || [])[1] || "media") + "&utm_content=" + encodeURIComponent(camp);
    box.appendChild(el("p", { class: "tl-kicker" }, "3分・無料・お名前不要"));
    box.appendChild(el("p", { class: "tl-title" }, "生成AI利用の安全度チェック"));
    box.appendChild(el("p", { class: "tl-sub" }, "お使いの製品を選んで答えると、初期設定のまま開いている所と、先に直したい所3つがその場で出ます。"));
    var ul = el("ul");
    [
      "Microsoft 365・Google Workspace・ChatGPT・Claude から、契約している製品を選べます",
      "社内のルール・使われ方・製品の設定を、「はい・一部・いいえ」で答えます",
      "メールアドレスの入力は要りません。自己申告に基づく目安です"
    ].forEach(function (t) { ul.appendChild(el("li", null, t)); });
    box.appendChild(ul);
    var a = el("a", { class: "tl-go", href: u, "data-cta-offer": "training_check", "data-cta-placement": "article_mid" }, "安全度チェックを始める");
    a.addEventListener("click", function () { ev("media_check_click", { lead_pos: "mid", campaign: camp, transport_type: "beacon" }); });
    box.appendChild(a);
    var fine = el("p", { class: "tl-fine" });
    fine.appendChild(document.createTextNode("料金比較表と稟議書の雛形は、"));
    fine.appendChild(el("a", { href: "#" + packId }, "この記事の後ろの枠"));
    fine.appendChild(document.createTextNode("で受け取れます。"));
    box.appendChild(fine);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          if (x.isIntersecting) { ev("media_check_view", { lead_pos: "mid", campaign: camp }); io.disconnect(); }
        });
      }, { threshold: 0.5 });
      io.observe(box);
    }
  }

  // 途中の枠と同じ資料を渡す、記事の後ろの枠
  function packBoxFor(box) {
    var all = document.querySelectorAll('.tw-lead[data-offer="' + box.dataset.offer + '"]');
    for (var i = 0; i < all.length; i++) if (all[i] !== box) return all[i];
    return null;
  }
  // 途中の枠しか無い記事には、本文の最後に資料の枠を足す（途中を安全度チェックに替えても資料を受け取れるように）
  function ensurePackBox(box) {
    if (box.dataset.pos !== "mid" || box.dataset.offer !== "ai-contract-pack" || packBoxFor(box) || !box.parentNode) return;
    var e = document.createElement("div");
    e.className = "tw-lead";
    e.setAttribute("data-offer", box.dataset.offer);
    e.setAttribute("data-campaign", box.dataset.campaign || "");
    e.setAttribute("data-pos", "end");
    box.parentNode.appendChild(e);
  }

  function render(box) {
    var offer = OFFERS[box.dataset.offer];
    if (!offer) return;
    var camp = box.dataset.campaign || location.pathname;
    var pos = box.dataset.pos || "";
    box.setAttribute("id", box.id || "tw-lead-" + pos);
    if (pos === "mid" && box.dataset.offer === "ai-contract-pack") {
      var pack = packBoxFor(box);
      if (pack) { renderCheck(box, camp, pack.id || "tw-lead-" + (pack.dataset.pos || "")); return; }
    }
    if (done()) { renderDone(box, offer); return; }

    box.appendChild(el("p", { class: "tl-kicker" }, offer.kicker || "無料で受け取る"));
    if (offer.logos) {
      // 公式ロゴ（加工しない）で、何の資料かを先に見せる（2026-11-23 古野さん「ロゴとかそういうものがあったりするとめっちゃ安心する」）
      var lgs = el("div", { class: "tl-lg" });
      offer.logos.forEach(function (l) { var c = el("span"); c.appendChild(el("img", { src: l[0], alt: "", width: "22", height: "22" })); c.appendChild(document.createTextNode(l[1])); lgs.appendChild(c); });
      box.appendChild(lgs);
    }
    box.appendChild(el("p", { class: "tl-title" }, offer.title));
    box.appendChild(el("p", { class: "tl-sub" }, offer.sub));
    var f = el("form", { novalidate: "" });
    var meta = { lead_offer: box.dataset.offer, lead_pos: pos, campaign: camp };
    if (offer.calc && CALCS[offer.calc]) {
      f.hidden = true;
      renderCalc(box, offer.calc, meta, function () { f.hidden = false; var i = f.querySelector("input"); if (i) i.focus(); });
    }
    if (offer.img) box.appendChild(el("img", { class: "tl-img", src: offer.img, alt: offer.imgAlt || "", loading: "lazy", decoding: "async" }));
    var ul = el("ul");
    offer.points.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    box.appendChild(ul);

    var company = el("input", { type: "text", name: "company", placeholder: "会社名", autocomplete: "organization", required: "", "aria-label": "会社名" });
    var name = el("input", { type: "text", name: "name", placeholder: "お名前", autocomplete: "name", required: "", "aria-label": "お名前" });
    var email = el("input", { type: "email", name: "email", placeholder: "会社のメールアドレス", autocomplete: "email", required: "", class: "tl-email", "aria-label": "メールアドレス" });
    var hp = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", style: "position:absolute;left:-9999px;width:1px;height:1px", "aria-hidden": "true" });
    var department = el("input", { type: "text", name: "department", placeholder: "部署", required: "", "aria-label": "部署" });
    var position = el("input", { type: "text", name: "position", placeholder: "役職", autocomplete: "organization-title", required: "", "aria-label": "役職" });
    var phone = el("input", { type: "tel", name: "phone", placeholder: "電話番号", autocomplete: "tel", required: "", "aria-label": "電話番号" });
    var need = el("p", { class: "tl-need" }, "6項目の入力で、すぐに開けます。");
    var pains = el("fieldset", { class: "tl-pains" });
    var lg = el("legend", null, "いま困っていること");
    lg.appendChild(el("span", null, "任意・いくつでも"));
    pains.appendChild(lg);
    var ps = el("div", { class: "tl-ps" });
    PAINS.concat(["その他"]).forEach(function (t) {
      var lb = el("label");
      lb.appendChild(el("input", { type: "checkbox", name: "pain", value: t }));
      lb.appendChild(document.createTextNode(t));
      ps.appendChild(lb);
    });
    pains.appendChild(ps);
    var other = el("input", { type: "text", name: "pain_other", class: "tl-other", placeholder: "困っていることをお書きください", "aria-label": "その他の困っていること", hidden: "" });
    pains.appendChild(other);
    pains.addEventListener("change", function () {
      var on = !!pains.querySelector('input[value="その他"]:checked');
      other.hidden = !on;
      if (on) other.focus();
    });
    var row = el("div", { class: "tl-row" });
    var btn = el("button", { type: "submit" }, "資料を受け取る");
    var fine = el("p", { class: "tl-fine" });
    fine.innerHTML = '送信すると<a href="/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>に同意したものとします。しつこい営業はしません。';
    row.appendChild(btn);
    row.appendChild(fine);
    var err = el("p", { class: "tl-err", role: "alert" });
    [need, company, department, position, name, email, phone, hp, pains, row, err].forEach(function (x) { f.appendChild(x); });
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
      var v = { company: company.value.trim(), name: name.value.trim(), email: email.value.trim(), department: department.value.trim(), position: position.value.trim(), phone: phone.value.trim().normalize("NFKC") };
      if (!v.company || !v.department || !v.position || !v.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
        err.textContent = "会社名・部署・役職・お名前・メールアドレスを入れてください。";
        return;
      }
      var digits = v.phone.replace(/\D/g, "").length;
      if (digits < 10 || digits > 15) {
        err.textContent = "電話番号を数字10桁以上で入れてください。";
        return;
      }
      if (hp.value) return;
      btn.disabled = true;
      btn.textContent = "送信中…";
      var picked = [].map.call(pains.querySelectorAll('input[name="pain"]:checked'), function (c) { return c.value; });
      var otherText = other.hidden ? "" : other.value.trim();
      var painLine = picked.map(function (t) { return t === "その他" && otherText ? "その他：" + otherText : t; }).join("／");
      var payload = {
        name: v.name, company: v.company, email: v.email, phone: v.phone, department: v.department, position: v.position,
        inquiry_type: "media_document",
        message: "【記事から資料】" + offer.title + "（記事: " + location.pathname + "／位置: " + pos + "）" + (painLine ? "\n【困っていること】" + painLine : ""),
        source: "media"
      };
      if (window.twIntent) { try { Object.assign(payload, window.twIntent()); } catch (_) {} }
      fetch("/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json().catch(function () { return {}; });
        })
        .then(function (j) {
          if (j.lead !== false) ev("generate_lead", { inquiry_type: "media_document", source: "media", lead_offer: box.dataset.offer, lead_pos: pos, campaign: camp, lead_pains: picked.length });
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
    boxes.forEach(ensurePackBox);
    document.querySelectorAll(".tw-lead").forEach(render);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
