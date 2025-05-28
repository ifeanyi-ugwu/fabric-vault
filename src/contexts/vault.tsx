import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"

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
      const response = await chrome.runtime.sendMessage({
        type: "GET_UNLOCKED_STATUS"
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
    const response = await chrome.runtime.sendMessage({
      type: "UNLOCK_REQUEST",
      payload: { password }
    })
    if (response?.success) {
      setIsUnlocked(true)
    } else {
      throw new Error(response.error)
    }
  }, [])

  const lock = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "LOCK_REQUEST" })
    setIsUnlocked(false)
  }, [])

  const createVault = useCallback(
    async (password: string) => {
      const response = await chrome.runtime.sendMessage({
        type: "CREATE_VAULT_REQUEST",
        payload: { password }
      })
      if (response?.success) {
        // Optionally, fetch initial vault data or update UI
        await unlock(password)
      } else {
        throw new Error(response.error)
      }
    },
    [unlock]
  )

  const changePassword = useCallback(
    async (newPassword: string) => {
      const response = await chrome.runtime.sendMessage({
        type: "CHANGE_PASSWORD_REQUEST",
        payload: { newPassword }
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
    const response = await chrome.runtime.sendMessage({
      type: "HAS_VAULT_REQUEST"
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
    await chrome.storage.local.remove("fabricVault")
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
