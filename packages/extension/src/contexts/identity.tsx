import { createContext, useContext, useEffect, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import browser from "webextension-polyfill"

import type {
  RequestBody as AddIdentityBody,
  ResponseBody as AddIdentityResponse
} from "~background/messages/add-identity"
import type { RequestBody as EmitEventBody } from "~background/messages/emit-event"
import type { ResponseBody as GetIdentitiesResponse } from "~background/messages/get-identities"
import type {
  RequestBody as RemoveIdentityBody,
  ResponseBody as RemoveIdentityResponse
} from "~background/messages/remove-identity"
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

  useEffect(() => {
    const loadIdentities = async () => {
      if (isInitialized && isUnlocked) {
        try {
          const response = await sendToBackground<never, GetIdentitiesResponse>({
            name: "get-identities"
          })
          if (response?.success && Array.isArray(response.identities)) {
            setIdentities(response.identities as Identity[])
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
    browser.storage.local.get(storageKey).then((result) => {
      const storedActiveIdentity = result[storageKey] as Identity | undefined
      if (storedActiveIdentity) {
        const initialSelected = identities.find(
          (identity) => identity.label === storedActiveIdentity.label
        )
        setSelectedIdentity(initialSelected || null)
      }
    })
  }, [identities])

  useEffect(() => {
    if (selectedIdentity) {
      browser.storage.local.set({ [storageKey]: selectedIdentity })
    }
  }, [selectedIdentity])

  const addIdentity = async (identity: Identity, privateKey: string) => {
    try {
      const response = await sendToBackground<AddIdentityBody, AddIdentityResponse>({
        name: "add-identity",
        body: { identity: { ...identity, privateKey } }
      })
      if (!response?.success) {
        throw new Error(response?.error)
      }
      setIdentities((prev) => [...prev, identity])
    } catch (error) {
      console.error("Error adding identity:", error)
      throw error
    }
  }

  const removeIdentity = async (identity: Identity) => {
    try {
      const response = await sendToBackground<RemoveIdentityBody, RemoveIdentityResponse>({
        name: "remove-identity",
        body: { label: identity.label }
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
      sendToBackground<EmitEventBody>({
        name: "emit-event",
        body: { event: "identitiesChanged", data: [identity] }
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
