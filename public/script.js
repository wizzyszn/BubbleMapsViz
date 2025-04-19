// Configuration
const config = {
  apiUrl: '/api/traders',
  nodeSizeRange: [10, 50],
  colors: {
    whale: '#ff6b8b',
    retail: '#4ade80',
    linkDefault: '#8b95a8',
    linkHighlight: '#3a6df0'
  }
};

// Application state
const state = {
  data: null,
  simulation: null,
  svg: null,
  zoomGroup: null,
  zoom: null,
  link: null,
  node: null,
  tooltip: null,
  selectedNode: null,
  width: 0,
  height: 0
};

// DOM Elements
const tokenAddressInput = document.getElementById('tokenAddress');
const timeFilterSelect = document.getElementById('timeFilter');
const searchButton = document.getElementById('searchButton');
const chartContainer = document.getElementById('chart');
const detailPanel = document.getElementById('detailPanel');
const noDataMessage = document.querySelector('.no-data');
const loader = document.querySelector('.loader');

// Control buttons
const showAllLinksButton = document.getElementById('showAllLinks');
const hideAllLinksButton = document.getElementById('hideAllLinks');
const cluster= true;
const clusterByCategoryButton = document.getElementById('clusterByCategory');
const resetLayoutButton = document.getElementById('resetLayout');
const closeDetailPanelButton = document.getElementById('closeDetailPanel');

// Detail panel elements
const traderAddressElement = document.getElementById('traderAddress');
const traderTypeElement = document.getElementById('traderType');
const traderVolumeElement = document.getElementById('traderVolume');
const connectedTradersElement = document.getElementById('connectedTraders');
const copyAddressButton = document.getElementById('copyAddressButton');
const viewOnEtherscanButton = document.getElementById('viewOnEtherscan');
const trackWalletButton = document.getElementById('trackWallet');
const transactionListElement = document.getElementById('transactionList');

// Initialize the application
function init() {
  // Create SVG element
  state.width = chartContainer.clientWidth;
  state.height = chartContainer.clientHeight;

  state.svg = d3.select(chartContainer)
    .append('svg')
    .attr('width', state.width)
    .attr('height', state.height);

  // A container group for all visualization elements that will be zoomed
  state.zoomGroup = state.svg.append('g')
    .attr('class', 'zoom-group');

  // Add zoom behavior
  state.zoom = d3.zoom()
    .scaleExtent([0.1, 10]) // Zoom scale from 0.1x to 10x
    .on('zoom', handleZoom);

  state.svg.call(state.zoom);

  // Create tooltip
  state.tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  // Add event listeners
  searchButton.addEventListener('click', fetchTraderData);
  showAllLinksButton.addEventListener('click', showAllLinks);
  hideAllLinksButton.addEventListener('click', hideAllLinks);
  clusterByCategoryButton.addEventListener('click', clusterByCategory);
  resetLayoutButton.addEventListener('click', resetLayout);
  closeDetailPanelButton.addEventListener('click', closeDetailPanel);
  copyAddressButton.addEventListener('click', copyTraderAddress);
  viewOnEtherscanButton.addEventListener('click', viewOnEtherscan);
  trackWalletButton.addEventListener('click', trackWallet);

  // Add zoom controls
  addZoomControls();

  // Handle window resize
  window.addEventListener('resize', handleResize);

  // Initial data fetch
  fetchTraderData();
}

