export const getSessionData = async (keys: string | string[]) => {
  return await chrome.storage.session.get(keys)
}

export const setSessionData = async (data: Record<string, any>) => {
  return await chrome.storage.session.set(data)
}

export const clearSessionData = async () => {
  return await chrome.storage.session.clear()
}

export const getLocalData = async (keys: string | string[]) => {
  return await chrome.storage.local.get(keys)
}

export const setLocalData = async (data: Record<string, any>) => {
  return await chrome.storage.local.set(data)
}

export const removeLocalData = async (keys: string | string[]) => {
  return await chrome.storage.local.remove(keys)
}
