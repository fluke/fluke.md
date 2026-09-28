// D-pad controls: ↑/↓ move the cursor, Enter/A opens, ←/→ page, Esc/B goes back.
// On the home page the cursor starts after the name, which is the stop before
// the first menu item and after the last one.
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.menu a'));
  var pager = document.querySelectorAll('.pager a');
  var back = document.querySelector('.crumbs a');
  var home = !!document.querySelector('.home .title .cursor');
  var root = document.documentElement;

  function select(i) {
    if (i < 0 || i >= items.length) {
      if (home) { document.activeElement.blur(); return; }
      i = (i + items.length) % items.length;
    }
    items[i].focus();
    items[i].scrollIntoView({ block: 'nearest' });
  }

  // The name cursor hides while a menu item holds the cursor.
  document.addEventListener('focusin', function () {
    root.classList.toggle('picking', items.indexOf(document.activeElement) !== -1);
  });
  document.addEventListener('focusout', function (e) {
    if (items.indexOf(e.relatedTarget) === -1) root.classList.remove('picking');
  });

  // Keep a single cursor: pointing at an item selects it.
  items.forEach(function (a) {
    a.addEventListener('mouseenter', function () { a.focus({ preventScroll: true }); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

    var i = items.indexOf(document.activeElement);
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if ((key === 'ArrowDown' || key === 'ArrowUp') && items.length) {
      e.preventDefault();
      var step = key === 'ArrowDown' ? 1 : -1;
      if (i === -1) select(step === 1 ? 0 : items.length - 1);
      else select(i + step);
    } else if (key === 'a' && document.activeElement && document.activeElement.tagName === 'A') {
      document.activeElement.click();
    } else if (key === 'ArrowLeft' && pager.length > 1) {
      pager[0].click();
    } else if (key === 'ArrowRight' && pager.length > 1) {
      pager[pager.length - 1].click();
    } else if ((key === 'Escape' || key === 'b') && back) {
      back.click();
    } else if ((key === 'Escape' || key === 'b') && home && i !== -1) {
      document.activeElement.blur();
    }
  });
})();
