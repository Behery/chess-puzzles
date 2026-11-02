import { expect, test } from '@playwright/test'

test('announces a solved puzzle prominently on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const board = page.locator('#board')
  await expect(board).toHaveAttribute('data-solution', /\w/)
  const solution = (await board.getAttribute('data-solution'))!.split(' ')

  for (let index = 0; index < solution.length; index += 2) {
    const move = solution[index]
    await page.locator(`[data-square="${move.slice(0, 2)}"]`).click()
    await page.locator(`[data-square="${move.slice(2, 4)}"]`).click()
    if (index + 2 < solution.length) await expect(page.getByRole('status')).toContainText('Correct.')
  }

  const announcement = page.getByRole('status')
  await expect(announcement).toHaveClass(/won/)
  await expect(announcement).toContainText(/Checkmate|Puzzle solved/)
  const style = await announcement.evaluate((element) => {
    const computed = getComputedStyle(element)
    return { fontSize: computed.fontSize, position: computed.position }
  })
  expect(parseFloat(style.fontSize)).toBeGreaterThanOrEqual(20)
  expect(style.position).toBe('absolute')
  await page.getByRole('button', { name: 'Back one move' }).click()
  await expect(announcement).not.toHaveClass(/won/)
  await page.getByRole('button', { name: 'New puzzle' }).click()
  await expect(announcement).not.toHaveClass(/won/)
})
