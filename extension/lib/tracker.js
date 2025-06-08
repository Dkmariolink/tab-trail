// Tab Tracker for Tab Trail
// Detects and tracks parent-child relationships between tabs

import storage from './storage.js';

class TabTracker {
  constructor() {
    this.pendingNavigations = new Map();
    this.recentTabs = new Map();
    this.PENDING_TIMEOUT = 3000; // 3 seconds to match navigation to tab
  }

  // Handle new tab creation
  async handleTabCreated(tab) {
    console.log('TabTracker: Tab created', tab.id, 'openerTabId:', tab.openerTabId, 'url:', tab.url);
    
    // Check if this tab already exists (to avoid duplicates during navigation)
    const existingTab = await storage.getTab(tab.id);
    if (existingTab && existingTab.parentId) {
      console.log('TabTracker: Tab already exists with parentId:', existingTab.parentId, '- preserving relationship');
      return existingTab;
    }
    
    const tabNode = {
      id: String(tab.id), // Ensure string format
      url: tab.url || 'chrome://newtab/',
      title: tab.title || 'New Tab',
      parentId: null,
      children: [],
      history: [], // Initialize empty history array
      created: Date.now(),
      lastUpdated: Date.now(),
      domain: this.getDomain(tab.url),
      source: { type: 'unknown' }
    };

    // Only set parent relationship if opener is a real web page
    if (tab.openerTabId && tab.openerTabId > 0) {
      // Check if the opener is a web page (not extension or chrome page)
      try {
        const openerTab = await chrome.tabs.get(tab.openerTabId);
        const isWebPage = openerTab.url && 
                         !openerTab.url.includes('chrome-extension://') && 
                         !openerTab.url.includes('chrome://') &&
                         openerTab.url !== 'chrome://newtab/';
        
        if (isWebPage) {
          tabNode.parentId = String(tab.openerTabId);
          tabNode.source = { type: 'link', method: 'openerTabId' };
          console.log('TabTracker: Found web page parent via openerTabId', tab.openerTabId, '(', openerTab.url, ')');
          
          // Ensure parent tab is tracked - create if missing
          const parentExists = await storage.getTab(tab.openerTabId);
          if (!parentExists) {
            console.log('TabTracker: Creating missing parent tab entry for', tab.openerTabId);
            const parentTabNode = {
              id: String(tab.openerTabId),
              url: openerTab.url,
              title: openerTab.title || 'Parent Tab',
              parentId: null, // We don't know the parent's parent right now
              children: [],
              history: [],
              created: Date.now() - 1000, // Slightly before child
              lastUpdated: Date.now(),
              domain: this.getDomain(openerTab.url),
              source: { type: 'backfill', method: 'missing_parent' }
            };
            await storage.saveTab(tab.openerTabId, parentTabNode);
            console.log('TabTracker: Backfilled missing parent tab:', openerTab.title);
          }
        } else {
          console.log('TabTracker: Ignoring non-web opener:', openerTab.url);
        }
      } catch (error) {
        console.log('TabTracker: Could not get opener tab info:', error.message);
      }
    }
    
    // Method 2: Check if we have a pending navigation for this tab
    if (!tabNode.parentId) {
      const pendingNav = this.findPendingNavigation(tab.url);
      if (pendingNav) {
        tabNode.parentId = String(pendingNav.sourceTabId);
        tabNode.source = { 
          type: 'link',
          method: 'webNavigation',
          parentUrl: pendingNav.sourceUrl 
        };
        console.log('TabTracker: Found parent via navigation', pendingNav);
      }
    }

    // Save the tab
    await storage.saveTab(tab.id, tabNode);
    
    // Update parent's children if we found a parent
    if (tabNode.parentId) {
      await storage.updateTabRelationship(tab.id, tabNode.parentId);
      console.log('TabTracker: Updated relationship', tab.id, '→', tabNode.parentId);
    } else {
      console.log('TabTracker: No valid parent found for tab', tab.id, '- will be root tab');
    }

    // Track this as a recent tab
    this.recentTabs.set(tab.id, Date.now());
    
    return tabNode;
  }
  // Handle tab updates (navigation)
  async handleTabUpdated(tabId, changeInfo, tab) {
    if (!changeInfo.url) return;
    
    console.log('TabTracker: Tab navigated', tabId, changeInfo.url);
    
    const existingTab = await storage.getTab(tabId);
    if (existingTab) {
      // Add current URL to history before updating
      if (!existingTab.history) {
        existingTab.history = [];
      }
      
      // Only add to history if URL actually changed AND it's not the first navigation
      if (existingTab.url !== changeInfo.url && existingTab.url !== 'chrome://newtab/' && existingTab.url !== '') {
        // Get settings to check max pages
        const settings = await storage.getSettings();
        const maxPages = settings.maxPagesPerTab || 50;
        
        existingTab.history.push({
          url: existingTab.url,
          title: existingTab.title,
          timestamp: existingTab.lastUpdated || Date.now()
        });
        
        // Trim history if it exceeds max pages
        if (existingTab.history.length > maxPages) {
          existingTab.history = existingTab.history.slice(-maxPages);
        }
        
        console.log('TabTracker: Added to history:', existingTab.url);
      }
      
      // Update current state BUT PRESERVE PARENT RELATIONSHIP
      existingTab.url = changeInfo.url;
      existingTab.title = tab.title || changeInfo.url;
      existingTab.domain = this.getDomain(changeInfo.url);
      existingTab.lastUpdated = Date.now();
      
      // PRESERVE existing parent relationship - do NOT override based on navigation patterns
      console.log('TabTracker: Preserving existing parentId:', existingTab.parentId);
      await storage.saveTab(tabId, existingTab);
    } else {
      // Tab exists but we don't have it tracked - create it now
      console.log('TabTracker: Creating missing tab entry during navigation');
      await this.handleTabCreated(tab);
    }
  }

