/**
 * vault_addPeer: Add a new peer to the vault.
 * This allows clients to trigger the adding of a new peer connection.
 *
 * vault_switchPeer: Switch to a different peer connection.
 * This enables the vault to change the current peer connection.
 */
type FabricWalletMethods = "vault_addPeer" | "vault_switchPeer"
