/* ===================================================
   GENESIS EDITORIAL — app.js
   =================================================== */

/* ---------- PAGE NAVIGATION ---------- */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');

  // update nav active state
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const map = { inicio: 0, juegos: 1, contacto: 2 };
  if (map[id] !== undefined) {
    document.querySelectorAll('.nav-btn')[map[id]].classList.add('active');
  }

  // show/hide search bar (only on pages with it in the design)
  const hasSearch = ['juegos', 'laberinto', 'conecta'].includes(id);
  const navSearch = document.getElementById('navSearch');
  if (navSearch) navSearch.style.display = hasSearch ? 'flex' : 'none';

  // init games when opened
  if (id === 'laberinto') initMaze();
  if (id === 'quiz')      initQuiz();
  if (id === 'conecta')   initConecta();

  window.scrollTo(0, 0);
}

/* ===================================================
   LABERINTO (maze)
   =================================================== */
const MAZE_CONFIG = {
  cols: 20,
  rows: 16,
  seed: 20260614,
  start: { c: 0, r: 1 },
  goal: { c: 19, r: 14 }
};

let mazeCanvas;
let mazeCtx;
let mazeGrid;
let mazeLayout;
let mazePath = [];
let mazeDrawing = false;
let mazeSolved = false;
let mazeResizeTimer;
let mazeEventsBound = false;

function initMaze() {
  mazeCanvas = document.getElementById('mazeCanvas');
  if (!mazeCanvas) return;

  mazeCtx = mazeCanvas.getContext('2d');
  mazeGrid = createMazeGrid(MAZE_CONFIG.cols, MAZE_CONFIG.rows);
  generateMaze(MAZE_CONFIG.start, createSeededRandom(MAZE_CONFIG.seed));
  mazeGrid[MAZE_CONFIG.start.r][MAZE_CONFIG.start.c].walls.left = false;
  mazeGrid[MAZE_CONFIG.goal.r][MAZE_CONFIG.goal.c].walls.right = false;
  mazePath = [];
  mazeDrawing = false;
  mazeSolved = false;

  bindMazeEvents();
  resizeMazeCanvas();
  setMazeStatus('Empieza en el punto verde y guía a la paloma hasta el nido.');
}

function createMazeGrid(cols, rows) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      c,
      r,
      visited: false,
      walls: { top: true, right: true, bottom: true, left: true }
    }))
  );
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMaze(startPosition, random) {
  const stack = [];
  const start = mazeGrid[startPosition.r][startPosition.c];
  start.visited = true;
  stack.push(start);

  while (stack.length) {
    const current = stack[stack.length - 1];
    const candidates = getUnvisitedNeighbors(current);

    if (!candidates.length) {
      stack.pop();
      continue;
    }

    const next = candidates[Math.floor(random() * candidates.length)];
    removeWallBetween(current, next);
    next.visited = true;
    stack.push(next);
  }

  mazeGrid.flat().forEach(cell => {
    delete cell.visited;
  });
}

function getUnvisitedNeighbors(cell) {
  const neighbors = [];
  const { c, r } = cell;

  if (r > 0 && !mazeGrid[r - 1][c].visited) neighbors.push(mazeGrid[r - 1][c]);
  if (c < MAZE_CONFIG.cols - 1 && !mazeGrid[r][c + 1].visited) neighbors.push(mazeGrid[r][c + 1]);
  if (r < MAZE_CONFIG.rows - 1 && !mazeGrid[r + 1][c].visited) neighbors.push(mazeGrid[r + 1][c]);
  if (c > 0 && !mazeGrid[r][c - 1].visited) neighbors.push(mazeGrid[r][c - 1]);

  return neighbors;
}

function removeWallBetween(current, next) {
  const deltaC = next.c - current.c;
  const deltaR = next.r - current.r;

  if (deltaC === 1) {
    current.walls.right = false;
    next.walls.left = false;
  } else if (deltaC === -1) {
    current.walls.left = false;
    next.walls.right = false;
  } else if (deltaR === 1) {
    current.walls.bottom = false;
    next.walls.top = false;
  } else if (deltaR === -1) {
    current.walls.top = false;
    next.walls.bottom = false;
  }
}

