// Tab Trail Explorer - D3.js Visualization

// Configuration
const CONFIG = {
  nodeRadius: 8,
  activeNodeRadius: 10,
  linkDistance: 200,  // Increased from 150 for better spacing
  chargeStrength: -800,  // Increased from -500 for more repulsion
  animationDuration: 750,
  colors: {
    google: '#4285f4',
    youtube: '#ff0000',
    github: '#333',
    stackoverflow: '#f48024',
    wikipedia: '#000',
    default: '#3498db'
  }
};

// Global variables
let svg, g, simulation, nodes, links;
let currentLayout = 'tree';
let showActive = true;
let showClosed = true;
let showLabels = false; // Default to no labels
let searchTerm = '';
let allTabsData = { nodes: [], links: [] };

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadTabData();
  initializeVisualization();
  setupEventListeners();
});

// Load tab data from storage
async function loadTabData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllTabs' });
    if (response.status === 'success') {
      allTabsData = processTabData(response.tabs, response.previousActiveTab);
      updateStats();
      
      // Hide loading message
      document.getElementById('loading').style.display = 'none';
      
      // Initial visualization will be triggered by processTabData after getting real tab states
    } else {
      console.error('Failed to load tabs:', response);
      document.getElementById('loading').textContent = 'Failed to load tab data. Please try refreshing.';
    }
  } catch (error) {
    console.error('Error loading tabs:', error);
    document.getElementById('loading').textContent = 'Error loading tabs. Make sure the extension is working properly.';
  }
}

