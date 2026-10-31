import { Chess, type Color, type Square } from 'chess.js'
import puzzleBank from './puzzle-bank.json'

export type Difficulty = 'easy' | 'medium' | 'hard'

type PuzzleSeed = {
  id: string
  fen: string
  moves: string[]
  goal: string
  rating: number
}

export type Puzzle = {
  id: string
  fen: string
  side: Color
  goal: string
  solution: string[]
  difficulty: Difficulty
  rating: number
}

const bank: Record<Difficulty, PuzzleSeed[]> = puzzleBank

export function playUci(game: Chess, uci: string): void {
  game.move({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci[4] ?? 'q',
  })
}

export function generatePuzzle(
  difficulty: Difficulty,
  seen: Set<string> = new Set(),
  random = Math.random,
): Puzzle {
  const candidates = bank[difficulty]
  if (seen.size >= candidates.length) seen.clear()

  let index = Math.floor(random() * candidates.length)
  while (seen.has(candidates[index].id)) index = (index + 1) % candidates.length
  const seed = candidates[index]
  seen.add(seed.id)

  // Lichess stores the position before the opponent's setup move.
  const game = new Chess(seed.fen)
  playUci(game, seed.moves[0])
  return {
    id: seed.id,
    fen: game.fen(),
    side: game.turn(),
    goal: seed.goal,
    solution: seed.moves.slice(1),
    difficulty,
    rating: seed.rating,
  }
}
