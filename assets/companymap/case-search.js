// 他社の事例を探す（/companymap の #others）。入れた言葉で、公開のWorker（companymap-cases）に問い合わせて上位の事例を描く。
// 最初の検索は、この欄が画面に近づいたときに1回だけ行う（ページを開いた全員に問い合わせないため）。
// 並べ直しに判定用のAI（Jev）を使うので、1回の検索に1秒ほどかかる。
(() => {
  const root = document.getElementById('case-search');
  if (!root) return;
  const API = root.dataset.api;
  const form = root.querySelector('form');
  const input = form.querySelector('input');
  const out = root.querySelector('.cs-out');
  const exs = [...root.querySelectorAll('.cs-ex button')];
  let seq = 0, timer = 0, last = '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('ja-JP');
  const ym = s => { const m = /^(\d{4})(?:-(\d{2}))?/.exec(s || ''); return m ? (m[2] ? `${m[1]}年${Number(m[2])}月` : `${m[1]}年`) : ''; };
  const EXT = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5h5.5V7M8.5 1.5L1.5 8.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

  function card(x) {
    const tags = [x.industry, x.dept].filter(Boolean).map(t => `<span class="t">${esc(t)}</span>`).join('');
    const src = [x.publisher, ym(x.publishedAt)].filter(Boolean).join('・');
    const body = `<div class="cs-top">${tags}<span class="st${x.stage === '使っている' ? ' on' : ''}"><i></i>${esc(x.stage)}</span></div>
      <p class="cs-co">${esc(x.company)}</p>
      <h3 class="cs-ti">${esc(x.title)}</h3>
      <p class="cs-su">${esc(x.summary)}</p>
      <p class="cs-src"><span>出典：${esc(src)}</span>${x.url ? EXT : ''}</p>`;
    return x.url ? `<a class="cs-card" href="${esc(x.url)}" target="_blank" rel="noopener">${body}</a>` : `<article class="cs-card">${body}</article>`;
  }

  function render(q, d) {
    if (!d.total) {
      out.innerHTML = `<p class="cs-msg">「${esc(q)}」に当てはまる事例は、まだ見つかりませんでした。業種と仕事の名前を組み合わせて（たとえば「製造業 議事録」「物流 問い合わせ」）探してみてください。</p>`;
      return;
    }
    const what = [d.relaxed ? '' : d.understood.industry, ...d.understood.words].filter(Boolean);
    out.innerHTML = `<div class="cs-head">
        <p class="cs-what">${what.map(esc).join('<i>×</i>')}</p>
        <p class="cs-count"><b>${num(d.total)}</b>件の事例（${num(d.companies)}社）</p>
      </div>
      ${d.relaxed ? `<p class="cs-note">${esc(d.understood.industry)}の事例は見つからなかったので、ほかの業種の事例を出しています。</p>` : ''}
      <div class="cs-grid">${d.items.map(card).join('')}</div>
      <div class="cs-more"><p>全<b>${num(d.total)}</b>件は、無料相談のときに画面で一緒にご覧いただけます。</p><a class="btn blue" href="/companymap/contact">無料相談を申し込む <i>→</i></a></div>`;
  }

  async function search(q) {
    q = q.trim();
    if (!q || q === last) return;
    last = q;
    exs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.q === q)));
    const my = ++seq;
    out.setAttribute('aria-busy', 'true');
    if (!out.querySelector('.cs-card')) out.innerHTML = '<p class="cs-msg">事例を探しています…</p>'; // 結果がまだ無いときだけ（1秒ほどかかる）
    try {
      const r = await fetch(`${API}?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (my === seq) render(q, d);
    } catch (e) {
      if (my === seq) { last = ''; out.innerHTML = '<p class="cs-msg">いまは事例を読み込めませんでした。少し時間をおいて、もう一度お試しください。</p>'; }
    } finally {
      if (my === seq) out.removeAttribute('aria-busy');
    }
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search(input.value), 450); });
  form.addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); search(input.value); });
  exs.forEach(b => b.addEventListener('click', () => { input.value = b.dataset.q; clearTimeout(timer); search(b.dataset.q); }));

  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); search(input.value); } }, { rootMargin: '400px 0px' });
  io.observe(root);
})();
