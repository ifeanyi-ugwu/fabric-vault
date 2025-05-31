# FabricVault

## FabricVault Extension

This README provides essential information for users to understand and utilize the FabricVault extension, a browser extension designed to simplify interactions with Hyperledger Fabric networks.

### What is FabricVault?

FabricVault acts as an intermediary, enabling your web applications to securely interact with Hyperledger Fabric networks directly from the browser. It handles key management, transaction signing, and communication with the Fabric network, abstracting away much of the underlying complexity.

### Key Features

- **Secure Identity Management:** Store and manage your Fabric identities (certificates and private keys) securely within the extension's vault, encrypted with your password.
- **Multiple Peer Support:** Configure and manage connections to multiple Hyperledger Fabric peer nodes, including TLS certificate configuration and associated RPC gateway URLs.
- **Transaction Execution:** Easily evaluate and submit transactions to your Hyperledger Fabric smart contracts using selected identities and peers.
- **Event Subscription:** Subscribe to block and chaincode events for real-time updates from your Fabric network.
- **Simplified API:** Provides a straightforward JavaScript API (`window.fabric`) for dApps and web pages to interact with Fabric.

### Getting Started

1. **Install FabricVault:** Install the FabricVault extension from the Chrome Web Store (or your browser's equivalent).
2. **Configure Network Settings (within FabricVault Extension Dashboard):**

   - Open the FabricVault extension by clicking its icon in your browser toolbar. This will typically open the **dashboard**.
   - The dashboard features tabs, including **"Identities"** (active by default) and **"Peers"**.

   - **Add Identities:**

     - Navigate to the **"Identities"** tab (or ensure you are on it).
     - Click the **"Add Identity"** button.
     - For each identity, you'll need to provide:
       - **Unique Label:** A memorable name for this identity (e.g., `Org1Admin`, `UserA`).
       - **MSP ID:** The correct Membership Service Provider ID (e.g., `Org1MSP`, `Org2MSP`). This must accurately match the MSP ID configured in your Fabric network.
       - **Import Certificate:** Use the "Import Certificate" button to **upload** or **paste** the entire contents of the public certificate for this identity (e.g., `User1@org1.example.com-cert.pem`).
         - _Tip for Fabric Samples users:_ Your user certificates are typically found at:
           `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem`
       - **Paste Private Key:** Directly **paste** the entire contents of the private key associated with the certificate into the designated field. This private key will be **encrypted with your FabricVault password** for secure storage.
         - _Tip for Fabric Samples users:_ Your private keys are typically found at:
           `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore/<YOUR_PRIVATE_KEY_FILE>` (the filename usually ends with `_sk`).

   - **Add Peers:**

     - Navigate to the **"Peers"** tab.
     - Click the **"Add Peer"** button.
     - For each peer, you'll typically need to provide:

       - **Peer Name:** A unique identifier for this peer (e.g., `peer0.org1.example.com`).
       - **Peer Endpoint:** The gRPC address of the peer (e.g., `localhost:7051`, `fabric-peer.example.com:7051`).
       - **RPC URL:** This is the WebSocket endpoint for the JSON-RPC gateway that FabricVault will use to communicate with _this specific peer_.

         - **Option 1 :** Use the publicly hosted gateway:
           `ws://hyperledger-fabric-json-rpc-gateway.onrender.com`
           - _Note: This gateway is hosted on a Render free plan and is subject to its limitations (e.g., potential cold starts, rate limits). For production use or higher reliability, consider hosting your own gateway or sponsoring its uptime._
         - **Option 2 (Self-Hosting: Recommended for testing if the peer network is running locally) :** If you prefer to host your own JSON-RPC gateway, you can use the [`hyperledger-fabric-json-rpc-gateway`](https://www.npmjs.com/package/hyperledger-fabric-json-rpc-gateway) npm package.

           1. Install the package globally or in your project:
              `npm install -g hyperledger-fabric-json-rpc-gateway`
              or
              `pnpm install -g hyperledger-fabric-json-rpc-gateway`
           2. Run the gateway:
              `hfgateway` or `hyperledger-fabric-json-rpc-gateway`
           3. The gateway will typically run on port `7545`. You will see output similar to this:

              ```bash
              ✅ Server running on port 7545
              🔌 WebSocket server is ready — connect via ws://<host>:7545
              🛠️ API endpoints available:
                 - Health check: /health
              ```

              In this case, your **RPC URL** for this peer would be `ws://localhost:7545`.

       - **TLS CA Certificate (Optional but Recommended):** If your peer supports TLS (which is highly likely and recommended for production environments), you must **import** the peer's TLS CA certificate here. Use the "Import TLS CA Certificate" button to **upload** or **paste** the certificate content.
         - _Tip for Fabric Samples users:_ The TLS CA certificate for `peer0.org1.example.com` is typically found at:
           `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt`

     - **Local Fabric Samples Example Peer Configuration:**
       - **Peer Name:** `peer0.org1.example.com`
       - **Peer Endpoint:** `localhost:7051`
       - **RPC URL:** `ws://localhost:7545` (if self-hosting the gateway) or `ws://hyperledger-fabric-json-rpc-gateway.onrender.com`
       - **TLS CA Certificate:** Import the `ca.crt` file as described above.

3. **Select Active Peer and Identity:**

   - Within the FabricVault extension's dashboard, you will find options to **select an active peer** and **select an active identity** from your configured lists.
   - The **active peer** is the peer endpoint that FabricVault will use for all transaction and event requests unless explicitly overridden by a dApp.
   - The **active identity** acts as a fallback: if a dApp makes an API request (`fabric_evaluateTransaction`, `fabric_submitTransaction`, `fabric_subscribe`) _without_ specifying an `identity` in its parameters, FabricVault will automatically use this currently active identity for signing and authorization.

4. **Ensure Fabric Network is Running:** Your Hyperledger Fabric network (e.g., Fabric Samples test network via Docker) must be up and running for the extension to connect and for transactions to succeed.

### How to Use (for DApp Developers)

Once configured, your web applications can interact with FabricVault via the `window.fabric` object. This object exposes methods for requesting identities, evaluating transactions, submitting transactions, and subscribing to events.

**Understanding Identity Usage in DApps:**

- DApps can call `window.fabric.request({ method: "fabric_requestIdentities" })` to prompt the user to authorize access to their stored identities. This is a secure way for a dApp to get permission to use a user's identities. The response will contain an array of objects, each representing a public identity.

- When a dApp then makes a transaction request (e.g., `fabric_evaluateTransaction`, `fabric_submitTransaction`, `fabric_subscribe`), it can _optionally_ include an `identity` parameter in its request's `params`. If an `identity` object is provided by the dApp, FabricVault will use that specific identity for the request, overriding the currently active identity set in the extension.

  **Structure of the `identity` object for API requests:**
  The `identity` object you provide in dApp API calls should have the following structure:

  ```javascript
  {
    certificate: '-----BEGIN CERTIFICATE-----\nMIICVjCC...END CERTIFICATE-----\n', // Required: The full PEM-encoded public certificate string
    mspId: 'Org1MSP', // Required: The MSP ID associated with this identity
    label: 'User1' // Optional: A user-friendly label for the identity
  }
  ```

  **Recommendation:** While the `label` is optional, providing at least the `certificate` and `mspId` is strongly recommended for cryptographic uniqueness and correct routing within FabricVault. The `certificate` content itself acts as the cryptographically unique identifier for the identity. If you only provide a `label`, FabricVault will attempt to find a matching identity based on that label and populate the `certificate` and `mspId`. However, relying on the `certificate` and `mspId` directly ensures explicit and unique identity selection.

- If a dApp does _not_ provide an `identity` parameter in its request, FabricVault will automatically use the **active identity** that the user has selected within the extension's dashboard. This provides flexibility for dApps to either specify an identity or rely on the user's default.

### Support and Contribution

For issues, questions, or contributions, please refer to the project's GitHub repository or contact the developer.
