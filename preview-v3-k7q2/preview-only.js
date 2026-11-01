// PREVIEW ONLY. This copy keeps its own saved progress (separate from the real app on the same device)
// and never sends anything to the Favor Kids sheet.
(() => {
  const P = 'rmb-preview:', S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem;
  S.getItem = function (k) { return g.call(this, P + k); };
  S.setItem = function (k, v) { return s.call(this, P + k, v); };
  S.removeItem = function (k) { return r.call(this, P + k); };
  Object.defineProperty(window, 'FKQ_SYNC_URL', { get: () => '', set: () => { }, configurable: false });
  window.V3_BASE = 'preview-v3-k7q2/';
})();
