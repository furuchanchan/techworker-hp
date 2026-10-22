// 効果の試算（/companymap/sim、2026-10-22）。入れた数字はこの端末の中で計算する。
// 主役は使い始めからの月ごとに積み上がる効果のグラフ。選んだ見込みは2段の面（下：AIが引き受ける作業、上：「あの人」に聞く・待つ時間の減り。どちらも人件費に直した額）、ほかの見込みは合計の点線。
// 悲観・標準・楽観の割合は sim.html の表と同じ値。割合のスライダーを動かすと「自分で決めた割合」になる。使い始めて3か月で慣れる形で描く。
// 無料相談の「いまの課題」に添えるため、要約を sessionStorage の tw_sim に置く（contact.html が送るときに読む）。
(function () {
  var f = document.getElementById('sim'), box = document.getElementById('schart');
  if (!f || !box) return;
  var SCEN = { lo: { name: '悲観', cut: 15, ask: 25 }, mid: { name: '標準', cut: 30, ask: 50 }, hi: { name: '楽観', cut: 60, ask: 75 } };
  var svg = box.querySelector('svg'), tip = box.querySelector('.stip'), NS = 'http://www.w3.org/2000/svg';
  var RAMP = 3, years = 3, sel = 'mid', last = null, shown = false, used = false;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (x, d) { return Number(x).toLocaleString('ja-JP', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); };
  var big = function (yen) { return Math.abs(yen) >= 1e8 ? [fmt(yen / 1e8, Math.abs(yen) >= 1e10 ? 0 : 1), '億円'] : [fmt(yen / 1e4), '万円']; };
  var man = function (yen) { return big(yen).join(''); };
  var set = function (k, t) { document.querySelectorAll('[data-o="' + k + '"]').forEach(function (e) { e.textContent = t; }); };
  var w = function (k, pct) { document.querySelectorAll('[data-w="' + k + '"]').forEach(function (e) { e.style.width = Math.max(0, Math.min(100, pct)) + '%'; }); };
  var el = function (tag, a, parent) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; };
  var press = function (sel_, attr, val) { document.querySelectorAll(sel_).forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute(attr) === String(val) ? 'true' : 'false'); }); };

  var read = function () {
    var v = {};
    f.querySelectorAll('input[type=range]').forEach(function (r) { v[r.name] = Math.max(0, parseFloat(r.value) || 0); });
    return v;
  };
  var setRate = function (name, x) { var r = f.elements[name]; r.value = x; f.querySelector('[data-for="' + name + '"]').value = r.value; };
  // v.ppl 人数、v.hpd 1人1日の作業時間、v.askm 1人1日に聞く・待つ分、v.pay 平均年収（万円）、v.days 月の稼働日、v.cut 任せる割合%、v.ask 聞く時間の減り%
  var model = function (v) {
    var work = v.ppl * v.hpd * v.days, askH = v.ppl * v.askm / 60 * v.days;
    var a = work * v.cut / 100, b = askH * v.ask / 100, saved = a + b;
    var wage = v.days ? v.pay * 1e4 / (v.days * 12 * 8) : 0;
    var yenA = a * wage, yenB = b * wage, pts = [{ m: 0, a: 0, b: 0, ha: 0, hb: 0, hrs: 0 }], ca = 0, cb = 0, ha = 0, hb = 0;
    for (var m = 1; m <= years * 12; m++) { var r = Math.min(1, m / RAMP); ca += yenA * r; cb += yenB * r; ha += a * r; hb += b * r; pts.push({ m: m, a: ca, b: ca + cb, ya: ca, yb: cb, ha: ha, hb: hb, hrs: ha + hb }); }
    return { v: v, work: work, askH: askH, a: a, b: b, saved: saved, wage: wage, yenA: yenA, yenB: yenB, pts: pts };
  };
  var withRates = function (v, s) { var o = {}; for (var k in v) o[k] = v[k]; o.cut = SCEN[s].cut; o.ask = SCEN[s].ask; return o; };
  // 目盛り：1・2・2.5・5 の刻みで4本前後
  var nice = function (max) {
    if (max <= 0) return { top: 1, step: 1 };
    var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), s = [1, 2, 2.5, 5, 10].map(function (x) { return x * p; }).find(function (x) { return x >= raw; });
    return { top: Math.ceil(max / s) * s, step: s };
  };
  var yl = function (yen) { return yen === 0 ? '0' : yen >= 1e8 ? fmt(yen / 1e8, yen % 1e8 ? 1 : 0) + '億' : fmt(yen / 1e4) + '万'; };

  var draw = function (M, O, animate) {
    var W = box.clientWidth, wide = W >= 480, H = wide ? Math.min(400, Math.max(300, W * 0.52)) : 290, pl = wide ? 60 : 44, pr = wide ? 140 : 14, pt = 34, pb = 34;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var P = M.pts, N = P.length - 1, top = Math.max.apply(null, [P[N].b].concat(O.map(function (o) { return o.M.pts[N].b; }))), yt = nice(top);
    var X = function (m) { return pl + (W - pl - pr) * m / N; }, Y = function (y) { return pt + (H - pt - pb) * (1 - y / yt.top); };
    for (var g = 0; g <= yt.top + 1e-6; g += yt.step) {
      el('line', { x1: pl, x2: W - pr, y1: Y(g), y2: Y(g), class: g ? 'gd' : 'g0' });
      el('text', { x: pl - 8, y: Y(g) + 4, class: 'ty', 'text-anchor': 'end' }).textContent = yl(g);
    }
    var xs = years === 1 ? [0, 3, 6, 9, 12] : Array.from({ length: years + 1 }, function (_, i) { return i * 12; });
    xs.forEach(function (m) { el('text', { x: X(m), y: H - 10, class: 'tx', 'text-anchor': m === 0 ? 'start' : m === N ? 'end' : 'middle' }).textContent = m === 0 ? '使い始め' : m % 12 ? m + 'か月' : m / 12 + '年'; });
    var clip = el('clipPath', { id: 'sclip' }, el('defs', {})), cr = el('rect', { x: 0, y: 0, width: animate ? 0 : W, height: H }, clip);
    var gArea = el('g', { 'clip-path': 'url(#sclip)' });
    var line = function (Q, k) { return Q.map(function (p, i) { return (i ? 'L' : 'M') + X(p.m).toFixed(1) + ' ' + Y(p[k]).toFixed(1); }).join(''); };
    var back = function (k) { return P.slice().reverse().map(function (p) { return 'L' + X(p.m).toFixed(1) + ' ' + Y(p[k]).toFixed(1); }).join(''); };
    el('path', { d: line(P, 'b') + back('a') + 'Z', class: 'a2' }, gArea);
    el('path', { d: line(P, 'a') + 'L' + X(N) + ' ' + Y(0) + 'L' + X(0) + ' ' + Y(0) + 'Z', class: 'a1' }, gArea);
    el('path', { d: line(P, 'a'), class: 'l1' }, gArea);
    O.forEach(function (o) { el('path', { d: line(o.M.pts, 'b'), class: 'ld' }, gArea); });
    el('path', { d: line(P, 'b'), class: 'l2' }, gArea);
    // 年の終わりの点と合計は、選んだ見込みだけ。最後の月は3本とも、重ならないよう縦にずらして書く
    xs.filter(function (m) { return m && m % 12 === 0 && m < N; }).forEach(function (m) {
      var p = P[m], x = X(m), y = Y(p.b);
      el('circle', { cx: x, cy: y, r: 4.5, class: 'pt' }, gArea);
      el('text', { x: x - 10, y: y - 8, class: 'pv', 'text-anchor': 'end' }, gArea).textContent = '+' + man(p.b);
    });
    var ends = [{ y: Y(P[N].b), t: (M.name ? M.name + '　' : '') + '+' + man(P[N].b), c: 'pv end' }].concat(O.map(function (o) { return { y: Y(o.M.pts[N].b), t: o.name + '　+' + man(o.M.pts[N].b), c: 'pv sub' }; }));
    // PC：3本とも右の余白に、線の終わりの高さで（重なれば縦にずらす）。スマホ：選んだ見込みだけ線の上に
    if (!wide) ends = ends.slice(0, 1);
    ends.forEach(function (e) { e.ly = wide ? e.y + 5 : e.y - 12; });
    ends.slice().sort(function (a, b) { return a.ly - b.ly; }).reduce(function (prev, e) { if (prev && e.ly - prev.ly < 20) e.ly = prev.ly + 20; return e; }, null);
    ends.forEach(function (e) { el('text', { x: wide ? X(N) + 12 : X(N) - 10, y: e.ly, class: e.c, 'text-anchor': wide ? 'start' : 'end' }, gArea).textContent = e.t; });
    el('circle', { cx: X(N), cy: Y(P[N].b), r: 6, class: 'pt' }, gArea);
    var cross = el('line', { y1: pt, y2: H - pb, class: 'cx', visibility: 'hidden' }), dot = el('circle', { r: 6, class: 'pt', visibility: 'hidden' });
    var hit = el('rect', { x: pl, y: 0, width: W - pl - pr, height: H, fill: 'transparent' });
    var hover = function (ev) {
      var r = svg.getBoundingClientRect(), mx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      var m = Math.max(1, Math.min(N, Math.round((mx - pl) / (W - pl - pr) * N))), p = P[m], x = X(m);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x); dot.setAttribute('cy', Y(p.b)); dot.setAttribute('visibility', 'visible');
      tip.innerHTML = '<b>' + m + 'か月目までの合計　+' + man(p.b) + '</b><span><i class="k1"></i>AIが引き受けた作業　' + fmt(p.ha) + '時間（' + man(p.ya) + '）</span><span><i class="k2"></i>聞く・待つ時間の減り　' + fmt(p.hb) + '時間（' + man(p.yb) + '）</span>'
        + O.map(function (o) { return '<span><i class="kd"></i>' + o.name + 'なら　+' + man(o.M.pts[m].b) + '</span>'; }).join('');
      tip.hidden = false;
      var tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(W - tw, x - tw / 2)) + 'px'; tip.style.top = Math.max(0, Y(p.b) - tip.offsetHeight - 18) + 'px';
    };
    var out = function () { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    hit.addEventListener('pointermove', hover); hit.addEventListener('pointerdown', hover); hit.addEventListener('pointerleave', out);
    if (animate) { var t0 = null, dur = 1400; requestAnimationFrame(function step(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur); k = 1 - Math.pow(1 - k, 3); cr.setAttribute('width', W * k); if (k < 1) requestAnimationFrame(step); }); }
  };

  // 大きな数字は、前の値から新しい値へ数え上げる
  var tween = null;
  var count = function (to, dur) {
    var from = last === null ? 0 : last; last = to; cancelAnimationFrame(tween);
    if (reduce || !dur) { var b = big(to); set('total', b[0]); set('totalu', b[1]); return; }
    var t0 = null;
    tween = requestAnimationFrame(function step(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur); k = 1 - Math.pow(1 - k, 3); var b = big(from + (to - from) * k); set('total', b[0]); set('totalu', b[1]); if (k < 1) tween = requestAnimationFrame(step); });
  };

  var M, O;
  var calc = function (animate) {
    var v = read();
    M = model(v); M.name = sel === 'own' ? '自分で' : SCEN[sel].name;
    O = ['hi', 'mid', 'lo'].filter(function (s) { return s !== sel; }).map(function (s) { return { name: SCEN[s].name, M: model(withRates(v, s)) }; });
    var P = M.pts, end = P[P.length - 1], N = P.length - 1, lo = model(withRates(v, 'lo')).pts[N].b, hi = model(withRates(v, 'hi')).pts[N].b;
    set('scen', sel === 'own' ? '自分で決めた割合' : M.name); set('yrs', years + '年'); set('hrsT', fmt(end.hrs) + '時間'); set('fteT', fmt(M.saved / 160, 1) + '人分'); set('lo', '+' + man(lo)); set('hi', '+' + man(hi));
    set('savedA', fmt(M.a)); set('workNow', fmt(M.work) + '時間'); set('workAfter', fmt(M.work - M.a) + '時間'); w('workAfter', M.work ? (M.work - M.a) / M.work * 100 : 0);
    set('perA', fmt(v.ppl ? M.a / v.ppl : 0, 1) + '時間／月'); set('fteA', fmt(M.a / 160, 1) + '人分'); set('costA', man(M.yenA * 12) + '／年');
    set('savedB', fmt(M.b)); set('askNow', fmt(M.askH) + '時間'); set('askAfter', fmt(M.askH - M.b) + '時間'); w('askNow', M.askH && M.work ? Math.min(100, M.askH / M.work * 100) : 0); w('askAfter', M.work ? Math.min(100, (M.askH - M.b) / M.work * 100) : 0);
    set('perB', fmt(v.askm) + '分が' + fmt(v.askm * (1 - v.ask / 100)) + '分に'); set('fteB', fmt(M.b / 160, 1) + '人分'); set('costB', man(M.yenB * 12) + '／年');
    set('wage', fmt(M.wage) + '円');
    if (shown) { draw(M, O, animate && !reduce); count(end.b, animate ? 1400 : 450); }
    try {
      sessionStorage.setItem('tw_sim', '【効果の試算】' + fmt(v.ppl) + '人・1人1日' + fmt(v.hpd, 1) + '時間・聞く' + fmt(v.askm) + '分・年収' + fmt(v.pay) + '万円／' + M.name + '（任せる' + v.cut + '%・聞く時間−' + v.ask + '%）→ ' + years + '年で+' + man(end.b) + '（' + fmt(end.hrs) + '時間）。悲観+' + man(lo) + '〜楽観+' + man(hi));
    } catch (e) {}
  };

  // スライダーと数字の箱を同じ値に
  f.querySelectorAll('input[type=number][data-for]').forEach(function (nb) {
    var r = f.elements[nb.dataset.for];
    nb.addEventListener('input', function () { var x = parseFloat(nb.value); if (!isNaN(x)) { r.value = x; r.dispatchEvent(new Event('input', { bubbles: true })); } });
    nb.addEventListener('change', function () { nb.value = r.value; });
    r.addEventListener('input', function () { if (document.activeElement !== nb) nb.value = r.value; });
  });
  f.addEventListener('input', function (e) {
    if (e.target.type !== 'range') return;
    if (e.target.name === 'cut' || e.target.name === 'ask') { sel = 'own'; press('.sscn button', 'data-s', ''); }
    calc(false);
    if (!used && window.gtag) { used = true; window.gtag('event', 'sim_use', { page: location.pathname }); }
  });
  document.querySelectorAll('.sper button').forEach(function (b) {
    b.addEventListener('click', function () { years = Number(b.dataset.y); press('.sper button', 'data-y', years); calc(true); });
  });
  document.querySelectorAll('.sscn button').forEach(function (b) {
    b.addEventListener('click', function () { sel = b.dataset.s; setRate('cut', SCEN[sel].cut); setRate('ask', SCEN[sel].ask); press('.sscn button', 'data-s', sel); calc(false); });
  });
  var rw = box.clientWidth;
  new ResizeObserver(function () { if (shown && box.clientWidth !== rw) { rw = box.clientWidth; draw(M, O, false); } }).observe(box);
  // 申し込みボタンのクリック計測（LP と同じ名前で送る）
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-cta-location]');
    if (!a || typeof window.gtag !== 'function') return;
    window.gtag('event', 'companymap_cta_click', { cta_location: a.dataset.ctaLocation, cta_type: a.dataset.ctaType });
  });
  // スマホの下の帯：グラフが画面から外れている間だけ出す
  var mini = document.getElementById('simmini');
  if (mini && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { mini.classList.toggle('on', !es[0].isIntersecting && es[0].boundingClientRect.top < 0); }, { threshold: 0 }).observe(box);
  }
  // 画面に入ったら、線を左から引き、合計を0から数え上げる
  var start = function () { if (shown) return; shown = true; calc(true); };
  calc(false);
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); } }, { threshold: 0.3 });
    io.observe(document.getElementById('simtop') || box);
  } else start();
})();
