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
  const pieceImage = page.locator('img.piece').first()
  await expect(pieceImage).toHaveAttribute('src', /\/pieces\/[wb][kqrbnp]\.png$/)
  await expect.poll(() => pieceImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await solve(page, 'easy')

  await page.getByLabel('Difficulty').selectOption('medium')
  await solve(page, 'medium')
  await page.getByLabel('Difficulty').selectOption('hard')
  await solve(page, 'hard')
  await page.getByRole('button', { name: 'New puzzle' }).click()
  await expect(page.locator('.square')).toHaveCount(64)
  await expect(page.locator('.puzzle-tag')).toHaveText('Puzzle 04')
})

test('all piece images have visible artwork offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  const pixels = await page.evaluate(async () => Promise.all(['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp'].map(async (name) => {
    const image = new Image()
    image.src = `/pieces/${name}.png`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0, 64, 64)
    const alpha = context.getImageData(0, 0, 64, 64).data
    let visible = 0
    for (let index = 3; index < alpha.length; index += 4) if (alpha[index] > 128) visible++
    return visible
  })))
  for (const visible of pixels) expect(visible).toBeGreaterThan(50)
  const pieceBox = await page.locator('img.piece').first().boundingBox()
  expect(pieceBox?.width).toBeGreaterThan(20)
  expect(pieceBox?.height).toBeGreaterThan(20)
})

test('uses chess glyphs when piece images fail to load', async ({ page }) => {
  await page.route('**/pieces/*.png', (route) => route.abort())
  await page.goto('/')
  await expect(page.locator('.square')).toHaveCount(64)
  await expect(page.locator('.fallback-piece').first()).toBeVisible()
  await expect(page.locator('.fallback-piece').first()).toHaveText(/[♔-♟]/)
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
    const windowWithFlag = window as Window & { sawMoveAnimation?: boolean }
    windowWithFlag.sawMoveAnimation = false
    new MutationObserver(() => {
      if (boardElement.getAttribute('data-animating') === 'true') windowWithFlag.sawMoveAnimation = true
    }).observe(boardElement, { attributes: true, attributeFilter: ['data-animating'] })
  })
  await source.click()
  await destination.click()
  await expect(page.getByRole('status')).toHaveText(`Correct. Find move 2 of ${Math.ceil(solution.length / 2)}.`)
  expect(await page.evaluate(() => (window as Window & { sawMoveAnimation?: boolean }).sawMoveAnimation)).toBe(true)
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

test.describe('compact layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('keeps the full-size board and controls visible on phones and tablets', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.square')).toHaveCount(64)
    await expect(page.locator('#side')).toContainText('to move')
    await expect(page.locator('#goal')).not.toHaveText('Preparing puzzle…')
    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport)
      const layout = await page.evaluate(() => {
        const board = document.querySelector('#board')!.getBoundingClientRect()
        const controls = document.querySelector('.details')!.getBoundingClientRect()
        return { boardWidth: board.width, boardBottom: board.bottom, controlsBottom: controls.bottom, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }
      })
      expect(layout.boardWidth).toBeGreaterThanOrEqual(viewport.width <= 430 ? viewport.width - 42 : 576)
      expect(layout.boardBottom).toBeLessThanOrEqual(viewport.height)
      expect(layout.controlsBottom).toBeLessThanOrEqual(viewport.height)
      expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width)
      expect(layout.scrollHeight).toBeLessThanOrEqual(viewport.height)
    }
    await page.locator('#goal').evaluate((element) => { element.textContent = 'Checkmate in 5 or more moves' })
    await page.locator('#goal-detail').evaluate((element) => { element.textContent = '5 moves to solve · Puzzle rating 2780' })
    await page.locator('#status').evaluate((element) => { element.textContent = 'Reviewing move 10 of 12. Use Forward to resume.' })
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(568)
    const first = (await page.locator('#board').getAttribute('data-solution'))!.split(' ')[0]
    await page.locator(`[data-square="${first.slice(0, 2)}"]`).tap()
    await expect(page.locator(`[data-square="${first.slice(2, 4)}"]`)).toHaveClass(/legal-target/)
  })
})

test('keeps the full-size board and controls visible on PC', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.square')).toHaveCount(64)
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    const layout = await page.evaluate(() => {
      const board = document.querySelector('#board')!.getBoundingClientRect()
      const controls = document.querySelector('.details')!.getBoundingClientRect()
      return { boardWidth: board.width, boardBottom: board.bottom, controlsBottom: controls.bottom, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }
    })
    expect(layout.boardWidth).toBeGreaterThanOrEqual(638)
    expect(layout.boardBottom).toBeLessThanOrEqual(viewport.height)
    expect(layout.controlsBottom).toBeLessThanOrEqual(viewport.height)
    expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width)
    expect(layout.scrollHeight).toBeLessThanOrEqual(viewport.height)
  }
})
