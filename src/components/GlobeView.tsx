import { useEffect, useRef, useState, useCallback } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'
import type { HistoricalEvent } from '../types'
import { fetchEventsByYearAndRegion, fetchEventsByYearGlobal } from '../services/wikidata'
import TimeSlider from './TimeSlider'
import EventPanel from './EventPanel'

interface GlobePoint {
  lat: number
  lng: number
  name: string
  event?: HistoricalEvent
}

const CATEGORY_COLOR: Record<string, string> = {
  political: '#6366f1',
  military: '#ef4444',
  cultural: '#a855f7',
  economic: '#eab308',
  scientific: '#06b6d4',
  religious: '#f97316',
  geographic: '#22c55e',
  dynastic: '#ec4899',
}

export default function GlobeView() {
  const mountRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const [year, setYear] = useState(1776)
  const [events, setEvents] = useState<HistoricalEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [clickedRegion, setClickedRegion] = useState<{ name: string; lat: number; lng: number } | null>(null)

  // Initialize globe
  useEffect(() => {
    if (!mountRef.current) return

    const globe = new Globe(mountRef.current)
    globeRef.current = globe

    globe
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .width(mountRef.current.clientWidth)
      .height(mountRef.current.clientHeight)
      .pointOfView({ altitude: 2.5 })

    // Resize handler
    const onResize = () => {
      if (mountRef.current && globeRef.current) {
        globeRef.current
          .width(mountRef.current.clientWidth)
          .height(mountRef.current.clientHeight)
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Load initial global events when year changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!clickedRegion) {
        loadGlobalEvents(year)
      }
    }, 600)
    return () => clearTimeout(timeout)
  }, [year, clickedRegion])

  // Update globe points when events change
  useEffect(() => {
    if (!globeRef.current) return

    const points: GlobePoint[] = events
      .filter((e) => e.lat !== undefined && e.lng !== undefined)
      .map((e) => ({
        lat: e.lat!,
        lng: e.lng!,
        name: e.title,
        event: e,
      }))

    globeRef.current
      .pointsData(points)
      .pointLat('lat')
      .pointLng('lng')
      .pointLabel('name')
      .pointColor((d: object) => {
        const p = d as GlobePoint
        return CATEGORY_COLOR[p.event?.category ?? 'cultural'] ?? '#6366f1'
      })
      .pointRadius(0.4)
      .pointAltitude(0.01)
      .onPointClick((point: object) => {
        const p = point as GlobePoint
        if (p.event) setSelectedEvent(p.event)
      })
  }, [events])

  const handleGlobeClick = useCallback(
    async ({ lat, lng }: { lat: number; lng: number }) => {
      setClickedRegion({ name: `${lat.toFixed(1)}°, ${lng.toFixed(1)}°`, lat, lng })
      setSelectedEvent(null)
      setLoading(true)
      try {
        const results = await fetchEventsByYearAndRegion(year, lat, lng)
        setEvents(results)
      } catch (err) {
        console.error('Wikidata query failed', err)
        setEvents([])
      } finally {
        setLoading(false)
      }
    },
    [year]
  )

  // Re-attach click handler when year changes
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.onGlobeClick(handleGlobeClick)
  }, [handleGlobeClick])

  async function loadGlobalEvents(y: number) {
    setLoading(true)
    try {
      const results = await fetchEventsByYearGlobal(y)
      setEvents(results)
    } catch (err) {
      console.error('Global events query failed', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Globe canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Event panel */}
      <EventPanel
        events={events}
        selectedEvent={selectedEvent}
        onSelectEvent={setSelectedEvent}
        loading={loading}
        regionName={clickedRegion?.name}
        year={year}
      />

      {/* Time slider */}
      <div className="absolute bottom-0 left-0 right-80 pb-6 flex justify-center">
        <TimeSlider year={year} onChange={(y) => { setYear(y); setClickedRegion(null) }} />
      </div>

      {/* Instructions overlay */}
      {events.length === 0 && !loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
          <div className="text-slate-600 text-sm">Click anywhere on the globe to explore history</div>
        </div>
      )}
    </div>
  )
}
