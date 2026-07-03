import type { CompetitionInfo } from "@/lib/football-api"
import { formatLongDate } from "@/lib/format"

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-bold leading-tight tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function SiteHeader({
  competition,
  matchesPlayed,
  totalMatches,
  today,
}: {
  competition: CompetitionInfo
  matchesPlayed: number
  totalMatches: number
  today: Date
}) {
  const matchday = competition.currentSeason.currentMatchday

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            En directo · Edición 2026
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Copa Mundial de la FIFA
          </h1>
          <p className="text-sm capitalize text-muted-foreground">{formatLongDate(today)}</p>
        </div>

        <div className="flex items-center gap-6 rounded-xl border bg-background/60 px-5 py-4">
          <Stat label="Jornada" value={matchday ? `${matchday}` : "-"} />
          <div className="h-10 w-px bg-border" />
          <Stat label="Partidos jugados" value={`${matchesPlayed}/${totalMatches}`} />
        </div>
      </div>
    </header>
  )
}
