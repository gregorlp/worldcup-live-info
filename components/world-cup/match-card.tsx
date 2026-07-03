import type { Match } from "@/lib/football-api"
import { formatKickoff, groupLabel, isLive, stageLabel, statusLabel } from "@/lib/format"
import { TeamCrest } from "@/components/world-cup/team-crest"
import { cn } from "@/lib/utils"

function ScoreOrTime({ match }: { match: Match }) {
  const played = match.status === "FINISHED" || isLive(match.status)
  if (played && match.score.fullTime.home !== null) {
    return (
      <div className="flex items-center gap-2 tabular-nums">
        <span className="text-2xl font-bold leading-none">{match.score.fullTime.home}</span>
        <span className="text-muted-foreground">-</span>
        <span className="text-2xl font-bold leading-none">{match.score.fullTime.away}</span>
      </div>
    )
  }
  return <span className="text-lg font-semibold tabular-nums">{formatKickoff(match.utcDate)}</span>
}

export function MatchCard({ match }: { match: Match }) {
  const live = isLive(match.status)
  const group = groupLabel(match.group)

  return (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">
          {stageLabel(match.stage)}
          {group ? ` · ${group}` : ""}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
            live
              ? "bg-destructive/10 text-destructive"
              : match.status === "FINISHED"
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
          )}
        >
          {live && <span className="size-1.5 animate-pulse rounded-full bg-destructive" />}
          {statusLabel(match.status)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <TeamCrest team={match.homeTeam} className="size-7 shrink-0" />
          <span className="truncate text-sm font-semibold">{match.homeTeam.name}</span>
        </div>
        <ScoreOrTime match={match} />
        <div className="flex flex-1 items-center justify-end gap-3">
          <span className="truncate text-right text-sm font-semibold">{match.awayTeam.name}</span>
          <TeamCrest team={match.awayTeam} className="size-7 shrink-0" />
        </div>
      </div>
    </div>
  )
}
