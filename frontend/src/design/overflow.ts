/**
 * Whether a scrolling table holds more than its box shows, down or sideways,
 * and the house cue that says so in words: scrollbars can be hidden, so a
 * table cut off at an edge must never look complete.
 */
import { useEffect, useState, type RefObject } from 'react'

export interface Overflow {
  /** Rows below the box's bottom edge. */
  down: boolean
  /** Columns past the box's right edge. */
  sideways: boolean
}

/** Watches a scrolling box and its content, and reports which edges cut something off. */
export function useOverflow(box: RefObject<HTMLElement | null>): Overflow {
  const [overflow, setOverflow] = useState<Overflow>({ down: false, sideways: false })
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      const down = el.scrollHeight > el.clientHeight + 1
      const sideways = el.scrollWidth > el.clientWidth + 1
      setOverflow((prev) => (prev.down === down && prev.sideways === sideways ? prev : { down, sideways }))
    })
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [box])
  return overflow
}

/** The cue under a table its box cuts off, or null when it shows whole. */
export function overflowCue({ down, sideways }: Overflow): string | null {
  if (down && sideways) return 'Scroll the table down for the rest of its rows, and sideways for the rest of its columns.'
  if (down) return 'Scroll the table for the rest of its rows.'
  if (sideways) return 'The table is wider than the panel: scroll it sideways for the rest of its columns.'
  return null
}