// Zoom controls for the application
function addZoomControls() {
  if (!document.getElementById('zoomInButton')) {
    const controlsContainer = document.querySelector('.chart-controls') || document.createElement('div');

    if (!controlsContainer.classList.contains('chart-controls')) {
      controlsContainer.className = 'chart-controls';
      chartContainer.parentNode.insertBefore(controlsContainer, chartContainer.nextSibling);
    }

    const zoomControlsHTML = `
      <button id="zoomInButton" class="control-button" title="Zoom In">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </button>
      <button id="zoomOutButton" class="control-button" title="Zoom Out">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </button>
      <button id="resetZoomButton" class="control-button" title="Reset Zoom">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 3H3v18h18V3z"></path>
        </svg>
      </button>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = zoomControlsHTML;
    while (tempDiv.firstChild) {
      controlsContainer.appendChild(tempDiv.firstChild);
    }

    // Add event listeners for zoom buttons
    document.getElementById('zoomInButton').addEventListener('click', zoomIn);
    document.getElementById('zoomOutButton').addEventListener('click', zoomOut);
    document.getElementById('resetZoomButton').addEventListener('click', resetZoom);
  }
}

// Handle zoom events
function handleZoom(event) {
  state.zoomGroup.attr('transform', event.transform);

  // Adjust node sizes based on zoom level if desired
  if (state.node) {
    state.node.attr('stroke-width', 1.5 / event.transform.k);
  }

  // Adjust link stroke width based on zoom level
  if (state.link) {
    state.link.attr('stroke-width', 1.5 / event.transform.k);
  }
}

// Zoom in function
function zoomIn() {
  state.svg.transition().duration(300).call(
    state.zoom.scaleBy, 1.3
  );
}

// Zoom out function
function zoomOut() {
  state.svg.transition().duration(300).call(
    state.zoom.scaleBy, 0.7
  );
}

// Reset zoom function
function resetZoom() {
  state.svg.transition().duration(300).call(
    state.zoom.transform,
    d3.zoomIdentity
  );
}

// Fetch trader data from the API
async function fetchTraderData() {
  const tokenAddress = tokenAddressInput.value.trim();
  const timeFilter = timeFilterSelect.value;

  if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/i.test(tokenAddress)) {
    alert('Please enter a valid token contract address');
    return;
  }

  // Reset and show loader
  resetVisualization();
  loader.style.display = 'block';
  noDataMessage.style.display = 'none';
  closeDetailPanel();

  try {
    const response = await fetch(`${config.apiUrl}?address=${tokenAddress}&time=${timeFilter}`);

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.message || data.nodes.length === 0) {
      noDataMessage.style.display = 'block';
      loader.style.display = 'none';
      return;
    }

    // Store data and create visualization
    state.data = processData(data);
    createVisualization();
    loader.style.display = 'none';
  } catch (error) {
    console.error('Error fetching trader data:', error);
    noDataMessage.style.display = 'block';
    loader.style.display = 'none';
    alert(`Error: ${error.message}`);
  }
}

// Process the API data
function processData(data) {
  // Calculate max volume for node sizing
  const maxVolume = Math.max(...data.nodes.map(node => node.volume));

  // Process nodes
  const nodes = data.nodes.map(node => {
    const sizeScale = d3.scaleLinear()
      .domain([0, maxVolume])
      .range(config.nodeSizeRange);

    return {
      ...node,
      radius: sizeScale(node.volume),
      color: node.type === 'whale' ? config.colors.whale : config.colors.retail
    };
  });

  // Process links
  const links = data.links.map(link => ({
    source: link.source,
    target: link.target,
    // Add some sample transaction data for demo purposes
    value: Math.random() * 1000 + 100 ,  // Random value between 100 and 1100
    timestamp: Date.now() - Math.floor(Math.random() * 604800000), // Random timestamp within last week
    txHash: '0x' + Array.from({ length: 64 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
  }));

  return { nodes, links };
}

// Create the force-directed visualization
function createVisualization() {
  // Clear existing visualization
  state.zoomGroup.selectAll('*').remove();

  // Create force simulation
  state.simulation = d3.forceSimulation(state.data.nodes)
    .force('link', d3.forceLink(state.data.links)
      .id(d => d.id)
      .distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(state.width / 2, state.height / 2))
    .force('collide', d3.forceCollide().radius(d => d.radius + 5))
    .on('tick', ticked);

  // Create the links
  state.link = state.zoomGroup.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(state.data.links)
    .enter()
    .append('line')
    .attr('stroke', config.colors.linkDefault)
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 1.5)
    .on('mouseover', handleLinkMouseOver)
    .on('mouseout', handleLinkMouseOut);

  // Create the nodes
  state.node = state.zoomGroup.append('g')
    .attr('class', 'nodes')
    .selectAll('circle')
    .data(state.data.nodes)
    .enter()
    .append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1.5)
    .attr('fill-opacity', 0.8)
    .call(drag(state.simulation))
    .on('mouseover', handleNodeMouseOver)
    .on('mouseout', handleNodeMouseOut)
    .on('click', handleNodeClick);

  // Node labels for whales only
  state.zoomGroup.append('g')
    .attr('class', 'labels')
    .selectAll('text')
    .data(state.data.nodes.filter(d => d.type === 'whale'))
    .enter()
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '-1.2em')
    .attr('fill', '#ffffff')
    .attr('font-size', '10px')
    .text(d => shortenAddress(d.id));
}

// Update positions on tick
function ticked() {
  // Contain nodes within visualization bounds
  state.data.nodes.forEach(d => {
    d.x = Math.max(d.radius, Math.min(state.width - d.radius, d.x));
    d.y = Math.max(d.radius, Math.min(state.height - d.radius, d.y));
  });

  // Update link positions
  state.link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  // Update node positions
  state.node
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  // Update label positions
  state.zoomGroup.selectAll('.labels text')
    .attr('x', d => d.x)
    .attr('y', d => d.y);
}

// Drag functionality
function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3.drag()
    .filter(event => !event.ctrlKey && !event.button) // Only start drag if not zooming
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

// Node hover functionality
function handleNodeMouseOver(event, d) {
  // Highlight connected links and nodes
  state.link
    .attr('stroke', l => (l.source.id === d.id || l.target.id === d.id)
      ? config.colors.linkHighlight : config.colors.linkDefault)
    .attr('stroke-opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 0.8 : 0.2)
    .attr('stroke-width', l => (l.source.id === d.id || l.target.id === d.id) ? 2.5 : 1);

  state.node
    .attr('stroke-width', n => {
      const isConnected = state.data.links.some(l =>
        (l.source.id === d.id && l.target.id === n.id) ||
        (l.target.id === d.id && l.source.id === n.id));
      return n.id === d.id || isConnected ? 3 : 1.5;
    })
    .attr('fill-opacity', n => {
      const isConnected = state.data.links.some(l =>
        (l.source.id === d.id && l.target.id === n.id) ||
        (l.target.id === d.id && l.source.id === n.id));
      return n.id === d.id || isConnected ? 1 : 0.3;
    });

  // Show tooltip
  state.tooltip
    .transition()
    .duration(200)
    .style('opacity', 0.9);

  state.tooltip
    .html(`
      <strong>${shortenAddress(d.id)}</strong>
      <span class="badge badge-${d.type}">${d.type}</span><br/>
      <b>Volume:</b> ${formatCurrency(d.volume)}
    `)
    .style('left', (event.pageX + 15) + 'px')
    .style('top', (event.pageY - 30) + 'px');
}

// Node hover out functionality
function handleNodeMouseOut() {
  // Reset links and nodes
  state.link
    .attr('stroke', config.colors.linkDefault)
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 1.5);

  state.node
    .attr('stroke-width', 1.5)
    .attr('fill-opacity', 0.8);

  // Hide tooltip
  state.tooltip
    .transition()
    .duration(500)
    .style('opacity', 0);
}

// Link hover functionality
function handleLinkMouseOver(event, d) {
  // Highlight the link
  d3.select(event.currentTarget)
    .attr('stroke', config.colors.linkHighlight)
    .attr('stroke-opacity', 1)
    .attr('stroke-width', 3);

  // Show transaction details in tooltip
  state.tooltip
    .transition()
    .duration(200)
    .style('opacity', 0.9);

  const formattedDate = new Date(d.timestamp).toLocaleString();

  state.tooltip
    .html(`
      <strong>Transaction Details</strong><br/>
      <b>From:</b> ${shortenAddress(d.source.id)}<br/>
      <b>To:</b> ${shortenAddress(d.target.id)}<br/>
      <b>Value:</b> ${formatCurrency(d.value)}<br/>
      <b>Time:</b> ${formattedDate}<br/>
      <b>Tx Hash:</b> ${shortenAddress(d.txHash)}
    `)
    .style('left', (event.pageX + 15) + 'px')
    .style('top', (event.pageY - 30) + 'px');
}

// Link hover out functionality
function handleLinkMouseOut(event) {
  d3.select(event.currentTarget)
    .attr('stroke', config.colors.linkDefault)
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 1.5);

  state.tooltip
    .transition()
    .duration(500)
    .style('opacity', 0);
}

// Node click functionality
function handleNodeClick(event, d) {
  state.selectedNode = d;
  showDetailPanel(d);

  // Highlight connected links and nodes (same as mouseover)
  handleNodeMouseOver(event, d);

  // Don't let the tooltip disappear when clicking
  state.tooltip
    .transition()
    .duration(0)
    .style('opacity', 0);
}

// Show details panel for selected node
function showDetailPanel(node) {
  detailPanel.style.display = 'block';

  // Update panel details
  traderAddressElement.textContent = node.id;
  traderTypeElement.innerHTML = `${node.type} <span class="badge badge-${node.type}">${node.type}</span>`;
  traderVolumeElement.textContent = formatCurrency(node.volume);

  // Count connected traders
  const connectedLinks = state.data.links.filter(
    l => l.source.id === node.id || l.target.id === node.id
  );

  const connectedTraders = new Set();
  connectedLinks.forEach(link => {
    if (link.source.id === node.id) {
      connectedTraders.add(link.target.id);
    } else {
      connectedTraders.add(link.source.id);
    }
  });

  connectedTradersElement.textContent = connectedTraders.size;

  // Generate mock transaction history
  generateTransactionHistory(node, connectedLinks);
}

// Generate transaction history for the detail panel
function generateTransactionHistory(node, connectedLinks) {
  transactionListElement.innerHTML = '';

  const transactions = connectedLinks.slice(0, 5); // Limit to 5 transactions

  if (transactions.length === 0) {
    transactionListElement.innerHTML = '<div class="transaction-item">No transactions found</div>';
    return;
  }

  transactions.forEach((tx, index) => {
    const isOutgoing = tx.source.id === node.id;
    const otherParty = isOutgoing ? tx.target.id : tx.source.id;
    const formattedDate = new Date(tx.timestamp).toLocaleString();

    const txElement = document.createElement('div');
    txElement.className = 'transaction-item';

    txElement.innerHTML = `
      <div class="transaction-item-header">
        <span class="tx-hash">${shortenAddress(tx.txHash)}</span>
        <span class="eth-value">${formatCurrency(tx.value)}</span>
      </div>
      <div>
        ${isOutgoing ? 'To' : 'From'}: <span class="address-truncated">${shortenAddress(otherParty)}</span>
      </div>
      <div>${formattedDate}</div>
    `;

    transactionListElement.appendChild(txElement);
  });
}

// Close detail panel
function closeDetailPanel() {
  detailPanel.style.display = 'none';
  state.selectedNode = null;

  // Reset node highlighting
  if (state.node) {
    state.node
      .attr('stroke-width', 1.5)
      .attr('fill-opacity', 0.8);

    state.link
      .attr('stroke', config.colors.linkDefault)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1.5);
  }
}

// Copy trader address to clipboard
function copyTraderAddress() {
  if (!state.selectedNode) return;

  navigator.clipboard.writeText(state.selectedNode.id)
    .then(() => {
      alert('Address copied to clipboard');
    })
    .catch(err => {
      console.error('Failed to copy address:', err);
    });
}

// View on Etherscan
function viewOnEtherscan() {
  if (!state.selectedNode) return;

  const url = `https://etherscan.io/address/${state.selectedNode.id}`;
  window.open(url, '_blank');
}

// Track wallet functionality
function trackWallet() {
  if (!state.selectedNode) return;

  // This would typically connect to a wallet tracking service
  // For demo purposes, we'll just show an alert
  alert(`Tracking wallet ${shortenAddress(state.selectedNode.id)}`);
}

// Show all links between nodes
function showAllLinks() {
  state.link
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 1.5);
}

