import { useState, useRef } from 'react'

interface TimeSliderProps {
  year: number
  onChange: (year: number) => void
  min?: number
  max?: number
}

const PRESETS = [
  { label: '3000 BCE', year: -3000 },
  { label: '500 BCE', year: -500 },
  { label: '1 CE', year: 1 },
  { label: '1000', year: 1000 },
  { label: '1492', year: 1492 },
  { label: '1776', year: 1776 },
  { label: '1914', year: 1914 },
  { label: '1945', year: 1945 },
  { label: '2000', year: 2000 },
]

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`
  if (year === 0) return '1 CE'
  return `${year} CE`
}

export default function TimeSlider({ year, onChange, min = -3000, max = 2025 }: TimeSliderProps) {
  const [inputValue, setInputValue] = useState('')
  const [editMode, setEditMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleInputSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseInt(inputValue)
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed)
    }
    setEditMode(false)
    setInputValue('')
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 w-[min(90vw,700px)]">
      {/* Preset buttons */}
      <div className="flex gap-1 flex-wrap justify-center">
        {PRESETS.map((p) => (
          <button
            key={p.year}
            onClick={() => onChange(p.year)}
            className={`px-2 py-0.5 text-xs rounded border transition-all cursor-pointer ${
              Math.abs(year - p.year) < 10
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : 'bg-black/40 border-white/10 text-slate-400 hover:border-indigo-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Slider + year display */}
      <div className="flex items-center gap-3 w-full bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
        <input
          type="range"
          min={min}
          max={max}
          value={year}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 accent-indigo-500 cursor-pointer"
        />
        {editMode ? (
          <form onSubmit={handleInputSubmit} className="flex gap-1">
            <input
              ref={inputRef}
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="year"
              className="w-24 bg-black/80 border border-indigo-500 rounded px-2 py-1 text-sm text-white text-center"
              autoFocus
              onBlur={() => setEditMode(false)}
            />
          </form>
        ) : (
          <button
            onClick={() => {
              setEditMode(true)
              setInputValue(String(year))
              setTimeout(() => inputRef.current?.select(), 50)
            }}
            className="min-w-[90px] text-right text-sm font-mono font-semibold text-indigo-300 hover:text-white cursor-pointer transition-colors"
          >
            {formatYear(year)}
          </button>
        )}
      </div>
    </div>
  )
}
