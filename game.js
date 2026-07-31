/**
 * Jogo da Velha Pro v2.0 — Ultimate Edition
 * Canvas, Minimax AI, Web Audio, LocalStorage, Themes, Timer, Undo, History, Leaderboard, 2 Players
 */
(function() {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // UI refs
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const drawCountEl = document.getElementById('draw-count');
  const matchStatusEl = document.getElementById('match-status');
  const overlayWinner = document.getElementById('overlay-winner');
  const winnerTitle = document.getElementById('winner-title');
  const winnerSub = document.getElementById('winner-sub');
  const winnerIcon = document.getElementById('winner-icon');
  const toastEl = document.getElementById('toast');
  const btnRestart = document.getElementById('btn-restart');
  const btnRestartOverlay = document.getElementById('btn-restart-overlay');
  const btnResetStats = document.getElementById('btn-reset-stats');
  const btnUndo = document.getElementById('btn-undo');
  const selectDiff = document.getElementById('difficulty');
  const selectFirst = document.getElementById('first-player');
  const selectTheme = document.getElementById('theme-select');
  const btnSound = document.getElementById('btn-sound');
  const btnSettings = document.getElementById('btn-settings');
  const btnInfo = document.getElementById('btn-info');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsModal = document.getElementById('settings-modal');
  const volumeSlider = document.getElementById('volume-slider');
  const hoverSoundToggle = document.getElementById('hover-sound-toggle');
  const particlesToggle = document.getElementById('particles-toggle');
  const previewToggle = document.getElementById('preview-toggle');
  const timerSelect = document.getElementById('timer-select');
  const timerToggle = document.getElementById('timer-toggle');
  const timerDisplay = document.getElementById('timer-display');
  const historyList = document.getElementById('history-list');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const leaderboardList = document.getElementById('leaderboard-list');
  const modeTabs = document.querySelectorAll('.mode-tab');
  const symbolBtns = document.querySelectorAll('.symbol-btn');
  const difficultyGroup = document.getElementById('difficulty-group');

  // State
  const BOARD_SIZE = 3;
  let board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  let currentPlayer = 'x';
  let gameOver = false;
  let animating = false;
  let soundEnabled = true;
  let volume = 0.7;
  let hoverSound = true;
  let particlesEnabled = true;
  let previewEnabled = true;
  let particles = [];
  let winLine = null;
  let cellAnimations = {};
  let lastHovered = null;
  let score = { x: 0, o: 0, draw: 0 };
  let aiThinking = false;
  let difficulty = 'medium';
  let gameMode = 'ai'; // 'ai' or 'pvp'
  let playerSymbol = 'x'; // symbol chosen by human in AI mode
  let moveHistory = [];
  let leaderboard = [];
  let timerEnabled = false;
  let timerSeconds = 15;
  let timerRemaining = 15;
  let timerInterval = null;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let size = 0, cellSize = 0, padding = 0;

  // ===== LOCALSTORAGE =====
  function loadData() {
    try {
      const s = localStorage.getItem('jdv_v2_stats');
      if (s) score = JSON.parse(s);
      const lb = localStorage.getItem('jdv_v2_leaderboard');
      if (lb) leaderboard = JSON.parse(lb);
      const cfg = localStorage.getItem('jdv_v2_config');
      if (cfg) {
        const c = JSON.parse(cfg);
        soundEnabled = c.soundEnabled !== undefined ? c.soundEnabled : true;
        volume = c.volume !== undefined ? c.volume : 0.7;
        hoverSound = c.hoverSound !== undefined ? c.hoverSound : true;
        particlesEnabled = c.particlesEnabled !== undefined ? c.particlesEnabled : true;
        previewEnabled = c.previewEnabled !== undefined ? c.previewEnabled : true;
        timerEnabled = c.timerEnabled || false;
        timerSeconds = c.timerSeconds || 15;
        difficulty = c.difficulty || 'medium';
        gameMode = c.gameMode || 'ai';
        playerSymbol = c.playerSymbol || 'x';
        const th = c.theme || 'dark';
        document.body.setAttribute('data-theme', th);
        selectTheme.value = th;
        selectDiff.value = difficulty;
        timerToggle.checked = timerEnabled;
        timerSelect.value = String(timerSeconds);
        volumeSlider.value = Math.round(volume * 100);
        hoverSoundToggle.checked = hoverSound;
        particlesToggle.checked = particlesEnabled;
        previewToggle.checked = previewEnabled;
        updateModeUI();
        updateSymbolUI();
        updateTimerUI();
        updateSoundIcon();
      }
    } catch (e) {}
  }
  function saveStats() { try { localStorage.setItem('jdv_v2_stats', JSON.stringify(score)); } catch (e) {} }
  function saveLeaderboard() { try { localStorage.setItem('jdv_v2_leaderboard', JSON.stringify(leaderboard)); } catch (e) {} }
  function saveConfig() {
    try {
      localStorage.setItem('jdv_v2_config', JSON.stringify({
        soundEnabled, volume, hoverSound, particlesEnabled, previewEnabled,
        timerEnabled, timerSeconds, difficulty, gameMode, playerSymbol,
        theme: document.body.getAttribute('data-theme')
      }));
    } catch (e) {}
  }

  function updateScoreUI() {
    scoreXEl.textContent = score.x;
    scoreOEl.textContent = score.o;
    drawCountEl.textContent = `Empates: ${score.draw}`;
  }
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // ===== AUDIO =====
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playTone(type) {
    if (!soundEnabled) return;
    ensureAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const vol = volume;
    if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12 * vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.start(now); osc.stop(now + 0.22);
    } else if (type === 'win') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.12);
      osc.frequency.setValueAtTime(659, now + 0.24);
      osc.frequency.setValueAtTime(880, now + 0.36);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.14 * vol, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      osc.start(now); osc.stop(now + 0.7);
    } else if (type === 'lose') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.10 * vol, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.start(now); osc.stop(now + 0.45);
    } else if (type === 'draw') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(330, now + 0.15);
      osc.frequency.setValueAtTime(294, now + 0.30);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.10 * vol, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'hover') {
      if (!hoverSound) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.04 * vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'timeout') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12 * vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    }
  }

  // ===== PARTICLES =====
  function spawnParticles(x, y, color) {
    if (!particlesEnabled) return;
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.6;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, decay: 0.015 + Math.random() * 0.02, size: 1.5 + Math.random() * 2.5, color });
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ===== DRAWING =====
  function getThemeColors() {
    const style = getComputedStyle(document.body);
    return {
      accentX: style.getPropertyValue('--accent-x').trim() || '#f87171',
      accentO: style.getPropertyValue('--accent-o').trim() || '#34d399',
      border: style.getPropertyValue('--border-strong').trim() || 'rgba(148,163,184,0.22)',
      textMuted: style.getPropertyValue('--text-muted').trim() || '#64748b',
    };
  }

  function drawGrid() {
    const start = padding + cellSize;
    const end = padding + cellSize * 2;
    const lineW = Math.max(1.5, size * 0.0045);
    const colors = getThemeColors();
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(start, padding); ctx.lineTo(start, size - padding);
    ctx.moveTo(end, padding); ctx.lineTo(end, size - padding);
    ctx.moveTo(padding, start); ctx.lineTo(size - padding, start);
    ctx.moveTo(padding, end); ctx.lineTo(size - padding, end);
    ctx.stroke();
  }

  function drawX(cx, cy, s, progress = 1, glow = false) {
    const margin = s * 0.18;
    const hw = (s / 2 - margin) * progress;
    const hh = hw;
    const colors = getThemeColors();
    ctx.save();
    if (glow) {
      ctx.shadowColor = colors.accentX + '73';
      ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = colors.accentX;
    ctx.lineWidth = Math.max(2.5, size * 0.007);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - hh); ctx.lineTo(cx + hw, cy + hh);
    ctx.moveTo(cx + hw, cy - hh); ctx.lineTo(cx - hw, cy + hh);
    ctx.stroke();
    ctx.restore();
  }

  function drawO(cx, cy, s, progress = 1, glow = false) {
    const margin = s * 0.18;
    const r = (s / 2 - margin) * progress;
    const colors = getThemeColors();
    ctx.save();
    if (glow) {
      ctx.shadowColor = colors.accentO + '73';
      ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = colors.accentO;
    ctx.lineWidth = Math.max(2.5, size * 0.007);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.restore();
  }

  function drawHover() {
    if (!previewEnabled || !lastHovered || gameOver) return;
    if (gameMode === 'ai' && currentPlayer !== playerSymbol) return;
    const [r, c] = lastHovered;
    if (board[r][c]) return;
    const x = padding + c * cellSize + cellSize / 2;
    const y = padding + r * cellSize + cellSize / 2;
    ctx.save();
    ctx.globalAlpha = 0.12;
    if (currentPlayer === 'x') drawX(x, y, cellSize, 0.6);
    else drawO(x, y, cellSize, 0.6);
    ctx.restore();
  }

  function drawWinLine() {
    if (!winLine) return;
    const [r1, c1] = winLine.start;
    const [r2, c2] = winLine.end;
    const x1 = padding + c1 * cellSize + cellSize / 2;
    const y1 = padding + r1 * cellSize + cellSize / 2;
    const x2 = padding + c2 * cellSize + cellSize / 2;
    const y2 = padding + r2 * cellSize + cellSize / 2;
    const isX = board[r1][c1] === 'x';
    const colors = getThemeColors();
    ctx.save();
    ctx.shadowColor = isX ? colors.accentX + '8C' : colors.accentO + '8C';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = isX ? colors.accentX : colors.accentO;
    ctx.lineWidth = Math.max(3, size * 0.009);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, size, size);
    drawGrid();
    drawHover();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = board[r][c];
        if (!p) continue;
        const key = `${r},${c}`;
        const anim = cellAnimations[key] || { progress: 1 };
        const glow = winLine && ((winLine.start[0] === r && winLine.start[1] === c) || (winLine.end[0] === r && winLine.end[1] === c));
        const cx = padding + c * cellSize + cellSize / 2;
        const cy = padding + r * cellSize + cellSize / 2;
        if (p === 'x') drawX(cx, cy, cellSize, anim.progress, glow);
        else drawO(cx, cy, cellSize, anim.progress, glow);
      }
    }
    drawWinLine();
    drawParticles();
  }

  function animate() {
    if (!animating) return;
    let active = false;
    for (const key of Object.keys(cellAnimations)) {
      const a = cellAnimations[key];
      if (a.progress < 1) { a.progress += 0.06; active = true; }
      if (a.progress > 1) a.progress = 1;
    }
    updateParticles();
    draw();
    if (active || particles.length > 0) requestAnimationFrame(animate);
    else animating = false;
  }
  function startAnim() { animating = true; requestAnimationFrame(animate); }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    size = Math.min(rect.width, rect.height);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    padding = size * 0.06;
    cellSize = (size - padding * 2) / BOARD_SIZE;
    draw();
  }
  new ResizeObserver(resizeCanvas).observe(canvas.parentElement);

  // ===== GAME LOGIC =====
  function checkWinner(b) {
    const lines = [
      [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
      [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
      [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
    ];
    for (const line of lines) {
      const [a,b1,c1] = line;
      if (b[a[0]][a[1]] && b[a[0]][a[1]] === b[b1[0]][b1[1]] && b[a[0]][a[1]] === b[c1[0]][c1[1]]) {
        return { winner: b[a[0]][a[1]], line: [a, c1] };
      }
    }
    if (b.every(row => row.every(cell => cell))) return { winner: 'draw', line: null };
    return null;
  }
  function getAvailableMoves(b) {
    const moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (!b[r][c]) moves.push([r, c]);
    return moves;
  }
  function minimax(b, depth, isMaximizing, alpha, beta) {
    const result = checkWinner(b);
    if (result) {
      if (result.winner === 'o') return 10 - depth;
      if (result.winner === 'x') return depth - 10;
      return 0;
    }
    const moves = getAvailableMoves(b);
    if (isMaximizing) {
      let best = -Infinity;
      for (const [r, c] of moves) {
        b[r][c] = 'o'; best = Math.max(best, minimax(b, depth + 1, false, alpha, beta)); b[r][c] = null;
        alpha = Math.max(alpha, best); if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const [r, c] of moves) {
        b[r][c] = 'x'; best = Math.min(best, minimax(b, depth + 1, true, alpha, beta)); b[r][c] = null;
        beta = Math.min(beta, best); if (beta <= alpha) break;
      }
      return best;
    }
  }
  function bestMove(b, diff) {
    const moves = getAvailableMoves(b);
    if (moves.length === 0) return null;
    if (diff === 'easy') return moves[Math.floor(Math.random() * moves.length)];
    if (diff === 'medium') {
      if (Math.random() < 0.5) return moves[Math.floor(Math.random() * moves.length)];
    }
    if (diff === 'hard') {
      let bestScore = -Infinity, bm = moves[0];
      for (const [r, c] of moves) { b[r][c] = 'o'; let sc = minimax(b, 0, false, -Infinity, Infinity); b[r][c] = null; if (sc > bestScore) { bestScore = sc; bm = [r, c]; } }
      return bm;
    }
    let bestScore = -Infinity, bm = moves[0];
    for (const [r, c] of moves) { b[r][c] = 'o'; let sc = minimax(b, 0, false, -Infinity, Infinity); b[r][c] = null; if (sc > bestScore) { bestScore = sc; bm = [r, c]; } }
    return bm;
  }

  function addToLeaderboard(winner) {
    const now = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    let name = winner === 'draw' ? 'Empate' : (winner === 'x' ? 'Jogador X' : 'Jogador O');
    if (gameMode === 'ai') {
      if (winner === playerSymbol) name = 'Você';
      else if (winner === 'draw') name = 'Empate';
      else name = 'Computador';
    }
    leaderboard.unshift({ name, winner, mode: gameMode, date: now });
    if (leaderboard.length > 20) leaderboard.pop();
    saveLeaderboard();
    renderLeaderboard();
  }

  function renderLeaderboard() {
    if (!leaderboard.length) { leaderboardList.innerHTML = '<div class="leaderboard-empty">Nenhuma partida registrada ainda</div>'; return; }
    leaderboardList.innerHTML = leaderboard.map((item, i) => `
      <div class="leaderboard-item">
        <span class="lb-rank">#${i+1}</span>
        <span class="lb-name">${item.name} <small style="color:var(--text-muted);font-weight:400">(${item.mode === 'ai' ? 'vs IA' : '2 Jogadores'})</small></span>
        <span class="lb-score">${item.date}</span>
      </div>
    `).join('');
  }

  function addHistory(r, c, player) {
    const labels = ['A','B','C'];
    const moveText = `${player.toUpperCase()} → ${labels[c]}${r+1}`;
    moveHistory.push({ r, c, player, text: moveText });
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<span class="sym ${player}">${player.toUpperCase()}</span> ${labels[c]}${r+1}`;
    historyList.appendChild(div);
    historyList.scrollTop = historyList.scrollHeight;
  }
  function clearHistory() {
    moveHistory = [];
    historyList.innerHTML = '';
  }

  function startTimer() {
    if (!timerEnabled || gameOver) return;
    stopTimer();
    timerRemaining = timerSeconds;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timerRemaining--;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        stopTimer();
        playTone('timeout');
        showToast('Tempo esgotado! Passando a vez...');
        if (gameMode === 'ai' && currentPlayer === playerSymbol) {
          // AI gets a free move if player timeouts in AI mode
          aiMove();
        } else {
          currentPlayer = currentPlayer === 'x' ? 'o' : 'x';
          updateStatus();
          startTimer();
        }
      }
    }, 1000);
  }
  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
  function updateTimerDisplay() {
    if (!timerEnabled) return;
    timerDisplay.querySelector('b').textContent = timerRemaining;
  }
  function updateTimerUI() {
    if (timerEnabled) timerDisplay.classList.remove('hidden');
    else timerDisplay.classList.add('hidden');
  }

  function updateStatus() {
    if (gameOver) return;
    if (gameMode === 'pvp') {
      matchStatusEl.textContent = currentPlayer === 'x' ? 'Vez do Jogador X' : 'Vez do Jogador O';
    } else {
      matchStatusEl.textContent = currentPlayer === playerSymbol ? 'Sua vez' : 'Computador pensando...';
    }
  }

  function endGame(result) {
    gameOver = true; winLine = result.line ? { start: result.line[0], end: result.line[1] } : null;
    stopTimer();
    const colors = getThemeColors();
    if (result.winner === 'x') {
      score.x++; playTone('win');
      if (gameMode === 'ai' && playerSymbol === 'x') { winnerTitle.textContent = 'Vitória!'; winnerSub.textContent = 'Você venceu esta rodada.'; }
      else if (gameMode === 'ai') { winnerTitle.textContent = 'Derrota'; winnerSub.textContent = 'O computador venceu. Tente novamente!'; playTone('lose'); }
      else { winnerTitle.textContent = 'Jogador X Venceu!'; winnerSub.textContent = 'Parabéns ao jogador X!'; }
      winnerIcon.textContent = '✕'; winnerIcon.style.color = colors.accentX;
      spawnParticles(size/2, size/2, colors.accentX);
    } else if (result.winner === 'o') {
      score.o++; playTone('win');
      if (gameMode === 'ai' && playerSymbol === 'o') { winnerTitle.textContent = 'Vitória!'; winnerSub.textContent = 'Você venceu esta rodada.'; }
      else if (gameMode === 'ai') { winnerTitle.textContent = 'Derrota'; winnerSub.textContent = 'O computador venceu. Tente novamente!'; playTone('lose'); }
      else { winnerTitle.textContent = 'Jogador O Venceu!'; winnerSub.textContent = 'Parabéns ao jogador O!'; }
      winnerIcon.textContent = '◯'; winnerIcon.style.color = colors.accentO;
      spawnParticles(size/2, size/2, colors.accentO);
    } else {
      score.draw++; playTone('draw');
      winnerTitle.textContent = 'Empate'; winnerSub.textContent = 'Ninguém venceu desta vez.';
      winnerIcon.textContent = '✕◯'; winnerIcon.style.color = colors.textMuted;
    }
    addToLeaderboard(result.winner);
    saveStats(); updateScoreUI();
    matchStatusEl.textContent = result.winner === 'draw' ? 'Empate' : (result.winner === 'x' ? 'X venceu' : 'O venceu');
    setTimeout(() => { overlayWinner.classList.remove('hidden'); }, result.winner === 'draw' ? 400 : 700);
  }

  function makeMove(r, c, player) {
    if (board[r][c] || gameOver) return false;
    board[r][c] = player;
    cellAnimations[`${r},${c}`] = { progress: 0 };
    playTone('move');
    addHistory(r, c, player);
    const cx = padding + c * cellSize + cellSize / 2;
    const cy = padding + r * cellSize + cellSize / 2;
    const colors = getThemeColors();
    spawnParticles(cx, cy, player === 'x' ? colors.accentX : colors.accentO);
    startAnim();
    const result = checkWinner(board);
    if (result) { endGame(result); return true; }
    currentPlayer = currentPlayer === 'x' ? 'o' : 'x';
    updateStatus();
    startTimer();
    return true;
  }

  function aiMove() {
    if (gameOver || gameMode !== 'ai') return;
    const aiSymbol = playerSymbol === 'x' ? 'o' : 'x';
    if (currentPlayer !== aiSymbol) return;
    aiThinking = true;
    matchStatusEl.textContent = 'Computador pensando...';
    const delay = difficulty === 'impossible' ? 350 + Math.random() * 250 : 220 + Math.random() * 300;
    setTimeout(() => {
      const move = bestMove(board.map(r => [...r]), difficulty);
      if (move) makeMove(move[0], move[1], aiSymbol);
      aiThinking = false;
      draw();
    }, delay);
  }

  function undo() {
    if (gameOver || moveHistory.length === 0) return;
    // Undo AI + player in AI mode, or just last move in PvP
    if (gameMode === 'ai' && moveHistory.length >= 2) {
      const last = moveHistory.pop();
      board[last.r][last.c] = null;
      delete cellAnimations[`${last.r},${last.c}`];
      const prev = moveHistory.pop();
      board[prev.r][prev.c] = null;
      delete cellAnimations[`${prev.r},${prev.c}`];
      currentPlayer = playerSymbol;
    } else if (gameMode === 'pvp' && moveHistory.length >= 1) {
      const last = moveHistory.pop();
      board[last.r][last.c] = null;
      delete cellAnimations[`${last.r},${last.c}`];
      currentPlayer = last.player;
    } else {
      const last = moveHistory.pop();
      board[last.r][last.c] = null;
      delete cellAnimations[`${last.r},${last.c}`];
      currentPlayer = last.player;
    }
    // Rebuild history DOM
    historyList.innerHTML = '';
    for (const m of moveHistory) {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `<span class="sym ${m.player}">${m.player.toUpperCase()}</span> ${['A','B','C'][m.c]}${m.r+1}`;
      historyList.appendChild(div);
    }
    updateStatus();
    draw();
    startTimer();
    showToast('Jogada desfeita');
  }

  function restart() {
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    gameOver = false; winLine = null; cellAnimations = {}; aiThinking = false;
    overlayWinner.classList.add('hidden');
    clearHistory();
    stopTimer();

    const policy = selectFirst.value;
    if (policy === 'x') currentPlayer = 'x';
    else if (policy === 'o') currentPlayer = 'o';
    else currentPlayer = Math.random() < 0.5 ? 'x' : 'o';

    updateStatus();
    draw();
    startTimer();
    if (gameMode === 'ai' && currentPlayer !== playerSymbol) aiMove();
  }

  // ===== INPUT =====
  function getCellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width / dpr);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height / dpr);
    if (x < padding || y < padding || x > size - padding || y > size - padding) return null;
    const c = Math.floor((x - padding) / cellSize);
    const r = Math.floor((y - padding) / cellSize);
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) return [r, c];
    return null;
  }

  function isPlayerTurn() {
    if (gameOver || aiThinking) return false;
    if (gameMode === 'pvp') return true;
    return currentPlayer === playerSymbol;
  }

  function handleCellClick(r, c) {
    if (!isPlayerTurn()) return;
    if (makeMove(r, c, currentPlayer)) {
      if (gameMode === 'ai' && !gameOver) aiMove();
    }
  }

  canvas.addEventListener('mousemove', e => {
    const prev = lastHovered;
    lastHovered = getCellFromEvent(e);
    if (hoverSound && lastHovered && (!prev || lastHovered[0] !== prev[0] || lastHovered[1] !== prev[1])) {
      if (isPlayerTurn() && board[lastHovered[0]][lastHovered[1]] === null) playTone('hover');
    }
    draw();
  });
  canvas.addEventListener('mouseleave', () => { lastHovered = null; draw(); });
  canvas.addEventListener('click', e => {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    handleCellClick(cell[0], cell[1]);
  });
  canvas.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width / dpr);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height / dpr);
    if (x < padding || y < padding || x > size - padding || y > size - padding) return;
    const c = Math.floor((x - padding) / cellSize);
    const r = Math.floor((y - padding) / cellSize);
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) handleCellClick(r, c);
  }, { passive: true });

  // ===== UI UPDATES =====
  function updateModeUI() {
    modeTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.mode === gameMode);
    });
    if (gameMode === 'pvp') {
      difficultyGroup.style.display = 'none';
      document.querySelector('.player-choice-group').style.display = 'none';
    } else {
      difficultyGroup.style.display = 'flex';
      document.querySelector('.player-choice-group').style.display = 'flex';
    }
  }
  function updateSymbolUI() {
    symbolBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.symbol === playerSymbol);
    });
  }
  function updateSoundIcon() {
    btnSound.innerHTML = soundEnabled
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
    btnSound.title = soundEnabled ? 'Som: ligado' : 'Som: desligado';
  }

  // ===== CONTROLS =====
  btnRestart.addEventListener('click', () => { restart(); showToast('Nova partida iniciada'); });
  btnRestartOverlay.addEventListener('click', () => { restart(); });
  btnResetStats.addEventListener('click', () => {
    score = { x: 0, o: 0, draw: 0 }; saveStats(); updateScoreUI();
    leaderboard = []; saveLeaderboard(); renderLeaderboard();
    showToast('Estatísticas e ranking zerados');
  });
  btnUndo.addEventListener('click', () => undo());
  selectDiff.addEventListener('change', e => { difficulty = e.target.value; saveConfig(); showToast('Dificuldade: ' + e.target.options[e.target.selectedIndex].text); });
  selectFirst.addEventListener('change', e => { saveConfig(); });

  selectTheme.addEventListener('change', e => {
    const t = e.target.value;
    document.body.setAttribute('data-theme', t);
    saveConfig();
    showToast('Tema alterado');
    draw();
  });

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled; updateSoundIcon(); saveConfig();
    showToast(soundEnabled ? 'Som ligado' : 'Som desligado');
  });

  btnSettings.addEventListener('click', () => { settingsModal.classList.remove('hidden'); });
  btnCloseSettings.addEventListener('click', () => { settingsModal.classList.add('hidden'); });
  settingsModal.querySelector('.modal-overlay').addEventListener('click', () => { settingsModal.classList.add('hidden'); });

  volumeSlider.addEventListener('input', e => { volume = parseInt(e.target.value) / 100; saveConfig(); });
  hoverSoundToggle.addEventListener('change', e => { hoverSound = e.target.checked; saveConfig(); });
  particlesToggle.addEventListener('change', e => { particlesEnabled = e.target.checked; saveConfig(); });
  previewToggle.addEventListener('change', e => { previewEnabled = e.target.checked; saveConfig(); });
  timerSelect.addEventListener('change', e => { timerSeconds = parseInt(e.target.value); timerRemaining = timerSeconds; updateTimerDisplay(); saveConfig(); });
  timerToggle.addEventListener('change', e => {
    timerEnabled = e.target.checked;
    updateTimerUI();
    if (timerEnabled) startTimer(); else stopTimer();
    saveConfig();
  });

  btnClearHistory.addEventListener('click', () => { clearHistory(); showToast('Histórico limpo'); });

  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      gameMode = tab.dataset.mode;
      updateModeUI();
      saveConfig();
      restart();
      showToast(gameMode === 'ai' ? 'Modo: vs Computador' : 'Modo: 2 Jogadores');
    });
  });

  symbolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      playerSymbol = btn.dataset.symbol;
      updateSymbolUI();
      saveConfig();
      restart();
      showToast(`Você joga como ${playerSymbol.toUpperCase()}`);
    });
  });

  btnInfo.addEventListener('click', () => { showToast('Jogo da Velha Pro v2.0 — Ultimate Edition com temas, timer, undo e multiplayer'); });

  // ===== INIT =====
  loadData();
  resizeCanvas();
  draw();
  renderLeaderboard();
  restart();
})();