// Process raw tab data into nodes and links
function processTabData(tabs, previousActiveTab) {
  const nodes = [];
  const links = [];
  const tabMap = new Map();
  
  console.log('🔄 Processing tabs data:', Object.keys(tabs).length, 'tabs');
  console.log('📍 Previous active tab from service worker:', previousActiveTab);
  
  // Create nodes
  Object.entries(tabs).forEach(([id, tab]) => {
    const node = {
      id: String(id), // Ensure string format
      title: tab.title || 'Untitled',
      url: tab.url,
      domain: tab.domain || getDomain(tab.url),
      status: tab.status || 'closed', // Use stored status or default to closed
      created: tab.created,
      lastUpdated: tab.lastUpdated,
      parentId: tab.parentId, // This should not be null if tracking works
      timeSpent: 0,
      isParent: false,
      isCurrent: false
    };
    
    if (tab.parentId) {
      console.log('🔗 Found parent relationship:', id, '←', tab.parentId, '(', tab.title, ')');
    } else {
      console.log('🌱 Root tab (no parent):', id, '(', tab.title, ')');
    }
    
    nodes.push(node);
    tabMap.set(String(id), node);
    
    // Add history nodes (simplified for now)
    if (tab.history && tab.history.length > 0) {
      console.log('📚 Tab has', tab.history.length, 'history items');
    }
  });
  
  // Create parent-child links
  let linkCount = 0;
  Object.entries(tabs).forEach(([id, tab]) => {
    console.log('🔍 Checking tab', id, 'parentId:', tab.parentId, 'exists in map:', tabMap.has(String(tab.parentId)));
    
    if (tab.parentId) {
      const parentExists = tabMap.has(String(tab.parentId));
      console.log('👀 Parent check - parentId:', tab.parentId, 'as string:', String(tab.parentId), 'exists:', parentExists);
      console.log('📋 Available tab IDs:', Array.from(tabMap.keys()));
      
      if (parentExists) {
        links.push({
          source: String(tab.parentId),
          target: String(id),
          type: 'parent-child'
        });
        const parentNode = tabMap.get(String(tab.parentId));
        if (parentNode) {
          parentNode.isParent = true;
        }
        linkCount++;
        console.log('✅ Created parent-child link:', tab.parentId, '→', id);
      } else {
        console.log('❌ Parent tab not found in map for:', id, 'looking for parent:', tab.parentId);
        
        // Check if parent exists in original data but was filtered out
        const parentInOriginal = tabs[tab.parentId];
        if (parentInOriginal) {
          console.log('🎯 Found missing parent in original data:', parentInOriginal.title);
          // Add the missing parent if it's a web page
          if (parentInOriginal.url && !parentInOriginal.url.includes('chrome-extension://') && !parentInOriginal.url.includes('chrome://')) {
            const parentNode = {
              id: String(tab.parentId),
              title: parentInOriginal.title || 'Parent Tab',
              url: parentInOriginal.url,
              domain: parentInOriginal.domain || getDomain(parentInOriginal.url),
              status: 'closed',
              created: parentInOriginal.created,
              lastUpdated: parentInOriginal.lastUpdated,
              parentId: parentInOriginal.parentId,
              timeSpent: 0,
              isParent: true,
              isCurrent: false
            };
            nodes.push(parentNode);
            tabMap.set(String(tab.parentId), parentNode);
            
            // Now create the link
            links.push({
              source: String(tab.parentId),
              target: String(id),
              type: 'parent-child'
            });
            linkCount++;
            console.log('✅ Added missing parent and created link:', tab.parentId, '→', id);
          }
        }
      }
    }
  });
  
  console.log('📊 Created', linkCount, 'parent-child relationships');
  
  // Get ACTUALLY OPEN tabs from Chrome
  chrome.tabs.query({}, (activeTabs) => {
    console.log('🔍 Found', activeTabs.length, 'open tabs in Chrome');
    const activeTabIds = new Set(activeTabs.map(t => String(t.id)));
    
    // Mark only truly open tabs as active
    let activeCount = 0;
    nodes.forEach(node => {
      if (activeTabIds.has(node.id)) {
        node.status = 'active';
        activeCount++;
      }
    });
    console.log('✅ Marked', activeCount, 'tabs as active');
    
    // Mark the PREVIOUS active tab as current (not the explorer tab)
    if (previousActiveTab && previousActiveTab.id) {
      console.log('🔍 Looking for previous active tab ID:', previousActiveTab.id, 'in', activeCount, 'active tabs');
      const previousNode = nodes.find(n => n.id === String(previousActiveTab.id));
      if (previousNode) {
        previousNode.isCurrent = true;
        console.log('🎯 Marked previous active tab as current:', previousActiveTab.title, 'ID:', previousActiveTab.id);
      } else {
        console.log('⚠️ Previous active tab not found in stored data. ID:', previousActiveTab.id);
        console.log('📋 Available node IDs:', nodes.map(n => `${n.id} (${n.title})`));
      }
    } else {
      console.log('⚠️ No valid previous active tab provided by service worker:', previousActiveTab);
    }
    
    // Update visualization after getting real tab states
    console.log('🎨 Triggering visualization update...');
    updateVisualization();
  });
  
  console.log('📈 Final data: ', nodes.length, 'nodes,', links.length, 'links');
  return { nodes, links };
}
// Initialize D3.js visualization
function initializeVisualization() {
  const width = window.innerWidth;
  const height = window.innerHeight - 120; // Account for header and footer
  
  // Create SVG
  svg = d3.select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Create group for zoom/pan
  g = svg.append('g');
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Initialize force simulation
  simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(CONFIG.linkDistance))
    .force('charge', d3.forceManyBody().strength(CONFIG.chargeStrength))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => showLabels ? 60 : 40).strength(0.9)) // Larger radius when labels shown
    .alphaDecay(0.02); // Slower cooling for more stable positioning
  
  // Initial render
  updateVisualization();
}

