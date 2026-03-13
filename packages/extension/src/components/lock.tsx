import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { useVault } from "~/contexts/vault"

export function Lock() {
  const { lock } = useVault()
  const navigate = useNavigate()

  useEffect(() => {
    async function handleLock() {
      try {
        await lock()
        navigate({ to: "/unlock-wallet", replace: true })
      } catch (error) {
        console.error("Failed to lock wallet:", error)
      }
    }

    handleLock()
  }, [lock])

  return <div>Locking wallet...</div>
}
