/**
 * The page's sentences that depend on the rows: how thin a cut-off zone is,
 * read from the rows themselves, and how a step is named.
 */
import { clock, datesBetween, dayStart, nextLondonMidnight, stepNoun, zoneAbbrev } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { meansText } from '../../_template/text'
import { n, type Book } from './figures'
import type { Zone } from './zones'

/** `quarter-hours`, or `2-hour means` for a window read as means. */
export function stepsText(book: Book): string {
  return book.bucketed && book.stepMs ? meansText(book.stepMs) : stepNoun(book.stepMs)
}

/** `quarter-hour`, `hour`, `2-hour step`: one step, in a sentence. */
export function oneStep(book: Book): string {
  const s = stepNoun(book.stepMs)
  if (s.endsWith(' periods')) return `${s.replace(/ periods$/, '')} step`
  return s.replace(/s$/, '')
}

/**
 * For a zone whose download may have been cut off: what the rows hold, in
 * words, then why it isn't complete. Null for a zone the download reached in
 * full, as far as is known.
 */
export function cutOffText(zone: Zone, book: Book | null): string | null {
  if (!zone.cutOff) return null
  const why = `ENTSO-E sends these bids in pages, and gridflow’s download for ${zone.name} may have stopped at its page limit, so the bids, counts and totals shown for ${zone.name} are not complete.`
  if (!book || !book.held) return why
  const times = new Set(book.heldRows.map((r) => clock(r.t)))
  const at = times.size === 1 && !book.bucketed ? `, ${clock(book.heldRows[0].t)} ${zoneAbbrev(book.heldRows[0].t)}` : ''
  const per =
    book.mostPerDay === 1
      ? `one ${oneStep(book)} a day only${at}`
      : `at most ${n(book.mostPerDay)} ${stepsText(book)} a day`
  const counts = book.bidsPerStep
  const each = counts.length === 1 ? `, ${n(counts[0][0])} bids in each` : counts.length ? `, up to ${n(counts[0][0])} bids in each` : ''
  return `In this window gridflow holds ${zone.name}’s bids for ${per}${each}. ${why}`
}

/**
 * The clock times every held day lacks, when each held day lacks the same
 * ones (Belgium's rows stop an hour either side of UK midnight): `23:00 to
 * 01:00 BST, across midnight`. Null when the days differ, fewer than two are
 * held, or the rows are means.
 */
export function dailyHoleText(book: Book, window: DateRange): string | null {
  const step = book.stepMs
  if (book.bucketed || step === null || !book.held) return null
  const heldAt = new Set(book.heldRows.map((r) => r.t))
  let shared: string | null = null
  let days = 0
  let runs: { from: number; to: number }[] = []
  for (const iso of datesBetween(window.start, window.end)) {
    const start = dayStart(iso)
    const end = nextLondonMidnight(start)
    const times: number[] = []
    for (let t = start; t < end; t += step) times.push(t)
    if (!times.some((t) => heldAt.has(t))) continue
    days += 1
    const missing = times.filter((t) => !heldAt.has(t))
    const sig = missing.map((t) => clock(t)).join(',')
    if (shared === null) {
      shared = sig
      runs = []
      for (const t of missing) {
        const last = runs[runs.length - 1]
        if (last && t - last.to === 0) last.to = t + step
        else runs.push({ from: t, to: t + step })
      }
      if (runs.length && runs[0].from === start && runs[runs.length - 1].to === end && runs.length > 1) {
        const tail = runs.pop() as { from: number; to: number }
        runs[0] = { from: tail.from, to: runs[0].to }
      }
    } else if (sig !== shared) return null
  }
  if (days < 2 || !shared) return null
  const parts = runs.map((r) => {
    const to = clock(r.to) === '00:00' ? 'midnight' : clock(r.to)
    return clock(r.from) > clock(r.to) && to !== 'midnight' ? `${clock(r.from)} to ${to}, across midnight` : `${clock(r.from)} to ${to}`
  })
  const zone = zoneAbbrev(book.heldRows[0].t)
  return `Every day held here lacks the same ${parts.length === 1 ? 'stretch' : 'stretches'}, ${parts.join(' and ')} ${zone}: not held locally, so gaps, not zeros.`
}