// Update visualization based on filters
function updateVisualization() {
  // Filter data
  const filteredData = filterData();
  
  // Clear ALL existing elements first
  g.selectAll('*').remove();
  
  // Add links
  links = g.selectAll('.link')
    .data(filteredData.links)
    .enter()
    .append('line')
    .attr('class', d => `link ${d.type}`)
    .style('opacity', 0);
  
  links.transition()
    .duration(CONFIG.animationDuration)
    .style('opacity', 1);
  
  // Add nodes
  nodes = g.selectAll('.node')
    .data(filteredData.nodes)
    .enter()
    .append('g')
    .attr('class', d => {
      let classes = 'node';
      if (d.status === 'active') classes += ' active';
      if (d.isCurrent) classes += ' current';
      if (isRootTab(d)) classes += ' root-tab';
      return classes;
    })
    .call(drag(simulation));
  
  // Add circles
  nodes.append('circle')
    .attr('r', 0)
    .attr('fill', d => getNodeColor(d))
    .attr('stroke', d => isRootTab(d) ? '#27ae60' : '#fff')
    .attr('stroke-width', d => isRootTab(d) ? 3 : 2)
    .style('filter', d => isRootTab(d) ? 'drop-shadow(0 0 8px #27ae60)' : null)
    .transition()
    .duration(CONFIG.animationDuration)
    .attr('r', d => getNodeRadius(d));
  
  // Add favicon images and optional text labels
  nodes.each(function(d) {
    if (d.url && d.url !== 'chrome://newtab/') {
      d3.select(this).append('image')
        .attr('xlink:href', `https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`)
        .attr('x', -12)
        .attr('y', -12)
        .attr('width', 24)
        .attr('height', 24)
        .style('opacity', 0)
        .transition()
        .duration(CONFIG.animationDuration)
        .style('opacity', 1);
    } else {
      // For new tab or tabs without favicons, show a default icon
      d3.select(this).append('circle')
        .attr('r', 6)
        .attr('fill', '#666')
        .style('opacity', 0.6);
    }
  });
  
  // Add text labels (initially hidden unless showLabels is true)
  nodes.append('text')
    .attr('x', 16)
    .attr('dy', '.35em')
    .text(d => truncateText(d.title, 12))
    .style('font-size', '12px')
    .style('font-weight', d => isRootTab(d) ? 'bold' : 'normal')
    .style('fill', d => isRootTab(d) ? '#27ae60' : '#e8e8e8')
    .style('text-shadow', '1px 1px 3px rgba(0, 0, 0, 0.9)')
    .style('pointer-events', 'none')
    .style('user-select', 'none')
    .style('display', showLabels ? 'block' : 'none');
  
  // Add click handlers
  nodes.on('click', handleNodeClick)
    .on('dblclick', handleNodeDoubleClick);
  
  // Update simulation
  simulation.nodes(filteredData.nodes);
  simulation.force('link').links(filteredData.links);
  simulation.alpha(1).restart();
  
  // Update positions on tick
  simulation.on('tick', () => {
    if (links) {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
    }
    
    if (nodes) {
      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    }
  });
  
  // Apply layout after simulation stabilizes
  setTimeout(() => {
    applyLayout();
  }, 500);
}

