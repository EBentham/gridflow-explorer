import { useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { fmt0, money } from '../../../design/charts'
import type { ShellProps, VariantDef } from '../../context'
import { ProtoLink } from '../../controls'
import { useMix, usePrices, useRange } from '../../data'
import { WIND_FIXTURE_DAY } from '../../fixtures/windForecast'
import { F_LANGUAGE } from './charts'
import { Mast, type MastSpec } from './mast'
import { FGenerationScreen, FPricesScreen, FWindScreen } from './screens'
import { FDataContext, binWords, fixtureSeries, priceSeries, when, windShareSeries, windowText, type FData, type HSeries } from './series'
import './tokens.css'

const FIXTURE_SERIES = fixtureSeries(WIND_FIXTURE_DAY)

function summary(name: string, s: HSeries | null, fmt: (v: number) => string, win: string): string {
  if (!s) return `${name}, drawn as the horizon. Loading.`
  return `${name}, ${win}, drawn as the horizon: highest ${fmt(s.max.v)} at ${when(s.max.t0, s.domain)}, lowest ${fmt(s.min.v)} at ${when(s.min.t0, s.domain)}. Turbines, pylons and solar rows are drawing, not data.`
}

function useHorizon(pathname: string, data: FData, win: string): { spec: MastSpec; caption: ReactNode } {
  const wind = useMemo(() => windShareSeries(data.mix.rows), [data.mix.rows])
  const price = useMemo(() => priceSeries(data.prices.rows), [data.prices.rows])
  return useMemo(() => {
    if (pathname.startsWith('/forecasts/wind')) {
      const fmt = (v: number) => `${fmt0(v)} MW`
      return {
        spec: { series: FIXTURE_SERIES, fmt, dashed: true, label: summary('Median of a synthetic wind forecast (fixture)', FIXTURE_SERIES, fmt, '15 Sep 2026') },
        caption: (
          <>
            <b>This horizon is fixture data.</b> Its height is the median of a synthetic day-ahead wind forecast for Tue 15 Sep 2026, in MW, one point per
            half-hour. The ridge is dashed because no wind model writes to the forecast store yet.
          </>
        ),
      }
    }
    if (pathname.startsWith('/datasets/system-prices')) {
      const fmt = (v: number) => `${money(v)}/MWh`
      return {
        spec: { series: price, fmt, label: summary('GB imbalance price', price, fmt, win) },
        caption: (
          <>
            <b>The horizon is data.</b> Its height is the GB imbalance price from Elexon <code>system_prices</code> (column <code>system_sell_price</code>),{' '}
            {win}, in £/MWh; {price ? binWords(price.bin) : 'one point per half-hour'}.
            {price && price.min.v < 0 && ' The dashed line is £0: the land dips below it where the price went negative.'} The turbines, pylons and solar rows
            are drawing, not data.
          </>
        ),
      }
    }
    const fmt = (v: number) => `${Math.round(v)}%`
    return {
      spec: { series: wind, fmt, label: summary('Wind share of GB generation', wind, fmt, win) },
      caption: (
        <>
          <b>The horizon is data.</b> Its height is the wind share of GB generation: Elexon <code>fuelhh</code> column <code>wind</code> over total generation,{' '}
          {win}, in per cent; {wind ? binWords(wind.bin) : 'one point per half-hour'}. The turbines, pylons and solar rows are drawing, not data.
        </>
      ),
    }
  }, [pathname, wind, price, win])
}

function Shell({ nav, children }: ShellProps) {
  const { range } = useRange()
  const mix = useMix(range)
  const prices = usePrices(range)
  const data: FData = useMemo(
    () => ({
      mix: { rows: mix.rows, loading: mix.loading, error: mix.error },
      prices: { rows: prices.rows, loading: prices.loading, error: prices.error },
    }),
    [mix.rows, mix.loading, mix.error, prices.rows, prices.loading, prices.error],
  )
  const { pathname } = useLocation()
  const { spec, caption } = useHorizon(pathname, data, range ? windowText(range) : '')

  return (
    <FDataContext.Provider value={data}>
      <div className="f-app">
        <a className="f-skip" href="#f-work">
          Skip to the charts
        </a>
        <Mast spec={spec}>
          <div className="f-mast-row">
            <span className="f-brand">
              <b>gridflow</b> Explorer
            </span>
            <nav aria-label="Screens">
              <ul className="f-nav">
                {nav.map((n) => (
                  <li key={n.to}>
                    <ProtoLink to={n.to} className="f-nav-link">
                      {n.label}
                      {n.fixture && <span className="f-nav-tag">fixture</span>}
                    </ProtoLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </Mast>
        <main id="f-work" className="f-work">
          <p className="f-horizon-cap">{caption}</p>
          {children}
        </main>
      </div>
    </FDataContext.Provider>
  )
}

export const variant: VariantDef = {
  key: 'f',
  name: 'Horizon mast',
  line: 'A petrol masthead whose skyline is the selected range drawn as land, over a single paper column of annotated charts.',
  language: F_LANGUAGE,
  Shell,
  keyPlacement: 'aside',
  screens: { generation: FGenerationScreen, prices: FPricesScreen, wind: FWindScreen },
  round: 2,
}
