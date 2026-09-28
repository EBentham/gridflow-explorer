import { useTheme } from './theme'

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle className="gf-stroke" cx="9" cy="9" r="3.4" />
      <path className="gf-stroke" d="M9 1.5v2 M9 14.5v2 M1.5 9h2 M14.5 9h2 M3.7 3.7l1.4 1.4 M12.9 12.9l1.4 1.4 M3.7 14.3l1.4-1.4 M12.9 5.1l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path className="gf-stroke" d="M14.6 11.3A6.2 6.2 0 0 1 6.7 3.4a6.2 6.2 0 1 0 7.9 7.9Z" />
    </svg>
  )
}

/** Light/dark switch in the rail foot: sun and moon, chartreuse on the mode showing. */
export function ThemeSwitch() {
  const { dark, pick } = useTheme()
  return (
    <div className="gf-theme" role="group" aria-label="Colour mode">
      <button type="button" aria-pressed={!dark} aria-label="Light mode" title="Light mode" onClick={() => pick('light')}>
        <SunIcon />
      </button>
      <button type="button" aria-pressed={dark} aria-label="Dark mode" title="Dark mode" onClick={() => pick('dark')}>
        <MoonIcon />
      </button>
    </div>
  )
}
