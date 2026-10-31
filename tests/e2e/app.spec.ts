import { expect, test } from '@playwright/test'
import { Chess, type Square } from 'chess.js'
import type { Page } from '@playwright/test'

async function solve(page: Page, difficulty: 'easy' | 'medium' | 'hard'): Promise<void> {
  await expect(page.locator('.square')).toHaveCount(64)
  const board = page.locator('#board')
  await expect(board).toHaveAttribute('data-difficulty', difficulty)
  const game = new Chess((await board.getAttribute('data-fen'))!)
  const solution = (await board.getAttribute('data-solution'))!.split(' ')
  expect(Math.ceil(solution.length / 2)).toBeGreaterThanOrEqual(difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1)
  await expect(page.locator('#side')).toHaveText(`${game.turn() === 'w' ? 'White' : 'Black'} to move`)
  await expect(page.locator('.square').first()).toHaveAttribute('data-square', game.turn() === 'w' ? 'a8' : 'h1')
  const material = game.board().flat().filter(Boolean)
  expect(material.filter((piece) => piece!.color === 'w').length).toBeGreaterThanOrEqual(5)
  expect(material.filter((piece) => piece!.color === 'b').length).toBeGreaterThanOrEqual(5)

  const wrong = game.moves({ verbose: true }).find((move) => {
    game.move(move)
    const mate = game.isCheckmate()
    game.undo()
    return !mate && `${move.from}${move.to}${move.promotion ?? ''}` !== solution[0]
  })!
  await page.locator(`[data-square="${wrong.from}"]`).click()
  await page.locator(`[data-square="${wrong.to}"]`).click()
  await expect(page.getByRole('status')).toHaveText('That is not the winning continuation. Try again.')

  for (let index = 0; index < solution.length; index += 2) {
    const move = solution[index]
    await page.locator(`[data-square="${move.slice(0, 2)}"]`).click()
    await page.locator(`[data-square="${move.slice(2, 4)}"]`).click()
    game.move({ from: move.slice(0, 2) as Square, to: move.slice(2, 4) as Square, promotion: move[4] ?? 'q' })
    if (index + 1 < solution.length) {
      const reply = solution[index + 1]
      game.move({ from: reply.slice(0, 2) as Square, to: reply.slice(2, 4) as Square, promotion: reply[4] ?? 'q' })
    }
  }
  await expect(page.getByRole('status')).toContainText(/Checkmate|Puzzle solved/)
}

test('plays every difficulty offline', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.locator('.square')).toHaveCount(64)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.locator('.square')).toHaveCount(64)
  await context.setOffline(true)
  await page.reload()
  await solve(page, 'easy')

  await page.getByLabel('Difficulty').selectOption('medium')
  await solve(page, 'medium')
  await page.getByLabel('Difficulty').selectOption('hard')
  await solve(page, 'hard')
  await page.getByRole('button', { name: 'New puzzle' }).click()
  await expect(page.locator('.square')).toHaveCount(64)
  await expect(page.locator('.puzzle-tag')).toHaveText('Puzzle 04')
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('shows the board and goal without horizontal overflow', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.square')).toHaveCount(64)
    await expect(page.locator('#side')).toContainText('to move')
    await expect(page.locator('#goal')).not.toHaveText('Preparing puzzle…')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