// Filter data based on current settings
function filterData() {
  let nodes = [...allTabsData.nodes];
  let links = [...allTabsData.links];
  
  // Filter by status
  if (!showActive) {
    nodes = nodes.filter(n => n.status !== 'active');
  }
  if (!showClosed) {
    nodes = nodes.filter(n => n.status !== 'closed');
  }
  
  // Filter out meaningless "New Tab" nodes and extension pages
  nodes = nodes.filter(n => {
    // Always filter out extension pages (they clutter the visualization)
    if (n.url && (n.url.includes('chrome-extension://') || n.url.includes('chrome://'))) {
      return false;
    }
    
    // Filter out solo New Tab nodes
    if (n.url === 'chrome://newtab/' || n.title === 'New Tab') {
      // Keep it only if it has children or is currently active
      const hasChildren = links.some(l => 
        (l.source === n.id || l.source.id === n.id) ||
        (l.target === n.id || l.target.id === n.id)
      );
      return hasChildren || n.status === 'active';
    }
    return true;
  });
  
  // Filter by search
  if (searchTerm) {
    nodes = nodes.filter(n => 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.domain.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Filter links to only include those with both nodes
  const nodeIds = new Set(nodes.map(n => n.id));
  links = links.filter(l => 
    nodeIds.has(l.source.id || l.source) && 
    nodeIds.has(l.target.id || l.target)
  );
  
  return { nodes, links };
}

// Apply different layouts
function applyLayout() {
  try {
    switch (currentLayout) {
      case 'tree':
        applyTreeLayout();
        break;
      case 'radial':
        applyRadialLayout();
        break;
      case 'timeline':
        applyTimelineLayout();
        break;
      default:
        console.warn('Unknown layout:', currentLayout);
    }
  } catch (error) {
    console.error('Layout application error:', error);
    // Fallback to simple force layout
    if (simulation) {
      simulation.alpha(0.3).restart();
    }
  }
}

// Tree layout - VERTICAL (top-down like family tree)
function applyTreeLayout() {
  try {
    // Get filtered data for better tree structure
    const filteredData = filterData();
    const treeNodes = filteredData.nodes.filter(n => !n.isHistory);
    
    if (treeNodes.length === 0) return;
    
    // Find root nodes (nodes without parents - these should be search pages, bookmarks, etc)
    const rootNodes = treeNodes.filter(n => !n.parentId);
    
    if (rootNodes.length === 0) {
      // If no root nodes, position nodes in a grid
      const cols = Math.ceil(Math.sqrt(treeNodes.length));
      treeNodes.forEach((node, i) => {
        node.fx = 200 + (i % cols) * 150;
        node.fy = 150 + Math.floor(i / cols) * 100;
      });
      return;
    }
    
    // Position each root tree separately
    const width = window.innerWidth;
    const height = window.innerHeight - 120;
    const treeWidth = width / rootNodes.length;
    
    rootNodes.forEach((rootNode, rootIndex) => {
      // Build hierarchy for this root
      const hierarchyData = buildTreeHierarchy(rootNode, treeNodes);
      
      if (!hierarchyData) return;
      
      // Create D3 hierarchy
      const root = d3.hierarchy(hierarchyData);
      
      // Apply VERTICAL tree layout (swap x and y)
      const tree = d3.tree()
        .size([treeWidth - 200, height - 300]) // More spacing
        .separation((a, b) => (a.parent == b.parent ? 2 : 3)); // Increased separation
      
      tree(root);
      
      // Position nodes VERTICALLY (root at top, children below)
      const offsetX = rootIndex * treeWidth + treeWidth / 2;
      const topMargin = 100;
      
      root.descendants().forEach(d => {
        const node = treeNodes.find(n => n.id === d.data.id);
        if (node) {
          // For vertical tree: x = horizontal spread, y = vertical depth
          node.fx = d.x + offsetX;      // Horizontal spread around center
          node.fy = d.y + topMargin;    // Vertical depth from top
        }
      });
    });
    
    // Position orphaned nodes in a separate area at the bottom
    let orphanX = 100;
    let orphanY = window.innerHeight - 200; // Bottom area
    treeNodes.forEach(node => {
      if (node.fx === undefined) {
        node.fx = orphanX;
        node.fy = orphanY;
        orphanX += 100;
        if (orphanX > window.innerWidth - 100) {
          orphanX = 100;
          orphanY += 80;
        }
      }
    });
    
    // Position history nodes near their parents
    filteredData.nodes.filter(n => n.isHistory).forEach(historyNode => {
      const parentId = historyNode.parentTabId;
      if (parentId) {
        const parent = treeNodes.find(n => n.id === parentId);
        if (parent && parent.fx !== undefined) {
          const angle = Math.random() * 2 * Math.PI;
          const distance = 50;
          historyNode.fx = parent.fx + Math.cos(angle) * distance;
          historyNode.fy = parent.fy + Math.sin(angle) * distance;
        }
      }
    });
    
  } catch (error) {
    console.error('Tree layout error:', error);
    // Fallback to simple grid layout
    const filteredData = filterData();
    const cols = Math.ceil(Math.sqrt(filteredData.nodes.length));
    filteredData.nodes.forEach((node, i) => {
      node.fx = 200 + (i % cols) * 150;
      node.fy = 150 + Math.floor(i / cols) * 100;
    });
  }
  
  if (simulation) {
    simulation.alpha(0.3).restart();
  }
}

// Build tree hierarchy for a root node
function buildTreeHierarchy(rootNode, allNodes) {
  function buildNode(node) {
    const children = allNodes
      .filter(n => n.parentId === node.id)
      .map(child => buildNode(child));
    
    return {
      id: node.id,
      title: node.title,
      url: node.url,
      domain: node.domain,
      status: node.status,
      children: children
    };
  }
  
  return buildNode(rootNode);
}

// Radial layout
function applyRadialLayout() {
  const width = window.innerWidth;
  const height = window.innerHeight - 120;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Get filtered data
  const filteredData = filterData();
  const tabNodes = filteredData.nodes.filter(n => !n.isHistory);
  
  // Find root nodes (nodes without parents)
  const rootNodes = tabNodes.filter(n => !n.parentId);
  
  if (rootNodes.length === 0) {
    // No root nodes, arrange all in concentric circles
    const radius = Math.min(width, height) / 6;
    tabNodes.forEach((node, i) => {
      const angle = (i / tabNodes.length) * 2 * Math.PI;
      const nodeRadius = radius + (i % 3) * 60; // Multiple rings
      node.fx = centerX + Math.cos(angle) * nodeRadius;
      node.fy = centerY + Math.sin(angle) * nodeRadius;
    });
    return;
  }
  
  // Position roots in a circle around center
  const rootRadius = 100;
  const angleStep = (2 * Math.PI) / rootNodes.length;
  
  rootNodes.forEach((root, rootIndex) => {
    const rootAngle = rootIndex * angleStep;
    root.fx = centerX + Math.cos(rootAngle) * rootRadius;
    root.fy = centerY + Math.sin(rootAngle) * rootRadius;
    
    // Position children recursively in expanding rings
    positionChildrenRadially(root, rootAngle, 1, tabNodes, centerX, centerY);
  });
  
  // Position history nodes near their parents
  filteredData.nodes.filter(n => n.isHistory).forEach(historyNode => {
    const parentId = historyNode.parentTabId;
    if (parentId) {
      const parent = tabNodes.find(n => n.id === parentId);
      if (parent && parent.fx !== undefined) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 30;
        historyNode.fx = parent.fx + Math.cos(angle) * distance;
        historyNode.fy = parent.fy + Math.sin(angle) * distance;
      }
    }
  });
  
  if (simulation) {
    simulation.alpha(0.3).restart();
  }
}

// Helper function for radial positioning
function positionChildrenRadially(parent, parentAngle, level, allNodes, centerX, centerY) {
  const children = allNodes.filter(n => n.parentId === parent.id);
  if (children.length === 0) return;
  
  const levelRadius = 100 + level * 120; // Increasing radius for each level
  const maxAngleSpread = Math.PI / 2; // Maximum spread for children
  const angleSpread = Math.min(maxAngleSpread, children.length * 0.3);
  const angleStep = children.length > 1 ? angleSpread / (children.length - 1) : 0;
  const startAngle = parentAngle - angleSpread / 2;
  
  children.forEach((child, i) => {
    const childAngle = children.length === 1 
      ? parentAngle 
      : startAngle + i * angleStep;
    
    child.fx = centerX + Math.cos(childAngle) * levelRadius;
    child.fy = centerY + Math.sin(childAngle) * levelRadius;
    
    // Recursively position this child's children
    positionChildrenRadially(child, childAngle, level + 1, allNodes, centerX, centerY);
  });
}

// Timeline layout
function applyTimelineLayout() {
  const width = window.innerWidth - 200;
  const height = window.innerHeight - 300;
  const leftMargin = 100;
  const topMargin = 80;
  const bottomMargin = 120;
  
  // Get filtered data
  const filteredData = filterData();
  const timedNodes = filteredData.nodes.filter(n => n.created && !n.isHistory);
  
  if (timedNodes.length === 0) return;
  
  // Sort nodes by creation time
  timedNodes.sort((a, b) => a.created - b.created);
  
  // Create time scale
  const timeExtent = d3.extent(timedNodes, d => d.created);
  const xScale = d3.scaleTime()
    .domain(timeExtent)
    .range([leftMargin, width]);
  
  // Clear existing timeline elements
  g.selectAll('.timeline-axis').remove();
  g.selectAll('.timeline-label').remove();
  
  // Add time axis
  const timeAxis = d3.axisBottom(xScale)
    .tickFormat(d3.timeFormat('%m/%d %H:%M'))
    .ticks(6);
  
  g.append('g')
    .attr('class', 'timeline-axis')
    .attr('transform', `translate(0, ${height - bottomMargin + 50})`)
    .call(timeAxis)
    .selectAll('text')
    .style('fill', '#95a5a6')
    .style('font-size', '12px');
  
  g.selectAll('.timeline-axis path, .timeline-axis line')
    .style('stroke', '#34495e')
    .style('stroke-width', 1);
  
  // Group nodes into tracks to avoid overlaps
  const tracks = [];
  const trackHeight = 60;
  const maxTracks = Math.floor((height - topMargin - bottomMargin) / trackHeight);
  
  timedNodes.forEach(node => {
    const x = xScale(node.created);
    let trackIndex = 0;
    
    // Find an available track
    while (trackIndex < maxTracks) {
      if (!tracks[trackIndex]) {
        tracks[trackIndex] = [];
      }
      
      // Check if this position conflicts with existing nodes in this track
      const conflicts = tracks[trackIndex].some(existingNode => {
        const existingX = xScale(existingNode.created);
        return Math.abs(x - existingX) < 80; // Minimum spacing
      });
      
      if (!conflicts) {
        tracks[trackIndex].push(node);
        node.trackIndex = trackIndex;
        break;
      }
      
      trackIndex++;
    }
    
    // If no track found, use the last available track
    if (trackIndex >= maxTracks) {
      const lastTrack = maxTracks - 1;
      tracks[lastTrack] = tracks[lastTrack] || [];
      tracks[lastTrack].push(node);
      node.trackIndex = lastTrack;
    }
  });
  
  // Position nodes on timeline
  timedNodes.forEach(node => {
    node.fx = xScale(node.created);
    node.fy = topMargin + (node.trackIndex * trackHeight);
  });
  
  // Position history nodes near their parents
  filteredData.nodes.filter(n => n.isHistory).forEach(historyNode => {
    const parentId = historyNode.parentTabId;
    if (parentId) {
      const parent = timedNodes.find(n => n.id === parentId);
      if (parent && parent.fx !== undefined) {
        historyNode.fx = parent.fx + 25;
        historyNode.fy = parent.fy + 20;
      }
    }
  });
  
  // Add track labels
  tracks.forEach((track, index) => {
    if (track && track.length > 0) {
      g.append('text')
        .attr('class', 'timeline-label')
        .attr('x', 20)
        .attr('y', topMargin + (index * trackHeight))
        .attr('dy', '.35em')
        .style('fill', '#95a5a6')
        .style('font-size', '12px')
        .text(`Track ${index + 1}`);
    }
  });
  
  if (simulation) {
    simulation.alpha(0.3).restart();
  }
}

// Handle node click
function handleNodeClick(event, d) {
  event.stopPropagation();
  
  // Prevent simulation restart on click
  if (simulation) {
    simulation.alphaTarget(0);
  }
  
  showNodeDetails(d);
}

// Handle node double click
function handleNodeDoubleClick(event, d) {
  event.stopPropagation();
  if (d.url && d.url !== 'chrome://newtab/') {
    // Try to switch to tab if active
    if (d.status === 'active') {
      chrome.tabs.update(parseInt(d.id), { active: true });
    } else {
      // Open URL in new tab
      chrome.tabs.create({ url: d.url });
    }
  }
}

// Show node details in side panel
function showNodeDetails(node) {
  const panel = document.getElementById('details-panel');
  const content = document.getElementById('details-content');
  
  let html = `<h2>${node.title}</h2>`;
  
  html += '<div class="detail-item">';
  html += '<div class="detail-label">URL</div>';
  html += `<div class="detail-value"><a href="${node.url}" target="_blank">${node.url}</a></div>`;
  html += '</div>';
  
  if (node.domain) {
    html += '<div class="detail-item">';
    html += '<div class="detail-label">Domain</div>';
    html += `<div class="detail-value">${node.domain}</div>`;
    html += '</div>';
  }
  
  html += '<div class="detail-item">';
  html += '<div class="detail-label">Status</div>';
  let statusText = node.status === 'active' ? '🟢 Active' : '⚫ Closed';
  if (node.isCurrent) {
    statusText += ' <span style="color: #f1c40f; font-weight: bold;">🟡 Last Active</span>';
  }
  html += `<div class="detail-value">${statusText}</div>`;
  html += '</div>';
  
  // Debug parent-child relationship
  html += '<div class="detail-item">';
  html += '<div class="detail-label">Tab Type</div>';
  if (isRootTab(node)) {
    html += `<div class="detail-value">🌳 <span style="color: #27ae60; font-weight: bold;">Root Tab</span> (starts a browsing trail)</div>`;
  } else {
    html += `<div class="detail-value">🔗 Child Tab (opened from another tab)</div>`;
  }
  html += '</div>';
  
  // Show parent information
  if (node.parentId) {
    // Find parent tab info
    const parentNode = allTabsData.nodes.find(n => n.id === node.parentId);
    if (parentNode) {
      html += '<div class="detail-item">';
      html += '<div class="detail-label">Opened From</div>';
      html += `<div class="detail-value"><a href="${parentNode.url}" target="_blank">${parentNode.title}</a></div>`;
      html += '</div>';
    } else {
      html += '<div class="detail-item">';
      html += '<div class="detail-label">Parent ID</div>';
      html += `<div class="detail-value">${node.parentId} (parent not found in current data)</div>`;
      html += '</div>';
    }
  }
  
  if (node.created) {
    html += '<div class="detail-item">';
    html += '<div class="detail-label">Created</div>';
    html += `<div class="detail-value">${new Date(node.created).toLocaleString()}</div>`;
    html += '</div>';
  }
  
  content.innerHTML = html;
  panel.classList.remove('hidden');
}

// Helper function to check if a tab is a root tab (home/parent tab)
function isRootTab(node) {
  // A root tab is one that has no parent (starts a browsing trail)
  return !node.parentId && !node.isHistory;
}

// Helper functions
function getNodeColor(node) {
  if (node.status === 'history') return '#666';
  
  // Root tabs (home/parent tabs) are green
  if (isRootTab(node)) return '#27ae60';
  
  const domain = node.domain.toLowerCase();
  for (const [key, color] of Object.entries(CONFIG.colors)) {
    if (domain.includes(key)) return color;
  }
  return CONFIG.colors.default;
}

function getNodeRadius(node) {
  if (node.isCurrent) return CONFIG.activeNodeRadius * 1.5;
  if (node.status === 'active') return CONFIG.activeNodeRadius;
  if (node.isParent) return CONFIG.activeNodeRadius * 1.2;
  return CONFIG.nodeRadius;
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Drag behavior
function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.1).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    // Keep position fixed after drag unless reset
  }
  
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

