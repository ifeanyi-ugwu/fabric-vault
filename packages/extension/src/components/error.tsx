import React from "react"

interface ErrorViewProps {
  error: Error
  onRetry?: () => void
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  return (
    <div className="container">
      <div className="content">
        <div className="empty-state">
          <div
            className="empty-icon"
            style={{ backgroundColor: "var(--danger-color)", color: "white" }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="feather feather-alert-triangle">
              <path d="M10.29 3.86L1.82 15a2 2 0 0 0 1.75 2.41h16.86a2 2 0 0 0 1.75-2.41L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <h3 className="empty-title">Oops! Something went wrong.</h3>
          {error && (
            <p className="empty-description error-message">
              {error.message || "An unexpected error occurred."}
            </p>
          )}
          {onRetry && (
            <button className="button button-primary" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
