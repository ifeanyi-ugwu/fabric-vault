import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"
import { sendToBackground } from "@plasmohq/messaging"
import browser from "webextension-polyfill"

import type {
  RequestBody as ChangePasswordBody,
  ResponseBody as ChangePasswordResponse
} from "~background/messages/change-password"
import type {
  RequestBody as CreateVaultBody,
  ResponseBody as CreateVaultResponse
} from "~background/messages/create-vault"
import type { ResponseBody as GetUnlockedStatusResponse } from "~background/messages/get-unlocked-status"
import type { ResponseBody as HasVaultResponse } from "~background/messages/has-vault"
import type { ResponseBody as LockResponse } from "~background/messages/lock"
import type {
  RequestBody as UnlockBody,
  ResponseBody as UnlockResponse
} from "~background/messages/unlock"

export interface VaultContextType {
  isUnlocked: boolean
  unlock: (password: string) => Promise<void>
  lock: () => Promise<void>
  createVault: (password: string) => Promise<void>
  isInitialized: boolean
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
  hasVault: () => Promise<boolean>
  changePassword: (newPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextType | null>(null)

export const VaultProvider = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  const checkUnlockedStatus = useCallback(async () => {
    try {
      const response = await sendToBackground<never, GetUnlockedStatusResponse>({
        name: "get-unlocked-status"
      })
      setIsUnlocked(response?.isUnlocked || false)
      setIsInitialized(true)
    } catch (error) {
      console.error("Error checking unlocked status:", error)
      setIsInitialized(true)
    }
  }, [])

  useEffect(() => {
    checkUnlockedStatus()
  }, [checkUnlockedStatus])

  const unlock = useCallback(async (password: string) => {
    const response = await sendToBackground<UnlockBody, UnlockResponse>({
      name: "unlock",
      body: { password }
    })
    if (response?.success) {
      setIsUnlocked(true)
    } else {
      throw new Error(response.error)
    }
  }, [])

  const lock = useCallback(async () => {
    await sendToBackground<never, LockResponse>({ name: "lock" })
    setIsUnlocked(false)
  }, [])

  const createVault = useCallback(
    async (password: string) => {
      const response = await sendToBackground<CreateVaultBody, CreateVaultResponse>({
        name: "create-vault",
        body: { password }
      })
      if (response?.success) {
        await unlock(password)
      } else {
        throw new Error(response.error)
      }
    },
    [unlock]
  )

  const changePassword = useCallback(
    async (newPassword: string) => {
      const response = await sendToBackground<ChangePasswordBody, ChangePasswordResponse>({
        name: "change-password",
        body: { newPassword }
      })
      if (response?.success) {
        await unlock(newPassword)
      } else {
        throw new Error(response.error)
      }
    },
    [unlock]
  )

  const hasVault = useCallback(async () => {
    const response = await sendToBackground<never, HasVaultResponse>({
      name: "has-vault"
    })
    return response.hasVault
  }, [])

  const login = useCallback(
    async (password: string) => {
      return unlock(password)
    },
    [unlock]
  )

  const logout = useCallback(async () => {
    await lock()
    await browser.storage.local.remove("fabricVault")
  }, [lock])

  return (
    <VaultContext.Provider
      value={{
        isUnlocked,
        unlock,
        lock,
        createVault,
        isInitialized,
        login,
        logout,
        hasVault,
        changePassword
      }}>
      {children}
    </VaultContext.Provider>
  )
}

export const useVault = () => {
  const context = useContext(VaultContext)
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider")
  }
  return context
}
