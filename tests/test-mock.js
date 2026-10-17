// Tests de bout en bout sur DOM simulé / end-to-end tests on a simulated DOM — node tests/test-mock.js
var load = require('./load');
var A = require('./mock-ai');
var pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; } else { fail++; console.log('ÉCHEC / FAIL: ' + msg); } }
function near(a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); }
function cx(b) { return (b[0] + b[2]) / 2; }
var G = { Justification: A.Justification, ElementPlacement: A.ElementPlacement, Transformation: A.Transformation, TextType: A.TextType,
    TextOrientation: A.TextOrientation, ParagraphDirectionType: A.ParagraphDirectionType };
var ctx = load(Object.assign({}, G)), M = ctx.MRTL;
function J(t) { return String(t.paragraphs[0].paragraphAttributes.justification).replace(/^.*\./, ''); }
function rect(l, t, r, b) { return new A.PathItem([[l, t], [r, t], [r, b], [l, b]]); }
function arrowAt(x, y, s) { return new A.PathItem([[0, 40], [60, 40], [60, 15], [100, 50], [60, 85], [60, 60], [0, 60]].map(function (p) { return [x + p[0] * s, y + p[1] * s]; })); }
function upArrowAt(x, y, s) { return new A.PathItem([[40, 0], [40, 60], [15, 60], [50, 100], [85, 60], [60, 60], [60, 0]].map(function (p) { return [x + p[0] * s, y + p[1] * s]; })); }
function opts(extra) { var o = M.defaults(); o.review = false; for (var k in extra || {}) { o[k] = extra[k]; } return o; }
function UI(rev) { var u = { alerts: [], reviews: 0 }; u.alert = function (s) { u.alerts.push(s); }; u.review = function (jobs) { u.reviews++; return rev ? rev(jobs) : true; }; return u; }
function snapshot(doc) {
    var out = [];
    function walk(items) { items.forEach(function (it) { out.push(it.typename + ':' + JSON.stringify(it.geometricBounds.map(function (v) { return +v.toFixed(6); })) + ':' + (it.typename === 'TextFrame' ? J(it) + (+it.angle.toFixed(6)) : '') + ':' + (it.pts ? JSON.stringify(it.pts.map(function (p) { return [+p[0].toFixed(6), +p[1].toFixed(6)]; })) : '')); if (it.items) { walk(it.items); } }); }
    doc.layers.forEach(function (L) { walk(L.items); });
    return out.join('|') + '#' + doc.artboards.length;
}

// ---------------------------------------------------------------- affiche / poster
function poster() {
    var logo = new A.GroupItem([rect(20, 780, 60, 740), new A.PathItem([[65, 775], [75, 785], [85, 775], [75, 765]])]); logo.name = 'Monogramme';
    var title = new A.TextFrame({ anchor: [40, 700], w: 200, h: 30, contents: 'Titre' });
    var area = new A.TextFrame({ kind: A.TextType.AREATEXT, box: [40, 650, 340, 550], paras: [new A.Para(A.Justification.LEFT, 10, 0), new A.Para(A.Justification.CENTER, 0, 0), new A.Para(A.Justification.FULLJUSTIFYLASTLINELEFT, 0, 4)] });
    var bullet = rect(40, 500, 50, 490), btext = new A.TextFrame({ anchor: [60, 490], w: 150, h: 12, contents: 'Livraison' });
    var puce = new A.GroupItem([bullet, btext]); puce.name = 'puce';
    var arrow = arrowAt(500, 100, 0.4);
    var up = upArrowAt(430, 100, 0.4);
    var photo = A.PlacedItem([300, 450, 560, 250]); photo.name = 'photo produit';
    var l1 = rect(400, 780, 430, 750), l2 = rect(431, 780, 460, 750), l3 = rect(461, 780, 490, 760);
    var lock = new A.GroupItem([rect(300, 735, 340, 700), new A.TextFrame({ anchor: [345, 710], w: 40, h: 10, contents: 'Marque' })]); lock.name = 'Logo lockup';
    var deco = rect(10, 30, 30, 10); deco.name = 'déco #reste';
    var locked = rect(100, 60, 120, 40); locked.locked = true;
    var tilted = new A.TextFrame({ anchor: [100, 300], w: 120, h: 14, angle: 20, contents: 'Promo' });
    var sym = A.SymbolItem([520, 60, 560, 40], 'fleche-suivant');
    var bg = rect(0, 800, 600, 0); bg.name = 'Fond';
    var other = rect(800, 500, 900, 400);
    var Lfond = new A.Layer('Fond', [bg]);
    var Lc = new A.Layer('Contenu', [logo, title, area, puce, arrow, up, photo, l1, l2, l3, lock, deco, locked, tilted, sym, other]);
    var Lh = new A.Layer('Notes', [rect(200, 200, 220, 180)]); Lh.visible = false;
    var Ll = new A.Layer('Verrou', [rect(250, 200, 270, 180)]); Ll.locked = true;
    var doc = new A.Document([Lc, Lfond, Lh, Ll], [[[0, 800, 600, 0], 'Affiche'], [[700, 800, 1300, 0], 'Verso']]);
    return { doc: doc, logo: logo, title: title, area: area, bullet: bullet, btext: btext, puce: puce, arrow: arrow, up: up, photo: photo, l1: l1, l2: l2, l3: l3,
        lock: lock, deco: deco, locked: locked, tilted: tilted, sym: sym, bg: bg, other: other, Lc: Lc, Lfond: Lfond, Lh: Lh, Ll: Ll };
}
function dupOf(P, orig) { var L = orig.parent, i = L.items.indexOf(orig); return L.items[i - 1]; }

