/**
 * The one sentence the transfer page says beyond the line clock's own
 * (`_template/lineClock.ts`).
 */
import { daysText } from '../../_template/lineClock'

/**
 * `The capacity nominated holds nothing on Tue 8 Sep, Wed 9 Sep and 4 more
 * days that the net transfer capacity holds.`: the days a measure read
 * beside is empty on every border while the page's own measure holds values,
 * so a line starting late reads as not held rather than as a zero.
 */
export function besideMissingSentence(besideWords: string, ownWords: string, ownDays: Set<number>, besideDays: Set<number>): string {
  const missing = [...ownDays].filter((d) => !besideDays.has(d)).sort((a, b) => a - b)
  return missing.length ? `The ${besideWords} holds nothing on ${daysText(missing)} that the ${ownWords} holds.` : ''
}
