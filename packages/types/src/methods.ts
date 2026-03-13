/**
 * fabric_requestIdentities: Request the list of available identities (e.g., user certificates).
 *
 * fabric_identities: Fetch the identities the client has access to.
 *
 * fabric_peer: Get the currently connected Fabric peer endpoint.
 *
 * fabric_evaluateTransaction: Simulate a transaction without modifying ledger state.
 *
 * fabric_submitTransaction: Submit a state-changing transaction; waits for ledger commit.
 *
 * fabric_submitAsync: Submit a state-changing transaction; returns immediately after orderer confirmation.
 *
 * fabric_subscribe: Register for real-time event notifications (block or chaincode events).
 *
 * fabric_unsubscribe: Cancel an active subscription by ID.
 */
export type FabricMethods =
  | "fabric_requestIdentities"
  | "fabric_identities"
  | "fabric_peer"
  | "fabric_evaluateTransaction"
  | "fabric_submitTransaction"
  | "fabric_submitAsync"
  | "fabric_subscribe"
  | "fabric_unsubscribe"
