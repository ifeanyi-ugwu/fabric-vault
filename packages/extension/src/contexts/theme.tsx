import { createContext, useContext, type ReactNode } from "react"

import { useTheme, type Theme } from "~/hooks/use-theme"

interface ThemeContextType {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const value = useTheme()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useThemeContext = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider")
  return ctx
}
