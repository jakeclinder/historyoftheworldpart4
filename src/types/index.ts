export interface HistoricalEvent {
  id: string
  title: string
  description: string
  year: number
  endYear?: number
  lat?: number
  lng?: number
  country?: string
  region?: string
  category: EventCategory
  wikipediaUrl?: string
  wikidataId?: string
}

export type EventCategory =
  | 'political'
  | 'military'
  | 'cultural'
  | 'economic'
  | 'scientific'
  | 'religious'
  | 'geographic'
  | 'dynastic'

export interface TimeRange {
  start: number
  end: number
}

export interface GeoRegion {
  name: string
  lat: number
  lng: number
  countryCode?: string
}

export type ViewMode = 'globe' | 'timeline'
