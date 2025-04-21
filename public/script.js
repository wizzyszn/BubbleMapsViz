const config = {
  apiUrl: '/api/traders',
  nodeSizeRange: [10, 50],
  colors: {
    whale: '#ff6b8b',
    retail: '#4ade80',
    linkDefault: '#8b95a8',
    linkHighlight: '#3a6df0'
  },
  // Added explorer URLs for different chains
  explorers: {
    eth: { name: 'Etherscan', baseUrl: 'https://etherscan.io' },
    avax: { name: 'Snowtrace', baseUrl: 'https://snowtrace.io' },
    base: { name: 'Basescan', baseUrl: 'https://basescan.org' },
    bnb: { name: 'BscScan', baseUrl: 'https://bscscan.com' },
    arbi: { name: 'Arbiscan', baseUrl: 'https://arbiscan.io' },
    poly: { name: 'PolygonScan', baseUrl: 'https://polygonscan.com' },
    opt: { name: 'Optimism Explorer', baseUrl: 'https://optimistic.etherscan.io' },
    sonic: { name: 'Sonic Explorer', baseUrl: 'https://explorer.sonic.network' } // Adjust if Sonic has a different explorer
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
  height: 0,
  selectedChain: 'eth' // Added to track selected chain
};

// DOM Elements
const tokenAddressInput = document.getElementById('tokenAddress');
const timeFilterSelect = document.getElementById('timeFilter');
const chainFilterSelect = document.getElementById('chainFilter'); // Added chain filter
const searchButton = document.getElementById('searchButton');
const chartContainer = document.getElementById('chart');
const detailPanel = document.getElementById('detailPanel');
const noDataMessage = document.querySelector('.no-data');
const loader = document.querySelector('.loader');

// Control buttons
const showAllLinksButton = document.getElementById('showAllLinks');
const hideAllLinksButton = document.getElementById('hideAllLinks');
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
    .scaleExtent([0.1, 10])
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

  // Initial data fetch if token address is valid
  if (tokenAddressInput.value.trim() && /^0x[a-fA-F0-9]{40}$/i.test(tokenAddressInput.value.trim())) {
    fetchTraderData();
  }
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

  if (state.node) {
    state.node.attr('stroke-width', 1.5 / event.transform.k);
  }

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
  const chain = chainFilterSelect.value; // Added chain filter value
  state.selectedChain = chain; // Store selected chain

  if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/i.test(tokenAddress)) {
    alert('Please enter a valid token contract address');
    return;
  }

  // Reset and show loader
  resetVisualization();
  loader.style.display = 'block';
  noDataMessage.style.display = 'none';
  closeDetailPanel();
  viewOnEtherscanButton.textContent = `View on ${config.explorers[chain]?.name || 'Explorer'}`;
  try {
    // Updated API call to include chain parameter
    const response = await fetch(`${config.apiUrl}?address=${tokenAddress}&time=${timeFilter}&chain=${chain}`);

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
  const maxVolume = Math.max(...data.nodes.map(node => Math.abs(node.volume)));

  const nodes = data.nodes.map(node => {
    const sizeScale = d3.scaleLinear()
      .domain([0, maxVolume])
      .range(config.nodeSizeRange);

    return {
      ...node,
      radius: sizeScale(Math.abs(node.volume)),
      color: node.type === 'whale' ? config.colors.whale : config.colors.retail
    };
  });

  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  const links = data.links.map(link => {
    const sourceNode = nodeMap.get(link.source);
    const targetNode = nodeMap.get(link.target);
    
    if (!sourceNode || !targetNode) return null;
    
    return {
      source: link.source,
      target: link.target,
      timestamp: link.timestamp,
      hash: link.hash,
      value: link.value
    };
  }).filter(link => link !== null);

  return { nodes, links };
}

// Create the force-directed visualization
function createVisualization() {
  state.zoomGroup.selectAll('*').remove();

  state.simulation = d3.forceSimulation(state.data.nodes)
    .force('link', d3.forceLink(state.data.links)
      .id(d => d.id)
      .distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(state.width / 2, state.height / 2))
    .force('collide', d3.forceCollide().radius(d => d.radius + 5))
    .on('tick', ticked);

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
  state.data.nodes.forEach(d => {
    d.x = Math.max(d.radius, Math.min(state.width - d.radius, d.x));
    d.y = Math.max(d.radius, Math.min(state.height - d.radius, d.y));
  });

  state.link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  state.node
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  state.zoomGroup.selectAll('.labels text')
    .attr('x', d => d.x)
    .attr('y', d => d.y);
}

// Drag functionality
function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
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
    .filter(event => !event.ctrlKey && !event.button)
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

// Node hover functionality
function handleNodeMouseOver(event, d) {
  state.link
    .attr('stroke', l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return (sourceId === d.id || targetId === d.id)
        ? config.colors.linkHighlight : config.colors.linkDefault;
    })
    .attr('stroke-opacity', l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return (sourceId === d.id || targetId === d.id) ? 0.8 : 0.2;
    })
    .attr('stroke-width', l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return (sourceId === d.id || targetId === d.id) ? 2.5 : 1;
    });

  state.node
    .attr('stroke-width', n => {
      const isConnected = state.data.links.some(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return (sourceId === d.id && targetId === n.id) ||
              (targetId === d.id && sourceId === n.id);
      });
      return n.id === d.id || isConnected ? 3 : 1.5;
    })
    .attr('fill-opacity', n => {
      const isConnected = state.data.links.some(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return (sourceId === d.id && targetId === n.id) ||
              (targetId === d.id && sourceId === n.id);
      });
      return n.id === d.id || isConnected ? 1 : 0.3;
    });

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
  state.link
    .attr('stroke', config.colors.linkDefault)
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 1.5);

  state.node
    .attr('stroke-width', 1.5)
    .attr('fill-opacity', 0.8);

  state.tooltip
    .transition()
    .duration(500)
    .style('opacity', 0);
}

