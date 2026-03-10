import type { HistoricalEvent, EventCategory } from '../types'

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'

function yearToWikidate(year: number): string {
  if (year < 0) {
    const abs = Math.abs(year)
    return `-${String(abs).padStart(4, '0')}-01-01T00:00:00Z`
  }
  return `${String(year).padStart(4, '0')}-01-01T00:00:00Z`
}

// Map Wikidata instance types to our categories
function inferCategory(typeLabel: string): EventCategory {
  const t = typeLabel.toLowerCase()
  if (t.includes('war') || t.includes('battle') || t.includes('siege') || t.includes('revolt')) return 'military'
  if (t.includes('dynasty') || t.includes('reign') || t.includes('coronation')) return 'dynastic'
  if (t.includes('revolution') || t.includes('election') || t.includes('treaty') || t.includes('state')) return 'political'
  if (t.includes('religion') || t.includes('church') || t.includes('temple')) return 'religious'
  if (t.includes('discovery') || t.includes('invention') || t.includes('science')) return 'scientific'
  if (t.includes('trade') || t.includes('economic') || t.includes('market')) return 'economic'
  return 'cultural'
}

export async function fetchEventsByYearAndRegion(
  year: number,
  lat: number,
  lng: number,
  radiusKm = 1500
): Promise<HistoricalEvent[]> {
  // We query for historical events near a point, filtering by year range ±30 years
  // Using a broad approach: find items with a point in time near the year, with coordinates nearby
  const startYear = year - 25
  const endYear = year + 25

  const startDate = yearToWikidate(startYear)
  const endDate = yearToWikidate(endYear)

  const query = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coords ?startTime ?typeLabel WHERE {
  ?item wdt:P625 ?coords .
  ?item wdt:P585|wdt:P571|wdt:P580 ?startTime .
  FILTER(?startTime >= "${startDate}"^^xsd:dateTime && ?startTime <= "${endDate}"^^xsd:dateTime)
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en") }
  SERVICE wikibase:around {
    ?item wdt:P625 ?coords .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 40
`

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`

  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
  })

  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`)

  const data = await res.json()
  const bindings: WikidataBinding[] = data.results.bindings

  return bindings.map((b) => {
    const id = b.item.value.split('/').pop() ?? ''
    const typeLabel = b.typeLabel?.value ?? ''
    const coords = parseCoords(b.coords?.value)
    const startTime = b.startTime?.value
    const eventYear = startTime ? parseYear(startTime) : year

    return {
      id,
      title: b.itemLabel?.value ?? id,
      description: b.itemDescription?.value ?? '',
      year: eventYear,
      lat: coords?.lat,
      lng: coords?.lng,
      category: inferCategory(typeLabel),
      wikipediaUrl: `https://en.wikipedia.org/wiki/Special:GoToLinkedPage/wikidata/${id}`,
      wikidataId: id,
    }
  })
}

export async function fetchEventsByYearGlobal(year: number): Promise<HistoricalEvent[]> {
  const startYear = year - 10
  const endYear = year + 10
  const startDate = yearToWikidate(startYear)
  const endDate = yearToWikidate(endYear)

  const query = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coords ?startTime WHERE {
  ?item wdt:P625 ?coords .
  ?item wdt:P585|wdt:P571 ?startTime .
  FILTER(?startTime >= "${startDate}"^^xsd:dateTime && ?startTime <= "${endDate}"^^xsd:dateTime)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 60
`

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
  })

  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`)

  const data = await res.json()
  const bindings: WikidataBinding[] = data.results.bindings

  return bindings
    .filter((b) => b.coords)
    .map((b) => {
      const id = b.item.value.split('/').pop() ?? ''
      const coords = parseCoords(b.coords?.value)
      const eventYear = b.startTime?.value ? parseYear(b.startTime.value) : year

      return {
        id,
        title: b.itemLabel?.value ?? id,
        description: b.itemDescription?.value ?? '',
        year: eventYear,
        lat: coords?.lat,
        lng: coords?.lng,
        category: 'political' as EventCategory,
        wikipediaUrl: `https://en.wikipedia.org/wiki/Special:GoToLinkedPage/wikidata/${id}`,
        wikidataId: id,
      }
    })
}

export async function fetchTimelineEvents(
  civilizationOrRegion: string,
  startYear: number,
  endYear: number
): Promise<HistoricalEvent[]> {
  const startDate = yearToWikidate(startYear)
  const endDate = yearToWikidate(endYear)

  const query = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?startTime ?endTime WHERE {
  ?item wdt:P585|wdt:P571|wdt:P580 ?startTime .
  FILTER(?startTime >= "${startDate}"^^xsd:dateTime && ?startTime <= "${endDate}"^^xsd:dateTime)
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  FILTER(CONTAINS(LCASE(?label), "${civilizationOrRegion.toLowerCase()}"))
  OPTIONAL { ?item wdt:P582 ?endTime . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 50
`

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
  })

  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`)

  const data = await res.json()
  const bindings: WikidataBinding[] = data.results.bindings

  return bindings.map((b) => {
    const id = b.item.value.split('/').pop() ?? ''
    const eventYear = b.startTime?.value ? parseYear(b.startTime.value) : startYear
    const endEventYear = b.endTime?.value ? parseYear(b.endTime.value) : undefined

    return {
      id,
      title: b.itemLabel?.value ?? id,
      description: b.itemDescription?.value ?? '',
      year: eventYear,
      endYear: endEventYear,
      category: 'political' as EventCategory,
      region: civilizationOrRegion,
      wikidataId: id,
      wikipediaUrl: `https://en.wikipedia.org/wiki/Special:GoToLinkedPage/wikidata/${id}`,
    }
  })
}

export async function fetchWikipediaSummary(wikidataId: string): Promise<string> {
  // Resolve Wikidata ID to Wikipedia URL via Wikidata API
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks&sitelinkfilter=enwiki&format=json&origin=*`
  )
  if (!res.ok) return ''

  const data = await res.json()
  const entity = data.entities?.[wikidataId]
  const title = entity?.sitelinks?.enwiki?.title
  if (!title) return ''

  const summaryRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  )
  if (!summaryRes.ok) return ''

  const summaryData = await summaryRes.json()
  return summaryData.extract ?? ''
}

// ---- helpers ----

interface WikidataBinding {
  item: { value: string }
  itemLabel?: { value: string }
  itemDescription?: { value: string }
  coords?: { value: string }
  startTime?: { value: string }
  endTime?: { value: string }
  typeLabel?: { value: string }
}

function parseCoords(wkt: string | undefined): { lat: number; lng: number } | null {
  if (!wkt) return null
  // WKT format: "Point(lng lat)"
  const match = wkt.match(/Point\(([-.0-9]+)\s+([-.0-9]+)\)/)
  if (!match) return null
  return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) }
}

function parseYear(dateStr: string): number {
  // Handles "+1776-01-01T..." and "-0500-01-01T..."
  const match = dateStr.match(/^([+-]?\d+)-/)
  if (!match) return 0
  return parseInt(match[1], 10)
}
