// 開催前のイベント（ウェビナー）を、全ページの上の帯と右下の小窓で知らせる。
// - 終わった時刻（until）を過ぎたら何も出さず、ページの中の data-tw-until 付きの段も消す。
// - 上の帯は × で7日出さない。小窓は少し読み進めたら出し、1日1回まで・× で7日出さない。
// 次の回に替えるときは EV だけを書き換える。ほかのサイトからは https://techworker.co.jp/assets/tw-event.js を読み、上の帯が要らなければ data-bar="0" を付ける。
(function () {
  var EV = {
    id: 'wb-2026-11-03',
    until: '2026-11-03T17:40:00+09:00',
    url: 'https://sokumitsu.techworker.co.jp/webinar/2026-11-03/',
    img: 'https://techworker.co.jp/assets/event/webinar-2026-11-03.jpg',
    when: '11/3（火・祝）17:00〜17:40',
    whenShort: '11/3（火・祝）',
    title: '商社・卸の見積AI入門',
    titleShort: '見積AI入門',
    lead: '届いた見積依頼を、自社の品番と単価に',
  };
  var me = document.currentScript, now = Date.now();
  document.querySelectorAll('[data-tw-until]').forEach(function (el) {
    if (now > Date.parse(el.getAttribute('data-tw-until'))) el.remove();
  });
  if (now > Date.parse(EV.until)) return;
  var ev = new URL(EV.url);
  if (location.hostname === ev.hostname && location.pathname.indexOf(ev.pathname) === 0) return;  // 申込のページそのものでは出さない

  var WEEK = 7 * 864e5, today = new Date().toISOString().slice(0, 10);
  function get(k) { try { return localStorage.getItem(EV.id + ':' + k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(EV.id + ':' + k, v); } catch (e) {} }
  function closedRecently(k) { var t = parseInt(get(k) || '0', 10); return now - t < WEEK; }
  function link(medium) { return EV.url + '?utm_source=' + location.hostname + '&utm_medium=' + medium + '&utm_campaign=' + EV.id; }
  function track(name) { if (window.gtag) window.gtag('event', name, { event_id: EV.id }); }

  var css = document.createElement('style');
  css.textContent =
    '.twev-bar{position:fixed;top:0;left:0;right:0;z-index:1000;height:40px;display:flex;align-items:center;justify-content:center;gap:18px;padding:0 44px 0 16px;background:#0D1117;color:#FCFCFB;font:700 13.5px/1 "游ゴシック体","Yu Gothic",YuGothic,"Hiragino Sans",sans-serif;letter-spacing:.04em}' +
    '.twev-bar a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:18px;min-width:0}' +
    '.twev-bar .k{flex:none;border:1px solid #A47948;color:#D8BF8F;padding:4px 10px;font-size:12px}' +
    '.twev-bar .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.twev-bar .sp{display:none}.twev-bar .m{flex:none;color:#D8BF8F;border-bottom:1px solid #A47948;padding-bottom:2px}' +
    '.twev-x{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;background:none;color:inherit;font-size:18px;line-height:1;cursor:pointer;opacity:.7}' +
    '.twev-pop{position:fixed;right:20px;bottom:20px;z-index:1000;width:300px;background:#FCFCFB;color:#0D1117;box-shadow:0 14px 34px -12px rgba(13,17,23,.45);border:1px solid #D9D9D6;font:500 13px/1.6 "游ゴシック体","Yu Gothic",YuGothic,"Hiragino Sans",sans-serif;opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s}' +
    '.twev-pop.on{opacity:1;transform:none}' +
    '.twev-pop a{display:block;color:inherit;text-decoration:none}' +
    '.twev-pop img{display:block;width:100%;height:auto}' +
    '.twev-pop .b{display:block;padding:12px 16px 14px}.twev-pop .w{display:block}' +
    '.twev-pop .w{font-size:12px;color:#5d6068}' +
    '.twev-pop .h{font-size:16px;font-weight:700;margin:2px 0 6px}' +
    '.twev-pop .m{display:inline-block;font-weight:700;border-bottom:1px solid #A47948}' +
    '.twev-pop .twev-x{top:-14px;right:-14px;transform:none;width:30px;height:30px;border-radius:50%;background:#FCFCFB;color:#0D1117;border:1px solid #D9D9D6;box-shadow:0 2px 6px rgba(0,0,0,.15);opacity:1;font-size:15px}' +
    '@media (max-width:640px){.twev-bar{height:36px;gap:10px;font-size:12px;padding-right:40px}.twev-bar a{gap:10px}.twev-bar .k{padding:3px 6px;font-size:11px}.twev-bar .lg{display:none}.twev-bar .sp{display:inline}' +
    '.twev-pop{left:12px;right:12px;bottom:12px;width:auto;display:block}.twev-pop a{display:grid;grid-template-columns:132px 1fr;align-items:center}.twev-pop .b{padding:10px 12px}.twev-pop .h{font-size:14px;margin:0 0 4px}}';
  document.head.appendChild(css);

  // 上の帯
  if (!(me && me.dataset.bar === '0') && !closedRecently('bar_closed')) {
    var bar = document.createElement('div');
    bar.className = 'twev-bar';
    bar.innerHTML = '<a href="' + link('bar') + '"><span class="k">無料<span class="lg">ウェビナー</span></span><span class="t">' + EV.whenShort + '<span class="lg">17:00〜17:40　' + EV.title + '　〜' + EV.lead + '〜</span><span class="sp">' + EV.titleShort + '</span></span><span class="m">詳しく見る →</span></a><button type="button" class="twev-x" aria-label="閉じる">×</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    var h = bar.offsetHeight, moved = [];
    document.querySelectorAll('body > *').forEach(function (el) {
      if (el === bar) return;
      var s = getComputedStyle(el);
      if ((s.position === 'fixed' || s.position === 'sticky') && parseFloat(s.top) === 0) { el.style.top = h + 'px'; moved.push(el); }
    });
    var pad = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    document.body.style.paddingTop = (pad + h) + 'px';
    bar.querySelector('a').addEventListener('click', function () { track('event_bar_click'); });
    bar.querySelector('button').addEventListener('click', function () {
      set('bar_closed', String(Date.now()));
      bar.remove();
      moved.forEach(function (el) { el.style.top = ''; });
      document.body.style.paddingTop = pad ? pad + 'px' : '';
    });
  }

  // 右下の小窓（問い合わせのページでは出さない）
  if (/^\/contact/.test(location.pathname) || closedRecently('pop_closed') || get('pop_day') === today) return;
  var pop = document.createElement('aside');
  pop.className = 'twev-pop';
  pop.setAttribute('aria-label', '開催予定のウェビナー');
  pop.innerHTML = '<a href="' + link('pop') + '"><img src="' + EV.img + '" alt="' + EV.title + '" width="1200" height="630" loading="lazy"><span class="b"><span class="w">' + EV.whenShort + '17:00〜・無料</span><span class="h" style="display:block">' + EV.title + '</span><span class="m">申し込む →</span></span></a><button type="button" class="twev-x" aria-label="閉じる">×</button>';
  function show() {
    if (window.scrollY < window.innerHeight * 0.6) return;
    var band = document.querySelector('[data-tw-until]');  // 同じ告知の段が見えている間は出さない
    if (band && band.getBoundingClientRect().bottom > 0) return;
    window.removeEventListener('scroll', show);
    var off = 0;  // 下に固定のボタンがあるサイトでは、その上に出す
    document.querySelectorAll('body > *').forEach(function (el) {
      var st = getComputedStyle(el);
      if (st.position === 'fixed' && parseFloat(st.bottom) === 0 && el.offsetHeight < 200) off = Math.max(off, el.offsetHeight);
    });
    if (off) pop.style.bottom = (off + 12) + 'px';
    document.body.appendChild(pop);
    requestAnimationFrame(function () { pop.classList.add('on'); });
    set('pop_day', today);
  }
  window.addEventListener('scroll', show, { passive: true });
  pop.querySelector('a').addEventListener('click', function () { track('event_pop_click'); });
  pop.querySelector('button').addEventListener('click', function () { set('pop_closed', String(Date.now())); pop.remove(); });
})();
