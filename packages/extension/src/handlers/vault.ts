import { emitEventToDapp } from "~services/connection"
import { ensureWalletReady } from "~services/session"
import {
  getUnlockedStatus,
  handleChangePassword,
  handleCreateVault,
  handleLock,
  handleUnlock,
  hasVault
} from "~services/vault"

export const handleVaultMessage = async (
  request: any,
  sender: any,
  sendResponse: any
) => {
  switch (request.type) {
    case "UNLOCK_REQUEST": {
      const result = await handleUnlock(request.payload.password)
      sendResponse(result)
      return true
    }
    case "LOCK_REQUEST": {
      const result = await handleLock()
      sendResponse(result)
      return true
    }
    case "GET_UNLOCKED_STATUS": {
      const result = await getUnlockedStatus()
      sendResponse(result)
      return true
    }
    case "HAS_VAULT_REQUEST": {
      const hasVaultResult = await hasVault()
      sendResponse({ hasVault: hasVaultResult })
      return true
    }
    case "CREATE_VAULT_REQUEST": {
      const result = await handleCreateVault(request.payload.password)
      sendResponse(result)
      return true
    }
    case "CHANGE_PASSWORD_REQUEST": {
      const { newPassword } = request.payload
      const result = await handleChangePassword(newPassword)
      sendResponse(result)
      return true
    }
    case "EVENT_REQUEST": {
      await emitEventToDapp({
        type: request.payload.event,
        result: request.payload.data || null
      })
      sendResponse({ success: true })
      return true
    }
    default:
      return false
  }
}
