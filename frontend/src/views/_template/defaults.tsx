/**
 * Each body's default panels, as slots a page's config can replace one by
 * one: the main panel draws the body; the key, working and side panels hold
 * the figures every dataset of that kind supports without page code.
 */
import { DAY_MS, instantLabel, periodLabel, stepNoun } from '../../design/time'
import type { DatasetView, PageContext, PanelSlots, SeriesView, SlotSpec } from '../define'
import { EventsBody } from './EventsBody'
import { daySeries, keyStamp, plannedParts, relatedParts, unitsOf } from './panelHelpers'
import { About, EventsDays, EventsSummary, ReferenceCounts, ReferenceSummary, SeriesDays, SeriesKey, SourceLine } from './panels'
import { ReferenceBody } from './ReferenceBody'
import { SeriesBody } from './SeriesBody'
import { planPanels } from './seriesPanels'
import { grainStepMs, meansText } from './text'
import { displayUnit } from './units'

/**
 * The main panel's source line: each dataset drawn with its columns, split,
 * filters and unit, then the window. Before the rows are read, or when they
 * fail, it names what the page asks for instead.
 */
export function mainSrc(ctx: PageContext) {
  const filters = ctx.response?.filters
  if (ctx.view.body === 'series') {
    const drawn = ctx.series ? planPanels(ctx).panels.flatMap((p) => p.series) : []
    if (!ctx.series || !drawn.length) {
      const planned = plannedParts(ctx)
      return <SourceLine ctx={ctx} columns={planned.columns} by={planned.by} filters={planned.filters} unit={planned.unit} also={planned.also} />
    }
    const own = drawn.filter((d) => d.from === 'self')
    const shown = own.length ? own : ctx.series.drawn
    return <SourceLine ctx={ctx} columns={[...new Set(shown.map((d) => d.column))]} by={ctx.series.group} filters={filters} unit={unitsOf(shown)} also={relatedParts(ctx, drawn)} />
  }
  if (ctx.view.body === 'events') {
    const clock = ctx.dataset.clock?.column
    return <SourceLine ctx={ctx} filters={filters} what={clock ? <>one row per event, at its <code>{clock}</code></> : 'one row per event, by its time'} />
  }
  return <SourceLine ctx={ctx} filters={filters} what="every row as held" window={false} />
}

const main = (Body: SlotSpec['Body']): SlotSpec => ({ title: (ctx) => ctx.view.title ?? ctx.view.label, src: mainSrc, Body })

const about: SlotSpec = {
  title: 'About this data',
  src: (ctx) => {
    const read = Date.parse(ctx.readAt)
    return <SourceLine ctx={ctx} what={Number.isFinite(read) ? `local coverage as read ${instantLabel(read)}` : 'local coverage'} window={false} />
  },
  Body: About,
}

/**
 * Rows that hold text only: nothing to key or summarise but the rows
 * themselves. Before the rows are read (or when they fail), the columns'
 * units say, so a panel keeps its title in every state.
 */
function textOnly(ctx: PageContext): boolean {
  if (ctx.series) return !ctx.series.all.length && ctx.series.textColumns.length > 0
  if (ctx.view.body !== 'series') return false
  const specs = ctx.view.values
  const columns = specs?.map((v) => v.column) ?? ctx.dataset.values.map((v) => v.column)
  const unitOf = (c: string) => specs?.find((s) => s.column === c)?.unit ?? ctx.dataset.values.find((v) => v.column === c)?.unit
  return columns.length > 0 && columns.every((c) => !displayUnit(unitOf(c)).numeric)
}

/**
 * A series shown as a table whose rows are a day or more apart: the table
 * already lists every value, so the working panel gives each column's range
 * instead of repeating it. The step is the rows' own, else the grain's.
 */
function rangesOnly(ctx: PageContext): boolean {
  if (ctx.view.body !== 'series' || ctx.view.chart !== false || textOnly(ctx)) return false
  const step = ctx.series ? ctx.series.stepMs : grainStepMs(ctx.dataset)
  return step !== null && step >= DAY_MS
}

/** The key's H2: a series shown as a table lists latest values rather than keying a chart. */
function seriesKeyTitle(view: DatasetView): string {
  return view.body === 'series' && view.chart === false ? 'Latest values' : 'Key'
}

