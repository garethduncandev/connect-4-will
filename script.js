const ROWS = 6;
const COLS = 7;
const WILL = 'will';
const GARETH = 'gareth';

let board = [];
let placedOrder = [];
let moveCounter = 0;
let gameOver = false;
let currentTurn = WILL;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const restartBtn = document.getElementById('restart');

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function buildBoardDom() {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      const disc = document.createElement('div');
      disc.className = 'disc empty';
      cell.appendChild(disc);
      cell.addEventListener('click', () => onColumnClick(c));
      boardEl.appendChild(cell);
    }
  }
}

function render() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      const disc = cell.querySelector('.disc');
      const value = board[r][c];
      disc.className = 'disc ' + (value ? value : 'empty');
    }
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function logMessage(text) {
  logEl.textContent = text;
}

function lowestEmptyRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) return r;
  }
  return -1;
}

function isColumnFull(col) {
  return board[0][col] !== null;
}

function isBoardFull() {
  for (let c = 0; c < COLS; c++) {
    if (!isColumnFull(c)) return false;
  }
  return true;
}

// Returns the cell among `line` that was placed earliest.
function earliestCell(line) {
  return line.reduce((a, b) => (placedOrder[a.row][a.col] <= placedOrder[b.row][b.col] ? a : b));
}

// Returns array of winning lines (each an array of 4 {row, col} cells)
// found through the given cell, for the given color.
function findLinesThrough(row, col, color) {
  const directions = [
    { dr: 0, dc: 1 },  // horizontal
    { dr: 1, dc: 0 },  // vertical
    { dr: 1, dc: 1 },  // diagonal down-right
    { dr: 1, dc: -1 }, // diagonal down-left
  ];

  const lines = [];

  for (const { dr, dc } of directions) {
    // Walk to the "start" end of the run (most negative direction).
    let sr = row, sc = col;
    while (
      sr - dr >= 0 && sr - dr < ROWS &&
      sc - dc >= 0 && sc - dc < COLS &&
      board[sr - dr][sc - dc] === color
    ) {
      sr -= dr;
      sc -= dc;
    }

    // Collect the full run from the start end.
    const run = [];
    let cr = sr, cc = sc;
    while (
      cr >= 0 && cr < ROWS &&
      cc >= 0 && cc < COLS &&
      board[cr][cc] === color
    ) {
      run.push({ row: cr, col: cc });
      cr += dr;
      cc += dc;
    }

    if (run.length >= 4) {
      lines.push(run.slice(0, 4));
    }
  }

  return lines;
}

function hasAnyLineThrough(row, col, color) {
  return findLinesThrough(row, col, color).length > 0;
}

// Board is full with no winner: put a Gareth 4-in-a-row in a random
// location on the board so the result is a normal-looking Gareth win.
function placeRandomGarethLine() {
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
  ];
  const candidates = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const { dr, dc } of directions) {
        const endR = r + 3 * dr;
        const endC = c + 3 * dc;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        const line = [];
        for (let i = 0; i < 4; i++) line.push({ row: r + i * dr, col: c + i * dc });
        candidates.push(line);
      }
    }
  }
  const line = candidates[Math.floor(Math.random() * candidates.length)];
  for (const cell of line) {
    board[cell.row][cell.col] = GARETH;
  }
  render();
}

function placeDisc(col, color) {
  const row = lowestEmptyRow(col);
  if (row === -1) return null;
  board[row][col] = color;
  moveCounter += 1;
  placedOrder[row][col] = moveCounter;
  return row;
}

function onColumnClick(col) {
  if (gameOver || currentTurn !== WILL) return;
  if (isColumnFull(col)) return;

  const row = placeDisc(col, WILL);
  if (row === null) return;
  render();

  const lines = findLinesThrough(row, col, WILL);
  if (lines.length > 0) {
    // Gareth never allows Will to actually complete 4 in a row.
    // The first disc placed in each completed line quietly changes colour.
    const uniqueFlips = new Map();
    for (const line of lines) {
      const cell = earliestCell(line);
      uniqueFlips.set(`${cell.row},${cell.col}`, cell);
    }
    for (const cell of uniqueFlips.values()) {
      board[cell.row][cell.col] = GARETH;
    }

    // Safety net: in case any Will line still exists after first flips,
    // keep breaking lines until none remain.
    let guard = 0;
    while (boardHasLine(WILL) && guard < ROWS * COLS) {
      guard += 1;
      const remaining = allLinesForColor(WILL);
      if (remaining.length === 0) break;
      const extraFlip = earliestCell(remaining[0]);
      board[extraFlip.row][extraFlip.col] = GARETH;
    }

    render();
  }

  if (isBoardFull()) {
    finishFullBoard();
    return;
  }

  currentTurn = GARETH;
  setStatus("Gareth's turn...");
  setTimeout(garethMove, 500);
}

function finishFullBoard() {
  if (!boardHasLine(GARETH)) {
    placeRandomGarethLine();
  }
  endGame('Gareth wins! 🎉');
}

function allLinesForColor(color) {
  const keys = new Set();
  const lines = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== color) continue;
      const through = findLinesThrough(r, c, color);
      for (const line of through) {
        const key = line.map(({ row, col }) => `${row},${col}`).join('|');
        if (!keys.has(key)) {
          keys.add(key);
          lines.push(line);
        }
      }
    }
  }
  return lines;
}

function boardHasLine(color) {
  return allLinesForColor(color).length > 0;
}

function garethMove() {
  if (gameOver) return;

  const col = pickGarethColumn();
  const row = placeDisc(col, GARETH);
  render();

  if (row !== null && hasAnyLineThrough(row, col, GARETH)) {
    endGame('Gareth wins! 🎉');
    return;
  }

  if (isBoardFull()) {
    finishFullBoard();
    return;
  }

  currentTurn = WILL;
  setStatus("Will's turn");
}

function availableColumns() {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    if (!isColumnFull(c)) cols.push(c);
  }
  return cols;
}

function pickGarethColumn() {
  const cols = availableColumns();

  // 1. Take a winning move if one is available.
  for (const c of cols) {
    const row = lowestEmptyRow(c);
    board[row][c] = GARETH;
    const wins = hasAnyLineThrough(row, c, GARETH);
    board[row][c] = null;
    if (wins) return c;
  }

  // 2. Prefer columns nearer the centre. (Gareth never blocks Will's
  //    winning move — the win-flip mechanic handles that instead.)
  const centre = Math.floor(COLS / 2);
  const weighted = [];
  for (const c of cols) {
    const weight = COLS - Math.abs(c - centre);
    for (let i = 0; i < weight; i++) weighted.push(c);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function endGame(message) {
  gameOver = true;
  setStatus(message);
}

function startGame() {
  board = createEmptyBoard();
  placedOrder = createEmptyBoard();
  moveCounter = 0;
  gameOver = false;
  currentTurn = WILL;
  buildBoardDom();
  render();
  setStatus("Will's turn");
  logMessage('');
}

restartBtn.addEventListener('click', startGame);

startGame();
