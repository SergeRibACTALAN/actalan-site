/* Diagnostics Actalan — moteur v4. Aucune donnée n'est envoyée : tout reste dans le navigateur. */
(function () {
  'use strict';
  var SC = { M: 3, P: 2, E: 1, R: 0 };
  var LAB = { M: 'Maîtrisé', P: 'Partiel', E: 'En cours', R: 'Rien de formalisé', U: 'Je ne sais pas', NA: 'Non applicable' };
  var DESC = { M: 'en place, documenté, vérifié', P: 'en place sur une partie du périmètre, ou sans preuve', E: 'identifié, travaux lancés, pas encore opérationnel', R: 'ou très manuel' };
  var PROF = { M: 'Maîtrisé', S: 'En structuration', F: 'Fragile', V: 'Vision incomplète' };
  var MAIL = 'serge.ribeiro@actalan.com';

  function applicable(q, flags) {
    if (!q.when) return true;
    return q.when.charAt(0) === '!' ? !flags[q.when.slice(1)] : !!flags[q.when];
  }
  function pick(map, flags) { if (map) { for (var k in map) { if (flags[k]) return map[k]; } } return null; }
  function qText(q, flags) { return pick(q.alt, flags) || q.q; }
  function num(code) { return parseInt(String(code).replace(/\D/g, ''), 10) || 0; }

  function flat(model) {
    var all = [];
    model.dims.forEach(function (d, di) { d.items.forEach(function (q) { all.push({ q: q, di: di }); }); });
    return all;
  }
  function expressSet(model) {
    return flat(model).filter(function (x) { return x.q.code && model.express.indexOf(x.q.code) >= 0; })
      .sort(function (a, b) { return num(a.q.code) - num(b.q.code); });
  }

  /* Notation : règles communes du document v4, section 1.3 */
  function score(model, ans, flags, mode) {
    var all = flat(model), set = mode === 'grille' ? all : expressSet(model);
    var app = set.filter(function (x) { return applicable(x.q, flags); });
    var n = app.length, s = 0, pts = 0, nR = 0, nE = 0, nU = 0, rows = [];
    app.forEach(function (x, i) {
      var a = ans[x.q.id]; if (!(a in SC)) a = 'U';
      if (a === 'U') nU++; else { s++; pts += SC[a]; if (a === 'R') nR++; if (a === 'E') nE++; }
      rows.push({ q: x.q, di: x.di, a: a, o: i });
    });
    var idx = s ? pts / (3 * s) : null;
    var minS = Math.ceil((mode === 'grille' ? 0.8 : 0.7) * n);
    var byCode = {}; all.forEach(function (x) { if (x.q.code) byCode[x.q.code] = x.q; });
    var crit = null;
    [model.crit, model.repli].some(function (c) { var q = c && byCode[c]; if (q && applicable(q, flags)) { crit = q; return true; } return false; });
    var ca = crit ? (ans[crit.id] in SC ? ans[crit.id] : 'U') : null;
    var maxR = Math.max(2, Math.ceil(0.2 * n)), maxE = Math.floor(s / 10);
    var prof, why = [], caps = [];
    if (crit && ca === 'R') { prof = 'F'; why.push('crit'); if (s < minS) why.push('partial'); }
    else if (s < minS) { prof = 'V'; why.push('min'); }
    else if (idx < 0.40) { prof = 'F'; why.push('idx'); }
    else if (nR >= maxR) { prof = 'F'; why.push('nR'); }
    else if (idx >= 0.80 && nR === 0 && nE <= maxE && !(crit && ca === 'U')) { prof = 'M'; if (nU) why.push('someU'); }
    else {
      prof = 'S';
      if (idx >= 0.80) { if (nR) caps.push('R'); if (nE > maxE) caps.push('E'); if (crit && ca === 'U') caps.push('critU'); }
    }
    var isX = function (q) { return q.code && model.express.indexOf(q.code) >= 0 ? 0 : 1; };
    var weak = rows.filter(function (r) { return r.a !== 'U' && r.a !== 'M'; }).sort(function (a, b) {
      return SC[a.a] - SC[b.a] || (crit && a.q === crit ? -1 : 0) - (crit && b.q === crit ? -1 : 0) || isX(a.q) - isX(b.q) || a.o - b.o;
    });
    var dims = model.dims.map(function (d, di) {
      var p = 0, c = 0; rows.forEach(function (r) { if (r.di === di && r.a !== 'U') { p += SC[r.a]; c++; } });
      return { t: d.t, v: c ? Math.round(100 * p / (3 * c)) : null, n: rows.filter(function (r) { return r.di === di; }).length };
    });
    var alerts = (model.alertes || []).filter(function (al) {
      var q = byCode[al.code]; if (!q || !applicable(q, flags)) return false; var a = ans[q.id]; return a === 'R' || a === 'E';
    });
    return { mode: mode, n: n, s: s, nR: nR, nE: nE, nU: nU, idx: idx, minS: minS, prof: prof, why: why, caps: caps, crit: crit, critAns: ca,
      rows: rows, weak: weak, unknown: rows.filter(function (r) { return r.a === 'U'; }), dims: dims, alerts: alerts };
  }

  window.ActalanDiag = { score: score, applicable: applicable };

  /* ───────── Page d'accueil des diagnostics : filtre par secteur ───────── */
  var chips = document.querySelectorAll('.dg-fchip');
  if (chips.length) {
    Array.prototype.forEach.call(chips, function (c) {
      c.addEventListener('click', function () {
        var f = c.getAttribute('data-f');
        Array.prototype.forEach.call(chips, function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
        var shown = 0;
        Array.prototype.forEach.call(document.querySelectorAll('.dg-tile[data-s]'), function (t) {
          var ok = f === '*' || t.getAttribute('data-s').split('|').indexOf(f) >= 0;
          t.hidden = !ok; if (ok) shown++;
        });
        var cnt = document.getElementById('dg-count'); if (cnt) cnt.textContent = shown + (shown > 1 ? ' diagnostics' : ' diagnostic');
      });
    });
  }

  var dataEl = document.getElementById('dg-data'), card = document.getElementById('dg-card');
  if (!dataEl || !card) return;
  var M = JSON.parse(dataEl.textContent), KEY = 'actalan-diag-' + M.slug, VER = M.v;
  var st = fresh(), saved = null;

  function fresh() { return { phase: 'intro', fc: [], qi: 0, ans: {} }; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VER, st: st })); } catch (e) { } }
  function load() { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.v === VER && o.st && o.st.phase && o.st.phase !== 'intro') return o.st; } catch (e) { } return null; }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { } }

  /* drapeaux, notes et informations déduits des réponses au filtre */
  function ctx() {
    var flags = {}, notes = [], info = [], exit = null;
    st.fc.forEach(function (ci, i) {
      var f = M.filtre[i], o = f && f.opts[ci]; if (!o) return;
      if (o.set) flags[o.set] = true;
      if (o.note && notes.indexOf(o.note) < 0) notes.push(o.note);
      if (o.exit) exit = o.exit;
      if (f.info) info.push(f.info + ' : ' + o.l);
    });
    return { flags: flags, notes: notes, info: info, exit: exit };
  }
  function queue() {
    var c = ctx(), ex = expressSet(M).filter(function (x) { return applicable(x.q, c.flags); }).map(function (x) { return x.q; });
    if (st.phase === 'grille') {
      return flat(M).filter(function (x) { return applicable(x.q, c.flags) && ex.indexOf(x.q) < 0; });
    }
    return ex.map(function (q) { return { q: q, di: -1 }; });
  }

  function lv(k) { var n = { M: 4, P: 3, E: 2, R: 1 }[k] || 0, h = ''; for (var i = 1; i <= 4; i++) h += '<i' + (i <= n ? ' class="on"' : '') + '></i>'; return '<span class="dg-lv" aria-hidden="true">' + h + '</span>'; }
  function chip(a) { return '<span class="dg-chip ' + a + '">' + LAB[a] + '</span>'; }
  function head(step, total, label) {
    var pct = Math.round(100 * step / total);
    return '<div class="dg-top"><div class="dg-step"><span>' + esc(label) + '</span><span>' + step + ' / ' + total + '</span></div>' +
      '<div class="dg-prog" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + step + '"><i style="width:' + pct + '%"></i></div></div>';
  }
  function back() { return '<div class="dg-nav"><button type="button" class="dg-btn txt" data-act="back">← Précédent</button><span class="dg-hint">Clavier : 1 à 4, 0 pour « Je ne sais pas »</span></div>'; }

  function vIntro() {
    var h = '<div class="dg-intro"><h2 class="dg-q" tabindex="-1">7 questions pour situer votre organisation</h2>' +
      '<p class="dg-p">Vous répondez sur une échelle simple, de « Maîtrisé » à « Rien de formalisé ». Le résultat s’affiche immédiatement : profil, point de vigilance prioritaire, pistes d’action. Vous pourrez ensuite approfondir avec la grille complète de 30 points.</p>' +
      '<ul class="dg-ticks"><li>3 à 5 minutes, sans adresse électronique</li><li>Vos réponses restent dans votre navigateur : rien n’est envoyé à Actalan</li><li>Un résultat fondé sur vos seules réponses : ni audit, ni avis juridique</li></ul>';
    h += '<div class="dg-actions">';
    if (saved) h += '<button type="button" class="dg-btn" data-act="resume">Reprendre où j’en étais <span aria-hidden="true">→</span></button><button type="button" class="dg-btn line" data-act="start">Recommencer</button>';
    else h += '<button type="button" class="dg-btn" data-act="start">Commencer le diagnostic <span aria-hidden="true">→</span></button>';
    return h + '</div></div>';
  }
  function vFilter() {
    var i = st.fc.length, f = M.filtre[i];
    var h = head(i + 1, M.filtre.length, 'Avant de commencer') + '<h2 class="dg-q" tabindex="-1">' + esc(f.q) + '</h2><div class="dg-opts">';
    f.opts.forEach(function (o, k) { h += '<button type="button" class="dg-opt" data-act="f" data-k="' + k + '"><span class="dg-ob"><b>' + esc(o.l) + '</b></span></button>'; });
    return h + '</div><div class="dg-nav"><button type="button" class="dg-btn txt" data-act="back">← Précédent</button></div>';
  }
  function vQuestion() {
    var Q = queue(), x = Q[st.qi], c = ctx(), q = x.q, cur = st.ans[q.id];
    var label = st.phase === 'grille' ? 'Dimension ' + (x.di + 1) + ' sur 6 · ' + M.dims[x.di].t : 'Diagnostic express';
    var scale = pick(q.echelle, c.flags) || DESC;
    var h = head(st.qi + 1, Q.length, label) + '<h2 class="dg-q" tabindex="-1">' + esc(qText(q, c.flags)) + '</h2><div class="dg-opts">';
    ['M', 'P', 'E', 'R'].forEach(function (k, i) {
      var custom = scale !== DESC;
      h += '<button type="button" class="dg-opt" data-act="a" data-k="' + k + '" aria-pressed="' + (cur === k) + '">' + lv(k) +
        '<span class="dg-ob"><b>' + (custom ? esc(scale[k]) : LAB[k]) + '</b>' + (custom ? '' : '<span class="d">' + DESC[k] + '</span>') + '</span><kbd>' + (i + 1) + '</kbd></button>';
    });
    h += '<button type="button" class="dg-opt q" data-act="a" data-k="U" aria-pressed="' + (cur === 'U') + '"><span class="dg-lv u" aria-hidden="true">?</span><span class="dg-ob"><b>Je ne sais pas</b></span><kbd>0</kbd></button>';
    return h + '</div>' + back();
  }
  function vExit() {
    var c = ctx();
    var h = '<div class="dg-exit"><span class="dg-pill V">Hors périmètre</span><h2 class="dg-res-h" tabindex="-1">Ce diagnostic ne vous concerne pas a priori.</h2><p class="dg-p">' + esc(c.exit) + '</p>';
    if (M.fiches.length) h += '<p class="dg-p">Pour comprendre l’échéance : ' + M.fiches.map(function (f) { return '<a href="' + f.href + '">' + esc(f.t) + '</a>'; }).join(' · ') + '.</p>';
    return h + '<div class="dg-actions"><a class="dg-btn" href="diagnostics.html">Voir les autres diagnostics <span aria-hidden="true">→</span></a><button type="button" class="dg-btn line" data-act="start">Recommencer</button></div></div>';
  }

  function whyText(r) {
    var t = [];
    if (r.why.indexOf('crit') >= 0) t.push('La question critique a reçu la réponse « Rien de formalisé » : le profil ne peut pas dépasser « Fragile », quelles que soient les autres réponses.');
    if (r.why.indexOf('partial') >= 0) t.push('Vision partiellement incomplète : ' + r.s + ' réponses exploitables sur ' + r.n + '.');
    if (r.why.indexOf('min') >= 0) t.push('Seules ' + r.s + ' questions sur ' + r.n + ' ont reçu une réponse exploitable (il en faut au moins ' + r.minS + ').');
    if (r.why.indexOf('idx') >= 0) t.push('Vos réponses se situent majoritairement entre « En cours » et « Rien de formalisé ».');
    if (r.why.indexOf('nR') >= 0) t.push(r.nR + ' réponses « Rien de formalisé » sur ' + r.n + ' questions.');
    if (r.prof === 'M') t.push('Vos réponses sont presque toutes « Maîtrisé » ou « Partiel », sans point bloquant.');
    if (r.why.indexOf('someU') >= 0) t.push(r.nU + (r.nU > 1 ? ' questions restent' : ' question reste') + ' sans réponse : à éclaircir.');
    if (r.prof === 'S') {
      if (r.caps.length) {
        var m = []; if (r.caps.indexOf('R') >= 0) m.push('au moins une réponse « Rien de formalisé »'); if (r.caps.indexOf('E') >= 0) m.push('des réponses « En cours »'); if (r.caps.indexOf('critU') >= 0) m.push('la question critique sans réponse');
        t.push('Le niveau d’ensemble est élevé, mais le profil « Maîtrisé » n’est pas retenu : ' + m.join(', ') + '.');
      } else t.push('Des éléments sont en place ; d’autres restent partiels, en cours ou absents.');
    }
    return t.join(' ');
  }
  function vigil(row, c, full) {
    var q = row.q, h = '<li><div class="dg-vg">' + chip(row.a) + '<div><p class="dg-vq">' + esc(qText(q, c.flags)) + '</p>';
    if (full && q.rev) h += '<p class="dg-vr"><b>Ce qu’une réponse faible peut révéler :</b> ' + esc(q.rev.charAt(0).toLowerCase() + q.rev.slice(1)) + '.</p>';
    if (full && q.reco) h += '<p class="dg-vr"><b>Piste :</b> ' + esc(q.reco) + '</p>';
    return h + '</div></div></li>';
  }
  function vResult() {
    var c = ctx(), mode = st.phase === 'resG' ? 'grille' : 'express', r = score(M, st.ans, c.flags, mode), h = '';
    h += '<div class="dg-res"><div class="dg-print-h">Actalan · Diagnostic ' + esc(M.court) + ' · ' + new Date().toLocaleDateString('fr-FR') + '</div>';
    h += '<div class="dg-step"><span>' + (mode === 'grille' ? 'Résultat de la grille complète · ' + r.n + ' questions' : 'Résultat express · ' + r.n + ' questions') + '</span></div>';
    h += '<div><span class="dg-pill ' + r.prof + '"><i></i>Profil : ' + PROF[r.prof] + '</span></div>';
    h += '<h2 class="dg-res-h" tabindex="-1"><span class="dg-dapres">D’après vos réponses :</span> ' + esc(M.concl[r.prof]) + '</h2>';
    h += '<div class="dg-strip' + (r.prof === 'V' ? ' off' : '') + '" aria-hidden="true">' + ['F', 'S', 'M'].map(function (k) { return '<span class="' + k + (r.prof === k ? ' on' : '') + '">' + PROF[k] + '</span>'; }).join('') + '</div>';
    h += '<p class="dg-p dg-why"><b>Pourquoi ce profil.</b> ' + esc(whyText(r)) + '</p>';
    c.notes.forEach(function (n) { h += '<div class="dg-box info"><p>' + esc(n) + '</p></div>'; });
    var merged = !!(r.crit && r.critAns === 'R' && r.weak.length && r.weak[0].q === r.crit);
    if (r.crit && r.critAns === 'R') {
      h += '<div class="dg-box alert"><h3 class="dg-h3">Alerte critique' + (merged ? ' · point de vigilance prioritaire' : '') + '</h3><p class="dg-vq">' + esc(qText(r.crit, c.flags)) + '</p><p>' + esc(M.critTxt) + '</p>';
      if (merged && r.crit.reco) h += '<p><b>Piste :</b> ' + esc(r.crit.reco) + '</p>';
      h += '</div>';
    }
    else if (r.crit && r.critAns === 'U') h += '<div class="dg-box warn"><h3 class="dg-h3">Question critique sans réponse</h3><p class="dg-vq">' + esc(qText(r.crit, c.flags)) + '</p><p>' + esc(M.critTxt) + ' C’est le premier point à éclaircir.</p></div>';
    r.alerts.forEach(function (al) { h += '<div class="dg-box warn"><h3 class="dg-h3">Alerte complémentaire</h3><p>' + esc(al.t) + '</p></div>'; });
    if (mode === 'grille') {
      h += '<div class="dg-sec"><h3 class="dg-h3">Maturité déclarée par dimension <small>(indice indicatif sur 100)</small></h3><div class="dg-dims">';
      r.dims.forEach(function (d) { if (!d.n) return; h += '<div class="dg-dim"><span>' + esc(d.t) + '</span><b>' + (d.v === null ? '—' : d.v) + '</b><div class="dg-bar"><i style="width:' + (d.v || 0) + '%"></i></div></div>'; });
      h += '</div></div>';
    }
    var nb = mode === 'grille' ? 5 : 3;
    if (r.weak.length) {
      if (!merged) h += '<div class="dg-sec"><h3 class="dg-h3">Point de vigilance prioritaire</h3><ul class="dg-list prio">' + vigil(r.weak[0], c, true) + '</ul></div>';
      if (r.weak.length > 1) h += '<div class="dg-sec"><h3 class="dg-h3">Autres points de vigilance</h3><ul class="dg-list">' + r.weak.slice(1, 1 + nb).map(function (w) { return vigil(w, c, mode === 'express'); }).join('') + '</ul></div>';
    } else if (r.prof === 'M') h += '<div class="dg-box"><p>Aucun point de vigilance ne ressort de vos réponses. Il est possible qu’il n’y ait rien à changer.</p></div>';
    if (r.unknown.length) h += '<div class="dg-sec"><h3 class="dg-h3">Points à éclaircir <small>(réponses « Je ne sais pas »)</small></h3><ul class="dg-list">' + r.unknown.slice(0, 8).map(function (w) { return vigil(w, c, false); }).join('') + '</ul>' + (r.unknown.length > 8 ? '<p class="dg-small">… et ' + (r.unknown.length - 8) + ' autres, visibles dans le détail de vos réponses.</p>' : '') + '</div>';
    if (M.actions && M.actions[r.prof]) h += '<div class="dg-sec"><h3 class="dg-h3">Pistes d’action</h3><ul class="dg-bul">' + M.actions[r.prof].map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="dg-box"><h3 class="dg-h3">Ce que ce diagnostic ne dit pas</h3><p>' + esc(M.limites) + '</p><p class="dg-oblig">Ce résultat repose uniquement sur vos réponses. Il ne constitue ni un audit, ni un avis juridique, ni une attestation de conformité.</p></div>';
    h += '<div class="dg-actions">';
    if (mode === 'express') h += '<button type="button" class="dg-btn" data-act="grille">Approfondir : grille de 30 points <span aria-hidden="true">→</span></button>';
    h += '<a class="dg-btn dark" data-act="mail" href="' + mailto(r, c) + '">Échanger avec un associé</a></div>';
    if (mode === 'express') h += '<p class="dg-small">La grille complète reprend vos 7 réponses et ajoute ' + (flat(M).filter(function (x) { return applicable(x.q, c.flags); }).length - r.n) + ' questions, réparties en six dimensions (environ 10 minutes).</p>';
    h += '<p class="dg-small">« Échanger avec un associé » ouvre votre messagerie avec un résumé de ce résultat, que vous pouvez modifier : rien ne part sans vous.</p>';
    h += '<div class="dg-actions sub"><button type="button" class="dg-btn txt" data-act="print">Imprimer ou enregistrer en PDF</button><button type="button" class="dg-btn txt" data-act="copy">Copier le résultat</button><button type="button" class="dg-btn txt" data-act="restart">Recommencer</button></div>';
    h += '<details class="dg-det"><summary>Le détail de vos réponses</summary>';
    var lastD = -2;
    r.rows.forEach(function (w) {
      if (mode === 'grille' && w.di !== lastD) { if (lastD !== -2) h += '</ul>'; h += '<h4>' + esc(M.dims[w.di].t) + '</h4><ul class="dg-list">'; lastD = w.di; }
      else if (lastD === -2) { h += '<ul class="dg-list">'; lastD = -1; }
      h += vigil(w, c, false);
    });
    h += '</ul></details>';
    if (M.missions.length) h += '<div class="dg-sec"><h3 class="dg-h3">Ce qu’Actalan peut faire ensuite</h3><ul class="dg-tags">' + M.missions.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>';
    if (M.fiches.length) h += '<p class="dg-small">Pour le calendrier et les sources officielles : ' + M.fiches.map(function (f) { return '<a href="' + f.href + '">' + esc(f.t) + '</a>'; }).join(' · ') + '.</p>';
    return h + '</div>';
  }
  function summary(r, c, court) {
    var L = ['Diagnostic Actalan : ' + M.court + ' (' + (r.mode === 'grille' ? 'grille complète' : 'express') + ', ' + r.n + ' questions)', 'Date : ' + new Date().toLocaleDateString('fr-FR'),
      'Profil : ' + PROF[r.prof]];
    if (!court) L.push('D’après mes réponses : ' + M.concl[r.prof], 'Pourquoi : ' + whyText(r));
    if (c.info.length) L.push(c.info.join(' ; '));
    if (r.weak.length) L.push('Point de vigilance prioritaire : ' + qText(r.weak[0].q, c.flags) + ' (' + LAB[r.weak[0].a] + ')');
    L.push('Réponses : ' + r.rows.map(function (w) { return (w.q.code || w.q.id.replace('q', '')) + '=' + (w.a === 'U' ? '?' : w.a); }).join(' ') + (court ? '' : '  (M maîtrisé, P partiel, E en cours, R rien de formalisé, ? je ne sais pas)'));
    if (r.mode === 'grille') L.push('Par dimension : ' + r.dims.filter(function (d) { return d.n; }).map(function (d, i) { return (court ? 'D' + (i + 1) : d.t) + ' ' + (d.v === null ? '—' : d.v); }).join(' ; '));
    if (!court) L.push('Ce résultat repose uniquement sur mes réponses : ni audit, ni avis juridique, ni attestation de conformité.');
    return L.join('\n').replace(/ /g, ' ');
  }
  function mailto(r, c) {
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Diagnostic ' + M.court + ' : demande d’échange') +
      '&body=' + encodeURIComponent('Bonjour,\n\nJe souhaite échanger avec un associé sur ce résultat.\n\n' + summary(r, c, true) + '\n\nMes coordonnées : \n');
  }

  function render(focus) {
    var h;
    if (st.phase === 'intro') h = vIntro();
    else if (st.phase === 'filtre') h = vFilter();
    else if (st.phase === 'exit') h = vExit();
    else if (st.phase === 'express' || st.phase === 'grille') h = vQuestion();
    else h = vResult();
    card.innerHTML = h;
    card.setAttribute('data-phase', st.phase);
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    if (focus) {
      var t = card.querySelector('[tabindex="-1"]'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
      var rc = card.getBoundingClientRect();
      if (rc.top < 0 || rc.top > window.innerHeight * 0.55) window.scrollTo({ top: window.pageYOffset + rc.top - 14, behavior: 'auto' });
    }
    if (st.phase !== 'intro') save();
  }
  function afterFilter() {
    var c = ctx();
    if (c.exit) { st.phase = 'exit'; return; }
    if (st.fc.length >= M.filtre.length) { st.phase = 'express'; st.qi = 0; } else st.phase = 'filtre';
  }
  function goBack() {
    if (st.phase === 'filtre') { if (st.fc.length) st.fc.pop(); else st.phase = 'intro'; }
    else if (st.phase === 'express') { if (st.qi > 0) st.qi--; else { st.fc.pop(); st.phase = M.filtre.length ? 'filtre' : 'intro'; } }
    else if (st.phase === 'grille') { if (st.qi > 0) st.qi--; else st.phase = 'resE'; }
    render(true);
  }
  function answer(k) {
    var Q = queue(), q = Q[st.qi].q; st.ans[q.id] = k;
    var b = card.querySelectorAll('.dg-opt'); Array.prototype.forEach.call(b, function (o) { o.setAttribute('aria-pressed', o.getAttribute('data-k') === k ? 'true' : 'false'); o.disabled = true; });
    save();
    setTimeout(function () {
      if (st.qi + 1 < Q.length) st.qi++; else st.phase = st.phase === 'grille' ? 'resG' : 'resE';
      render(true);
    }, 230);
  }
  card.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null; if (!el || el.disabled) return;
    var act = el.getAttribute('data-act');
    if (act === 'start' || act === 'restart') { wipe(); saved = null; st = fresh(); if (act === 'start') { st.phase = M.filtre.length ? 'filtre' : 'express'; } render(true); }
    else if (act === 'resume') { st = saved; saved = null; render(true); }
    else if (act === 'back') goBack();
    else if (act === 'f') { st.fc.push(parseInt(el.getAttribute('data-k'), 10)); afterFilter(); render(true); }
    else if (act === 'a') answer(el.getAttribute('data-k'));
    else if (act === 'grille') { st.phase = 'grille'; st.qi = 0; var Q = queue(); for (var i = 0; i < Q.length; i++) { if (!(Q[i].q.id in st.ans)) break; } st.qi = Math.min(i, Q.length - 1); render(true); }
    else if (act === 'print') { var d = card.querySelector('.dg-det'); if (d) d.open = true; window.print(); }
    else if (act === 'copy') {
      var c = ctx(), txt = summary(score(M, st.ans, c.flags, st.phase === 'resG' ? 'grille' : 'express'), c);
      var done = function () { el.textContent = 'Résultat copié'; setTimeout(function () { el.textContent = 'Copier le résultat'; }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); }); else { fallbackCopy(txt); done(); }
    }
  });
  function fallbackCopy(t) { var a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) { } document.body.removeChild(a); }
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (st.phase !== 'express' && st.phase !== 'grille') return;
    var tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
    var map = { '1': 'M', '2': 'P', '3': 'E', '4': 'R', '0': 'U' }, k = map[e.key];
    if (k) { var b = card.querySelector('.dg-opt[data-k="' + k + '"]'); if (b && !b.disabled) { e.preventDefault(); answer(k); } }
  });
  window.addEventListener('beforeprint', function () { var d = card.querySelector('.dg-det'); if (d) d.open = true; });

  saved = load();
  render(false);
  var go = document.querySelector('[data-dg-go]');
  if (go) go.addEventListener('click', function (e) {
    e.preventDefault();
    if (st.phase === 'intro') { if (saved) { st = saved; saved = null; } else { st = fresh(); st.phase = M.filtre.length ? 'filtre' : 'express'; } }
    render(false);
    var rc = card.getBoundingClientRect(); window.scrollTo({ top: window.pageYOffset + rc.top - 14, behavior: 'smooth' });
    var t = card.querySelector('[tabindex="-1"]'); if (t) { try { t.focus({ preventScroll: true }); } catch (x) { } }
  });
})();
