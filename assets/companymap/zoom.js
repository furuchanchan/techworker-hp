// 製品画面の画像を、クリック（スマホはタップ）で元の大きさ（撮影時の等倍）で見せる。対象は data-zoom の付いた要素。
(function(){
  var items=document.querySelectorAll('[data-zoom]');
  if(!items.length) return;
  var d=document.createElement('dialog');
  d.className='zoom';
  d.setAttribute('aria-label','画面を拡大して表示');
  d.innerHTML='<div class="zin" tabindex="-1" autofocus><img alt=""></div><button type="button" class="x" aria-label="閉じる">×</button>';
  document.body.appendChild(d);
  var img=d.querySelector('img');
  img.addEventListener('load',function(){ img.style.width=(img.naturalWidth/2)+'px'; });
  d.querySelector('.x').addEventListener('click',function(){ d.close(); });
  d.addEventListener('click',function(e){ if(e.target===d) d.close(); });
  var touch=window.matchMedia('(hover: none)').matches;
  items.forEach(function(el){
    el.setAttribute('role','button');
    el.setAttribute('tabindex','0');
    el.setAttribute('aria-label',(el.dataset.zoomAlt||'画面')+'を拡大して見る');
    var hint=document.createElement('span');
    hint.className='zoom-hint';
    hint.setAttribute('aria-hidden','true');
    hint.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5M7 5v4M5 7h4" stroke-linecap="round"/></svg>'+(touch?'タップで拡大':'クリックで拡大');
    el.appendChild(hint);
    function open(){
      img.style.width='';
      img.src=el.dataset.zoom;
      img.alt=el.dataset.zoomAlt||'';
      d.showModal();
      if(typeof gtag==='function') gtag('event','companymap_image_zoom',{image:el.dataset.zoom.split('/').pop()});
    }
    el.addEventListener('click',open);
    el.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } });
  });
})();
