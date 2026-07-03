"use client"

import { createContext, useContext } from "react"

/** Permite a las llaves saltar a la pestaña Grupos y enfocar un grupo concreto. */
export const GroupNavContext = createContext<((letter: string) => void) | null>(null)

export function useGroupNav() {
  return useContext(GroupNavContext)
}
