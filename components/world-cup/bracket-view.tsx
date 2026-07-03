"use client"

import type { Bracket, BracketContestant, BracketMatch } from "@/lib/bracket"
import { TeamCrest } from "@/components/world-cup/team-crest"
import { useGroupNav } from "@/components/world-cup/group-nav"
import { formatKickoff, isLive } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Info, Trophy } from "lucide-react"

function ContestantRow({ contestant, score }: { contestant: BracketContestant; score: number | null }) {
  const goToGroup = useGroupNav()

  if (contestant.kind === "placeholder") {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="size-5 shrink-0 rounded-full border border-dashed border-muted-foreground/40"
          aria-hidden="true"
        />
        <span className="truncate text-xs italic text-muted-foreground">{contestant.label}</span>
      </div>
    )
  }

  const { team, groupLetter, isWinner } = contestant
  const clickable = groupLetter != null

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && goToGroup?.(groupLetter)}
      title={clickable ? `Ver grupo ${groupLetter}` : undefined}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
        clickable && "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
        !isWinner && "text-muted-foreground",
      )}
    >
      <TeamCrest team={team} className="size-5 shrink-0" />
      <span className={cn("truncate text-sm", isWinner ? "font-semibold" : "font-medium")}>{team.name}</span>
      <span
        className={cn(
          "ml-auto min-w-5 text-right text-sm tabular-nums",
          isWinner ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {score ?? ""}
      </span>
    </button>
  )
}

function MatchHeader({ match }: { match: BracketMatch }) {
  let label: string
  if (match.status === "FINISHED") {
    label = "Finalizado"
  } else if (isLive(match.status)) {
    label = "EN VIVO"
  } else {
    const date = new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(match.utcDate))
    label = `${date} · ${formatKickoff(match.utcDate)}`
  }

  return (
    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1">
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-wide",
          isLive(match.status) ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  )
}

export function BracketView({ bracket }: { bracket: Bracket }) {
  if (bracket.rounds.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-pretty leading-relaxed">
          Las eliminatorias aún no están disponibles. El cuadro se mostrará cuando comience la fase final.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-pretty leading-relaxed">
          Cuadro de eliminatorias con los resultados reales. El ganador de cada cruce aparece resaltado. Toca un equipo
          para ver su grupo. Los cruces aún sin definir muestran &quot;Por definir&quot;.
        </p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {bracket.rounds.map((round) => (
            <div key={round.id} className="flex w-60 shrink-0 flex-col">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                {round.id === "final" && <Trophy className="size-4 text-highlight" aria-hidden="true" />}
                {round.name}
                <span className="text-xs font-normal text-muted-foreground">({round.matches.length})</span>
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.matches.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "overflow-hidden rounded-lg border bg-card",
                      round.id === "final" && "border-highlight/60 ring-1 ring-highlight/30",
                    )}
                  >
                    <MatchHeader match={m} />
                    <ContestantRow contestant={m.home} score={m.homeScore} />
                    <div className="border-t border-dashed" />
                    <ContestantRow contestant={m.away} score={m.awayScore} />
                    {m.penaltyLabel && (
                      <p className="border-t bg-muted/40 px-3 py-1 text-right text-[10px] font-medium text-muted-foreground">
                        {m.penaltyLabel}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
