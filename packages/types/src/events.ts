/**
 * identitiesChanged: User changed active identity.
 * peerChanged: User changed connected peer.
 * connect: Connection to peer successfully established.
 * disconnect: Peer disconnection or failure.
 */
export type FabricEvents =
  | "identitiesChanged"
  | "peerChanged"
  | "connect"
  | "disconnect"
