/*
 * MiroirRTL.jsx — v1.0.0
 * Version de droite à gauche (arabe, hébreu…) d'une mise en page Illustrator, en un clic.
 * Right-to-left (Arabic, Hebrew…) version of an Illustrator layout, in one click.
 *
 * FR : le script inverse la MISE EN PAGE, pas les objets. Chaque bloc va à la place symétrique
 *      sur le plan de travail mais reste lisible : textes réalignés (gauche ↔ droite, retraits
 *      inversés), logos, photos, illustrations et codes gardés à l'endroit, groupes « composants »
 *      (puce + texte, bouton, carte) réordonnés de l'intérieur, et seuls les pictos directionnels
 *      (flèches, chevrons) retournés — reconnus par leur nom ou par leur forme, avec une liste à
 *      valider. Par défaut, le résultat est une copie sur un nouveau plan de travail à droite :
 *      l'original reste intact.
 * EN : mirrors the LAYOUT, not the objects. Every block moves to its mirrored place on the
 *      artboard but stays readable: text realigned (left ↔ right, indents swapped), logos, photos,
 *      artwork and codes kept unflipped, "component" groups (bullet + text, button, card) reordered
 *      inside, and only directional icons (arrows, chevrons) flipped — found by name or by shape,
 *      with a review list. By default the result is a copy on a new artboard to the right.
 *
 * Balises dans le nom d'un objet (panneau Calques) / tags in an object's name (Layers panel) :
 *   #fixe  (#keep)  : bloc rigide, déplacé sans être retourné / rigid block, moved, never flipped
 *   #miroir (#flip) : toujours retourné / always flipped
 *   #reste (#stay)  : ne bouge pas / stays where it is
 *
 * Auteur / Author : Amirouche Amwanes — Licence MIT (2026).
 * Cible / Target : Illustrator CC 2018 – 2026 (ExtendScript ES3). NON TESTÉ DANS ILLUSTRATOR / NOT TESTED IN ILLUSTRATOR.
 * Conseil : travaillez sur une copie du fichier. Tip: work on a copy. Ctrl/Cmd+Z annule l'exécution.
 * Aucun appel réseau, aucune collecte de données. No network access, no data collection.
 */

//@target illustrator

