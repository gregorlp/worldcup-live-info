import type { Match, StandingGroup, Team } from "./football-api"

// ---------------------------------------------------------------------------
// Cuadro de eliminatorias del Mundial 2026 construido a partir de los
// PARTIDOS REALES que devuelve la API (no de una proyección de la tabla).
//
// Cada fase del torneo corresponde a un "stage" de la API:
//   LAST_32 -> Dieciseisavos, LAST_16 -> Octavos, etc.
// De cada partido tomamos los equipos reales, el marcador y el ganador
// (score.winner). Si un cruce aún no tiene equipos definidos, se muestra
// un hueco "Por definir".
// ---------------------------------------------------------------------------

export type BracketContestant =
  | { kind: "team"; team: Team; groupLetter: string | null; isWinner: boolean }
  | { kind: "placeholder"; label: string }

export type BracketMatch = {
  id: number
  home: BracketContestant
  away: BracketContestant
  homeScore: number | null
  awayScore: number | null
  /** Resultado de la tanda de penales, si la hubo (ej. "5-6"). */
  penaltyLabel: string | null
  status: Match["status"]
  utcDate: string
}

/**
 * Determina el ganador real de un cruce. La API devuelve `score.winner: null`
 * cuando el partido se decide por penales, así que en ese caso comparamos la
 * tanda; si no, comparamos el marcador final.
 */
function resolveWinner(score: Match["score"]): "HOME_TEAM" | "AWAY_TEAM" | null {
  if (score.winner === "HOME_TEAM" || score.winner === "AWAY_TEAM") {
    return score.winner
  }
  const pens = score.penalties
  if (pens && pens.home != null && pens.away != null && pens.home !== pens.away) {
    return pens.home > pens.away ? "HOME_TEAM" : "AWAY_TEAM"
  }
  const ft = score.fullTime
  if (ft.home != null && ft.away != null && ft.home !== ft.away) {
    return ft.home > ft.away ? "HOME_TEAM" : "AWAY_TEAM"
  }
  return null
}

export type BracketRound = {
  id: string
  name: string
  matches: BracketMatch[]
}

export type Bracket = {
  rounds: BracketRound[]
  hasKnockoutData: boolean
}

const STAGES: { stage: string; id: string; name: string }[] = [
  { stage: "LAST_32", id: "r32", name: "Dieciseisavos" },
  { stage: "LAST_16", id: "r16", name: "Octavos" },
  { stage: "QUARTER_FINALS", id: "qf", name: "Cuartos" },
  { stage: "SEMI_FINALS", id: "sf", name: "Semifinales" },
  { stage: "THIRD_PLACE", id: "tp", name: "Tercer puesto" },
  { stage: "FINAL", id: "final", name: "Final" },
]

/** Mapa team.id -> letra de grupo, para poder navegar al grupo del equipo. */
function buildGroupLookup(standings: StandingGroup[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const g of standings) {
    const letter = (g.group ?? "").replace(/group/i, "").trim().toUpperCase()
    if (!letter) continue
    for (const row of g.table) {
      if (row.team?.id != null) map.set(row.team.id, letter)
    }
  }
  return map
}

function toContestant(
  team: Team | null | undefined,
  groups: Map<number, string>,
  isWinner: boolean,
): BracketContestant {
  if (!team || !team.name) {
    return { kind: "placeholder", label: "Por definir" }
  }
  return { kind: "team", team, groupLetter: groups.get(team.id) ?? null, isWinner }
}

// Camino principal del cuadro: el ganador de cada cruce avanza a la ronda
// siguiente, emparejando ranuras consecutivas (1ª con 2ª, 3ª con 4ª...).
// El tercer puesto queda fuera de este encadenamiento (lo juegan los
// perdedores de semifinales), así que se construye aparte con datos reales.
const MAIN_PATH = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"]

type Slot = { home: Team | null; away: Team | null; apiMatch: Match | null }

/** Equipo asignado por la API en un lado del partido (o null si es hueco). */
function assignedTeam(t: Team | null | undefined): Team | null {
  return t && t.name ? t : null
}

/** Equipo ganador real del partido (maneja penales vía resolveWinner). */
function winningTeam(m: Match): Team | null {
  const side = resolveWinner(m.score)
  if (side === "HOME_TEAM") return assignedTeam(m.homeTeam)
  if (side === "AWAY_TEAM") return assignedTeam(m.awayTeam)
  return null
}

/**
 * Enlaza cada ranura del cuadro (con sus participantes ya propagados) al
 * partido real de la API por COINCIDENCIA DE EQUIPOS. La API ordena los
 * partidos por calendario, no por posición en el cuadro, así que no se puede
 * emparejar por índice. Los partidos sin equipos asignados (futuros) se
 * reparten por orden entre las ranuras que quedaron sin enlazar.
 */
function attachApiMatches(slots: Slot[], apiMatches: Match[]): void {
  const pool = [...apiMatches]
  const slotIds = (s: Slot) => [s.home?.id, s.away?.id].filter((x): x is number => x != null)

  // 1) Coincidencia por equipos: la ranura cuyos participantes aparecen en el
  //    partido de la API.
  for (const slot of slots) {
    const ids = slotIds(slot)
    if (ids.length === 0) continue
    const idx = pool.findIndex((m) => {
      const mIds = [assignedTeam(m.homeTeam)?.id, assignedTeam(m.awayTeam)?.id].filter(
        (x): x is number => x != null,
      )
      return mIds.some((id) => ids.includes(id))
    })
    if (idx !== -1) {
      slot.apiMatch = pool[idx]
      pool.splice(idx, 1)
    }
  }

  // 2) Reparto por orden de los partidos restantes a las ranuras sin enlazar.
  for (const slot of slots) {
    if (slot.apiMatch || pool.length === 0) continue
    slot.apiMatch = pool.shift()!
  }
}

