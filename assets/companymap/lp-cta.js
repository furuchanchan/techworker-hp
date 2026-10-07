// 申し込みボタンのクリック計測と、追従の帯の出し入れ
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-cta-location]');
    if (!a || typeof window.gtag !== 'function') return;
    window.gtag('event', 'companymap_cta_click', { cta_location: a.dataset.ctaLocation, cta_type: a.dataset.ctaType });
  });
  var bar = document.getElementById('cvrbar');
  var hero = document.querySelector('.hero');
  if (!bar || !hero) return;
  var stops = [document.getElementById('resources'), document.querySelector('footer')];
  function update() {
    var past = hero.getBoundingClientRect().bottom < 0;
    var hide = stops.some(function (el) { return el && el.getBoundingClientRect().top < innerHeight; });
    bar.classList.toggle('on', past && !hide);
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
