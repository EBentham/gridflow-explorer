/**
 * The three faces (DESIGN §2): Bricolage Grotesque for display (with its
 * width axis, for the condensed headings), Hanken Grotesk for UI and body,
 * Red Hat Mono for identifiers only. Loaded once at start-up; until they
 * arrive the tokens' fallbacks (system-ui, ui-monospace) stand in.
 */
const FONTS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800' +
  '&family=Hanken+Grotesk:ital,wght@0,400..700;1,400..700' +
  '&family=Red+Hat+Mono:wght@400;500' +
  '&display=swap'

function link(rel: string, href: string, crossOrigin?: string): HTMLLinkElement {
  const el = document.createElement('link')
  el.rel = rel
  el.href = href
  if (crossOrigin !== undefined) el.crossOrigin = crossOrigin
  return el
}

export function loadFonts() {
  if (document.getElementById('gf-fonts')) return
  const sheet = link('stylesheet', FONTS_URL)
  sheet.id = 'gf-fonts'
  document.head.append(link('preconnect', 'https://fonts.googleapis.com'), link('preconnect', 'https://fonts.gstatic.com', ''), sheet)
}
