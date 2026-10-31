import { Chess, type Color, type Square } from 'chess.js'

export type Puzzle = {
  fen: string
  side: Color
}

const files = 'abcdefgh'
const squares = Array.from({ length: 64 }, (_, index) =>
  `${files[index % 8]}${Math.floor(index / 8) + 1}` as Square,
)

function position(pieces: Record<string, string>, side: Color): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (const file of files) {
      const piece = pieces[`${file}${rank}`]
      if (piece) {
        if (empty) row += empty
        row += piece
        empty = 0
      } else {
        empty++
      }
    }
    if (empty) row += empty
    rows.push(row)
  }
  return `${rows.join('/')} ${side} - - 0 1`
}

function randomSquare(random: () => number): Square {
  return squares[Math.floor(random() * squares.length)]
}

export function generatePuzzle(random = Math.random, side: Color = random() < 0.5 ? 'w' : 'b'): Puzzle {
  for (let attempt = 0; attempt < 50_000; attempt++) {
    const [ownKing, queen, helper, enemyKing] = Array.from({ length: 4 }, () => randomSquare(random))
    if (new Set([ownKing, queen, helper, enemyKing]).size !== 4) continue

    const white = side === 'w'
    const fen = position({
      [ownKing]: white ? 'K' : 'k',
      [queen]: white ? 'Q' : 'q',
      [helper]: white ? 'R' : 'r',
      [enemyKing]: white ? 'k' : 'K',
    }, side)
    const game = new Chess(fen)

    // The side that just moved cannot have left its king in check.
    if (game.isAttacked(enemyKing, side) || game.isCheck()) continue

    const hasMate = game.moves({ verbose: true }).some((move) => {
      game.move(move)
      const mate = game.isCheckmate()
      game.undo()
      return mate
    })
    if (hasMate) return { fen, side }
  }
  throw new Error('Could not generate a puzzle. Please try again.')
}
