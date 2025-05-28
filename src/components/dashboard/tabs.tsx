export const Tabs = ({ activeTab, onTabChange, tabs }) => {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </div>
      ))}
    </div>
  )
}