// --- A. copie sur nouveau plan de travail / copy on a new artboard ---
var P = poster(), before = snapshot(P.doc), origPts = {};
['logo', 'title', 'area', 'puce', 'arrow', 'up', 'photo', 'l1', 'l2', 'l3', 'lock', 'deco', 'locked', 'tilted', 'sym', 'bg', 'other'].forEach(function (k) { origPts[k] = P[k].geometricBounds; });
var ui = UI(), st = M.run(P.doc, opts(), ui);
ok(st && P.doc.artboards.length === 3, 'one artboard added');
var off = 1372, nab = P.doc.artboards[2];
ok(JSON.stringify(nab.artboardRect) === JSON.stringify([1372, 800, 1972, 0]) && nab.name === 'Affiche RTL', 'new artboard right of all artboards, named');
ok(P.Lc.items.length === 31 && P.Lfond.items.length === 2 && P.Lh.items.length === 1 && P.Ll.items.length === 1, 'duplicates only on usable layers, other artboard untouched (' + P.Lc.items.length + ')');
var origSnap = []; ['logo', 'title', 'arrow', 'photo', 'tilted', 'other'].forEach(function (k) { origSnap.push(JSON.stringify(P[k].geometricBounds) === JSON.stringify(origPts[k])); });
ok(origSnap.every(Boolean) && J(P.title) === 'LEFT' && P.tilted.angle === 20, 'originals untouched');
function mirroredCenter(k) { return 600 - cx(origPts[k]) + off; }
var D = {}; ['logo', 'title', 'area', 'puce', 'arrow', 'up', 'photo', 'l1', 'l2', 'l3', 'lock', 'deco', 'locked', 'tilted', 'sym', 'bg'].forEach(function (k) { D[k] = dupOf(P, P[k]); });
ok(near(cx(D.logo.geometricBounds), mirroredCenter('logo')), 'logo at mirrored place');
ok(near(D.logo.items[1].pts[0][0] - D.logo.items[0].pts[0][0], P.logo.items[1].pts[0][0] - P.logo.items[0].pts[0][0]), 'logo not flipped inside (rigid)');
ok(J(D.title) === 'RIGHT' && near(cx(D.title.geometricBounds), mirroredCenter('title')), 'title right-aligned at mirrored place');
ok(J(D.title) === 'RIGHT' && near(D.title.anchor[0], 600 - 40 + off), 'point text anchor now on the right edge');
var ap = D.area.paragraphs.map(function (p) { return p.paragraphAttributes; });
ok(String(ap[0].justification) === 'Justification.RIGHT' && ap[0].leftIndent === 0 && ap[0].rightIndent === 10, 'area para 1: right + indents swapped');
ok(String(ap[1].justification) === 'Justification.CENTER' && String(ap[2].justification) === 'Justification.FULLJUSTIFYLASTLINERIGHT' && ap[2].leftIndent === 4, 'area para 2/3');
ok(near(cx(D.area.geometricBounds), mirroredCenter('area')), 'area frame mirrored');
var db = D.puce.items[0], dt = D.puce.items[1];
ok(cx(db.geometricBounds) > cx(dt.geometricBounds) && near(cx(db.geometricBounds), 600 - cx(P.bullet.geometricBounds) + off) && J(dt) === 'RIGHT', 'bullet moves to the right of its text');
var refl = P.arrow.pts.map(function (p) { return [600 - p[0] + off, p[1]]; });
ok(D.arrow.pts.every(function (p, i) { return near(p[0], refl[i][0]) && near(p[1], refl[i][1]); }), 'arrow flipped (exact reflection about the axis)');
var dxUp = mirroredCenter('up') - cx(origPts.up);
ok(D.up.pts.every(function (p, i) { return near(p[0], P.up.pts[i][0] + dxUp) && near(p[1], P.up.pts[i][1]); }), 'up arrow moved, not flipped');
ok(near(cx(D.photo.geometricBounds), mirroredCenter('photo')) && D.photo.flips === 0, 'photo moved, never flipped');
var lettersBox = A.bounds(P.l1.pts.concat(P.l2.pts, P.l3.pts)), dl = 600 - cx(lettersBox) + off - cx(lettersBox);
ok([['l1', P.l1], ['l2', P.l2], ['l3', P.l3]].every(function (e) { return near(D[e[0]].pts[0][0], e[1].pts[0][0] + dl); }), 'touching loose letters moved together (order kept)');
ok(near(D.lock.items[1].anchor[0] - D.lock.items[0].pts[0][0], P.lock.items[1].anchor[0] - P.lock.items[0].pts[0][0]) && J(D.lock.items[1]) === 'LEFT', 'logo lockup with live text kept rigid (keyword)');
ok(near(D.deco.pts[0][0], P.deco.pts[0][0] + off), '#reste stays at the same place on the artboard');
ok(near(cx(D.locked.geometricBounds), mirroredCenter('locked')) && D.locked.locked === true, 'locked object copied, mirrored and relocked');
ok(near(D.tilted.angle, -20, 1e-6) && near(cx(D.tilted.geometricBounds), mirroredCenter('tilted')), 'tilted text: −θ and mirrored place');
ok(D.sym.flips === 1 && near(cx(D.sym.geometricBounds), mirroredCenter('sym')), 'symbol flipped by name');
ok(near(cx(D.bg.geometricBounds), 300 + off), 'background mirrored (unchanged shape)');
ok(ui.alerts.length === 1 && /Pictos retournés : 2/.test(ui.alerts[0]) && /Calques masqués\/verrouillés ignorés : Notes, Verrou/.test(ui.alerts[0]), 'report: ' + (ui.alerts[0] || '').split('\n').slice(2, 5).join(' / '));
ok(st.errors === 0, 'no errors: ' + st.errList);