var MRTL = (function () {
    var VERSION = '1.0.0';
    var MM = 2.834645669;

    var FR = true;
    try { FR = String(app.locale).substr(0, 2).toLowerCase() === 'fr'; } catch (eLoc) { FR = true; }
    function T(fr, en) { return FR ? fr : en; }
    function setLang(isFr) { FR = !!isFr; }

    /* ================================================================== */
    /* MOTEUR PUR (sans DOM, testé sous Node) / PURE ENGINE (no DOM)       */
    /* ================================================================== */

    function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
    function num(s, def) { var v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? def : v; }

    // Boîtes au format Illustrator [gauche, haut, droite, bas] (haut > bas)
    // Boxes in Illustrator format [left, top, right, bottom] (top > bottom)
    function normBox(b) {
        var l = Math.min(b[0], b[2]), r = Math.max(b[0], b[2]);
        var t = Math.max(b[1], b[3]), bo = Math.min(b[1], b[3]);
        return [l, t, r, bo];
    }
    function bw(b) { return b[2] - b[0]; }
    function bh(b) { return b[1] - b[3]; }
    function bcx(b) { return (b[0] + b[2]) / 2; }
    function bcy(b) { return (b[1] + b[3]) / 2; }
    function unionBox(a, b) {
        if (!a) { return [b[0], b[1], b[2], b[3]]; }
        return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])];
    }
    // Décalage horizontal qui amène une boîte à sa place symétrique par rapport à l'axe x = axis
    // Horizontal shift that brings a box to its mirrored place about the axis x = axis
    function mirrorDx(box, axis) { return 2 * axis - (box[0] + box[2]); }
    // Écart de Tchebychev entre deux boîtes (0 si elles se touchent ou se chevauchent)
    // Chebyshev gap between two boxes (0 when touching or overlapping)
    function boxGap(a, b) {
        var gx = Math.max(0, Math.max(a[0], b[0]) - Math.min(a[2], b[2]));
        var gy = Math.max(0, Math.max(a[3], b[3]) - Math.min(a[1], b[1]));
        return Math.max(gx, gy);
    }
    function containsBox(a, b, eps) {
        return a[0] <= b[0] + eps && a[2] >= b[2] - eps && a[1] >= b[1] - eps && a[3] <= b[3] + eps;
    }
    function centerInside(b, r) {
        var x = bcx(b), y = bcy(b);
        return x >= r[0] && x <= r[2] && y <= r[1] && y >= r[3];
    }

    // Minuscules sans accents / lower case without accents
    var ACC_FROM = 'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżšśłđ';
    var ACC_TO = 'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzssld';
    function fold(s) {
        var src = String(s).toLowerCase(), out = '', i, c, k;
        for (i = 0; i < src.length; i++) {
            c = src.charAt(i);
            k = ACC_FROM.indexOf(c);
            out += k >= 0 ? ACC_TO.charAt(k) : c;
        }
        return out;
    }
    function isLatinLetter(c) { return c >= 'a' && c <= 'z'; }

    var TAGS = {
        stay: ['#reste', '#stay', '#ignore', '#ignorer'],
        fixe: ['#fixe', '#fixed', '#keep', '#rigide', '#rigid', '#garder'],
        flip: ['#miroir', '#mirror', '#flip', '#retourner', '#inverser']
    };
    // Lit une balise dans le nom / reads a tag from a name ('stay' | 'fixe' | 'flip' | '')
    function parseTag(name) {
        var n = fold(name), groups = ['stay', 'flip', 'fixe'], g, i, list, p, after;
        if (n.indexOf('#') < 0) { return ''; }
        for (g = 0; g < groups.length; g++) {
            list = TAGS[groups[g]];
            for (i = 0; i < list.length; i++) {
                p = n.indexOf(list[i]);
                while (p >= 0) {
                    after = n.charAt(p + list[i].length);
                    if (!isLatinLetter(after) || groups[g] === 'fixe') { return groups[g]; }
                    p = n.indexOf(list[i], p + 1);
                }
            }
        }
        return '';
    }

    var DEFAULT_DIR_KEYWORDS = 'arrow, fleche, chevron, caret, next, prev, previous, back, forward, suivant, precedent, retour, pointer, سهم, التالي, السابق, رجوع, →, ←, ➜, ➔, ⟶, ›, ‹';
    var DEFAULT_FIX_KEYWORDS = 'logo, marque, brand, wordmark, شعار, qr, barcode, code-barre, code barre, ean, photo, signature, carte, map';

    function parseKeywords(str) {
        var parts = String(str).split(/[,;\n\r]+/), out = [], i, k;
        for (i = 0; i < parts.length; i++) {
            k = fold(trimStr(parts[i]));
            if (k.length) { out.push(k); }
        }
        return out;
    }
    // Mot-clé trouvé dans un nom ? Les mots-clés latins doivent commencer un mot ; ceux de moins
    // de 5 lettres doivent aussi le finir (pluriel en s accepté) : « back » ≠ « background ».
    // Keyword in a name? Latin keywords must start a word; keywords under 5 letters must also end it.
    function keywordHit(name, kws) {
        var n = fold(name), i, kw, p, before, after, latin, end;
        if (!n.length) { return ''; }
        for (i = 0; i < kws.length; i++) {
            kw = kws[i];
            latin = /^[a-z][a-z \-]*$/.test(kw);
            p = n.indexOf(kw);
            if (!latin) { if (p >= 0) { return kw; } continue; }
            while (p >= 0) {
                before = p > 0 ? n.charAt(p - 1) : ' ';
                end = p + kw.length;
                after = n.charAt(end);
                if (after === 's' && !isLatinLetter(n.charAt(end + 1))) { after = n.charAt(end + 1); }
                if (!isLatinLetter(before) && (kw.length >= 5 || !isLatinLetter(after))) { return kw; }
                p = n.indexOf(kw, p + 1);
            }
        }
        return '';
    }

    // --- Géométrie des pictos / icon geometry ---

    // Aplatit un tracé de Bézier / flattens a Bézier path. anchors/lefts/rights : [[x,y],...]
    function flattenPath(anchors, lefts, rights, closed, steps) {
        var out = [], n = anchors.length, i;
        if (!n) { return out; }
        out.push([anchors[0][0], anchors[0][1]]);
        function cubic(p0, p1, p2, p3) {
            var k, t, mt, a, b, c, d;
            for (k = 1; k <= steps; k++) {
                t = k / steps; mt = 1 - t;
                a = mt * mt * mt; b = 3 * mt * mt * t; c = 3 * mt * t * t; d = t * t * t;
                out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
            }
        }
        for (i = 0; i < n - 1; i++) { cubic(anchors[i], rights[i], lefts[i + 1], anchors[i + 1]); }
        if (closed && n > 1) { cubic(anchors[n - 1], rights[n - 1], lefts[0], anchors[0]); }
        return out;
    }

    // Rééchantillonne en gardant chaque tracé à part / resamples keeping each path separate
    function resampleParts(polys, count) {
        var total = 0, i, j, p, q, d, parts = [], part, step, next, acc, t, closedP;
        for (i = 0; i < polys.length; i++) {
            for (j = 1; j < polys[i].length; j++) {
                p = polys[i][j - 1]; q = polys[i][j];
                total += Math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1]));
            }
        }
        if (total <= 0) { return parts; }
        step = total / count;
        for (i = 0; i < polys.length; i++) {
            part = []; acc = 0; next = step / 2;
            if (polys[i].length < 2) { continue; }
            p = polys[i][0]; q = polys[i][polys[i].length - 1];
            closedP = Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;
            if (!closedP) { part.push([p[0], p[1]]); }
            for (j = 1; j < polys[i].length; j++) {
                p = polys[i][j - 1]; q = polys[i][j];
                d = Math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1]));
                while (d > 0 && next <= acc + d) {
                    t = (next - acc) / d;
                    part.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
                    next += step;
                }
                acc += d;
            }
            if (!closedP) { q = polys[i][polys[i].length - 1]; part.push([q[0], q[1]]); }
            part.closed = closedP;
            if (part.length) { parts.push(part); }
        }
        return parts;
    }

    function segDist(px, py, ax, ay, bx, by) {
        var vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy, t = 0, dx, dy;
        if (l2 > 0) { t = ((px - ax) * vx + (py - ay) * vy) / l2; if (t < 0) { t = 0; } else if (t > 1) { t = 1; } }
        dx = px - (ax + t * vx); dy = py - (ay + t * vy);
        return Math.sqrt(dx * dx + dy * dy);
    }
    /*
     * Écart entre un dessin et son reflet : distance de chaque point au tracé reflété, moyenne
     * du quart le plus éloigné (la pointe d'une flèche compte, pas sa tige).
     * Gap between a drawing and its reflection: distance from each point to the reflected
     * outline, mean of the farthest quarter (an arrow's head counts, not its shaft).
     */
    function reflectGap(parts, fx) {
        var d = [], i, j, k, part, rp, P, best, dd, n, s = 0, top, pts = [], segs = [];
        for (i = 0; i < parts.length; i++) {
            part = parts[i]; rp = [];
            for (j = 0; j < part.length; j++) { pts.push(part[j]); rp.push(fx(part[j])); }
            for (j = 0; j < rp.length; j++) {
                if (j + 1 < rp.length) { segs.push([rp[j], rp[j + 1]]); }
                else if (part.closed && rp.length > 1) { segs.push([rp[j], rp[0]]); }
                else if (rp.length === 1) { segs.push([rp[0], rp[0]]); }
            }
        }
        for (i = 0; i < pts.length; i++) {
            P = pts[i]; best = Infinity;
            for (k = 0; k < segs.length; k++) {
                dd = segDist(P[0], P[1], segs[k][0][0], segs[k][0][1], segs[k][1][0], segs[k][1][1]);
                if (dd < best) { best = dd; }
            }
            d.push(best);
        }
        d.sort(function (a, b) { return b - a; });
        n = d.length; top = Math.max(1, Math.ceil(n / 4));
        for (i = 0; i < top && i < n; i++) { s += d[i]; }
        return n ? s / top : 0;
    }

    var SAMPLES = 64;
    // Dessin normalisé (centré, échelle 1 sur le plus grand côté) / normalised drawing
    function normalizedParts(polys, count) {
        var parts = resampleParts(polys, count), i, j, l = Infinity, r = -Infinity, t = -Infinity, b = Infinity;
        var cx, cy, s, np = [], part, q, cnt = 0;
        for (i = 0; i < parts.length; i++) {
            for (j = 0; j < parts[i].length; j++) {
                q = parts[i][j]; cnt++;
                if (q[0] < l) { l = q[0]; } if (q[0] > r) { r = q[0]; }
                if (q[1] > t) { t = q[1]; } if (q[1] < b) { b = q[1]; }
            }
        }
        if (cnt < 8) { return null; }
        s = Math.max(r - l, t - b);
        if (!(s > 0)) { return null; }
        cx = (l + r) / 2; cy = (t + b) / 2;
        for (i = 0; i < parts.length; i++) {
            part = [];
            for (j = 0; j < parts[i].length; j++) { part.push([(parts[i][j][0] - cx) / s, (parts[i][j][1] - cy) / s]); }
            part.closed = parts[i].closed;
            np.push(part);
        }
        return np;
    }
    var FX = {
        v: function (p) { return [-p[0], p[1]]; },
        h: function (p) { return [p[0], -p[1]]; },
        d1: function (p) { return [p[1], p[0]]; },
        d2: function (p) { return [-p[1], -p[0]]; }
    };
    /*
     * Erreurs de symétrie d'un dessin par rapport à 4 axes passant par son centre :
     * v = axe vertical (gauche/droite), h = axe horizontal, d1/d2 = diagonales.
     * Symmetry errors of a drawing about 4 axes through its centre.
     */
    function symmetryScores(polys, count) {
        var np = normalizedParts(polys, count || SAMPLES);
        if (!np) { return null; }
        return { v: reflectGap(np, FX.v), h: reflectGap(np, FX.h), d1: reflectGap(np, FX.d1), d2: reflectGap(np, FX.d2) };
    }

    // Picto « directionnel » : symétrique par rapport à un axe non vertical (→ ↗ › ◀) mais pas
    // par rapport à l'axe vertical (↑ ⌂ ○ restent). Seuils réglés sur 600 flèches et 2 000
    // polygones aléatoires (voir tests). Directional: mirror-symmetric about a non-vertical axis
    // but not about the vertical one. Thresholds tuned on random arrows and polygons (tests).
    var SYM_OK = 0.02, ASYM_MIN = 0.012, RATIO = 4;
    function isDirectional(sc) {
        if (!sc) { return false; }
        var m = Math.min(sc.h, Math.min(sc.d1, sc.d2));
        return sc.v >= ASYM_MIN && m <= SYM_OK && sc.v >= RATIO * m;
    }
    // Même décision, calcul paresseux (sortie rapide pour les formes symétriques gauche/droite)
    // Same decision, computed lazily (fast exit for left/right symmetric shapes)
    function shapeIsDirectional(polys) {
        var np = normalizedParts(polys, SAMPLES), v, m, k, keys = ['h', 'd1', 'd2'];
        if (!np) { return false; }
        v = reflectGap(np, FX.v);
        if (v < ASYM_MIN) { return false; }
        for (k = 0; k < keys.length; k++) {
            m = reflectGap(np, FX[keys[k]]);
            if (m <= SYM_OK && v >= RATIO * m) { return true; }
        }
        return false;
    }

    // --- Textes / text ---
    var JUST_SWAP = {
        LEFT: 'RIGHT', RIGHT: 'LEFT',
        FULLJUSTIFYLASTLINELEFT: 'FULLJUSTIFYLASTLINERIGHT',
        FULLJUSTIFYLASTLINERIGHT: 'FULLJUSTIFYLASTLINELEFT'
    };
    // « Justification.LEFT » → « RIGHT » ; centré/justifié partout → null (inchangé)
    function swapJustName(j) {
        var k = String(j).replace(/^.*\./, '').toUpperCase();
        return JUST_SWAP.hasOwnProperty(k) ? JUST_SWAP[k] : null;
    }
    // Angle (degrés) et symétrie d'une matrice / angle (degrees) and reflection of a matrix
    function rotationOf(a, b, c, d) {
        var det = a * d - b * c;
        var sx = Math.sqrt(a * a + b * b), sy = Math.sqrt(c * c + d * d);
        var skew = (sx > 0 && sy > 0) ? Math.abs(a * c + b * d) / (sx * sy) : 1;
        return { angle: Math.atan2(b, a) * 180 / Math.PI, mirrored: det < 0, skewed: skew > 0.01 };
    }
    function normAngle(a) { while (a > 180) { a -= 360; } while (a <= -180) { a += 360; } return a; }

    // --- Regroupement des formes non groupées / clustering of ungrouped shapes ---
    /*
     * Les formes (non texte, non image) qui se touchent ou presque (écart ≤ tol) forment un
     * seul bloc rigide : un logo ou un dessin non groupé ne se disloque pas. Ne relient pas :
     * une forme qui en contient une autre (fond, cadre, carte) et une forme qui couvre ≥ 90 %
     * de la largeur ou de la hauteur de la zone (bandeau, filet pleine largeur).
     * Shapes touching (gap ≤ tol) form one rigid block. Containers and full-width bands don't link.
     * Retourne des listes d'indices / returns lists of indices.
     */
    function clusterBoxes(boxes, region, tol, enabled) {
        var n = boxes.length, parent = [], span = [], order = [], i, a, b, j, rw = bw(region), rh = bh(region);
        var groups = {}, keys = [], res = [], r;
        function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
        for (i = 0; i < n; i++) {
            parent[i] = i; order.push(i);
            span[i] = (rw > 0 && bw(boxes[i]) >= 0.9 * rw) || (rh > 0 && bh(boxes[i]) >= 0.9 * rh);
        }
        if (enabled && n > 1) {
            order.sort(function (p, q) { return boxes[p][0] - boxes[q][0]; });
            for (a = 0; a < n; a++) {
                i = order[a];
                if (span[i]) { continue; }
                for (b = a + 1; b < n; b++) {
                    j = order[b];
                    if (boxes[j][0] > boxes[i][2] + tol) { break; }
                    if (span[j]) { continue; }
                    if (boxGap(boxes[i], boxes[j]) <= tol &&
                            !containsBox(boxes[i], boxes[j], 0.01) && !containsBox(boxes[j], boxes[i], 0.01)) {
                        parent[find(i)] = find(j);
                    }
                }
            }
        }
        for (i = 0; i < n; i++) {
            r = 'k' + find(i);
            if (!groups.hasOwnProperty(r)) { groups[r] = []; keys.push(r); }
            groups[r].push(i);
        }
        for (i = 0; i < keys.length; i++) { res.push(groups[keys[i]]); }
        return res;
    }

    /*
     * PLAN : décide ce que devient chaque objet. Entrée : arbre de nœuds abstraits
     *   { kind: 'group'|'text'|'textRigid'|'vector'|'image'|'symbol'|'other', box, name,
     *     symbolName, locked, liveText (groupes), children (groupes ouverts) }.
     * Sortie : unités { kind: 'rigid'|'text'|'stay', members, box, flip, forced, reason }.
     * PLAN: decides what happens to each object.
     */
    function plan(roots, ctx) {
        var o = ctx.opts, region = ctx.region;
        var dirKw = parseKeywords(o.dirKeywords || ''), fixKw = parseKeywords(o.fixKeywords || '');
        var res = { units: [], skipped: [], opened: 0, geom: 0 };
        var lim = (o.iconMax || 20) / 100 * Math.min(bw(region), bh(region));

        function mk(kind, members, box) {
            var u = { kind: kind, members: members, box: box, flip: false, forced: false, reason: '', detect: false }, i;
            if (!u.box) { for (i = 0; i < members.length; i++) { u.box = unionBox(u.box, members[i].box); } }
            res.units.push(u);
            return u;
        }
        function detect(u) {
            var i, m, hit, polys = [], p, j, size;
            if (!o.flipDirectional) { return; }
            for (i = 0; i < u.members.length; i++) {
                m = u.members[i];
                hit = keywordHit(m.name || '', dirKw) || keywordHit(m.symbolName || '', dirKw);
                if (hit) { u.flip = true; u.reason = 'name'; u.hit = hit; return; }
            }
            if (!o.geometry || !ctx.getPolys) { return; }
            size = Math.max(bw(u.box), bh(u.box));
            if (!(size > 0) || size > lim || res.geom >= (o.maxGeom || 200)) { return; }
            for (i = 0; i < u.members.length; i++) {
                p = ctx.getPolys(u.members[i]);
                if (!p) { return; }
                for (j = 0; j < p.length; j++) { polys.push(p[j]); }
            }
            res.geom++;
            if (shapeIsDirectional(polys)) { u.flip = true; u.reason = 'shape'; }
        }
        function level(list) {
            var vec = [], i, n, tag, u, groups, g, k, mem, boxes = [];
            for (i = 0; i < list.length; i++) {
                n = list[i];
                if (n.locked && !o.ignoreLocked) { res.skipped.push({ node: n, why: 'locked' }); continue; }
                tag = parseTag(n.name || '');
                if (tag === 'stay') { mk('stay', [n]); continue; }
                if (tag === 'fixe') { mk('rigid', [n]); continue; }
                if (tag === 'flip') { u = mk('rigid', [n]); u.flip = true; u.forced = true; u.reason = 'tag'; continue; }
                if (n.kind === 'group' && n.liveText && o.openGroups && n.children && n.children.length &&
                        !keywordHit(n.name || '', fixKw)) {
                    res.opened++; level(n.children); continue;
                }
                if (n.kind === 'text') { mk('text', [n]); continue; }
                if (n.kind === 'textRigid' || n.kind === 'image' || (n.kind === 'group' && n.liveText)) {
                    u = mk('rigid', [n]);
                    if (n.kind === 'textRigid') { u.note = 'textRigid'; }
                    continue;
                }
                if (keywordHit(n.name || '', fixKw) || keywordHit(n.symbolName || '', fixKw)) { mk('rigid', [n]); continue; }
                vec.push(n);
            }
            for (i = 0; i < vec.length; i++) { boxes.push(vec[i].box); }
            groups = clusterBoxes(boxes, region, o.tolerance || 0, !!o.keepTogether);
            for (g = 0; g < groups.length; g++) {
                mem = [];
                for (k = 0; k < groups[g].length; k++) { mem.push(vec[groups[g][k]]); }
                u = mk('rigid', mem);
                u.detect = true;
                detect(u);
            }
        }
        level(roots);
        return res;
    }

    /*
     * Chevauchements CRÉÉS par le miroir : deux objets de blocs différents qui se touchent après
     * (écart ≤ tol) alors qu'ils ne se touchaient pas avant (un bloc rigide est déplacé sans être
     * retourné, donc une disposition en L peut en heurter une autre). Signalés, jamais corrigés.
     * Overlaps CREATED by the mirror (rigid blocks are moved, not flipped). Reported, not fixed.
     */
    function newOverlaps(units, axis, tol) {
        var items = [], i, j, k, u, m, b, dx, out = [], A, B;
        // « se touchent » au sens du regroupement (contenir n'est pas toucher)
        // "touching" as in clustering (containing is not touching)
        function linked(p, q) { return boxGap(p, q) <= tol && !containsBox(p, q, 0.01) && !containsBox(q, p, 0.01); }
        for (i = 0; i < units.length; i++) {
            u = units[i];
            for (k = 0; k < u.members.length; k++) {
                m = u.members[k]; b = m.box;
                if (u.kind === 'stay') { dx = 0; }
                else if (u.kind === 'rigid' && !u.flip) { dx = mirrorDx(u.box, axis); }
                else { dx = mirrorDx(b, axis); }
                items.push({ u: i, b: b, nb: [b[0] + dx, b[1], b[2] + dx, b[3]], m: m });
            }
        }
        items.sort(function (p, q) { return p.nb[0] - q.nb[0]; });
        for (i = 0; i < items.length; i++) {
            A = items[i];
            for (j = i + 1; j < items.length; j++) {
                B = items[j];
                if (B.nb[0] > A.nb[2] + tol) { break; }
                if (A.u === B.u) { continue; }
                if (linked(A.nb, B.nb) && !linked(A.b, B.b)) { out.push([A.m, B.m]); }
            }
        }
        return out;
    }

    // Décalage commun pour copier des plans de travail à droite (ou dessous) de tous les autres
    // Common offset to copy artboards to the right of (or below) all the others
    function copyOffsets(allRects, scoped, gap) {
        var maxR = -Infinity, minB = Infinity, minL = Infinity, maxT = -Infinity, i;
        for (i = 0; i < allRects.length; i++) {
            if (allRects[i][2] > maxR) { maxR = allRects[i][2]; }
            if (allRects[i][3] < minB) { minB = allRects[i][3]; }
        }
        for (i = 0; i < scoped.length; i++) {
            if (scoped[i][0] < minL) { minL = scoped[i][0]; }
            if (scoped[i][1] > maxT) { maxT = scoped[i][1]; }
        }
        return { right: [maxR + gap - minL, 0], below: [0, (minB - gap) - maxT] };
    }

    /* ================================================================== */
    /* RÉGLAGES / SETTINGS                                                 */
    /* ================================================================== */

    function defaults() {
        return {
            scope: 'artboard', mode: 'copy', selAxis: 'artboard',
            swapAlign: true, rtlDir: false, unrotate: true,
            flipDirectional: true, geometry: true, iconMax: 20, dirKeywords: DEFAULT_DIR_KEYWORDS,
            openGroups: true, keepTogether: true, tolerance: 1, fixKeywords: DEFAULT_FIX_KEYWORDS,
            review: true, gap: 72, maxGeom: 200, ignoreLocked: false
        };
    }
    var CFG_KEYS = ['scope', 'mode', 'selAxis', 'swapAlign', 'rtlDir', 'unrotate', 'flipDirectional', 'geometry',
        'iconMax', 'dirKeywords', 'openGroups', 'keepTogether', 'tolerance', 'fixKeywords', 'review'];
    function serialize(o) {
        var s = 'MiroirRTL ' + VERSION + '\n', i, k, v;
        for (i = 0; i < CFG_KEYS.length; i++) {
            k = CFG_KEYS[i]; v = o[k];
            s += k + '=' + String(v).replace(/[\r\n]+/g, ' ') + '\n';
        }
        return s;
    }
    function deserialize(txt, base) {
        var o = base || defaults(), lines = String(txt).split(/\r?\n/), i, p, k, v, d = defaults();
        for (i = 0; i < lines.length; i++) {
            p = lines[i].indexOf('=');
            if (p <= 0) { continue; }
            k = lines[i].substr(0, p); v = lines[i].substr(p + 1);
            if (!d.hasOwnProperty(k)) { continue; }
            if (typeof d[k] === 'boolean') { o[k] = v === 'true'; }
            else if (typeof d[k] === 'number') { o[k] = num(v, d[k]); }
            else { o[k] = v; }
        }
        return o;
    }
    function cfgFile() {
        try { return new File(Folder.userData + '/MiroirRTL_settings.txt'); } catch (e) { return null; }
    }
    function loadCfg() {
        var f = cfgFile(), o = defaults(), t;
        try { if (f && f.exists) { f.encoding = 'UTF-8'; f.open('r'); t = f.read(); f.close(); o = deserialize(t, o); } } catch (e) { }
        return o;
    }
    function saveCfg(o) {
        var f = cfgFile();
        try { if (f) { f.encoding = 'UTF-8'; f.open('w'); f.write(serialize(o)); f.close(); } } catch (e) { }
    }

    /* ================================================================== */
    /* LECTURE DU DOCUMENT / READING THE DOCUMENT                          */
    /* ================================================================== */

    function safeName(it) { try { return String(it.name || ''); } catch (e) { return ''; } }

    function clipBox(g) {
        var i, c;
        try {
            for (i = 0; i < g.pageItems.length; i++) {
                c = g.pageItems[i];
                if (c.typename === 'PathItem' && c.clipping) { return normBox(c.geometricBounds); }
                if (c.typename === 'CompoundPathItem' && c.pathItems.length && c.pathItems[0].clipping) { return normBox(c.geometricBounds); }
            }
        } catch (e) { }
        return null;
    }
    // Boîte visible (un groupe masqué = la boîte de son masque) / visible box (clip group = its mask)
    function itemBox(it) {
        var cb;
        try { if (it.typename === 'GroupItem' && it.clipped) { cb = clipBox(it); if (cb) { return cb; } } } catch (e0) { }
        try { return normBox(it.visibleBounds); } catch (e1) { }
        try { return normBox(it.geometricBounds); } catch (e2) { }
        return [0, 0, 0, 0];
    }
    function isLiveText(tf) {
        try {
            if (tf.kind === TextType.PATHTEXT) { return false; }
            if (tf.orientation === TextOrientation.VERTICAL) { return false; }
        } catch (e) { }
        return true;
    }
    function groupHasLiveText(g, depth) {
        var i;
        if (depth > 30) { return false; }
        try {
            for (i = 0; i < g.textFrames.length; i++) { if (isLiveText(g.textFrames[i])) { return true; } }
            for (i = 0; i < g.groupItems.length; i++) { if (groupHasLiveText(g.groupItems[i], depth + 1)) { return true; } }
        } catch (e) { }
        return false;
    }
    function itemLocked(it) { try { return !!it.locked; } catch (e) { return false; } }

    function nodeFromItem(it, path) {
        var tn = '', n, i, ch;
        try { tn = it.typename; } catch (e) { }
        n = { item: it, path: path, name: safeName(it), locked: itemLocked(it), kind: 'other', box: itemBox(it), typename: tn };
        if (tn === 'TextFrame') { n.kind = isLiveText(it) ? 'text' : 'textRigid'; }
        else if (tn === 'GroupItem') {
            n.kind = 'group';
            n.liveText = groupHasLiveText(it, 0);
            n.children = [];
            if (n.liveText) {
                for (i = 0; i < it.pageItems.length; i++) {
                    ch = it.pageItems[i];
                    n.children.push(nodeFromItem(ch, path.concat([i])));
                }
            }
        }
        else if (tn === 'PathItem' || tn === 'CompoundPathItem') { n.kind = 'vector'; }
        else if (tn === 'PlacedItem' || tn === 'RasterItem') { n.kind = 'image'; }
        else if (tn === 'SymbolItem') { n.kind = 'symbol'; try { n.symbolName = String(it.symbol.name); } catch (e2) { } }
        return n;
    }

    function pointsOf(path) {
        var pp = path.pathPoints, a = [], l = [], r = [], i, p;
        for (i = 0; i < pp.length; i++) {
            p = pp[i];
            a.push([p.anchor[0], p.anchor[1]]);
            l.push(p.leftDirection ? [p.leftDirection[0], p.leftDirection[1]] : [p.anchor[0], p.anchor[1]]);
            r.push(p.rightDirection ? [p.rightDirection[0], p.rightDirection[1]] : [p.anchor[0], p.anchor[1]]);
        }
        return flattenPath(a, l, r, !!path.closed, 6);
    }
    // Polylignes d'un objet vectoriel (null si trop complexe ou non lisible)
    // Polylines of a vector object (null when too complex or unreadable)
    function getPolys(node) {
        var out = [], budget = { paths: 0, pts: 0 }, ok = true;
        function walk(it, depth) {
            var tn = it.typename, i;
            if (!ok) { return; }
            if (depth > 20) { ok = false; return; }
            if (tn === 'PathItem') {
                try { if (it.guides) { return; } } catch (eg) { }
                budget.paths++; budget.pts += it.pathPoints.length;
                if (budget.paths > 300 || budget.pts > 3000) { ok = false; return; }
                out.push(pointsOf(it));
            } else if (tn === 'CompoundPathItem') {
                for (i = 0; i < it.pathItems.length; i++) { walk(it.pathItems[i], depth + 1); }
            } else if (tn === 'GroupItem') {
                for (i = 0; i < it.pageItems.length; i++) { walk(it.pageItems[i], depth + 1); }
            } else { ok = false; }
        }
        try { walk(node.item, 0); } catch (e) { ok = false; }
        return ok && out.length ? out : null;
    }

    // Calques utilisables (visibles, déverrouillés), sous-calques compris / usable layers
    function usableLayers(doc, skipped) {
        var out = [];
        function walk(layers, parentOk) {
            var i, L, ok;
            for (i = 0; i < layers.length; i++) {
                L = layers[i];
                ok = parentOk;
                try { if (!L.visible || L.locked) { ok = false; } } catch (e) { ok = false; }
                if (!ok && parentOk) { skipped.push(String(L.name)); }
                if (ok) { out.push(L); }
                try { walk(L.layers, ok); } catch (e2) { }
            }
        }
        walk(doc.layers, true);
        return out;
    }
    function topItemsOf(layer) {
        var out = [], i, it;
        for (i = 0; i < layer.pageItems.length; i++) {
            it = layer.pageItems[i];
            try { if (it.parent.typename !== 'Layer') { continue; } } catch (e) { }
            out.push(it);
        }
        return out;
    }

    function selectionItems(doc) {
        var sel = doc.selection, out = [], i;
        if (!sel || !sel.length || typeof sel.length !== 'number') { return out; }
        for (i = 0; i < sel.length; i++) { if (sel[i] && sel[i].typename && sel[i].typename !== 'TextRange') { out.push(sel[i]); } }
        return out;
    }

    function abRect(ab) { return normBox(ab.artboardRect); }

    /*
     * Prépare les « travaux » : une zone (plan de travail ou sélection), un axe et des racines.
     * Builds jobs: a region (artboard or selection), an axis and root items.
     */
    function collectJobs(doc, o, skippedLayers) {
        var jobs = [], i, j, k, items, layers, rects = [], it, box, abIdx, sel, sb, axisRect, idx;
        if (o.scope === 'selection') {
            sel = selectionItems(doc);
            if (!sel.length) { return jobs; }
            sb = null;
            for (i = 0; i < sel.length; i++) { sb = unionBox(sb, itemBox(sel[i])); }
            // Zone de référence (tailles, bandeaux) = plan de travail de la sélection ; axe = centre
            // du plan de travail ou de la sélection. Reference region = the selection's artboard.
            idx = doc.artboards.getActiveArtboardIndex();
            for (i = 0; i < doc.artboards.length; i++) { if (centerInside(sb, abRect(doc.artboards[i]))) { idx = i; break; } }
            axisRect = (o.selAxis === 'artboard' && o.mode !== 'copy') ? abRect(doc.artboards[idx]) : sb;
            jobs.push({ region: abRect(doc.artboards[idx]), axis: bcx(axisRect), items: sel, ab: -1, selBox: sb });
            return jobs;
        }
        for (i = 0; i < doc.artboards.length; i++) { rects.push(abRect(doc.artboards[i])); }
        if (o.scope === 'all') { for (i = 0; i < rects.length; i++) { jobs.push({ region: rects[i], axis: bcx(rects[i]), items: [], ab: i }); } }
        else {
            abIdx = doc.artboards.getActiveArtboardIndex();
            jobs.push({ region: rects[abIdx], axis: bcx(rects[abIdx]), items: [], ab: abIdx });
        }
        layers = usableLayers(doc, skippedLayers);
        for (i = 0; i < layers.length; i++) {
            items = topItemsOf(layers[i]);
            for (j = 0; j < items.length; j++) {
                it = items[j];
                box = itemBox(it);
                for (k = 0; k < jobs.length; k++) {
                    if (centerInside(box, jobs[k].region)) { jobs[k].items.push(it); break; }
                }
            }
        }
        return jobs;
    }

    function buildRoots(job) {
        var roots = [], i;
        for (i = 0; i < job.items.length; i++) { roots.push(nodeFromItem(job.items[i], [i])); }
        return roots;
    }

    /* ================================================================== */
    /* APPLICATION / APPLYING                                              */
    /* ================================================================== */

    function resolve(tops, path) {
        var it = tops[path[0]], i;
        for (i = 1; i < path.length; i++) { it = it.pageItems[path[i]]; }
        return it;
    }
    function withUnlocked(it, fn) {
        var was = itemLocked(it);
        if (was) { try { it.locked = false; } catch (e) { } }
        try { fn(); } finally { if (was) { try { it.locked = true; } catch (e2) { } } }
    }
    function moveX(it, dx) {
        if (Math.abs(dx) < 1e-6) { return; }
        it.translate(dx, 0, true, true, true, true);
    }

    function paragraphsOf(tf) {
        try { if (tf.previousFrame) { return null; } } catch (e) { }
        try { if (tf.nextFrame) { return tf.story.paragraphs; } } catch (e2) { }
        return tf.paragraphs;
    }
    // Alignement gauche ↔ droite, retraits inversés, direction RTL en option
    // Left ↔ right alignment, swapped indents, optional RTL direction
    function mirrorParagraphs(tf, o, stats) {
        var paras = paragraphsOf(tf), i, pa, sw, li, ri, rtl = null;
        if (!paras) { stats.threaded++; return; }
        try { if (o.rtlDir && typeof ParagraphDirectionType !== 'undefined') { rtl = ParagraphDirectionType.RIGHT_TO_LEFT_DIRECTION; } } catch (e0) { }
        for (i = 0; i < paras.length; i++) {
            try {
                pa = paras[i].paragraphAttributes;
                if (rtl !== null) {
                    try { pa.paragraphDirection = rtl; stats.rtl++; } catch (eD) { try { paras[i].paragraphDirection = rtl; stats.rtl++; } catch (eD2) { } }
                }
                if (o.swapAlign) {
                    sw = swapJustName(pa.justification);
                    if (sw && Justification[sw] !== undefined) { pa.justification = Justification[sw]; stats.aligned++; }
                    li = pa.leftIndent; ri = pa.rightIndent;
                    if (Math.abs(li - ri) > 0.001) { pa.leftIndent = ri; pa.rightIndent = li; stats.indents++; }
                }
            } catch (eP) { /* paragraphe vide / empty paragraph */ }
        }
    }
    function frameRotation(tf) {
        try { var m = tf.matrix; return rotationOf(m.mValueA, m.mValueB, m.mValueC, m.mValueD); } catch (e) { return null; }
    }
    // Inclinaison θ → −θ, vérifiée après coup (convention de signe de la matrice incertaine)
    // Tilt θ → −θ, checked afterwards (matrix sign convention uncertain)
    function unrotate(tf, stats) {
        var r0 = frameRotation(tf), r1, a0;
        if (!r0 || r0.mirrored || r0.skewed) { return; }
        a0 = normAngle(r0.angle);
        if (Math.abs(a0) < 0.05 || Math.abs(Math.abs(a0) - 180) < 0.05) { return; }
        tf.rotate(-2 * a0, true, true, true, true, Transformation.CENTER);
        r1 = frameRotation(tf);
        if (r1 && Math.abs(normAngle(r1.angle + a0)) > 0.5 && Math.abs(normAngle(r1.angle - 3 * a0)) < 0.5) {
            tf.rotate(4 * a0, true, true, true, true, Transformation.CENTER);
        }
        stats.rotated++;
    }

    function applyUnit(u, tops, axis, o, stats) {
        var i, it, m, b, target, dx, dy;
        if (u.kind === 'stay') { stats.stayed += u.members.length; return; }
        if (u.kind === 'text') {
            m = u.members[0]; it = resolve(tops, m.path);
            withUnlocked(it, function () {
                mirrorParagraphs(it, o, stats);
                if (o.unrotate) { unrotate(it, stats); }
                // Un texte de point tourné glisse aussi verticalement quand son alignement change :
                // on rétablit le centre vertical. Rotated point text also slides vertically when
                // its alignment changes: restore the vertical centre.
                b = itemBox(it);
                target = 2 * axis - bcx(m.box) + (tops.offX || 0);
                dy = bcy(m.box) + (tops.offY || 0) - bcy(b);
                if (Math.abs(target - bcx(b)) > 1e-6 || Math.abs(dy) > 1e-6) { it.translate(target - bcx(b), dy, true, true, true, true); }
            });
            stats.texts++;
            return;
        }
        if (u.flip) {
            for (i = 0; i < u.members.length; i++) {
                m = u.members[i]; it = resolve(tops, m.path);
                withUnlocked(it, function () {
                    it.resize(-100, 100, true, true, true, true, 100, Transformation.CENTER);
                    b = itemBox(it);
                    target = 2 * axis - bcx(m.box) + (tops.offX || 0);
                    moveX(it, target - bcx(b));
                });
            }
            stats.flipped++;
            return;
        }
        dx = mirrorDx(u.box, axis);
        for (i = 0; i < u.members.length; i++) {
            it = resolve(tops, u.members[i].path);
            withUnlocked(it, function () { moveX(it, dx); });
        }
        stats.moved++;
    }

    function shortName(n) {
        var s = n.name || n.symbolName || '';
        if (!s && n.kind === 'text') { try { s = '« ' + String(n.item.contents).substr(0, 18) + ' »'; } catch (e) { } }
        return s || '<' + (n.typename || n.kind) + '>';
    }

    function newStats() { return { moved: 0, texts: 0, flipped: 0, stayed: 0, aligned: 0, indents: 0, rtl: 0, rotated: 0, threaded: 0, errors: 0, errList: [] }; }

    /*
     * Exécution complète, indépendante de l'interface (ui = {alert, review}).
     * Full run, UI-independent.
     */
    function run(doc, o, ui) {
        var skippedLayers = [], jobs, i, j, roots, total = 0, stats = newStats(), off = null, created = [], rects = [], scoped = [];
        var offs, tryOff, ab, name, dup, tops, report, u, skippedTotal = 0, rigidTexts = 0, overlapTotal = 0, ovNames = [];
        o.ignoreLocked = (o.mode === 'copy');
        jobs = collectJobs(doc, o, skippedLayers);
        for (i = 0; i < jobs.length; i++) {
            roots = buildRoots(jobs[i]);
            jobs[i].roots = roots;
            jobs[i].plan = plan(roots, { region: jobs[i].region, opts: o, getPolys: getPolys });
            total += jobs[i].items.length;
            skippedTotal += jobs[i].plan.skipped.length;
            for (j = 0; j < jobs[i].plan.units.length; j++) { if (jobs[i].plan.units[j].note === 'textRigid') { rigidTexts++; } }
        }
        if (!total) {
            ui.alert(o.scope === 'selection' ? T('Rien n\'est sélectionné.', 'Nothing is selected.') :
                T('Aucun objet modifiable sur le plan de travail (calques masqués ou verrouillés ?).', 'No editable object on the artboard (hidden or locked layers?).'));
            return null;
        }
        function computeOverlaps() {
            var q;
            overlapTotal = 0;
            for (q = 0; q < jobs.length; q++) {
                jobs[q].overlaps = newOverlaps(jobs[q].plan.units, jobs[q].axis, Math.max(0, o.tolerance || 0));
                overlapTotal += jobs[q].overlaps.length;
            }
        }
        computeOverlaps();
        if (o.review && ui.review && !ui.review(jobs, o, skippedLayers)) { return null; }
        // recalculés avec les choix finaux de retournement / recomputed with the final flip choices
        computeOverlaps();

        // Copie : plans de travail + duplication / copy: artboards + duplicates
        if (o.mode === 'copy') {
            if (o.scope === 'selection') {
                off = [bw(jobs[0].selBox) + o.gap, 0];
            } else {
                for (i = 0; i < doc.artboards.length; i++) { rects.push(abRect(doc.artboards[i])); }
                for (i = 0; i < jobs.length; i++) { scoped.push(jobs[i].region); }
                offs = copyOffsets(rects, scoped, o.gap);
                tryOff = [offs.right, offs.below];
                for (j = 0; j < tryOff.length && !off; j++) {
                    created = [];
                    try {
                        for (i = 0; i < jobs.length; i++) {
                            ab = jobs[i].region;
                            name = String(doc.artboards[jobs[i].ab].name) + ' RTL';
                            ab = doc.artboards.add([ab[0] + tryOff[j][0], ab[1] + tryOff[j][1], ab[2] + tryOff[j][0], ab[3] + tryOff[j][1]]);
                            try { ab.name = name; } catch (eN) { }
                            created.push(ab);
                        }
                        off = tryOff[j];
                    } catch (eAb) {
                        for (i = created.length - 1; i >= 0; i--) { try { created[i].remove(); } catch (eR) { } }
                        created = [];
                    }
                }
                if (!off) {
                    ui.alert(T('Impossible de créer le plan de travail de la copie (plus de place sur la table de montage). Essayez « Modifier sur place » sur une copie du fichier.',
                        'Cannot create the copy artboard (no room left on the canvas). Try "Modify in place" on a copy of the file.'));
                    return null;
                }
            }
        }

        for (i = 0; i < jobs.length; i++) {
            tops = [];
            for (j = 0; j < jobs[i].items.length; j++) {
                if (o.mode === 'copy') {
                    try {
                        dup = jobs[i].items[j].duplicate(jobs[i].items[j], ElementPlacement.PLACEBEFORE);
                        (function (d) { withUnlocked(d, function () { d.translate(off[0], off[1], true, true, true, true); }); })(dup);
                    } catch (eDup) { dup = null; stats.errors++; }
                    tops.push(dup);
                } else { tops.push(jobs[i].items[j]); }
            }
            tops.offX = o.mode === 'copy' ? off[0] : 0;
            tops.offY = o.mode === 'copy' ? off[1] : 0;
            for (j = 0; j < jobs[i].plan.units.length; j++) {
                u = jobs[i].plan.units[j];
                try {
                    if (tops[u.members[0].path[0]] === null) { throw new Error('dup'); }
                    applyUnit(u, tops, jobs[i].axis, o, stats);
                } catch (eU) { stats.errors++; if (stats.errList.length < 5) { stats.errList.push(String(eU.message || eU)); } }
            }
        }

        report = T('Miroir RTL terminé.', 'RTL mirror done.') + '\n\n' +
            T('Blocs déplacés : ', 'Blocks moved: ') + stats.moved + '\n' +
            T('Textes réalignés : ', 'Texts realigned: ') + stats.texts + ' (' + stats.aligned + T(' paragraphes inversés', ' paragraphs swapped') + ')\n' +
            T('Pictos retournés : ', 'Icons flipped: ') + stats.flipped + '\n';
        if (stats.rotated) { report += T('Textes tournés inversés (−θ) : ', 'Tilted texts reversed (−θ): ') + stats.rotated + '\n'; }
        if (o.rtlDir) { report += T('Paragraphes passés en RTL : ', 'Paragraphs set to RTL: ') + stats.rtl + '\n'; }
        if (stats.stayed) { report += T('Laissés en place (#reste) : ', 'Left in place (#stay): ') + stats.stayed + '\n'; }
        if (rigidTexts) { report += T('Textes curvilignes/verticaux déplacés sans réalignement : ', 'Path/vertical texts moved without realignment: ') + rigidTexts + '\n'; }
        if (stats.threaded) { report += T('Cadres chaînés suivants (alignement réglé via le premier cadre) : ', 'Following threaded frames (alignment via the first frame): ') + stats.threaded + '\n'; }
        if (skippedTotal) { report += T('Objets verrouillés ignorés : ', 'Locked objects skipped: ') + skippedTotal + '\n'; }
        if (skippedLayers.length) { report += T('Calques masqués/verrouillés ignorés : ', 'Hidden/locked layers skipped: ') + skippedLayers.join(', ') + '\n'; }
        if (overlapTotal) {
            for (i = 0; i < jobs.length && ovNames.length < 4; i++) {
                for (j = 0; j < jobs[i].overlaps.length && ovNames.length < 4; j++) {
                    ovNames.push(shortName(jobs[i].overlaps[j][0]) + ' / ' + shortName(jobs[i].overlaps[j][1]));
                }
            }
            report += T('Chevauchements créés par le miroir, à vérifier : ', 'Overlaps created by the mirror, to check: ') + overlapTotal +
                ' (' + ovNames.join(' ; ') + (overlapTotal > ovNames.length ? ' …' : '') + ')\n';
        }
        if (created.length) { report += T('Nouveau(x) plan(s) de travail : ', 'New artboard(s): ') + created.length + '\n'; }
        if (stats.errors) { report += T('Erreurs : ', 'Errors: ') + stats.errors + (stats.errList.length ? ' (' + stats.errList.join(' ; ') + ')' : '') + '\n'; }
        report += '\n' + T('Vérifiez le résultat ; Ctrl/Cmd+Z annule.', 'Check the result; Ctrl/Cmd+Z undoes.');
        ui.alert(report);
        stats.jobs = jobs; stats.created = created; stats.offset = off; stats.overlaps = overlapTotal;
        return stats;
    }

    /* ================================================================== */
    /* INTERFACE SCRIPTUI / SCRIPTUI INTERFACE                             */
    /* ================================================================== */

    function settingsDialog(o, hasSel) {
        var w = new Window('dialog', T('Miroir RTL — version droite à gauche', 'RTL Mirror — right-to-left version') + ' v' + VERSION);
        var scopes = ['artboard', 'all', 'selection'], p, g, ddScope, rbCopy, rbPlace, ddAxis, cbAlign, cbRtl, cbRot;
        var cbFlip, cbGeom, etIcon, etDir, cbOpen, cbKeep, etTol, etFix, cbReview, i, btns, res, sIdx = 0;
        w.orientation = 'column'; w.alignChildren = ['fill', 'top'];

        p = w.add('panel', undefined, T('Portée et résultat', 'Scope and result')); p.alignChildren = ['left', 'top'];
        g = p.add('group'); g.add('statictext', undefined, T('Portée :', 'Scope:'));
        ddScope = g.add('dropdownlist', undefined, [T('Plan de travail actif', 'Active artboard'), T('Tous les plans de travail', 'All artboards'), T('Sélection', 'Selection')]);
        for (i = 0; i < scopes.length; i++) { if (scopes[i] === o.scope) { sIdx = i; } }
        if (o.scope === 'selection' && !hasSel) { sIdx = 0; }
        if (hasSel && o.scope !== 'all') { sIdx = 2; }
        ddScope.selection = sIdx;
        rbCopy = p.add('radiobutton', undefined, T('Créer une copie miroir à droite (l\'original reste intact) — conseillé', 'Create a mirrored copy to the right (original untouched) — advised'));
        rbPlace = p.add('radiobutton', undefined, T('Modifier sur place', 'Modify in place'));
        rbCopy.value = o.mode !== 'place'; rbPlace.value = o.mode === 'place';
        g = p.add('group'); g.add('statictext', undefined, T('Axe (sélection modifiée sur place) :', 'Axis (selection, in place):'));
        ddAxis = g.add('dropdownlist', undefined, [T('Centre du plan de travail', 'Artboard centre'), T('Centre de la sélection', 'Selection centre')]);
        ddAxis.selection = o.selAxis === 'selection' ? 1 : 0;

        p = w.add('panel', undefined, T('Textes', 'Text')); p.alignChildren = ['left', 'top'];
        cbAlign = p.add('checkbox', undefined, T('Inverser l\'alignement (gauche ↔ droite) et les retraits', 'Swap alignment (left ↔ right) and indents'));
        cbRot = p.add('checkbox', undefined, T('Inverser l\'inclinaison des textes tournés (θ → −θ)', 'Reverse tilt of rotated text (θ → −θ)'));
        cbRtl = p.add('checkbox', undefined, T('Passer les paragraphes en direction RTL (Illustrator « Moyen-Orient »)', 'Set paragraph direction to RTL (Middle Eastern Illustrator)'));
        cbAlign.value = o.swapAlign; cbRot.value = o.unrotate; cbRtl.value = o.rtlDir;

        p = w.add('panel', undefined, T('Pictos directionnels', 'Directional icons')); p.alignChildren = ['left', 'top'];
        cbFlip = p.add('checkbox', undefined, T('Retourner les flèches, chevrons… (les autres objets restent à l\'endroit)', 'Flip arrows, chevrons… (other objects stay unflipped)'));
        g = p.add('group');
        cbGeom = g.add('checkbox', undefined, T('Les reconnaître aussi par leur forme, jusqu\'à', 'Also recognise them by shape, up to'));
        etIcon = g.add('edittext', undefined, String(o.iconMax)); etIcon.characters = 4;
        g.add('statictext', undefined, T('% du plan de travail', '% of the artboard'));
        p.add('statictext', undefined, T('Mots-clés dans les noms (calques, symboles) :', 'Keywords in names (layers, symbols):'));
        etDir = p.add('edittext', undefined, o.dirKeywords); etDir.characters = 60;
        cbFlip.value = o.flipDirectional; cbGeom.value = o.geometry;

        p = w.add('panel', undefined, T('Blocs', 'Blocks')); p.alignChildren = ['left', 'top'];
        cbOpen = p.add('checkbox', undefined, T('Réordonner l\'intérieur des groupes qui contiennent du texte (puce + texte, boutons, cartes)', 'Reorder inside groups containing text (bullet + text, buttons, cards)'));
        g = p.add('group');
        cbKeep = g.add('checkbox', undefined, T('Garder ensemble les formes non groupées qui se touchent, tolérance', 'Keep touching ungrouped shapes together, tolerance'));
        etTol = g.add('edittext', undefined, String(o.tolerance)); etTol.characters = 4; g.add('statictext', undefined, 'pt');
        p.add('statictext', undefined, T('Blocs jamais réordonnés ni retournés (mots-clés dans les noms) :', 'Blocks never reordered nor flipped (keywords in names):'));
        etFix = p.add('edittext', undefined, o.fixKeywords); etFix.characters = 60;
        p.add('statictext', undefined, T('Balises dans le nom : #fixe (bloc rigide), #miroir (toujours retourné), #reste (ne bouge pas)', 'Name tags: #keep (rigid), #flip (always flipped), #stay (does not move)'));
        cbOpen.value = o.openGroups; cbKeep.value = o.keepTogether;

        cbReview = w.add('checkbox', undefined, T('Afficher la liste des pictos à retourner avant d\'appliquer', 'Show the list of icons to flip before applying'));
        cbReview.value = o.review;
        w.add('statictext', undefined, T('Conseil : travaillez sur une copie du fichier. Ctrl/Cmd+Z annule.', 'Tip: work on a copy of the file. Ctrl/Cmd+Z undoes.'));

        function sync() {
            var isSel = ddScope.selection && ddScope.selection.index === 2;
            ddAxis.enabled = isSel && rbPlace.value;
            cbGeom.enabled = cbFlip.value; etIcon.enabled = cbFlip.value && cbGeom.value; etDir.enabled = cbFlip.value;
            etTol.enabled = cbKeep.value;
        }
        ddScope.onChange = sync; rbCopy.onClick = sync; rbPlace.onClick = sync; cbFlip.onClick = sync; cbGeom.onClick = sync; cbKeep.onClick = sync;
        sync();

        btns = w.add('group'); btns.alignment = 'right';
        btns.add('button', undefined, T('Annuler', 'Cancel'), { name: 'cancel' });
        btns.add('button', undefined, T('Continuer', 'Continue'), { name: 'ok' });
        if (w.show() !== 1) { return null; }
        res = {};
        for (i in o) { if (o.hasOwnProperty(i)) { res[i] = o[i]; } }
        res.scope = scopes[ddScope.selection ? ddScope.selection.index : 0];
        res.mode = rbPlace.value ? 'place' : 'copy';
        res.selAxis = ddAxis.selection && ddAxis.selection.index === 1 ? 'selection' : 'artboard';
        res.swapAlign = cbAlign.value; res.unrotate = cbRot.value; res.rtlDir = cbRtl.value;
        res.flipDirectional = cbFlip.value; res.geometry = cbGeom.value;
        res.iconMax = Math.max(1, Math.min(100, num(etIcon.text, o.iconMax)));
        res.dirKeywords = etDir.text; res.openGroups = cbOpen.value; res.keepTogether = cbKeep.value;
        res.tolerance = Math.max(0, num(etTol.text, o.tolerance)); res.fixKeywords = etFix.text; res.review = cbReview.value;
        return res;
    }

    function unitLabel(u) {
        var m = u.members[0], nm = m.name || m.symbolName || '', kind = m.typename || m.kind;
        var w = Math.round(bw(u.box) / MM * 10) / 10, h = Math.round(bh(u.box) / MM * 10) / 10;
        var why = u.reason === 'tag' ? T('balise', 'tag') : u.reason === 'name' ? T('nom « ', 'name "') + u.hit + T(' »', '"') : T('forme', 'shape');
        if (!nm) { nm = '<' + kind + (u.members.length > 1 ? ' ×' + u.members.length : '') + '>'; }
        return nm + '  —  ' + w + ' × ' + h + ' mm  —  ' + why;
    }

    // Liste à valider : pictos proposés au retournement / review list of icons proposed for flipping
    function reviewDialog(jobs, o, skippedLayers) {
        var w = new Window('dialog', T('Miroir RTL — vérification', 'RTL Mirror — review')), rows = [], i, j, u, lb;
        var nText = 0, nRigid = 0, nStay = 0, nSkip = 0, opened = 0, g, bOn, bOff, nOv = 0;
        for (i = 0; i < jobs.length; i++) {
            opened += jobs[i].plan.opened; nSkip += jobs[i].plan.skipped.length; nOv += jobs[i].overlaps ? jobs[i].overlaps.length : 0;
            for (j = 0; j < jobs[i].plan.units.length; j++) {
                u = jobs[i].plan.units[j];
                if (u.kind === 'text') { nText++; } else if (u.kind === 'stay') { nStay++; } else { nRigid++; }
                if (u.kind === 'rigid' && (u.flip || u.forced)) { rows.push(u); }
            }
        }
        w.alignChildren = ['fill', 'top'];
        w.add('statictext', undefined, T('Textes à réaligner : ', 'Texts to realign: ') + nText + '   ' +
            T('Blocs à déplacer : ', 'Blocks to move: ') + nRigid + '   ' + T('Groupes réordonnés : ', 'Groups reordered: ') + opened +
            (nStay ? '   #reste : ' + nStay : '') + (nSkip ? '   ' + T('Verrouillés ignorés : ', 'Locked skipped: ') + nSkip : ''));
        if (nOv) { w.add('statictext', undefined, T('Attention : ', 'Warning: ') + nOv + T(' chevauchement(s) créé(s) par le miroir (blocs non groupés en L ?). Groupez-les ou ajoutez #fixe, ou vérifiez après.', ' overlap(s) created by the mirror (L-shaped ungrouped blocks?). Group them or add #keep, or check afterwards.')); }
        if (skippedLayers.length) { w.add('statictext', undefined, T('Calques ignorés : ', 'Skipped layers: ') + skippedLayers.join(', ')); }
        w.add('statictext', undefined, rows.length ? T('Pictos qui seront retournés (☑). Sélectionnez des lignes puis cliquez un bouton pour changer :', 'Icons to be flipped (☑). Select rows then click a button to change:') :
            T('Aucun picto directionnel trouvé : tout sera déplacé sans être retourné.', 'No directional icon found: everything will be moved without flipping.'));
        lb = w.add('listbox', undefined, [], { multiselect: true });
        lb.preferredSize = [560, Math.min(320, 40 + rows.length * 20)];
        function label(r) { return (r.flip ? '☑  ' : '☐  ') + unitLabel(r); }
        for (i = 0; i < rows.length; i++) { lb.add('item', label(rows[i])); }
        function setSel(v) {
            var k;
            for (k = 0; k < lb.items.length; k++) { if (lb.items[k].selected) { rows[k].flip = v; lb.items[k].text = label(rows[k]); } }
        }
        g = w.add('group');
        bOn = g.add('button', undefined, T('Retourner', 'Flip')); bOff = g.add('button', undefined, T('Ne pas retourner', 'Do not flip'));
        bOn.onClick = function () { setSel(true); }; bOff.onClick = function () { setSel(false); };
        lb.onDoubleClick = function () {
            var k;
            for (k = 0; k < lb.items.length; k++) { if (lb.items[k].selected) { rows[k].flip = !rows[k].flip; lb.items[k].text = label(rows[k]); } }
        };
        bOn.enabled = bOff.enabled = rows.length > 0;
        g = w.add('group'); g.alignment = 'right';
        g.add('button', undefined, T('Annuler', 'Cancel'), { name: 'cancel' });
        g.add('button', undefined, T('Appliquer', 'Apply'), { name: 'ok' });
        return w.show() === 1;
    }

    function main() {
        var doc, o, hasSel;
        if (app.documents.length === 0) {
            alert(T('Aucun document ouvert.\nOuvrez la mise en page à inverser, puis relancez Miroir RTL.', 'No open document.\nOpen the layout to mirror, then run RTL Mirror again.'));
            return;
        }
        doc = app.activeDocument;
        hasSel = selectionItems(doc).length > 0;
        o = settingsDialog(loadCfg(), hasSel);
        if (!o) { return; }
        saveCfg(o);
        if (o.scope === 'selection' && !hasSel) {
            alert(T('Rien n\'est sélectionné.\nSélectionnez les objets à inverser, ou choisissez la portée « Plan de travail actif ».', 'Nothing is selected.\nSelect the objects to mirror, or choose the "Active artboard" scope.'));
            return;
        }
        run(doc, o, { alert: function (s) { alert(s); }, review: reviewDialog });
    }

    return {
        VERSION: VERSION, T: T, setLang: setLang,
        normBox: normBox, bw: bw, bh: bh, bcx: bcx, bcy: bcy, unionBox: unionBox, mirrorDx: mirrorDx, boxGap: boxGap,
        containsBox: containsBox, centerInside: centerInside, fold: fold, parseTag: parseTag, parseKeywords: parseKeywords,
        keywordHit: keywordHit, flattenPath: flattenPath, resampleParts: resampleParts, shapeIsDirectional: shapeIsDirectional, symmetryScores: symmetryScores,
        isDirectional: isDirectional, swapJustName: swapJustName, rotationOf: rotationOf, normAngle: normAngle,
        clusterBoxes: clusterBoxes, plan: plan, newOverlaps: newOverlaps, copyOffsets: copyOffsets, defaults: defaults, serialize: serialize,
        deserialize: deserialize, DEFAULT_DIR_KEYWORDS: DEFAULT_DIR_KEYWORDS, DEFAULT_FIX_KEYWORDS: DEFAULT_FIX_KEYWORDS,
        nodeFromItem: nodeFromItem, getPolys: getPolys, collectJobs: collectJobs, run: run, main: main
    };
})();

if (typeof MRTL_NO_AUTORUN === 'undefined') { MRTL.main(); }