function buildSlotMatch(
  slot: Slot,
  fallbackId: number,
  groups: Map<number, string>,
): BracketMatch {
  const { home, away, apiMatch } = slot
  const winner = apiMatch ? winningTeam(apiMatch) : null
  const isHomeWinner = !!(home && winner && home.id === winner.id)
  const isAwayWinner = !!(away && winner && away.id === winner.id)

  // Marcador y penales alineados a CADA equipo (el orden home/away de la API
  // puede no coincidir con el orden de la ranura propagada).
  const scoreByTeam = new Map<number, number>()
  const penByTeam = new Map<number, number>()
  if (apiMatch) {
    const reg = apiMatch.score.regularTime
    const ft = apiMatch.score.fullTime
    const decidedByPens = apiMatch.score.duration === "PENALTY_SHOOTOUT" && reg != null
    const base = decidedByPens && reg ? reg : ft
    const hId = assignedTeam(apiMatch.homeTeam)?.id
    const aId = assignedTeam(apiMatch.awayTeam)?.id
    if (hId != null && base.home != null) scoreByTeam.set(hId, base.home)
    if (aId != null && base.away != null) scoreByTeam.set(aId, base.away)
    if (
      decidedByPens &&
      reg &&
      ft.home != null &&
      ft.away != null &&
      reg.home != null &&
      reg.away != null
    ) {
      if (hId != null) penByTeam.set(hId, ft.home - reg.home)
      if (aId != null) penByTeam.set(aId, ft.away - reg.away)
    }
  }

  const homeScore = home ? scoreByTeam.get(home.id) ?? null : null
  const awayScore = away ? scoreByTeam.get(away.id) ?? null : null
  const penHome = home ? penByTeam.get(home.id) : undefined
  const penAway = away ? penByTeam.get(away.id) : undefined
  const penaltyLabel = penHome != null && penAway != null ? `${penHome}-${penAway} pen.` : null

  return {
    id: apiMatch?.id ?? fallbackId,
    home: toContestant(home, groups, isHomeWinner),
    away: toContestant(away, groups, isAwayWinner),
    homeScore,
    awayScore,
    penaltyLabel,
    status: apiMatch?.status ?? "TIMED",
    utcDate: apiMatch?.utcDate ?? "",
  }
}

export function buildBracket(matches: Match[], standings: StandingGroup[]): Bracket {
  const groups = buildGroupLookup(standings)
  let hasKnockoutData = false

  // Partidos por fase, ordenados por id (= orden del cuadro en dieciseisavos).
  const byStage = new Map<string, Match[]>()
  for (const s of STAGES) {
    const ms = matches.filter((m) => m.stage === s.stage).sort((a, b) => a.id - b.id)
    if (ms.length > 0) byStage.set(s.stage, ms)
  }

  // Construcción ronda por ronda a lo largo del camino principal. Dieciseisavos
  // viene de la API en orden de cuadro; las siguientes rondas se generan
  // emparejando ranuras consecutivas y propagando ganadores.
  const slotsByStage = new Map<string, Slot[]>()
  let prevSlots: Slot[] | null = null

  for (const stage of MAIN_PATH) {
    const apiMatches = byStage.get(stage) ?? []
    let slots: Slot[]

    if (!prevSlots) {
      // Ronda base (dieciseisavos): los participantes son los equipos reales.
      slots = apiMatches.map((m) => ({
        home: assignedTeam(m.homeTeam),
        away: assignedTeam(m.awayTeam),
        apiMatch: m,
      }))
    } else {
      // Ronda generada: cada ranura recibe los ganadores de dos ranuras previas.
      const numSlots = Math.ceil(prevSlots.length / 2)
      slots = Array.from({ length: numSlots }, (_, j) => {
        const a = prevSlots![2 * j]
        const b = prevSlots![2 * j + 1]
        return {
          home: a ? (a.apiMatch ? winningTeam(a.apiMatch) : null) : null,
          away: b ? (b.apiMatch ? winningTeam(b.apiMatch) : null) : null,
          apiMatch: null,
        }
      })
      attachApiMatches(slots, apiMatches)
    }

    slotsByStage.set(stage, slots)
    prevSlots = slots
  }

  // Ensamblado final en el orden de STAGES (incluye el tercer puesto, que no
  // forma parte del camino principal y se construye directo desde la API).
  const rounds: BracketRound[] = []
  for (const s of STAGES) {
    if (s.stage === "THIRD_PLACE") {
      const ms = byStage.get(s.stage)
      if (!ms) continue
      const built = ms.map((m) =>
        buildSlotMatch(
          { home: assignedTeam(m.homeTeam), away: assignedTeam(m.awayTeam), apiMatch: m },
          m.id,
          groups,
        ),
      )
      rounds.push({ id: s.id, name: s.name, matches: built })
      continue
    }

    const slots = slotsByStage.get(s.stage)
    if (!slots || slots.length === 0) continue
    const built = slots.map((slot, i) => {
      if (slot.home || slot.away) hasKnockoutData = true
      return buildSlotMatch(slot, i + 1, groups)
    })
    rounds.push({ id: s.id, name: s.name, matches: built })
  }

  return { rounds, hasKnockoutData }
}
