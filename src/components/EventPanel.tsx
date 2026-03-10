import { useEffect, useState } from 'react'
import type { HistoricalEvent } from '../types'
import { fetchWikipediaSummary } from '../services/wikidata'

const CATEGORY_COLORS: Record<string, string> = {
  political: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  military: 'bg-red-500/20 text-red-300 border-red-500/30',
  cultural: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  economic: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  scientific: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  religious: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  geographic: 'bg-green-500/20 text-green-300 border-green-500/30',
  dynastic: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`
  if (year === 0) return '1 CE'
  return `${year} CE`
}

interface EventPanelProps {
  events: HistoricalEvent[]
  selectedEvent: HistoricalEvent | null
  onSelectEvent: (e: HistoricalEvent | null) => void
  loading: boolean
  regionName?: string
  year: number
}

export default function EventPanel({
  events,
  selectedEvent,
  onSelectEvent,
  loading,
  regionName,
  year,
}: EventPanelProps) {
  const [wikiSummary, setWikiSummary] = useState<string>('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    if (!selectedEvent?.wikidataId) {
      setWikiSummary('')
      return
    }
    setSummaryLoading(true)
    fetchWikipediaSummary(selectedEvent.wikidataId)
      .then(setWikiSummary)
      .catch(() => setWikiSummary(''))
      .finally(() => setSummaryLoading(false))
  }, [selectedEvent])

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-black/80 backdrop-blur-md border-l border-white/10 flex flex-col z-10">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
          {regionName ? `${regionName} · ` : ''}{formatYear(year)}
        </div>
        <div className="text-sm font-semibold text-slate-200">
          {loading ? (
            <span className="text-slate-500 animate-pulse">Searching history...</span>
          ) : (
            <span>{events.length} event{events.length !== 1 ? 's' : ''} found</span>
          )}
        </div>
      </div>

      {/* Event list or detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedEvent ? (
          <div className="p-4">
            <button
              onClick={() => onSelectEvent(null)}
              className="text-xs text-indigo-400 hover:text-indigo-200 mb-3 flex items-center gap-1 cursor-pointer"
            >
              ← Back to list
            </button>
            <h2 className="text-base font-bold text-white mb-2">{selectedEvent.title}</h2>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[selectedEvent.category] ?? ''}`}>
                {selectedEvent.category}
              </span>
              <span className="text-xs text-slate-400">{formatYear(selectedEvent.year)}</span>
              {selectedEvent.endYear && (
                <span className="text-xs text-slate-500">→ {formatYear(selectedEvent.endYear)}</span>
              )}
            </div>
            {selectedEvent.description && (
              <p className="text-sm text-slate-300 mb-3">{selectedEvent.description}</p>
            )}
            {summaryLoading ? (
              <p className="text-xs text-slate-500 animate-pulse">Loading Wikipedia summary...</p>
            ) : wikiSummary ? (
              <p className="text-sm text-slate-400 leading-relaxed">{wikiSummary}</p>
            ) : null}
            {selectedEvent.wikipediaUrl && (
              <a
                href={selectedEvent.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-xs text-indigo-400 hover:text-indigo-200 border border-indigo-500/30 hover:border-indigo-400 rounded px-3 py-1.5 transition-colors"
              >
                Read on Wikipedia →
              </a>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 font-medium truncate">{event.title}</div>
                    {event.description && (
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{event.description}</div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[event.category] ?? ''}`}>
                      {event.category}
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {!loading && events.length === 0 && (
              <div className="p-6 text-center text-slate-600 text-sm">
                Click a region on the globe to explore history
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
