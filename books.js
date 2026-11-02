// Books of the Bible the game can read. Matthew uses the original data files; the others use books/q-*.js.
// November 2026: everyone reads Mark (the default book). Luke opens in December: remove its `soon` line then.
// Loaded after content.js and before app.js.
const BOOKS = [
  { id: 'matthew', name: 'Matthew', n: 28, color: '#c86354', blurb: 'Jesus the promised King' },
  { id: 'mark', name: 'Mark', n: 16, color: '#59877d', blurb: 'Jesus the fast-moving servant' },
  { id: 'luke', name: 'Luke', n: 24, color: '#a28fbc', blurb: 'Jesus who came for everyone', soon: 'Coming soon' }
];
const DEFAULT_BOOK = 'mark';
const BOOK_BASE = () => (window.V3_BASE || '');
const curBookId = p => (p && BOOKS.some(b => b.id === p.book) && !bookInfo(p.book).soon ? p.book : DEFAULT_BOOK);
const bookInfo = id => BOOKS.find(b => b.id === id) || BOOKS[0];
const curBook = p => bookInfo(curBookId(p));
function bookDone(p, id = curBookId(p)) {
  if (id === 'matthew') return p.completed;
  p.books = p.books || {};
  const b = p.books[id] = p.books[id] || {};
  b.completed = Array.isArray(b.completed) ? b.completed : [];
  return b.completed;
}
const totalChapters = p => BOOKS.reduce((n, b) => n + bookDone(p, b.id).length, 0);
const matthewDone = p => p.completed.length >= 28;
const _qCache = {}, _v3Cache = {};
function bookQ(id) {
  if (id === 'matthew') return QUESTIONS;
  if (!_qCache[id]) { const src = window.BOOK_Q?.[id] || {}; _qCache[id] = Array.from({ length: bookInfo(id).n }, (_, i) => { const c = src[i + 1] || {}; return { verse: c.v || 1, title: c.t || '', little: c.l || [], big: c.b || [] }; }); }
  return _qCache[id];
}
function bookV3(id) {
  if (id === 'matthew') return typeof V3 !== 'undefined' ? V3 : {};
  if (!_v3Cache[id]) { const src = window.BOOK_Q?.[id] || {}, out = {}; for (const k in src) { const c = src[k]; out[k] = { order: c.o, who: c.w, tf: c.tf, fill: c.f, school: c.s }; } _v3Cache[id] = out; }
  return _v3Cache[id];
}
// Text files: Matthew's live in the site root; the other books in books/.
const bookTextKey = (code, id) => `${code}_${id.toUpperCase()}`;
const bookTextFile = (code, id) => id === 'matthew' ? `${code.toLowerCase()}-matthew.js` : `${BOOK_BASE()}books/${code.toLowerCase()}-${id}.js`;
function loadBookText(code, id) {
  const key = bookTextKey(code, id); if (window[key]) return Promise.resolve();
  return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = bookTextFile(code, id); s.onload = ok; s.onerror = bad; document.head.append(s); });
}
const chLabel = (id, n) => `${bookInfo(id).name} ${n}`;
// What the sheet gets for a chapter: a number for Matthew (as before), "Mark 3" for the other books.
const chForSheet = (id, n) => id === 'matthew' ? n : chLabel(id, n);
