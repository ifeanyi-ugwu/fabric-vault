import { useEffect, useState } from "react"
import browser from "webextension-polyfill"

export type Theme = "dark" | "light"

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    browser.storage.local.get(["theme"]).then((result) => {
      const saved = (result.theme as Theme) ?? "dark"
      applyTheme(saved)
      setTheme(saved)
    })
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    applyTheme(next)
    setTheme(next)
    browser.storage.local.set({ theme: next })
  }

  return { theme, toggle }
}
