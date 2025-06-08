// Tab Trail - Service Worker
// Handles all tab tracking using the tracker module

console.log('🚀 Tab Trail Service Worker starting...');

import storage from './lib/storage.js';
import tracker from './lib/tracker.js';

console.log('📦 Modules imported successfully');

// Track the previously active tab (before explorer opens)
let previousActiveTab = null;

// Initialize on startup
console.log('🔧 Initializing storage...');
storage.initialize().then(() => {
  console.log('✅ Storage initialized');
}).catch(error => {
  console.error('❌ Storage initialization failed:', error);
});

// Track active tab changes to remember the last non-explorer tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('👆 Tab activated:', activeInfo.tabId);
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    console.log('📄 Active tab details:', tab.title, tab.url);
    
    // Only store as previous if it's a real web page (not extension or chrome pages)
    const isExtensionPage = tab.url.includes('chrome-extension://');
    const isChromeUrl = tab.url.startsWith('chrome://');
    const isEmpty = !tab.title || tab.title.trim() === '';
    
    if (!isExtensionPage && !isChromeUrl && !isEmpty) {
      previousActiveTab = {
        id: tab.id,
        url: tab.url,
        title: tab.title
      };
      console.log('💾 Stored as previous active tab:', tab.title, 'ID:', tab.id);
    } else {
      console.log('🚫 Skipping non-web tab:', {
        title: tab.title,
        url: tab.url,
        isExtension: isExtensionPage,
        isChrome: isChromeUrl,
        isEmpty: isEmpty
      });
    }
  } catch (error) {
    console.error('❌ Error in onActivated:', error);
  }
});

// Track tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('🆕 Tab created:', tab.id, 'opener:', tab.openerTabId, 'url:', tab.url);
  try {
    const settings = await storage.getSettings();
    if (settings.trackingEnabled !== false) {
      console.log('📝 Tracking tab creation...');
      await tracker.handleTabCreated(tab);
      console.log('✅ Tab creation tracked');
    } else {
      console.log('🚫 Tracking disabled in settings');
    }
  } catch (error) {
    console.error('❌ Error tracking tab creation:', error);
  }
});

// Track tab updates (navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log('🔄 Tab updated:', tabId, 'new URL:', changeInfo.url);
  }
  try {
    const settings = await storage.getSettings();
    if (settings.trackingEnabled !== false) {
      await tracker.handleTabUpdated(tabId, changeInfo, tab);
    }
  } catch (error) {
    console.error('❌ Error tracking tab update:', error);
  }
});

// Track navigation events (most reliable for parent-child relationships)
chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  console.log('🎯 Navigation target created:', details);
  console.log('   Source tab:', details.sourceTabId);
  console.log('   Target tab:', details.tabId);
  console.log('   URL:', details.url);
  try {
    const settings = await storage.getSettings();
    if (settings.trackingEnabled !== false) {
      console.log('🔗 Processing navigation relationship...');
      await tracker.handleNavigation(details);
      console.log('✅ Navigation relationship processed');
    }
  } catch (error) {
    console.error('❌ Error tracking navigation:', error);
  }
});

// Track tab removal
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('🗑️ Tab removed:', tabId);
  try {
    await tracker.handleTabRemoved(tabId);
  } catch (error) {
    console.error('❌ Error tracking tab removal:', error);
  }
});

console.log('🎧 All event listeners registered successfully');

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);
  
  // Handle async responses
  (async () => {
    try {
      switch (request.action) {
        case 'getTabInfo':
          const tabs = await storage.getTabs();
          sendResponse({
            status: 'success',
            message: 'Tab Trail is tracking your tabs!',
            tabCount: `Tracking ${Object.keys(tabs).length} tabs`
          });
          break;
          
        case 'getCurrentTrail':
          const [currentTab] = await chrome.tabs.query({active: true, currentWindow: true});
          if (currentTab) {
            const trail = await storage.getTabTrail(currentTab.id);
            
            // Update the last item with fresh data
            if (trail.length > 0) {
              const lastItem = trail[trail.length - 1];
              if (lastItem.isCurrent) {
                lastItem.title = currentTab.title;
                lastItem.url = currentTab.url;
                try {
                  lastItem.domain = new URL(currentTab.url).hostname;
                } catch (e) {
                  lastItem.domain = currentTab.url.split('://')[0]; // For chrome:// URLs
                }
              }
            }
            
            sendResponse({
              status: 'success',
              trail: trail,
              currentTab: currentTab
            });
          } else {
            sendResponse({
              status: 'error',
              message: 'No active tab found'
            });
          }
          break;
          
        case 'getAllTabs':
          const allTabs = await storage.getTabs();
          console.log('📊 Sending', Object.keys(allTabs).length, 'tabs to explorer');
          console.log('📍 Previous active tab:', previousActiveTab);
          
          // If we don't have a previous active tab, try to find the most recent valid tab
          let finalPreviousActiveTab = previousActiveTab;
          if (!previousActiveTab) {
            console.log('🔍 No previous active tab stored, searching for most recent valid tab...');
            try {
              const allChromeTabs = await chrome.tabs.query({});
              const validTabs = allChromeTabs.filter(tab => 
                !tab.url.includes('chrome-extension://') && 
                !tab.url.startsWith('chrome://') &&
                tab.title && tab.title.trim() !== ''
              );
              
              if (validTabs.length > 0) {
                // Sort by lastAccessed or just take the first valid tab
                const mostRecentTab = validTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
                finalPreviousActiveTab = {
                  id: mostRecentTab.id,
                  url: mostRecentTab.url,
                  title: mostRecentTab.title
                };
                console.log('🎯 Found fallback previous active tab:', mostRecentTab.title, 'ID:', mostRecentTab.id);
              }
            } catch (error) {
              console.log('⚠️ Error finding fallback previous active tab:', error);
            }
          }
          
          sendResponse({
            status: 'success',
            tabs: allTabs,
            previousActiveTab: finalPreviousActiveTab
          });
          break;
          
        case 'clearData':
          await storage.clearAll();
          sendResponse({
            status: 'success',
            message: 'All data cleared'
          });
          break;
          
        case 'getSettings':
          const settings = await storage.getSettings();
          sendResponse({
            status: 'success',
            settings: settings
          });
          break;
          
        case 'saveSettings':
          await storage.saveSettings(request.settings);
          sendResponse({
            status: 'success',
            message: 'Settings saved'
          });
          break;
          
        default:
          sendResponse({
            status: 'error',
            message: `Unknown action: ${request.action}`
          });
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({
        status: 'error',
        message: error.message
      });
    }
  })();
  
  return true; // Keep the message channel open for async response
});

console.log('✅ Tab Trail Service Worker fully initialized!');
