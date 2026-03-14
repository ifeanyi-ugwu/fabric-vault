import { PeerProvider } from "~contexts/peer"

import { ConnectionProvider } from "./contexts/connection"
import { IdentityProvider } from "./contexts/identity"
import { RequestProvider } from "./contexts/request"
import { ThemeProvider } from "./contexts/theme"
import { VaultProvider } from "./contexts/vault"

export const Layout = ({ children }) => {
  return (
    <div className="container">
      <ThemeProvider>
        <VaultProvider>
          <IdentityProvider>
            <PeerProvider>
              <ConnectionProvider>
                <RequestProvider>{children}</RequestProvider>
              </ConnectionProvider>
            </PeerProvider>
          </IdentityProvider>
        </VaultProvider>
      </ThemeProvider>
    </div>
  )
}
