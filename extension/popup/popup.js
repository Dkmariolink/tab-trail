// Tab Trail Popup Script
// Shows the current tab's trail

document.addEventListener('DOMContentLoaded', () => {
  // Get UI elements
  const trailDisplay = document.getElementById('trail-display');
  const fullTrailButton = document.getElementById('view-full-trail');
  const settingsLink = document.getElementById('settings-link');
  const donateLink = document.getElementById('donate-link');
  const copyTrailBtn = document.getElementById('copy-trail');
  const exportJsonBtn = document.getElementById('export-json');
  const exportMarkdownBtn = document.getElementById('export-markdown');
  
  // Store current trail for export
  let currentTrail = null;
  let currentTabInfo = null;
  
  // Load current trail on popup open
  loadCurrentTrail();
  
  // Load and display current trail
  async function loadCurrentTrail() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCurrentTrail'
      });
      
      if (response.status === 'success' && response.trail.length > 0) {
        currentTrail = response.trail;
        currentTabInfo = response.currentTab;
        displayTrail(response.trail, response.currentTab);
        showExportButtons();
      } else {
        currentTrail = null;
        currentTabInfo = null;
        hideExportButtons();
        // Better empty state
        trailDisplay.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🌱</div>
            <p class="empty-title">Start Your Journey</p>
            <p class="empty-message">
              Navigate to a few pages to see your browsing trail appear here.
            </p>
            <p class="empty-tip">
              💡 Tip: Tab Trail tracks every page you visit and shows how tabs are connected!
            </p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading trail:', error);
      trailDisplay.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌳</div>
          <p class="empty-title">Tab Trail Active</p>
          <p class="empty-message">
            Browse normally and your trail will appear here.
          </p>
        </div>
      `;
    }
  }
  // Display trail in popup
  function displayTrail(trail, currentTab) {
    let html = '<div class="trail">';
    
    // Group trail items by chain position to show clear separation
    let currentChainPosition = -1;
    
    // Show trail steps
    trail.forEach((tab, index) => {
      const isCurrentTab = tab.isCurrent;
      const isHistory = tab.isHistory;
      const isParent = tab.isParent;
      const isParentHistory = tab.isParentHistory;
      
      // Add chain separator if we're moving to a new tab in the chain
      if (tab.chainPosition !== undefined && tab.chainPosition !== currentChainPosition) {
        if (currentChainPosition >= 0) {
          html += '<div class="chain-separator">⬇️ opened new tab ⬇️</div>';
        }
        currentChainPosition = tab.chainPosition;
      }
      
      // Get favicon URL
      const faviconUrl = getFaviconUrl(tab.url);
      
      const domain = tab.domain || getDomain(tab.url) || '';
      const displayDomain = (tab.url === 'chrome://newtab/' || domain === 'newtab') ? '' : domain;
      const clickable = !isCurrentTab && tab.url && tab.url !== 'chrome://newtab/';
      
      // Calculate time spent (if we have the next item)
      let timeSpent = '';
      if (index < trail.length - 1 && tab.timestamp && tab.url !== 'chrome://newtab/') {
        const nextItem = trail[index + 1];
        if (nextItem.timestamp) {
          const duration = nextItem.timestamp - tab.timestamp;
          timeSpent = formatDuration(duration);
        }
      }
      
      // Determine step type and styling
      let stepClass = 'trail-step';
      let stepIcon = '';
      if (isCurrentTab) {
        stepClass += ' current';
        stepIcon = '📍 '; // Keep the pin for current page
      } else if (isParentHistory) {
        stepClass += ' parent-history';
        stepIcon = ''; // Remove emoji
      } else if (isHistory) {
        stepClass += ' history';
        stepIcon = ''; // Remove emoji
      } else if (isParent) {
        stepClass += ' parent';
        stepIcon = ''; // Remove emoji
      }
      
      if (clickable) {
        stepClass += ' clickable';
      }
      
      html += `
        <div class="${stepClass}"
             ${clickable ? `data-url="${tab.url}" data-tab-id="${tab.tabId || ''}"` : ''}>
          <span class="step-number">${index + 1}</span>
          <span class="step-icon">
            ${faviconUrl ? `<img src="${faviconUrl}" alt="" class="favicon" data-fallback="hide">` : ''}
          </span>
          <div class="step-info">
            <div class="step-title">${stepIcon}${truncateText(tab.title || tab.url, 30)}</div>
            ${displayDomain ? `<div class="step-domain">${displayDomain}</div>` : ''}
            ${timeSpent ? `<div class="step-time">${timeSpent}</div>` : ''}
          </div>
        </div>
      `;
      
      if (index < trail.length - 1) {
        html += '<div class="trail-connector">↓</div>';
      }
    });
    
    html += '</div>';
    
    // Enhanced summary message
    const trailLength = trail.length;
    const parentSteps = trail.filter(t => t.isParent || t.isParentHistory).length;
    const historySteps = trail.filter(t => t.isHistory).length;
    const chainPositions = new Set(trail.map(t => t.chainPosition).filter(p => p !== undefined)).size;
    
    let summaryText = '';
    if (trailLength === 1) {
      summaryText = 'Just started browsing';
    } else if (chainPositions > 1) {
      summaryText = `Complete journey: ${trailLength} steps across ${chainPositions} tabs`;
      if (parentSteps > 0) {
        summaryText += ` (${parentSteps} from parent tabs)`;
      }
    } else {
      summaryText = `Your journey: ${trailLength} steps`;
    }
    
    html += `<p class="trail-summary">${summaryText}</p>`;
    
    trailDisplay.innerHTML = html;
    
    // Handle favicon load errors
    trailDisplay.querySelectorAll('img.favicon').forEach(img => {
      img.addEventListener('error', function() {
        this.style.display = 'none';
      });
    });
    
    // Add click handlers to trail items
    document.querySelectorAll('.trail-step.clickable').forEach(step => {
      step.addEventListener('click', async () => {
        const url = step.dataset.url;
        const tabId = step.dataset.tabId;
        
        if (tabId && tabId !== 'undefined' && tabId !== 'null' && tabId !== '') {
          // Try to switch to existing tab first
          try {
            const numericTabId = parseInt(tabId);
            if (!isNaN(numericTabId)) {
              const tabs = await chrome.tabs.query({});
              const existingTab = tabs.find(t => t.id === numericTabId);
              
              if (existingTab) {
                // Tab still exists, switch to it
                await chrome.tabs.update(existingTab.id, { active: true });
                await chrome.windows.update(existingTab.windowId, { focused: true });
                window.close(); // Close popup after switching
                return;
              }
            }
          } catch (error) {
            console.error('Error checking tab:', error);
          }
        }
        
        // Tab doesn't exist, no tabId, or history item - open URL in new tab
        if (url && url !== 'chrome://newtab/') {
          chrome.tabs.create({ url: url });
          window.close(); // Close popup after opening
        }
      });
    });
  }
  
  // Get favicon URL for a given page URL
  function getFaviconUrl(url) {
    if (!url || url === 'chrome://newtab/') {
      // Return empty for new tab - no favicon needed
      return '';
    }
    try {
      // Always use Google's favicon service for external URLs
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
      // Return empty for invalid URLs
      return '';
    }
  }
  
  // Format duration in human-readable format
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  
  // Get domain from URL
  function getDomain(url) {
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }
  
  // Get icon for source type (backup for when favicon fails)
  function getSourceIcon(sourceType) {
    const icons = {
      'link': '🔗',
      'search': '🔍',
      'bookmark': '🔖',
      'direct': '📝',
      'unknown': '📄'
    };
    return icons[sourceType] || icons.unknown;
  }
  
  // Truncate text helper
  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  // Full trail button
  fullTrailButton.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('explorer/explorer.html')
    });
    window.close();
  });
  
  // Settings link
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Donate link
  donateLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('support/support.html')
    });
  });
  
  // Export functions
  function showExportButtons() {
    document.querySelector('.export-buttons').style.display = 'flex';
  }
  
  function hideExportButtons() {
    document.querySelector('.export-buttons').style.display = 'none';
  }
  
  // Copy trail as text
  copyTrailBtn.addEventListener('click', () => {
    if (!currentTrail) return;
    
    let text = 'Tab Trail\n';
    text += '=========\n\n';
    
    currentTrail.forEach((tab, index) => {
      const prefix = tab.isParent ? '⬆️ Parent: ' : 
                    tab.isHistory ? '📜 History: ' : 
                    tab.isCurrent ? '📍 Current: ' : '';
      
      text += `${index + 1}. ${prefix}${tab.title || tab.url}\n`;
      if (tab.domain && tab.url !== 'chrome://newtab/') {
        text += `   ${tab.domain}\n`;
      }
      
      // Add time if available
      if (index < currentTrail.length - 1 && tab.timestamp) {
        const nextItem = currentTrail[index + 1];
        if (nextItem.timestamp) {
          const duration = formatDuration(nextItem.timestamp - tab.timestamp);
          text += `   Time: ${duration}\n`;
        }
      }
      text += '\n';
    });
    
    text += `Generated by Tab Trail - ${new Date().toLocaleString()}`;
    
    copyToClipboard(text);
    showNotification('Trail copied to clipboard!');
  });
  
  // Export as JSON
  exportJsonBtn.addEventListener('click', () => {
    if (!currentTrail) return;
    
    const exportData = {
      extension: 'Tab Trail',
      exported: new Date().toISOString(),
      currentTab: {
        title: currentTabInfo.title,
        url: currentTabInfo.url,
        id: currentTabInfo.id
      },
      trail: currentTrail.map(tab => ({
        title: tab.title,
        url: tab.url,
        domain: tab.domain,
        timestamp: tab.timestamp,
        isParent: tab.isParent || false,
        isHistory: tab.isHistory || false,
        isCurrent: tab.isCurrent || false
      }))
    };
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    downloadFile(jsonStr, 'tab-trail-export.json', 'application/json');
    showNotification('Trail exported as JSON!');
  });
  
  // Export as Markdown
  exportMarkdownBtn.addEventListener('click', () => {
    if (!currentTrail) return;
    
    let markdown = '# Tab Trail Export\n\n';
    markdown += `**Date:** ${new Date().toLocaleString()}\n\n`;
    markdown += '## Browsing Trail\n\n';
    
    currentTrail.forEach((tab, index) => {
      const type = tab.isParent ? 'Parent Tab' : 
                  tab.isHistory ? 'Previous Page' : 
                  tab.isCurrent ? 'Current Page' : 'Page';
      
      markdown += `### ${index + 1}. ${type}\n\n`;
      markdown += `**Title:** ${tab.title || 'Untitled'}\n\n`;
      markdown += `**URL:** [${tab.url}](${tab.url})\n\n`;
      
      if (tab.domain && tab.url !== 'chrome://newtab/') {
        markdown += `**Domain:** ${tab.domain}\n\n`;
      }
      
      // Add time if available
      if (index < currentTrail.length - 1 && tab.timestamp) {
        const nextItem = currentTrail[index + 1];
        if (nextItem.timestamp) {
          const duration = formatDuration(nextItem.timestamp - tab.timestamp);
          markdown += `**Time Spent:** ${duration}\n\n`;
        }
      }
      
      markdown += '---\n\n';
    });
    
    markdown += '\n*Generated by [Tab Trail](https://chrome.google.com/webstore/detail/tab-trail)*';
    
    copyToClipboard(markdown);
    showNotification('Trail copied as Markdown!');
  });
  
  // Helper function to copy to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }
  
  // Helper function to download file
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // Show notification
  function showNotification(message) {
    // Create or find notification element
    let notification = document.querySelector('.export-success');
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'export-success';
      document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 2000);
  }
  
  // Initially hide export buttons
  hideExportButtons();
});