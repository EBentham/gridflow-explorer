#!/usr/bin/env node
/**
 * Screenshot harness: `npm run shoot -- <route> [<route> ...]`.
 *
 * Starts an in-process Vite dev server on a free port (its /api proxy goes to
 * EXPLORER_API, default http://127.0.0.1:8000), opens each route in installed
 * Edge or Chrome through puppeteer-core, and writes a light and a dark PNG per
 * route to `.shots/<route-slug>/{light,dark}-<width>.png`. Then it closes both.
 *
 * Every screen sets `data-view-ready` once its data, empty state or error has
 * rendered; the harness waits for it (20 s cap), then for fonts, the network
 * and the chart surfaces. The theme is forced twice over: the app honours
 * `?theme=light|dark`, and the page emulates `prefers-color-scheme` to match.
 * Motion is emulated as reduced, so the turbine rotor stands still.
 *
 * Env: EXPLORER_API (backend), SHOOT_BROWSER (browser executable),
 * SHOOT_WIDTH (viewport width, default 1440).
 *
 * Exit code 1 when a route never became ready or threw; console errors and
 * failed requests are listed but don't fail the run on their own.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { createServer } from 'vite'

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(FRONTEND, '.shots')
const READY_TIMEOUT_MS = 20_000
const WIDTH = Number(process.env.SHOOT_WIDTH ?? 1440)
const HEIGHT = 900
const THEMES = ['light', 'dark']

const BROWSERS = [
  process.env.SHOOT_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

function usage() {
  console.error('Usage: npm run shoot -- <route> [<route> ...]   e.g. npm run shoot -- /sources /datasets/generation-mix')
  process.exit(2)
}

/** `/sources/elexon` -> `sources-elexon`; `/` -> `root`. */
function slugOf(route) {
  return route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'root'
}

function withTheme(route, theme) {
  const url = new URL(route, 'http://placeholder')
  url.searchParams.set('theme', theme)
  return `${url.pathname}${url.search}${url.hash}`
}

function freePort() {
  return new Promise((ok, fail) => {
    const srv = createNetServer()
    srv.unref()
    srv.on('error', fail)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => ok(port))
    })
  })
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 6000 }).catch(() => undefined)
  // ResponsiveContainer measures after mount; give it two frames to draw.
  await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(undefined)))))
}

/**
 * Grow the viewport to the page's full height before capturing, so the sticky
 * rail (100svh) and the fixed land line sit where a tall window would put
 * them instead of being cut off at the first screenful.
 */
async function fitHeight(page) {
  let height = HEIGHT
  for (let i = 0; i < 4; i += 1) {
    const next = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight))
    if (next <= height) break
    height = next
    await page.setViewport({ width: WIDTH, height, deviceScaleFactor: 1 })
    await settle(page)
  }
}

async function shoot(browser, base, route) {
  const slug = slugOf(route)
  const dir = join(OUT, slug)
  mkdirSync(dir, { recursive: true })
  const results = []
  for (const theme of THEMES) {
    const page = await browser.newPage()
    const problems = { console: [], page: [], http: [] }
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.console.push(msg.text())
    })
    page.on('pageerror', (err) => problems.page.push(String(err?.message ?? err)))
    page.on('requestfailed', (req) => {
      const why = req.failure()?.errorText ?? 'failed'
      if (why !== 'net::ERR_ABORTED') problems.http.push(`${why} ${req.url()}`)
    })
    page.on('response', (res) => {
      if (res.status() >= 400) problems.http.push(`${res.status()} ${res.url()}`)
    })
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 })
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ])
    const file = join(dir, `${theme}-${WIDTH}.png`)
    let state = 'timeout'
    try {
      await page.goto(`${base}${withTheme(route, theme)}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      const handle = await page.waitForSelector('[data-view-ready]', { timeout: READY_TIMEOUT_MS }).catch(() => null)
      if (handle) state = (await handle.evaluate((el) => el.getAttribute('data-view-ready'))) || 'ready'
      await settle(page)
      await fitHeight(page)
      await page.screenshot({ path: file })
    } catch (err) {
      problems.page.push(`harness: ${err instanceof Error ? err.message : String(err)}`)
      state = 'failed'
    }
    await page.close()
    results.push({ route, theme, file, state, problems })
  }
  return results
}

async function main() {
  const routes = process.argv.slice(2).filter((a) => a !== '--')
  if (routes.length === 0 || routes.some((r) => !r.startsWith('/'))) usage()

  const executablePath = BROWSERS.find((p) => existsSync(p))
  if (!executablePath) {
    console.error('No browser found. Set SHOOT_BROWSER to an Edge or Chrome executable.')
    process.exit(2)
  }

  process.env.EXPLORER_API ??= 'http://127.0.0.1:8000'
  const port = await freePort()
  const server = await createServer({
    root: FRONTEND,
    configFile: join(FRONTEND, 'vite.config.ts'),
    logLevel: 'warn',
    clearScreen: false,
    server: { host: '127.0.0.1', port, strictPort: true },
  })
  await server.listen()
  const base = `http://127.0.0.1:${port}`
  console.log(`vite ${base}, /api -> ${process.env.EXPLORER_API}, browser ${executablePath}`)

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb'],
  })

  const all = []
  try {
    for (const route of routes) all.push(...(await shoot(browser, base, route)))
  } finally {
    await browser.close()
    await server.close()
  }

  let failed = false
  for (const r of all) {
    const bad = r.state === 'timeout' || r.state === 'failed' || r.problems.page.length > 0
    if (bad) failed = true
    const note =
      r.state === 'refreshing'
        ? '  (the backend is refreshing its store: re-shoot in 2 minutes)'
        : r.state === 'timeout'
          ? `  (no [data-view-ready] within ${READY_TIMEOUT_MS / 1000} s)`
          : ''
    console.log(`${bad ? 'FAIL' : 'ok  '} ${r.route} ${r.theme}: ${r.state}${note}\n     ${r.file}`)
    for (const m of r.problems.page) console.log(`     page error: ${m}`)
    for (const m of r.problems.console) console.log(`     console error: ${m}`)
    for (const m of r.problems.http) console.log(`     request: ${m}`)
  }
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
