import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { ChannelIcon } from "~/components/svg/channel"
import { IdentityIcon } from "~/components/svg/identity"
import { MenuIcon } from "~/components/svg/menu"
import { Button } from "~/components/ui/button"
import { Dropdown } from "~/components/ui/drop-down"

import "./header-bar.css"

import { useIdentity, type Identity } from "~/contexts/identity"
import { useIdentityToSiteConnection } from "~/hooks/use-identity-to-site-connection"
import { usePeer } from "~contexts/peer"

export function HeaderBar() {
  const { selectedPeer, switchPeer, peers } = usePeer()
  const { identities, selectedIdentity, switchIdentity } = useIdentity()

  const { currentHostname, isIdentityConnectedToSite, toggleConnection } =
    useIdentityToSiteConnection()

  const [showConnectionStatus, setShowConnectionStatus] = useState(false)

  const handleIdentitySelect = (identity: Identity) => {
    switchIdentity(identity)

    if (!isIdentityConnectedToSite(identity)) {
      setShowConnectionStatus(true)
    }
  }

  return (
    <div className="header-bar">
      <span className="hb-brand">FabricVault</span>

      <div className="hb-controls">
        {/* Peer selector */}
        <Dropdown>
          <Dropdown.Trigger asChild>
            <div className="hb-pill">
              <ChannelIcon />
              <span className="hb-pill-label">
                {selectedPeer ? selectedPeer.name : "Peer"}
              </span>
            </div>
          </Dropdown.Trigger>
          <Dropdown.Content align="end">
            {peers.length > 0 ? (
              peers.map((peer) => (
                <Dropdown.Item
                  key={peer.id}
                  onSelect={() => switchPeer(peer)}>
                  <div className="dropdown-item-content">
                    <span>{peer.name}</span>
                    {selectedPeer?.id === peer.id && (
                      <span className="hb-check">✓</span>
                    )}
                  </div>
                </Dropdown.Item>
              ))
            ) : (
              <Dropdown.Item disabled>No peers available</Dropdown.Item>
            )}
          </Dropdown.Content>
        </Dropdown>

        {/* Identity selector */}
        <div className="hb-identity-wrap">
          <Dropdown>
            <Dropdown.Trigger asChild>
              <div className="hb-pill">
                <div className="hb-identity-icon">
                  <IdentityIcon />
                  {selectedIdentity && (
                    <div
                      className={`hb-dot ${isIdentityConnectedToSite(selectedIdentity) ? "connected" : "disconnected"}`}
                    />
                  )}
                </div>
                <span className="hb-pill-label">
                  {selectedIdentity ? selectedIdentity.label : "Identity"}
                </span>
              </div>
            </Dropdown.Trigger>
            <Dropdown.Content align="end">
              {selectedIdentity && (
                <div className="hb-status-section">
                  <div className="hb-status-label">STATUS</div>
                  <div className="hb-status-text">
                    {selectedIdentity.label}{" "}
                    {isIdentityConnectedToSite(selectedIdentity)
                      ? "is connected to"
                      : "isn't connected to"}{" "}
                    {currentHostname}
                  </div>
                  <button
                    className={`hb-connection-btn ${isIdentityConnectedToSite(selectedIdentity) ? "disconnect" : "connect"}`}
                    onClick={() => toggleConnection(selectedIdentity)}>
                    {isIdentityConnectedToSite(selectedIdentity)
                      ? "Disconnect"
                      : "Connect"}
                  </button>
                </div>
              )}

              <div className="hb-identity-list">
                {identities.length > 0 ? (
                  identities.map((identity) => {
                    const isConnected = isIdentityConnectedToSite(identity)
                    const isSelected =
                      selectedIdentity?.label === identity.label

                    return (
                      <Dropdown.Item
                        key={identity.label}
                        onSelect={() => handleIdentitySelect(identity)}>
                        <div className="dropdown-item-content hb-identity-item">
                          <div
                            className={`hb-item-dot ${isConnected ? "connected" : "disconnected"} ${isSelected ? "selected" : ""}`}
                          />
                          <span>{identity.label}</span>
                        </div>
                      </Dropdown.Item>
                    )
                  })
                ) : (
                  <Dropdown.Item disabled>
                    {selectedPeer
                      ? "No identities available"
                      : "Select a peer first"}
                  </Dropdown.Item>
                )}
              </div>
            </Dropdown.Content>
          </Dropdown>

          {showConnectionStatus &&
            selectedIdentity &&
            !isIdentityConnectedToSite(selectedIdentity) && (
              <div className="hb-notification">
                <div className="hb-notif-header">
                  <div className="hb-notif-title">{selectedIdentity.label}</div>
                  <button
                    className="hb-notif-close"
                    onClick={() => setShowConnectionStatus(false)}>
                    ×
                  </button>
                </div>
                <div className="hb-notif-msg">
                  isn't connected to {currentHostname}
                </div>
                <div className="hb-notif-actions">
                  <button
                    className="hb-notif-cancel"
                    onClick={() => setShowConnectionStatus(false)}>
                    Cancel
                  </button>
                  <button
                    className="hb-notif-connect"
                    onClick={() => {
                      toggleConnection(selectedIdentity)
                      setShowConnectionStatus(false)
                    }}>
                    Connect
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* Menu */}
        <Dropdown>
          <Dropdown.Trigger asChild>
            <Button variant="ghost" className="hb-menu-btn">
              <MenuIcon />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Content align="end">
            <Link to="/dashboard" className="menu-link">
              Dashboard
            </Link>
            <Link to="/lock" className="menu-link">
              Lock Wallet
            </Link>
          </Dropdown.Content>
        </Dropdown>
      </div>
    </div>
  )
}
