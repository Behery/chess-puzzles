import { generatePuzzle, type Difficulty } from './puzzle'

const seen: Record<Difficulty, Set<string>> = {
  easy: new Set(),
  medium: new Set(),
  hard: new Set(),
}

self.onmessage = (event: MessageEvent<Difficulty>) => {
  try {
    self.postMessage({ puzzle: generatePuzzle(event.data, seen[event.data]) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Puzzle generation failed.' })
  }
}
