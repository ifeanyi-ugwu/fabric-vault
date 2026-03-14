import { useEffect, useState } from "react"

export type Theme = "dark" | "light"

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    chrome.storage.local.get(["theme"], (result) => {
      const saved = (result.theme as Theme) ?? "dark"
      applyTheme(saved)
      setTheme(saved)
    })
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    applyTheme(next)
    setTheme(next)
    chrome.storage.local.set({ theme: next })
  }

  return { theme, toggle }
}
