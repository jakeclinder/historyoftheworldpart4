import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { HistoricalEvent } from '../types'
import { fetchTimelineEvents } from '../services/wikidata'
import EventPanel from './EventPanel'

interface Track {
  name: string
  color: string
  events: HistoricalEvent[]
  loading: boolean
}

const DEFAULT_TRACKS = [
  { name: 'Rome', color: '#ef4444' },
  { name: 'China', color: '#eab308' },
  { name: 'Egypt', color: '#f97316' },
  { name: 'Greece', color: '#6366f1' },
  { name: 'Ottoman', color: '#a855f7' },
  { name: 'Britain', color: '#06b6d4' },
]

const TRACK_HEIGHT = 120
const TRACK_PADDING = 8
const LABEL_WIDTH = 90

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`
  if (year === 0) return '1 CE'
  return String(year)
}

export default function TimelineView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tracks, setTracks] = useState<Track[]>(
    DEFAULT_TRACKS.map((t) => ({ ...t, events: [], loading: false }))
  )
  const [viewRange, setViewRange] = useState<[number, number]>([-500, 2025])
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null)
  const [allEvents, setAllEvents] = useState<HistoricalEvent[]>([])
  const [newTrack, setNewTrack] = useState('')
  const scaleRef = useRef<d3.ScaleLinear<number, number>>(d3.scaleLinear())

  // Fetch events for a track
  async function loadTrack(name: string, idx: number) {
    setTracks((prev) => prev.map((t, i) => (i === idx ? { ...t, loading: true } : t)))
    try {
      const events = await fetchTimelineEvents(name, viewRange[0], viewRange[1])
      setTracks((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, events, loading: false } : t))
      )
    } catch {
      setTracks((prev) => prev.map((t, i) => (i === idx ? { ...t, loading: false } : t)))
    }
  }

  // Load all tracks on mount and range change
  useEffect(() => {
    tracks.forEach((_, i) => loadTrack(tracks[i].name, i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRange])

  // Collect all events for panel
  useEffect(() => {
    setAllEvents(tracks.flatMap((t) => t.events))
  }, [tracks])

  // D3 render
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const width = containerRef.current.clientWidth - 320 - LABEL_WIDTH
    const height = tracks.length * TRACK_HEIGHT + 40

    const svg = d3.select(svgRef.current)
    svg.attr('width', width + LABEL_WIDTH).attr('height', height)

    const xScale = d3
      .scaleLinear()
      .domain(viewRange)
      .range([LABEL_WIDTH, width + LABEL_WIDTH])
    scaleRef.current = xScale

    svg.selectAll('*').remove()

    // Background
    svg
      .append('rect')
      .attr('width', width + LABEL_WIDTH)
      .attr('height', height)
      .attr('fill', '#0a0a0f')

    // Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(10)
      .tickFormat((d) => formatYear(d as number))

    svg
      .append('g')
      .attr('transform', `translate(0, ${height - 30})`)
      .call(xAxis)
      .call((g) => {
        g.selectAll('text').attr('fill', '#64748b').attr('font-size', '11px')
        g.selectAll('line').attr('stroke', '#1e293b')
        g.select('.domain').attr('stroke', '#1e293b')
      })

    // Grid lines
    const ticks = xScale.ticks(10)
    svg
      .selectAll('.grid-line')
      .data(ticks)
      .join('line')
      .attr('class', 'grid-line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', height - 30)
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1)

    // Tracks
    tracks.forEach((track, idx) => {
      const trackY = idx * TRACK_HEIGHT

      // Track background
      svg
        .append('rect')
        .attr('x', LABEL_WIDTH)
        .attr('y', trackY + TRACK_PADDING)
        .attr('width', width)
        .attr('height', TRACK_HEIGHT - TRACK_PADDING * 2)
        .attr('fill', idx % 2 === 0 ? '#0f0f18' : '#12121e')
        .attr('rx', 4)

      // Track label
      svg
        .append('text')
        .attr('x', LABEL_WIDTH - 8)
        .attr('y', trackY + TRACK_HEIGHT / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', track.color)
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .text(track.name)

      if (track.loading) {
        svg
          .append('text')
          .attr('x', LABEL_WIDTH + width / 2)
          .attr('y', trackY + TRACK_HEIGHT / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#334155')
          .attr('font-size', '11px')
          .text('Loading...')
        return
      }

      // Events as rectangles (if they have duration) or circles (point events)
      track.events.forEach((event) => {
        const x = xScale(event.year)
        const hasEnd = event.endYear !== undefined
        const w = hasEnd ? Math.max(4, xScale(event.endYear!) - x) : 0

        if (hasEnd && w > 10) {
          // Duration bar
          const bar = svg
            .append('rect')
            .attr('x', x)
            .attr('y', trackY + TRACK_PADDING + 10)
            .attr('width', w)
            .attr('height', TRACK_HEIGHT - TRACK_PADDING * 2 - 20)
            .attr('fill', track.color)
            .attr('fill-opacity', 0.25)
            .attr('stroke', track.color)
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1)
            .attr('rx', 2)
            .style('cursor', 'pointer')

          bar.on('click', () => setSelectedEvent(event))
        } else {
          // Point dot
          const dot = svg
            .append('circle')
            .attr('cx', x)
            .attr('cy', trackY + TRACK_HEIGHT / 2)
            .attr('r', 5)
            .attr('fill', track.color)
            .attr('fill-opacity', 0.8)
            .style('cursor', 'pointer')

          dot.on('click', () => setSelectedEvent(event))
        }

        // Label for wider items
        const labelX = hasEnd ? x + w / 2 : x + 8
        const labelWidth = hasEnd ? w - 4 : 80

        if (labelWidth > 20) {
          svg
            .append('text')
            .attr('x', labelX)
            .attr('y', trackY + TRACK_HEIGHT / 2)
            .attr('dominant-baseline', 'middle')
            .attr('text-anchor', hasEnd ? 'middle' : 'start')
            .attr('fill', '#cbd5e1')
            .attr('font-size', '10px')
            .text(event.title.length > 20 ? event.title.slice(0, 18) + '…' : event.title)
            .style('pointer-events', 'none')
        }
      })
    })

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 50])
      .on('zoom', (event) => {
        const newScale = event.transform.rescaleX(xScale)
        const [newStart, newEnd] = newScale.domain()
        setViewRange([Math.round(newStart), Math.round(newEnd)])
      })

    svg.call(zoom)
  }, [tracks, viewRange])

  function addTrack(e: React.FormEvent) {
    e.preventDefault()
    if (!newTrack.trim()) return
    const colors = ['#22c55e', '#3b82f6', '#f43f5e', '#8b5cf6', '#14b8a6', '#f59e0b']
    const color = colors[tracks.length % colors.length]
    const idx = tracks.length
    setTracks((prev) => [...prev, { name: newTrack.trim(), color, events: [], loading: false }])
    setTimeout(() => loadTrack(newTrack.trim(), idx), 100)
    setNewTrack('')
  }

  function removeTrack(idx: number) {
    setTracks((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0a0a0f] flex flex-col">
      {/* Header controls */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/40 z-10 shrink-0">
        <span className="text-sm text-slate-400 font-medium">Civilizations:</span>
        <div className="flex gap-1.5 flex-wrap">
          {tracks.map((t, i) => (
            <span
              key={t.name}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
              style={{ borderColor: t.color + '60', color: t.color, background: t.color + '15' }}
            >
              {t.name}
              <button
                onClick={() => removeTrack(i)}
                className="opacity-50 hover:opacity-100 cursor-pointer ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={addTrack} className="flex gap-1 ml-auto">
          <input
            type="text"
            value={newTrack}
            onChange={(e) => setNewTrack(e.target.value)}
            placeholder="Add civilization…"
            className="bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-slate-300 placeholder:text-slate-600 focus:border-indigo-500 outline-none w-36"
          />
          <button
            type="submit"
            className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white cursor-pointer transition-colors"
          >
            Add
          </button>
        </form>
        <div className="text-xs text-slate-600 ml-2">
          {formatYear(viewRange[0])} → {formatYear(viewRange[1])}
          <span className="ml-2 text-slate-700">· scroll to zoom</span>
        </div>
      </div>

      {/* Timeline SVG */}
      <div className="flex-1 overflow-auto" style={{ paddingRight: '320px' }}>
        <svg ref={svgRef} className="block" />
      </div>

      {/* Event panel */}
      <EventPanel
        events={allEvents}
        selectedEvent={selectedEvent}
        onSelectEvent={setSelectedEvent}
        loading={false}
        year={viewRange[0]}
      />
    </div>
  )
}
