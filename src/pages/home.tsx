import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { useRequest } from "~/contexts/request"
import { useVault } from "~/contexts/vault"

export function Home() {
  const navigate = useNavigate()
  const { isUnlocked, hasVault, isInitialized } = useVault()
  const { request } = useRequest()

  useEffect(() => {
    if (!isInitialized) return

    const initialize = async () => {
      if (isUnlocked) {
        if (request) {
          navigate({ to: `/handle-request/${request.type}?id=${request.id}` })
        } else {
          navigate({ to: "/dashboard" })
        }
        return
      }

      try {
        const exists = await hasVault()

        if (exists) {
          navigate({ to: "/unlock-wallet", replace: true })
        } else {
          navigate({ to: "/create-wallet", replace: true })
        }
      } catch (error) {
        console.error("Error initializing wallet:", error)
      }
    }

    initialize()
  }, [isUnlocked, navigate, hasVault, isInitialized, request])

  /*useEffect(() => {
    chrome.storage.local
      .get("pendingTransaction")
      .then(({ pendingTransaction }) => {
        if (pendingTransaction) {
          navigate({ to: "/sign-transaction", replace: true })
        }
      })
  }, [])*/

  if (!isInitialized) {
    return <div>Loading wallet...</div>
  }

  return <div>Redirecting...</div>
}
