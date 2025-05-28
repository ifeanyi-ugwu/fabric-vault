import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true,
  run_at: "document_start"
}

function injectScript() {
  const script = document.createElement("script")
  script.src = chrome.runtime.getURL("injected.js")
  script.type = "text/javascript"
  script.onload = () => {
    script.remove() // Clean up after injection
  }
  document.documentElement.appendChild(script)
}

injectScript()

const port = chrome.runtime.connect({ name: "fabric" })

window.addEventListener("message", (event) => {
  const msg = event.data
  if (event.source !== window || !msg || msg.from !== "webpage") {
    return
  }

  // Forward message to background script
  if (msg.kind === "request") {
    port.postMessage(msg)
  }
})

port.onMessage.addListener((response) => {
  // Receive response from background script and forward to the injected script /dapp
  window.postMessage({ ...response, from: "content" }, "*")
})

// Receive events and forward to the dapp via the injected script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.kind === "event" || message.from === "background") {
    window.postMessage({ ...message, from: "content" }, "*")
  }
  return false
})
