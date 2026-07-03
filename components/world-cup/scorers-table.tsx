import type { Scorer } from "@/lib/football-api"
import { TeamCrest } from "@/components/world-cup/team-crest"
import { cn } from "@/lib/utils"

function RankBadge({ rank }: { rank: number }) {
  const isPodium = rank <= 3
  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums",
        rank === 1 && "bg-highlight text-highlight-foreground",
        rank > 1 && isPodium && "bg-highlight/30 text-highlight-foreground",
        !isPodium && "text-muted-foreground",
      )}
    >
      {rank}
    </span>
  )
}

export function ScorersTable({ scorers }: { scorers: Scorer[] }) {
  if (scorers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
        Aún no hay goleadores registrados.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-12 py-3 pl-4 text-left font-medium">#</th>
            <th className="py-3 text-left font-medium">Jugador</th>
            <th className="hidden py-3 text-left font-medium sm:table-cell">Selección</th>
            <th className="w-14 py-3 text-center font-medium">PJ</th>
            <th className="hidden w-16 py-3 text-center font-medium sm:table-cell">Asist.</th>
            <th className="w-16 py-3 pr-4 text-center font-bold text-foreground">Goles</th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((s, i) => (
            <tr key={s.player.id} className="border-b last:border-b-0">
              <td className="py-3 pl-4">
                <RankBadge rank={i + 1} />
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.player.name}</span>
                  <TeamCrest team={s.team} className="size-4 shrink-0 sm:hidden" />
                </div>
                {s.player.nationality && (
                  <span className="text-xs text-muted-foreground sm:hidden">{s.player.nationality}</span>
                )}
              </td>
              <td className="hidden py-3 sm:table-cell">
                <div className="flex items-center gap-2">
                  <TeamCrest team={s.team} className="size-5 shrink-0" />
                  <span className="text-muted-foreground">{s.team.name}</span>
                </div>
              </td>
              <td className="py-3 text-center tabular-nums text-muted-foreground">{s.playedMatches ?? "-"}</td>
              <td className="hidden py-3 text-center tabular-nums text-muted-foreground sm:table-cell">
                {s.assists ?? "-"}
              </td>
              <td className="py-3 pr-4 text-center text-base font-bold tabular-nums">{s.goals ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
