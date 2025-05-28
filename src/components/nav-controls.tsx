import { useRouter } from "@tanstack/react-router"

import "./nav-controls.css"

export function GoBackButton() {
  const router = useRouter()

  const goBack = () => {
    router.history.back()
  }

  // const goForward = () => {
  //   router.history.forward()
  // }

  const canGoBack = router.history.canGoBack()
  //const canGoForward = router.history.length < router.history.length - 1

  return (
    <div className="nav-controls">
      <button
        onClick={goBack}
        disabled={!canGoBack}
        className="nav-button back-button"
        aria-label="Go back">
        ←
      </button>
      {/* <button
        onClick={goForward}
        disabled={!canGoForward}
        className="nav-button forward-button"
        aria-label="Go forward">
        →
      </button> */}
    </div>
  )
}
