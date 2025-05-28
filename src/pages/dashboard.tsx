import { useState } from "react"

import { HeaderBar } from "~components/dashboard/header-bar/header-bar"

import { Tabs } from "../components/dashboard/tabs"
import { Identities } from "../components/dashboard/tabs/identities"
import { Peers } from "../components/dashboard/tabs/peers"
import { Settings } from "../components/dashboard/tabs/settings"

function Dashboard() {
  const [activeTab, setActiveTab] = useState("identities")

  const tabs = [
    { id: "identities", label: "Identities" },
    { id: "peers", label: "Peers" },
    { id: "settings", label: "Settings" }
  ]

  return (
    <div className="view">
      <HeaderBar />

      <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />

      {activeTab === "identities" && <Identities />}

      {activeTab === "peers" && <Peers />}

      {activeTab === "settings" && <Settings />}
    </div>
  )
}

export default Dashboard
