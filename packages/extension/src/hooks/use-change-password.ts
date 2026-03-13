import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { useVault } from "~/contexts/vault"
import { validatePassword } from "~/utils/validate-password"

export function useChangePassword() {
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { login, changePassword } = useVault()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage("")
    setSuccessMessage("")

    const formData = new FormData(e.target as HTMLFormElement)
    const currentPassword = formData.get("currentPassword")
    const newPassword = formData.get("newPassword")
    const confirmPassword = formData.get("confirmPassword")

    if (!newPassword || !currentPassword) {
      setErrorMessage("Password is required")
      setLoading(false)
      return
    }

    const result = validatePassword(newPassword.toString())
    if (!result.isValid) {
      setErrorMessage(result.errors.join(" "))
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match")
      setLoading(false)
      return
    }

    try {
      await login(currentPassword.toString())

      await changePassword(newPassword.toString())

      setSuccessMessage("Password changed successfully")

      // Navigate back to dashboard after 2 seconds
      setTimeout(() => {
        navigate({ to: "/dashboard" })
      }, 2000)
    } catch (error) {
      console.error("Error changing password:", error)
      setErrorMessage("Failed to change password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => navigate({ to: "/dashboard" })

  return { handleSubmit, errorMessage, loading, successMessage, handleCancel }
}
