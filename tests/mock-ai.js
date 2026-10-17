// DOM Illustrator simulé (minimal) pour tester MiroirRTL.jsx de bout en bout.
// Minimal simulated Illustrator DOM: paths, compound paths, groups (clip), images, symbols,
// point/area text (justification moves point text around its anchor, rotation, matrix),
// threaded frames, layers, artboards (with a canvas limit), duplicate/translate/resize/rotate.
var MATRIX_SIGN = { v: 1 };
var CANVAS = { limit: 8000 };
var log = { resize: 0, rotate: 0, duplicate: 0, translate: 0 };

function E(name) { return { _n: name, toString: function () { return 'Justification.' + name; } }; }
var Justification = { LEFT: E('LEFT'), RIGHT: E('RIGHT'), CENTER: E('CENTER'), FULLJUSTIFY: E('FULLJUSTIFY'),
    FULLJUSTIFYLASTLINELEFT: E('FULLJUSTIFYLASTLINELEFT'), FULLJUSTIFYLASTLINERIGHT: E('FULLJUSTIFYLASTLINERIGHT'), FULLJUSTIFYLASTLINECENTER: E('FULLJUSTIFYLASTLINECENTER') };
var ElementPlacement = { PLACEBEFORE: 'PLACEBEFORE', PLACEAFTER: 'PLACEAFTER' };
var Transformation = { CENTER: 'CENTER' };
var TextType = { POINTTEXT: 'POINTTEXT', AREATEXT: 'AREATEXT', PATHTEXT: 'PATHTEXT' };
var TextOrientation = { HORIZONTAL: 'HORIZONTAL', VERTICAL: 'VERTICAL' };
var ParagraphDirectionType = { RIGHT_TO_LEFT_DIRECTION: 'RTL', LEFT_TO_RIGHT_DIRECTION: 'LTR' };

function bounds(pts) {
    var l = Infinity, r = -Infinity, t = -Infinity, b = Infinity;
    pts.forEach(function (p) { l = Math.min(l, p[0]); r = Math.max(r, p[0]); t = Math.max(t, p[1]); b = Math.min(b, p[1]); });
    return [l, t, r, b];
}
function rot(p, deg, o) { var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * c - y * s, o[1] + x * s + y * c]; }
function insertAt(container, item, idx) { container.items.splice(idx, 0, item); item.parent = container; }
function detach(item) { var p = item.parent, i; if (!p) { return; } i = p.items.indexOf(item); if (i >= 0) { p.items.splice(i, 1); } }

function Base(typename) { this.typename = typename; this.name = ''; this.locked = false; this.hidden = false; this.parent = null; }
Base.prototype.remove = function () { detach(this); this.removed = true; };
Base.prototype.duplicate = function (rel, placement) {
    var c = this.clone(), p = rel.parent, i = p.items.indexOf(rel);
    log.duplicate++;
    insertAt(p, c, placement === 'PLACEAFTER' ? i + 1 : i);
    return c;
};
Base.prototype.translate = function (dx, dy) {
    if (this.locked) { throw new Error('locked item'); }
    log.translate++; this.shift(dx, dy || 0);
};
Base.prototype.copyBase = function (c) { c.name = this.name; c.locked = this.locked; c.hidden = this.hidden; return c; };

// ----- PathItem -----
function PathItem(pts, closed) { Base.call(this, 'PathItem'); this.pts = pts.map(function (p) { return [p[0], p[1]]; }); this.closed = closed !== false; this.guides = false; this.clipping = false; }
PathItem.prototype = Object.create(Base.prototype);
Object.defineProperty(PathItem.prototype, 'pathPoints', { get: function () { return this.pts.map(function (p) { return { anchor: [p[0], p[1]], leftDirection: [p[0], p[1]], rightDirection: [p[0], p[1]] }; }); } });
Object.defineProperty(PathItem.prototype, 'geometricBounds', { get: function () { return bounds(this.pts); } });
Object.defineProperty(PathItem.prototype, 'visibleBounds', { get: function () { return bounds(this.pts); } });
PathItem.prototype.shift = function (dx, dy) { this.pts = this.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; }); };
PathItem.prototype.reflect = function (cx) { this.pts = this.pts.map(function (p) { return [2 * cx - p[0], p[1]]; }); };
PathItem.prototype.allPts = function () { return this.pts; };
PathItem.prototype.clone = function () { var c = new PathItem(this.pts, this.closed); c.clipping = this.clipping; c.guides = this.guides; return this.copyBase(c); };

