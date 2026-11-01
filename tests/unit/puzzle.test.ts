import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import puzzleBank from '../../src/puzzle-bank.json'
import { generatePuzzle, playUci, type Difficulty } from '../../src/puzzle'

const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

describe('offline puzzle bank', () => {
  it('contains legal, early-to-mid game puzzles with playable solution lines', () => {
    for (const difficulty of difficulties) {
      for (const seed of puzzleBank[difficulty]) {
        const game = new Chess(seed.fen)
        const mateMoves = seed.moves.length / 2
        expect(seed.goal).toBe(`Checkmate in ${mateMoves} ${mateMoves === 1 ? 'move' : 'moves'}`)
        if (difficulty === 'easy') expect(seed.rating).toBeLessThanOrEqual(1300)
        if (difficulty === 'medium') {
          expect(seed.rating).toBeGreaterThan(1300)
          expect(seed.rating).toBeLessThanOrEqual(1900)
        }
        if (difficulty === 'hard') expect(seed.rating).toBeGreaterThan(1900)
        expect(Number(seed.fen.split(' ')[5])).toBeGreaterThanOrEqual(7)
        expect(Number(seed.fen.split(' ')[5])).toBeLessThanOrEqual(32)
        playUci(game, seed.moves[0])
        const pieces = game.board().flat().filter(Boolean)
        expect(pieces.filter((piece) => piece!.color === 'w').length).toBeGreaterThanOrEqual(5)
        expect(pieces.filter((piece) => piece!.color === 'b').length).toBeGreaterThanOrEqual(5)
        for (const move of seed.moves.slice(1)) playUci(game, move)
        expect(game.isCheckmate()).toBe(true)
      }
    }
  }, 120_000)

  it.each(difficulties)('selects distinct %s puzzles with the expected length', (difficulty) => {
    const seen = new Set<string>()
    const sides = new Set<string>()
    for (let index = 0; index < 30; index++) {
      const puzzle = generatePuzzle(difficulty, seen, () => 0)
      sides.add(puzzle.side)
      expect(puzzle.difficulty).toBe(difficulty)
      expect(puzzle.solution.length % 2).toBe(1)
      const mateMoves = Math.ceil(puzzle.solution.length / 2)
      expect(puzzle.goal).toBe(`Checkmate in ${mateMoves} ${mateMoves === 1 ? 'move' : 'moves'}`)
      expect(Math.ceil(puzzle.solution.length / 2)).toBeGreaterThanOrEqual(
        difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1,
      )
      const game = new Chess(puzzle.fen)
      for (const move of puzzle.solution) playUci(game, move)
      expect(game.isCheckmate()).toBe(true)
    }
    expect(seen.size).toBe(30)
    expect(sides.size).toBe(2)
  })

  it('keeps a sizable mate pool at every difficulty', () => {
    expect(puzzleBank.easy.length).toBeGreaterThan(1000)
    expect(puzzleBank.medium.length).toBeGreaterThan(500)
    expect(puzzleBank.hard.length).toBeGreaterThan(100)
    expect(puzzleBank.easy.some((seed) => seed.goal === 'Checkmate in 1 move')).toBe(true)
    expect(puzzleBank.easy.some((seed) => seed.goal === 'Checkmate in 2 moves')).toBe(true)
  })
})
