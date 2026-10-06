(function () {
  'use strict';
  document.querySelectorAll('[data-audience-catalog]').forEach(function (catalog) {
    var controls = catalog.querySelector('.audience-controls');
    var buttons = Array.from(controls.querySelectorAll('[data-audience-filter]'));
    var items = Array.from(catalog.querySelectorAll('[data-audience-item]'));
    var result = catalog.querySelector('.audience-result');
    var empty = catalog.querySelector('.audience-empty');
    var allMediaLink = empty.querySelector('a');
    var more = catalog.querySelector('.audience-more');
    var pageSize = Number(catalog.dataset.audiencePageSize) || items.length;
    var shown = pageSize;
    var selected = 'all';
    function readSelection() {
      var value = new URL(window.location.href).searchParams.get('audience') || 'all';
      return buttons.some(function (button) { return button.dataset.audienceFilter === value; }) ? value : 'all';
    }
    function render() {
      var matching = items.filter(function (item) { return selected === 'all' || item.dataset.audience === selected; });
      items.forEach(function (item) { item.hidden = true; });
      matching.slice(0, shown).forEach(function (item) { item.hidden = false; });
      buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.audienceFilter === selected)); });
      var label = buttons.find(function (button) { return button.dataset.audienceFilter === selected; }).dataset.audienceLabel;
      result.textContent = label + '：' + matching.length + '件' + (matching.length > shown ? '（' + shown + '件を表示）' : '');
      empty.hidden = matching.length !== 0;
      allMediaLink.href = '/media/?audience=' + encodeURIComponent(selected) + '#articles';
      more.hidden = matching.length <= shown;
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var value = button.dataset.audienceFilter;
        if (selected === value) return;
        selected = value;
        shown = pageSize;
        var url = new URL(window.location.href);
        if (value === 'all') url.searchParams.delete('audience');
        else url.searchParams.set('audience', value);
        url.hash = catalog.id;
        window.history.pushState(null, '', url);
        render();
      });
    });
    more.addEventListener('click', function () {
      var matching = items.filter(function (item) { return selected === 'all' || item.dataset.audience === selected; });
      var next = matching[shown];
      shown += pageSize;
      render();
      if (next) next.focus({ preventScroll: true });
    });
    window.addEventListener('popstate', function () { selected = readSelection(); shown = pageSize; render(); });
    selected = readSelection();
    render();
    controls.hidden = false;
  });
})();
