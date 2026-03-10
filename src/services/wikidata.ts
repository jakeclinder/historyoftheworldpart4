import type { HistoricalEvent, EventCategory } from '../types'

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'

function yearToWikidate(year: number): string {
  if (year < 0) {
    const abs = Math.abs(year)
    return `-${String(abs).padStart(4, '0')}-01-01T00:00:00Z`
  }
  return `${String(year).padStart(4, '0')}-01-01T00:00:00Z`
}

function inferCategory(typeLabel: string): EventCategory {
  const t = typeLabel.toLowerCase()
  if (t.includes('war') || t.includes('battle') || t.includes('siege') || t.includes('revolt') || t.includes('conquest') || t.includes('invasion') || t.includes('armed conflict')) return 'military'
  if (t.includes('dynasty') || t.includes('reign') || t.includes('coronation')) return 'dynastic'
  if (t.includes('revolution') || t.includes('election') || t.includes('treaty') || t.includes('state') || t.includes('independence')) return 'political'
  if (t.includes('religion') || t.includes('church') || t.includes('temple')) return 'religious'
  if (t.includes('discovery') || t.includes('invention') || t.includes('science')) return 'scientific'
  if (t.includes('trade') || t.includes('economic') || t.includes('market')) return 'economic'
  return 'cultural'
}

function scoreImportance(typeLabel: string, title: string, description: string): 'critical' | 'major' | 'minor' {
  const text = `${typeLabel} ${title} ${description}`.toLowerCase()
  const tl = typeLabel.toLowerCase()

  const criticalKeywords = [
    'world war', 'civil war', 'revolution', 'empire', 'independence',
    'plague', 'pandemic', 'crusade', 'conquest', 'colonization', 'genocide',
    'nuclear', 'great war', 'hundred years', 'thirty years', 'hundred years',
  ]
  if (criticalKeywords.some((k) => text.includes(k))) return 'critical'
  if (['war', 'revolution', 'empire', 'pandemic'].some((t) => tl.includes(t))) return 'critical'

  const majorKeywords = [
    'battle', 'siege', 'rebellion', 'invasion', 'treaty', 'dynasty',
    'uprising', 'election', 'reformation', 'expedition', 'assassination',
  ]
  if (majorKeywords.some((k) => text.includes(k))) return 'major'
  if (['battle', 'treaty', 'dynasty', 'rebellion', 'armed conflict'].some((t) => tl.includes(t))) return 'major'

  return 'minor'
}

// Wikidata Q-IDs for major geopolitical event types
const MAJOR_INSTANCE_TYPES = [
  'wd:Q198',      // war
  'wd:Q178561',   // battle
  'wd:Q8065',     // revolution
  'wd:Q188451',   // military operation
  'wd:Q167466',   // treaty
  'wd:Q3839081',  // conquest
  'wd:Q625994',   // armed conflict
  'wd:Q28966989', // political assassination
].join(' ')

export async function fetchMajorEventsByYear(year: number): Promise<HistoricalEvent[]> {
  const startDate = yearToWikidate(year - 20)
  const endDate = yearToWikidate(year + 20)

  const query = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coords ?startTime ?typeLabel WHERE {
  VALUES ?instanceType { ${MAJOR_INSTANCE_TYPES} }
  ?item wdt:P31 ?instanceType .
  ?item wdt:P585|wdt:P571|wdt:P580 ?startTime .
  FILTER(?startTime >= "${startDate}"^^xsd:dateTime && ?startTime <= "${endDate}"^^xsd:dateTime)
  OPTIONAL { ?item wdt:P625 ?coords }
  ?instanceType rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
LIMIT 100`

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } })
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`)

  const data = await res.json()
  const bindings: WikidataBinding[] = data.results.bindings

  return bindings.map((b) => {
    const id = b.item.value.split('/').pop() ?? ''
    const typeLabel = b.typeLabel?.value ?? ''
    const coords = parseCoords(b.coords?.value)
    const eventYear = b.startTime?.value ? parseYear(b.startTime.value) : year
    const title = b.itemLabel?.value ?? id
    const description = b.itemDescription?.value ?? ''

    return {
      id,
      title,
      description,
      year: eventYear,
      lat: coords?.lat,
      lng: coords?.lng,
      category: inferCategory(typeLabel),
      importance: scoreImportance(typeLabel, title, description),
      wikipediaUrl: `https://en.wikipedia.org/wiki/Special:GoToLinkedPage/wikidata/${id}`,
      wikidataId: id,
    }
  })
}