const SERIES: Required<PanelSlots> = {
  main: main(SeriesBody),
  key: {
    title: (ctx) => (textOnly(ctx) ? 'Rows' : seriesKeyTitle(ctx.view)),
    src: (ctx) => {
      const model = ctx.series
      if (textOnly(ctx)) return <SourceLine ctx={ctx} columns={model ? model.textColumns.map((c) => c.column) : plannedParts(ctx).columns} what="text values" />
      const tableOnly = (ctx.view as SeriesView).chart === false
      const drawn = model ? (tableOnly ? model.drawn : planPanels(ctx).panels.flatMap((p) => p.series)) : []
      if (!drawn.length) {
        const planned = plannedParts(ctx)
        return <SourceLine ctx={ctx} unit={planned.unit} also={planned.also.map((p) => ({ ...p, columns: undefined, by: null, filters: null }))} what="latest held values" window={false} />
      }
      const own = drawn.filter((d) => d.from === 'self')
      const stamp = keyStamp(ctx)
      const held = model?.bucketed && model.stepMs ? `latest ${meansText(model.stepMs)}` : 'latest held values'
      return <SourceLine ctx={ctx} unit={unitsOf(own)} also={relatedParts(ctx, drawn, false)} what={stamp ? `${held}, ${periodLabel(stamp.t, stamp.stepMs)}` : held} window={false} />
    },
    Body: SeriesKey,
  },
  working: {
    title: (ctx) => {
      if (textOnly(ctx)) return 'Rows by day'
      if (rangesOnly(ctx)) return 'Lowest and highest'
      const step = ctx.series?.stepMs ?? null
      if (step !== null && step > DAY_MS) return 'Periods in range'
      return step !== null && step >= DAY_MS ? 'Values in range' : 'Days in range'
    },
    src: (ctx) => {
      const def = daySeries(ctx)
      const model = ctx.series
      if (textOnly(ctx)) return <SourceLine ctx={ctx} columns={model ? model.textColumns.map((c) => c.column) : plannedParts(ctx).columns} what="rows holding a value per UK day" />
      if (rangesOnly(ctx)) {
        const planned = plannedParts(ctx)
        return <SourceLine ctx={ctx} columns={model ? model.drawn.map((d) => d.column) : planned.columns} unit={model ? unitsOf(model.drawn) : planned.unit} what="each column's values held, lowest and highest" />
      }
      if (!def || !model) {
        const planned = plannedParts(ctx)
        return <SourceLine ctx={ctx} columns={planned.columns} unit={planned.unit} what="per UK day" />
      }
      if (model.stepMs !== null && model.stepMs > DAY_MS) return <SourceLine ctx={ctx} columns={[def.column]} unit={def.unit.label} what={`${def.label}, each period as held`} />
      const daily = model.stepMs !== null && model.stepMs >= DAY_MS
      const held = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
      return <SourceLine ctx={ctx} columns={[def.column]} unit={def.unit.label} what={`${def.label} per UK day: ${daily ? 'the value' : `${held} held, mean, lowest and highest`}`} />
    },
    Body: SeriesDays,
  },
  side: about,
}

const EVENTS: Required<PanelSlots> = {
  main: main(EventsBody),
  key: { title: 'In this window', src: (ctx) => <SourceLine ctx={ctx} what="events held" />, Body: EventsSummary },
  working: { title: 'Events by day', src: (ctx) => <SourceLine ctx={ctx} what="events per UK day" />, Body: EventsDays },
  side: about,
}

const REFERENCE: Required<PanelSlots> = {
  main: main(ReferenceBody),
  key: { title: 'Table', src: (ctx) => <SourceLine ctx={ctx} what="rows and columns as held" window={false} />, Body: ReferenceSummary },
  working: {
    title: (ctx) => {
      const by = ctx.view.body === 'reference' ? ctx.view.countBy : undefined
      return by ? `Rows by ${ctx.view.body === 'reference' && ctx.view.columns?.find((c) => c.field === by)?.label?.toLowerCase() || by}` : 'Columns'
    },
    src: (ctx) => {
      const by = ctx.view.body === 'reference' ? ctx.view.countBy : undefined
      return <SourceLine ctx={ctx} columns={by ? [by] : []} what={by ? 'rows per value' : 'distinct values per column'} window={false} />
    },
    Body: ReferenceCounts,
  },
  side: about,
}

const BASE = { series: SERIES, events: EVENTS, reference: REFERENCE }

/** The H2s a panel shows before the source list is read, when its title is worked out from the data. */
const PENDING_TITLES: Record<DatasetView['body'], Record<keyof PanelSlots, string>> = {
  series: { main: '', key: 'Key', working: 'Days in range', side: 'About this data' },
  events: { main: '', key: 'In this window', working: 'Events by day', side: 'About this data' },
  reference: { main: '', key: 'Table', working: 'Columns', side: 'About this data' },
}

/** The four panels for a dataset: the view's own slots over its body's defaults. */
export function slotsFor(view: DatasetView): Required<PanelSlots> {
  return { ...BASE[view.body], ...Object.fromEntries(Object.entries(view.panels ?? {}).filter(([, v]) => v !== undefined)) }
}

/** A panel's H2. Without a page context (the source list not read yet, or failed) a worked-out title falls back to a fixed one. */
export function panelTitle(view: DatasetView, area: keyof PanelSlots, ctx: PageContext | null): string {
  const { title } = slotsFor(view)[area]
  if (typeof title === 'string') return title
  if (ctx) return title(ctx)
  if (area === 'main') return view.title ?? view.label
  if (area === 'key' && view.body === 'series') return seriesKeyTitle(view)
  return PENDING_TITLES[view.body][area]
}
