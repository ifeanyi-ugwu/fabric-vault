import { PeerProvider } from "~contexts/peer"

import { ConnectionProvider } from "./contexts/connection"
import { IdentityProvider } from "./contexts/identity"
import { RequestProvider } from "./contexts/request"
import { VaultProvider } from "./contexts/vault"

export const Layout = ({ children }) => {
  return (
    <div className="container">
      <main className="content">
        <VaultProvider>
          <IdentityProvider>
            <PeerProvider>
              <ConnectionProvider>
                <RequestProvider>{children}</RequestProvider>
              </ConnectionProvider>{" "}
            </PeerProvider>
          </IdentityProvider>
        </VaultProvider>
      </main>
    </div>
  )
}
