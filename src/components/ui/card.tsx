export interface CardProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
}

export const Card = ({
  children,
  title,
  subtitle,
  className = ""
}: CardProps) => {
  return (
    <div className={`card ${className}`}>
      {title && <h3 className="card-title">{title}</h3>}
      {subtitle && <p className="card-subtitle">{subtitle}</p>}
      <div className="card-content">{children}</div>
    </div>
  )
}
