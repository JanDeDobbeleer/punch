import { expect, test } from '@playwright/test'

test.describe('responsive fab', () => {
  test('mobile shows the FAB and opens the hours modal', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile', 'Mobile-only scenario')

    await page.goto('/')

    const fab = page.getByRole('button', { name: 'Add hours' })

    await expect(fab).toBeVisible()
    await fab.click()
    await expect(page.getByText('Log hours')).toBeVisible()
  })

  test('desktop does not render the FAB', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only scenario')

    await page.goto('/')

    await expect(page.locator('.fab')).toHaveCount(0)
  })
})