// Update statistics
function updateStats() {
  const tabCount = allTabsData.nodes.filter(n => !n.isHistory).length;
  const domains = new Set(allTabsData.nodes.map(n => n.domain));
  
  document.getElementById('tab-count').textContent = `${tabCount} tabs`;
  document.getElementById('domain-count').textContent = `${domains.size} domains`;
}

// Setup event listeners
function setupEventListeners() {
  // Layout buttons
  document.getElementById('layout-tree').addEventListener('click', () => {
    setLayout('tree');
  });
  
  document.getElementById('layout-radial').addEventListener('click', () => {
    setLayout('radial');
  });
  
  document.getElementById('layout-timeline').addEventListener('click', () => {
    setLayout('timeline');
  });
  
  // Filter buttons
  document.getElementById('filter-active').addEventListener('click', (e) => {
    showActive = !showActive;
    e.target.classList.toggle('active', showActive);
    updateVisualization();
  });
  
  document.getElementById('filter-closed').addEventListener('click', (e) => {
    showClosed = !showClosed;
    e.target.classList.toggle('active', showClosed);
    updateVisualization();
  });
  
  // Labels toggle button
  document.getElementById('toggle-labels').addEventListener('click', (e) => {
    showLabels = !showLabels;
    e.target.classList.toggle('active', showLabels);
    
    // Toggle visibility of all text elements
    if (nodes) {
      nodes.selectAll('text')
        .style('display', showLabels ? 'block' : 'none');
    }
    
    // Update collision force based on label visibility
    if (simulation) {
      simulation
        .force('collision', d3.forceCollide().radius(d => showLabels ? 60 : 40).strength(0.9))
        .alpha(0.3)
        .restart();
    }
  });
  
  // Search box
  let searchTimeout;
  document.getElementById('search-box').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchTerm = e.target.value;
      updateVisualization();
    }, 300);
  });
  
  // Reset view
  document.getElementById('reset-view').addEventListener('click', () => {
    // Reset zoom and pan
    svg.transition().duration(750).call(
      d3.zoom().transform,
      d3.zoomIdentity
    );
    
    // Clear ALL fixed positions and layout-specific elements
    if (nodes && nodes.data) {
      nodes.data().forEach(d => {
        d.fx = null;
        d.fy = null;
        d.trackIndex = null;
      });
    }
    
    // Remove timeline-specific elements
    g.selectAll('.timeline-axis').remove();
    g.selectAll('.timeline-label').remove();
    
    // Reset to default force layout
    currentLayout = 'tree';
    
    // Update button states
    document.querySelectorAll('.layout-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById('layout-tree').classList.add('active');
    
    // Restart simulation with fresh forces
    if (simulation) {
      simulation
        .force('collision', d3.forceCollide().radius(d => showLabels ? 60 : 40).strength(0.9))
        .alpha(1)
        .restart();
      setTimeout(() => {
        applyLayout();
      }, 100);
    }
  });
  
  // Close details
  document.getElementById('close-details').addEventListener('click', () => {
    document.getElementById('details-panel').classList.add('hidden');
  });
  
  // Export SVG
  document.getElementById('export-svg').addEventListener('click', exportSVG);
  
  // Close explorer
  document.getElementById('close-explorer').addEventListener('click', () => {
    window.close();
  });
  
  // Window resize
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight - 120;
    
    svg.attr('width', width).attr('height', height);
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
  });
}

