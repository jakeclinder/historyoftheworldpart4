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

const CATEGORY_DOT: Record<string, string> = {
  political: 'bg-blue-400',
  military: 'bg-red-400',
  cultural: 'bg-purple-400',
  economic: 'bg-yellow-400',
  scientific: 'bg-cyan-400',
  religious: 'bg-orange-400',
  geographic: 'bg-green-400',
  dynastic: 'bg-pink-400',
}

const ALL_CATEGORIES = [
  'political', 'military', 'cultural', 'economic',
  'scientific', 'religious', 'geographic', 'dynastic',
]

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`
  if (year === 0) return '1 CE'
  return `${year} CE`
}

function importanceWeight(e: HistoricalEvent): number {
  if (e.importance === 'critical') return 3
  if (e.importance === 'major') return 2
  return 1
}

export interface RankingEntry {
  name: string
  color: string
  score: number
  eventCount: number
  rank: number
}

interface EventPanelProps {
  events: HistoricalEvent[]
  selectedEvent: HistoricalEvent | null
  onSelectEvent: (e: HistoricalEvent | null) => void
  loading: boolean
  regionName?: string
  year: number
  // Filter props (globe view)
  activeCategories?: Set<string>
  onToggleCategory?: (cat: string) => void
  minImportance?: 'all' | 'major' | 'critical'
  onSetMinImportance?: (imp: 'all' | 'major' | 'critical') => void
  // Ranking (timeline view)
  rankings?: RankingEntry[]
}

export default function EventPanel({
  events,
  selectedEvent,
  onSelectEvent,
  loading,
  regionName,
  year,
  activeCategories,
  onToggleCategory,
  minImportance,
  onSetMinImportance,
  rankings,
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

  const sortedEvents = [...events].sort((a, b) => importanceWeight(b) - importanceWeight(a))
  const hasFilters = activeCategories !== undefined

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-black/80 backdrop-blur-md border-l border-white/10 flex flex-col z-10">
      {/* Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
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

      {/* Filter controls (globe view) */}
      {hasFilters && !selectedEvent && (
        <div className="p-3 border-b border-white/10 shrink-0 space-y-2">
          {/* Importance filter */}
          <div className="flex gap-1">
            {(['all', 'major', 'critical'] as const).map((level) => (
              <button
                key={level}
                onClick={() => onSetMinImportance?.(level)}
                className={`flex-1 text-xs py-1 rounded cursor-pointer transition-colors ${
                  minImportance === level
                    ? level === 'critical'
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                      : level === 'major'
                      ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                      : 'bg-white/10 text-slate-200 border border-white/20'
                    : 'text-slate-500 border border-white/5 hover:border-white/15'
                }`}
              >
                {level === 'all' ? 'All' : level === 'major' ? 'Major+' : '★ Critical'}
              </button>
            ))}
          </div>
          {/* Category toggles */}
          <div className="flex flex-wrap gap-1">
            {ALL_CATEGORIES.map((cat) => {
              const active = activeCategories?.has(cat)
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory?.(cat)}
                  title={cat}
                  className={`text-xs px-1.5 py-0.5 rounded border capitalize cursor-pointer transition-opacity ${CATEGORY_COLORS[cat]} ${active ? 'opacity-100' : 'opacity-25'}`}
                >
                  {cat.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Influence ranking (timeline view) */}
      {rankings && rankings.length > 0 && !selectedEvent && (
        <div className="p-3 border-b border-white/10 shrink-0">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Influence Ranking</div>
          <div className="space-y-1.5">
            {rankings.map((entry) => {
              const maxScore = rankings[0].score || 1
              const barWidth = Math.max(4, (entry.score / maxScore) * 100)
              const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null
              return (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="text-xs w-5 text-center shrink-0">
                    {medal ?? <span className="text-slate-600">{entry.rank}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium truncate" style={{ color: entry.color }}>
                        {entry.name}
                      </span>
                      <span className="text-xs text-slate-600 shrink-0 ml-1">
                        {entry.score}pts · {entry.eventCount}ev
                      </span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: entry.color }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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

            {selectedEvent.importance === 'critical' && (
              <div className="flex items-center gap-1.5 mb-2 text-amber-400 text-xs font-semibold">
                <span>★</span>
                <span>Major Geopolitical Event</span>
              </div>
            )}

            <h2 className={`text-base font-bold mb-2 ${
              selectedEvent.importance === 'critical' ? 'text-amber-100' : 'text-white'
            }`}>
              {selectedEvent.title}
            </h2>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[selectedEvent.category] ?? ''}`}>
                {selectedEvent.category}
              </span>
              {selectedEvent.importance === 'major' && (
                <span className="text-xs px-2 py-0.5 rounded border bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                  ◆ Major
                </span>
              )}
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
            {sortedEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${
                  event.importance === 'critical' ? 'border-l-2 border-amber-500/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      {event.importance === 'critical' && (
                        <span className="text-amber-400 text-xs shrink-0">★</span>
                      )}
                      {event.importance === 'major' && (
                        <span className="text-indigo-400 text-xs shrink-0">◆</span>
                      )}
                      <div className={`text-sm font-medium truncate ${
                        event.importance === 'critical' ? 'text-amber-100' : 'text-slate-200'
                      }`}>
                        {event.title}
                      </div>
                    </div>
                    {event.description && (
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{event.description}</div>
                    )}
                  </div>
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${CATEGORY_DOT[event.category] ?? 'bg-slate-400'}`} />
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
