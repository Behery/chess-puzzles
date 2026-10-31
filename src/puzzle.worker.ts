import { generatePuzzle } from './puzzle'

self.onmessage = () => {
  try {
    self.postMessage({ puzzle: generatePuzzle() })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Puzzle generation failed.' })
  }
}
