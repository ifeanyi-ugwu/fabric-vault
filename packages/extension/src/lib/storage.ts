import { Storage } from "@plasmohq/storage"
import browser from "webextension-polyfill"

// @plasmohq/storage handles the storage.session fallback for Firefox MV2
// (Firefox MV2 doesn't have storage.session; falls back to local storage).
const sessionStore = new Storage({ area: "session" })

export const getSessionData = async (keys: string | string[]) => {
  const result: Record<string, any> = {}
  for (const key of Array.isArray(keys) ? keys : [keys]) {
    result[key] = await sessionStore.get(key)
  }
  return result
}

export const setSessionData = async (data: Record<string, any>) => {
  for (const [key, value] of Object.entries(data)) {
    await sessionStore.set(key, value)
  }
}

export const clearSessionData = async () => sessionStore.clear()

export const getLocalData = async (keys: string | string[] | null) =>
  browser.storage.local.get(keys as any)

export const setLocalData = async (data: Record<string, any>) =>
  browser.storage.local.set(data)

export const removeLocalData = async (keys: string | string[]) =>
  browser.storage.local.remove(keys)
