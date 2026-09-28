// /companymap の相談への導線：右下の案内（スマホは下の帯）と、どの相談ボタンが押されたかの計測（GA4）。
// 案内は最初の画面を過ぎてから出し、最後の申し込み欄とフッターが見えている間は隠す。閉じたらこのタブでは出さない。
(() => {
  const track = (name, params) => { if (typeof window.gtag === 'function') window.gtag('event', name, params); };

  // どの相談ボタンか：data-cta → ヘッダー → 最初の画面 → いちばん近い id
  const where = a => a.dataset.cta || (a.closest('.nav') && 'nav') || (a.closest('.hero') && 'hero') || a.closest('[id]')?.id || 'other';
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="/companymap/contact"]');
    if (a) track('companymap_cta_click', { location: where(a) });
  });

  const KEY = 'cm_pop_closed';
  let closed = false;
  try { closed = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
  if (closed) return;

  const pop = document.createElement('aside');
  pop.className = 'cm-pop';
  pop.setAttribute('aria-label', '無料相談のご案内');
  pop.innerHTML = `<button class="cm-pop-x" type="button" aria-label="閉じる">×</button>
    <p class="cm-pop-k">無料相談</p>
    <p class="cm-pop-t"><span class="cm-l">最初の業務図を、<br>無料でおつくりします。</span><span class="cm-s">最初の業務図を、無料で。</span></p>
    <p class="cm-pop-d">30分のオンラインで、部署のお仕事を伺いながら一緒につくります。</p>
    <a class="cm-pop-b" href="/companymap/contact" data-cta="popup"><span class="cm-l">無料相談を</span>申し込む <i>→</i></a>`;
  document.body.appendChild(pop);

  const hero = document.querySelector('.hero');
  const blockers = [document.getElementById('cta'), document.querySelector('footer')].filter(Boolean);
  let pastHero = false, blocked = false, viewed = false;
  const update = () => {
    const show = pastHero && !blocked;
    pop.classList.toggle('on', show);
    if (show && !viewed) { viewed = true; track('companymap_popup_view', {}); }
  };
  if (hero) new IntersectionObserver(es => { pastHero = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; update(); }).observe(hero);
  const seen = new Set();
  const bio = new IntersectionObserver(es => { es.forEach(e => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))); blocked = seen.size > 0; update(); });
  blockers.forEach(b => bio.observe(b));

  pop.querySelector('.cm-pop-x').addEventListener('click', () => {
    pop.classList.remove('on');
    track('companymap_popup_close', {});
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    setTimeout(() => pop.remove(), 400);
  });
  pop.querySelector('.cm-pop-b').addEventListener('click', () => track('companymap_popup_click', {}));
})();
