import React from 'react';

const ResourceTabs = ({ tabs, activeTab, hasMissingByTab, onTabChange }) => {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={tab.key === activeTab ? 'tab active' : 'tab'}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
          {hasMissingByTab[tab.key] && <span className="tab-dot" />}
        </button>
      ))}
    </div>
  );
};

export default ResourceTabs;
