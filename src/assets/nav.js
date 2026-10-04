// D-pad controls: ↑/↓ move the cursor, Enter/A opens, ←/→ page, Esc/B goes back.
// On the home page the cursor starts after the name, which is the stop before
// the first menu item and after the last one. On phones the same actions are
// on-screen buttons: a small Game Boy pad on the console pages, a pill on posts.
//
// The selection is tracked here rather than read from document focus, because
// tapping an on-screen button moves focus to the button on some phones.
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.menu a, .home .more'));
  var pager = Array.prototype.slice.call(document.querySelectorAll('.pager a'));
  var prev = pager.filter(function (a) { return /^\s*◀/.test(a.textContent); })[0];
  var next = pager.filter(function (a) { return /▶\s*$/.test(a.textContent); })[0];
  var back = document.querySelector('.crumbs a');
  var home = !!document.querySelector('.home .title .cursor');
  var root = document.documentElement;
  var cur = -1; // -1: nothing selected (on home, the cursor sits after the name)

  function select(i) {
    if (i < 0 || i >= items.length) i = home ? -1 : (i + items.length) % items.length;
    if (cur !== -1) items[cur].classList.remove('is-sel');
    cur = i;
    root.classList.toggle('picking', cur !== -1);
    if (cur === -1) {
      if (items.indexOf(document.activeElement) !== -1) document.activeElement.blur();
      return;
    }
    items[cur].classList.add('is-sel');
    items[cur].focus({ preventScroll: true });
    items[cur].scrollIntoView({ block: 'nearest' });
  }

  // Pointing at an item, or tabbing to it, selects it too.
  items.forEach(function (a, i) {
    a.addEventListener('mouseenter', function () { if (cur !== i) select(i); });
    a.addEventListener('focus', function () { if (cur !== i) select(i); });
  });

  function act(button) {
    if ((button === 'up' || button === 'down') && items.length) {
      var step = button === 'down' ? 1 : -1;
      select(cur === -1 ? (step === 1 ? 0 : items.length - 1) : cur + step);
      return true;
    }
    if (button === 'a' && cur !== -1) { items[cur].click(); return true; }
    if (button === 'left' && prev) { prev.click(); return true; }
    if (button === 'right' && next) { next.click(); return true; }
    if (button === 'b' && back) { back.click(); return true; }
    if (button === 'b' && home && cur !== -1) { select(-1); return true; }
    return false;
  }

  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', a: 'a', b: 'b', Escape: 'b' };
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var button = KEYS[key];
    if (button && act(button) && (button === 'up' || button === 'down')) e.preventDefault();
  });

  // On-screen buttons never take focus, so the selection stays where it is.
  // Without a menu (posts), ↑/↓ scroll the page instead.
  document.querySelectorAll('[data-pad]').forEach(function (el) {
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var button = el.getAttribute('data-pad');
      if (navigator.vibrate) navigator.vibrate(8);
      if (button === 'start') { location.href = '/'; return; }
      if (button === 'select') { location.href = '/writing/'; return; }
      if (act(button)) return;
      if (button === 'up' || button === 'down') {
        window.scrollBy({ top: (button === 'down' ? 1 : -1) * window.innerHeight * 0.8, behavior: 'smooth' });
      }
    });
  });

  // The posts' pill tucks away while reading down and comes back on the way up.
  var pill = document.querySelector('.minipad');
  if (pill) {
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      var atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
      if (Math.abs(y - lastY) < 6) return;
      pill.classList.toggle('tucked', y > lastY && y > 120 && !atEnd);
      lastY = y;
    }, { passive: true });
  }
})();
