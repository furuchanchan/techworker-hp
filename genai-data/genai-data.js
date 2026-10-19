// 国内上場企業の生成AI活用データ（/genai-data/）
// データは公開リポジトリから毎回読む（HP に写さない）。読めなければ「読み込めませんでした」と出し、古い写しに切り替えない。
var DATA_BASE = 'https://raw.githubusercontent.com/techworker-jp/jp-listed-genai/main/data/';
// 手元で確かめるときだけ ?data=local で見本を読む（見本は repo に入れない）
var LOCAL_BASE = '/genai-data-sample/';

(function () {
  var params = new URLSearchParams(location.search);
  var base = params.get('data') === 'local' ? LOCAL_BASE : DATA_BASE;
  var app = document.getElementById('app');
  var PAGE = 30;
  var STAGE_CLASS = { '使っている・導入した': 's1', '試している': 's2', '検討・計画': 's3' };
  var D = {};
  var st = { ind: params.get('ind') || '', q: params.get('q') || '', area: params.get('area') || '', use: params.get('use') || '', tab: params.get('tab') === 'co' ? 'co' : 'case', shown: PAGE };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('ja-JP'); }
  function pct(n) { return Number(n).toFixed(1); }
  function host(u) { try { return new URL(u).hostname; } catch (e) { return u; } }
  function srcLink(s) {
    var t = s.title || host(s.url);
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(t) + '</a>';
  }
  function track(name, p) { if (typeof gtag === 'function') gtag('event', name, Object.assign({ source: 'genai-data' }, p || {})); }

  function load(f) {
    return fetch(base + f, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(f + ' ' + r.status);
      return r.json();
    });
  }

  Promise.all(['status.json', 'industries.json', 'companies.json', 'cases.json'].map(load)).then(function (r) {
    D.status = r[0]; D.industries = r[1]; D.companies = r[2]; D.cases = r[3];
    D.indNames = D.industries.map(function (x) { return x.industry33; });
    if (D.indNames.indexOf(st.ind) < 0) st.ind = '';
    D.cases.sort(function (a, b) { return (b.publishedAt || '').localeCompare(a.publishedAt || '') || a.id.localeCompare(b.id); });
    D.companies.sort(function (a, b) { return b.caseCount - a.caseCount || a.code.localeCompare(b.code); });
    // 手紙のリンク（?ind=）で開いたとき、その業種に事例がまだ無ければ、会社の一覧から見せる
    if (!params.get('tab')) { var f0 = filtered(); if (!f0.cases.length && f0.cos.length) st.tab = 'co'; }
    renderShell();
    renderList();
  }).catch(function (e) {
    app.innerHTML = '<div class="err" role="alert"><b>データを読み込めませんでした</b>時間をおいて、ページを読み込み直してください。データそのものは <a href="https://github.com/techworker-jp/jp-listed-genai" target="_blank" rel="noopener">GitHub</a> でも見られます。</div>';
    if (window.console) console.error(e);
  });

  function counts(list, key) {
    var m = {};
    list.forEach(function (c) { if (c[key]) m[c[key]] = (m[c[key]] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; });
  }
  function options(list, cur, all) {
    return '<option value="">' + all + '</option>' + list.map(function (v) {
      return '<option' + (v === cur ? ' selected' : '') + ' value="' + esc(v) + '">' + esc(v) + '</option>';
    }).join('');
  }

  function renderShell() {
    var s = D.status;
    document.getElementById('m-checked').textContent = s.lastCheckedAt || '—';
    document.getElementById('m-version').textContent = s.updatedAt || '—';
    try {
      var ld = document.getElementById('ld-dataset'), j = JSON.parse(ld.textContent);
      if (/^\d{4}-\d{2}-\d{2}/.test(s.lastCheckedAt || '')) { j.dateModified = s.lastCheckedAt.slice(0, 10); ld.textContent = JSON.stringify(j); }
    } catch (e) {}

    var surveyed = 0, disclosed = 0;
    D.industries.forEach(function (x) { surveyed += x.surveyed; disclosed += x.disclosed; });
    // 参考の業種は順位を付けないので、割合の順でなく業種の順（データの並び）に置く
    var order = D.indNames;
    var rows = D.industries.slice().sort(function (a, b) {
      return (a.reference - b.reference) || (a.reference ? order.indexOf(a.industry33) - order.indexOf(b.industry33) : (b.rate - a.rate) || (b.rateUse - a.rateUse));
    });

    app.innerHTML =
      '<div class="figs">' +
        '<div><p class="n">' + fmt(surveyed) + '<small>社</small></p><p class="l">調べた会社</p></div>' +
        '<div><p class="n">' + fmt(disclosed) + '<small>社</small></p><p class="l">生成AIの活用を公表している会社（調べた会社の ' + pct(surveyed ? disclosed / surveyed * 100 : 0) + '%）</p></div>' +
        '<div><p class="n">' + fmt(s.cases) + '<small>件</small></p><p class="l">出典と照合した事例</p></div>' +
      '</div>' +
      '<div class="rules">' +
        '<p><b>公表あり</b>自社で生成AIを使っている・試している・導入したと分かる公開情報が、1つ以上ある会社です。検討・計画の段階の公表も含みます。</p>' +
        '<p><b>割合の分母</b>調べた会社です。上場しているすべての会社ではありません。</p>' +
        '<p><b>見つからない</b>決まった調べ方で公表が見つからなかった会社です。使っていないとは限りません。会社名は載せていません。</p>' +
      '</div>' +

      '<section class="blk" id="industries">' +
        '<h2>業種ごとの、<wbr>公表している<wbr>会社の割合</h2>' +
        '<p class="sub">東証33業種ごとに、調べた会社のうち生成AIの活用を公表している会社の割合です。2つの割合の差にあたるのは、検討・計画の段階だけを公表している会社です。業種を押すと、その業種の会社と事例を下に出します。</p>' +
        '<p class="legend"><span><i class="k-use"></i>使っている・試している</span><span><i class="k-all"></i>公表あり（検討・計画を含む）</span></p>' +
        '<div class="ind">' +
          '<div class="ind-h" aria-hidden="true"><span>業種</span><span style="text-align:right">調べた会社</span><span></span><span>公表あり（95%の幅）</span><span>使っている・試している</span></div>' +
          rows.map(function (x) {
            return '<button type="button" class="ind-r' + (x.reference ? ' ref' : '') + (x.industry33 === st.ind ? ' on' : '') + '" data-ind="' + esc(x.industry33) + '">' +
              '<span class="nm">' + esc(x.industry33) + (x.reference ? '<em>参考</em>' : '') + '</span>' +
              '<span class="sv num">' + fmt(x.surveyed) + '社</span>' +
              '<span class="bar" aria-hidden="true"><span class="all" style="width:' + x.rate + '%"></span><span class="use" style="width:' + x.rateUse + '%"></span></span>' +
              '<span class="v a"><b>' + pct(x.rate) + '%</b><small>' + pct(x.ciLow) + '〜' + pct(x.ciHigh) + '%</small></span>' +
              '<span class="v u"><b>' + pct(x.rateUse) + '%</b><small>' + pct(x.ciLowUse) + '〜' + pct(x.ciHighUse) + '%</small></span>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<p class="ind-note">95%の幅は、割合が入ると考えられる範囲です（Wilson の方法）。調べた会社が30社未満の業種は「参考」とし、順位を付けずに下に並べています。</p>' +
      '</section>' +

      '<section class="blk" id="explore">' +
        '<h2>会社と事例を探す</h2>' +
        '<p class="sub">業種・会社名・業務・使い方で絞り込めます。絞り込んだ画面の URL は、そのまま共有できます。</p>' +
        '<div id="focus"></div>' +
        '<div class="filters">' +
          '<label>業種<select id="f-ind">' + options(D.indNames, st.ind, 'すべての業種') + '</select></label>' +
          '<label>会社名・証券コード<input id="f-q" type="search" placeholder="例：伊藤忠、8001" value="' + esc(st.q) + '"></label>' +
          '<label>業務<select id="f-area">' + options(counts(D.cases, 'areaMain'), st.area, 'すべての業務') + '</select></label>' +
          '<label>使い方<select id="f-use">' + options(counts(D.cases, 'useMain'), st.use, 'すべての使い方') + '</select></label>' +
        '</div>' +
        '<div class="tabs" role="tablist">' +
          '<button type="button" role="tab" id="t-case" aria-selected="' + (st.tab === 'case') + '">事例<span class="num" id="n-case"></span></button>' +
          '<button type="button" role="tab" id="t-co" aria-selected="' + (st.tab === 'co') + '">公表している会社<span class="num" id="n-co"></span></button>' +
          '<button type="button" class="clear" id="f-clear">絞り込みを外す</button>' +
        '</div>' +
        '<div id="list"></div>' +
      '</section>';

    app.querySelectorAll('.ind-r').forEach(function (b) {
      b.addEventListener('click', function () {
        st.ind = st.ind === b.dataset.ind ? '' : b.dataset.ind;
        document.getElementById('f-ind').value = st.ind;
        update();
        if (st.ind) document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
      });
    });
    var sel = { 'f-ind': 'ind', 'f-area': 'area', 'f-use': 'use' };
    Object.keys(sel).forEach(function (id) { document.getElementById(id).addEventListener('change', function (e) { st[sel[id]] = e.target.value; update(); }); });
    var tm;
    document.getElementById('f-q').addEventListener('input', function (e) { clearTimeout(tm); tm = setTimeout(function () { st.q = e.target.value.trim(); update(); }, 200); });
    document.getElementById('t-case').addEventListener('click', function () { st.tab = 'case'; update(); });
    document.getElementById('t-co').addEventListener('click', function () { st.tab = 'co'; update(); });
    document.getElementById('f-clear').addEventListener('click', function () {
      st.ind = st.q = st.area = st.use = '';
      ['f-ind', 'f-q', 'f-area', 'f-use'].forEach(function (id) { document.getElementById(id).value = ''; });
      update();
    });
  }

  function update() {
    st.shown = PAGE;
    var u = new URLSearchParams(location.search);
    [['ind', st.ind], ['q', st.q], ['area', st.area], ['use', st.use], ['tab', st.tab === 'co' ? 'co' : '']].forEach(function (kv) { kv[1] ? u.set(kv[0], kv[1]) : u.delete(kv[0]); });
    var qs = u.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    app.querySelectorAll('.ind-r').forEach(function (b) { b.classList.toggle('on', b.dataset.ind === st.ind); });
    document.getElementById('t-case').setAttribute('aria-selected', st.tab === 'case');
    document.getElementById('t-co').setAttribute('aria-selected', st.tab === 'co');
    renderList();
  }

  function matchQ(x) {
    if (!st.q) return true;
    var q = st.q.toLowerCase();
    return x.name.toLowerCase().indexOf(q) >= 0 || x.code.toLowerCase().indexOf(q) >= 0;
  }
  function filtered() {
    var cases = D.cases.filter(function (c) {
      return (!st.ind || c.industry33 === st.ind) && matchQ(c) &&
        (!st.area || c.areaMain === st.area || (c.areas || []).indexOf(st.area) >= 0) &&
        (!st.use || c.useMain === st.use || (c.uses || []).indexOf(st.use) >= 0);
    });
    var codes = null;
    if (st.area || st.use) { codes = {}; cases.forEach(function (c) { codes[c.code] = 1; }); }
    var cos = D.companies.filter(function (c) { return (!st.ind || c.industry33 === st.ind) && matchQ(c) && (!codes || codes[c.code]); });
    return { cases: cases, cos: cos };
  }

  function renderFocus() {
    var el = document.getElementById('focus');
    var x = st.ind && D.industries.filter(function (i) { return i.industry33 === st.ind; })[0];
    if (!x) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="focus"><h3>' + esc(x.industry33) + (x.reference ? '（参考）' : '') + '</h3>' +
      '<p>調べた<span class="num">' + fmt(x.surveyed) + '</span>社のうち、<span class="num">' + fmt(x.disclosed) + '</span>社（<span class="num">' + pct(x.rate) + '%</span>、95%の幅 ' + pct(x.ciLow) + '〜' + pct(x.ciHigh) + '%）が生成AIの活用を公表しています。' +
      'そのうち、使っている・試していると分かるのは<span class="num">' + fmt(x.disclosedUse) + '</span>社（<span class="num">' + pct(x.rateUse) + '%</span>）です。' +
      (x.reference ? '調べた会社が30社未満のため、参考の値です。' : '') + '</p></div>';
  }

  function caseItem(c) {
    var main = c.sources[0];
    var tags = [c.kind, c.areaMain, c.useMain, c.stage].filter(Boolean).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    var row = function (k, v, wide) { return v ? '<div' + (wide ? ' class="wide"' : '') + '><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>' : ''; };
    return '<li><details class="case"><summary><div>' +
        '<p class="t">' + esc(c.title) + '</p>' +
        '<p class="co">' + esc(c.name) + '（' + esc(c.code) + '）・' + esc(c.industry33) + '・' + esc(c.market) + '</p>' +
        '<p class="tags">' + tags + '</p>' +
        (main ? '<p class="src">出典：' + srcLink(main) + (main.publisher ? '（' + esc(main.publisher) + '）' : '') + '</p>' : '') +
      '</div><div class="side"><span class="num">' + esc(c.publishedAt || '') + '</span><br><span class="open"></span></div></summary>' +
      '<dl class="body">' +
        row('概要', c.summary, true) + row('課題', c.problem) + row('始め方', c.approach) + row('結果（出典の記載）', c.outcome) + row('注意点', c.limitations) +
        row('対象', c.audience) + row('展開の範囲', c.scope) +
        row('提供元', (c.providers || []).join('、')) + row('製品', (c.products || []).join('、')) +
        '<div class="wide"><dt>出典（確かめた日 ' + esc(c.checkedAt) + '）</dt><dd><ul>' + c.sources.map(function (s) {
          return '<li>' + srcLink(s) + '<small>' + esc([s.publisher, s.publishedAt, s.kind].filter(Boolean).join('・')) + '</small></li>';
        }).join('') + '</ul></dd></div>' +
      '</dl></details></li>';
  }

  function coRow(c) {
    var more = c.sources.length > 3 ? '<small>ほか' + (c.sources.length - 3) + '件（CSV に全部あります）</small>' : '';
    return '<tr><td class="c">' + esc(c.name) + '<span class="code">' + esc(c.code) + '</span></td>' +
      '<td>' + esc(c.industry33) + '・' + esc(c.market) + '</td>' +
      '<td class="i"><span class="stg ' + (STAGE_CLASS[c.stage] || 's3') + '">' + esc(c.stage) + '</span></td>' +
      '<td class="i num" data-l="初めての公表">' + esc(c.firstPublishedAt || '—') + '</td>' +
      '<td class="i num" data-l="事例">' + (c.caseCount ? c.caseCount + '件' : '—') + '</td>' +
      '<td><div class="src">' + c.sources.slice(0, 3).map(srcLink).join('') + more + '</div></td></tr>';
  }

  function renderList() {
    if (!D.cases) return;
    renderFocus();
    var f = filtered();
    document.getElementById('n-case').textContent = fmt(f.cases.length);
    document.getElementById('n-co').textContent = fmt(f.cos.length);
    var el = document.getElementById('list');
    var list = st.tab === 'co' ? f.cos : f.cases;
    var html;
    if (!list.length) {
      html = '<p class="empty">' + (st.tab === 'co' ? 'この条件で公表している会社は、まだ載っていません。' : 'この条件で出典と照合した事例は、まだありません。' + (f.cos.length ? '「公表している会社」の一覧もご覧ください。' : '')) + '</p>';
    } else if (st.tab === 'co') {
      html = '<table class="cos"><thead><tr><th>会社名</th><th>業種・市場</th><th>段階</th><th>初めての公表</th><th>事例</th><th>出典</th></tr></thead><tbody>' +
        list.slice(0, st.shown).map(coRow).join('') + '</tbody></table>';
    } else {
      html = '<ul class="list">' + list.slice(0, st.shown).map(caseItem).join('') + '</ul>';
    }
    if (list.length > st.shown) html += '<button type="button" class="more" id="more">もっと見る（残り ' + fmt(list.length - st.shown) + (st.tab === 'co' ? '社' : '件') + '）</button>';
    el.innerHTML = html;
    var m = document.getElementById('more');
    if (m) m.addEventListener('click', function () { st.shown += PAGE * 2; renderList(); });
  }

  // 計測：CSV・GitHub・業務図・掲載の訂正のリンク
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-ga]');
    if (!a) return;
    var k = a.dataset.ga;
    if (k === 'csv') track('genai_data_download', { file: a.dataset.gaFile });
    else if (k === 'github') track('genai_data_github');
    else if (k === 'companymap') track('genai_data_companymap', { cta_location: 'genai_data_footer' });
    else if (k === 'correction') track('genai_data_correction', { via: a.dataset.gaVia });
  });

  document.getElementById('copy-cite').addEventListener('click', function (e) {
    var t = document.getElementById('cite-text').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { e.target.textContent = 'コピーしました'; });
  });

  var hamb = document.getElementById('hamb'), mmenu = document.getElementById('mmenu');
  hamb.addEventListener('click', function () {
    var open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    hamb.setAttribute('aria-expanded', open ? 'true' : 'false');
    mmenu.setAttribute('aria-hidden', open ? 'false' : 'true');
  });
})();
