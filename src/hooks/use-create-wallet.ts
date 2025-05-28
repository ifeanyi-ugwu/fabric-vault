import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { useRequest } from "~/contexts/request"
import { useVault } from "~/contexts/vault"
import { validatePassword } from "~/utils/validate-password"

export const useCreateWallet = () => {
  const [errorMessage, setErrorMessage] = useState("")
  const navigate = useNavigate()
  const { createVault } = useVault()
  const { request } = useRequest()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.target as HTMLFormElement)
    const newPassword = formData.get("newPassword")
    const confirmPassword = formData.get("confirmPassword")

    if (!newPassword) {
      setErrorMessage("Password is required")
      return
    }

    const result = validatePassword(newPassword.toString())
    if (!result.isValid) {
      setErrorMessage(result.errors.join(" "))
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match")
      return
    }

    try {
      await createVault(newPassword.toString())

      setErrorMessage("")
      if (request) {
        navigate({ to: `/handle-request/${request.type}?id=${request.id}` })
      } else {
        navigate({ to: "/dashboard" })
      }
    } catch (error) {
      setErrorMessage("Failed to create wallet: " + error.message)
    }
  }

  return {
    errorMessage,
    handleSubmit
  }
}
