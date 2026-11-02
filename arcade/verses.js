// Verse checkpoints shared by the Arcade games.
//  RMBVerse.chapterQuiz({title})  → a verse from the chapter the kid read today, with one missing word. Resolves true when answered.
//  RMBVerse.memoryQuiz({title})   → this week's memory verse with missing words (used to earn an extra life).
// Reads the kid's progress from the app on this device (same site). Falls back to Mark 1 when there is no profile.
(() => {
  const STORE = 'matthew-quest-v1';
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (k, n) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n); return dateKey(d); };
  const NAMES = { matthew: 'Matthew', mark: 'Mark', luke: 'Luke', john: 'John', acts: 'Acts' };
  function profile() { try { const s = JSON.parse(localStorage.getItem(STORE)); return s.profiles.find(p => p.id === s.currentId) || null; } catch { return null; } }
  function todaysChapter() {
    const q = new URLSearchParams(location.search), qb = q.get('book'), qc = Number(q.get('ch'));
    if (qb && NAMES[qb] && qc) return { book: qb, ch: qc };
    const p = profile();
    if (p && p.dailyPass) {
      const days = Object.keys(p.dailyPass).sort(), today = dateKey(new Date());
      const day = p.dailyPass[today] != null ? today : days[days.length - 1];
      if (day) { const book = (p.dailyBook && p.dailyBook[day]) || (p.book && NAMES[p.book] ? p.book : 'matthew'); return { book, ch: Number(p.dailyPass[day]) || 1 }; }
    }
    return { book: 'mark', ch: 1 };
  }
  const loaded = {};
  function load(src) { if (loaded[src]) return loaded[src]; return (loaded[src] = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.append(s); })); }
  async function chapterText(book, ch) {
    const key = `WEB_${book.toUpperCase()}`;
    if (!window[key]) await load(book === 'matthew' ? '../web-matthew.js' : `../books/web-${book}.js`).catch(() => { });
    return (window[key] || {})[ch] || [];
  }
  const STOP = new Set('the and that with for from into unto they them their there then this have has had was were will shall said says your you yours our who whom what when where which while not but his her him she are all one out him also because about over upon very much many some than more most those these being been would could should does did do lord'.split(' '));
  const clean = w => w.replace(/[“”"‘’'.,;:!?()]/g, '');
  const shuf = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  function pickWords(words, n, pool) {
    const idx = words.map((w, i) => [clean(w), i]).filter(([c]) => c.length >= 4 && !STOP.has(c.toLowerCase()) && /^[A-Za-z]+$/.test(c));
    const chosen = shuf(idx).slice(0, n).sort((a, b) => a[1] - b[1]);
    return chosen.map(([c, i]) => {
      const others = shuf([...new Set(pool.filter(w => w.toLowerCase() !== c.toLowerCase() && Math.abs(w.length - c.length) <= 3))]).slice(0, 2);
      while (others.length < 2) others.push(['light', 'heart', 'bread', 'river', 'happy', 'mountain'][others.length + Math.floor(Math.random() * 3)]);
      return { i, answer: c, options: shuf([c, ...others]) };
    });
  }
  // ---------- UI ----------
  const css = `.rv-wrap{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(41,70,74,.86);padding:16px;font-family:FavorSans,'Trebuchet MS',system-ui,sans-serif}
.rv-card{background:#fff8eb;color:#29464a;border-radius:24px;border:4px solid #fff;box-shadow:0 10px 0 #c86354;max-width:520px;width:100%;padding:20px 20px 18px;text-align:center;animation:rvpop .35s cubic-bezier(.3,1.6,.5,1)}
@keyframes rvpop{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}
.rv-k{font-weight:700;letter-spacing:.14em;font-size:12px;color:#c86354}
.rv-t{font:400 34px/1 Agharti,Impact,sans-serif;text-transform:uppercase;margin:4px 0 10px;color:#29464a}
.rv-v{font-size:19px;line-height:1.5;background:#fbe8ca;border-radius:16px;padding:12px 14px;margin:0 0 6px}
.rv-v b{display:inline-block;min-width:70px;border-bottom:3px solid #c86354;color:#c86354}
.rv-v b.ok{border-color:#59877d;color:#59877d}
.rv-ref{font-size:13px;color:#6e7775;margin-bottom:12px}
.rv-opts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.rv-o{font:700 18px FavorSans,'Trebuchet MS',sans-serif;border:3px solid #ecd4b7;background:#fff;border-radius:14px;padding:10px 16px;cursor:pointer;color:#29464a}
.rv-o.bad{border-color:#c86354;background:#fbe1da;animation:rvsh .35s}
@keyframes rvsh{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.rv-hint{font-size:13px;color:#6e7775;margin-top:10px;min-height:1.2em}
.rv-go{margin-top:12px;font:700 19px FavorSans,sans-serif;border:0;border-radius:16px;padding:12px 28px;background:#faa731;color:#29464a;box-shadow:0 5px 0 #d9861a;cursor:pointer}`;
  function ui(kicker, title, verseWords, blanks, ref, hint) {
    if (!document.getElementById('rv-css')) { const s = document.createElement('style'); s.id = 'rv-css'; s.textContent = css; document.head.append(s); }
    return new Promise(resolve => {
      const wrap = document.createElement('div'); wrap.className = 'rv-wrap';
      let k = 0;
      const render = () => {
        const shown = verseWords.map((w, i) => { const b = blanks.findIndex(x => x.i === i); if (b < 0) return w; const trail = w.slice(clean(w).length + (w.startsWith('“') ? 1 : 0)); const lead = w.startsWith('“') ? '“' : ''; return b < k ? `${lead}<b class="ok">${blanks[b].answer}</b>${trail}` : `${lead}<b>${b === k ? '?' : '&nbsp;'}</b>${trail}`; }).join(' ');
        const done = k >= blanks.length;
        wrap.innerHTML = `<div class="rv-card"><div class="rv-k">${kicker}</div><div class="rv-t">${title}</div><p class="rv-v">${shown}</p><div class="rv-ref">${ref}</div>${done ? `<div style="font-weight:700;color:#59877d">⭐ You got it! Say it out loud once.</div><button class="rv-go">Keep playing</button>` : `<div class="rv-opts">${blanks[k].options.map(o => `<button class="rv-o">${o}</button>`).join('')}</div><div class="rv-hint">${hint}</div>`}</div>`;
        wrap.querySelectorAll('.rv-o').forEach(b => b.onclick = () => { if (b.textContent.toLowerCase() === blanks[k].answer.toLowerCase()) { k++; render(); } else { b.classList.add('bad'); try { navigator.vibrate?.(40); } catch { } } });
        wrap.querySelector('.rv-go')?.addEventListener('click', () => { wrap.remove(); resolve(true); });
      };
      render(); document.body.append(wrap);
    });
  }
  async function chapterQuiz({ title = 'Next level!' } = {}) {
    const { book, ch } = todaysChapter(), verses = (await chapterText(book, ch)).filter(([, t]) => t.split(/\s+/).length >= 7 && t.split(/\s+/).length <= 32);
    if (!verses.length) return true;
    const [v, text] = verses[Math.floor(Math.random() * verses.length)], words = text.split(/\s+/);
    const pool = (await chapterText(book, ch)).flatMap(([, t]) => t.split(/\s+/).map(clean)).filter(w => w.length >= 4 && /^[A-Za-z]+$/.test(w));
    const blanks = pickWords(words, 1, pool); if (!blanks.length) return true;
    return ui(`FROM TODAY’S READING · ${NAMES[book].toUpperCase()} ${ch}`, title, words, blanks, `${NAMES[book]} ${ch}:${v}`, 'Tap the missing word to keep going.');
  }
  const MEMORY = [[5, 14, 0, 7], [6, 33, 0, 0], [7, 7, 0, 0], [11, 28, 0, 0], [22, 37, 4, 0], [28, 20, 10, 13], [4, 19, 4, 0], [5, 9, 0, 0]];
  async function memoryQuiz({ title = 'Extra life!' } = {}) {
    const today = dateKey(new Date()), sunday = addDays(today, -new Date(`${today}T12:00:00`).getDay());
    const wk = Math.max(0, Math.floor((new Date(`${sunday}T12:00:00`) - new Date('2026-10-11T12:00:00')) / 6048e5));
    const [ch, v, skip, take] = MEMORY[wk % MEMORY.length];
    const t = ((await chapterText('matthew', ch)).find(x => x[0] === v) || [, ''])[1].replace(/[“”‘]/g, '').replace(/’(?![a-z])/gi, '');
    let words = t.split(/\s+/).slice(skip); if (take) words = words.slice(0, take); if (!words.length) return true;
    const pool = (await chapterText('matthew', ch)).flatMap(([, x]) => x.split(/\s+/).map(clean)).filter(w => w.length >= 4 && /^[A-Za-z]+$/.test(w));
    const blanks = pickWords(words, Math.min(3, Math.max(2, Math.floor(words.length / 6))), pool);
    return ui('MEMORY VERSE OF THE WEEK', title, words, blanks, `Matthew ${ch}:${v}`, 'Fill in the memory verse to earn an extra life.');
  }
  window.RMBVerse = { chapterQuiz, memoryQuiz, todaysChapter };
})();
