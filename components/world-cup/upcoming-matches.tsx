import type { Match } from "@/lib/football-api"
import { argentinaDayKey, formatDayHeading } from "@/lib/format"
import { MatchCard } from "@/components/world-cup/match-card"
import { CalendarOff } from "lucide-react"

type DayGroup = {
  key: string
  date: Date
  matches: Match[]
}

function groupByDay(matches: Match[]): DayGroup[] {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  )

  const groups = new Map<string, DayGroup>()
  for (const match of sorted) {
    const date = new Date(match.utcDate)
    const key = argentinaDayKey(date)
    const existing = groups.get(key)
    if (existing) {
      existing.matches.push(match)
    } else {
      groups.set(key, { key, date, matches: [match] })
    }
  }

  return Array.from(groups.values())
}

export function UpcomingMatches({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
        <CalendarOff className="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-base font-semibold">No hay próximos partidos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No quedan encuentros programados próximamente.
        </p>
      </div>
    )
  }

  const days = groupByDay(matches)

  return (
    <div className="space-y-8">
      {days.map((day) => (
        <section key={day.key}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-semibold capitalize">{formatDayHeading(day.date)}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {day.matches.length}
            </span>
            <div className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {day.matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