// --- B. sur place, deux fois = identité / in place twice = identity ---
P = poster(); before = snapshot(P.doc);
st = M.run(P.doc, opts({ mode: 'place' }), UI());
ok(st && P.doc.artboards.length === 2 && P.Lc.items.length === 16, 'in place: no artboard, no duplicate');
ok(st.flipped === 2 && J(P.title) === 'RIGHT' && near(P.tilted.angle, -20), 'in place applied');
ok(snapshot(P.doc) !== before, 'document changed');
var locked0 = P.locked.geometricBounds;
ok(JSON.stringify(locked0) === JSON.stringify([100, 60, 120, 40]), 'in place: locked object skipped');
st = M.run(P.doc, opts({ mode: 'place' }), UI());
ok(snapshot(P.doc) === before, 'mirror twice in place = original (positions, alignment, angles, arrow points)');

// --- C. tous les plans de travail, table de montage pleine à droite → dessous ---
P = poster(); A.CANVAS.limit = 1500;
var t2 = new A.TextFrame({ anchor: [720, 600], w: 100, h: 20, contents: 'Verso' }); P.Lc.items.push(t2); t2.parent = P.Lc;
st = M.run(P.doc, opts({ scope: 'all' }), UI());
ok(st && P.doc.artboards.length === 4, 'two artboards added');
ok(JSON.stringify(P.doc.artboards[2].artboardRect) === JSON.stringify([0, -72, 600, -872]) && JSON.stringify(P.doc.artboards[3].artboardRect) === JSON.stringify([700, -72, 1300, -872]), 'fallback below, same layout');
var dt2 = dupOf(P, t2);
ok(J(dt2) === 'RIGHT' && near(cx(dt2.geometricBounds), 2 * 1000 - cx(t2.geometricBounds)) && near(dt2.anchor[1], 600 - 872), 'second artboard mirrored about its own axis');
var dother = dupOf(P, P.other);
ok(near(cx(dother.geometricBounds), 2000 - 850) && near(dother.geometricBounds[1], 500 - 872), 'other object mirrored on its artboard');
A.CANVAS.limit = 300; P = poster();
var u2 = UI(); st = M.run(P.doc, opts(), u2);
ok(st === null && P.doc.artboards.length === 2 && P.Lc.items.length === 16 && /Impossible de créer/.test(u2.alerts[0]), 'no room on canvas: clear message, nothing changed');
A.CANVAS.limit = 8000;

