(() => {
  'use strict';

  const MIN_DISKS = 3;
  const MAX_DISKS = 8;

  const board = document.getElementById('board');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('minMoves');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');
  const msgEl = document.getElementById('message');
  const diskSelect = document.getElementById('diskCount');
  const undoBtn = document.getElementById('undoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const solveBtn = document.getElementById('solveBtn');
  const prologBtn = document.getElementById('prologBtn');
  const overlay = document.getElementById('winOverlay');
  const winText = document.getElementById('winText');
  const playAgainBtn = document.getElementById('playAgainBtn');

  let n = 4;
  let pegs = [[], [], []];   // each peg: disk sizes from bottom to top
  let history = [];          // list of [from, to]
  let selected = null;
  let moves = 0;
  let startTime = null;
  let elapsed = 0;
  let timerId = null;
  let solving = false;
  let solveTimer = null;
  let dragFrom = null;
  let finished = false;

  // ---------- helpers ----------
  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const minMoves = k => Math.pow(2, k) - 1;
  const say = t => { msgEl.textContent = t; };

  function loadBest(k) {
    try { return JSON.parse(localStorage.getItem('hanoi-best-' + k)); } catch (e) { return null; }
  }
  function saveBest(k, data) {
    try { localStorage.setItem('hanoi-best-' + k, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function diskColor(size) {
    const hue = 200 + (size - 1) / Math.max(1, MAX_DISKS - 1) * 300; // blue -> green -> yellow -> red -> pink
    return `hsl(${hue % 360} 75% 62%)`;
  }

  // ---------- timer ----------
  function startTimer() {
    if (timerId || finished) return;
    startTime = Date.now() - elapsed * 1000;
    timerId = setInterval(() => {
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      timeEl.textContent = fmtTime(elapsed);
    }, 250);
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  // ---------- rendering ----------
  function buildBoard() {
    board.innerHTML = '';
    board.style.setProperty('--n', n);
    const names = ['Start', 'Spare', 'Goal'];
    for (let i = 0; i < 3; i++) {
      const t = document.createElement('div');
      t.className = 'tower';
      t.dataset.index = i;
      t.tabIndex = 0;
      t.setAttribute('role', 'button');
      t.innerHTML = '<div class="rod"></div><div class="base"></div><div class="stack"></div>' +
                    `<div class="label">${i + 1} · ${names[i]}</div>`;
      t.style.setProperty('--n', n);
      t.addEventListener('click', () => onPegActivate(i));
      t.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPegActivate(i); }
      });
      t.addEventListener('dragover', e => {
        if (dragFrom === null) return;
        if (canMove(dragFrom, i)) { e.preventDefault(); t.classList.add('drop-ok'); }
      });
      t.addEventListener('dragleave', () => t.classList.remove('drop-ok'));
      t.addEventListener('drop', e => {
        e.preventDefault();
        t.classList.remove('drop-ok');
        if (dragFrom !== null) {
          const from = dragFrom;
          dragFrom = null;
          selected = null;
          attemptMove(from, i);
        }
      });
      board.appendChild(t);
    }
  }

  function render() {
    const towers = board.querySelectorAll('.tower');
    towers.forEach((t, i) => {
      t.classList.toggle('selected', selected === i);
      t.setAttribute('aria-label',
        `Peg ${i + 1}, ${pegs[i].length} disk${pegs[i].length === 1 ? '' : 's'}`);
      const stack = t.querySelector('.stack');
      stack.innerHTML = '';
      pegs[i].forEach((size, idx) => {
        const d = document.createElement('div');
        const isTop = idx === pegs[i].length - 1;
        d.className = 'disk' + (isTop ? ' top' : '') + (isTop && selected === i ? ' lifted' : '');
        d.style.width = `${28 + (size / n) * 66}%`;
        d.style.background = diskColor(size);
        d.textContent = size;
        if (isTop && !solving && !finished) {
          d.draggable = true;
          d.addEventListener('dragstart', e => {
            dragFrom = i;
            selected = null;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(size));
            setTimeout(() => d.classList.add('dragging'), 0);
          });
          d.addEventListener('dragend', () => {
            dragFrom = null;
            d.classList.remove('dragging');
            board.querySelectorAll('.drop-ok').forEach(x => x.classList.remove('drop-ok'));
          });
        }
        stack.appendChild(d);
      });
    });
    movesEl.textContent = moves;
    minEl.textContent = minMoves(n);
    timeEl.textContent = fmtTime(elapsed);
    const best = loadBest(n);
    bestEl.textContent = best ? `${best.moves} / ${fmtTime(best.time)}` : '–';
    undoBtn.disabled = history.length === 0 || solving || finished;
    solveBtn.textContent = solving ? 'Stop' : 'Auto-solve';
    prologBtn.disabled = solving;
  }

  // ---------- game logic ----------
  function canMove(from, to) {
    if (from === to) return false;
    const src = pegs[from];
    if (!src.length) return false;
    const dst = pegs[to];
    return !dst.length || dst[dst.length - 1] > src[src.length - 1];
  }

  function doMove(from, to, record = true) {
    const disk = pegs[from].pop();
    pegs[to].push(disk);
    if (record) history.push([from, to]);
    moves++;
  }

  function attemptMove(from, to) {
    if (solving || finished) return;
    if (!canMove(from, to)) {
      const target = board.children[to];
      target.classList.remove('shake');
      void target.offsetWidth;
      target.classList.add('shake');
      if (pegs[from].length === 0) say('That peg is empty.');
      else say('A larger disk can’t go on top of a smaller one.');
      render();
      return;
    }
    startTimer();
    doMove(from, to);
    say('');
    checkWin();
    render();
  }

  function onPegActivate(i) {
    if (solving || finished) return;
    if (selected === null) {
      if (!pegs[i].length) { say('That peg is empty. Pick a peg with disks.'); return; }
      selected = i;
      say(`Disk ${pegs[i][pegs[i].length - 1]} lifted. Choose where to put it.`);
      render();
    } else if (selected === i) {
      selected = null;
      say('Disk put back.');
      render();
    } else {
      const from = selected;
      selected = null;
      attemptMove(from, i);
    }
  }

  function checkWin() {
    if (pegs[2].length !== n) return;
    finished = true;
    stopTimer();
    const best = loadBest(n);
    const isBest = !best || moves < best.moves || (moves === best.moves && elapsed < best.time);
    if (!solving && isBest) saveBest(n, { moves, time: elapsed });
    const perfect = moves === minMoves(n);
    winText.textContent = solving
      ? `The computer solved ${n} disks in ${moves} moves.`
      : `You moved ${n} disks in ${moves} moves (${fmtTime(elapsed)}). ` +
        (perfect ? 'That is the fewest possible!' : `The fewest possible is ${minMoves(n)}.`) +
        (isBest ? ' New personal best.' : '');
    setTimeout(() => { overlay.hidden = false; playAgainBtn.focus(); }, 300);
  }

  function undo() {
    if (solving || finished || !history.length) return;
    const [from, to] = history.pop();
    pegs[from].push(pegs[to].pop());
    moves++; // undo counts as a move so it can’t be used to cheat the score
    selected = null;
    say('Last move undone.');
    render();
  }

  function reset(keepMessage) {
    stopSolve();
    stopTimer();
    overlay.hidden = true;
    pegs = [Array.from({ length: n }, (_, k) => n - k), [], []];
    history = [];
    selected = null;
    moves = 0;
    elapsed = 0;
    startTime = null;
    finished = false;
    buildBoard();
    if (!keepMessage) say('Pick a peg to lift its top disk.');
    render();
  }

  // ---------- auto-solve ----------
  function solutionMoves(k, from, to, via, out = []) {
    if (k === 0) return out;
    solutionMoves(k - 1, from, via, to, out);
    out.push([from, to]);
    solutionMoves(k - 1, via, to, from, out);
    return out;
  }

  function stopSolve() {
    solving = false;
    clearTimeout(solveTimer);
    solveTimer = null;
  }

  function startSolve(prologList) {
    // restart from the beginning so the solution is always valid
    const wasN = n;
    reset(true);
    n = wasN;
    solving = true;
    const list = prologList || solutionMoves(n, 0, 2, 1);
    let step = 0;
    say('Auto-solving… press Stop to take over.');
    startTimer();
    const delay = Math.max(120, 500 - n * 45);
    const tick = () => {
      if (!solving) return;
      if (step >= list.length) return;
      const [f, t] = list[step++];
      doMove(f, t, false);
      render();
      if (step === list.length) {
        checkWin();
        solving = false;
        render();
        return;
      }
      solveTimer = setTimeout(tick, delay);
    };
    render();
    solveTimer = setTimeout(tick, 300);
  }

  // ---------- controls ----------
  for (let k = MIN_DISKS; k <= MAX_DISKS; k++) {
    const o = document.createElement('option');
    o.value = k; o.textContent = k;
    if (k === n) o.selected = true;
    diskSelect.appendChild(o);
  }
  diskSelect.addEventListener('change', () => { n = parseInt(diskSelect.value, 10); reset(); });
  undoBtn.addEventListener('click', undo);
  resetBtn.addEventListener('click', () => reset());
  playAgainBtn.addEventListener('click', () => reset());
  solveBtn.addEventListener('click', () => {
    if (solving) {
      stopSolve();
      stopTimer();
      finished = false;
      say('Auto-solve stopped. Your turn.');
      render();
    } else {
      startSolve();
    }
  });
  prologBtn.addEventListener('click', async () => {
    say('Asking the Prolog server for a solution…');
    try {
      const res = await fetch(`/solve?disks=${n}`);
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      startSolve(data.moves);
      say(`Prolog found a ${data.count}-move solution. Playing it now…`);
    } catch (e) {
      say('Prolog server not reachable. Run "swipl server.pl" and open http://localhost:8080');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.tagName === 'SELECT') return;
    if (e.key >= '1' && e.key <= '3') onPegActivate(parseInt(e.key, 10) - 1);
    else if (e.key === 'u' || e.key === 'U') undo();
    else if (e.key === 'r' || e.key === 'R') reset();
    else if (e.key === 'Escape' && !overlay.hidden) reset();
  });

  reset();
})();
