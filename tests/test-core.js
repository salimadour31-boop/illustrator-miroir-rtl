// Tests du moteur pur / pure engine tests — node tests/test-core.js
var load = require('./load');
var M = load().MRTL;
var pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; } else { fail++; console.log('ÉCHEC / FAIL: ' + msg); } }
function near(a, b, e) { return Math.abs(a - b) <= (e || 1e-6); }
// Générateur pseudo-aléatoire reproductible / reproducible PRNG
var seed = 12345; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

// --- boîtes / boxes ---
ok(JSON.stringify(M.normBox([10, 0, 0, 20])) === '[0,20,10,0]', 'normBox');
ok(M.mirrorDx([10, 50, 30, 0], 100) === 160, 'mirrorDx');
ok(M.boxGap([0, 10, 10, 0], [12, 10, 20, 0]) === 2 && M.boxGap([0, 10, 10, 0], [5, 5, 20, 0]) === 0, 'boxGap');
ok(M.containsBox([0, 100, 100, 0], [10, 90, 90, 10], 0.01) && !M.containsBox([10, 90, 90, 10], [0, 100, 100, 0], 0.01), 'containsBox');

// --- balises & mots-clés / tags & keywords ---
ok(M.parseTag('Logo #fixe') === 'fixe' && M.parseTag('x #KEEP') === 'fixe' && M.parseTag('#Miroir') === 'flip' && M.parseTag('fond #reste') === 'stay', 'parseTag');
ok(M.parseTag('#fixed') === 'fixe' && M.parseTag('prix #12') === '' && M.parseTag('Titre') === '', 'parseTag neutral');
ok(M.parseTag('#flipper') === '', 'parseTag needs word end');
var kw = M.parseKeywords(M.DEFAULT_DIR_KEYWORDS);
ok(M.keywordHit('Flèche droite', kw) === 'fleche', 'fleche accent');
ok(M.keywordHit('chevronRight', kw) === 'chevron', 'camelCase');
ok(M.keywordHit('icon-arrows', kw) === 'arrow', 'plural');
ok(M.keywordHit('background', kw) === '', 'back≠background');
ok(M.keywordHit('Back', kw) === 'back' && M.keywordHit('btn_back', kw) === 'back' && M.keywordHit('backs', kw) === 'back', 'back word');
ok(M.keywordHit('feedback', kw) === '' && M.keywordHit('nextgen', kw) === '' && M.keywordHit('carets', kw) === 'caret', 'word boundaries');
ok(M.keywordHit('سهم يمين', kw) === 'سهم' && M.keywordHit('→ suite', kw) === '→', 'arabic & symbol');
ok(M.keywordHit('', kw) === '' && M.keywordHit('Titre', kw) === '', 'no hit');
var fk = M.parseKeywords(M.DEFAULT_FIX_KEYWORDS);
ok(M.keywordHit('Logo client', fk) === 'logo' && M.keywordHit('QR code', fk) === 'qr' && M.keywordHit('Code-barre EAN', fk) !== '', 'fix keywords');
ok(M.keywordHit('logotype', fk) === '' || true, 'logotype ok either way');

// --- justification / matrices ---
ok(M.swapJustName('Justification.LEFT') === 'RIGHT' && M.swapJustName('Justification.RIGHT') === 'LEFT', 'swap L/R');
ok(M.swapJustName('Justification.FULLJUSTIFYLASTLINELEFT') === 'FULLJUSTIFYLASTLINERIGHT', 'swap full');
ok(M.swapJustName('Justification.CENTER') === null && M.swapJustName('Justification.FULLJUSTIFY') === null, 'center unchanged');
var r = M.rotationOf(Math.cos(0.3), Math.sin(0.3), -Math.sin(0.3), Math.cos(0.3));
ok(near(r.angle, 0.3 * 180 / Math.PI) && !r.mirrored && !r.skewed, 'rotationOf');
ok(M.rotationOf(-1, 0, 0, 1).mirrored && M.rotationOf(1, 0, 0.5, 1).skewed, 'mirror/skew');
ok(M.normAngle(350) === -10 && M.normAngle(-190) === 170, 'normAngle');

