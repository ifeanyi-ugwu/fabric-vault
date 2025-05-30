import React, { createContext, useContext, useEffect, useState } from "react"

export interface RequestData {
  id: string
  type: "sign" | "connect"
  payload: any
  origin: string
}

interface RequestContextType {
  request: RequestData | null
  loading: boolean
  error: string | null
}

const RequestContext = createContext<RequestContextType | null>(null)

export function RequestProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<RequestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const id = url.searchParams.get("requestId")

    if (!id) {
      setLoading(false)
      setError("No requestId found in URL.")
      return
    }

    chrome.storage.session.get(`pendingRequest_${id}`).then((result) => {
      const storedRequest = result[`pendingRequest_${id}`]
      if (storedRequest) {
        setRequest(storedRequest)
      } else {
        setError("Request not found.")
      }
      setLoading(false)
    })
  }, [])

  return (
    <RequestContext.Provider
      value={{
        request,
        loading,
        error
      }}>
      {children}
    </RequestContext.Provider>
  )
}

export function useRequest() {
  const ctx = useContext(RequestContext)
  if (!ctx) throw new Error("useRequest must be used within RequestProvider")
  return ctx
}
