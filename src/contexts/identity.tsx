import { createContext, useContext, useEffect, useState } from "react"

import { useVault } from "./vault"

export interface Identity {
  /**
   * Unique identifier for the identity, also meant for display purposes in dapp's ui
   */
  label: string
  /**
   * MSP ID this identity belongs to
   */
  mspId: string
  /**
   * Certificate as a PEM string
   */
  certificate: string
}

interface IdentityContextType {
  identities: Identity[]
  selectedIdentity: Identity | null
  switchIdentity: (identity: Identity) => void
  addIdentity: (identity: Identity, privateKey: string) => Promise<void>
  removeIdentity: (identity: Identity) => Promise<void>
  isReady: boolean
}

const IdentityContext = createContext<IdentityContextType | null>(null)

const storageKey = "selectedIdentity"

export const IdentityProvider = ({ children }) => {
  const { isUnlocked, isInitialized } = useVault()
  const [identities, setIdentities] = useState<Identity[]>([])
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(
    null
  )
  const [isReady, setIsReady] = useState(false)

  // Load identities from the vault when it becomes available
  useEffect(() => {
    const loadIdentities = async () => {
      if (isInitialized && isUnlocked) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: "GET_IDENTITIES_REQUEST"
          })
          if (response?.success && Array.isArray(response.identities)) {
            setIdentities(response.identities)
            setIsReady(true)
          } else {
            setIdentities([])
            setIsReady(false)
            throw new Error(response?.error)
          }
        } catch (error) {
          console.error("Failed to load identities:", error)
          setIsReady(false)
        }
      } else {
        setIdentities([])
        setIsReady(false)
      }
    }

    loadIdentities()
  }, [isUnlocked, isInitialized])

  useEffect(() => {
    // Load selected identity from Chrome Storage on component mount
    chrome.storage.local.get([storageKey], (result) => {
      const storedActiveIdentity = result[storageKey]
      if (storedActiveIdentity) {
        const initialSelected = identities.find(
          (identity) => identity.label === storedActiveIdentity.label
        )
        setSelectedIdentity(initialSelected || null)
      }
    })
  }, [identities])

  useEffect(() => {
    // Save selected identity to Chrome Storage whenever it changes
    if (selectedIdentity) {
      chrome.storage.local.set({ [storageKey]: selectedIdentity })
    }
  }, [selectedIdentity])

  const addIdentity = async (identity: Identity, privateKey: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ADD_IDENTITY_REQUEST",
        payload: {
          identity: {
            ...identity,
            privateKey
          } // Send full identity
        }
      })
      if (!response?.success) {
        throw new Error(response?.error)
      }
      setIdentities((prev) => [...prev, identity]) // Update local state
    } catch (error) {
      console.error("Error adding identity:", error)
      throw error
    }
  }

  const removeIdentity = async (identity: Identity) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "REMOVE_IDENTITY_REQUEST",
        payload: { label: identity.label }
      })
      if (!response?.success) {
        throw new Error(response?.error)
      }
      setIdentities((prev) => prev.filter((id) => id.label !== identity.label))
      if (selectedIdentity?.label === identity.label) {
        setSelectedIdentity(null)
      }
    } catch (error) {
      console.error("Error removing identity:", error)
      throw error
    }
  }

  const switchIdentity = (identity: Identity) => {
    const identityExists = identities.find((i) => i.label === identity.label)
    if (identityExists) {
      setSelectedIdentity(identity)
      chrome.runtime.sendMessage({
        type: "EVENT_REQUEST",
        payload: {
          event: "identitiesChanged",
          data: [identity]
        }
      })
    }
  }

  return (
    <IdentityContext.Provider
      value={{
        identities,
        selectedIdentity,
        isReady,
        addIdentity,
        removeIdentity,
        switchIdentity
      }}>
      {children}
    </IdentityContext.Provider>
  )
}

export const useIdentity = () => {
  const context = useContext(IdentityContext)
  if (!context) {
    throw new Error("useIdentity must be used within a IdentityProvider")
  }
  return context
}
