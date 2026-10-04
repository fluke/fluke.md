// D-pad controls: ↑/↓ move the cursor, Enter/A opens, ←/→ page, Esc/B goes back.
// On the home page the cursor starts after the name, which is the stop before
// the first menu item and after the last one. On phones the same actions are
// on-screen buttons: a Game Boy pad on the console pages, a small pill on posts.
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.menu a, .home .more'));
  var pager = Array.prototype.slice.call(document.querySelectorAll('.pager a'));
  var prev = pager.filter(function (a) { return /^\s*◀/.test(a.textContent); })[0];
  var next = pager.filter(function (a) { return /▶\s*$/.test(a.textContent); })[0];
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

  // One action per button; returns true when it did something.
  function act(button) {
    var i = items.indexOf(document.activeElement);
    if ((button === 'up' || button === 'down') && items.length) {
      var step = button === 'down' ? 1 : -1;
      select(i === -1 ? (step === 1 ? 0 : items.length - 1) : i + step);
      return true;
    }
    if (button === 'a' && document.activeElement && document.activeElement.tagName === 'A') {
      document.activeElement.click();
      return true;
    }
    if (button === 'left' && prev) { prev.click(); return true; }
    if (button === 'right' && next) { next.click(); return true; }
    if (button === 'b' && back) { back.click(); return true; }
    if (button === 'b' && home && i !== -1) { document.activeElement.blur(); return true; }
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

  // On-screen buttons. Without a menu, ↑/↓ scroll the page instead.
  document.querySelectorAll('[data-pad]').forEach(function (el) {
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
      pill.classList.toggle('tucked', y > lastY && y > 120 && !atEnd);
      lastY = y;
    }, { passive: true });
  }
})();
