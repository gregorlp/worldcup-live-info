import {
  filterTodayMatches,
  getCompetition,
  getMatches,
  getScorers,
  getStandings,
  type Match,
} from "@/lib/football-api"
import { buildBracket } from "@/lib/bracket"
import { SiteHeader } from "@/components/world-cup/site-header"
import { DashboardTabs } from "@/components/world-cup/dashboard-tabs"
import { TodayMatches } from "@/components/world-cup/today-matches"
import { UpcomingMatches } from "@/components/world-cup/upcoming-matches"
import { GroupStandings } from "@/components/world-cup/group-standings"
import { BracketView } from "@/components/world-cup/bracket-view"
import { ScorersTable } from "@/components/world-cup/scorers-table"
import { AlertTriangle } from "lucide-react"

export const revalidate = 60

function upcomingMatches(matches: Match[], limit = 4): Match[] {
  const now = Date.now()
  return matches
    .filter((m) => new Date(m.utcDate).getTime() > now && m.status !== "FINISHED")
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .slice(0, limit)
}

/** Próximos partidos (excluye los de hoy), para los siguientes días. */
function upcomingByDay(matches: Match[], todayMatches: Match[], maxMatches = 40): Match[] {
  const now = Date.now()
  const todayIds = new Set(todayMatches.map((m) => m.id))
  const finishedOrLive = new Set(["FINISHED", "IN_PLAY", "PAUSED"])
  return matches
    .filter(
      (m) =>
        !todayIds.has(m.id) &&
        new Date(m.utcDate).getTime() > now &&
        !finishedOrLive.has(m.status),
    )
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .slice(0, maxMatches)
}

export default async function Page() {
  try {
    const [competition, standings, matches, scorers] = await Promise.all([
      getCompetition(),
      getStandings(),
      getMatches(),
      getScorers(100),
    ])

    const today = new Date()
    const todayMatches = filterTodayMatches(matches, today)
    const nextDays = upcomingByDay(matches, todayMatches)
    const matchesPlayed = matches.filter((m) => m.status === "FINISHED").length
    const bracket = buildBracket(matches, standings)

    return (
      <div className="min-h-screen bg-background">
        <SiteHeader
          competition={competition}
          matchesPlayed={matchesPlayed}
          totalMatches={matches.length}
          today={today}
        />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <DashboardTabs
            todayCount={todayMatches.length}
            today={<TodayMatches matches={todayMatches} nextMatches={upcomingMatches(matches)} />}
            upcoming={<UpcomingMatches matches={nextDays} />}
            standings={<GroupStandings groups={standings} />}
            bracket={<BracketView bracket={bracket} />}
            scorers={<ScorersTable scorers={scorers} />}
          />
        </main>
        <footer className="border-t py-6 text-center text-xs text-muted-foreground">
          Datos proporcionados por football-data.org
        </footer>
      </div>
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido"
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 size-10 text-destructive" aria-hidden="true" />
          <h1 className="text-lg font-semibold">No se pudieron cargar los datos</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Comprueba que la variable FOOTBALL_DATA_API_KEY esté configurada y que tu plan tenga acceso al Mundial.
          </p>
        </div>
      </div>
    )
  }
}
