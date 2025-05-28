/**
 * fabric_requestIdentities: Request the list of available identities (e.g., user certificates)
 * These are the certificates or identities available to the user on the Fabric network.
 *
 * fabric_identities: Fetch the identities the client has access to
 * This returns the identities the provider has given the client has access to.
 *
 * fabric_peer: Get the currently connected Fabric peer
 * This will return the endpoint for the currently connected Fabric peer.
 *
 * fabric_evaluateTransaction: Submit an evaluation transaction (read-only, no state change)
 * This method allows you to simulate a transaction without modifying the ledger state.
 *
 * fabric_submitTransaction: Submit a state-changing transaction to the Fabric network.
 * It submits a transaction to the ledger and return its result only after it is committed to the ledger.
 * The transaction function will be evaluated on endorsing peers and then submitted to the ordering service to be committed to the ledger.
 *
 * fabric_submitAsync: Submit a state-changing transaction asynchronously (without waiting for the result).
 * It submits a transaction to the ledger and return immediately after successfully sending to the orderer.
 * The transaction function will be evaluated on endorsing peers and then submitted to the ordering service to be committed to the ledger.
 * The submitted transaction that is returned can be used to obtain to the transaction result, and to wait for it to be committed to the ledger.
 *
 * fabric_subscribe: Subscribe to events on the Fabric network.
 * This method allows you to register for real-time notifications about specific events happening within the Fabric network, such as block commits or chaincode events. You typically specify the event source (e.g., a specific channel or chaincode) and the type of event you are interested in. Upon successful subscription, the server will push event notifications to the client.
 *
 * fabric_unsubscribe: Unsubscribe from previously subscribed events.
 * This method allows you to cancel an active subscription that was initiated using 'fabric_subscribe'. You will typically need to provide the unique subscription ID that was returned when the subscription was initially created. After a successful unsubscription, you will no longer receive event notifications for that subscription.
 */
type FabricMethods =
  | "fabric_requestIdentities"
  | "fabric_identities"
  | "fabric_peer"
  | "fabric_evaluateTransaction"
  | "fabric_submitTransaction"
  | "fabric_submitAsync"
  | "fabric_subscribe"
  | "fabric_unsubscribe"
