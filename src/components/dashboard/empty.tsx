import { Button } from "~/components/ui/button"

export const Empty = ({ title, description, actionLabel, onAction }) => {
  return (
    <div className="empty-state">
      <div className="empty-icon"></div>
      <h4 className="empty-title">{title}</h4>
      <p className="empty-description">{description}</p>
      {actionLabel && (
        <Button onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
