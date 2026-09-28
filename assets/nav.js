// D-pad controls: ↑/↓ move the menu cursor, Enter/A opens, ←/→ page, Esc/B goes back.
(function () {
  var items = function () { return Array.prototype.slice.call(document.querySelectorAll('.menu a')); };
  var pager = document.querySelectorAll('.pager a');
  var back = document.querySelector('.crumbs a');

  function select(list, i) {
    var a = list[(i + list.length) % list.length];
    a.focus();
    a.scrollIntoView({ block: 'nearest' });
  }

  // Keep a single cursor: pointing at an item selects it.
  items().forEach(function (a) {
    a.addEventListener('mouseenter', function () { a.focus({ preventScroll: true }); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

    var list = items();
    var i = list.indexOf(document.activeElement);
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if ((key === 'ArrowDown' || key === 'ArrowUp') && list.length) {
      e.preventDefault();
      if (i === -1) select(list, key === 'ArrowDown' ? 0 : -1);
      else select(list, i + (key === 'ArrowDown' ? 1 : -1));
    } else if (key === 'a' && document.activeElement && document.activeElement.tagName === 'A') {
      document.activeElement.click();
    } else if (key === 'ArrowLeft' && pager.length > 1) {
      pager[0].click();
    } else if (key === 'ArrowRight' && pager.length > 1) {
      pager[pager.length - 1].click();
    } else if ((key === 'Escape' || key === 'b') && back) {
      back.click();
    }
  });
})();
