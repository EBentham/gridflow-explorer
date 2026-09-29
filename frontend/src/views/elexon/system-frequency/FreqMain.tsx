/**
 * The main panel. Chart: system frequency on the UK clock, every reading held
 * (or, past about eight days, the backend's means), against the
 * 50 Hz nominal line, the statutory limits and the narrower band the working
 * panel counts. The value axis always takes in both limits, so how close the
 * frequency came to them reads off the chart. Table: the template's.
 *
 * `SeriesChart` has no horizontal reference lines, so this chart is composed
 * here from the shared theme's pieces, as the power-stack page's curve is
 * (NEEDS.md).
 */
import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, Extreme, TooltipBox, type TipRow } from '../../../design/charts'
import { CHART, CURSOR, GRID, extremeAnchor, lineProps, timeAxis, valueAxis } from '../../../design/chartTheme'
import { fmtN, niceTicks, stepDigits } from '../../../design/format'
import { axisClockCaption, instantLabel, periodLabel, ukTimeTicks, windowDomain } from '../../../design/time'
import { SeriesBody } from '../../_template/SeriesBody'
import { extremesOf, type WideRow } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { BAND_FILL, FREQ_COLOR, NARROW, NOMINAL_HZ, STATUTORY, bandText, freqDef, heldPoints, meanNoun, measuredStep, periodNoun, spanText } from './figures'

const HEIGHT = 420

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: readonly { payload?: WideRow }[]
}

function LineLabel({ viewBox, text, below = false }: { viewBox?: { x?: number; y?: number; width?: number }; text: string; below?: boolean }) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - 6
  const y = (viewBox?.y ?? 0) + (below ? 14 : -6)
  return (
    <text x={x} y={y} textAnchor="end" className="gf-extreme" paintOrder="stroke" stroke="var(--chart-surface)" strokeWidth={4} strokeLinejoin="round">
      {text}
    </text>
  )
}

const signedHz = (v: number) => `${v > 0 ? '+' : ''}${fmtN(v, 3)} Hz`