// Set layout
function setLayout(layout) {
  // Stop current simulation
  if (simulation) {
    simulation.stop();
  }
  
  // Clear ALL fixed positions and layout artifacts
  if (nodes && nodes.data) {
    nodes.data().forEach(d => {
      d.fx = null;
      d.fy = null;
      d.trackIndex = null;
    });
  }
  
  // Remove any layout-specific elements
  g.selectAll('.timeline-axis').remove();
  g.selectAll('.timeline-label').remove();
  
  currentLayout = layout;
  
  // Update button states
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`layout-${layout}`).classList.add('active');
  
  // Restart simulation fresh
  if (simulation) {
    // Reset forces to defaults
    simulation
      .force('link', d3.forceLink().id(d => d.id).distance(CONFIG.linkDistance))
      .force('charge', d3.forceManyBody().strength(CONFIG.chargeStrength))
      .force('center', d3.forceCenter(window.innerWidth / 2, (window.innerHeight - 120) / 2))
      .force('collision', d3.forceCollide().radius(d => showLabels ? 60 : 40).strength(0.9))
      .alpha(1)
      .restart();
  }
  
  // Apply new layout after simulation settles
  setTimeout(() => {
    applyLayout();
  }, 800);
}

// Export as PNG image using canvas rendering
function exportSVG() {
  try {
    // Create canvas with proper dimensions
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set high resolution for quality
    const scale = 2; // 2x for retina quality
    canvas.width = 1200 * scale;
    canvas.height = 800 * scale;
    ctx.scale(scale, scale);
    
    // Dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 1200, 800);
    
    // Get SVG bounds for centering
    const svgElement = svg.node();
    const svgBounds = svgElement.getBBox();
    const centerX = 600;
    const centerY = 400;
    const offsetX = centerX - svgBounds.width / 2;
    const offsetY = centerY - svgBounds.height / 2;
    
    // Render nodes and links manually to canvas
    renderToCanvas(ctx, offsetX, offsetY);
    
    // Convert to PNG and download
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `tab-trail-${Date.now()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 'image/png');
    
  } catch (error) {
    console.warn('PNG export failed, falling back to SVG:', error);
    exportAsSVG();
  }
}

// Render visualization elements to canvas
function renderToCanvas(ctx, offsetX, offsetY) {
  // Render links first (so they appear behind nodes)
  if (links && links.data) {
    links.data().forEach(link => {
      if (link.source && link.target && link.source.x !== undefined && link.target.x !== undefined) {
        ctx.beginPath();
        ctx.moveTo(link.source.x + offsetX, link.source.y + offsetY);
        ctx.lineTo(link.target.x + offsetX, link.target.y + offsetY);
        ctx.strokeStyle = '#4dabf7';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }
  
  // Render nodes
  if (nodes && nodes.data) {
    nodes.data().forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const x = node.x + offsetX;
        const y = node.y + offsetY;
        const radius = 20;
        
        // Determine node color based on type
        let fillColor = '#4dabf7'; // default blue
        if (node.current) fillColor = '#ffd700'; // yellow for current
        else if (node.isRoot) fillColor = '#51cf66'; // green for root
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw text label if it exists and labels are shown
        if (showLabels && node.title) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Truncate long titles
          let title = node.title;
          if (title.length > 15) {
            title = title.substring(0, 12) + '...';
          }
          
          ctx.fillText(title, x, y + radius + 15);
        }
      }
    });
  }
}

// Fallback SVG export with enhanced styling
function exportAsSVG() {
  const svgElement = svg.node();
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const enhancedSVG = addSVGStyles(svgData);
  
  const svgBlob = new Blob([enhancedSVG], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  
  const downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = `tab-trail-${Date.now()}.svg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(svgUrl);
}

// Add comprehensive styles to SVG
function addSVGStyles(svgData) {
  const styles = `
    <defs>
      <style type="text/css">
        <![CDATA[
          svg { background-color: #1a1a1a; }
          .node circle {
            fill: #4dabf7;
            stroke: #ffffff;
            stroke-width: 2px;
          }
          .node.current circle {
            fill: #ffd700;
            stroke: #ffffff;
            stroke-width: 3px;
          }
          .node.root circle {
            fill: #51cf66;
            stroke: #ffffff;
            stroke-width: 2px;
          }
          .node text {
            fill: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            text-anchor: middle;
            dominant-baseline: central;
            pointer-events: none;
          }
          .link {
            stroke: #4dabf7;
            stroke-width: 2px;
            stroke-opacity: 0.8;
            fill: none;
          }
          .link.highlighted {
            stroke: #ffd700;
            stroke-width: 3px;
            stroke-opacity: 1;
          }
        ]]>
      </style>
    </defs>
  `;
  
  // Insert styles after opening SVG tag and add dark background
  return svgData
    .replace('<svg', `<svg style="background-color: #1a1a1a;"`)
    .replace('>', '>' + styles);
}