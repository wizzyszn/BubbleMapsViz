// Performance utilities
const utils = {
  debounce(fn, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  },
  
  throttle(fn, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Enhanced starfield effect
class StarField {
  constructor() {
    this.canvas = document.getElementById('stars');
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.stars = [];
    this.isInteracting = false;
    this.animationFrame = null;
    this.twinkleCounter = 0;
    
    this.init();
    this.setupEventListeners();
  }
  
  init() {
    this.resize();
    this.createStars();
    this.animate();
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  createStars() {
    const starCount = this.getOptimalStarCount();
    this.stars = [];
    
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 1.5 + 0.2,
        baseOpacity: Math.random() * 0.5 + 0.3,
        opacity: Math.random() * 0.5 + 0.3,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinkleDirection: Math.random() > 0.5 ? 1 : -1
      });
    }
  }
  
  getOptimalStarCount() {
    // Adjust star density based on screen size
    const area = this.canvas.width * this.canvas.height;
    return Math.min(Math.floor(area / 10000), 150);
  }
  
  setupEventListeners() {
    window.addEventListener('resize', utils.debounce(() => {
      this.resize();
      this.createStars();
    }, 200));
    
    window.addEventListener('mousedown', () => this.isInteracting = true);
    window.addEventListener('mouseup', () => this.isInteracting = false);
    window.addEventListener('touchstart', () => this.isInteracting = true);
    window.addEventListener('touchend', () => this.isInteracting = false);
  }
  
  animate() {
    if (!this.isInteracting) {
      this.twinkleCounter++;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.stars.forEach(star => {
        // Twinkle effect
        if (this.twinkleCounter % 3 === 0) {
          star.opacity += star.twinkleDirection * star.twinkleSpeed;
          
          if (star.opacity > star.baseOpacity + 0.3 || star.opacity < star.baseOpacity - 0.3) {
            star.twinkleDirection *= -1;
          }
        }
        
        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        this.ctx.fill();
      });
    }
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }
  
  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.stars = [];
  }
}

// Galaxy visualization
class GalaxyVisualizer {
  constructor() {
    this.currentData = null;
    this.simulation = null;
    this.svg = null;
    this.tooltip = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight - 120;
    this.isRendering = false;
    
    this.init();
  }
  
  init() {
    this.createTooltip();
    this.setupEventListeners();
    this.initializeFromUrl();
  }
  
  createTooltip() {
    this.tooltip = d3.select('body').selectAll('.tooltip').data([0]).join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
  }
  
  setupEventListeners() {
    document.getElementById('time-filter').addEventListener('change', () => this.updateMap());
    
    window.addEventListener('resize', utils.debounce(() => {
      if (this.currentData) {
        this.width = window.innerWidth;
        this.height = window.innerHeight - 120;
        
        if (this.svg) {
          this.svg.attr('width', this.width).attr('height', this.height);
          
          if (this.simulation) {
            this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
            this.simulation.alpha(0.1).restart();
          }
        }
      }
    }, 200));
  }
  
  initializeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const address = urlParams.get('address') || '0xdac17f958d2ee523a2206206994597c13d831ec7';
    this.renderMap(address);
  }
  
  async fetchTraderData(address, timeFilter = 'all') {
    try {
      console.log(`Fetching data for address: ${address}, time: ${timeFilter}`);
      const res = await fetch(`/api/traders?address=${address}&time=${timeFilter}`);
      
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      
      return await res.json();
    } catch (error) {
      console.error('Fetch error:', error);
      return { nodes: [], links: [], message: 'Failed to load trader data.' };
    }
  }
  
  updateMap() {
    if (this.isRendering) return;
    
    const timeFilter = document.getElementById('time-filter').value;
    const urlParams = new URLSearchParams(window.location.search);
    const address = urlParams.get('address') || '0xdac17f958d2ee523a2206206994597c13d831ec7';
    
    console.log('Updating with time filter:', timeFilter);
    this.renderMap(address, timeFilter);
  }
  
  async renderMap(address, timeFilter = 'all') {
    if (this.isRendering) return;
    this.isRendering = true;
    
    // Clean up previous visualization
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    
    const chart = d3.select('#chart');
    chart.selectAll('*').remove();
    
    // Add loading indicator
    chart
      .append('div')
      .attr('id', 'loading')
      .html('<div class="spinner"></div><span>Mapping Galaxy...</span>');
    
    // Fetch data
    const data = await this.fetchTraderData(address, timeFilter);
    chart.select('#loading').remove();
    this.currentData = data;
    
    if (data.nodes.length === 0) {
      chart
        .append('div')
        .attr('class', 'no-data')
        .html(`<span>${data.message || 'No trader data available.'}</span>`);
        
      this.isRendering = false;
      return;
    }
    
    this.createVisualization(data);
    this.isRendering = false;
  }
  
  createVisualization(data) {
    // Create SVG
    this.svg = d3.select('#chart')
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'galaxy-svg');
    
    // Add gradients and effects
    this.addDefinitions();
    
    // Initialize simulation with optimized parameters
    this.simulation = d3
      .forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id(d => d.id)
        .distance(d => 80 + Math.sqrt(d.source.volume + d.target.volume) / 5000)
        .strength(0.2))
      .force('charge', d3.forceManyBody()
        .strength(d => -100 - Math.sqrt(d.volume) / 500)
        .distanceMax(300))
      .force('collision', d3.forceCollide()
        .radius(d => Math.sqrt(d.volume) / 1000 * 15 + 5)
        .strength(0.8))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .alphaDecay(0.028)
      .velocityDecay(0.4);
    
    // Create links
    const link = this.svg
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke-width', d => Math.log(d.value || 1) / 2 + 0.5);
    
    // Create node groups
    const nodeGroup = this.svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', 'node-group');
    
    // Add orbits
    nodeGroup
      .append('circle')
      .attr('class', d => `orbit orbit-${d.type}`)
      .attr('r', d => Math.sqrt(d.volume) / 1000 * 25 + 10);
    
    // Add glow effect
    nodeGroup
      .append('circle')
      .attr('class', d => `glow glow-${d.type}`)
      .attr('r', d => Math.sqrt(d.volume) / 1000 * 17 + 2);
    
    // Add nodes
    const node = nodeGroup
      .append('circle')
      .attr('class', d => `node ${d.type}`)
      .attr('r', d => Math.sqrt(d.volume) / 1000 * 15 + 3)
      .call(this.drag());
    
    // Add tooltips
    this.addTooltipEvents(node);
    
    // Add info panel interactions
    this.addInfoPanelEvents(node, this.svg);
    
    // Update positions on simulation tick
    this.simulation.on('tick', () => {
      // Limit node positions to SVG boundaries with padding
      data.nodes.forEach(d => {
        const r = Math.sqrt(d.volume) / 1000 * 15 + 10;
        d.x = Math.max(r, Math.min(this.width - r, d.x));
        d.y = Math.max(r, Math.min(this.height - r, d.y));
      });
      
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Add zoom functionality
    this.svg.call(
      d3.zoom()
        .scaleExtent([0.2, 5])
        .on('zoom', event => {
          this.svg.selectAll('g').attr('transform', event.transform);
        })
    );
    
    // Stop simulation after 2 seconds for performance
    setTimeout(() => {
      if (this.simulation) {
        this.simulation.alphaTarget(0).alphaDecay(0.05);
      }
    }, 2000);
  }
  
  addDefinitions() {
    const defs = this.svg.append('defs');
    
    // Add a filter for the glow effect
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('height', '300%')
      .attr('width', '300%')
      .attr('x', '-100%')
      .attr('y', '-100%');
      
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '5')
      .attr('result', 'coloredBlur');
      
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    
    // Whale gradient
    const whaleGradient = defs
      .append('radialGradient')
      .attr('id', 'whale-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%')
      .attr('fx', '50%')
      .attr('fy', '50%');
      
    whaleGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#ff00ff');
    
    whaleGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#800080');
    
    // Retail gradient
    const retailGradient = defs
      .append('radialGradient')
      .attr('id', 'retail-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%')
      .attr('fx', '50%')
      .attr('fy', '50%');
      
    retailGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#00ffff');
    
    retailGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#0066cc');
      
    // Link gradient
    const linkGradient = defs
      .append('linearGradient')
      .attr('id', 'link-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
      
    linkGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#00ccff');
      
    linkGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#8a2be2');
      
    linkGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#00ccff');
  }
  
  addTooltipEvents(node) {
    const updateTooltip = utils.throttle((event, d) => {
      this.tooltip
        .style('opacity', 1)
        .html(`
          <div class="tooltip-header ${d.type}">Trader Info</div>
          <div class="tooltip-content">
            <div>Address: ${d.id.slice(0, 6)}...${d.id.slice(-4)}</div>
            <div>Type: ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}</div>
            <div>Volume: ${d.volume.toLocaleString()}</div>
          </div>
        `)
        .style('left', `${event.pageX + 15}px`)
        .style('top', `${event.pageY - 30}px`);
    }, 30);
    
    node
      .on('mouseover', function(event, d) {
        d3.select(this.parentNode).raise();
        updateTooltip(event, d);
      })
      .on('mousemove', function(event, d) {
        updateTooltip(event, d);
      })
      .on('mouseout', () => {
        this.tooltip.style('opacity', 0);
      });
  }
  
  addInfoPanelEvents(node, svg) {
    const infoPanel = d3.select('#info-content');
    
    node.on('click', function(event, d) {
      // Highlight selected node
      d3.selectAll('.node-group').classed('selected', false);
      d3.select(this.parentNode).classed('selected', true);
      
      infoPanel.html(`
        <div class="info-item"><span>Address:</span> ${d.id.slice(0, 6)}...${d.id.slice(-4)}</div>
        <div class="info-item"><span>Type:</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}</div>
        <div class="info-item"><span>Volume:</span> ${d.volume.toLocaleString()}</div>
        <div class="info-item"><span>Connections:</span> ${d.connections || 'Unknown'}</div>
      `);
      
      event.stopPropagation();
    });
    
    svg.on('click', () => {
      d3.selectAll('.node-group').classed('selected', false);
      infoPanel.html('<div class="info-hint">Click a node to view details</div>');
    });
  }
  
  drag() {
    const simulation = this.simulation;
    
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      
      // Highlight the dragged node
      d3.select(this.parentNode).classed('dragging', true);
    }
    
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      
      // Remove highlight
      d3.select(this.parentNode).classed('dragging', false);
    }
    
    return d3
      .drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  const starField = new StarField();
  const galaxyVisualizer = new GalaxyVisualizer();
  
  // Add theme toggle if needed
  const toggleTheme = () => {
    document.body.classList.toggle('light-theme');
  };
  
  // Create settings menu if needed
  const createSettingsMenu = () => {
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'settings-btn';
    settingsBtn.innerHTML = '⚙️';
    document.body.appendChild(settingsBtn);
    
    settingsBtn.addEventListener('click', () => {
      // Implementation for settings menu
    });
  };
});