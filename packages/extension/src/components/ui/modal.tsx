import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react"

import "./modal.css"

import { Button } from "./button"

interface ModalContextType {
  isOpen: boolean
  closeModal: () => void
  openModal: () => void
  modalRef: RefObject<HTMLDivElement>
}

const ModalContext = createContext<ModalContextType | null>(null)

const useModalContext = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error("Modal subcomponents must be used within a Modal!")
  }
  return context
}

type ModalProps = {
  children: ReactNode
  defaultOpen?: boolean
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Modal({
  children,
  defaultOpen = false,
  onOpenChange,
  isOpen: controlledIsOpenProp
}: ModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen)
  const modalRef = useRef<HTMLDivElement>(null)

  // Determine the actual isOpen state: controlled or internal
  const isOpen =
    controlledIsOpenProp !== undefined ? controlledIsOpenProp : internalIsOpen

  const closeModal = () => {
    if (controlledIsOpenProp !== undefined && onOpenChange) {
      onOpenChange(false)
    } else {
      setInternalIsOpen(false)
      if (onOpenChange) {
        onOpenChange(false)
      }
    }
  }

  const openModal = () => {
    if (controlledIsOpenProp !== undefined && onOpenChange) {
      onOpenChange(true)
    } else {
      setInternalIsOpen(true)
    }
  }

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        isOpen &&
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        closeModal()
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === "Escape") {
        closeModal()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick)
      document.addEventListener("keydown", handleEscapeKey)
      document.body.style.overflow = "hidden" // Prevent scrolling behind the modal
    } else {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("keydown", handleEscapeKey)
      document.body.style.overflow = "" // Restore scrolling
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("keydown", handleEscapeKey)
      document.body.style.overflow = ""
    }
  }, [isOpen, onOpenChange, closeModal])

  return (
    <ModalContext.Provider value={{ isOpen, closeModal, openModal, modalRef }}>
      {children}
    </ModalContext.Provider>
  )
}

type ModalContentProps = {
  children: ReactNode
}

export const ModalContent = ({ children }: ModalContentProps) => {
  const { isOpen, modalRef } = useModalContext()

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        ref={modalRef}
        role="dialog"
        aria-modal="true">
        {children}
      </div>
    </div>
  )
}

type ModalTriggerProps = {
  children: ReactNode
  asChild?: boolean
}

export const ModalTrigger = ({
  children,
  asChild = false
}: ModalTriggerProps) => {
  const { openModal } = useModalContext()

  const handleOpen = () => {
    openModal()
  }

  if (asChild) {
    return (
      <div onClick={handleOpen} role="button" aria-expanded="false">
        {children}
      </div>
    )
  }

  return (
    <button className="modal-trigger" onClick={handleOpen}>
      {children}
    </button>
  )
}

type ModalHeaderProps = {
  children: ReactNode
}

export const ModalHeader = ({ children }: ModalHeaderProps) => {
  return <div className="modal-header">{children}</div>
}

type ModalBodyProps = {
  children: ReactNode
}

export const ModalBody = ({ children }: ModalBodyProps) => {
  return <div className="modal-body">{children}</div>
}

type ModalFooterProps = {
  children: ReactNode
}

export const ModalFooter = ({ children }: ModalFooterProps) => {
  return <div className="modal-footer">{children}</div>
}

type ModalCloseButtonProps = {
  children?: ReactNode
}

export const ModalCloseButton = ({
  children = "Close"
}: ModalCloseButtonProps) => {
  const { closeModal } = useModalContext()

  return (
    <Button variant="outline" size="small" onClick={closeModal}>
      {children}
    </Button>
  )
}

Modal.Trigger = ModalTrigger
Modal.Header = ModalHeader
Modal.Body = ModalBody
Modal.Footer = ModalFooter
Modal.CloseButton = ModalCloseButton
Modal.Content = ModalContent
