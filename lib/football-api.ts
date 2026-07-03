import "server-only"
import { getAzureAccessToken } from "./azure-token"

// URL del gateway de Azure API Management. APIM se encarga de inyectar
// la token real de football-data.org hacia el backend, así que la app
// solo habla con APIM.
const BASE_URL = process.env.APIM_BASE_URL ?? "https://apim-football-data.azure-api.net/worldcup"
const COMPETITION = "WC" // FIFA World Cup 2026

export type Team = {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
}

export type ScoreSide = {
  home: number | null
  away: number | null
}

export type Match = {
  id: number
  utcDate: string
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "SUSPENDED" | "CANCELLED"
  matchday: number | null
  stage: string
  group: string | null
  homeTeam: Team
  awayTeam: Team
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null
    duration: string
    fullTime: ScoreSide
    halfTime: ScoreSide
    regularTime?: ScoreSide
    extraTime?: ScoreSide
    penalties?: ScoreSide
  }
}

export type StandingRow = {
  position: number
  team: Team
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export type StandingGroup = {
  stage: string
  type: string
  group: string | null
  table: StandingRow[]
}

export type Scorer = {
  player: {
    id: number
    name: string
    nationality: string | null
  }
  team: Team
  playedMatches: number | null
  goals: number | null
  assists: number | null
  penalties: number | null
}

export type CompetitionInfo = {
  name: string
  emblem: string
  currentSeason: {
    startDate: string
    endDate: string
    currentMatchday: number | null
  }
}

async function apiFetch<T>(path: string, revalidate: number): Promise<T> {
  const subscriptionKey = process.env.APIM_SUBSCRIPTION_KEY
  if (!subscriptionKey) {
    throw new Error("APIM_SUBSCRIPTION_KEY no está configurada.")
  }

  // Token Bearer de Azure AD (cacheado en memoria) para autenticar contra APIM.
  const accessToken = await getAzureAccessToken()

  console.log(`[v0] APIM -> GET ${BASE_URL}${path}`)
  const startedAt = Date.now()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
    next: { revalidate },
  })
  console.log(`[v0] APIM <- ${res.status} ${path} (${Date.now() - startedAt}ms)`)

  if (!res.ok) {
    throw new Error(`Error de la API (${res.status}) al solicitar ${path}`)
  }

  return res.json() as Promise<T>
}

export async function getCompetition(): Promise<CompetitionInfo> {
  return apiFetch<CompetitionInfo>(`/competitions/${COMPETITION}`, 3600)
}

export async function getStandings(): Promise<StandingGroup[]> {
  const data = await apiFetch<{ standings: StandingGroup[] }>(
    `/competitions/${COMPETITION}/standings`,
    300,
  )
  // Solo las tablas TOTAL por grupo (excluye HOME/AWAY duplicados)
  return data.standings.filter((s) => s.type === "TOTAL")
}

export async function getMatches(): Promise<Match[]> {
  const data = await apiFetch<{ matches: Match[] }>(
    `/competitions/${COMPETITION}/matches`,
    60,
  )
  return data.matches
}

export async function getScorers(limit = 100): Promise<Scorer[]> {
  const data = await apiFetch<{ scorers: Scorer[] }>(
    `/competitions/${COMPETITION}/scorers?limit=${limit}`,
    300,
  )
  // Orden determinista: goles desc, asistencias desc, menos partidos, nombre.
  return [...data.scorers].sort((a, b) => {
    const goals = (b.goals ?? 0) - (a.goals ?? 0)
    if (goals !== 0) return goals
    const assists = (b.assists ?? 0) - (a.assists ?? 0)
    if (assists !== 0) return assists
    const matches = (a.playedMatches ?? 0) - (b.playedMatches ?? 0)
    if (matches !== 0) return matches
    return a.player.name.localeCompare(b.player.name)
  })
}

// Clave de fecha (YYYY-MM-DD) en horario de Argentina (GMT-3).
const AR_TIME_ZONE = "America/Argentina/Buenos_Aires"
function argentinaDateKey(date: Date): string {
  // en-CA produce el formato YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Devuelve los partidos cuya fecha, en horario de Argentina, es hoy. */
export function filterTodayMatches(matches: Match[], reference = new Date()): Match[] {
  const today = argentinaDateKey(reference)
  return matches.filter((m) => argentinaDateKey(new Date(m.utcDate)) === today)
}
