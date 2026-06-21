'use client'

import { createContext, useContext } from 'react'

/**
 * The "Brought to you by …" audio pre-roll for the current member's partner,
 * or null if there's no partner / no bumper set. Provided once in the (app)
 * layout and consumed by the audio players (POTD + lesson audio), so both can
 * play the bumper before content without re-fetching.
 */
export type PartnerBumper = {
  url: string
  partnerName: string
  /** Partner logo, shown on the video pre-roll card. Null if none uploaded. */
  logoUrl: string | null
} | null

const PartnerBumperContext = createContext<PartnerBumper>(null)

export function PartnerBumperProvider({
  value,
  children,
}: {
  value: PartnerBumper
  children: React.ReactNode
}) {
  return (
    <PartnerBumperContext.Provider value={value}>
      {children}
    </PartnerBumperContext.Provider>
  )
}

export function usePartnerBumper(): PartnerBumper {
  return useContext(PartnerBumperContext)
}