function bindMazeEvents() {
  if (mazeEventsBound) return;
  mazeEventsBound = true;

  mazeCanvas.addEventListener('pointerdown', startMazePath);
  mazeCanvas.addEventListener('pointermove', continueMazePath);
  mazeCanvas.addEventListener('pointerup', stopMazePath);
  mazeCanvas.addEventListener('pointercancel', stopMazePath);
  mazeCanvas.addEventListener('pointerleave', stopMazePath);

  window.addEventListener('resize', () => {
    clearTimeout(mazeResizeTimer);
    mazeResizeTimer = setTimeout(() => {
      if (document.getElementById('page-laberinto')?.classList.contains('active')) {
        resizeMazeCanvas();
      }
    }, 120);
  });
}

function resizeMazeCanvas() {
  const rect = mazeCanvas.getBoundingClientRect();
  const width = Math.max(300, Math.round(rect.width));
  const height = Math.round(width * 0.76);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  mazeCanvas.width = Math.round(width * pixelRatio);
  mazeCanvas.height = Math.round(height * pixelRatio);
  mazeCanvas.style.height = `${height}px`;
  mazeCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const padding = Math.max(22, Math.round(width * 0.035));
  const cellSize = Math.min(
    (width - padding * 2) / MAZE_CONFIG.cols,
    (height - padding * 2) / MAZE_CONFIG.rows
  );

  mazeLayout = {
    width,
    height,
    cellSize,
    offsetX: (width - cellSize * MAZE_CONFIG.cols) / 2,
    offsetY: (height - cellSize * MAZE_CONFIG.rows) / 2
  };

  drawMaze();
}

function drawMaze() {
  if (!mazeLayout) return;

  const { width, height, cellSize, offsetX, offsetY } = mazeLayout;
  mazeCtx.clearRect(0, 0, width, height);
  mazeCtx.fillStyle = '#ffffff';
  mazeCtx.fillRect(0, 0, width, height);

  mazeCtx.strokeStyle = '#171717';
  mazeCtx.lineWidth = Math.max(2, cellSize * 0.065);
  mazeCtx.lineCap = 'square';
  mazeCtx.lineJoin = 'miter';
  mazeCtx.beginPath();

  for (let r = 0; r < MAZE_CONFIG.rows; r++) {
    for (let c = 0; c < MAZE_CONFIG.cols; c++) {
      const cell = mazeGrid[r][c];
      const x = offsetX + c * cellSize;
      const y = offsetY + r * cellSize;

      if (cell.walls.top) {
        mazeCtx.moveTo(x, y);
        mazeCtx.lineTo(x + cellSize, y);
      }
      if (cell.walls.right) {
        mazeCtx.moveTo(x + cellSize, y);
        mazeCtx.lineTo(x + cellSize, y + cellSize);
      }
      if (cell.walls.bottom) {
        mazeCtx.moveTo(x + cellSize, y + cellSize);
        mazeCtx.lineTo(x, y + cellSize);
      }
      if (cell.walls.left) {
        mazeCtx.moveTo(x, y + cellSize);
        mazeCtx.lineTo(x, y);
      }
    }
  }

  mazeCtx.stroke();
  drawMazePath();
  drawMazeMarkers();
}

function drawMazePath() {
  if (!mazePath.length) return;

  const startCenter = getCellCenter(MAZE_CONFIG.start);
  const firstCenter = getCellCenter(mazePath[0]);
  mazeCtx.strokeStyle = mazeSolved ? '#68a62f' : '#e63946';
  mazeCtx.lineWidth = Math.max(4, mazeLayout.cellSize * 0.18);
  mazeCtx.lineCap = 'round';
  mazeCtx.lineJoin = 'round';
  mazeCtx.beginPath();
  mazeCtx.moveTo(mazeLayout.offsetX - mazeLayout.cellSize * 0.42, startCenter.y);
  mazeCtx.lineTo(firstCenter.x, firstCenter.y);

  mazePath.slice(1).forEach(cell => {
    const center = getCellCenter(cell);
    mazeCtx.lineTo(center.x, center.y);
  });

  if (mazeSolved) {
    const goalCenter = getCellCenter(MAZE_CONFIG.goal);
    mazeCtx.lineTo(mazeLayout.offsetX + MAZE_CONFIG.cols * mazeLayout.cellSize + mazeLayout.cellSize * 0.42, goalCenter.y);
  }

  mazeCtx.stroke();
}

