import type { Match } from "@/lib/football-api"

// Toda la app muestra las horas en horario de Argentina (GMT-3).
export const TIME_ZONE = "America/Argentina/Buenos_Aires"

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Fase de grupos",
  LAST_16: "Octavos de final",
  ROUND_OF_16: "Octavos de final",
  QUARTER_FINALS: "Cuartos de final",
  SEMI_FINALS: "Semifinales",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final",
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ")
}

export function groupLabel(group: string | null): string | null {
  if (!group) return null
  return group.replace("GROUP_", "Grupo ").replace("_", " ")
}

export function formatKickoff(utcDate: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(utcDate))
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date)
}

/** Encabezado de día relativo (Hoy / Mañana / "lunes 30 de junio") en GMT-3. */
export function formatDayHeading(date: Date, reference = new Date()): string {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)

  const target = dayKey(date)
  const today = dayKey(reference)
  const tomorrow = dayKey(new Date(reference.getTime() + 24 * 60 * 60 * 1000))

  if (target === today) return "Hoy"
  if (target === tomorrow) return "Mañana"

  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(date)
}

/** Clave de día (YYYY-MM-DD) en horario de Argentina, para agrupar partidos. */
export function argentinaDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function isLive(status: Match["status"]): boolean {
  return status === "IN_PLAY" || status === "PAUSED"
}

export function statusLabel(status: Match["status"]): string {
  switch (status) {
    case "IN_PLAY":
      return "En juego"
    case "PAUSED":
      return "Descanso"
    case "FINISHED":
      return "Finalizado"
    case "POSTPONED":
      return "Aplazado"
    case "SUSPENDED":
      return "Suspendido"
    case "CANCELLED":
      return "Cancelado"
    default:
      return "Por jugar"
  }
}
