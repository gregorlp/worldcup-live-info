"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarClock, CalendarDays, LayoutGrid, Network, Trophy } from "lucide-react"
import { GroupNavContext } from "@/components/world-cup/group-nav"

export function DashboardTabs({
  today,
  upcoming,
  standings,
  bracket,
  scorers,
  todayCount,
}: {
  today: ReactNode
  upcoming: ReactNode
  standings: ReactNode
  bracket: ReactNode
  scorers: ReactNode
  todayCount: number
}) {
  const [tab, setTab] = useState("today")
  const [pendingGroup, setPendingGroup] = useState<string | null>(null)

  const goToGroup = useCallback((letter: string) => {
    setTab("groups")
    setPendingGroup(letter)
  }, [])

  // Tras cambiar a la pestaña Grupos, hace scroll al grupo pedido y lo resalta.
  useEffect(() => {
    if (tab !== "groups" || !pendingGroup) return
    const el = document.getElementById(`group-${pendingGroup}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      el.classList.add("ring-2", "ring-primary")
      const timer = setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000)
      setPendingGroup(null)
      return () => clearTimeout(timer)
    }
    setPendingGroup(null)
  }, [tab, pendingGroup])

  return (
    <GroupNavContext.Provider value={goToGroup}>
    <Tabs value={tab} onValueChange={setTab} className="w-full gap-6">
      <TabsList className="h-auto w-full max-w-2xl flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
        <TabsTrigger value="today" className="flex-1 gap-1.5 rounded-lg py-2 text-sm data-[state=active]:bg-card">
          <CalendarDays className="size-4" aria-hidden="true" />
          Hoy
          {todayCount > 0 && (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground tabular-nums">
              {todayCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="upcoming" className="flex-1 gap-1.5 rounded-lg py-2 text-sm data-[state=active]:bg-card">
          <CalendarClock className="size-4" aria-hidden="true" />
          Próximos
        </TabsTrigger>
        <TabsTrigger value="groups" className="flex-1 gap-1.5 rounded-lg py-2 text-sm data-[state=active]:bg-card">
          <LayoutGrid className="size-4" aria-hidden="true" />
          Grupos
        </TabsTrigger>
        <TabsTrigger value="bracket" className="flex-1 gap-1.5 rounded-lg py-2 text-sm data-[state=active]:bg-card">
          <Network className="size-4" aria-hidden="true" />
          Llaves
        </TabsTrigger>
        <TabsTrigger value="scorers" className="flex-1 gap-1.5 rounded-lg py-2 text-sm data-[state=active]:bg-card">
          <Trophy className="size-4" aria-hidden="true" />
          Goleadores
        </TabsTrigger>
      </TabsList>

      <TabsContent value="today" className="mt-0">
        {today}
      </TabsContent>
      <TabsContent value="upcoming" className="mt-0">
        {upcoming}
      </TabsContent>
      <TabsContent value="groups" className="mt-0">
        {standings}
      </TabsContent>
      <TabsContent value="bracket" className="mt-0">
        {bracket}
      </TabsContent>
      <TabsContent value="scorers" className="mt-0">
        {scorers}
      </TabsContent>
    </Tabs>
    </GroupNavContext.Provider>
  )
}
