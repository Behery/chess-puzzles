import { Chess, type Square } from 'chess.js'
import { registerSW } from 'virtual:pwa-register'
import { playUci, type Difficulty, type Puzzle } from './puzzle'
import './style.css'

const pieces: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}
const names: Record<string, string> = {
  k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">♜</span><span>Chess Puzzle</span></div>
      <span class="offline-badge">Works offline</span>
    </header>
    <section class="game" aria-labelledby="title">
      <div class="intro">
        <p class="eyebrow">Real game tactics</p>
        <h1 id="title">Find the winning line.</h1>
        <p class="intro-copy">Choose a difficulty, then tap a piece and its destination. Your opponent will reply between moves.</p>
      </div>
      <div class="play-area">
        <aside class="details">
          <label class="difficulty-label" for="difficulty">Difficulty</label>
          <select id="difficulty" class="difficulty-select">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <div class="goal-card">
            <span class="card-label">YOUR GOAL</span>
            <h2 id="goal">Preparing puzzle…</h2>
            <p id="goal-detail">Find the best sequence from a real game.</p>
          </div>
          <div class="action-row">
            <button id="back" class="action-button" type="button" aria-label="Back one move" disabled>← Back</button>
            <button id="forward" class="action-button" type="button" aria-label="Forward one move" disabled>Forward →</button>
          </div>
          <div class="action-row">
            <button id="hint" class="action-button" type="button" disabled>Hint</button>
            <button id="solve" class="action-button" type="button" disabled>Solve</button>
          </div>
        </aside>
        <section class="board-card" aria-label="Chess puzzle">
          <div class="board-topline"><span id="side">Preparing puzzle…</span><span class="puzzle-tag">Puzzle 01</span></div>
          <div id="board" class="board" role="group" aria-label="Chess board"></div>
          <p id="status" class="status" role="status" aria-live="polite">Generating a puzzle…</p>
          <button id="new-puzzle" class="new-button" type="button" disabled>New puzzle <span aria-hidden="true">↗</span></button>
        </section>
      </div>
    </section>
  </main>
`

const board = document.querySelector<HTMLDivElement>('#board')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const sideLabel = document.querySelector<HTMLSpanElement>('#side')!
const goalLabel = document.querySelector<HTMLHeadingElement>('#goal')!
const goalDetail = document.querySelector<HTMLParagraphElement>('#goal-detail')!
const difficultySelect = document.querySelector<HTMLSelectElement>('#difficulty')!
const newButton = document.querySelector<HTMLButtonElement>('#new-puzzle')!
const backButton = document.querySelector<HTMLButtonElement>('#back')!
const forwardButton = document.querySelector<HTMLButtonElement>('#forward')!
const hintButton = document.querySelector<HTMLButtonElement>('#hint')!
const solveButton = document.querySelector<HTMLButtonElement>('#solve')!
const puzzleTag = document.querySelector<HTMLSpanElement>('.puzzle-tag')!
const worker = new Worker(new URL('./puzzle.worker.ts', import.meta.url), { type: 'module' })

let game: Chess | null = null
let puzzle: Puzzle | null = null
let selected: Square | null = null
let solved = false
let puzzleNumber = 0
let solutionIndex = 0
let playedMoves: string[] = []
let viewIndex = 0
let hintStage = 0
let busy = false
const moveDurationMs = 650
const betweenMovesMs = 300

function updateControls(): void {
  const replaying = viewIndex < playedMoves.length
  newButton.disabled = busy
  difficultySelect.disabled = busy
  backButton.disabled = busy || viewIndex === 0
  forwardButton.disabled = busy || !replaying
  hintButton.disabled = busy || !puzzle || solved || replaying
  solveButton.disabled = busy || !puzzle
}

function renderBoard(): void {
  board.replaceChildren()
  if (!game || !puzzle) {
    updateControls()
    return
  }
  const legalMoves = selected
    ? new Set(game.moves({ square: selected, verbose: true }).map((move) => move.to))
    : new Set<Square>()
  const lastMove = playedMoves[viewIndex - 1]
  const hintedMove = puzzle.solution[solutionIndex]
  const files = puzzle.side === 'w' ? 'abcdefgh' : 'hgfedcba'
  const ranks = puzzle.side === 'w' ? '87654321' : '12345678'
  for (const rank of ranks) {
    for (const file of files) {
      const square = `${file}${rank}` as Square
      const piece = game.get(square)
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `square ${(Number(rank) + file.charCodeAt(0)) % 2 ? 'light' : 'dark'}`
      button.dataset.square = square
      const legal = legalMoves.has(square)
      button.setAttribute('aria-label', `${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${names[piece.type]}` : ' empty'}${legal ? ', legal move' : ''}`)
      button.setAttribute('aria-pressed', String(selected === square))
      if (selected === square) button.classList.add('selected')
      if (legal) button.classList.add('legal-target')
      if (legal && piece) button.classList.add('capture-target')
      if (lastMove && (square === lastMove.slice(0, 2) || square === lastMove.slice(2, 4))) button.classList.add('last-move')
      if (hintStage > 0 && square === hintedMove.slice(0, 2)) button.classList.add('hint-from')
      if (hintStage > 1 && square === hintedMove.slice(2, 4)) button.classList.add('hint-to')
      if (piece) {
        const symbol = document.createElement('span')
        symbol.className = `piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`
        symbol.textContent = pieces[`${piece.color}${piece.type}`]
        button.append(symbol)
      }
      if (file === files[0]) {
        const coordinate = document.createElement('span')
        coordinate.className = 'rank-label'
        coordinate.textContent = rank
        button.append(coordinate)
      }
      if (rank === ranks[ranks.length - 1]) {
        const coordinate = document.createElement('span')
        coordinate.className = 'file-label'
        coordinate.textContent = file
        button.append(coordinate)
      }
      board.append(button)
    }
  }
  updateControls()
}

