// Storage Manager for Tab Trail
// Handles all chrome.storage.local operations

class StorageManager {
  constructor() {
    this.cache = new Map();
    this.STORAGE_KEYS = {
      TABS: 'tabs',
      ACTIVE_TABS: 'activeTabs',
      SETTINGS: 'settings'
    };
  }

  // Initialize storage with defaults
  async initialize() {
    const data = await chrome.storage.local.get(null);
    
    // Set defaults if empty
    if (!data.settings) {
      await this.saveSettings({
        trackingEnabled: true,
        maxStorageDays: 7,
        maxTabsStored: 1000
      });
    }
    
    console.log('Storage initialized:', data);
    return data;
  }

  // Save a tab node
  async saveTab(tabId, tabData) {
    const tabs = await this.getTabs();
    const tabIdStr = String(tabId);
    
    tabs[tabIdStr] = {
      ...tabData,
      id: tabIdStr, // Ensure ID is stored as string
      lastUpdated: Date.now()
    };
    
    console.log('Storage: Saving tab', tabIdStr, 'with parentId:', tabData.parentId);
    
    await chrome.storage.local.set({ 
      [this.STORAGE_KEYS.TABS]: tabs 
    });
    
    return tabs[tabIdStr];
  }

  // Get all tabs
  async getTabs() {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.TABS);
    return result[this.STORAGE_KEYS.TABS] || {};
  }

  // Get a specific tab
  async getTab(tabId) {
    const tabs = await this.getTabs();
    return tabs[tabId];
  }

  // Update tab relationships
  async updateTabRelationship(childId, parentId) {
    const tabs = await this.getTabs();
    
    const childIdStr = String(childId);
    const parentIdStr = String(parentId);
    
    console.log('Storage: Updating relationship', childIdStr, '→', parentIdStr);
    
    // Update child
    if (tabs[childIdStr]) {
      tabs[childIdStr].parentId = parentIdStr;
      console.log('Storage: Updated child parentId to', parentIdStr);
    } else {
      console.log('Storage: Child tab not found:', childIdStr);
    }
    
    // Update parent's children array
    if (tabs[parentIdStr]) {
      if (!tabs[parentIdStr].children) {
        tabs[parentIdStr].children = [];
      }
      if (!tabs[parentIdStr].children.includes(childIdStr)) {
        tabs[parentIdStr].children.push(childIdStr);
      }
      console.log('Storage: Updated parent children:', tabs[parentIdStr].children);
    } else {
      console.log('Storage: Parent tab not found:', parentIdStr);
    }
    
    await chrome.storage.local.set({ 
      [this.STORAGE_KEYS.TABS]: tabs 
    });
    
    console.log('Storage: Relationship saved successfully');
  }

  // Get tab trail (complete history for this tab)
  async getTabTrail(tabId) {
    const trail = [];
    const tabs = await this.getTabs();
    const currentTab = tabs[tabId];
    
    if (!currentTab) return trail;
    
    // Build COMPLETE chain: walk up parent hierarchy and include all history
    const buildParentChain = (tab, visitedIds = new Set()) => {
      const chain = [];
      
      // Prevent infinite loops
      if (visitedIds.has(tab.id)) {
        return chain;
      }
      visitedIds.add(tab.id);
      
      // If this tab has a parent, get the parent's chain first
      if (tab.parentId && tabs[tab.parentId]) {
        const parentChain = buildParentChain(tabs[tab.parentId], visitedIds);
        chain.push(...parentChain);
      }
      
      // Add this tab's contribution to the chain
      chain.push({
        tabId: tab.id,
        tab: tab,
        isParent: tab.id !== currentTab.id // Mark as parent if not the current tab
      });
      
      return chain;
    };
    
    const fullChain = buildParentChain(currentTab);
    
    // Now build the trail from the complete chain
    fullChain.forEach((chainItem, chainIndex) => {
      const tab = chainItem.tab;
      const isCurrentTab = tab.id === currentTab.id;
      const isParentTab = chainItem.isParent;
      
      // Add this tab's history (if any)
      if (tab.history && tab.history.length > 0) {
        const uniqueHistory = [];
        const seenUrls = new Set();
        
        // Deduplicate by URL and ensure meaningful time differences
        tab.history.forEach(entry => {
          const urlKey = entry.url || '';
          const timeKey = Math.floor((entry.timestamp || 0) / 1000); // Group by second
          const uniqueKey = `${urlKey}-${timeKey}`;
          
          if (!seenUrls.has(uniqueKey) && entry.url && entry.url !== 'chrome://newtab/') {
            seenUrls.add(uniqueKey);
            uniqueHistory.push({
              ...entry,
              id: `${tab.id}-history-${entry.timestamp}`,
              isHistory: true,
              isParentHistory: isParentTab,
              tabId: null, // No tab ID for history items - will open in new tab
              timestamp: entry.timestamp,
              chainPosition: chainIndex
            });
          }
        });
        
        // Sort by timestamp to ensure correct order
        uniqueHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        trail.push(...uniqueHistory);
      }
      
      // Add the tab's final/current page
      const lastHistoryUrl = tab.history && tab.history.length > 0 ? 
        tab.history[tab.history.length - 1].url : null;
      
      if (!lastHistoryUrl || lastHistoryUrl !== tab.url) {
        trail.push({
          ...tab,
          isCurrent: isCurrentTab,
          isParent: isParentTab,
          tabId: String(tab.id), // Ensure ID is string for navigation
          timestamp: tab.lastUpdated || tab.created || Date.now(),
          chainPosition: chainIndex
        });
      }
    });
    
    // Sort entire trail by timestamp to show chronological order
    trail.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    return trail;
  }

  // Clean old data
  async cleanOldData(daysToKeep = 7) {
    const tabs = await this.getTabs();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const tabsToKeep = {};
    const relationshipTabs = new Set(); // Track tabs that are part of relationships
    
    // First pass: Identify all tabs that are part of relationships
    for (const [id, tab] of Object.entries(tabs)) {
      if (tab.parentId) {
        relationshipTabs.add(tab.parentId); // Keep parent
        relationshipTabs.add(id); // Keep child
      }
      if (tab.children && tab.children.length > 0) {
        relationshipTabs.add(id); // Keep parent
        tab.children.forEach(childId => relationshipTabs.add(childId)); // Keep children
      }
    }
    
    // Second pass: Keep tabs that are recent OR part of relationships
    for (const [id, tab] of Object.entries(tabs)) {
      const isRecent = tab.lastUpdated > cutoffTime;
      const isInRelationship = relationshipTabs.has(id);
      
      if (isRecent || isInRelationship) {
        tabsToKeep[id] = tab;
      }
    }
    
    await chrome.storage.local.set({ 
      [this.STORAGE_KEYS.TABS]: tabsToKeep 
    });
    
    const removedCount = Object.keys(tabs).length - Object.keys(tabsToKeep).length;
    const preservedForRelationships = Object.keys(tabsToKeep).filter(id => 
      relationshipTabs.has(id) && tabs[id].lastUpdated <= cutoffTime
    ).length;
    
    console.log(`Cleaned ${removedCount} old tabs, preserved ${preservedForRelationships} for relationships`);
  }

  // Get settings
  async getSettings() {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.SETTINGS);
    return result[this.STORAGE_KEYS.SETTINGS] || {};
  }

  // Save settings
  async saveSettings(settings) {
    await chrome.storage.local.set({ 
      [this.STORAGE_KEYS.SETTINGS]: settings 
    });
  }

  // Clear all data
  async clearAll() {
    await chrome.storage.local.clear();
    console.log('All Tab Trail data cleared');
  }
}

// Export for use in service worker
const storage = new StorageManager();
export default storage;