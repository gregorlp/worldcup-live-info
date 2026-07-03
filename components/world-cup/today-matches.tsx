import type { Match } from "@/lib/football-api"
import { MatchCard } from "@/components/world-cup/match-card"
import { CalendarOff } from "lucide-react"

function sortByKickoff(a: Match, b: Match) {
  return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
}

export function TodayMatches({ matches, nextMatches }: { matches: Match[]; nextMatches: Match[] }) {
  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <CalendarOff className="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-base font-semibold">No hay partidos hoy</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No se disputan encuentros del Mundial en la fecha de hoy.
          </p>
        </div>

        {nextMatches.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Próximos partidos</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {nextMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[...matches].sort(sortByKickoff).map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  )
}