  // Handle navigation events (most reliable for parent-child)
  async handleNavigation(details) {
    console.log('TabTracker: Navigation event', details);
    console.log('TabTracker: sourceTabId:', details.sourceTabId, 'targetTabId:', details.tabId);
    
    // This fires when a link creates a new tab
    if (details.sourceTabId >= 0 && details.tabId !== details.sourceTabId) {
      
      // Check if this is a web-to-web navigation (not from extension pages)
      try {
        const sourceTab = await chrome.tabs.get(details.sourceTabId);
        const isValidSource = sourceTab.url && 
                             !sourceTab.url.includes('chrome-extension://') && 
                             !sourceTab.url.includes('chrome://');
        
        if (isValidSource) {
          // Store this pending navigation
          this.pendingNavigations.set(details.url, {
            sourceTabId: details.sourceTabId,
            targetTabId: details.tabId,
            url: details.url,
            sourceUrl: sourceTab.url || 'unknown',
            timestamp: Date.now()
          });
          
          console.log('TabTracker: Stored valid web navigation', details.url, 'from', details.sourceTabId, 'to', details.tabId);
          console.log('TabTracker: Source URL:', sourceTab.url);
          
          // Clean up after timeout
          setTimeout(() => {
            this.pendingNavigations.delete(details.url);
          }, this.PENDING_TIMEOUT);
          
          // Try to update relationship immediately if target tab exists
          const childTab = await storage.getTab(details.tabId);
          if (childTab) {
            console.log('TabTracker: Updating existing tab relationship via navigation');
            childTab.parentId = String(details.sourceTabId);
            await storage.saveTab(details.tabId, childTab);
            await storage.updateTabRelationship(details.tabId, details.sourceTabId);
          }
        } else {
          console.log('TabTracker: Ignoring navigation from non-web source:', sourceTab.url);
        }
      } catch (error) {
        console.log('TabTracker: Could not validate navigation source:', error.message);
      }
    }
  }

  // Handle tab removal
  async handleTabRemoved(tabId) {
    console.log('TabTracker: Tab removed', tabId);
    this.recentTabs.delete(tabId);
    
    // Mark tab as closed but keep in storage for relationship visualization
    const tabData = await storage.getTab(tabId);
    if (tabData) {
      tabData.status = 'closed';
      tabData.closedAt = Date.now();
      await storage.saveTab(tabId, tabData);
      console.log('TabTracker: Marked tab as closed but preserved for relationships:', tabId);
    }
  }

  // Find pending navigation for a URL
  findPendingNavigation(url) {
    if (!url) return null;
    
    for (const [navUrl, nav] of this.pendingNavigations) {
      if (navUrl === url || this.urlsMatch(navUrl, url)) {
        this.pendingNavigations.delete(navUrl);
        return nav;
      }
    }
    return null;
  }

  // Check if URLs match (handling redirects, www, etc)
  urlsMatch(url1, url2) {
    if (!url1 || !url2) return false;
    
    // Normalize URLs
    const normalize = (url) => {
      try {
        const u = new URL(url);
        return u.hostname + u.pathname + u.search;
      } catch {
        return url;
      }
    };
    
    return normalize(url1) === normalize(url2);
  }

  // Get domain from URL
  getDomain(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      return u.hostname;
    } catch {
      return '';
    }
  }

  // Get the most recently active tab
  getMostRecentTab() {
    let mostRecent = null;
    let mostRecentTime = 0;
    
    for (const [tabId, time] of this.recentTabs) {
      if (time > mostRecentTime) {
        mostRecentTime = time;
        mostRecent = tabId;
      }
    }
    
    return mostRecent;
  }
}

// Export singleton instance
const tracker = new TabTracker();
export default tracker;