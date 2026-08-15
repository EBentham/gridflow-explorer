/** Fixed colour array indexed by series position — stable stack colours across renders. */
const PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
  '#86bcb6',
]

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length]
}
