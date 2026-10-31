import { expect, test } from '@playwright/test'
import { Chess } from 'chess.js'

test('plays a generated puzzle offline', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.locator('.square')).toHaveCount(64)
  await expect(page.getByText('Checkmate in one move')).toBeVisible()

  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.locator('.square')).toHaveCount(64)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.square')).toHaveCount(64)

  const fen = await page.locator('#board').getAttribute('data-fen')
  expect(fen).toBeTruthy()
  const game = new Chess(fen!)
  await expect(page.locator('#side')).toHaveText(`${game.turn() === 'w' ? 'White' : 'Black'} to move`)
  await expect(page.locator('.square').first()).toHaveAttribute('data-square', game.turn() === 'w' ? 'a8' : 'h1')
  const misses = game.moves({ verbose: true }).find((move) => {
    game.move(move)
    const miss = !game.isCheckmate()
    game.undo()
    return miss
  })!
  await page.locator(`[data-square="${misses.from}"]`).click()
  await page.locator(`[data-square="${misses.to}"]`).click()
  await expect(page.getByRole('status')).toHaveText('That move does not checkmate. Try again.')
  const mate = game.moves({ verbose: true }).find((move) => {
    game.move(move)
    const found = game.isCheckmate()
    game.undo()
    return found
  })!
  await page.locator(`[data-square="${mate.from}"]`).click()
  await page.locator(`[data-square="${mate.to}"]`).click()
  await expect(page.getByRole('status')).toHaveText('Checkmate! Well done.')

  await page.getByRole('button', { name: 'New puzzle' }).click()
  await expect(page.locator('.square')).toHaveCount(64)
  await expect(page.locator('.puzzle-tag')).toHaveText('Puzzle 02')
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('shows the board and goal without horizontal overflow', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.square')).toHaveCount(64)
    await expect(page.locator('#side')).toContainText('to move')
    await expect(page.locator('#goal')).toHaveText('Checkmate in one move')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
