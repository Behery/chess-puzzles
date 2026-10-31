import { describe, expect, it } from 'vitest'
import { Chess, type Color, type Square } from 'chess.js'
import { generatePuzzle } from '../../src/puzzle'

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

describe('local puzzle generator', () => {
  it.each(['w', 'b'] as Color[])('creates legal, solvable %s puzzles', (side) => {
    const positions = new Set<string>()
    for (let seed = 1; seed <= 8; seed++) {
      const puzzle = generatePuzzle(seededRandom(seed), side)
      const game = new Chess(puzzle.fen)
      positions.add(puzzle.fen)
      expect(game.turn()).toBe(side)
      expect(game.isCheck()).toBe(false)
      const opponentKing = game.board().flat().find((piece) => piece?.type === 'k' && piece.color !== side)!
      expect(game.isAttacked(opponentKing.square as Square, side)).toBe(false)

      const actualMates = game.moves({ verbose: true }).flatMap((move) => {
        game.move(move)
        const mate = game.isCheckmate()
        game.undo()
        return mate ? [`${move.from}${move.to}`] : []
      })
      expect(actualMates.length).toBeGreaterThan(0)
    }
    expect(positions.size).toBe(8)
  })
})
