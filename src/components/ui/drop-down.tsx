import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react"

import "./dropdown.css"

interface DropdownContextType {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

const DropdownContext = createContext<DropdownContextType | null>(null)

const useDropdownContext = () => {
  const context = useContext(DropdownContext)
  if (!context) {
    throw new Error("Dropdown subcomponents must be used within a Dropdown!")
  }
  return context
}

type DropdownProps = {
  children: ReactNode
}

export function Dropdown({ children }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    } else {
      document.removeEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="dropdown" ref={dropdownRef}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

type DropdownTriggerProps = {
  children: ReactNode
  asChild?: boolean
}

export const DropdownTrigger = ({
  children,
  asChild = false
}: DropdownTriggerProps) => {
  const { isOpen, setIsOpen } = useDropdownContext()

  const handleClick = () => {
    setIsOpen(!isOpen)
  }

  if (asChild) {
    // This allows wrapping a custom element
    return (
      <div onClick={handleClick} role="button" aria-expanded={isOpen}>
        {children}
      </div>
    )
  }

  return (
    <button
      className="dropdown-trigger"
      onClick={handleClick}
      aria-haspopup="true"
      aria-expanded={isOpen}>
      {children}
      <span className="dropdown-arrow">&#9662;</span>
    </button>
  )
}

type DropdownContentProps = {
  children: ReactNode
  align?: "start" | "center" | "end"
}

export const DropdownContent = ({
  children,
  align = "start"
}: DropdownContentProps) => {
  const { isOpen } = useDropdownContext()

  if (!isOpen) return null

  return (
    <div className={`dropdown-content dropdown-align-${align}`} role="menu">
      {children}
    </div>
  )
}

type DropdownLabelProps = {
  children: ReactNode
}

export const DropdownLabel = ({ children }: DropdownLabelProps) => {
  return <div className="dropdown-label">{children}</div>
}

export const DropdownSeparator = () => {
  return <div className="dropdown-separator" role="separator" />
}

type DropdownItemProps = {
  children: ReactNode
  disabled?: boolean
  onSelect?: () => void
}

export const DropdownItem = ({
  children,
  disabled = false,
  onSelect
}: DropdownItemProps) => {
  const { setIsOpen } = useDropdownContext()

  const handleClick = () => {
    if (disabled) return

    if (onSelect) {
      onSelect()
    }

    setIsOpen(false)
  }

  return (
    <div
      className={`dropdown-item ${disabled ? "dropdown-item-disabled" : ""}`}
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      aria-disabled={disabled}>
      {children}
    </div>
  )
}

Dropdown.Trigger = DropdownTrigger
Dropdown.Content = DropdownContent
Dropdown.Label = DropdownLabel
Dropdown.Separator = DropdownSeparator
Dropdown.Item = DropdownItem