// Hide all links between nodes
function hideAllLinks() {
  state.link
    .attr('stroke-opacity', 0);
}

// Cluster nodes by category (whale/retail)
function clusterByCategory() {
  if (!state.simulation) return;

  // Stop current simulation
  state.simulation.stop();

  // Define centers for each category
  const centers = {
    whale: { x: state.width * 0.25, y: state.height / 2 },
    retail: { x: state.width * 0.75, y: state.height / 2 }
  };

  // Update forces
  state.simulation
    .force('x', d3.forceX().x(d => centers[d.type].x).strength(0.5))
    .force('y', d3.forceY().y(d => centers[d.type].y).strength(0.5))
    .force('center', null)
    .alpha(1)
    .restart();
}

// Reset the visualization layout
function resetLayout() {
  if (!state.simulation) return;

  // Stop current simulation
  state.simulation.stop();

  // Reset forces to default
  state.simulation
    .force('x', null)
    .force('y', null)
    .force('center', d3.forceCenter(state.width / 2, state.height / 2))
    .alpha(1)
    .restart();
}

// Reset visualization when new data is fetched
function resetVisualization() {
  if (state.simulation) {
    state.simulation.stop();
    state.simulation = null;
  }

  state.data = null;
  state.link = null;
  state.node = null;
  state.selectedNode = null;
  state.zoomGroup.selectAll('*').remove();
}

// Handle window resize
function handleResize() {
  state.width = chartContainer.clientWidth;
  state.height = chartContainer.clientHeight;

  state.svg
    .attr('width', state.width)
    .attr('height', state.height);

  if (state.simulation) {
    state.simulation
      .force('center', d3.forceCenter(state.width / 2, state.height / 2))
      .alpha(0.3)
      .restart();
  }
}

// Helper function to shorten Ethereum addresses
function shortenAddress(address) {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

// Helper function to format currency values
function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

// Initialize the application on load
document.addEventListener('DOMContentLoaded', init);