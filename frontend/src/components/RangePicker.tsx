import { useState } from 'react'
import { lastNDays, type DateRange } from '../lib/range'

interface RangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const PRESETS = [
  { label: '1d', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
] as const

/**
 * Day-granular preset buttons (1d / 7d / 30d) plus a "Custom" mode exposing
 * two `<input type="date">`. Day-granular, not hour-granular, because the
 * API's range params are inclusive settlement dates (`lib/range.ts`).
 */
export function RangePicker({ value, onChange }: RangePickerProps) {
  const activePreset = PRESETS.find((preset) => {
    const range = lastNDays(preset.days)
    return range.start === value.start && range.end === value.end
  })
  // Lazy initial only — whichever mode the incoming value implies at mount.
  // Subsequent preset/custom switches are user-driven, not re-derived here.
  const [customMode, setCustomMode] = useState(() => !activePreset)

  return (
    <div className="range-picker">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className={!customMode && activePreset?.label === preset.label ? 'active' : ''}
          onClick={() => {
            setCustomMode(false)
            onChange(lastNDays(preset.days))
          }}
        >
          {preset.label}
        </button>
      ))}
      <button type="button" className={customMode ? 'active' : ''} onClick={() => setCustomMode(true)}>
        Custom
      </button>
      {customMode && (
        <span className="range-picker-custom">
          <input
            type="date"
            value={value.start}
            max={value.end}
            onChange={(event) => onChange({ start: event.target.value, end: value.end })}
          />
          <span>to</span>
          <input
            type="date"
            value={value.end}
            min={value.start}
            onChange={(event) => onChange({ start: value.start, end: event.target.value })}
          />
        </span>
      )}
    </div>
  )
}