export function FreqMain({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const def = freqDef(model)
  const rows = model?.rows
  const points = useMemo(() => (rows && def ? heldPoints(rows, def) : []), [rows, def])
  const ex = useMemo(() => (rows && def ? extremesOf(rows, def) : null), [rows, def])
  const domain = useMemo(() => (ctx.window ? windowDomain(ctx.window.start, ctx.window.end) : null), [ctx.window])
  const ticks = useMemo(() => (domain ? ukTimeTicks(domain[0], domain[1]) : null), [domain])
  const rowAt = useMemo(() => new Map((rows ?? []).map((r) => [r.t, r])), [rows])
  if (ctx.mode === 'table') return <SeriesBody ctx={ctx} />
  if (!model || !def || !rows || !domain || !ticks) return null
  if (!points.length) return <p className="gf-state">Rows are held for this window, but none holds a reading to draw. The table lists them.</p>

  const bucketed = model.bucketed
  const step = measuredStep(points)
  const lo = Math.min(STATUTORY[0], ex?.low.v ?? STATUTORY[0])
  const hi = Math.max(STATUTORY[1], ex?.high.v ?? STATUTORY[1])
  const scale = niceTicks(lo, hi, 5)
  const digits = stepDigits(scale.ticks[1] - scale.ticks[0])
  const what = bucketed ? meanNoun(model.stepMs) : 'reading'
  const period = periodNoun(model.stepMs)

  const renderTip = ({ active, label, payload }: TipProps) => {
    const t = typeof label === 'number' ? label : payload?.[0]?.payload?.t
    if (!active || t === undefined) return null
    const v = rowAt.get(t)?.[def.field]
    const title = bucketed ? periodLabel(t, model.stepMs) : instantLabel(t, { seconds: true })
    if (typeof v !== 'number') return <TooltipBox title={title} rows={[]} note="No reading held" />
    const tipRows: TipRow[] = [
      {
        key: 'v',
        color: FREQ_COLOR,
        label: bucketed ? 'Mean frequency' : 'Frequency',
        value: def.unit.format(v),
      },
      {
        key: 'd',
        color: 'transparent',
        label: 'From 50 Hz',
        value: signedHz(v - NOMINAL_HZ),
      },
    ]
    const note =
      v < STATUTORY[0] || v > STATUTORY[1]
        ? `Outside the statutory ${bandText(STATUTORY)}`
        : v < NARROW[0] || v > NARROW[1]
          ? `Outside ${bandText(NARROW)}`
          : bucketed
            ? 'Mean over the period'
            : undefined
    return <TooltipBox title={title} rows={tipRows} note={note} />
  }

  const when = (t: number) => (bucketed ? periodLabel(t, model.stepMs) : instantLabel(t, { seconds: true }))

  return (
    <>
      <ChartFrame height={HEIGHT} caption={axisClockCaption(domain[0], domain[1])}>
        <ComposedChart data={rows} margin={CHART.margin}>
          <CartesianGrid {...GRID} />
          <DayRules midnights={ticks.midnights} />
          <XAxis {...timeAxis(domain, ticks)} />
          <YAxis
            {...valueAxis(def.unit.caption, scale, {
              width: 52,
              format: (v) => fmtN(v, digits),
            })}
          />
          <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
          <ReferenceLine y={STATUTORY[1]} stroke="var(--chart-axis)" strokeWidth={1.25} ifOverflow="hidden" label={<LineLabel text={`Statutory limit ${fmtN(STATUTORY[1], 1)} Hz`} />} />
          <ReferenceLine y={STATUTORY[0]} stroke="var(--chart-axis)" strokeWidth={1.25} ifOverflow="hidden" label={<LineLabel text={`Statutory limit ${fmtN(STATUTORY[0], 1)} Hz`} below />} />
          <ReferenceArea y1={NARROW[0]} y2={NARROW[1]} fill={BAND_FILL} fillOpacity={1} stroke="none" ifOverflow="hidden" />
          <ReferenceLine y={NOMINAL_HZ} stroke="var(--chart-axis)" strokeWidth={1} ifOverflow="hidden" />
          <Line dataKey={def.field} {...lineProps(FREQ_COLOR, { fixture: ctx.fixture })} strokeWidth={bucketed ? CHART.line : 1} />
          {ex && <Extreme x={ex.high.t} y={ex.high.v} anchor={extremeAnchor(ex.high.t, domain)} color={FREQ_COLOR} text={`${def.unit.format(ex.high.v)}, highest ${what}, ${when(ex.high.t)}`} />}
          {ex && ex.low.t !== ex.high.t && (
            <Extreme x={ex.low.t} y={ex.low.v} anchor={extremeAnchor(ex.low.t, domain)} below color={FREQ_COLOR} text={`${def.unit.format(ex.low.v)}, lowest ${what}, ${when(ex.low.t)}`} />
          )}
        </ComposedChart>
      </ChartFrame>
      <p className="gf-hint">
        {bucketed ? (
          <>
            Each point is the mean of the readings in its {period}, as the window is read as {model.stepMs ? meansText(model.stepMs) : 'means'}. A mean flattens the swings inside its {period}:
            readings can cross {fmtN(NARROW[0], 1)} or {fmtN(NARROW[1], 1)} Hz while every mean stays inside, so the highest and lowest here are means, not readings. Choose 7 days or fewer to draw
            every reading.
          </>
        ) : (
          <>
            Each point is one reading, drawn at its stamp; the readings held are {step ? spanText(step.ms) : 'an unknown time'} apart
            {step && step.other > 0 ? ` except across ${step.other.toLocaleString('en-GB')} ${step.other === 1 ? 'gap' : 'gaps'}` : ''}.
          </>
        )}{' '}
        The middle rule is 50 Hz, the nominal frequency; the shaded band around it is {bandText(NARROW)},{' '}
        {bucketed ? 'the band the page counts time outside on a window of 7 days or fewer' : 'the band the panel below counts time outside'}. A gap is a time with no reading held.
      </p>
    </>
  )
}
