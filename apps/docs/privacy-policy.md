# Privacy Policy for FabricVault

**Last Updated:** May 28, 2025

FabricVault is a secure browser extension wallet for Hyperledger Fabric. This Privacy Policy describes how FabricVault ("we," "our," or "us") handles user data. Our primary goal is to provide a secure and private experience for managing your Fabric identities and interactions.

## 1. Data We Do Not Collect or Transmit

FabricVault is designed with a strong commitment to user privacy. We want to be absolutely clear:

- We do not collect, store, transmit, or sell any **personally identifiable information (PII)** to our servers or any third parties.
- We do not collect your browse history, clicks, keystrokes, or any general user activity data outside of the direct interactions with the FabricVault extension itself.
- Your **private keys** and other sensitive authentication information are encrypted and stored exclusively on your **local device**. They never leave your browser and are never transmitted to our servers or any third parties.
- We do not use or transfer user data for purposes unrelated to the extension's single purpose.
- We do not use or transfer user data to determine creditworthiness or for lending purposes.

## 2. Data Handling (Local Only)

FabricVault interacts with and processes certain types of data **locally within your browser** to fulfill its core functionality:

- **Authentication Information:** FabricVault stores your Hyperledger Fabric identities, including private keys and certificates, encrypted within your browser's local storage. This data is essential for signing transactions and authenticating with Fabric networks. This information remains solely on your device.
- **Transaction Data:** When you initiate a transaction via a dApp and confirm it using FabricVault, the extension processes the transaction payload locally to enable you to review and sign it. This transaction data is not transmitted to us.
- **User Activity (within the extension):** Interactions you perform directly within the FabricVault extension (e.g., clicking to approve a transaction, navigating settings) are processed locally to facilitate the wallet's operations. This activity is not monitored or collected by us.
- **Website Content Interaction:** FabricVault, through its host permissions, may interact with the content of web pages (e.g., to read transaction requests from dApps). This interaction is purely for the purpose of enabling the wallet's functionality and does not involve collecting or transmitting the full content of web pages to our servers.
- **Extension Settings:** Your personalized settings for the FabricVault extension are saved locally in your browser's storage.

All data processed and stored by FabricVault remains on your local device and is under your control. We do not have access to it.

## 3. Permissions Used and Justification

FabricVault requests the following permissions, strictly for its intended purpose:

- **`storage`**: Essential for securely storing your Fabric identities (e.g., private keys, certificates), transaction history, and application-specific settings locally within your browser. This ensures your data is persistent and readily available for managing your wallet.
- **`activeTab`**: Utilized to allow the extension to temporarily access and interact with the currently active tab when you explicitly invoke the extension (e.g., by clicking its icon). This enables contextual actions — such as checking if the active tab's URL is connected to any identity in the vault — and user-initiated interactions like connecting a wallet or signing a transaction on a dApp. This permission ensures FabricVault's functionality is directly tied to user intent on the current tab.
- **Host Permissions (`https://*/*`, `http://*/*`, `ws://*/*`, `wss://*/*`)**: Essential for FabricVault to function as a universal, configurable wallet for Hyperledger Fabric. These permissions allow FabricVault to interact directly with various RPC gateways and Fabric network services. Users configure their wallet to connect to diverse Fabric networks, each potentially exposed via different gateway URLs (e.g., `https://myfabricgateway.com`, `ws://anothernode.org`, `http://localfabric:8080`). Without these permissions, FabricVault cannot connect to user-defined endpoints — which is critical for fetching real-time ledger state, broadcasting signed transactions, and performing other essential network-level operations.

## 4. Third-Party Services

FabricVault does not directly integrate with or transmit data to any third-party analytics services or advertising networks.

## 5. Changes to This Privacy Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.

## 6. Contact Us

If you have any questions or concerns about this Privacy Policy, please contact us at:

Email: [valentineifeanyiugwu@outlook.com](mailto:valentineifeanyiugwu@outlook.com)
