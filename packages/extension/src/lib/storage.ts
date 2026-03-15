import { Storage } from "@plasmohq/storage"

// @plasmohq/storage handles the storage.session fallback for Firefox MV2
// (Firefox MV2 doesn't have storage.session; falls back to local storage).
export const sessionStore = new Storage({ area: "session" })