// --- formes / shapes ---
function rotP(pts, deg) { var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(function (p) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }); }
function closed(pts) { return pts.concat([pts[0]]); }
var arrow = [[0, 40], [60, 40], [60, 15], [100, 50], [60, 85], [60, 60], [0, 60]];
function circle(n, rx, ry) { var a = [], i; for (i = 0; i < n; i++) { a.push([rx * Math.cos(2 * Math.PI * i / n), (ry || rx) * Math.sin(2 * Math.PI * i / n)]); } return a; }
function star(n, ro, ri) { var a = [], i, ang, rr; for (i = 0; i < 2 * n; i++) { ang = Math.PI / 2 + Math.PI * i / n; rr = i % 2 ? ri : ro; a.push([rr * Math.cos(ang), rr * Math.sin(ang)]); } return a; }
var lazyDisagree = 0, lazyTotal = 0;
function D(polys) { var full = M.isDirectional(M.symmetryScores(polys)); lazyTotal++; if (full !== M.shapeIsDirectional(polys)) { lazyDisagree++; } return full; }
ok(D([closed(arrow)]), 'arrow → directional');
ok(D([closed(arrow.map(function (p) { return [-p[0], p[1]]; }))]), 'arrow ← directional');
ok(D([[[0, 0], [30, 30], [0, 60]]]), 'open chevron › directional');
ok(D([closed([[0, 0], [52, 30], [0, 60]])]), 'triangle ▶ directional');
ok(D([closed(rotP(arrow, 45))]) && D([closed(rotP(arrow, 135))]) && D([closed(rotP(arrow, -45))]) && D([closed(rotP(arrow, 180))]), 'diagonal & reversed arrows');
ok(!D([closed(rotP(arrow, 90))]) && !D([closed(rotP(arrow, 270))]), 'up/down arrows not flipped');
ok(!D([closed(circle(64, 50))]) && !D([closed(circle(64, 80, 30))]), 'circle/ellipse');
ok(!D([closed([[0, 0], [100, 0], [100, 100], [0, 100]])]) && !D([closed([[0, 0], [200, 0], [200, 40], [0, 40]])]), 'square/rect');
ok(!D([closed(star(5, 50, 20))]), 'star');
ok(!D([closed([[0, 0], [80, 0], [80, 60], [40, 100], [0, 60]])]), 'house');
ok(!D([[[0, 0], [100, 0]]]) && !D([[[0, 0], [0, 100]]]), 'plain lines');
var heart = []; (function () { var t; for (t = 0; t < 64; t++) { var a = 2 * Math.PI * t / 64; heart.push([16 * Math.pow(Math.sin(a), 3), 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)]); } })();
ok(!D([closed(heart)]), 'heart');
ok(!D([closed([[0, 0], [20, 0], [20, 40], [60, 40], [60, 60], [20, 60], [20, 80], [70, 80], [70, 100], [0, 100]])]), 'letter F (asymmetric both ways)');
// flèche en deux tracés (tige + pointe) / two-path arrow (shaft + head)
ok(D([closed([[0, 45], [70, 45], [70, 55], [0, 55]]), closed([[65, 25], [100, 50], [65, 75]])]), 'two-path arrow');
// bouton rond avec flèche / round button with arrow
ok(D([closed(circle(64, 60)), closed(arrow.map(function (p) { return [p[0] - 50, p[1] - 50]; }))]), 'circle + arrow button');
// Bézier aplatie : demi-cercle ) / flattened Bézier half circle
var fp = M.flattenPath([[0, 100], [0, 0]], [[0, 100], [55, 0]], [[55, 100], [0, 0]], false, 12);
ok(fp.length === 13 && near(fp[12][0], 0) && near(fp[12][1], 0), 'flattenPath');
ok(D([fp]), 'parenthesis ) is directional');
// rééchantillonnage / resampling
var rs = M.resampleParts([[[0, 0], [100, 0]], [[0, 10], [0, 110]]], 20);
ok(rs.length === 2 && rs[0].length === 12 && rs[1].length === 12, 'resampleParts count (open paths keep their ends)');
ok(rs[0][0][0] === 0 && rs[0][11][0] === 100 && Math.abs(rs[0][2][0] - rs[0][1][0] - 10) < 1e-9, 'resampleParts spacing');
var rc = M.resampleParts([closed([[0, 0], [10, 0], [10, 10], [0, 10]])], 8);
ok(rc.length === 1 && rc[0].closed && rc[0].length === 8, 'resampleParts closed');
ok(M.symmetryScores([[[0, 0], [0, 0]]]) === null && M.shapeIsDirectional([[[0, 0], [0, 0]]]) === false, 'degenerate shape');
// Invariance d'échelle et de point de départ / scale and start-point invariance
var big = closed(arrow.map(function (p) { return [p[0] * 7 + 300, p[1] * 7 - 90]; }));
ok(D([big]) && D([closed(arrow.slice(3).concat(arrow.slice(0, 3)))]), 'scale/start invariance');
// Formes aléatoires : taux de faux positifs / random shapes: false-positive rate
var fpCount = 0, NR = 600, i, k, pts, n;
for (i = 0; i < NR; i++) {
    n = 5 + Math.floor(rnd() * 14); pts = [];
    for (k = 0; k < n; k++) { var ang = 2 * Math.PI * (k + rnd() * 0.8) / n, rr = 20 + rnd() * 80; pts.push([rr * Math.cos(ang), rr * Math.sin(ang)]); }
    if (D([closed(pts)])) { fpCount++; }
}
ok(fpCount / NR < 0.02, 'random polygons false positives < 2 % (got ' + fpCount + '/' + NR + ')');
console.log('  faux positifs formes aléatoires / random false positives: ' + fpCount + '/' + NR);
// Flèches aléatoires (proportions variées) / random arrows
var miss = 0;
for (i = 0; i < 300; i++) {
    var L = 40 + rnd() * 160, hw = 4 + rnd() * 20, hh = hw + 5 + rnd() * 30, hl = 15 + rnd() * 40;
    var a = [[0, -hw], [L - hl, -hw], [L - hl, -hh], [L, 0], [L - hl, hh], [L - hl, hw], [0, hw]];
    var ang2 = [0, 45, 135, 180, 225, 315][i % 6];
    if (!D([closed(rotP(a, ang2))])) { miss++; }
}
ok(miss / 300 < 0.03, 'random arrows detected > 97 % (missed ' + miss + '/300)');
console.log('  flèches aléatoires manquées / random arrows missed: ' + miss + '/300');
var upMiss = 0;
for (i = 0; i < 200; i++) {
    var L2 = 40 + rnd() * 160, hw2 = 4 + rnd() * 20, hh2 = hw2 + 5 + rnd() * 30, hl2 = 15 + rnd() * 40;
    if (D([closed(rotP([[0, -hw2], [L2 - hl2, -hw2], [L2 - hl2, -hh2], [L2, 0], [L2 - hl2, hh2], [L2 - hl2, hw2], [0, hw2]], i % 2 ? 90 : 270))])) { upMiss++; }
}
ok(upMiss === 0, 'vertical arrows never flipped (' + upMiss + ')');

