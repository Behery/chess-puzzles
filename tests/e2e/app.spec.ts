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
    if (index + 2 < solution.length) {
      await expect(page.getByRole('status')).toHaveText(`Correct. Find move ${index / 2 + 2} of ${Math.ceil(solution.length / 2)}.`)
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

test('shows legal moves, staged hints, replay, and the animated solution', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Difficulty').selectOption('medium')
  const board = page.locator('#board')
  await expect(board).toHaveAttribute('data-difficulty', 'medium')
  const solution = (await board.getAttribute('data-solution'))!.split(' ')
  const first = solution[0]
  const reply = solution[1]
  const next = solution[2]
  const source = page.locator(`[data-square="${first.slice(0, 2)}"]`)
  const destination = page.locator(`[data-square="${first.slice(2, 4)}"]`)

  await source.click()
  await expect(destination).toHaveClass(/legal-target/)
  await page.getByRole('button', { name: 'Hint' }).click()
  await expect(source).toHaveClass(/hint-from/)
  await expect(destination).not.toHaveClass(/hint-to/)
  await expect(page.getByRole('status')).toHaveText(`Hint: select the piece on ${first.slice(0, 2)}.`)
  await page.getByRole('button', { name: 'Hint' }).click()
  await expect(destination).toHaveClass(/hint-to/)
  await expect(page.getByRole('status')).toHaveText(`Hint: move it to ${first.slice(2, 4)}.`)

  await page.evaluate(() => {
    const boardElement = document.querySelector('#board')!
    const windowWithTiming = window as Window & { moveAnimationStart?: number; moveAnimationDurations?: number[] }
    windowWithTiming.moveAnimationDurations = []
    new MutationObserver(() => {
      if (boardElement.getAttribute('data-animating') === 'true') {
        windowWithTiming.moveAnimationStart = performance.now()
      } else if (windowWithTiming.moveAnimationStart !== undefined) {
        windowWithTiming.moveAnimationDurations!.push(performance.now() - windowWithTiming.moveAnimationStart)
        windowWithTiming.moveAnimationStart = undefined
      }
    }).observe(boardElement, { attributes: true, attributeFilter: ['data-animating'] })
  })
  await source.click()
  await destination.click()
  await expect(page.getByRole('status')).toHaveText(`Correct. Find move 2 of ${Math.ceil(solution.length / 2)}.`)
  expect(await page.evaluate(() => (window as Window & { moveAnimationDurations?: number[] }).moveAnimationDurations![0])).toBeGreaterThanOrEqual(600)
  await expect(page.locator(`[data-square="${reply.slice(0, 2)}"]`)).toHaveClass(/last-move/)
  await expect(page.locator(`[data-square="${reply.slice(2, 4)}"]`)).toHaveClass(/last-move/)

  await page.getByRole('button', { name: 'Back one move' }).click()
  await expect(page.getByRole('status')).toContainText('Reviewing move')
  await expect(page.getByRole('button', { name: 'Hint' })).toBeDisabled()
  await expect(source).toHaveClass(/last-move/)
  await expect(destination).toHaveClass(/last-move/)
  await page.getByRole('button', { name: 'Forward one move' }).click()
  await expect(page.getByRole('status')).toHaveText('Continue solving.')
  await page.getByRole('button', { name: 'Hint' }).click()
  await expect(page.locator(`[data-square="${next.slice(0, 2)}"]`)).toHaveClass(/hint-from/)

  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByRole('status')).toHaveText('Solution shown. Use Back and Forward to replay.')
  const last = solution.at(-1)!
  await expect(page.locator(`[data-square="${last.slice(0, 2)}"]`)).toHaveClass(/last-move/)
  await expect(page.locator(`[data-square="${last.slice(2, 4)}"]`)).toHaveClass(/last-move/)
  await page.getByRole('button', { name: 'Back one move' }).click()
  await page.getByRole('button', { name: 'Forward one move' }).click()
  await expect(page.getByRole('status')).toHaveText('Review complete.')
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('keeps the objective, controls, board, and New puzzle in view', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.square')).toHaveCount(64)
    await expect(page.locator('#side')).toContainText('to move')
    await expect(page.locator('#goal')).not.toHaveText('Preparing puzzle…')
    for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
      await page.setViewportSize(viewport)
      const positions = await page.evaluate(() => {
        const goal = document.querySelector('#goal')!.getBoundingClientRect()
        const controls = document.querySelector('.action-row')!.getBoundingClientRect()
        const board = document.querySelector('#board')!.getBoundingClientRect()
        const newButton = document.querySelector('#new-puzzle')!.getBoundingClientRect()
        return { goalBottom: goal.bottom, controlsBottom: controls.bottom, boardTop: board.top, boardBottom: board.bottom, newTop: newButton.top, newBottom: newButton.bottom, boardWidth: board.width }
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      expect(positions.goalBottom).toBeLessThan(positions.boardTop)
      expect(positions.controlsBottom).toBeLessThan(positions.boardTop)
      expect(positions.boardBottom).toBeLessThan(positions.newTop)
      expect(positions.newBottom).toBeLessThanOrEqual(viewport.height)
      expect(positions.boardWidth).toBeGreaterThanOrEqual(240)
    }
    const first = (await page.locator('#board').getAttribute('data-solution'))!.split(' ')[0]
    await page.locator(`[data-square="${first.slice(0, 2)}"]`).tap()
    await expect(page.locator(`[data-square="${first.slice(2, 4)}"]`)).toHaveClass(/legal-target/)
    await page.locator(`[data-square="${first.slice(2, 4)}"]`).tap()
    await expect(page.locator('.moving-piece')).toBeVisible()
    await expect(page.locator('#board')).toHaveAttribute('data-animating', 'true')
  })
})
