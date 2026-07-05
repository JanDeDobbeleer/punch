import path from 'node:path'
import { devices, expect, test } from '@playwright/test'

// Captures polished demo-mode screenshots for README.md.
// Each test boots the app with a fresh seed (no stale localStorage),
// navigates to the desired view, and saves to docs/screenshots/.

const OUT = 'docs/screenshots'
const shot = (name: string) => path.join(OUT, `${name}.png`)

async function loadDemoMode(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Start from a clean slate on every test run so the seed is always fresh.
  await page.evaluate(() => {
    window.localStorage.removeItem('demo.v1')
    window.localStorage.setItem('demoMode', '1')
  })

  // Full reload so the hook picks up the flag and generates a fresh seed.
  await page.reload()
  await page.waitForLoadState('networkidle')
}

// Returns the ISO date string for a day that has demo entries and is
// guaranteed to be in the current month's calendar view.
function firstInMonthEntryDate(): string {
  const today = new Date()
  const dayOfWeek = (today.getDay() + 6) % 7
  // Monday of current week
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayOfWeek)

  // Walk forward from Monday until we land inside the current month
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    if (d.getMonth() === today.getMonth()) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  // Fallback: return today's ISO string
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Desktop screenshots ─────────────────────────────────────────────────────

test.describe('Desktop – demo-mode screenshots for README', () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

  test.beforeEach(async ({}, testInfo) => {
    // Only run in the Desktop Playwright project — skip when Mobile project picks this up.
    if (testInfo.project.name !== 'Desktop') test.skip()
  })

  test('01 – Clock view month calendar', async ({ page }) => {
    await loadDemoMode(page)

    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText('HOURS').first()).toBeVisible()

    await page.screenshot({ path: shot('01-clock'), fullPage: false })
  })

  test('02 – Clock view day detail panel', async ({ page }) => {
    await loadDemoMode(page)

    const dateISO = firstInMonthEntryDate()
    const cell = page.locator(`button.cal-cell[title^="${dateISO}"]`).first()
    await expect(cell).toBeVisible()
    await expect(cell).not.toBeDisabled()
    await cell.click()
    await page.waitForTimeout(300)

    await expect(page.locator('text=‹ Month overview')).toBeVisible()

    await page.screenshot({ path: shot('02-clock-day-panel'), fullPage: false })
  })

  test('03 – Projects view', async ({ page }) => {
    await loadDemoMode(page)

    await page.getByRole('button', { name: 'Projects' }).click()
    await expect(page.getByText('Website Redesign')).toBeVisible()

    await page.screenshot({ path: shot('03-projects'), fullPage: false })
  })

  test('04 – Customers view', async ({ page }) => {
    await loadDemoMode(page)

    await page.getByRole('button', { name: 'Customers' }).click()
    await expect(page.getByText('Northwind Studio')).toBeVisible()

    await page.screenshot({ path: shot('04-customers'), fullPage: false })
  })

  test('05 – Services view', async ({ page }) => {
    await loadDemoMode(page)

    await page.getByRole('button', { name: 'Services' }).click()
    await expect(page.getByText('Workshop')).toBeVisible()

    await page.screenshot({ path: shot('05-services'), fullPage: false })
  })

  test('06 – Settings view', async ({ page }) => {
    await loadDemoMode(page)

    await page.locator('button[title="Settings"]').click()

    await expect(page.getByText('Demo mode', { exact: true }).first()).toBeVisible()

    await page.screenshot({ path: shot('06-settings'), fullPage: false })
  })
})

// ─── Mobile screenshots ───────────────────────────────────────────────────────

test.describe('Mobile – demo-mode screenshots for README', () => {
  // iPhone 13 device settings minus defaultBrowserType (not allowed in describe)
  const { defaultBrowserType: _drop, ...iphone13 } = devices['iPhone 13']
  test.use(iphone13)

  test.beforeEach(async ({}, testInfo) => {
    // Only run in the Mobile Playwright project.
    if (testInfo.project.name !== 'Mobile') test.skip()
  })

  test('mobile-01 – Clock calendar', async ({ page }) => {
    await loadDemoMode(page)

    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText('HOURS').first()).toBeVisible()

    // Full-page so the FAB at the bottom is visible
    await page.screenshot({ path: shot('mobile-01-clock'), fullPage: true })
  })

  test('mobile-02 – Sidebar drawer open', async ({ page }) => {
    await loadDemoMode(page)

    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.waitForTimeout(200)

    // Sidebar should be overlaid over the calendar
    await expect(page.locator('#app-sidebar')).toBeVisible()
    // The monthly summary widget inside the sidebar is visible
    await expect(page.locator('#app-sidebar').getByText('This month')).toBeVisible()

    await page.screenshot({ path: shot('mobile-02-sidebar'), fullPage: false })
  })

  test('mobile-03 – Day detail panel', async ({ page }) => {
    await loadDemoMode(page)

    const dateISO = firstInMonthEntryDate()
    const cell = page.locator(`button.cal-cell[title^="${dateISO}"]`).first()
    await expect(cell).toBeVisible()
    await expect(cell).not.toBeDisabled()
    await cell.click()
    await page.waitForTimeout(300)

    // Day panel stacks below the calendar on mobile
    await expect(page.locator('text=‹ Month overview')).toBeVisible()

    await page.screenshot({ path: shot('mobile-03-day-panel'), fullPage: true })
  })
})
