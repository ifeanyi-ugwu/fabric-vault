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
      <div className="header-bar-inner">
        <div className="header-channel-section">
          <Dropdown>
            <Dropdown.Trigger asChild>
              <div className="header-dropdown-trigger channel-trigger">
                <ChannelIcon />
                <span className="header-label">
                  {selectedPeer ? selectedPeer.name : "Select Peer"}
                </span>
              </div>
            </Dropdown.Trigger>
            <Dropdown.Content>
              {peers.length > 0 ? (
                peers.map((channel) => (
                  <Dropdown.Item
                    key={channel.id}
                    onSelect={() => switchPeer(channel)}>
                    <div className="dropdown-item-content">
                      <span>{channel.name}</span>
                      {selectedPeer?.id === channel.id && (
                        <span className="check-mark">✓</span>
                      )}
                    </div>
                  </Dropdown.Item>
                ))
              ) : (
                <Dropdown.Item disabled>No peers available</Dropdown.Item>
              )}
            </Dropdown.Content>
          </Dropdown>
        </div>

        <div className="header-identity-section">
          <div className="identity-container">
            <Dropdown>
              <Dropdown.Trigger asChild>
                <div className="header-dropdown-trigger identity-trigger">
                  <div className="identity-icon-container">
                    <IdentityIcon />
                    {selectedIdentity && (
                      <div
                        className={`connection-indicator ${isIdentityConnectedToSite(selectedIdentity) ? "connected" : "disconnected"}`}
                      />
                    )}
                  </div>
                  <span className="header-label">
                    {selectedIdentity
                      ? selectedIdentity.label
                      : "Select Identity"}
                  </span>
                </div>
              </Dropdown.Trigger>
              <Dropdown.Content align="end">
                {/* Connection Status */}
                {selectedIdentity && (
                  <div className="connection-status-section">
                    <div className="status-label">STATUS</div>
                    <div className="status-text">
                      {selectedIdentity.label}{" "}
                      {isIdentityConnectedToSite(selectedIdentity)
                        ? "is connected to"
                        : "isn't connected to"}{" "}
                      {currentHostname}
                    </div>
                    <button
                      className={`connection-button ${isIdentityConnectedToSite(selectedIdentity) ? "disconnect" : "connect"}`}
                      onClick={() => toggleConnection(selectedIdentity)}>
                      {isIdentityConnectedToSite(selectedIdentity)
                        ? "Disconnect"
                        : "Connect"}
                    </button>
                  </div>
                )}

                {/* Identity List */}
                <div className="identity-list">
                  {identities.length > 0 ? (
                    identities.map((identity) => {
                      const isConnected = isIdentityConnectedToSite(identity)
                      const isSelected =
                        selectedIdentity?.label === identity.label

                      return (
                        <Dropdown.Item
                          key={identity.label}
                          onSelect={() => handleIdentitySelect(identity)}>
                          <div className="dropdown-item-content identity-item">
                            <div
                              className={`identity-connection-dot ${isConnected ? "connected" : "disconnected"} ${isSelected ? "selected" : ""}`}
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
                        : "Select a channel first"}
                    </Dropdown.Item>
                  )}
                </div>
              </Dropdown.Content>
            </Dropdown>

            {/* Connection status notification */}
            {showConnectionStatus &&
              selectedIdentity &&
              !isIdentityConnectedToSite(selectedIdentity) && (
                <div className="connection-notification">
                  <div className="notification-header">
                    <div className="notification-title">
                      {selectedIdentity.label}
                    </div>
                    <button
                      className="close-button"
                      onClick={() => setShowConnectionStatus(false)}>
                      ×
                    </button>
                  </div>
                  <div className="notification-message">
                    isn't connected to {currentHostname}
                  </div>
                  <div className="notification-actions">
                    <button
                      className="cancel-button"
                      onClick={() => setShowConnectionStatus(false)}>
                      Cancel
                    </button>
                    <button
                      className="connect-button"
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
        </div>
      </div>

      <div className="header-menu-section">
        <Dropdown>
          <Dropdown.Trigger asChild>
            <Button variant="ghost" className="menu-button">
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