// Link hover functionality
function handleLinkMouseOver(event, d) {
  d3.select(event.currentTarget)
    .attr('stroke', config.colors.linkHighlight)
    .attr('stroke-opacity', 1)
    .attr('stroke-width', 3);

  state.tooltip
    .transition()
    .duration(200)
    .style('opacity', 0.9);

  const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
  const targetId = typeof d.target === 'object' ? d.target.id : d.target;
  const formattedDate = d.timestamp ? new Date(d.timestamp).toLocaleString() : 'Unknown date';
  const formattedValue = d.value ? formatCurrency(d.value) : 'Unknown value';

  state.tooltip
    .html(`
      <strong>Transaction Details</strong><br/>
      <b>Tx Hash:</b> ${shortenAddress(d.hash || 'Unknown')}<br/>
      <b>From:</b> ${shortenAddress(sourceId)}<br/>
      <b>To:</b> ${shortenAddress(targetId)}<br/>
      <b>Value:</b> ${formattedValue}<br/>
      <b>Time:</b> ${formattedDate}
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
  handleNodeMouseOver(event, d);
  state.tooltip
    .transition()
    .duration(0)
    .style('opacity', 0);
}

// Show details panel for selected node
function showDetailPanel(node) {
  detailPanel.style.display = 'block';
  traderAddressElement.textContent = node.id;
  traderTypeElement.innerHTML = `${node.type} <span class="badge badge-${node.type}">${node.type}</span>`;
  traderVolumeElement.textContent = formatCurrency(node.volume);

  const connectedLinks = state.data.links.filter(l => {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    return sourceId === node.id || targetId === node.id;
  });

  const connectedTraders = new Set();
  connectedLinks.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (sourceId === node.id) {
      connectedTraders.add(targetId);
    } else {
      connectedTraders.add(sourceId);
    }
  });

  connectedTradersElement.textContent = connectedTraders.size;
  displayTransactions(node, connectedLinks);
}

// Display transaction data for the detail panel
function displayTransactions(node, connectedLinks) {
  transactionListElement.innerHTML = '';

  if (node.transactions && node.transactions.length > 0) {
    const transactions = node.transactions.slice(0, 5);
    
    transactions.forEach(tx => {
      const txElement = document.createElement('div');
      txElement.className = 'transaction-item';
      const formattedDate = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Unknown date';
      
      txElement.innerHTML = `
        <div class="transaction-item-header">
          <span class="tx-hash">${shortenAddress(tx.hash || 'Unknown')}</span>
          <button class="copy-tx-button" data-hash="${tx.hash || ''}" title="Copy Transaction Hash">📋</button>
          <span class="eth-value">${tx.value ? formatCurrency(tx.value) : 'Unknown value'}</span>
        </div>
        <div>${formattedDate}</div>
      `;
      
      transactionListElement.appendChild(txElement);
    });

    transactionListElement.querySelectorAll('.copy-tx-button').forEach(button => {
      button.addEventListener('click', copyTransactionHash);
    });
  } else {
    const visibleLinks = connectedLinks.slice(0, 5);
    
    if (visibleLinks.length === 0) {
      transactionListElement.innerHTML = '<div class="transaction-item">No transaction data available</div>';
      return;
    }
    
    visibleLinks.forEach((link, index) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const isOutgoing = sourceId === node.id;
      const otherParty = isOutgoing ? targetId : sourceId;
      
      const txElement = document.createElement('div');
      txElement.className = 'transaction-item';
      
      txElement.innerHTML = `
        <div class="transaction-item-header">
          <span class="tx-hash">Link #${index + 1}</span>
        </div>
        <div>
          ${isOutgoing ? 'To' : 'From'}: <span class="address-truncated">${shortenAddress(otherParty)}</span>
        </div>
      `;
      
      transactionListElement.appendChild(txElement);
    });
  }
}

// Copy transaction hash to clipboard
function copyTransactionHash(event) {
  const txHash = event.target.dataset.hash;
  if (!txHash) {
    alert('No transaction hash available to copy');
    return;
  }

  navigator.clipboard.writeText(txHash)
    .then(() => {
      alert('Transaction hash copied to clipboard');
    })
   we.catch(err => {
      console.error('Failed to copy transaction hash:', err);
      alert('Failed to copy transaction hash');
    });
}

// Close detail panel
function closeDetailPanel() {
  detailPanel.style.display = 'none';
  state.selectedNode = null;

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

// View on blockchain explorer (updated for multi-chain)
function viewOnEtherscan() {
  if (!state.selectedNode) return;

  const chain = state.selectedChain;
  const explorer = config.explorers[chain] || config.explorers.eth; // Fallback to Etherscan
  const url = `${explorer.baseUrl}/address/${state.selectedNode.id}`;
  window.open(url, '_blank');
}

// Track wallet functionality (updated for multi-chain)
function trackWallet() {
  if (!state.selectedNode) return;

  const chain = state.selectedChain;
  const explorer = config.explorers[chain] || config.explorers.eth; // Fallback to Etherscan
  const url = `${explorer.baseUrl}/tokentxns?a=${state.selectedNode.id}`;
  window.open(url, '_blank');
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

  state.simulation.stop();

  const centers = {
    whale: { x: state.width * 0.25, y: state.height / 2 },
    retail: { x: state.width * 0.75, y: state.height / 2 }
  };

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

  state.simulation.stop();

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
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(value);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

// Initialize the application on load
document.addEventListener('DOMContentLoaded', init);