function nextPuzzle(): void {
  if (busy) return
  busy = true
  game = null
  puzzle = null
  selected = null
  solved = false
  solutionIndex = 0
  playedMoves = []
  viewIndex = 0
  hintStage = 0
  status.textContent = 'Preparing a puzzle…'
  sideLabel.textContent = 'Preparing puzzle…'
  goalLabel.textContent = 'Preparing puzzle…'
  renderBoard()
  worker.postMessage(difficultySelect.value as Difficulty)
}

worker.onmessage = (event: MessageEvent<{ puzzle?: Puzzle; error?: string }>) => {
  busy = false
  if (event.data.error || !event.data.puzzle) {
    status.textContent = event.data.error ?? 'Puzzle generation failed.'
    updateControls()
    return
  }
  puzzle = event.data.puzzle
  game = new Chess(puzzle.fen)
  board.dataset.fen = puzzle.fen
  board.dataset.puzzleId = puzzle.id
  board.dataset.difficulty = puzzle.difficulty
  board.dataset.solution = puzzle.solution.join(' ')
  puzzleNumber++
  puzzleTag.textContent = `Puzzle ${String(puzzleNumber).padStart(2, '0')}`
  sideLabel.textContent = `${puzzle.side === 'w' ? 'White' : 'Black'} to move`
  goalLabel.textContent = puzzle.goal
  const moves = Math.ceil(puzzle.solution.length / 2)
  goalDetail.textContent = `${moves} move${moves === 1 ? '' : 's'} to solve · Puzzle rating ${puzzle.rating}`
  status.textContent = 'Choose a piece to begin.'
  renderBoard()
}

async function animateBoardMove(from: Square, to: Square, apply: () => void): Promise<void> {
  const sourcePiece = board.querySelector<HTMLElement>(`[data-square="${from}"] .piece`)
  const start = sourcePiece?.getBoundingClientRect()
  const movingPiece = sourcePiece?.cloneNode(true) as HTMLElement | undefined
  const boardRect = board.getBoundingClientRect()
  apply()
  renderBoard()
  const targetPiece = board.querySelector<HTMLElement>(`[data-square="${to}"] .piece`)
  if (!start || !movingPiece || !targetPiece || matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const end = targetPiece.getBoundingClientRect()
  movingPiece.classList.add('moving-piece')
  movingPiece.style.left = `${start.left - boardRect.left}px`
  movingPiece.style.top = `${start.top - boardRect.top}px`
  movingPiece.style.width = `${start.width}px`
  movingPiece.style.height = `${start.height}px`
  movingPiece.style.transition = `transform ${moveDurationMs}ms ease-in-out`
  targetPiece.style.visibility = 'hidden'
  board.append(movingPiece)
  board.dataset.animating = 'true'
  try {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, moveDurationMs + 200)
      movingPiece.addEventListener('transitionend', (event) => {
        if (event.propertyName === 'transform') {
          window.clearTimeout(timeout)
          resolve()
        }
      })
      requestAnimationFrame(() => requestAnimationFrame(() => {
        movingPiece.style.transform = `translate(${end.left - start.left}px, ${end.top - start.top}px)`
      }))
    })
  } finally {
    board.dataset.animating = 'false'
    movingPiece.remove()
    targetPiece.style.removeProperty('visibility')
  }
}

