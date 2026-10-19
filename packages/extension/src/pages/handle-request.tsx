import { useParams } from "@tanstack/react-router"

import { useRequest } from "~/contexts/request"

import { ConnectRequest } from "./connect-request"
import { PeerRequest } from "./peer-request"
import { SignRequest } from "./sign-request"

export function HandleRequest() {
  const params = useParams({ from: "/handle-request/$type" })
  const { request } = useRequest()

  if (!request) {
    return <div>No active request found.</div>
  }

  switch (params.type) {
    case "sign":
      return <SignRequest />
    case "connect":
      return <ConnectRequest />
    case "peer":
      return <PeerRequest />
    default:
      return <div>Unknown request type: {params.type}</div>
  }
}