// ----- Conteneurs / containers -----
function Container(typename, children) { Base.call(this, typename); this.items = []; var self = this; (children || []).forEach(function (c) { insertAt(self, c, self.items.length); }); }
Container.prototype = Object.create(Base.prototype);
Object.defineProperty(Container.prototype, 'pageItems', { get: function () { return this.items; } });
Container.prototype.allPts = function () { var a = []; this.items.forEach(function (c) { a = a.concat(c.allPts()); }); return a; };
Object.defineProperty(Container.prototype, 'geometricBounds', { get: function () { return bounds(this.allPts()); } });
Object.defineProperty(Container.prototype, 'visibleBounds', { get: function () { return bounds(this.allPts()); } });
Container.prototype.shift = function (dx, dy) { this.items.forEach(function (c) { c.shift(dx, dy); }); };
Container.prototype.reflect = function (cx) { this.items.forEach(function (c) { c.reflect(cx); }); };

function GroupItem(children, clipped) { Container.call(this, 'GroupItem', children); this.clipped = !!clipped; }
GroupItem.prototype = Object.create(Container.prototype);
Object.defineProperty(GroupItem.prototype, 'textFrames', { get: function () { return this.items.filter(function (c) { return c.typename === 'TextFrame'; }); } });
Object.defineProperty(GroupItem.prototype, 'groupItems', { get: function () { return this.items.filter(function (c) { return c.typename === 'GroupItem'; }); } });
GroupItem.prototype.clone = function () { return this.copyBase(new GroupItem(this.items.map(function (c) { return c.clone(); }), this.clipped)); };

function CompoundPathItem(paths) { Container.call(this, 'CompoundPathItem', paths); }
CompoundPathItem.prototype = Object.create(Container.prototype);
Object.defineProperty(CompoundPathItem.prototype, 'pathItems', { get: function () { return this.items; } });
CompoundPathItem.prototype.clone = function () { return this.copyBase(new CompoundPathItem(this.items.map(function (c) { return c.clone(); }))); };

[PathItem, GroupItem, CompoundPathItem].forEach(function (K) {
    K.prototype.resize = function (sx, sy, a, b, c, d, lw, about) {
        if (this.locked) { throw new Error('locked item'); }
        log.resize++;
        if (sx === -100 && sy === 100 && about === 'CENTER') { var vb = this.visibleBounds; this.reflect((vb[0] + vb[2]) / 2); }
        else { throw new Error('unsupported resize in mock'); }
    };
});

// ----- Images & symboles / images & symbols -----
function BoxItem(typename, box) { Base.call(this, typename); this.box = box.slice(); this.flips = 0; }
BoxItem.prototype = Object.create(Base.prototype);
Object.defineProperty(BoxItem.prototype, 'geometricBounds', { get: function () { return this.box.slice(); } });
Object.defineProperty(BoxItem.prototype, 'visibleBounds', { get: function () { return this.box.slice(); } });
BoxItem.prototype.shift = function (dx, dy) { this.box = [this.box[0] + dx, this.box[1] + dy, this.box[2] + dx, this.box[3] + dy]; };
BoxItem.prototype.reflect = function (cx) { this.box = [2 * cx - this.box[2], this.box[1], 2 * cx - this.box[0], this.box[3]]; this.flips++; };
BoxItem.prototype.allPts = function () { return [[this.box[0], this.box[1]], [this.box[2], this.box[3]]]; };
BoxItem.prototype.resize = function (sx, sy, a, b, c, d, lw, about) { log.resize++; var cx = (this.box[0] + this.box[2]) / 2; this.reflect(cx); };
BoxItem.prototype.clone = function () { var c = new BoxItem(this.typename, this.box); c.flips = this.flips; if (this.symbol) { c.symbol = this.symbol; } return this.copyBase(c); };
function PlacedItem(box) { return new BoxItem('PlacedItem', box); }
function SymbolItem(box, sym) { var s = new BoxItem('SymbolItem', box); s.symbol = { name: sym }; return s; }

