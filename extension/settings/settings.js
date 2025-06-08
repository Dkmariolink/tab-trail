// Tab Trail Settings Script

// Storage keys
const STORAGE_KEYS = {
  settings: 'settings',
  tabs: 'tabs'
};

// Default settings
const DEFAULT_SETTINGS = {
  retentionDays: 7,
  maxPagesPerTab: 50,
  trackingEnabled: true
};

// Load current settings
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    const settings = result[STORAGE_KEYS.settings] || DEFAULT_SETTINGS;
    
    // Update UI with current settings
    document.getElementById('retention-days').value = settings.retentionDays || DEFAULT_SETTINGS.retentionDays;
    document.getElementById('max-pages').value = settings.maxPagesPerTab || DEFAULT_SETTINGS.maxPagesPerTab;
    document.getElementById('tracking-enabled').checked = settings.trackingEnabled !== false;
    
    // Load storage stats
    await updateStorageStats();
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings
async function saveSettings() {
  const settings = {
    retentionDays: parseInt(document.getElementById('retention-days').value),
    maxPagesPerTab: parseInt(document.getElementById('max-pages').value),
    trackingEnabled: document.getElementById('tracking-enabled').checked
  };
  
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
    
    // Show success message
    showSuccessMessage('Settings saved successfully!');
    
    // Apply retention policy immediately
    await applyRetentionPolicy(settings.retentionDays);
    
    // Update storage stats
    await updateStorageStats();
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}
// Apply retention policy
async function applyRetentionPolicy(days) {
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  const result = await chrome.storage.local.get(STORAGE_KEYS.tabs);
  const tabs = result[STORAGE_KEYS.tabs] || {};
  
  const tabsToKeep = {};
  let removedCount = 0;
  
  for (const [id, tab] of Object.entries(tabs)) {
    if ((tab.lastUpdated || tab.created) > cutoffTime) {
      tabsToKeep[id] = tab;
    } else {
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    await chrome.storage.local.set({ [STORAGE_KEYS.tabs]: tabsToKeep });
    console.log(`Removed ${removedCount} old tabs based on retention policy`);
  }
}

// Update storage statistics
async function updateStorageStats() {
  try {
    const result = await chrome.storage.local.get(null);
    const tabs = result[STORAGE_KEYS.tabs] || {};
    
    // Calculate stats
    const tabCount = Object.keys(tabs).length;
    let totalPages = 0;
    
    for (const tab of Object.values(tabs)) {
      totalPages += 1; // Current page
      if (tab.history) {
        totalPages += tab.history.length;
      }
    }
    
    // Estimate storage size (rough calculation)
    const dataSize = JSON.stringify(result).length;
    const sizeInMB = (dataSize / (1024 * 1024)).toFixed(2);
    
    // Update UI
    document.getElementById('storage-stats').textContent = 
      `${tabCount} tabs tracked, ${totalPages} total pages, ~${sizeInMB} MB used`;
  } catch (error) {
    console.error('Error calculating storage stats:', error);
  }
}

// Clear all data
async function clearAllData() {
  if (confirm('Are you sure you want to clear all Tab Trail data? This cannot be undone.')) {
    try {
      await chrome.storage.local.clear();
      showSuccessMessage('All data cleared successfully!');
      
      // Reload settings to show defaults
      await loadSettings();
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }
}

// Show success message
function showSuccessMessage(message) {
  // Create or find success message element
  let successEl = document.querySelector('.success-message');
  if (!successEl) {
    successEl = document.createElement('div');
    successEl.className = 'success-message';
    document.querySelector('main').insertBefore(successEl, document.querySelector('main').firstChild);
  }
  
  successEl.textContent = message;
  successEl.classList.add('show');
  
  // Hide after 3 seconds
  setTimeout(() => {
    successEl.classList.remove('show');
  }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load settings on page load
  loadSettings();
  
  // Save button
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // Cancel button
  document.getElementById('cancel-settings').addEventListener('click', () => {
    window.close();
  });
  
  // Clear data button
  document.getElementById('clear-data').addEventListener('click', clearAllData);
});