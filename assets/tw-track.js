// 問い合わせの流入元を記録する。値はこの端末のブラウザの中だけに置き、フォームを送ったときに一緒に送る。
// - 今回の訪問: 最初に開いたページ・参照元・UTM・見たページの順番（sessionStorage）
// - 初めて来たとき: 参照元・入口のページと題名・UTM・日付（localStorage。次の訪問以降も残る）
(function () {
  try {
    var ss = sessionStorage, ls = localStorage;
    if (!ss.getItem('tw_landing')) {
      var q = new URLSearchParams(location.search);
      var here = {
        ref: document.referrer || '',
        landing: location.pathname,
        title: document.title,
        utm: ['utm_source', 'utm_medium', 'utm_campaign'].map(function (k) { return q.get(k) || ''; }).join('|'),
        at: new Date().toISOString().slice(0, 10),
      };
      ss.setItem('tw_landing', here.landing);
      ss.setItem('tw_landing_title', here.title);
      ss.setItem('tw_ref', here.ref);
      ss.setItem('tw_utm', here.utm);
      if (!ls.getItem('tw_first')) ls.setItem('tw_first', JSON.stringify(here));
    }
    var p = JSON.parse(ss.getItem('tw_pages') || '[]');
    if (p[p.length - 1] !== location.pathname) { p.push(location.pathname); ss.setItem('tw_pages', JSON.stringify(p.slice(-20))); }
    if (!ss.getItem('tw_counted')) { ls.setItem('tw_visits', parseInt(ls.getItem('tw_visits') || '0', 10) + 1); ss.setItem('tw_counted', '1'); }
  } catch (e) {}
})();

// フォームの送信データに足す値を返す。記録が無ければ空のオブジェクト（サーバー側で「記録なし」になる）
window.twIntent = function () {
  try {
    var ss = sessionStorage, ls = localStorage;
    if (ss.getItem('tw_landing') === null) return {};
    var f = JSON.parse(ls.getItem('tw_first') || 'null');
    var out = {
      intent_referrer: ss.getItem('tw_ref') || '(direct)',
      intent_landing: ss.getItem('tw_landing'),
      intent_landing_title: ss.getItem('tw_landing_title') || '',
      intent_utm: ss.getItem('tw_utm') || '',
      intent_pages: JSON.parse(ss.getItem('tw_pages') || '[]').join(' > '),
      intent_visits: ls.getItem('tw_visits') || '1',
    };
    if (f) {
      out.intent_first_referrer = f.ref || '(direct)';
      out.intent_first_landing = f.landing;
      out.intent_first_title = f.title || '';
      out.intent_first_utm = f.utm || '';
      out.intent_first_at = f.at || '';
    }
    return out;
  } catch (e) { return {}; }
};