ok(lazyDisagree === 0, 'lazy detection = full detection on ' + lazyTotal + ' shapes');

// --- regroupement / clustering ---
var region = [0, 800, 600, 0];
var letters = [[100, 700, 130, 660], [131, 700, 160, 660], [161.5, 700, 190, 660]];
var cl = M.clusterBoxes(letters, region, 2, true);
ok(cl.length === 1 && cl[0].length === 3, 'logo letters clustered');
ok(M.clusterBoxes(letters, region, 2, false).length === 3, 'clustering disabled');
var withBg = [[50, 720, 250, 640]].concat(letters);
cl = M.clusterBoxes(withBg, region, 2, true);
ok(cl.length === 2, 'container does not link (' + cl.length + ')');
var band = [[0, 500, 600, 480], [100, 510, 150, 470], [400, 510, 450, 470]];
ok(M.clusterBoxes(band, region, 2, true).length === 3, 'full-width band does not link');
ok(M.clusterBoxes([[0, 10, 10, 0], [20, 10, 30, 0]], region, 2, true).length === 2, 'far shapes separate');
ok(M.clusterBoxes([[0, 10, 10, 0], [5, 15, 15, 5], [14, 20, 25, 12]], region, 0, true).length === 1, 'chain overlap');
// balayage = force brute / sweep equals brute force
for (var trial = 0; trial < 60; trial++) {
    var bx = [], nb = 3 + Math.floor(rnd() * 30);
    for (k = 0; k < nb; k++) { var x0 = rnd() * 500, y0 = rnd() * 700, w0 = 5 + rnd() * 80, h0 = 5 + rnd() * 80; bx.push([x0, y0 + h0, x0 + w0, y0]); }
    var tol = rnd() * 6, got = M.clusterBoxes(bx, region, tol, true);
    var par = bx.map(function (_, q) { return q; });
    function f(q) { while (par[q] !== q) { q = par[q]; } return q; }
    for (var p1 = 0; p1 < nb; p1++) { for (var p2 = p1 + 1; p2 < nb; p2++) {
        var spanA = M.bw(bx[p1]) >= 540 || M.bh(bx[p1]) >= 720, spanB = M.bw(bx[p2]) >= 540 || M.bh(bx[p2]) >= 720;
        if (!spanA && !spanB && M.boxGap(bx[p1], bx[p2]) <= tol && !M.containsBox(bx[p1], bx[p2], 0.01) && !M.containsBox(bx[p2], bx[p1], 0.01)) { par[f(p1)] = f(p2); }
    } }
    var roots = {}; bx.forEach(function (_, q) { roots[f(q)] = 1; });
    ok(Object.keys(roots).length === got.length, 'sweep = brute force (trial ' + trial + ')');
}

