import type { StandingGroup } from "@/lib/football-api"
import { groupLabel } from "@/lib/format"
import { TeamCrest } from "@/components/world-cup/team-crest"
import { cn } from "@/lib/utils"

function groupLetterOf(group: string | null): string {
  if (!group) return ""
  return group.replace(/group/i, "").trim().toUpperCase()
}

function GroupTable({ group }: { group: StandingGroup }) {
  const title = groupLabel(group.group) ?? "Clasificación"
  const letter = groupLetterOf(group.group)

  return (
    <div
      id={letter ? `group-${letter}` : undefined}
      className="scroll-mt-24 overflow-hidden rounded-xl border bg-card transition-shadow"
    >
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Pts
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-6 py-2 pl-3 text-left font-medium">#</th>
            <th className="py-2 pl-2 text-left font-medium">Equipo</th>
            <th className="w-8 py-2 text-center font-medium">PJ</th>
            <th className="hidden w-8 py-2 text-center font-medium sm:table-cell">G</th>
            <th className="hidden w-8 py-2 text-center font-medium sm:table-cell">E</th>
            <th className="hidden w-8 py-2 text-center font-medium sm:table-cell">P</th>
            <th className="w-10 py-2 text-center font-medium">DG</th>
            <th className="w-10 py-2 pr-3 text-center font-bold text-foreground">Pts</th>
          </tr>
        </thead>
        <tbody>
          {group.table.map((row) => {
            const qualifies = row.position <= 2
            return (
              <tr key={row.team.id} className="border-t">
                <td className="py-2.5 pl-3">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded text-xs font-bold",
                      qualifies ? "bg-primary/15 text-primary" : "text-muted-foreground",
                    )}
                  >
                    {row.position}
                  </span>
                </td>
                <td className="py-2.5 pl-2">
                  <div className="flex items-center gap-2">
                    <TeamCrest team={row.team} className="size-5 shrink-0" />
                    <span className="truncate font-medium">{row.team.name}</span>
                  </div>
                </td>
                <td className="py-2.5 text-center tabular-nums text-muted-foreground">{row.playedGames}</td>
                <td className="hidden py-2.5 text-center tabular-nums text-muted-foreground sm:table-cell">{row.won}</td>
                <td className="hidden py-2.5 text-center tabular-nums text-muted-foreground sm:table-cell">{row.draw}</td>
                <td className="hidden py-2.5 text-center tabular-nums text-muted-foreground sm:table-cell">{row.lost}</td>
                <td className="py-2.5 text-center tabular-nums text-muted-foreground">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="py-2.5 pr-3 text-center font-bold tabular-nums">{row.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function GroupStandings({ groups }: { groups: StandingGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
        Las clasificaciones aún no están disponibles.
      </p>
    )
  }

  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block size-3 rounded bg-primary/15 ring-1 ring-primary/30" />
        Puestos de clasificación a la siguiente fase
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <GroupTable key={g.group ?? g.stage} group={g} />
        ))}
      </div>
    </div>
  )
}