async function recordMove(uci: string): Promise<void> {
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  await animateBoardMove(from, to, () => {
    playUci(game!, uci)
    playedMoves.push(uci)
    viewIndex++
  })
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function replay(direction: -1 | 1): Promise<void> {
  if (!game || busy || (direction === -1 && viewIndex === 0) || (direction === 1 && viewIndex === playedMoves.length)) return
  busy = true
  selected = null
  hintStage = 0
  updateControls()
  const uci = playedMoves[direction === -1 ? viewIndex - 1 : viewIndex]
  const from = (direction === -1 ? uci.slice(2, 4) : uci.slice(0, 2)) as Square
  const to = (direction === -1 ? uci.slice(0, 2) : uci.slice(2, 4)) as Square
  try {
    await animateBoardMove(from, to, () => {
      if (direction === -1) {
        game!.undo()
      } else {
        playUci(game!, uci)
      }
      viewIndex += direction
    })
    status.textContent = viewIndex < playedMoves.length
      ? `Reviewing move ${viewIndex} of ${playedMoves.length}. Use Forward to resume.`
      : solved ? 'Review complete.' : 'Continue solving.'
  } finally {
    busy = false
    updateControls()
  }
}

async function showSolution(): Promise<void> {
  if (!puzzle || busy) return
  busy = true
  game = new Chess(puzzle.fen)
  playedMoves = []
  viewIndex = 0
  solutionIndex = 0
  selected = null
  hintStage = 0
  solved = false
  status.textContent = 'Showing the solution…'
  renderBoard()
  try {
    for (const uci of puzzle.solution) {
      await pause(matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : betweenMovesMs)
      await recordMove(uci)
    }
    solutionIndex = puzzle.solution.length
    solved = true
    status.textContent = 'Solution shown. Use Back and Forward to replay.'
  } finally {
    busy = false
    updateControls()
  }
}

board.addEventListener('click', async (event) => {
  if (!game || !puzzle || solved || busy) return
  if (viewIndex < playedMoves.length) {
    status.textContent = 'Use Forward to return to the current position.'
    return
  }
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-square]')
  if (!target) return
  const square = target.dataset.square as Square
  const piece = game.get(square)

  if (piece?.color === puzzle.side) {
    selected = square === selected ? null : square
    status.textContent = selected ? `Selected ${square}. Choose a destination.` : 'Choose a piece to begin.'
    renderBoard()
    return
  }
  if (!selected) return

  const from = selected
  const expected = puzzle.solution[solutionIndex]
  let move
  try {
    move = game.move({ from, to: square, promotion: 'q' })
  } catch {
    status.textContent = 'That move is not legal. Try another square.'
    return
  }
  const mate = game.isCheckmate()
  game.undo()
  selected = null
  const uci = `${move.from}${move.to}${move.promotion ?? ''}`
  if (!mate && uci !== expected) {
    status.textContent = 'That is not the winning continuation. Try again.'
    renderBoard()
    return
  }

  hintStage = 0
  busy = true
  updateControls()
  try {
    await recordMove(uci)
    solutionIndex++
    if (mate) {
      solved = true
      status.textContent = 'Checkmate! Well done.'
    } else if (solutionIndex < puzzle.solution.length) {
      await pause(matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : betweenMovesMs)
      await recordMove(puzzle.solution[solutionIndex])
      solutionIndex++
    }
    if (!solved && solutionIndex >= puzzle.solution.length) {
      solved = true
      status.textContent = 'Puzzle solved! Well done.'
    } else if (!solved) {
      status.textContent = `Correct. Find move ${Math.floor(solutionIndex / 2) + 1} of ${Math.ceil(puzzle.solution.length / 2)}.`
    }
  } finally {
    busy = false
    renderBoard()
  }
})

newButton.addEventListener('click', nextPuzzle)
difficultySelect.addEventListener('change', nextPuzzle)
backButton.addEventListener('click', () => void replay(-1))
forwardButton.addEventListener('click', () => void replay(1))
hintButton.addEventListener('click', () => {
  if (!puzzle || busy || solved || viewIndex < playedMoves.length) return
  selected = null
  hintStage = Math.min(hintStage + 1, 2)
  const move = puzzle.solution[solutionIndex]
  status.textContent = hintStage === 1
    ? `Hint: select the piece on ${move.slice(0, 2)}.`
    : `Hint: move it to ${move.slice(2, 4)}.`
  renderBoard()
})
solveButton.addEventListener('click', () => void showSolution())
worker.onerror = () => {
  busy = false
  status.textContent = 'Puzzle generation failed. Please try again.'
  updateControls()
}

registerSW({ immediate: true })
nextPuzzle()