// --- D. sélection, copie à côté / selection, copy beside ---
var bgB = rect(100, 300, 300, 260), lab = new A.TextFrame({ anchor: [110, 270], w: 120, h: 14, contents: 'Suivant' }), arr = arrowAt(260, 268, 0.3);
var btn = new A.GroupItem([bgB, lab, arr]); btn.name = 'bouton';
var Lb = new A.Layer('UI', [btn]); var docB = new A.Document([Lb], [[[0, 800, 600, 0], 'Écran']]); docB.selection = [btn];
st = M.run(docB, opts({ scope: 'selection' }), UI());
var dbtn = Lb.items[0];
ok(Lb.items.length === 2 && dbtn !== btn, 'selection duplicated');
var sel0 = btn.geometricBounds, offS = (sel0[2] - sel0[0]) + 72, axS = cx(sel0);
ok(near(cx(dbtn.items[0].geometricBounds), cx(sel0) + offS), 'button background stays centred in the copy');
ok(cx(dbtn.items[2].geometricBounds) < cx(dbtn.items[1].geometricBounds) && J(dbtn.items[1]) === 'RIGHT', 'arrow now left of the label, label right-aligned');
ok(near(dbtn.items[2].pts[3][0], 2 * axS - arr.pts[3][0] + offS), 'arrow tip points left');
ok(near(btn.items[2].pts[3][0], arr.pts[3][0]) && J(btn.items[1]) === 'LEFT', 'original button untouched');
// sur place, axe = plan de travail / in place, artboard axis
docB.selection = [dbtn]; Lb.items.splice(0, 1); docB.selection = [btn];
var bx0 = cx(btn.geometricBounds);
st = M.run(docB, opts({ scope: 'selection', mode: 'place', selAxis: 'artboard' }), UI());
ok(near(cx(btn.geometricBounds), 600 - bx0), 'selection mirrored about the artboard centre');
st = M.run(docB, opts({ scope: 'selection', mode: 'place', selAxis: 'selection' }), UI());
ok(near(cx(btn.geometricBounds), 600 - bx0), 'selection mirrored about its own centre: stays in place');

