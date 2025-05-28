import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { useRequest } from "~/contexts/request"
import { useVault } from "~/contexts/vault"

export const useUnlockWallet = () => {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const navigate = useNavigate()
  const { unlock } = useVault()
  const { request } = useRequest()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.target as HTMLFormElement)
    const password = formData.get("password")

    try {
      if (!password) {
        setErrorMessage("Password is required")
        return
      }

      await unlock(password.toString())

      if (request) {
        navigate({ to: `/handle-request/${request.type}?id=${request.id}` })
      } else {
        navigate({ to: "/dashboard" })
      }
    } catch (error) {
      setErrorMessage("Failed to unlock wallet: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    errorMessage,
    handleSubmit
  }
}