export async function fetchEventsByYearAndRegion(
  year: number,
  lat: number,
  lng: number,
  radiusKm = 1500
): Promise<HistoricalEvent[]> {
  const startDate = yearToWikidate(year - 25)
  const endDate = yearToWikidate(year + 25)

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
LIMIT 40`

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } })
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`)

  const data = await res.json()
  const bindings: WikidataBinding[] = data.results.bindings

  return bindings.map((b) => {
    const id = b.item.value.split('/').pop() ?? ''
    const typeLabel = b.typeLabel?.value ?? ''
    const coords = parseCoords(b.coords?.value)
    const eventYear = b.startTime?.value ? parseYear(b.startTime.value) : year
    const title = b.itemLabel?.value ?? id
    const description = b.itemDescription?.value ?? ''

    return {
      id,
      title,
      description,
      year: eventYear,
      lat: coords?.lat,
      lng: coords?.lng,
      category: inferCategory(typeLabel),
      importance: scoreImportance(typeLabel, title, description),
      wikipediaUrl: `https://en.wikipedia.org/wiki/Special:GoToLinkedPage/wikidata/${id}`,
      wikidataId: id,
    }
  })
}

export async function fetchEventsByYearGlobal(year: number): Promise<HistoricalEvent[]> {
  const startDate = yearToWikidate(year - 10)
  const endDate = yearToWikidate(year + 10)

  const query = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coords ?startTime ?typeLabel WHERE {
  ?item wdt:P625 ?coords .
  ?item wdt:P585|wdt:P571 ?startTime .
  FILTER(?startTime >= "${startDate}"^^xsd:dateTime && ?startTime <= "${endDate}"^^xsd:dateTime)
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 60`

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } })
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`)

  const data = await res.json()
  const bindings: WikidataBinding[] = data.results.bindings

  return bindings
    .filter((b) => b.coords)
    .map((b) => {
      const id = b.item.value.split('/').pop() ?? ''
      const typeLabel = b.typeLabel?.value ?? ''
      const coords = parseCoords(b.coords?.value)
      const eventYear = b.startTime?.value ? parseYear(b.startTime.value) : year
      const title = b.itemLabel?.value ?? id
      const description = b.itemDescription?.value ?? ''

      return {
        id,
        title,
        description,
        year: eventYear,
        lat: coords?.lat,
        lng: coords?.lng,
        category: inferCategory(typeLabel),
        importance: scoreImportance(typeLabel, title, description),
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
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?startTime ?endTime ?typeLabel WHERE {
  ?item wdt:P585|wdt:P571|wdt:P580 ?startTime .
  FILTER(?startTime >= "${startDate}"^^xsd:dateTime && ?startTime <= "${endDate}"^^xsd:dateTime)
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  FILTER(CONTAINS(LCASE(?label), "${civilizationOrRegion.toLowerCase()}"))
  OPTIONAL { ?item wdt:P582 ?endTime . }
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 50`

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } })
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`)

  const data = await res.json()
  const bindings: WikidataBinding[] = data.results.bindings

  return bindings.map((b) => {
    const id = b.item.value.split('/').pop() ?? ''
    const typeLabel = b.typeLabel?.value ?? ''
    const eventYear = b.startTime?.value ? parseYear(b.startTime.value) : startYear
    const endEventYear = b.endTime?.value ? parseYear(b.endTime.value) : undefined
    const title = b.itemLabel?.value ?? id
    const description = b.itemDescription?.value ?? ''

    return {
      id,
      title,
      description,
      year: eventYear,
      endYear: endEventYear,
      category: inferCategory(typeLabel),
      importance: scoreImportance(typeLabel, title, description),
      region: civilizationOrRegion,
      wikidataId: id,
      wikipediaUrl: `https://en.wikipedia.org/wiki/Special:GoToLinkedPage/wikidata/${id}`,
    }
  })
}

export async function fetchWikipediaSummary(wikidataId: string): Promise<string> {
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
  const match = wkt.match(/Point\(([-.0-9]+)\s+([-.0-9]+)\)/)
  if (!match) return null
  return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) }
}

function parseYear(dateStr: string): number {
  const match = dateStr.match(/^([+-]?\d+)-/)
  if (!match) return 0
  return parseInt(match[1], 10)
}
