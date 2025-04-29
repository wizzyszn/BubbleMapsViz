// ui.js
import { config } from './config.js';
import { state } from './state.js';
import { shortenAddress, formatCurrency } from './utils.js';
import { fetchTraderData } from './api.js';

// Place all DOM, event, and visualization logic here, refactored as needed.
// Export an initUI() function to initialize the UI and event listeners.

export function initUI() {
    // DOM Elements
    const tokenAddressInput = document.getElementById('tokenAddress');
    const timeFilterSelect = document.getElementById('timeFilter');
    const chainFilterSelect = document.getElementById('chainFilter');
    const tokenSelect = document.getElementById('tokenSelect');
    const searchButton = document.getElementById('searchButton');
    const chartContainer = document.getElementById('chart');
    const detailPanel = document.getElementById('detailPanel');
    const noDataMessage = document.querySelector('.no-data');
    const loader = document.querySelector('.loader');
    const toggleLinksButton = document.getElementById('toggleLinks');
    const clusterByCategoryButton = document.getElementById('clusterByCategory');
    const resetLayoutButton = document.getElementById('resetLayout');
    const closeDetailPanelButton = document.getElementById('closeDetailPanel');
    const traderAddressElement = document.getElementById('traderAddress');
    const traderTypeElement = document.getElementById('traderType');
    const traderVolumeElement = document.getElementById('traderVolume');
    const connectedTradersElement = document.getElementById('connectedTraders');
    const copyAddressButton = document.getElementById('copyAddressButton');
    const viewOnEtherscanButton = document.getElementById('viewOnEtherscan');
    const transactionListElement = document.getElementById('transactionList');

    // --- Initialization ---
    // Move handler function definitions above initialize
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
    function viewOnEtherscan() {
        if (!state.selectedNode) return;
        const chain = state.selectedChain;
        const explorer = config.explorers[chain] || config.explorers.eth;
        const url = `${explorer.baseUrl}/address/${state.selectedNode.id}`;
        window.open(url, '_blank');
    }

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

    function addZoomControls() {
        if (!document.getElementById('zoomInButton')) {
            const controlsContainer = document.querySelector('.chart-controls') || document.createElement('div');
            if (!controlsContainer.classList.contains('chart-controls')) {
                controlsContainer.className = 'chart-controls';
                chartContainer.parentNode.insertBefore(controlsContainer, chartContainer.nextSibling);
            }
            controlsContainer.innerHTML += `
        <button id="zoomInButton" class="control-button" title="Zoom In">+</button>
        <button id="zoomOutButton" class="control-button" title="Zoom Out">-</button>
        <button id="resetZoomButton" class="control-button" title="Reset Zoom">Reset</button>
      `;
            document.getElementById('zoomInButton').addEventListener('click', zoomIn);
            document.getElementById('zoomOutButton').addEventListener('click', zoomOut);
            document.getElementById('resetZoomButton').addEventListener('click', resetZoom);
        }
    }

    function initializeTokenSelection() {
        const defaultChain = 'eth';
        const defaultToken = 'Tether (USDT)';
        chainFilterSelect.value = defaultChain;
        updateTokenSelect(defaultChain);
        tokenSelect.value = defaultToken;
        tokenSelect.disabled = false;
        chainFilterSelect.addEventListener('change', (e) => {
            updateTokenSelect(e.target.value);
        });
        tokenSelect.addEventListener('change', (e) => {
            const selectedChain = chainFilterSelect.value;
            const tokenAddress = config.tokenData[selectedChain][e.target.value];
            searchButton.disabled = !tokenAddress;
        });
        if (config.tokenData[defaultChain][defaultToken]) {
            fetchAndRender();
        }
    }
    function updateTokenSelect(chain) {
        tokenSelect.innerHTML = '<option value="" disabled selected>Select Token</option>';
        if (chain && config.tokenData[chain]) {
            Object.keys(config.tokenData[chain]).forEach(token => {
                const option = document.createElement('option');
                option.value = token;
                option.textContent = token;
                tokenSelect.appendChild(option);
            });
            tokenSelect.disabled = false;
        } else {
            tokenSelect.disabled = true;
        }
    }

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

    async function fetchAndRender() {
        const selectedChain = chainFilterSelect.value;
        const selectedToken = tokenSelect.value;
        const timeFilter = timeFilterSelect.value;
        if (!selectedChain || !selectedToken) {
            alert('Please select both chain and token');
            return;
        }
        const tokenAddress = config.tokenData[selectedChain][selectedToken];
        state.selectedChain = selectedChain;
        resetVisualization();
        loader.style.display = 'block';
        noDataMessage.style.display = 'none';
        closeDetailPanel();
        viewOnEtherscanButton.textContent = `View on ${config.explorers[selectedChain]?.name || 'Explorer'}`;
        try {
            const data = await fetchTraderData(tokenAddress, timeFilter, selectedChain);
            if (data.message || data.nodes.length === 0) {
                noDataMessage.style.display = 'block';
                loader.style.display = 'none';
                return;
            }
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

    let linksVisible = true;
    function toggleLinks() {
        linksVisible = !linksVisible;
        if (linksVisible) {
            if (state.link) state.link.attr('stroke-opacity', 0.5).attr('stroke-width', 1.5);
            if (state.arrows) state.arrows.attr('opacity', 0.5);
            toggleLinksButton.textContent = 'Hide All Connections';
        } else {
            if (state.link) state.link.attr('stroke-opacity', 0);
            if (state.arrows) state.arrows.attr('opacity', 0);
            toggleLinksButton.textContent = 'Show All Connections';
        }
    }

    function clusterByCategory() {
        if (!state.simulation || !state.data) return;
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
    function resetLayout() {
        if (!state.simulation) return;
        state.simulation
            .force('x', null)
            .force('y', null)
            .force('center', d3.forceCenter(state.width / 2, state.height / 2))
            .alpha(1)
            .restart();
    }

    function initialize() {
        state.width = chartContainer.clientWidth;
        state.height = chartContainer.clientHeight;
        state.svg = d3.select(chartContainer)
            .append('svg')
            .attr('width', state.width)
            .attr('height', state.height);
        state.zoomGroup = state.svg.append('g').attr('class', 'zoom-group');
        state.zoom = d3.zoom().scaleExtent([0.1, 10]).on('zoom', handleZoom);
        state.svg.call(state.zoom);
        state.tooltip = d3.select('body').append('div').attr('class', 'tooltip').style('opacity', 0);
        searchButton.addEventListener('click', fetchAndRender);
        toggleLinksButton.addEventListener('click', toggleLinks);
        clusterByCategoryButton.addEventListener('click', clusterByCategory);
        resetLayoutButton.addEventListener('click', resetLayout);
        closeDetailPanelButton.addEventListener('click', closeDetailPanel);
        copyAddressButton.addEventListener('click', copyTraderAddress);
        viewOnEtherscanButton.addEventListener('click', viewOnEtherscan);
        addZoomControls();
        initializeTokenSelection();
        window.addEventListener('resize', handleResize);
        if (tokenAddressInput && tokenAddressInput.value.trim() && /^0x[a-fA-F0-9]{40}$/i.test(tokenAddressInput.value.trim())) {
            fetchAndRender();
        }
    }

    // --- D3 Drag Helper ---
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
            .filter(event => !event.ctrlKey && !event.button)
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }

    // --- D3 Event Handlers ---
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
    function handleLinkMouseOver(event, d) {
        d3.select(event.currentTarget)
            .attr('stroke', config.colors.linkHighlight)
            .attr('stroke-opacity', 1)
            .attr('stroke-width', 3);
        state.arrows
            .filter(arrow => arrow === d)
            .attr('fill', config.colors.linkHighlight)
            .attr('opacity', 1)
            .attr('transform', arrow => {
                const sourceX = arrow.source.x;
                const sourceY = arrow.source.y;
                const targetX = arrow.target.x;
                const targetY = arrow.target.y;
                const dx = targetX - sourceX;
                const dy = targetY - sourceY;
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const targetRadius = state.data.nodes.find(n => n.id === (typeof arrow.target === 'object' ? arrow.target.id : arrow.target))?.radius || 0;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offset = targetRadius + 10;
                const x = targetX - (dx * offset / distance);
                const y = targetY - (dy * offset / distance);
                const scale = state.zoomGroup.attr('transform') ?
                    1 / d3.zoomTransform(state.svg.node()).k : 1;
                return `translate(${x},${y}) rotate(${angle}) scale(${scale})`;
            });
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
              <b>From:</b> ${shortenAddress(sourceId)} ➜ ${shortenAddress(targetId)}<br/>
              <b>Value:</b> ${formattedValue}<br/>
              <b>Time:</b> ${formattedDate}
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 30) + 'px');
    }
    function handleLinkMouseOut(event, d) {
        d3.select(event.currentTarget)
            .attr('stroke', config.colors.linkDefault)
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 1.5);
        state.arrows
            .filter(arrow => arrow === d)
            .attr('fill', config.colors.linkDefault)
            .attr('opacity', 0.5);
        state.tooltip
            .transition()
            .duration(500)
            .style('opacity', 0);
    }
    function handleNodeClick(event, d) {
        state.selectedNode = d;
        showDetailPanel(d);
        handleNodeMouseOver(event, d);
        state.tooltip
            .transition()
            .duration(0)
            .style('opacity', 0);
    }
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
            .catch(err => {
                console.error('Failed to copy transaction hash:', err);
                alert('Failed to copy transaction hash');
            });
    }

    function processData(data) {
        const maxVolume = Math.max(...data.nodes.map(node => Math.abs(node.volume)));
        const nodes = data.nodes.map(node => {
            const sizeScale = d3.scaleLinear().domain([0, maxVolume]).range(config.nodeSizeRange);
            return { ...node, radius: sizeScale(Math.abs(node.volume)), color: node.type === 'whale' ? config.colors.whale : config.colors.retail };
        });
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const links = data.links.map(link => {
            const sourceNode = nodeMap.get(link.source);
            const targetNode = nodeMap.get(link.target);
            if (!sourceNode || !targetNode) return null;
            return { source: link.source, target: link.target, timestamp: link.timestamp, hash: link.hash, value: link.value };
        }).filter(link => link !== null);
        return { nodes, links };
    }
    function createVisualization() {
        state.zoomGroup.selectAll('*').remove();
        state.data.nodes.forEach(node => {
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos((2 * Math.random()) - 1);
            const radius = Math.random() * Math.min(state.width, state.height) / 4;
            node.x = state.width / 2 + radius * Math.sin(phi) * Math.cos(theta);
            node.y = state.height / 2 + radius * Math.sin(phi) * Math.sin(theta);
        });
        const linkLayer = state.zoomGroup.append('g').attr('class', 'links').lower();
        const arrowLayer = state.zoomGroup.append('g').attr('class', 'arrows');
        const nodeLayer = state.zoomGroup.append('g').attr('class', 'nodes');
        state.link = linkLayer.selectAll('line').data(state.data.links).enter().append('line')
            .attr('stroke', config.colors.linkDefault).attr('stroke-opacity', 0.5).attr('stroke-width', 1.5)
            .on('mouseover', handleLinkMouseOver).on('mouseout', handleLinkMouseOut);
        state.arrows = arrowLayer.selectAll('path').data(state.data.links).enter().append('path')
            .attr('fill', config.colors.linkDefault).attr('stroke', 'none').attr('d', 'M-5,-5L5,0L-5,5').attr('opacity', 0.5);
        state.node = nodeLayer.selectAll('circle').data(state.data.nodes).enter().append('circle')
            .attr('r', d => d.radius).attr('fill', d => d.color).attr('stroke', '#fff').attr('stroke-width', 1.5).attr('fill-opacity', 0.8)
            .call(drag(state.simulation)).on('mouseover', handleNodeMouseOver).on('mouseout', handleNodeMouseOut).on('click', handleNodeClick);
        state.simulation = d3.forceSimulation(state.data.nodes)
            .force('link', d3.forceLink(state.data.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(d => -100))
            .force('collide', d3.forceCollide().radius(d => d.radius + 10).strength(0.5))
            .force('radial', d3.forceRadial(Math.min(state.width, state.height) / 6, state.width / 2, state.height / 2).strength(0.1))
            .force('x', d3.forceX(state.width / 2).strength(0.05))
            .force('y', d3.forceY(state.height / 2).strength(0.05))
            .velocityDecay(0.4).alphaDecay(0.005).alpha(0.5).alphaMin(0.001)
            .on('tick', () => {
                state.data.nodes.forEach(d => {
                    d.x = Math.max(d.radius, Math.min(state.width - d.radius, d.x));
                    d.y = Math.max(d.radius, Math.min(state.height - d.radius, d.y));
                });
                state.link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                state.arrows.attr('transform', d => {
                    const sourceX = d.source.x;
                    const sourceY = d.source.y;
                    const targetX = d.target.x;
                    const targetY = d.target.y;
                    const dx = targetX - sourceX;
                    const dy = targetY - sourceY;
                    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                    const targetRadius = state.data.nodes.find(n => n.id === (typeof d.target === 'object' ? d.target.id : d.target))?.radius || 0;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const offset = targetRadius + 10;
                    const x = targetX - (dx * offset / distance);
                    const y = targetY - (dy * offset / distance);
                    return `translate(${x},${y}) rotate(${angle})`;
                });
                state.node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
            });
    }
    function handleZoom(event) {
        state.zoomGroup.attr('transform', event.transform);
        if (state.node) {
            state.node.attr('stroke-width', 1.5 / event.transform.k);
        }
        if (state.link) {
            state.link.attr('stroke-width', 1.5 / event.transform.k);
        }
        if (state.arrows) {
            state.arrows.attr('transform', d => {
                const sourceX = d.source.x;
                const sourceY = d.source.y;
                const targetX = d.target.x;
                const targetY = d.target.y;
                const dx = targetX - sourceX;
                const dy = targetY - sourceY;
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const targetRadius = state.data.nodes.find(n => n.id === (typeof d.target === 'object' ? d.target.id : d.target))?.radius || 0;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offset = (targetRadius + 10) / event.transform.k;
                const x = targetX - (dx * offset / distance);
                const y = targetY - (dy * offset / distance);
                const scale = 1 / event.transform.k;
                return `translate(${x},${y}) rotate(${angle}) scale(${scale})`;
            });
        }
    }
    function zoomIn() {
        state.svg.transition().duration(300).call(state.zoom.scaleBy, 1.3);
    }
    function zoomOut() {
        state.svg.transition().duration(300).call(state.zoom.scaleBy, 0.7);
    }
    function resetZoom() {
        state.svg.transition().duration(300).call(state.zoom.transform, d3.zoomIdentity);
    }
    // Initialize UI
    initialize();
}

