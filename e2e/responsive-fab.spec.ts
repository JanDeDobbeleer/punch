import { expect, test } from '@playwright/test'

test.describe('responsive fab', () => {
  test('mobile shows the FAB and opens the entry modal', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile', 'Mobile-only scenario')

    await page.goto('/')

    const fab = page.getByRole('button', { name: 'Log entry' })

    await expect(fab).toBeVisible()
    await fab.click()
    // The FAB hides while the modal is open, so the only "Log entry" left is the modal title.
    await expect(fab).toBeHidden()
    await expect(page.getByText('Log entry', { exact: true })).toBeVisible()
  })

  test('desktop does not render the FAB', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop-only scenario')

    await page.goto('/')

    await expect(page.locator('.fab')).toHaveCount(0)
  })
})