function drawMazeMarkers() {
  const start = getCellCenter(MAZE_CONFIG.start);
  const goal = getCellCenter(MAZE_CONFIG.goal);
  const radius = Math.max(5, mazeLayout.cellSize * 0.2);

  mazeCtx.fillStyle = '#78b936';
  mazeCtx.beginPath();
  mazeCtx.arc(start.x, start.y, radius, 0, Math.PI * 2);
  mazeCtx.fill();

  mazeCtx.fillStyle = '#f2b84b';
  mazeCtx.beginPath();
  mazeCtx.arc(goal.x, goal.y, radius, 0, Math.PI * 2);
  mazeCtx.fill();
}

function startMazePath(event) {
  if (mazeSolved) return;

  const cell = getMazeCellFromEvent(event);
  if (!cell || !sameCell(cell, MAZE_CONFIG.start)) {
    setMazeStatus('Debes comenzar en el punto verde.', 'warning');
    return;
  }

  mazeDrawing = true;
  mazePath = [{ ...MAZE_CONFIG.start }];
  mazeCanvas.setPointerCapture?.(event.pointerId);
  setMazeStatus('Sigue los pasillos sin atravesar las paredes.');
  drawMaze();
  event.preventDefault();
}

function continueMazePath(event) {
  if (!mazeDrawing || mazeSolved) return;

  const point = getMazePoint(event);
  const previousPoint = getCellCenter(mazePath[mazePath.length - 1]);
  const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
  const samples = Math.max(1, Math.ceil(distance / (mazeLayout.cellSize * 0.35)));

  for (let index = 1; index <= samples; index++) {
    const sample = {
      x: previousPoint.x + (point.x - previousPoint.x) * (index / samples),
      y: previousPoint.y + (point.y - previousPoint.y) * (index / samples)
    };
    const cell = getMazeCellFromPoint(sample);
    if (cell) addCellToMazePath(cell);
  }

  drawMaze();
  event.preventDefault();
}

function addCellToMazePath(cell) {
  const current = mazePath[mazePath.length - 1];
  if (sameCell(cell, current)) return;

  const previous = mazePath[mazePath.length - 2];
  if (previous && sameCell(cell, previous)) {
    mazePath.pop();
    return;
  }

  if (!canMoveBetween(current, cell)) return;

  mazePath.push({ c: cell.c, r: cell.r });
  if (sameCell(cell, MAZE_CONFIG.goal)) {
    mazeSolved = true;
    mazeDrawing = false;
    setMazeStatus('¡Llegaste al nido! Laberinto completado.', 'success');
  }
}

function canMoveBetween(from, to) {
  const deltaC = to.c - from.c;
  const deltaR = to.r - from.r;
  if (Math.abs(deltaC) + Math.abs(deltaR) !== 1) return false;

  const cell = mazeGrid[from.r][from.c];
  if (deltaC === 1) return !cell.walls.right;
  if (deltaC === -1) return !cell.walls.left;
  if (deltaR === 1) return !cell.walls.bottom;
  return !cell.walls.top;
}

function stopMazePath(event) {
  mazeDrawing = false;
  if (event?.pointerId !== undefined && mazeCanvas.hasPointerCapture?.(event.pointerId)) {
    mazeCanvas.releasePointerCapture(event.pointerId);
  }
}

function resetMazePath() {
  mazePath = [];
  mazeDrawing = false;
  mazeSolved = false;
  setMazeStatus('Empieza en el punto verde y guía a la paloma hasta el nido.');
  drawMaze();
}

