// Read My Bible v3 — harder quizzes by age, stars, review, Light tokens, Arcade, sticker book,
// memory verse of the week, Sunday code word, grace-day streak, celebrations and HD Sky Run.
// Loaded after app.js and game.js. It wraps a few of their functions; saved progress is kept as is.
(() => {
  const V3_ON = true;
  if (!V3_ON || typeof V3 === 'undefined') return;

  // ---------- small helpers ----------
  const esc = s => escapeHtml(s);
  const buzz = p => { try { navigator.vibrate?.(p); } catch { } };
  const sfx = n => { try { SkyAudio.sfx(n); } catch { } };
  window.V3_hash = s => { let x = 5381; for (const c of String(s).toUpperCase().replace(/[^A-Z]/g, '')) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0; return x; };
  const tierOf = p => p.age <= 6 ? 'little' : p.age <= 9 ? 'mid' : 'big';
  const TIER_NAME = { little: 'Little Explorer', mid: 'Explorer', big: 'Deep Diver' };
  function v3(p) {
    p.v3 = p.v3 || {};
    const d = p.v3;
    d.light = Number(d.light || 0); d.stars = d.stars || {}; d.review = d.review || []; d.school = d.school || {};
    d.memory = d.memory || {}; d.sunday = d.sunday || {}; d.lifetime = Number(d.lifetime || 0);
    return d;
  }
  const addLight = (p, n) => { const d = v3(p); d.light += n; d.lifetime += n; save(); };
  const sundayOf = key => { const d = new Date(`${key}T12:00:00`); return addDays(key, -d.getDay()); };
  const weekIndex = () => Math.max(0, Math.floor((new Date(`${sundayOf(todayKey())}T12:00:00`) - new Date('2026-10-11T12:00:00')) / 6048e5));
  const cleanVerse = t => t.replace(/[“”‘]/g, '').replace(/’(?![a-z])/gi, '');
  const webVerse = (ch, v, id = 'matthew') => ((window[bookTextKey('WEB', id)]?.[ch] || []).find(x => x[0] === v) || [, ''])[1];
  const BK = () => curBookId(profile());
  const sKey = (id, ch) => id === 'matthew' ? ch : `${id}:${ch}`;   // stars / school bonus keys (Matthew keeps plain numbers)

  // ---------- grace-day streak: one missed day per week doesn't break the fire ----------
  window.streak = function (p) {
    let day = todayKey(), count = 0, lastGrace = -99, fromYesterday = false;
    if (p.dailyPass[day] == null) { day = addDays(day, -1); fromYesterday = true; }
    for (let guard = 0; guard < 800; guard++) {
      if (p.dailyPass[day] != null) { count++; day = addDays(day, -1); continue; }
      const prev = addDays(day, -1);
      if ((count > 0 || fromYesterday) && p.dailyPass[prev] != null && count - lastGrace >= 7) { lastGrace = count; day = prev; continue; }
      break;
    }
    return count;
  };

  // ---------- building questions ----------
  const shuf = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  function makeQ(ch, kind, i, id = BK()) {
    const c = bookV3(id)[ch], base = bookQ(id)[ch - 1];
    if (!c || !base) return null;
    if (kind === 'little' || kind === 'big') { const r = base[kind][i]; return { kind, i, ch, id, label: 'QUICK QUESTION', prompt: r[0], correct: r[1], answers: shuf(r.slice(1)) }; }
    if (kind === 'tf') return { kind, ch, id, label: 'TRUE OR FALSE?', prompt: c.tf[0], correct: c.tf[1] ? 'True' : 'False', answers: ['True', 'False'], explain: c.tf[2] };
    if (kind === 'who') return { kind, ch, id, label: 'WHO SAID IT?', prompt: `“${c.who[0]}”`, correct: c.who[1], answers: shuf(c.who.slice(1)), quote: true };
    if (kind === 'fill') {
      const [v, word, ...wrong] = c.fill, text = cleanVerse(webVerse(ch, v, id));
      if (!text) return null;
      const blanked = text.replace(new RegExp(`\\b${word}\\b`), '_____');
      return { kind, ch, id, label: 'FINISH THE VERSE', prompt: blanked, ref: `${bookInfo(id).name} ${ch}:${v}`, correct: word, answers: shuf([word, ...wrong]), verse: true };
    }
    if (kind === 'order') return { kind, ch, id, label: 'PUT IT IN ORDER', type: 'order', prompt: 'Tap the events in the order they happened.', items: c.order.slice(), shuffled: shufNotSame(c.order) };
  }
  function shufNotSame(a) { let s; do { s = shuf(a); } while (a.length > 1 && s.every((x, i) => x === a[i])); return s; }
  function quizPlan(p, ch) { return quizPlanRaw(p, ch).filter(Boolean); }
  function quizPlanRaw(p, ch) {
    const t = tierOf(p);
    if (t === 'little') return [makeQ(ch, 'little', 0), makeQ(ch, 'little', 1), makeQ(ch, 'little', 2), makeQ(ch, 'tf')];
    if (t === 'mid') return [makeQ(ch, 'big', 0), makeQ(ch, 'who'), makeQ(ch, 'big', 1), makeQ(ch, 'fill'), makeQ(ch, 'big', 2)];
    return [makeQ(ch, 'order'), makeQ(ch, 'big', 0), makeQ(ch, 'who'), makeQ(ch, 'fill'), makeQ(ch, 'big', 2), makeQ(ch, 'tf')];
  }
  const needed = total => Math.max(1, total - 1);   // you may miss one

  // ---------- the v3 daily quiz ----------
  const origStartQuiz = window.startQuiz, origFinishQuiz = window.finishQuiz, origOpenModal = window.openModal;
  window.startQuiz = function (opts) {
    if (opts.mode !== 'daily') return origStartQuiz(opts);
    stopNarration();
    const p = profile(), d = v3(p), ch = opts.chapter, qs = quizPlan(p, ch);
    // one question you missed before comes back as a bonus
    const due = d.review.find(r => r.due <= todayKey() && !(r.ch === ch && (r.b || 'matthew') === BK()));
    const review = due ? makeQ(due.ch, due.kind, due.i, due.b || 'matthew') : null;
    if (review) review.review = due;
    quiz = { ...opts, v3: true, questions: qs, extra: review, index: 0, score: 0, missed: [], runId: (quiz?.runId || 0) + 1 };
    v3Render();
  };
  function v3Render() {
    const p = profile(), total = quiz.questions.length, onExtra = quiz.index >= total, q = onExtra ? quiz.extra : quiz.questions[quiz.index];
    const runId = quiz.runId, shown = quiz.index;
    quiz.picked = -1; quiz.advancing = false; quiz.order = [];
    const dots = quiz.questions.map((_, i) => `<i class="v3-dot ${i < shown ? (quiz.missed.includes(i) ? 'miss' : 'hit') : i === shown ? 'now' : ''}"></i>`).join('');
    const head = onExtra ? `<div class="v3-qtop"><span class="v3-chip review">REMEMBER THIS? · ${bookInfo(q.id).name.toUpperCase()} ${q.ch}</span><span>Bonus · +1 Light</span></div>`
      : `<div class="v3-qtop"><span class="v3-chip">${q.label}</span><span class="v3-dots" aria-label="Question ${shown + 1} of ${total}">${dots}</span></div>`;
    let body;
    if (q.type === 'order') {
      body = `<h3 class="quiz-prompt">${esc(q.prompt)}</h3><div class="v3-order" id="v3Order">${q.shuffled.map((t, i) => `<button type="button" class="quiz-option v3-ord" data-o="${i}"><b class="v3-num"></b><span>${esc(t)}</span></button>`).join('')}</div><button id="v3Undo" type="button" class="text-button">↺ Start over</button>`;
    } else {
      body = `${q.verse ? `<div class="v3-verse"><small>${esc(q.ref)} · WEB</small><p>${esc(q.prompt).replace('_____', '<span class="v3-blank">_____</span>')}</p></div><h3 class="quiz-prompt">Which word is missing?</h3>` : `<h3 class="quiz-prompt ${q.quote ? 'v3-quote' : ''}">${esc(q.prompt)}</h3>`}
        <div class="quiz-options ${q.answers.length === 2 ? 'v3-two' : ''}">${q.answers.map((a, i) => `<button type="button" class="quiz-option" data-answer="${i}">${esc(a)}</button>`).join('')}</div>`;
    }
    openModal(`${header(curBook(p).name.toUpperCase() + ' ' + quiz.chapter, onExtra ? 'One more!' : `Question ${shown + 1} of ${total}`)}${head}${body}<p id="quizFeedback" role="status" class="quiz-feedback"></p><button id="nextQuestion" type="button" class="button primary wide" disabled>${onExtra || (shown === total - 1 && !quiz.extra) ? 'See my stars' : 'Next question'}</button>`);
    const advance = () => {
      if (quiz.advancing || quiz.runId !== runId || quiz.index !== shown) return; quiz.advancing = true;
      if (quiz.index < total - 1 || (quiz.index === total - 1 && quiz.extra)) { quiz.index++; v3Render(); } else v3Done();
    };
    const mark = right => {
      if (onExtra) { const d = v3(p); d.review = d.review.filter(r => r !== q.review && !(r.ch === q.review.ch && r.kind === q.review.kind && r.i === q.review.i && (r.b || 'matthew') === (q.review.b || 'matthew'))); if (right) { quiz.extraRight = true; } else d.review.push({ ...q.review, due: addDays(todayKey(), 3) }); save(); }
      else if (right) quiz.score++; else { quiz.missed.push(shown); const d = v3(p); if (!d.review.some(r => r.ch === q.ch && r.kind === q.kind && r.i === q.i && (r.b || 'matthew') === q.id)) d.review.push({ ch: q.ch, b: q.id, kind: q.kind, i: q.i, due: addDays(todayKey(), 2) }); d.review = d.review.slice(-30); save(); }
      sfx(right ? 'correct' : 'wrong'); buzz(right ? 18 : [40, 50, 40]);
      $('#nextQuestion').disabled = false;
    };
    if (q.type === 'order') {
      const btns = [...$('#modalCard').querySelectorAll('.v3-ord')];
      const redraw = () => btns.forEach(b => { const k = quiz.order.indexOf(Number(b.dataset.o)); b.querySelector('.v3-num').textContent = k >= 0 ? k + 1 : ''; b.classList.toggle('selected', k >= 0); });
      btns.forEach(b => b.onclick = () => {
        if (quiz.picked >= 0) return; const i = Number(b.dataset.o); if (quiz.order.includes(i)) return;
        quiz.order.push(i); sfx('page'); buzz(8); redraw();
        if (quiz.order.length === q.items.length) {
          quiz.picked = 1; const right = quiz.order.every((oi, k) => q.shuffled[oi] === q.items[k]);
          btns.forEach(x => { const oi = Number(x.dataset.o), k = quiz.order.indexOf(oi); x.disabled = true; x.classList.add(q.shuffled[oi] === q.items[k] ? 'correct' : 'wrong'); });
          $('#v3Undo').hidden = true;
          $('#quizFeedback').innerHTML = right ? '⭐ Perfect order!' : `Here’s the right order: <ol class="v3-right">${q.items.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
          mark(right);
        }
      });
      $('#v3Undo').onclick = () => { if (quiz.picked >= 0) return; quiz.order = []; redraw(); };
    } else {
      $('#modalCard').querySelectorAll('[data-answer]').forEach(b => b.onclick = () => {
        if (quiz.picked >= 0) return; quiz.picked = Number(b.dataset.answer);
        const right = q.answers[quiz.picked] === q.correct;
        $('#modalCard').querySelectorAll('[data-answer]').forEach(x => { const i = Number(x.dataset.answer); if (q.answers[i] === q.correct) x.classList.add('correct'); else if (i === quiz.picked) x.classList.add('wrong'); x.disabled = true; });
        if (q.verse) $('#modalCard').querySelector('.v3-blank').textContent = q.correct;
        $('#quizFeedback').innerHTML = (right ? '⭐ Correct!' : `The answer is: <b>${esc(q.correct)}</b>.`) + (q.explain ? ` ${esc(q.explain)}` : '');
        mark(right);
        if (!q.explain && !q.verse) setTimeout(advance, 1300);
      });
    }
    $('#nextQuestion').onclick = advance;
  }
  function v3Done() {
    const p = profile(), total = quiz.questions.length, need = needed(total), ch = quiz.chapter;
    if (quiz.extraRight) addLight(p, 1);
    if (quiz.score < need) {
      openModal(`${header('KEEP GOING', `${quiz.score} of ${total} right`)}<div class="v3-stars big">${starRow(0)}</div><p style="text-align:center">You need <b>${need} of ${total}</b> to finish this chapter. Read it again and look for the answers. You can try as many times as you like!</p><div class="two-col"><button id="rereadButton" class="button secondary">Read again</button><button id="retryButton" class="button primary">Try again</button></div>`);
      $('#rereadButton').onclick = () => showReading(ch);
      $('#retryButton').onclick = () => window.startQuiz({ mode: 'daily', chapter: ch });
      return;
    }
    const stars = quiz.score === total ? 3 : 2, d = v3(p), sk = sKey(BK(), ch), first = !d.stars[sk];
    d.stars[sk] = Math.max(d.stars[sk] || 0, stars);
    const earned = stars === 3 ? 5 : 3; addLight(p, earned);
    quiz.v3result = { stars, earned, total, first };
    quiz.score = 3;   // tell the original flow the chapter is passed
    if (quizBonusCh() && !quiz.bonusDone) { quiz.bonusDone = true; showBonus(p, quizBonusCh(), origFinishQuiz, true); const t = $('#modalCard .quiz-top span'); if (t) t.textContent = 'BONUS ⭐ THINK ABOUT IT'; return; }
    origFinishQuiz();
  }
  window.finishQuiz = function () { return origFinishQuiz(); };

  // Decorate the chapter-complete screen with stars, Light and the Bible + School bonus.
  window.openModal = function (html) {
    const res = quiz?.v3 && quiz.v3result && / COMPLETE</.test(html) ? quiz.v3result : null;
    if (res) {
      const ch = quiz.chapter, id = BK(), V = bookV3(id);
      html = html.replace(/All three answers right!\s*/, `${res.stars === 3 ? 'Every answer right!' : 'Great work!'} `).replace('Sky Run is open', 'Sky Run and the Arcade are open').replace(/<h3 style="text-align:center">You remembered it!<\/h3>/, '');
      const block = `<div class="v3-done"><div class="v3-stars big">${starRow(res.stars)}</div><div class="v3-earn">+${res.earned} Light <span class="v3-light-ico"></span></div>${V[ch]?.school && !v3(profile()).school[sKey(id, ch)] ? `<button id="v3SchoolBtn" class="v3-school-btn"><span class="v3-subj">${esc(V[ch].school.subj)}</span><span><b>Bible + School bonus</b><small>${esc(V[ch].school.title)} · +2 Light</small></span><span aria-hidden="true">→</span></button>` : ''}</div>`;
      html = html.replace(/(<\/button><\/div>)/, `$1${block}`);   // right after the header
      quiz.v3result = null;
      origOpenModal(html);
      setTimeout(() => { confetti(res.stars === 3 ? 160 : 90); $('#v3SchoolBtn')?.addEventListener('click', () => showSchool(ch)); const f = $('#finishNext'); if (f) { f.textContent = 'Play'; f.onclick = () => { closeModal(); showArcade(); }; } }, 0);
      return;
    }
    return origOpenModal(html);
  };
  const starRow = n => [1, 2, 3].map(i => `<span class="v3-star ${i <= n ? 'on' : ''}" style="--i:${i}">★</span>`).join('');

  // ---------- Bible + School ----------
  function showSchool(ch, id = BK()) {
    const p = profile(), s = bookV3(id)[ch].school, sk = sKey(id, ch), answers = shuf(s.q.slice(1));
    openModal(`${header('BIBLE + SCHOOL', esc(s.title))}<div class="v3-school"><span class="v3-subj big">${esc(s.subj)}</span><p class="v3-fact">${esc(s.fact)}</p></div><h3 class="quiz-prompt">${esc(s.q[0])}</h3><div class="quiz-options">${answers.map((a, i) => `<button type="button" class="quiz-option" data-s="${i}">${esc(a)}</button>`).join('')}</div><p id="schoolFb" class="quiz-feedback"></p><div class="two-col"><button id="schoolBack" class="button secondary">Back</button><button id="schoolPlay" class="button primary" disabled>Play</button></div>`);
    $('#modalCard').querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      const pick = answers[Number(b.dataset.s)], right = pick === s.q[1];
      $('#modalCard').querySelectorAll('[data-s]').forEach(x => { x.disabled = true; if (answers[Number(x.dataset.s)] === s.q[1]) x.classList.add('correct'); else if (x === b) x.classList.add('wrong'); });
      const d = v3(p), first = !d.school[sk]; d.school[sk] = right ? 2 : 1; save();
      const n = first ? (right ? 2 : 1) : 0; if (n) addLight(p, n);
      sfx(right ? 'bonus' : 'correct'); buzz(right ? 18 : 30); if (right) confetti(60);
      $('#schoolFb').innerHTML = `${right ? '⭐ Smart thinking!' : `Good try! The answer is <b>${esc(s.q[1])}</b>.`}${n ? ` +${n} Light` : ''} <br><small>Tell your teacher what you learned from the Bible today!</small>`;
      $('#schoolPlay').disabled = false;
    });
    $('#schoolBack').onclick = () => { closeModal(); render(); };
    $('#schoolPlay').onclick = () => { closeModal(); showArcade(); };
  }

  // ---------- Sticker book ----------
  function showStickers() {
    const p = profile(), d = v3(p), id = BK(), B = bookInfo(id), V = bookV3(id), Q = bookQ(id);
    const tiles = Array.from({ length: B.n }, (_, i) => { const n = i + 1, done = completed(p, n), st = d.stars[sKey(id, n)] || 0;
      return `<button class="v3-sticker ${done ? 'done' : ''}" data-st="${n}" ${done ? '' : 'disabled'} aria-label="Matthew ${n}${done ? `, ${st} stars` : ', not read yet'}"><span class="v3-stk-n">${n}</span><span class="v3-stk-t">${esc(Q[i].title)}</span><span class="v3-stk-s">${done ? (st ? '★'.repeat(st) + '☆'.repeat(3 - st) : '✓ Read') : ''}</span>${done && V[n]?.school && !d.school[sKey(id, n)] ? '<i class="v3-stk-dot" title="School bonus waiting"></i>' : ''}</button>`; }).join('');
    const total = Object.values(d.stars).reduce((a, b) => a + b, 0);
    const tabs = BOOKS.length > 1 ? `<div class="bk-tabs">${BOOKS.map(b => `<span class="${b.id === id ? 'on' : ''}">${b.name} ${bookDone(p, b.id).length}/${b.n}</span>`).join('')}</div>` : '';
    openModal(`${header('MY STICKER BOOK', 'Book of ' + B.name)}${tabs}<p>${bookDone(p).length} of ${B.n} stickers · ${total} stars. Tap a sticker for its Bible + School bonus.</p><div class="v3-stickers">${tiles}</div><button class="button primary wide" data-close>Close</button>`);
    $('#modalCard').querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const n = Number(b.dataset.st); if (V[n]?.school) showSchool(n, id); });
  }

  // ---------- Memory verse of the week ----------
  function memoryVerse() {
    const [ch, v, skip, take] = V3_MEMORY[weekIndex() % V3_MEMORY.length];
    let w = cleanVerse(webVerse(ch, v)).split(/\s+/).slice(skip); if (take) w = w.slice(0, take);
    return { ref: `Matthew ${ch}:${v}`, words: w, text: w.join(' '), week: sundayOf(todayKey()) };
  }
  function chunks(words, n) { const size = Math.ceil(words.length / n), out = []; for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' ')); return out; }
  function showMemory() {
    const p = profile(), m = memoryVerse(), parts = chunks(m.words, p.age <= 6 ? 3 : p.age <= 9 ? 4 : 6), shuffled = shufNotSame(parts);
    let picked = [];
    openModal(`${header('MEMORY VERSE OF THE WEEK', m.ref)}<div class="v3-verse"><p id="memShow">${esc(m.text)}</p></div><p id="memHint">Read it out loud three times. When you’re ready, hide it and build it from memory!</p><button id="memHide" class="button primary wide">I’m ready, hide it</button><div id="memGame" hidden><div class="v3-mem-line" id="memLine"></div><div class="v3-mem-bank">${shuffled.map((t, i) => `<button class="v3-mem-chip" data-m="${i}">${esc(t)}</button>`).join('')}</div><button id="memReset" class="text-button">↺ Start over</button></div><p id="memFb" class="quiz-feedback"></p>`);
    $('#memHide').onclick = () => { $('#memShow').textContent = m.text.replace(/[A-Za-z’']/g, '•'); $('#memHide').hidden = true; $('#memHint').textContent = 'Tap the pieces in the right order.'; $('#memGame').hidden = false; };
    const chips = [...$('#modalCard').querySelectorAll('.v3-mem-chip')];
    const draw = () => { $('#memLine').innerHTML = picked.map(i => `<span>${esc(shuffled[i])}</span>`).join(' '); chips.forEach(c => c.disabled = picked.includes(Number(c.dataset.m))); };
    chips.forEach(c => c.onclick = () => {
      const i = Number(c.dataset.m); if (picked.includes(i)) return;
      if (shuffled[i] !== parts[picked.length]) { sfx('wrong'); buzz([30, 40, 30]); c.classList.add('v3-shake'); setTimeout(() => c.classList.remove('v3-shake'), 400); return; }
      picked.push(i); sfx('page'); buzz(10); draw();
      if (picked.length === parts.length) {
        const d = v3(p), first = !d.memory[m.week]; d.memory[m.week] = true; save(); if (first) addLight(p, 3);
        $('#memShow').textContent = m.text; sfx('bonus'); confetti(140);
        $('#memFb').innerHTML = `⭐ You know it by heart!${first ? ' +3 Light and a Memory badge.' : ''} Say it to someone at home today.`; $('#memReset').hidden = true; render();
      }
    });
    $('#memReset').onclick = () => { picked = []; draw(); };
  }

  // ---------- Sunday code word ----------
  function showSunday() {
    const p = profile(), wk = sundayOf(todayKey()), d = v3(p), got = d.sunday[wk];
    openModal(`${header('SUNDAY CODE WORD', 'Heard it at Favor Kids?')}<p>Every Sunday at Favor Kids we share a secret code word. Type it here to unlock a Sunday treasure!</p>${got ? `<div class="notice">You already found this week’s code. See you next Sunday!</div>` : `<label class="field">Code word<input id="sunCode" maxlength="24" autocomplete="off" autocapitalize="characters" placeholder="Type the code word"></label><p id="sunFb" class="quiz-feedback"></p><button id="sunGo" class="button primary wide">Unlock</button>`}`);
    $('#sunGo')?.addEventListener('click', () => {
      const code = $('#sunCode').value, want = V3_SUNDAY[wk];
      if (want && V3_hash(code) === want) { d.sunday[wk] = true; save(); addLight(p, 5); sfx('bonus'); buzz([20, 30, 20]); confetti(180); $('#sunFb').innerHTML = '⭐ You found it! +5 Light and a Sunday badge.'; $('#sunGo').remove(); render(); }
      else { sfx('wrong'); buzz(40); $('#sunFb').textContent = want ? 'That’s not this week’s word. Ask your Favor Kids leader!' : 'There’s no code for this week yet. Check back on Sunday!'; }
    });
  }

  // ---------- Arcade ----------
  const GAMES = [
    { id: 'sky', name: 'Sky Run', cost: 0, about: 'Fly your explorer, dodge gears and catch the glowing Bible.' },
    { id: 'bakery', name: 'Favor Bakery', cost: 1, about: 'Bake cakes for Bible-story customers. Then match Bible pairs.' },
    { id: 'sheep', name: 'Lost Sheep Dash', cost: 1, about: 'Find the lost sheep in the night maze. Lamps scare the wolves!' }
  ];
  function showArcade() {
    const p = profile(); if (!p) return; const d = v3(p), open = canPlay(p);
    openModal(`${header('ARCADE', open ? 'Pick a game!' : 'Read first to play')}<div class="v3-arcade-top"><span class="v3-light-pill"><span class="v3-light-ico"></span><b>${d.light}</b> Light</span><small>${open ? 'Sky Run is free today. The other games use 1 Light each.' : 'Read today’s chapter and pass the quiz to open the Arcade.'}</small></div>
      <div class="v3-games">${GAMES.map(g => `<button class="v3-game ${g.id}" data-g="${g.id}" ${!open || d.light < g.cost ? 'disabled' : ''}><span class="v3-game-art"></span><span class="v3-game-txt"><b>${g.name}</b><small>${g.about}</small></span><span class="v3-cost">${g.cost ? `<span class="v3-light-ico"></span>${g.cost}` : 'FREE'}</span></button>`).join('')}</div>
      ${open ? '' : `<button id="v3GoRead" class="button primary wide">Read ${esc(curBook(p).name)} ${todayChapter(p)} to unlock</button>`}${open && d.light < 1 ? '<p class="fineprint">Earn Light by passing quizzes, the Bible + School bonus, the memory verse and the Sunday code.</p>' : ''}`);
    $('#modalCard').querySelectorAll('[data-g]').forEach(b => b.onclick = () => playGame(b.dataset.g));
    $('#v3GoRead')?.addEventListener('click', () => showReading(todayChapter(p)));
  }
  function playGame(id) {
    const p = profile(), d = v3(p), g = GAMES.find(x => x.id === id);
    if (!canPlay(p)) { toast('Read today’s chapter first'); return; }
    if (id === 'sky') { d.plays = d.plays || {}; d.plays.sky = (d.plays.sky || 0) + 1; save(); checkAwards(p, true); closeModal(); openGame(); return; }
    if (d.light < g.cost) { toast('You need more Light. Read to earn it!'); return; }
    d.light -= g.cost; d.plays = d.plays || {}; d.plays[id] = (d.plays[id] || 0) + 1; save(); closeModal(); sfx('open'); checkAwards(p);
    const ch = Math.max(1, ...p.completed.length ? p.completed : [1]);
    const layer = document.createElement('div'); layer.className = 'v3-play'; layer.innerHTML = `<div class="v3-play-bar"><b>${g.name}</b><span class="v3-light-pill"><span class="v3-light-ico"></span>${d.light}</span><button class="icon-button" aria-label="Close game">×</button></div><iframe title="${g.name}" src="${window.V3_BASE || ''}arcade/${id}.html?ch=${ch}&age=${p.age}&name=${encodeURIComponent(firstName(p))}" allow="autoplay"></iframe>`;
    document.body.append(layer); document.body.classList.add('playing');
    try { SkyAudio.scene?.('game'); } catch { }
    layer.querySelector('button').onclick = () => { layer.remove(); document.body.classList.remove('playing'); try { SkyAudio.scene('home'); } catch { } render(); };
  }
  window.showArcade = showArcade;


  // ---------- Awards & achievements ----------
  // Each award is checked from saved progress, so kids who already read a lot get theirs straight away.
  // New awards give +2 Light and pop up a banner. Arcade games can report wins with postMessage({rmb:'award', key}).
  const totalStars = d => Object.values(d.stars).reduce((a, b) => a + b, 0);
  const golds = d => Object.values(d.stars).filter(x => x === 3).length;
  const count = o => Object.keys(o || {}).length;
  const prayers = p => (p.journal || []).filter(e => /PRAY|Pray/.test(e.title || '')).length;
  const AWARDS = [
    // reading
    { id: 'first', cat: 'read', ico: '📖', name: 'First Step', how: 'Read your first chapter', test: p => totalChapters(p) >= 1 },
    { id: 'read7', cat: 'read', ico: '🔦', name: 'Bookworm', how: 'Read 7 chapters', test: p => totalChapters(p) >= 7 },
    { id: 'read14', cat: 'read', ico: '🧭', name: 'Trailblazer', how: 'Read 14 chapters', test: p => totalChapters(p) >= 14 },
    { id: 'matthew', cat: 'read', ico: '👑', name: 'Matthew Master', how: 'Finish all 28 chapters of Matthew', test: p => bookDone(p, 'matthew').length >= 28 },
    { id: 'mark', cat: 'read', ico: '🦁', name: 'Mark Finisher', how: 'Finish all 16 chapters of Mark', test: p => bookDone(p, 'mark').length >= 16 },
    { id: 'read50', cat: 'read', ico: '🗺️', name: 'Bible Explorer', how: 'Read 50 chapters in all', test: p => totalChapters(p) >= 50 },
    { id: 'reread', cat: 'read', ico: '🔁', name: 'Read It Again', how: 'Reread a book you finished', test: p => (p.rereadCount || 0) >= 1 },
    // streaks
    { id: 'streak3', cat: 'fire', ico: '🔥', name: 'On Fire', how: 'Read 3 days in a row', test: p => streak(p) >= 3 },
    { id: 'streak7', cat: 'fire', ico: '⚡', name: 'Week Warrior', how: 'Read 7 days in a row', test: p => streak(p) >= 7 },
    { id: 'streak14', cat: 'fire', ico: '🚀', name: 'Unstoppable', how: 'Read 14 days in a row', test: p => streak(p) >= 14 },
    { id: 'streak30', cat: 'fire', ico: '🏆', name: 'Faithful Flame', how: 'Read 30 days in a row', test: p => streak(p) >= 30 },
    // quizzes
    { id: 'gold1', cat: 'star', ico: '⭐', name: 'Perfect!', how: 'Get every quiz answer right (3 stars)', test: (p, d) => golds(d) >= 1 },
    { id: 'gold10', cat: 'star', ico: '🌟', name: 'Star Collector', how: 'Get 3 stars on 10 chapters', test: (p, d) => golds(d) >= 10 },
    { id: 'stars50', cat: 'star', ico: '💫', name: 'Superstar', how: 'Collect 50 stars', test: (p, d) => totalStars(d) >= 50 },
    { id: 'school1', cat: 'star', ico: '🎓', name: 'Smart Cookie', how: 'Do a Bible + School bonus', test: (p, d) => count(d.school) >= 1 },
    { id: 'school5', cat: 'star', ico: '🧪', name: 'Scholar', how: 'Do 5 Bible + School bonuses', test: (p, d) => count(d.school) >= 5 },
    // heart
    { id: 'memory1', cat: 'heart', ico: '💛', name: 'Hidden in My Heart', how: 'Learn a memory verse', test: (p, d) => count(d.memory) >= 1 },
    { id: 'memory4', cat: 'heart', ico: '📜', name: 'Verse Keeper', how: 'Learn 4 memory verses', test: (p, d) => count(d.memory) >= 4 },
    { id: 'heart1', cat: 'heart', ico: '💌', name: 'Open Heart', how: 'Answer a Heart Moment', test: p => (p.journal || []).length >= 1 },
    { id: 'pray5', cat: 'heart', ico: '🙏', name: 'Prayer Warrior', how: 'Pray for others 5 times', test: p => prayers(p) >= 5 },
    { id: 'sunday1', cat: 'heart', ico: '⛪', name: 'Sunday Sleuth', how: 'Find a Sunday code word', test: (p, d) => count(d.sunday) >= 1 },
    { id: 'sunday4', cat: 'heart', ico: '🔑', name: 'Never Miss a Sunday', how: 'Find 4 Sunday code words', test: (p, d) => count(d.sunday) >= 4 },
    // play
    { id: 'mansion', cat: 'play', ico: '🏰', name: 'Mansion Builder', how: 'Upgrade your home to the mansion', test: p => (p.homeStage || 0) >= 3 },
    { id: 'shine', cat: 'play', ico: '🕯️', name: 'Shining Light', how: 'Earn 50 Light', test: (p, d) => d.lifetime >= 50 },
    { id: 'arcade', cat: 'play', ico: '🎮', name: 'Arcade Starter', how: 'Play a game in the Arcade', test: (p, d) => count(d.plays) >= 1 },
    { id: 'cake', cat: 'play', ico: '🎂', name: 'Head Baker', how: 'Bake a perfect cake in Favor Bakery', test: (p, d) => !!d.flags?.cake },
    { id: 'sheep3', cat: 'play', ico: '🐑', name: 'Good Shepherd', how: 'Bring home all 3 lost sheep', test: (p, d) => !!d.flags?.sheep3 }
  ];
  const CAT = { read: ['Reading', '#59877d'], fire: ['Streaks', '#c86354'], star: ['Quizzes', '#faa731'], heart: ['Heart', '#a28fbc'], play: ['Play', '#315b5a'] };
  let awardQueue = [], awardShowing = false;
  function checkAwards(p, quiet) {
    if (!p) return; const d = v3(p); d.awards = d.awards || {}; const fresh = [];
    for (const a of AWARDS) if (!d.awards[a.id]) { let ok = false; try { ok = a.test(p, d); } catch { } if (ok) { d.awards[a.id] = todayKey(); fresh.push(a); } }
    if (!fresh.length) return;
    // kids who already had progress before awards existed get them quietly, without a flood of banners
    if (!d.awardsSeeded) { d.awardsSeeded = true; save(); if (fresh.length > 2) quiet = true; }
    d.light += fresh.length * 2; d.lifetime += fresh.length * 2; save();
    if (!quiet) { awardQueue.push(...fresh); nextAward(); }
  }
  function nextAward() {
    if (awardShowing || !awardQueue.length) return; awardShowing = true;
    const a = awardQueue.shift(), el = document.createElement('button'); el.className = 'v3-award-pop'; el.style.setProperty('--c', CAT[a.cat][1]);
    el.innerHTML = `<span class="v3-badge big" style="--c:${CAT[a.cat][1]}">${a.ico}</span><span><small>NEW AWARD! +2 Light</small><b>${esc(a.name)}</b><i>${esc(a.how)}</i></span>`;
    document.body.append(el); sfx('bonus'); buzz([20, 30, 20]); confetti(110);
    const done = () => { el.classList.add('out'); setTimeout(() => { el.remove(); awardShowing = false; nextAward(); }, 350); };
    el.onclick = () => { done(); showAwards(); }; setTimeout(done, 4200);
  }
  function showAwards() {
    const p = profile(); if (!p) return; const d = v3(p); d.awards = d.awards || {};
    const got = AWARDS.filter(a => d.awards[a.id]).length;
    const groups = Object.entries(CAT).map(([k, [label, col]]) => `<h4 class="v3-aw-h" style="color:${col}">${label}</h4><div class="v3-aw-grid">${AWARDS.filter(a => a.cat === k).map(a => { const on = d.awards[a.id]; return `<div class="v3-aw ${on ? 'on' : ''}" style="--c:${col}"><span class="v3-badge">${on ? a.ico : '🔒'}</span><b>${esc(a.name)}</b><small>${esc(a.how)}</small></div>`; }).join('')}</div>`).join('');
    openModal(`${header('MY AWARDS', `${got} of ${AWARDS.length} earned`)}<div class="v3-aw-bar"><span style="width:${got / AWARDS.length * 100}%"></span></div><p>Every award gives you <b>+2 Light</b> for the Arcade. Keep reading to unlock them all!</p>${groups}<button class="button primary wide" data-close>Close</button>`);
  }
  window.showAwards = showAwards;
  addEventListener('message', e => {
    const k = e.data && e.data.rmb === 'award' ? e.data.key : null; if (!k || !['cake', 'sheep3'].includes(k)) return;
    const p = profile(); if (!p) return; const d = v3(p); d.flags = d.flags || {}; if (!d.flags[k]) { d.flags[k] = true; save(); checkAwards(p); }
  });

  // Little arcade-cabinet icon in brand colours (coral cabinet, gold screen glow, teal joystick)
  const ARCADE_ICO = `<svg class="v3-arc-ico" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3h16a2 2 0 0 1 2 2v24H6V5a2 2 0 0 1 2-2z" fill="#c86354"/><path d="M6 29h20v1H6z" fill="#8f3f35"/><rect x="9" y="6" width="14" height="10" rx="2" fill="#29464a"/><rect x="10.5" y="7.5" width="11" height="7" rx="1.2" fill="#faa731"/><circle cx="13.5" cy="11" r="1.4" fill="#fff8eb"/><path d="M17 12.5l2-3 2 3z" fill="#fff8eb"/><rect x="7" y="18" width="18" height="5" rx="1.5" fill="#fbe8ca"/><rect x="11" y="16" width="1.6" height="4" rx=".8" fill="#29464a"/><circle cx="11.8" cy="15.6" r="1.8" fill="#59877d"/><circle cx="18" cy="20.5" r="1.3" fill="#c86354"/><circle cx="21.5" cy="20.5" r="1.3" fill="#59877d"/></svg>`;
  const ENTER = `${ARCADE_ICO}<span>Enter the Arcade</span>`;
  // ---------- Dashboard cards ----------
  const origRender = window.render;
  window.render = function () {
    origRender();
    const p = freshLanding ? null : profile();
    let row = $('#v3Row');
    if (!row) { row = document.createElement('section'); row.id = 'v3Row'; row.className = 'dash-row v3-row'; $('#readRow').after(row); }
    row.classList.toggle('hidden', !p); if (!p) return;
    const d = v3(p), open = canPlay(p), m = memoryVerse(), wk = sundayOf(todayKey());
    checkAwards(p);
    const total = Object.values(d.stars).reduce((a, b) => a + b, 0), B = curBook(p), bd = bookDone(p);
    d.awards = d.awards || {}; const aw = AWARDS.filter(a => d.awards[a.id]).sort((a, b) => (d.awards[a.id] > d.awards[b.id]) - (d.awards[a.id] < d.awards[b.id])), nextUp = AWARDS.find(a => !d.awards[a.id]);
    row.innerHTML = `<div class="v3-grid">
      <article class="card v3-arcade-card"><div class="panel-kicker">ARCADE</div><div class="v3-arcade-head"><h3>${open ? 'Pick a game!' : 'Read first, then play'}</h3><span class="v3-light-pill" title="Light you earned by reading"><span class="v3-light-ico"></span><b>${d.light}</b></span></div><div class="v3-mini-games">${GAMES.map(g => `<span class="v3-mini ${g.id}" title="${g.name}"></span>`).join('')}</div><p>${open ? 'Sky Run is free today. Favor Bakery and Lost Sheep Dash use 1 Light.' : 'Read today’s chapter and pass the quiz. Every quiz earns Light for the Arcade.'}</p><button id="v3ArcadeBtn" class="button primary wide v3-enter">${ENTER}</button></article>
      <article class="card v3-sticker-card"><div class="panel-kicker">STICKER BOOK</div><h3>${B.name} · ${bd.length} / ${B.n}</h3><div class="v3-strip" style="grid-template-columns:repeat(${Math.ceil(B.n / 2)},1fr)">${Array.from({ length: B.n }, (_, i) => `<i class="${completed(p, i + 1) ? 'on' : ''} ${d.stars[sKey(B.id, i + 1)] === 3 ? 'gold' : ''}"></i>`).join('')}</div><p>${total} stars so far. Get every answer right for 3 stars!</p><button id="v3StickBtn" class="button secondary wide">Open my sticker book</button></article>
      <article class="card v3-mem-card"><div class="panel-kicker">MEMORY VERSE · THIS WEEK</div><h3>${m.ref}</h3><p class="v3-mem-text">“${esc(m.text)}”</p><button id="v3MemBtn" class="button secondary wide">${d.memory[m.week] ? '✓ Learned! Practice again' : 'Learn it · +3 Light'}</button></article>
      <article class="card v3-sun-card"><div class="panel-kicker">SUNDAY CODE</div><h3>${d.sunday[wk] ? 'Found it! ✓' : 'Heard the code word?'}</h3><p>${d.sunday[wk] ? 'You found this week’s Sunday treasure.' : 'Listen at Favor Kids on Sunday for the secret word.'}</p><button id="v3SunBtn" class="button secondary wide" ${d.sunday[wk] ? 'disabled' : ''}>${d.sunday[wk] ? 'See you Sunday' : 'Enter the code · +5 Light'}</button></article>
      <article class="card v3-awards-card"><div class="v3-aw-top"><div><div class="panel-kicker">MY AWARDS</div><h3>${aw.length} of ${AWARDS.length} earned</h3></div><button id="v3AwBtn" class="button secondary">See all awards</button></div><div class="v3-aw-row">${aw.length ? aw.slice(-8).reverse().map(a => `<span class="v3-badge" style="--c:${CAT[a.cat][1]}" title="${esc(a.name)}">${a.ico}</span>`).join('') : '<p>Read your first chapter to earn your first award!</p>'}${nextUp ? `<span class="v3-aw-next">Next: <b>${esc(nextUp.name)}</b> · ${esc(nextUp.how)}</span>` : ''}</div></article>
    </div>`;
    if (rereading(p) && matthewDone(p) && BOOKS.some(b => bookDone(p, b.id).length < b.n)) { const nb = document.createElement('div'); nb.className = 'v3-next-book'; nb.innerHTML = `<div><b>You finished ${B.name}! 🎉</b><small>Choose your next book: ${BOOKS.filter(b => bookDone(p, b.id).length < b.n).map(b => b.name).join(', ')}</small></div><button class="button primary">Choose a book</button>`; nb.querySelector('button').onclick = showChapters; row.prepend(nb); }
    $('#v3ArcadeBtn').onclick = showArcade;
    $('#v3StickBtn').onclick = showStickers; $('#v3MemBtn').onclick = showMemory; $('#v3SunBtn').onclick = showSunday; $('#v3AwBtn').onclick = showAwards;
    // The Sky Run card now leads into the Arcade
    { const pb = $('#playButton'); pb.innerHTML = ENTER; pb.classList.add('v3-enter'); pb.disabled = false; pb.onclick = showArcade; }
    $('#gameDescription').textContent = open ? 'All the games are inside! Sky Run is free today. Use Light for the others.' : 'Read today’s chapter to unlock the games inside.';
    // quiz description
    const t = tierOf(p), n = todayChapter(p), qn = quizPlan(p, n).length;
    const desc = $('#todayDescription'); if (desc && !/Come back tomorrow|Great job/.test(desc.textContent)) desc.textContent = desc.textContent.replace(/get 3 of 3 quiz answers right/g, `get ${needed(qn)} of ${qn} quiz answers right`);
    $('.feature-strip small') && ($('.feature-strip div:nth-child(2) small').textContent = `${TIER_NAME[t]} quiz · ${qn} questions`);
  };

  // reading screen text
  const origShowReading = window.showReading;
  window.showReading = async function (n, keep) {
    const r = origShowReading(n, keep);
    const p = profile(); if (p) { const qn = quizPlan(p, n).length; const fix = () => { const no = $('#modalCard .notice'), nt = `Read to the end, then answer ${qn} questions (${TIER_NAME[tierOf(p)]} level). A grown-up can help younger readers.`; if (no && no.textContent !== nt) no.textContent = nt; const b = $('#quizButton'), bt = `Start the ${qn}-question quiz`; if (b && !b.disabled && /quiz/.test(b.textContent) && !/I read it/.test(b.textContent) && b.textContent !== bt) b.textContent = bt; }; fix(); const obs = new MutationObserver(fix); const b = $('#quizButton'); if (b) obs.observe(b, { attributes: true, childList: true }); setTimeout(() => obs.disconnect(), 120000); }
    return r;
  };

  // ---------- Confetti ----------
  function confetti(count = 120) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1); c.className = 'v3-confetti'; document.body.append(c);
    const w = c.width = innerWidth * dpr, h = c.height = innerHeight * dpr, x = c.getContext('2d');
    const cols = ['#faa731', '#c86354', '#59877d', '#a28fbc', '#fbe8ca', '#ffe25a'];
    const ps = Array.from({ length: count }, () => ({ x: w / 2 + (Math.random() - .5) * w * .3, y: h * .35, vx: (Math.random() - .5) * 26 * dpr, vy: (-Math.random() * 22 - 8) * dpr, r: (4 + Math.random() * 6) * dpr, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)] }));
    let t = 0; const tick = () => { x.clearRect(0, 0, w, h); t++; ps.forEach(p => { p.vy += .7 * dpr; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); }); if (t < 150) requestAnimationFrame(tick); else c.remove(); }; tick();
  }
  window.V3_confetti = confetti;

  // ---------- HD Sky Run ----------
  try {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (dpr > 1 && typeof canvas !== 'undefined') {
      canvas.width = W * dpr; canvas.height = H * dpr; const main = canvas.getContext('2d');
      const wrap = name => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function () { if (ctx === main) { main.setTransform(dpr, 0, 0, dpr, 0, 0); main.imageSmoothingQuality = 'high'; } return f.apply(this, arguments); }; };
      wrap('drawGame'); wrap('drawIdle');
      document.getElementById('gameCanvas').style.imageRendering = 'auto';
    }
  } catch { }

  render();
})();