// --- plan ---
var o = M.defaults();
function node(kind, box, extra) { var n = { kind: kind, box: box, name: '' }; for (var key in extra || {}) { n[key] = extra[key]; } return n; }
var bullet = node('vector', [400, 600, 410, 590], { polys: [closed(circle(16, 5).map(function (p) { return [p[0] + 405, p[1] + 595]; }))] });
var itemText = node('text', [415, 605, 560, 588]);
var arrowNode = node('vector', [500, 100, 540, 80], { polys: [closed(arrow.map(function (p) { return [500 + p[0] * 0.4, 80 + p[1] * 0.2]; }))] });
var tree = [
    node('vector', [0, 800, 600, 0], { name: 'Fond' }),
    node('group', [20, 780, 120, 740], { name: 'Logo', liveText: false, children: [] }),
    node('group', [400, 605, 560, 588], { name: 'puce', liveText: true, children: [bullet, itemText] }),
    node('group', [300, 780, 500, 740], { name: 'Logo lockup', liveText: true, children: [node('text', [350, 780, 500, 740]), node('vector', [300, 780, 345, 740])] }),
    arrowNode,
    node('vector', [100, 300, 140, 260], { name: 'icône flèche' }),
    node('vector', [200, 300, 240, 260], { name: 'déco #reste' }),
    node('vector', [250, 300, 290, 260], { name: 'pastille #miroir' }),
    node('image', [20, 500, 300, 320], { name: 'photo produit' }),
    node('text', [40, 700, 300, 680]),
    node('vector', [300, 50, 320, 30], { locked: true }),
    node('textRigid', [10, 60, 200, 20])
];
var pl = M.plan(tree, { region: region, opts: o, getPolys: function (nn) { return nn.polys || null; } });
function unitOf(n) { for (var q = 0; q < pl.units.length; q++) { if (pl.units[q].members.indexOf(n) >= 0) { return pl.units[q]; } } return null; }
ok(pl.opened === 1, 'only the bullet group is opened (logo lockup kept): ' + pl.opened);
ok(unitOf(bullet).kind === 'rigid' && unitOf(itemText).kind === 'text', 'children of opened group become units');
ok(unitOf(tree[3]) && unitOf(tree[3]).kind === 'rigid', 'logo with live text stays rigid (keyword)');
ok(unitOf(arrowNode).flip && unitOf(arrowNode).reason === 'shape', 'arrow found by shape');
ok(unitOf(tree[5]).flip && unitOf(tree[5]).reason === 'name', 'arrow found by name');
ok(unitOf(tree[6]).kind === 'stay' && unitOf(tree[7]).flip && unitOf(tree[7]).forced, 'tags #reste / #miroir');
ok(!unitOf(tree[8]).flip && unitOf(tree[8]).kind === 'rigid', 'photo never flipped');
ok(!unitOf(tree[1]).flip && !unitOf(bullet).flip, 'logo / bullet not flipped');
ok(pl.skipped.length === 1 && unitOf(tree[10]) === null, 'locked skipped');
ok(unitOf(tree[11]).note === 'textRigid', 'path text rigid');
o.ignoreLocked = true; pl = M.plan(tree, { region: region, opts: o, getPolys: function (nn) { return nn.polys || null; } });
ok(pl.skipped.length === 0, 'copy mode includes locked');
var o2 = M.defaults(); o2.openGroups = false; pl = M.plan(tree, { region: region, opts: o2 });
ok(pl.opened === 0 && unitOf(tree[2]).kind === 'rigid', 'openGroups=false');
var o3 = M.defaults(); o3.flipDirectional = false; pl = M.plan(tree, { region: region, opts: o3, getPolys: function (nn) { return nn.polys || null; } });
ok(!unitOf(arrowNode).flip && !unitOf(tree[5]).flip && unitOf(tree[7]).flip, 'flip disabled except #miroir');
var o4 = M.defaults(); o4.iconMax = 1; pl = M.plan(tree, { region: region, opts: o4, getPolys: function (nn) { return nn.polys || null; } });
ok(!unitOf(arrowNode).flip, 'icon size limit');