function getMazePoint(event) {
  const rect = mazeCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getMazeCellFromEvent(event) {
  return getMazeCellFromPoint(getMazePoint(event));
}

function getMazeCellFromPoint(point) {
  const c = Math.floor((point.x - mazeLayout.offsetX) / mazeLayout.cellSize);
  const r = Math.floor((point.y - mazeLayout.offsetY) / mazeLayout.cellSize);

  if (c < 0 || c >= MAZE_CONFIG.cols || r < 0 || r >= MAZE_CONFIG.rows) return null;
  return { c, r };
}

function getCellCenter(cell) {
  return {
    x: mazeLayout.offsetX + (cell.c + 0.5) * mazeLayout.cellSize,
    y: mazeLayout.offsetY + (cell.r + 0.5) * mazeLayout.cellSize
  };
}

function sameCell(first, second) {
  return first.c === second.c && first.r === second.r;
}

function setMazeStatus(message, state = '') {
  const status = document.getElementById('mazeStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `maze-status${state ? ` ${state}` : ''}`;
}

/* ===================================================
   QUIZ
   =================================================== */
const PREGUNTAS = [
  {
    q: '¿Cuál es el ave nacional de Nicaragua?',
    opts: ['Quetzal', 'Guardabarranco', 'Tucán', 'Garza'],
    correct: 1
  },
  {
    q: '¿Dónde hace su nido el Guardabarranco?',
    opts: ['En árboles altos', 'En túneles en barrancos', 'En el suelo', 'En cuevas'],
    correct: 1
  },
  {
    q: '¿Cuántas especies de aves viven en Nicaragua?',
    opts: ['Más de 100', 'Más de 300', 'Más de 750', 'Más de 1000'],
    correct: 2
  },
  {
    q: '¿Qué hace especial al pico del tucán?',
    opts: ['Es muy pesado', 'Es hueco y liviano', 'Brilla en la oscuridad', 'Cambia de color'],
    correct: 1
  },
  {
    q: '¿Cuánto pueden vivir las guacamayas rojas?',
    opts: ['10 años', '25 años', '50 años', '100 años'],
    correct: 2
  },
  {
    q: '¿Dónde vive el Quetzal en Nicaragua?',
    opts: ['En la playa', 'En los bosques nubosos', 'En el desierto', 'En las ciudades'],
    correct: 1
  },
];

let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

function initQuiz() {
  quizIndex    = 0;
  quizScore    = 0;
  quizAnswered = false;
  document.getElementById('quizCard').style.display = 'block';
  document.getElementById('quizEnd').style.display  = 'none';
  renderQuestion();
}

function renderQuestion() {
  const q = PREGUNTAS[quizIndex];
  document.getElementById('pregLabel').textContent = `Pregunta ${quizIndex + 1} de ${PREGUNTAS.length}`;
  document.getElementById('puntLabel').textContent  = `Puntaje: ${quizScore}`;
  document.getElementById('quizQ').textContent      = q.q;
  document.getElementById('quizFill').style.width   = `${((quizIndex) / PREGUNTAS.length) * 100}%`;
  document.getElementById('quizFeedback').style.display = 'none';
  document.getElementById('quizNext').style.display     = 'none';
  quizAnswered = false;

  const optsDiv = document.getElementById('quizOpts');
  optsDiv.innerHTML = '';
  q.opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className   = 'quiz-opt';
    btn.textContent = opt;
    btn.onclick     = () => answerQuiz(i);
    optsDiv.appendChild(btn);
  });
}

function answerQuiz(chosen) {
  if (quizAnswered) return;
  quizAnswered = true;
  const q    = PREGUNTAS[quizIndex];
  const opts = document.querySelectorAll('.quiz-opt');
  const fb   = document.getElementById('quizFeedback');
  const next = document.getElementById('quizNext');

  opts.forEach(b => b.disabled = true);

  if (chosen === q.correct) {
    quizScore++;
    opts[chosen].classList.add('correct');
    fb.className   = 'quiz-feedback ok';
    fb.textContent = '¡Felicidades! ' + opts[q.correct].textContent + ' es correcto';
  } else {
    opts[chosen].classList.add('wrong');
    opts[q.correct].classList.add('correct');
    fb.className   = 'quiz-feedback err';
    fb.textContent = 'El ave nacional es ' + opts[q.correct].textContent + ' es correcto';
  }
  fb.style.display   = 'block';
  next.style.display = 'block';
  document.getElementById('puntLabel').textContent = `Puntaje: ${quizScore}`;
}

function nextQuestion() {
  quizIndex++;
  if (quizIndex >= PREGUNTAS.length) {
    endQuiz();
  } else {
    renderQuestion();
  }
}

