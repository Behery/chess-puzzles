import { Chess, type Color, type Square } from 'chess.js'
import { registerSW } from 'virtual:pwa-register'
import type { Puzzle } from './puzzle'
import './style.css'

const pieces: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖',
  bk: '♚', bq: '♛', br: '♜',
}
const names: Record<string, string> = { k: 'king', q: 'queen', r: 'rook' }

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">♜</span><span>Chess Puzzle</span></div>
      <span class="offline-badge">Works offline</span>
    </header>
    <section class="game" aria-labelledby="title">
      <div class="intro">
        <p class="eyebrow">A fresh challenge, every time</p>
        <h1 id="title">Find the winning move.</h1>
        <p class="intro-copy">Tap a piece, then tap its destination. Every position is created on your device.</p>
      </div>
      <div class="play-area">
        <section class="board-card" aria-label="Chess puzzle">
          <div class="board-topline"><span id="side">Preparing puzzle…</span><span class="puzzle-tag">Puzzle 01</span></div>
          <div id="board" class="board" role="group" aria-label="Chess board"></div>
          <p id="status" class="status" role="status" aria-live="polite">Generating a puzzle…</p>
        </section>
        <aside class="details">
          <div class="goal-card">
            <span class="card-label">YOUR GOAL</span>
            <h2 id="goal">Checkmate in one move</h2>
            <p>Find any move that checkmates your opponent immediately.</p>
          </div>
          <button id="new-puzzle" class="new-button" type="button" disabled>New puzzle <span aria-hidden="true">↗</span></button>
          <p class="small-note">No connection needed once the app is installed.</p>
        </aside>
      </div>
    </section>
  </main>
`

const board = document.querySelector<HTMLDivElement>('#board')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const sideLabel = document.querySelector<HTMLSpanElement>('#side')!
const newButton = document.querySelector<HTMLButtonElement>('#new-puzzle')!
const puzzleTag = document.querySelector<HTMLSpanElement>('.puzzle-tag')!
const worker = new Worker(new URL('./puzzle.worker.ts', import.meta.url), { type: 'module' })

let game: Chess | null = null
let puzzle: Puzzle | null = null
let selected: Square | null = null
let solved = false
let puzzleNumber = 0

function renderBoard(): void {
  board.replaceChildren()
  if (!game || !puzzle) return
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
      button.setAttribute('aria-label', `${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${names[piece.type]}` : ' empty'}`)
      button.setAttribute('aria-pressed', String(selected === square))
      if (selected === square) button.classList.add('selected')
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
}

function nextPuzzle(): void {
  newButton.disabled = true
  game = null
  puzzle = null
  selected = null
  solved = false
  status.textContent = 'Generating a puzzle…'
  sideLabel.textContent = 'Preparing puzzle…'
  renderBoard()
  worker.postMessage(null)
}

worker.onmessage = (event: MessageEvent<{ puzzle?: Puzzle; error?: string }>) => {
  if (event.data.error || !event.data.puzzle) {
    status.textContent = event.data.error ?? 'Puzzle generation failed.'
    newButton.disabled = false
    return
  }
  puzzle = event.data.puzzle
  game = new Chess(puzzle.fen)
  board.dataset.fen = puzzle.fen
  puzzleNumber++
  puzzleTag.textContent = `Puzzle ${String(puzzleNumber).padStart(2, '0')}`
  sideLabel.textContent = `${puzzle.side === 'w' ? 'White' : 'Black'} to move`
  status.textContent = 'Choose a piece to begin.'
  newButton.disabled = false
  renderBoard()
}

board.addEventListener('click', (event) => {
  if (!game || !puzzle || solved) return
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

  try {
    game.move({ from: selected, to: square })
  } catch {
    status.textContent = 'That move is not legal. Try another square.'
    return
  }
  selected = null
  if (game.isCheckmate()) {
    solved = true
    status.textContent = 'Checkmate! Well done.'
  } else {
    game.undo()
    status.textContent = 'That move does not checkmate. Try again.'
  }
  renderBoard()
})

newButton.addEventListener('click', nextPuzzle)
worker.onerror = () => {
  status.textContent = 'Puzzle generation failed. Please try again.'
  newButton.disabled = false
}

registerSW({ immediate: true })
nextPuzzle()