// --- E. messages ---
var docE = new A.Document([new A.Layer('Vide', [])], [[[0, 800, 600, 0], 'X']]);
var uE = UI(); ok(M.run(docE, opts(), uE) === null && /Aucun objet modifiable/.test(uE.alerts[0]), 'empty artboard message');
uE = UI(); ok(M.run(docE, opts({ scope: 'selection' }), uE) === null && /Rien n'est sélectionné/.test(uE.alerts[0]), 'no selection message');
var alerts = [];
var ctxNoDoc = load(Object.assign({}, G, { app: { locale: 'fr_FR', documents: { length: 0 } }, alert: function (s) { alerts.push(s); } }));
ctxNoDoc.MRTL.main();
ok(alerts.length === 1 && /Aucun document ouvert/.test(alerts[0]), 'no document message (main)');
var ctxEn = load(Object.assign({}, G, { app: { locale: 'en_US', documents: { length: 0 } }, alert: function (s) { alerts.push(s); } }));
ctxEn.MRTL.main();
ok(/No open document/.test(alerts[1]), 'English message');

// --- F. convention de signe de matrice inverse / opposite matrix sign convention ---
A.MATRIX_SIGN.v = -1; P = poster();
st = M.run(P.doc, opts({ mode: 'place' }), UI());
ok(near(P.tilted.angle, -20, 1e-6), 'tilt reversed even with the opposite matrix sign (self-check)');
A.MATRIX_SIGN.v = 1;

// --- G. textes chaînés / threaded frames ---
var f1 = new A.TextFrame({ kind: A.TextType.AREATEXT, box: [20, 700, 200, 600], paras: [new A.Para(A.Justification.LEFT)] });
var f2 = new A.TextFrame({ kind: A.TextType.AREATEXT, box: [220, 700, 400, 600], paras: [new A.Para(A.Justification.LEFT)] });
f1.nextFrame = f2; f2.previousFrame = f1;
var docG = new A.Document([new A.Layer('T', [f1, f2])], [[[0, 800, 600, 0], 'X']]);
st = M.run(docG, opts({ mode: 'place' }), UI());
ok(J(f1) === 'RIGHT' && J(f2) === 'RIGHT' && st.threaded === 1 && st.aligned === 2, 'threaded story swapped once');
ok(near(f1.areaBox[0], 400) && near(f2.areaBox[0], 200), 'threaded frames swap places');

// --- H. groupe masqué avec texte / clip group with text ---
var clipP = rect(0, 800, 600, 0); clipP.clipping = true;
var inner = new A.TextFrame({ anchor: [50, 400], w: 100, h: 20 }), big = rect(-200, 900, 100, 100);
var clipG = new A.GroupItem([clipP, inner, big], true);
var docH = new A.Document([new A.Layer('C', [clipG])], [[[0, 800, 600, 0], 'X']]);
st = M.run(docH, opts({ mode: 'place' }), UI());
ok(near(cx(clipP.geometricBounds), 300) && J(inner) === 'RIGHT' && near(inner.anchor[0], 550), 'clip group opened: mask stays, text mirrored');
ok(near(cx(big.geometricBounds), 600 - (-50)), 'masked artwork mirrored');

// --- I. annulation à la vérification / cancel at review ---
P = poster(); before = snapshot(P.doc);
var uI = UI(function () { return false; });
st = M.run(P.doc, opts({ review: true }), uI);
ok(st === null && uI.reviews === 1 && snapshot(P.doc) === before, 'cancel at review: nothing changed');
// décocher un picto / untick an icon
P = poster();
st = M.run(P.doc, opts({ review: true, mode: 'place' }), UI(function (jobs) { jobs[0].plan.units.forEach(function (u) { if (u.flip && u.reason === 'shape') { u.flip = false; } }); return true; }));
ok(st.flipped === 1 && P.sym.flips === 1, 'unticked arrow is moved, not flipped');

// Limite connue : un logo NON nommé symétrique haut/bas (carré + losange alignés) est proposé
// comme picto directionnel ; la liste de vérification permet de le décocher.
// Known limitation: an unnamed top/bottom-symmetric logo is proposed as directional.
var lg = new A.GroupItem([rect(20, 780, 60, 740), new A.PathItem([[65, 760], [75, 770], [85, 760], [75, 750]])]);
var docLg = new A.Document([new A.Layer('L', [lg])], [[[0, 800, 600, 0], 'X']]), proposed = 0;
M.run(docLg, opts({ review: true, mode: 'place' }), UI(function (jobs) { jobs[0].plan.units.forEach(function (u) { if (u.flip) { proposed++; u.flip = false; } }); return true; }));
ok(proposed === 1 && near(lg.items[1].pts[0][0] - lg.items[0].pts[0][0], 45), 'symmetric unnamed logo proposed, unticked → moved unflipped');

// --- J. options / options ---
P = poster(); st = M.run(P.doc, opts({ mode: 'place', swapAlign: false, unrotate: false, flipDirectional: false }), UI());
ok(J(P.title) === 'LEFT' && P.tilted.angle === 20 && st.flipped === 0 && P.sym.flips === 0, 'options off: alignment/tilt/flip untouched');
P = poster(); st = M.run(P.doc, opts({ mode: 'place', rtlDir: true }), UI());
ok(P.area.paragraphs[0].paragraphAttributes.paragraphDirection === 'RTL' && st.rtl >= 3, 'RTL paragraph direction option');
P = poster(); st = M.run(P.doc, opts({ mode: 'place', openGroups: false }), UI());
ok(cx(P.bullet.geometricBounds) < cx(P.btext.geometricBounds), 'openGroups off: group moved as a block');

// --- K. chevauchement créé signalé / created overlap reported ---
var a1 = rect(100, 400, 110, 300), a2 = rect(110, 310, 250, 300), bOv = rect(235, 400, 245, 340);
var docK = new A.Document([new A.Layer('K', [a1, a2, bOv])], [[[0, 800, 600, 0], 'X']]);
var uK = UI(); st = M.run(docK, opts({ mode: 'place', tolerance: 0 }), uK);
ok(st.overlaps === 1 && /Chevauchements créés par le miroir, à vérifier : 1/.test(uK.alerts[0]), 'L-shaped block: created overlap reported');

// --- L. documents aléatoires : deux miroirs sur place = identité (sans chevauchement créé) ---
var seed = 99; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
var randFail = 0, randRuns = 0, randSkipped = 0;
for (var t = 0; t < 120; t++) {
    var items = [], n = 3 + Math.floor(rnd() * 15), k;
    for (k = 0; k < n; k++) {
        var x = rnd() * 520, y = rnd() * 720, w = 5 + rnd() * 70, h = 5 + rnd() * 70, r = rnd();
        if (r < 0.35) { items.push(rect(x, y + h, x + w, y)); }
        else if (r < 0.55) { items.push(new A.TextFrame({ anchor: [x, y], w: w, h: 12, angle: rnd() < 0.2 ? Math.round(rnd() * 60 - 30) : 0, paras: [new A.Para([A.Justification.LEFT, A.Justification.RIGHT, A.Justification.CENTER][Math.floor(rnd() * 3)])] })); }
        else if (r < 0.7) { items.push(arrowAt(x, y, 0.2 + rnd() * 0.3)); }
        else if (r < 0.85) { items.push(new A.GroupItem([rect(x, y + 10, x + 8, y), new A.TextFrame({ anchor: [x + 12, y], w: w, h: 10 })])); }
        else { items.push(A.PlacedItem([x, y + h, x + w, y])); }
    }
    var docR = new A.Document([new A.Layer('R', items)], [[[0, 800, 600, 0], 'R']]);
    var b0 = snapshot(docR), uR = UI();
    var s1 = M.run(docR, opts({ mode: 'place' }), uR);
    if (s1.overlaps) { randSkipped++; continue; }
    M.run(docR, opts({ mode: 'place' }), UI());
    randRuns++;
    if (snapshot(docR) !== b0 || s1.errors) { randFail++; }
}
ok(randFail === 0, 'random documents: mirror twice = identity (' + randRuns + ' docs, ' + randFail + ' failures; ' + randSkipped + ' with a reported overlap skipped)');
console.log('  documents aléatoires / random documents: ' + randRuns + ' vérifiés, ' + randSkipped + ' avec chevauchement signalé');


// --- M. dialogues ScriptUI simulés (le code d'interface s'exécute sans erreur) ---
// Simulated ScriptUI: the UI code runs end to end (main → réglages → vérification → rapport).
function FakeCtl(type, text, items) {
    this.type = type; this.text = text; this.children = []; this.value = false; this.enabled = true; this.items = [];
    var self = this; (items || []).forEach(function (t, i) { self.items.push({ text: t, index: i, selected: false }); });
}
FakeCtl.prototype.add = function (type, bounds, text, props) {
    var c;
    if (this.type === 'listbox' && type === 'item') { c = { text: bounds, index: this.items.length, selected: false }; this.items.push(c); return c; }
    c = new FakeCtl(type, typeof text === 'string' ? text : '', Array.isArray(text) ? text : null);
    if (type === 'dropdownlist') {
        Object.defineProperty(c, 'selection', { get: function () { return this._sel; }, set: function (v) { this._sel = typeof v === 'number' ? this.items[v] : v; } });
    }
    this.children.push(c); FakeCtl.all.push(c); return c;
};
FakeCtl.all = [];
var shown = [], onShow = null;
function Window(type, title) { FakeCtl.call(this, 'window', title); this.title = title; }
Window.prototype = Object.create(FakeCtl.prototype);
Window.prototype.show = function () { shown.push(this.title); if (onShow) { return onShow(this); } return 1; };
function findAll(w, type) { var out = []; (function walk(c) { c.children.forEach(function (k) { if (k.type === type) { out.push(k); } walk(k); }); })(w); return out; }
P = poster(); var mAlerts = [];
var ctxUI = load(Object.assign({}, G, { Window: Window, alert: function (s) { mAlerts.push(s); }, app: { locale: 'fr_FR', documents: { length: 1 }, activeDocument: P.doc } }));
onShow = function (w) {
    if (/vérification/.test(w.title)) {
        var lb = findAll(w, 'listbox')[0], btns = findAll(w, 'button');
        w.rows = lb.items.map(function (i) { return i.text; });
        lb.items[0].selected = true; btns[1].onClick();      // « Ne pas retourner » sur la 1re ligne
        w.after = lb.items.map(function (i) { return i.text; });
        shownReview = w;
    }
    return 1;
};
var shownReview = null;
ctxUI.MRTL.main();
ok(shown.length === 2 && /Miroir RTL — version droite à gauche/.test(shown[0]) && /vérification/.test(shown[1]), 'main shows settings then review: ' + shown.join(' / '));
ok(shownReview && shownReview.rows.length === 2 && /^☑/.test(shownReview.rows[0]) && /^☐/.test(shownReview.after[0]), 'review list: 2 icons, first unticked by the button');
ok(mAlerts.length === 1 && /Pictos retournés : 1/.test(mAlerts[0]) && P.doc.artboards.length === 3, 'run after review: 1 icon flipped, copy artboard created');
// Annuler dans les réglages / cancel in settings
P = poster(); shown = []; onShow = function () { return 2; };
ctxUI = load(Object.assign({}, G, { Window: Window, alert: function (s) { mAlerts.push(s); }, app: { locale: 'fr_FR', documents: { length: 1 }, activeDocument: P.doc } }));
before = snapshot(P.doc); ctxUI.MRTL.main();
ok(shown.length === 1 && snapshot(P.doc) === before, 'cancel in settings: nothing changed');
// Portée sélection sans sélection / selection scope without selection
P = poster(); shown = []; mAlerts = [];
onShow = function (w) { var dd = findAll(w, 'dropdownlist')[0]; dd.selection = 2; return 1; };
ctxUI = load(Object.assign({}, G, { Window: Window, alert: function (s) { mAlerts.push(s); }, app: { locale: 'fr_FR', documents: { length: 1 }, activeDocument: P.doc } }));
ctxUI.MRTL.main();
ok(mAlerts.length === 1 && /Rien n'est sélectionné/.test(mAlerts[0]) && P.doc.artboards.length === 2, 'selection scope with nothing selected: message');

console.log('test-mock : ' + pass + ' réussis / passed, ' + fail + ' échecs / failed');
process.exit(fail ? 1 : 0);
