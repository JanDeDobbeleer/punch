import { expect, test } from '@playwright/test'

function screenshotPath(name: string, projectName: string): string {
  const projectSlug = projectName.toLowerCase().replace(/\s+/g, '-')
  return `e2e/screenshots/${name}-${projectSlug}.png`
}

test.describe('responsive layout smoke checks', () => {
  test('mobile avoids horizontal overflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile', 'Mobile-only scenario')

    await page.goto('/')

    const noOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    ))

    expect(noOverflow).toBe(true)
  })

  test('captures an initial screenshot for manual review', async ({ page }, testInfo) => {
    await page.goto('/')
    await page.screenshot({ path: screenshotPath('track-week-initial', testInfo.project.name), fullPage: true })
  })
})