function endQuiz() {
  document.getElementById('quizCard').style.display = 'none';
  document.getElementById('quizEnd').style.display  = 'block';
  document.getElementById('quizScore').textContent  =
    `Obtuviste ${quizScore} de ${PREGUNTAS.length} correctas. ${
      quizScore === PREGUNTAS.length ? '🏆 ¡Perfecto!' :
      quizScore >= 4 ? '🎉 ¡Muy bien!' : '📚 ¡Sigue aprendiendo!'
    }`;
}

function restartQuiz() { initQuiz(); }

/* ===================================================
   CONECTA LAS AVES (drag & drop)
   =================================================== */
const CONECTA_DATA = [
  { img: 'Proyecto/Assets/Img/Guardabarranco.png', 
    name: 'Guardabarranco' },
  {
    img: 'Proyecto/Assets/Img/Quetzal.png',
    name: 'Quetzal'
  },
  {
    img: 'Proyecto/Assets/Img/Tucan.png',
    name: 'Tucán',
    gray: true
  },
  {
    img: 'Proyecto/Assets/Img/Guacamaya.png',
    name: 'Guacamaya Roja'
  },
];

let aciertos = 0;

function initConecta() {
  aciertos = 0;
  document.getElementById('aciertos').textContent = '0';
  renderConecta();
}

function resetConecta() { initConecta(); }

function renderConecta() {
  const imgsDiv  = document.getElementById('conectaImages');
  const namesDiv = document.getElementById('conectaNames');
  imgsDiv.innerHTML  = '';
  namesDiv.innerHTML = '';

  // shuffle names
  const shuffled = [...CONECTA_DATA].sort(() => Math.random() - 0.5);

  CONECTA_DATA.forEach((bird, i) => {
    const slot = document.createElement('div');
    slot.className    = 'conecta-img-slot';
    slot.dataset.name = bird.name;

    if (bird.img) {
      const img = document.createElement('img');
      img.src = bird.img;
      img.alt = bird.name;
      if (bird.gray) img.style.filter = 'grayscale(1)';
      slot.appendChild(img);
    } else {
      slot.style.fontSize = '3rem';
      slot.textContent    = bird.emoji || '🐦';
      if (bird.color) slot.style.background = bird.color;
    }

    // drag over
    slot.addEventListener('dragover', e => {
      e.preventDefault();
      slot.classList.add('dragover');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('dragover');
      const dragged = e.dataTransfer.getData('text/plain');
      if (dragged === slot.dataset.name) {
        slot.classList.add('matched');
        // hide the dragged tag
        document.querySelectorAll('.nombre-tag').forEach(t => {
          if (t.dataset.name === dragged) t.classList.add('used');
        });
        aciertos++;
        document.getElementById('aciertos').textContent = aciertos;
        if (aciertos === CONECTA_DATA.length) {
          setTimeout(() => alert('🎉 ¡Conectaste todas las aves correctamente!'), 200);
        }
      } else {
        slot.style.borderColor = '#fc8181';
        setTimeout(() => { slot.style.borderColor = ''; }, 600);
      }
    });

    imgsDiv.appendChild(slot);
  });

  shuffled.forEach(bird => {
    const tag = document.createElement('div');
    tag.className     = 'nombre-tag';
    tag.textContent   = bird.name;
    tag.dataset.name  = bird.name;
    tag.draggable     = true;
    tag.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', bird.name);
    });
    namesDiv.appendChild(tag);
  });
}

/* ===================================================
   INIT
   =================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const requestedPage = new URLSearchParams(window.location.search).get('page');
  const availablePages = ['inicio', 'juegos', 'contacto', 'laberinto', 'quiz', 'conecta'];
  showPage(availablePages.includes(requestedPage) ? requestedPage : 'inicio');
});

// Footer download: smooth-scroll to top then open PDF
document.addEventListener('DOMContentLoaded', () => {
  const dl = document.getElementById('downloadLink');
  if (!dl) return;
  dl.addEventListener('click', function (e) {
    // Prevent immediate navigation to allow a smooth scroll to the top
    e.preventDefault();
    const href = this.href;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Open the PDF after scrolling begins (short delay)
    setTimeout(() => { window.open(href, '_blank', 'noopener'); }, 480);
  });
});
