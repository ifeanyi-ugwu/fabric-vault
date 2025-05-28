import type { ButtonHTMLAttributes } from "react"

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children: React.ReactNode
  variant?:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "outline"
    | "text"
    | "ghost"
  size?: "small" | "medium" | "large" | "icon"
  fullWidth?: boolean
  onClick?: () => void
  type?: "button" | "submit" | "reset"
  disabled?: boolean
  className?: string
}

export const Button = ({
  children,
  variant = "primary",
  size = "medium",
  fullWidth = false,
  onClick,
  type = "button",
  disabled = false,
  className,
  ...rest
}: ButtonProps) => {
  const computedClassName = `button button-${variant} button-${size} ${fullWidth ? "full-width" : ""} ${className}`

  return (
    <button
      className={computedClassName}
      onClick={onClick}
      type={type}
      disabled={disabled}
      {...rest}>
      {children}
    </button>
  )
}
