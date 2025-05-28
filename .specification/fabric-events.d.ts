/**
 * identitiesChanged: User changed active identity
 *
 * peerChanged: User changed connected peer
 *
 * connect: Connection to peer is successfully established
 *
 * disconnect: Peer Disconnection or failure
 */
export type FabricEvents =
  | "identitiesChanged"
  | "peerChanged"
  | "connect"
  | "disconnect"
