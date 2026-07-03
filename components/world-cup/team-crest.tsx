"use client"

import { useState } from "react"
import type { Team } from "@/lib/football-api"
import { cn } from "@/lib/utils"

export function TeamCrest({ team, className }: { team: Pick<Team, "crest" | "tla" | "name">; className?: string }) {
  const [errored, setErrored] = useState(false)

  if (errored || !team.crest) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground",
          className,
        )}
        aria-hidden="true"
      >
        {team.tla}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.crest || "/placeholder.svg"}
      alt={`Escudo de ${team.name}`}
      className={cn("object-contain", className)}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  )
}