// ----- Texte / text -----
function Para(just, li, ri) { this.paragraphAttributes = { justification: just, leftIndent: li || 0, rightIndent: ri || 0 }; }
function TextFrame(opts) {
    Base.call(this, 'TextFrame');
    this.kind = opts.kind || TextType.POINTTEXT; this.orientation = opts.orientation || TextOrientation.HORIZONTAL;
    this.contents = opts.contents || 'Texte';
    this.anchor = (opts.anchor || [0, 0]).slice(); this.w = opts.w || 100; this.h = opts.h || 20; this.angle = opts.angle || 0;
    this.areaBox = opts.box ? opts.box.slice() : null;
    this.paragraphs = (opts.paras || [new Para(Justification.LEFT)]);
    this.previousFrame = null; this.nextFrame = null;
}
TextFrame.prototype = Object.create(Base.prototype);
TextFrame.prototype.corners = function () {
    if (this.areaBox) { var b = this.areaBox; return [[b[0], b[1]], [b[2], b[3]]]; }
    var j = String(this.paragraphs[0].paragraphAttributes.justification).replace(/^.*\./, ''), x0, x1, a = this.anchor, self = this;
    if (j === 'RIGHT' || j === 'FULLJUSTIFYLASTLINERIGHT') { x0 = -this.w; x1 = 0; } else if (j === 'CENTER') { x0 = -this.w / 2; x1 = this.w / 2; } else { x0 = 0; x1 = this.w; }
    return [[a[0] + x0, a[1]], [a[0] + x1, a[1]], [a[0] + x1, a[1] + this.h], [a[0] + x0, a[1] + this.h]].map(function (p) { return rot(p, self.angle, a); });
};
Object.defineProperty(TextFrame.prototype, 'geometricBounds', { get: function () { return bounds(this.corners()); } });
Object.defineProperty(TextFrame.prototype, 'visibleBounds', { get: function () { return bounds(this.corners()); } });
Object.defineProperty(TextFrame.prototype, 'matrix', { get: function () { var a = this.angle * Math.PI / 180, s = MATRIX_SIGN.v; return { mValueA: Math.cos(a), mValueB: s * Math.sin(a), mValueC: -s * Math.sin(a), mValueD: Math.cos(a), mValueTX: 0, mValueTY: 0 }; } });
Object.defineProperty(TextFrame.prototype, 'story', { get: function () { var h = this; while (h.previousFrame) { h = h.previousFrame; } var all = []; while (h) { all = all.concat(h.paragraphs); h = h.nextFrame; } return { paragraphs: all }; } });
TextFrame.prototype.shift = function (dx, dy) { this.anchor = [this.anchor[0] + dx, this.anchor[1] + dy]; if (this.areaBox) { var b = this.areaBox; this.areaBox = [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]; } };
TextFrame.prototype.reflect = function (cx) { this.mirroredGlyphs = !this.mirroredGlyphs; this.shift(2 * cx - 2 * ((this.geometricBounds[0] + this.geometricBounds[2]) / 2), 0); };
TextFrame.prototype.allPts = function () { return this.corners(); };
TextFrame.prototype.rotate = function (deg, a, b, c, d, about) {
    if (this.locked) { throw new Error('locked item'); }
    log.rotate++; var gb = this.geometricBounds, o = [(gb[0] + gb[2]) / 2, (gb[1] + gb[3]) / 2];
    this.anchor = rot(this.anchor, deg, o); this.angle += deg;
    while (this.angle > 180) { this.angle -= 360; } while (this.angle <= -180) { this.angle += 360; }
};
TextFrame.prototype.clone = function () {
    var c = new TextFrame({ kind: this.kind, orientation: this.orientation, contents: this.contents, anchor: this.anchor, w: this.w, h: this.h, angle: this.angle, box: this.areaBox,
        paras: this.paragraphs.map(function (p) { var q = p.paragraphAttributes; var n = new Para(q.justification, q.leftIndent, q.rightIndent); if (q.paragraphDirection) { n.paragraphAttributes.paragraphDirection = q.paragraphDirection; } return n; }) });
    return this.copyBase(c);
};

// ----- Calques, plans de travail, document / layers, artboards, document -----
function Layer(name, children, sub) { Container.call(this, 'Layer', children); this.name = name; this.visible = true; this.locked = false; this.layers = sub || []; }
Layer.prototype = Object.create(Container.prototype);
function Artboard(rect, name) { this.artboardRect = rect.slice(); this.name = name || 'Plan de travail'; }
function Document(layers, abs) {
    var self = this;
    this.layers = layers; this.selection = [];
    this.artboards = abs.map(function (a) { return new Artboard(a[0], a[1]); });
    this.artboards.active = 0;
    this.artboards.getActiveArtboardIndex = function () { return self.artboards.active; };
    this.artboards.add = function (rect) {
        rect.forEach(function (v) { if (Math.abs(v) > CANVAS.limit) { throw new Error('canvas'); } });
        var ab = new Artboard(rect, 'Plan de travail ' + (self.artboards.length + 1));
        ab.remove = function () { var i = self.artboards.indexOf(ab); if (i >= 0) { self.artboards.splice(i, 1); } };
        self.artboards.push(ab); return ab;
    };
}

module.exports = { MATRIX_SIGN: MATRIX_SIGN, CANVAS: CANVAS, log: log, Justification: Justification, ElementPlacement: ElementPlacement, Transformation: Transformation,
    TextType: TextType, TextOrientation: TextOrientation, ParagraphDirectionType: ParagraphDirectionType, PathItem: PathItem, GroupItem: GroupItem,
    CompoundPathItem: CompoundPathItem, PlacedItem: PlacedItem, SymbolItem: SymbolItem, TextFrame: TextFrame, Para: Para, Layer: Layer, Document: Document, bounds: bounds };
