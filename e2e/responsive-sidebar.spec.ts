import { expect, test } from '@playwright/test'

test.describe('responsive sidebar', () => {
  test('mobile drawer toggles with hamburger and backdrop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile', 'Mobile-only scenario')

    await page.goto('/')

    const menuButton = page.getByRole('button', { name: 'Open menu' })
    const sidebar = page.locator('#app-sidebar')
    const backdrop = page.locator('.drawer-backdrop')

    await expect(menuButton).toBeVisible()
    await expect(sidebar).not.toHaveClass(/sidebar--open/)
    await expect(sidebar).toHaveJSProperty('id', 'app-sidebar')

    await menuButton.click()

    await expect(sidebar).toHaveClass(/sidebar--open/)
    await expect(backdrop).toBeVisible()

    await backdrop.click()

    await expect(sidebar).not.toHaveClass(/sidebar--open/)
    await expect(backdrop).toHaveCount(0)
  })

  test('desktop keeps the sidebar visible and omits the hamburger', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only scenario')

    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(0)
    await expect(page.locator('#app-sidebar')).toBeVisible()
  })
})
