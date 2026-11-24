(function () {
  var menu = document.getElementById('menu');
  function closeDd(except) {
    document.querySelectorAll('.dd.open').forEach(function (d) {
      if (d !== except) { d.classList.remove('open'); d.querySelector('.dd-b').setAttribute('aria-expanded', 'false'); }
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var b = t.closest('.dd-b');
    closeDd(b ? b.parentNode : null);
    if (b) { var o = b.parentNode.classList.toggle('open'); b.setAttribute('aria-expanded', o ? 'true' : 'false'); return; }
    if (t.closest('[data-burger]')) { e.preventDefault(); menu.hidden = false; menu.scrollTop = 0; return; }
    if (t.closest('[data-close]') || (t.closest('#menu a'))) { menu.hidden = true; }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-burger]')) { e.preventDefault(); menu.hidden = false; }
    if (e.key === 'Escape') { menu.hidden = true; closeDd(null); }
  });
})();
/* Animations et interactions communes au prototype et au site de production :
   apparition au defilement, compteurs, comptes a rebours, bandeau des echeances, feuille de route, fiches echeance. */
(function () {
  var d = document, de = d.documentElement, DAY = 86400000;
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function utc(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function today() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  function days(s) { return Math.round((utc(s) - today()) / DAY); }
  function clamp(x) { return Math.max(0, Math.min(1, x)); }

  /* comptes a rebours */
  all('[data-cd]').forEach(function (w) {
    var n = days(w.getAttribute('data-cd')), mx = +(w.getAttribute('data-cd-max') || 0);
    var f = w.querySelector('.cd-f'), p = w.querySelector('.cd-p');
    if (f) { f.hidden = n < 0; var b = f.querySelector('b'); if (b) b.textContent = Math.max(n, 0); }
    if (p) { p.hidden = n >= 0; var b2 = p.querySelector('b'); if (b2) b2.textContent = Math.max(-n, 0); }
    if (f && w.getAttribute('data-cd-u') === 'm') { /* echeance approximative : en mois, puis en jours sous deux mois */
      var mo = n >= 60, um = f.querySelector('.um'), ud = f.querySelector('.ud'), bm = f.querySelector('b');
      if (bm && mo) bm.textContent = Math.round(n / 30.44);
      if (um) um.hidden = !mo; if (ud) ud.hidden = mo;
    }
    if (mx) w.hidden = n > mx;
  });
  all('[data-tk]').forEach(function (c) {
    var n = days(c.getAttribute('data-tk'));
    if (n < 0) { c.hidden = true; return; }
    var b = c.querySelector('b'); if (b) b.textContent = n;
  });

  /* anneau et ligne du temps des fiches */
  all('[data-ring]').forEach(function (r) {
    var a = utc(r.getAttribute('data-from')), z = utc(r.getAttribute('data-to'));
    var g = r.querySelector('.rg'); if (g) g.style.setProperty('--off', (339.3 * (1 - clamp((today() - a) / (z - a)))).toFixed(1));
  });
  all('[data-tl]').forEach(function (tl) {
    var li = all('[data-at]', tl), t = today(), p = 0, n = li.length;
    li.forEach(function (x, i) {
      var a = utc(x.getAttribute('data-at'));
      if (a <= t) { x.classList.add('done'); p = i / (n - 1); var nx = li[i + 1]; if (nx) { var z = utc(nx.getAttribute('data-at')); p += clamp((t - a) / (z - a)) / (n - 1); } }
    });
    tl.style.setProperty('--p', clamp(p).toFixed(4));
    var now = tl.querySelector('.ec-now'); if (now) now.hidden = !(p > 0 && p < 1);
  });

  /* compteurs */
  function countUp(el) {
    if (RM || el.__cu) return; el.__cu = 1;
    var to = parseInt(String(el.textContent).replace(/\D/g, ''), 10); if (!(to > 1)) return;
    var t0 = 0, dur = 800 + Math.min(to * 3, 700);
    function step(t) { if (!t0) t0 = t; var k = Math.min((t - t0) / dur, 1); k = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * k); if (k < 1) requestAnimationFrame(step); else el.textContent = to; }
    el.textContent = 0; requestAnimationFrame(step);
  }

  /* apparition au defilement */
  if ('IntersectionObserver' in window) {
    de.classList.add('fx');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target.hasAttribute('data-cu')) { countUp(e.target); return; }
        e.target.classList.add('in');
      });
    }, { rootMargin: '0px 0px -7% 0px' });
    all('.view > div > section').forEach(function (s, i, arr) {
      if (s.previousElementSibling && s.previousElementSibling.tagName === 'HEADER') return; /* premier ecran : pas d'effet */
      s.classList.add('rv'); io.observe(s);
    });
    all('.an, [data-cu]').forEach(function (x) { io.observe(x); });
  }

  /* feuille de route */
  all('[data-rm]').forEach(function (root) {
    var st = { type: '', fam: '', view: 'list' }, timer = null, paused = false, idx = -1;
    var rows = all('.rm-e', root), chips = all('.rm-ch', root);
    function row(id) { return root.querySelector('.rm-e[data-id="' + id + '"]'); }
    function has(r, attr, v) { return (' ' + (r.getAttribute(attr) || '') + ' ').indexOf(' ' + v + ' ') >= 0; }
    function apply() {
      var n = 0;
      rows.forEach(function (r) {
        var c = st.type && has(r, 'data-c', st.type), s = st.type && has(r, 'data-s', st.type);
        var ok = (!st.type || c || s) && (!st.fam || r.getAttribute('data-fam') === st.fam);
        r.hidden = !ok; if (ok) n++;
        r.classList.toggle('is-c', !!c); r.classList.toggle('is-s', !!s && !c);
      });
      all('.rm-y', root).forEach(function (y) { y.hidden = !y.querySelector('.rm-e:not([hidden])'); });
      chips.forEach(function (ch) { var r = row(ch.getAttribute('data-ev')); ch.hidden = !!(r && r.hidden); });
      all('[data-n]', root).forEach(function (x) { x.textContent = n; });
      all('.rm-empty', root).forEach(function (x) { x.hidden = n > 0; });
      all('[data-type]', root).forEach(function (b) { if (b.classList.contains('rm-c')) b.setAttribute('aria-pressed', b.getAttribute('data-type') === st.type ? 'true' : 'false'); });
      all('[data-famb]', root).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-famb') === st.fam ? 'true' : 'false'); });
      all('.rm-mx tbody tr', root).forEach(function (tr) { tr.classList.toggle('on', !!st.type && tr.getAttribute('data-row') === st.type); });
      idx = -1;
    }
    function view(v) {
      st.view = v;
      all('.rm-v', root).forEach(function (x) { x.hidden = x.getAttribute('data-v') !== v; });
      all('.rm-t', root).forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-view') === v ? 'true' : 'false'); });
      if (v === 'fz') { var fz = root.querySelector('.rm-fz'); if (fz) fz.classList.add('in'); play(); } else stop();
    }
    function caption(ch) {
      chips.forEach(function (c) { c.classList.toggle('on', c === ch); });
      var r = ch && row(ch.getAttribute('data-ev')), cap = root.querySelector('.rm-cap'); if (!r || !cap) return;
      cap.querySelector('span').textContent = (r.querySelector('.rm-d') || {}).textContent || '';
      cap.querySelector('b').textContent = (r.querySelector('.rm-tt') || {}).textContent || '';
    }
    function next() {
      var vis = chips.filter(function (c) { return !c.hidden && c.getAttribute('data-date'); }).sort(function (a, b) { return a.getAttribute('data-date') < b.getAttribute('data-date') ? -1 : 1; });
      if (!vis.length) return; idx = (idx + 1) % vis.length; caption(vis[idx]);
    }
    function play() { stop(); if (idx < 0) next(); if (RM || paused) return; timer = setInterval(next, 2600); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function goRow(id) {
      var r = row(id); if (!r) return;
      if (r.hidden) { st.type = ''; st.fam = ''; apply(); }
      view('list');
      setTimeout(function () { r.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }, 60);
    }
    root.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : e.target.parentNode, b;
      if ((b = t.closest('.rm-c[data-type]'))) { st.type = b.getAttribute('data-type'); apply(); return; }
      if ((b = t.closest('[data-famb]'))) { st.fam = b.getAttribute('data-famb'); apply(); return; }
      if ((b = t.closest('.rm-t'))) { view(b.getAttribute('data-view')); return; }
      if ((b = t.closest('.rm-pp'))) { paused = !paused; b.setAttribute('aria-pressed', paused ? 'true' : 'false'); if (paused) stop(); else play(); return; }
      if ((b = t.closest('.rm-bb'))) {
        st.type = b.getAttribute('data-type'); st.fam = ''; apply(); view('list');
        var y = root.querySelector('.rm-y[data-year="' + b.getAttribute('data-year') + '"]');
        if (y) setTimeout(function () { y.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }, 60);
        return;
      }
      if ((b = t.closest('.rm-ch[data-row]'))) { e.preventDefault(); e.stopPropagation(); goRow(b.getAttribute('data-ev')); }
    });
    var fzEl = root.querySelector('.rm-fz');
    if (fzEl) {
      fzEl.addEventListener('mouseover', function (e) { var c = e.target.closest && e.target.closest('.rm-ch'); if (c) { stop(); caption(c); } });
      fzEl.addEventListener('focusin', function (e) { var c = e.target.closest && e.target.closest('.rm-ch'); if (c) { stop(); caption(c); } });
      fzEl.addEventListener('mouseleave', function () { if (st.view === 'fz' && !paused && !RM && !timer) timer = setInterval(next, 2600); });
    }
    all('.rm-now', root).forEach(function (n) {
      var a = utc(n.getAttribute('data-a')), z = utc(n.getAttribute('data-z'));
      n.style.left = (clamp((today() - a) / (z - a)) * 100).toFixed(2) + '%';
    });
    all('.rm-v', root).forEach(function (x) { x.hidden = x.getAttribute('data-v') !== 'list'; });
    all('.rm-tabs', root).forEach(function (x) { x.hidden = false; });
    apply();
  });
})();
