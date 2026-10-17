// Charge MiroirRTL.jsx dans Node sans lancer main() / loads the script without running main()
var fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function load(globals) {
    var src = fs.readFileSync(process.env.MRTL_SRC || path.join(__dirname, '..', 'MiroirRTL.jsx'), 'utf8').replace(/^\uFEFF/, '');
    var ctx = Object.assign({ MRTL_NO_AUTORUN: true, Math: Math, String: String, parseFloat: parseFloat, isNaN: isNaN, Infinity: Infinity, Error: Error }, globals || {});
    if (!ctx.app) { ctx.app = { locale: 'fr_FR' }; }
    vm.createContext(ctx);
    vm.runInContext(src + '\n;this.MRTL = MRTL;', ctx, { filename: 'MiroirRTL.jsx' });
    return ctx;
};
