import { emitEventToDapp } from "~services/connection"
import {
  getUnlockedStatus,
  handleChangePassword,
  handleCreateVault,
  handleLock,
  handleUnlock,
  hasVault
} from "~services/vault"

export const handleVaultMessage = async (request: any, _sender: any) => {
  switch (request.type) {
    case "UNLOCK_REQUEST":
      return handleUnlock(request.payload.password)

    case "LOCK_REQUEST":
      return handleLock()

    case "GET_UNLOCKED_STATUS":
      return getUnlockedStatus()

    case "HAS_VAULT_REQUEST": {
      const hasVaultResult = await hasVault()
      return { hasVault: hasVaultResult }
    }

    case "CREATE_VAULT_REQUEST":
      return handleCreateVault(request.payload.password)

    case "CHANGE_PASSWORD_REQUEST":
      return handleChangePassword(request.payload.newPassword)

    case "EVENT_REQUEST":
      await emitEventToDapp({
        type: request.payload.event,
        result: request.payload.data || null
      })
      return { success: true }

    default:
      return undefined
  }
}