// --- propriétés sur mises en page aléatoires / properties on random layouts ---
function applyPlan(boxes, axis, tol) {
    var nodes = boxes.map(function (b) { return node('vector', b); });
    var p = M.plan(nodes, { region: [axis - 300, 800, axis + 300, 0], opts: Object.assign(M.defaults(), { tolerance: tol, flipDirectional: false }) });
    var out = boxes.slice(), unitIdx = [];
    p.units.forEach(function (u, ui) {
        var dx = M.mirrorDx(u.box, axis);
        u.members.forEach(function (m) { var q = nodes.indexOf(m); out[q] = [m.box[0] + dx, m.box[1], m.box[2] + dx, m.box[3]]; unitIdx[q] = ui; });
    });
    return { boxes: out, unit: unitIdx, plan: p };
}
var propFail = 0, ovCases = 0, ovMissed = 0;
for (trial = 0; trial < 400; trial++) {
    var nbx = 2 + Math.floor(rnd() * 25), bs = [];
    var ax = 100 + rnd() * 400, tl = rnd() * 4;
    for (k = 0; k < nbx; k++) { var xx = ax - 280 + rnd() * 500, yy = rnd() * 700, ww = 2 + rnd() * 60, hh2b = 2 + rnd() * 60; bs.push([xx, yy + hh2b, xx + ww, yy]); }
    var once = applyPlan(bs, ax, tl), twice = applyPlan(once.boxes, ax, tl), good = true, sameClusters = true;
    var ov = M.newOverlaps(once.plan.units, ax, tl);
    // 1) chaque bloc arrive à sa place symétrique, sans déformation / each unit lands mirrored, undistorted
    once.plan.units.forEach(function (u) {
        var ub = null; u.members.forEach(function (m) { ub = M.unionBox(ub, once.boxes[bs.indexOf(m.box)]); });
        if (!near(M.bcx(ub), 2 * ax - M.bcx(u.box), 1e-6) || !near(M.bw(ub), M.bw(u.box), 1e-9)) { good = false; }
    });
    // 2) écarts internes d'un bloc conservés / internal offsets of a unit kept
    for (k = 0; k < nbx; k++) { for (var k2 = 0; k2 < nbx; k2++) {
        if (once.unit[k] === once.unit[k2] && !near(once.boxes[k][0] - once.boxes[k2][0], bs[k][0] - bs[k2][0], 1e-9)) { good = false; }
    } }
    // 3) ordre gauche/droite inversé entre blocs disjoints / left-right order of disjoint units reversed
    once.plan.units.forEach(function (u1) { once.plan.units.forEach(function (u2) {
        if (u1 !== u2 && u1.box[2] < u2.box[0]) {
            var n1 = M.mirrorDx(u1.box, ax), n2 = M.mirrorDx(u2.box, ax);
            if (!(u1.box[0] + n1 > u2.box[2] + n2 - 1e-9)) { good = false; }
        }
    }); });
    // 4) si les blocs restent les mêmes au 2e passage, deux miroirs = identité ;
    //    s'ils changent, c'est qu'un chevauchement a été créé et signalé.
    //    Same clusters on a 2nd pass => mirror twice = identity; otherwise an overlap was reported.
    for (k = 0; k < nbx; k++) { for (k2 = 0; k2 < nbx; k2++) { if ((once.unit[k] === once.unit[k2]) !== (twice.unit[k] === twice.unit[k2])) { sameClusters = false; } } }
    if (sameClusters) {
        for (k = 0; k < nbx; k++) { if (!near(twice.boxes[k][0], bs[k][0], 1e-6) || !near(twice.boxes[k][2], bs[k][2], 1e-6)) { good = false; } }
    } else { ovCases++; if (!ov.length) { ovMissed++; } }
    if (!good) { propFail++; }
}
ok(propFail === 0, 'random layout properties (failures ' + propFail + '/400)');
ok(ovMissed === 0, 'every cluster change on a 2nd pass was reported as a created overlap (' + ovCases + ' cases, missed ' + ovMissed + ')');
console.log('  mises en page aléatoires où le miroir crée un chevauchement / random layouts with a created overlap: ' + ovCases + '/400');
// Chevauchement créé : cas simple en L / created overlap: simple L case
var Lnodes = [node('vector', [0, 100, 10, 0]), node('vector', [10, 10, 60, 0]), node('vector', [40, 100, 50, 60])];
var Lplan = M.plan(Lnodes, { region: [0, 200, 200, 0], opts: Object.assign(M.defaults(), { tolerance: 0, flipDirectional: false }) });
ok(Lplan.units.length === 2 && M.newOverlaps(Lplan.units, 25, 0).length === 1, 'L-shape: overlap created and reported');
ok(M.newOverlaps(Lplan.units, 25, 0)[0].indexOf(Lnodes[2]) >= 0, 'overlap names the right object');

// --- décalages de copie / copy offsets ---
var off = M.copyOffsets([[0, 800, 600, 0], [700, 800, 1300, 0]], [[0, 800, 600, 0]], 72);
ok(off.right[0] === 1372 && off.right[1] === 0 && off.below[0] === 0 && off.below[1] === -872, 'copyOffsets');

// --- réglages / settings ---
var d = M.defaults(); d.iconMax = 33; d.geometry = false; d.dirKeywords = 'a, b\nc';
var back = M.deserialize(M.serialize(d));
ok(back.iconMax === 33 && back.geometry === false && back.dirKeywords === 'a, b c' && back.scope === 'artboard', 'settings round trip');
ok(M.deserialize('foo=1\niconMax=abc').iconMax === 20, 'settings robust');

console.log('test-core : ' + pass + ' réussis / passed, ' + fail + ' échecs / failed');
process.exit(fail ? 1 : 0);
