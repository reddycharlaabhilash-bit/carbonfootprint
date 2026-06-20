/**
 * EcoTrace — Carbon Footprint Tracker Core Engine
 * Hand-coded responsive metrics, SVG trend engine, and Canvas Eco-Garden simulation.
 */

// --- CARBON FACTORS AND CALCULATIONS ---
const CARBON_FACTORS = {
  transport: {
    'car-gas': 0.404,  // kg CO2 per mile (US average passenger car)
    'car-ev': 0.098,   // kg CO2 per mile (based on grid charging)
    'transit': 0.082,  // kg CO2 per mile
    'bike-walk': 0.000  // Clean energy
  },
  diet: {
    'heavy-meat': 8.0,  // kg CO2 per day
    'balanced': 5.0,    // kg CO2 per day (average meat/veg)
    'vegetarian': 2.5,  // kg CO2 per day
    'vegan': 1.5        // kg CO2 per day
  },
  energy: {
    hourHeatingCooling: 1.2, // kg CO2 per hour of AC or heat
    laundryHighHeat: 0.8,    // kg CO2 per wash load
    tumbleDryer: 1.8         // kg CO2 per dryer cycle
  },
  waste: {
    bagGarbage: 1.5, // kg CO2 per bag
    recycling: {
      'none': 0.5,   // penalty for zero sorting
      'some': -0.5,  // deduction
      'full': -1.5   // deep deduction
    }
  }
};

// --- DEFAULT STATE FOR PERSISTENCE ---
const DEFAULT_STATE = {
  level: 1,
  points: 120,
  dailyBudget: 15.0,
  today: {
    transport: { type: 'car-gas', distance: 10, logged: false, co2: 4.04 },
    diet: { type: 'balanced', logged: false, co2: 5.0 },
    energy: { hours: 2, laundry: false, dryer: false, logged: false, co2: 2.4 },
    waste: { recycling: 'some', bags: 1, logged: false, co2: 1.0 }
  },
  history: [
    { day: 'Sun', co2: 12.8 },
    { day: 'Mon', co2: 14.5 },
    { day: 'Tue', co2: 9.8 },
    { day: 'Wed', co2: 11.2 },
    { day: 'Thu', co2: 8.6 },
    { day: 'Fri', co2: 13.2 },
    { day: 'Sat', co2: 12.48 } // Sat will be updated dynamically with today's values
  ],
  challenges: [
    { id: 'c1', title: 'Meatless Day', desc: 'Eat fully plant-based meals today.', points: 30, co2Saved: 3.5, completed: false, category: 'diet' },
    { id: 'c2', title: 'Active Commute', desc: 'Walk or bike instead of driving today.', points: 40, co2Saved: 4.0, completed: false, category: 'transport' },
    { id: 'c3', title: 'Cold-Wash Cycle', desc: 'Wash your clothes with cold water only.', points: 20, co2Saved: 0.8, completed: false, category: 'energy' },
    { id: 'c4', title: 'Zero Standby Power', desc: 'Unplug all unused chargers and electronics.', points: 15, co2Saved: 0.5, completed: false, category: 'energy' },
    { id: 'c5', title: 'Zero Landfill', desc: 'Compost scraps and recycle everything possible.', points: 30, co2Saved: 1.5, completed: false, category: 'waste' },
    { id: 'c6', title: 'Rideshare & Rail', desc: 'Take public transit or carpool for all trips.', points: 35, co2Saved: 2.8, completed: false, category: 'transport' }
  ],
  gardenWeather: 'day', // 'day' or 'night'
  totalSavedCo2: 24.3 // Aggregated savings across past actions
};

// Global application state
let state = {};

// Canvas Renderers storage
let miniGardenAnim = null;
let fullGardenAnim = null;

// --- STATE MANAGEMENT ---
function loadState() {
  const saved = localStorage.getItem('ecotrace_state');
  if (saved) {
    try {
      state = JSON.parse(saved);
      updateTodayHistory();
    } catch (e) {
      console.error('Error loading state from localStorage:', e);
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } else {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
  }
}

function saveState() {
  localStorage.setItem('ecotrace_state', JSON.stringify(state));
}

function updateTodayHistory() {
  const todayTotal = calculateTodayTotal();
  const satIndex = state.history.findIndex(h => h.day === 'Sat');
  if (satIndex !== -1) {
    state.history[satIndex].co2 = parseFloat(todayTotal.toFixed(2));
  }
}

// --- CALCULATION LOGIC ---
function calculateLiveEstimate(tab) {
  let co2 = 0;
  if (tab === 'tab-transport') {
    const commuteType = document.querySelector('input[name="commute-type"]:checked').value;
    const distance = parseFloat(document.getElementById('commute-distance').value);
    co2 = distance * CARBON_FACTORS.transport[commuteType];
  } else if (tab === 'tab-diet') {
    const mealType = document.querySelector('input[name="meal-type"]:checked').value;
    co2 = CARBON_FACTORS.diet[mealType];
  } else if (tab === 'tab-energy') {
    const hours = parseFloat(document.getElementById('energy-hours').value);
    const laundry = document.getElementById('appliances-laundry').checked;
    const dryer = document.getElementById('appliances-dryer').checked;
    
    co2 = hours * CARBON_FACTORS.energy.hourHeatingCooling;
    if (laundry) co2 += CARBON_FACTORS.energy.laundryHighHeat;
    if (dryer) co2 += CARBON_FACTORS.energy.tumbleDryer;
  } else if (tab === 'tab-waste') {
    const recycling = document.querySelector('input[name="recycling"]:checked').value;
    const bags = parseFloat(document.getElementById('waste-bags').value);
    
    co2 = bags * CARBON_FACTORS.waste.bagGarbage;
    co2 += CARBON_FACTORS.waste.recycling[recycling];
  }
  return Math.max(0, co2);
}

function calculateTodayTotal() {
  return state.today.transport.co2 + state.today.diet.co2 + state.today.energy.co2 + state.today.waste.co2;
}

function getCategoryColor(category) {
  switch (category) {
    case 'transport': return 'var(--color-transport)';
    case 'diet': return 'var(--color-emerald)';
    case 'energy': return 'var(--color-warning)';
    case 'waste': return 'var(--color-waste)';
    default: return 'var(--color-mint)';
  }
}

// --- DOM RENDERERS ---
function renderDashboard() {
  const todayTotal = calculateTodayTotal();
  const savings = Math.max(0, (state.dailyBudget - todayTotal));
  
  // Update gauge text
  document.getElementById('today-emissions-val').innerText = todayTotal.toFixed(1);
  document.getElementById('net-savings-val').innerText = savings.toFixed(1) + ' kg';
  document.getElementById('total-co2-saved').innerText = state.totalSavedCo2.toFixed(1) + ' kg';
  
  // Radial progress gauge math (Circumference = 2 * PI * r = 251.2)
  const limit = state.dailyBudget;
  const percentage = Math.min(100, (todayTotal / limit) * 100);
  const strokeDashoffset = 251.2 - (251.2 * percentage) / 100;
  
  const gaugeFill = document.getElementById('emissions-gauge-fill');
  gaugeFill.setAttribute('stroke-dashoffset', strokeDashoffset);
  
  // Set gradient based on carbon budget status
  const budgetStatus = document.getElementById('budget-status');
  if (todayTotal <= limit * 0.8) {
    budgetStatus.innerText = 'Under Budget';
    budgetStatus.className = 'badge badge-mint';
    gaugeFill.style.stroke = 'var(--color-mint)';
  } else if (todayTotal <= limit) {
    budgetStatus.innerText = 'Nearing Budget';
    budgetStatus.className = 'badge';
    budgetStatus.style.borderColor = 'var(--color-warning)';
    budgetStatus.style.color = 'var(--color-warning)';
    gaugeFill.style.stroke = 'var(--color-warning)';
  } else {
    budgetStatus.innerText = 'Budget Exceeded';
    budgetStatus.className = 'badge badge-danger';
    gaugeFill.style.stroke = 'var(--color-danger)';
  }
  
  // Update Level and Points
  document.getElementById('user-level-val').innerText = state.level;
  
  // Render categories progress cards
  updateCategoryCard('transport', state.today.transport.co2, 6.0);
  updateCategoryCard('diet', state.today.diet.co2, 6.0);
  updateCategoryCard('energy', state.today.energy.co2, 6.0);
  updateCategoryCard('waste', state.today.waste.co2, 4.0);
  
  // Mini garden labeling
  const miniGardenLbl = document.getElementById('garden-growth-lbl');
  if (state.totalSavedCo2 < 10) {
    miniGardenLbl.innerText = 'Planted Seeds';
  } else if (state.totalSavedCo2 < 25) {
    miniGardenLbl.innerText = 'Sprouting Garden';
  } else if (state.totalSavedCo2 < 50) {
    miniGardenLbl.innerText = 'Flourishing Meadow';
  } else {
    miniGardenLbl.innerText = 'Verdant Forest Canopy';
  }
  
  // Weather HUD text
  const weatherBadge = document.getElementById('garden-weather-badge');
  if (state.gardenWeather === 'day') {
    weatherBadge.innerHTML = '<i data-lucide="sun"></i> Sunny Day';
  } else {
    weatherBadge.innerHTML = '<i data-lucide="moon"></i> Midnight Glow';
  }
  
  // Render widgets
  renderHistoryChart();
  renderQuickChallenges();
  renderFullChallenges();
  renderInsights();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function updateCategoryCard(id, value, baseline) {
  document.getElementById(`cat-${id}-val`).innerText = value.toFixed(1);
  const percentOfBudget = ((value / state.dailyBudget) * 100).toFixed(0);
  document.getElementById(`cat-${id}-percent`).innerText = `${percentOfBudget}% of budget`;
  
  const fillWidth = Math.min(100, (value / baseline) * 100);
  document.getElementById(`cat-${id}-bar`).style.width = `${fillWidth}%`;
}

// --- DYNAMIC SVG CHART GENERATOR ---
function renderHistoryChart() {
  const container = document.getElementById('svg-chart-container');
  if (!container) return;
  
  const width = container.clientWidth || 500;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const data = state.history;
  const maxCo2 = Math.max(...data.map(d => d.co2), state.dailyBudget, 16);
  
  // Grid lines
  let gridLinesHtml = '';
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = (maxCo2 / yTicks) * i;
    const y = paddingTop + chartHeight - (val / maxCo2) * chartHeight;
    gridLinesHtml += `
      <line class="chart-grid-line" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />
      <text class="chart-axis-label" x="${paddingLeft - 10}" y="${y + 4}" text-anchor="end">${val.toFixed(0)}</text>
    `;
  }
  
  // Draw Budget Guideline Line
  const budgetY = paddingTop + chartHeight - (state.dailyBudget / maxCo2) * chartHeight;
  const budgetLineHtml = `
    <line x1="${paddingLeft}" y1="${budgetY}" x2="${width - paddingRight}" y2="${budgetY}" stroke="var(--color-danger)" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6" />
    <text x="${width - paddingRight - 10}" y="${budgetY - 5}" fill="var(--color-danger)" font-size="9" font-family="var(--font-mono)" text-anchor="end">Limit (${state.dailyBudget}kg)</text>
  `;
  
  // Compute points coordinates
  const points = data.map((d, index) => {
    const x = paddingLeft + (chartWidth / (data.length - 1)) * index;
    const y = paddingTop + chartHeight - (d.co2 / maxCo2) * chartHeight;
    return { x, y, day: d.day, val: d.co2 };
  });
  
  // Generate Path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  let areaD = `M ${points[0].x} ${paddingTop + chartHeight} L ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
    areaD += ` L ${points[i].x} ${points[i].y}`;
  }
  areaD += ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} Z`;
  
  // Markers & interaction nodes
  let dotsHtml = '';
  let dayLabelsHtml = '';
  points.forEach((p, index) => {
    dotsHtml += `
      <circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="5" 
              onmouseover="showChartTooltip(event, '${p.day}', ${p.val})" 
              onmouseout="hideChartTooltip()" />
    `;
    
    dayLabelsHtml += `
      <text class="chart-axis-label" x="${p.x}" y="${height - 10}" text-anchor="middle">${p.day}</text>
    `;
  });
  
  container.innerHTML = `
    <svg class="chart-svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-mint)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--color-mint)" stop-opacity="0.0"/>
        </linearGradient>
        <linearGradient id="gauge-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--color-emerald)"/>
          <stop offset="100%" stop-color="var(--color-mint)"/>
        </linearGradient>
      </defs>
      
      <!-- Grid -->
      ${gridLinesHtml}
      ${dayLabelsHtml}
      ${budgetLineHtml}
      
      <!-- Filled Area -->
      <path class="chart-area" d="${areaD}" />
      
      <!-- Line -->
      <path class="chart-line" d="${pathD}" />
      
      <!-- Interactive Dots -->
      ${dotsHtml}
      
      <!-- Tooltip Group -->
      <g id="chart-tooltip" class="chart-tooltip-group">
        <rect class="chart-tooltip-bg" width="76" height="30" rx="6" />
        <text id="chart-tooltip-text" class="chart-tooltip-text" x="38" y="19" text-anchor="middle">12.5 kg</text>
      </g>
    </svg>
  `;
}

window.showChartTooltip = function(event, day, val) {
  const tooltip = document.getElementById('chart-tooltip');
  const tooltipText = document.getElementById('chart-tooltip-text');
  if (!tooltip || !tooltipText) return;
  
  const rect = event.target.getBoundingClientRect();
  const svgRect = event.target.ownerSVGElement.getBoundingClientRect();
  
  const x = rect.left - svgRect.left - 38 + 5; 
  const y = rect.top - svgRect.top - 38;
  
  tooltipText.textContent = `${val.toFixed(1)} kg`;
  tooltip.setAttribute('transform', `translate(${x}, ${y})`);
  tooltip.style.opacity = 1;
};

window.hideChartTooltip = function() {
  const tooltip = document.getElementById('chart-tooltip');
  if (tooltip) tooltip.style.opacity = 0;
};

// --- ECO-GARDEN CANVAS SIMULATOR ---
class GardenSimulation {
  constructor(canvasId, isMini = false) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    this.isMini = isMini;
    
    this.resize();
    this.init();
    
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.parentElement.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }
  
  init() {
    this.plants = [];
    this.particles = [];
    this.clouds = [];
    
    // Scale plant size with carbon reduction score
    const plantCount = Math.min(7, Math.max(2, Math.floor(state.totalSavedCo2 / 10) + 2));
    
    for (let i = 0; i < plantCount; i++) {
      const spacing = this.width / (plantCount + 1);
      const x = spacing * (i + 1) + (Math.random() * 15 - 7.5);
      const maxTreeHeight = this.isMini ? 40 : 120;
      const height = (maxTreeHeight * 0.5) + (Math.random() * (maxTreeHeight * 0.5));
      const plantType = i % 3; // 0 = standard tree, 1 = pine, 2 = shrub/flower
      
      this.plants.push({
        x: x,
        y: this.height - 15,
        targetHeight: height,
        currentHeight: 0, // animate growth
        type: plantType,
        color: this.getRandomGreen(),
        swayOffset: Math.random() * Math.PI,
        bloom: state.totalSavedCo2 > 15 && Math.random() > 0.4
      });
    }
    
    // Spawn background particles
    const particleCount = this.isMini ? 8 : 25;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() * 0.3) + 0.1,
        vy: -(Math.random() * 0.4) - 0.2,
        r: (Math.random() * 2) + 0.5,
        color: state.gardenWeather === 'day' ? 'rgba(52, 211, 153, 0.4)' : 'rgba(253, 224, 71, 0.7)'
      });
    }
    
    // Spawn clouds (daytime only)
    if (state.gardenWeather === 'day') {
      const cloudCount = this.isMini ? 1 : 3;
      for (let i = 0; i < cloudCount; i++) {
        this.clouds.push({
          x: Math.random() * this.width,
          y: Math.random() * (this.height * 0.3) + 15,
          speed: 0.1 + Math.random() * 0.15,
          r: 20 + Math.random() * 15
        });
      }
    }
  }
  
  getRandomGreen() {
    const greens = ['#10b981', '#34d399', '#059669', '#047857', '#6ee7b7'];
    return greens[Math.floor(Math.random() * greens.length)];
  }
  
  drawSky() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    if (state.gardenWeather === 'day') {
      grad.addColorStop(0, '#0c2419');
      grad.addColorStop(1, '#060908');
    } else {
      grad.addColorStop(0, '#03080e');
      grad.addColorStop(1, '#060908');
    }
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Stars or sun glow
    if (state.gardenWeather === 'night') {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < 15; i++) {
        const sx = (Math.sin(i * 1234) * 0.5 + 0.5) * this.width;
        const sy = (Math.cos(i * 5678) * 0.5 + 0.5) * (this.height * 0.5);
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      // Draw glowing Moon
      this.ctx.beginPath();
      this.ctx.arc(this.width - 50, 45, 14, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fef08a';
      this.ctx.shadowColor = '#fef08a';
      this.ctx.shadowBlur = 15;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    } else {
      // Draw golden sun aura
      this.ctx.beginPath();
      this.ctx.arc(45, 45, 16, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
      this.ctx.shadowColor = 'var(--color-mint)';
      this.ctx.shadowBlur = 20;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }
  
  drawGround() {
    this.ctx.beginPath();
    this.ctx.ellipse(this.width/2, this.height + 50, this.width * 0.7, 75, 0, 0, Math.PI * 2);
    
    const todayTotal = calculateTodayTotal();
    if (todayTotal > state.dailyBudget * 1.2) {
      this.ctx.fillStyle = '#27231c'; // dry brown
    } else {
      this.ctx.fillStyle = '#061a12'; // deep green
    }
    
    this.ctx.fill();
  }
  
  drawTree(plant, sway) {
    if (plant.currentHeight < plant.targetHeight) {
      plant.currentHeight += 1.5; // grow animation
    }
    
    const h = plant.currentHeight;
    const swayX = Math.sin(sway + plant.swayOffset) * (h * 0.05);
    
    this.ctx.save();
    
    // Branch stroke
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = Math.max(2, h * 0.08);
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(plant.x, plant.y);
    this.ctx.quadraticCurveTo(plant.x, plant.y - h/2, plant.x + swayX, plant.y - h);
    this.ctx.stroke();
    
    const tipX = plant.x + swayX;
    const tipY = plant.y - h;
    
    this.ctx.fillStyle = plant.color;
    this.ctx.beginPath();
    if (plant.type === 0) {
      // Rounded canopy tree
      this.ctx.arc(tipX, tipY, h * 0.35, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this.ctx.beginPath();
      this.ctx.arc(tipX - h * 0.1, tipY - h * 0.1, h * 0.2, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (plant.type === 1) {
      // Pine / triangle tree
      this.ctx.moveTo(tipX, tipY - h * 0.1);
      this.ctx.lineTo(tipX - h * 0.3, tipY + h * 0.3);
      this.ctx.lineTo(tipX + h * 0.3, tipY + h * 0.3);
      this.ctx.closePath();
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.moveTo(tipX, tipY - h * 0.35);
      this.ctx.lineTo(tipX - h * 0.22, tipY);
      this.ctx.lineTo(tipX + h * 0.22, tipY);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // Shrub / Blooming flower
      this.ctx.arc(tipX, tipY, h * 0.25, 0, Math.PI * 2);
      this.ctx.arc(tipX - h * 0.15, tipY + h * 0.1, h * 0.2, 0, Math.PI * 2);
      this.ctx.arc(tipX + h * 0.15, tipY + h * 0.1, h * 0.2, 0, Math.PI * 2);
      this.ctx.fill();
      
      if (plant.bloom) {
        this.ctx.fillStyle = '#f43f5e';
        this.ctx.beginPath();
        this.ctx.arc(tipX, tipY - h * 0.1, 4, 0, Math.PI * 2);
        this.ctx.arc(tipX - h * 0.1, tipY + 4, 3, 0, Math.PI * 2);
        this.ctx.arc(tipX + h * 0.1, tipY + 2, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#fde047';
        this.ctx.beginPath();
        this.ctx.arc(tipX, tipY - h * 0.1, 1.8, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    this.ctx.restore();
  }
  
  update() {
    const time = Date.now() * 0.0015;
    
    this.drawSky();
    
    // Draw clouds (day only)
    if (state.gardenWeather === 'day') {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      this.clouds.forEach(c => {
        c.x += c.speed;
        if (c.x - c.r * 2.5 > this.width) c.x = -c.r * 2.5;
        this.ctx.beginPath();
        this.ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        this.ctx.arc(c.x + c.r * 0.7, c.y - c.r * 0.2, c.r * 0.8, 0, Math.PI * 2);
        this.ctx.arc(c.x - c.r * 0.7, c.y + c.r * 0.1, c.r * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
    
    // Draw particles
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.y < 0) {
        p.y = this.height;
        p.x = Math.random() * this.width;
      }
      if (p.x > this.width) p.x = 0;
      
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    this.drawGround();
    this.plants.forEach(plant => this.drawTree(plant, time));
  }
}

function startGardenAnim() {
  stopGardenAnim();
  
  const mini = new GardenSimulation('mini-garden-canvas', true);
  const full = new GardenSimulation('full-garden-canvas', false);
  
  function loop() {
    if (mini.canvas) mini.update();
    if (full.canvas) full.update();
    
    miniGardenAnim = requestAnimationFrame(loop);
  }
  loop();
}

function stopGardenAnim() {
  if (miniGardenAnim) cancelAnimationFrame(miniGardenAnim);
  if (fullGardenAnim) cancelAnimationFrame(fullGardenAnim);
}

// --- CHALLENGES ENGINE ---
function renderQuickChallenges() {
  const container = document.getElementById('quick-challenges-list');
  if (!container) return;
  
  const subset = state.challenges.slice(0, 3);
  let html = '';
  
  subset.forEach(c => {
    html += `
      <div class="challenge-row ${c.completed ? 'completed' : ''}" data-id="${c.id}">
        <div class="challenge-info">
          <div class="challenge-check-btn" onclick="toggleChallenge('${c.id}')">
            ${c.completed ? '<i data-lucide="check"></i>' : ''}
          </div>
          <div class="challenge-title-group">
            <span class="challenge-title">${c.title}</span>
            <span class="challenge-points">+${c.points} pts &bull; -${c.co2Saved}kg CO₂e</span>
          </div>
        </div>
        <span class="challenge-badge-mini">${c.category}</span>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  const doneCount = state.challenges.filter(c => c.completed).length;
  document.getElementById('challenges-completed-lbl').innerText = `${doneCount}/${state.challenges.length} Done`;
}

function renderFullChallenges() {
  const commuteCont = document.getElementById('commute-challenges-container');
  const dietCont = document.getElementById('diet-challenges-container');
  const energyCont = document.getElementById('energy-challenges-container');
  
  if (!commuteCont) return;
  
  let commuteHtml = '', dietHtml = '';
  
  state.challenges.forEach(c => {
    const cardHtml = `
      <div class="challenge-row ${c.completed ? 'completed' : ''}" data-id="${c.id}">
        <div class="challenge-info">
          <div class="challenge-check-btn" onclick="toggleChallenge('${c.id}')">
            ${c.completed ? '<i data-lucide="check"></i>' : ''}
          </div>
          <div class="challenge-title-group">
            <span class="challenge-title">${c.title}</span>
            <span class="challenge-points">+${c.points} pts &bull; -${c.co2Saved}kg CO₂e</span>
          </div>
        </div>
      </div>
    `;
    
    if (c.category === 'transport') commuteHtml += cardHtml;
    else if (c.category === 'diet') dietHtml += cardHtml;
  });
  
  commuteCont.innerHTML = commuteHtml;
  dietCont.innerHTML = dietHtml;
  
  let activeEnergyHtml = '';
  state.challenges.filter(c => c.category === 'energy' || c.category === 'waste').forEach(c => {
    activeEnergyHtml += `
      <div class="challenge-row ${c.completed ? 'completed' : ''}" data-id="${c.id}">
        <div class="challenge-info">
          <div class="challenge-check-btn" onclick="toggleChallenge('${c.id}')">
            ${c.completed ? '<i data-lucide="check"></i>' : ''}
          </div>
          <div class="challenge-title-group">
            <span class="challenge-title">${c.title}</span>
            <span class="challenge-points">+${c.points} pts &bull; -${c.co2Saved}kg CO₂e</span>
          </div>
        </div>
      </div>
    `;
  });
  energyCont.innerHTML = activeEnergyHtml;
}

window.toggleChallenge = function(id) {
  const challenge = state.challenges.find(c => c.id === id);
  if (!challenge) return;
  
  challenge.completed = !challenge.completed;
  
  if (challenge.completed) {
    state.points += challenge.points;
    state.totalSavedCo2 += challenge.co2Saved;
    triggerSuccessConfetti();
  } else {
    state.points = Math.max(0, state.points - challenge.points);
    state.totalSavedCo2 = Math.max(0, state.totalSavedCo2 - challenge.co2Saved);
  }
  
  state.level = Math.floor(state.points / 100) + 1;
  
  saveState();
  renderDashboard();
};

function triggerSuccessConfetti() {
  const headerCard = document.querySelector('.hero-gauge-card');
  if (headerCard) {
    headerCard.style.boxShadow = '0 0 40px rgba(52, 211, 153, 0.4)';
    setTimeout(() => {
      headerCard.style.boxShadow = 'var(--shadow-glow)';
    }, 1000);
  }
}

// --- INTELLIGENT INSIGHTS ENGINE ---
const INSIGHTS_LIBRARY = {
  transport: [
    { title: 'Public Transport Win', desc: 'Commuting by transit generates 80% less emissions than a gas-powered car. Consider a rail pass!', savings: '3.1 kg CO2' },
    { title: 'Tire Pressure Optimization', desc: 'Keeping tires properly inflated increases fuel mileage by 3%. A simple check saves footprint!', savings: '0.4 kg CO2' },
    { title: 'The Power of Active Transit', desc: 'Biking or walking for short journeys (<3 miles) completely offsets commuter carbon.', savings: '2.5 kg CO2' }
  ],
  diet: [
    { title: 'Plant-Based Savings', desc: 'Replacing beef/lamb with pulses or mushrooms cuts lunch emissions by 90%. Try Meatless Mondays.', savings: '4.2 kg CO2' },
    { title: 'Eco-Friendly Leftovers', desc: 'Wasting food means wasting all production energy. Planning grocery runs reduces local trash.', savings: '1.2 kg CO2' }
  ],
  energy: [
    { title: 'Phantom Power Hack', desc: 'Electronics on standby draw 10% of household electricity. Power strips allow absolute shutdown.', savings: '0.6 kg CO2' },
    { title: 'Eco-Dryer Solution', desc: 'Air drying clothes instead of using high-heat tumble dryers completely neutralizes laundry carbon.', savings: '1.8 kg CO2' },
    { title: 'Thermostat Adjustment', desc: 'Adjusting heating down by just 1 degree Celsius saves up to 8% of energy consumption.', savings: '2.0 kg CO2' }
  ],
  waste: [
    { title: 'Zero Waste Habits', desc: 'Refusing single-use plastic cups by keeping a travel flask avoids raw petroleum processing.', savings: '0.5 kg CO2' }
  ]
};

function renderInsights() {
  const auditText = document.getElementById('carbon-audit-text');
  const tipsGrid = document.getElementById('insights-tips-grid');
  if (!auditText || !tipsGrid) return;
  
  const categories = [
    { name: 'Transportation', val: state.today.transport.co2, key: 'transport' },
    { name: 'Diet & Food', val: state.today.diet.co2, key: 'diet' },
    { name: 'Home Energy', val: state.today.energy.co2, key: 'energy' },
    { name: 'Shopping & Waste', val: state.today.waste.co2, key: 'waste' }
  ];
  
  categories.sort((a, b) => b.val - a.val);
  const highest = categories[0];
  
  if (highest.val === 0) {
    auditText.innerText = 'Excellent job! You have zero logged emissions today. Your Eco-Garden is flourishing! Browse challenges to score extra level levels.';
  } else {
    auditText.innerText = `Your highest emissions today come from ${highest.name} (${highest.val.toFixed(1)} kg CO₂e). Concentrating on reducing inputs here will yield the largest overall carbon savings. See the checklist of actions below.`;
  }
  
  const selectedTips = [];
  if (INSIGHTS_LIBRARY[highest.key]) {
    selectedTips.push(...INSIGHTS_LIBRARY[highest.key]);
  }
  categories.forEach(c => {
    if (c.key !== highest.key && INSIGHTS_LIBRARY[c.key]) {
      selectedTips.push(INSIGHTS_LIBRARY[c.key][0]);
    }
  });
  
  let tipsHtml = '';
  selectedTips.slice(0, 4).forEach(t => {
    tipsHtml += `
      <div class="card glass-card insight-tip-card">
        <div class="insight-tip-header">
          <i data-lucide="sparkles" class="text-mint"></i>
          <h4>${t.title}</h4>
          <span class="insight-tip-saving">-${t.savings}</span>
        </div>
        <p class="text-secondary small">${t.desc}</p>
      </div>
    `;
  });
  
  tipsGrid.innerHTML = tipsHtml;
}

// --- DOM EVENT HANDLERS & NAVIGATION ---
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderDashboard();
  startGardenAnim();
  
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.view-section');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      const targetHash = item.getAttribute('href');
      sections.forEach(sec => {
        sec.classList.remove('active-view');
        if (`#${sec.id.replace('-view', '')}` === targetHash) {
          sec.classList.add('active-view');
        }
      });
      
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    });
  });
  
  const toGardenBtn = document.getElementById('go-to-garden-btn');
  if (toGardenBtn) {
    toGardenBtn.addEventListener('click', () => {
      const gardenNav = document.getElementById('nav-garden');
      if (gardenNav) gardenNav.click();
    });
  }
  
  const refreshBtn = document.getElementById('garden-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      state.totalSavedCo2 += 1.0;
      saveState();
      renderDashboard();
      startGardenAnim();
    });
  }
  
  const weatherToggle = document.getElementById('garden-weather-toggle');
  if (weatherToggle) {
    weatherToggle.addEventListener('click', () => {
      state.gardenWeather = state.gardenWeather === 'day' ? 'night' : 'day';
      
      const weatherIcon = weatherToggle.querySelector('i');
      if (state.gardenWeather === 'night') {
        weatherToggle.innerHTML = '<i data-lucide="sun"></i>';
      } else {
        weatherToggle.innerHTML = '<i data-lucide="moon"></i>';
      }
      
      saveState();
      renderDashboard();
      startGardenAnim();
    });
  }
  
  // Modal toggling
  const logModal = document.getElementById('log-activity-modal');
  const openModalBtn = document.getElementById('open-log-modal-btn');
  const closeModalBtn = document.getElementById('close-log-modal-btn');
  const cancelModalBtn = document.getElementById('cancel-log-btn');
  const saveLogBtn = document.getElementById('save-log-btn');
  
  function openModal() {
    logModal.classList.add('active');
    updateModalEstimate();
  }
  
  function closeModal() {
    logModal.classList.remove('active');
  }
  
  if (openModalBtn) openModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
  
  const modalTabButtons = document.querySelectorAll('.modal-tabs .tab-btn');
  const modalTabContents = document.querySelectorAll('.tab-content');
  
  modalTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modalTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tabTarget = btn.getAttribute('data-tab');
      modalTabContents.forEach(cont => {
        cont.classList.remove('active-tab');
        if (cont.id === tabTarget) {
          cont.classList.add('active-tab');
        }
      });
      
      updateModalEstimate();
    });
  });
  
  setupSliderListener('commute-distance', 'commute-distance-val');
  setupSliderListener('energy-hours', 'energy-hours-val');
  setupSliderListener('waste-bags', 'waste-bags-val');
  
  function setupSliderListener(sliderId, bubbleId) {
    const slider = document.getElementById(sliderId);
    const bubble = document.getElementById(bubbleId);
    if (slider && bubble) {
      slider.addEventListener('input', () => {
        bubble.innerText = slider.value;
        updateModalEstimate();
      });
    }
  }
  
  const activityForm = document.getElementById('activity-log-form');
  if (activityForm) {
    activityForm.addEventListener('change', updateModalEstimate);
  }
  
  function updateModalEstimate() {
    const activeTab = document.querySelector('.modal-tabs .tab-btn.active').getAttribute('data-tab');
    const value = calculateLiveEstimate(activeTab);
    const label = document.getElementById('live-carbon-estimate');
    if (label) {
      label.innerText = value.toFixed(2);
      if (value > 4.5) {
        label.className = 'live-val text-coral';
      } else if (value > 2.0) {
        label.className = 'live-val text-warning';
      } else {
        label.className = 'live-val text-mint';
      }
    }
  }
  
  if (saveLogBtn) {
    saveLogBtn.addEventListener('click', () => {
      const activeTab = document.querySelector('.modal-tabs .tab-btn.active').getAttribute('data-tab');
      
      if (activeTab === 'tab-transport') {
        const commuteType = document.querySelector('input[name="commute-type"]:checked').value;
        const distance = parseFloat(document.getElementById('commute-distance').value);
        state.today.transport = {
          type: commuteType,
          distance: distance,
          logged: true,
          co2: distance * CARBON_FACTORS.transport[commuteType]
        };
      } else if (activeTab === 'tab-diet') {
        const mealType = document.querySelector('input[name="meal-type"]:checked').value;
        state.today.diet = {
          type: mealType,
          logged: true,
          co2: CARBON_FACTORS.diet[mealType]
        };
      } else if (activeTab === 'tab-energy') {
        const hours = parseFloat(document.getElementById('energy-hours').value);
        const laundry = document.getElementById('appliances-laundry').checked;
        const dryer = document.getElementById('appliances-dryer').checked;
        
        let co2 = hours * CARBON_FACTORS.energy.hourHeatingCooling;
        if (laundry) co2 += CARBON_FACTORS.energy.laundryHighHeat;
        if (dryer) co2 += CARBON_FACTORS.energy.tumbleDryer;
        
        state.today.energy = {
          hours, laundry, dryer,
          logged: true,
          co2
        };
      } else if (activeTab === 'tab-waste') {
        const recycling = document.querySelector('input[name="recycling"]:checked').value;
        const bags = parseFloat(document.getElementById('waste-bags').value);
        
        let co2 = bags * CARBON_FACTORS.waste.bagGarbage;
        co2 += CARBON_FACTORS.waste.recycling[recycling];
        
        state.today.waste = {
          recycling, bags,
          logged: true,
          co2: Math.max(0, co2)
        };
      }
      
      state.points += 15;
      state.level = Math.floor(state.points / 100) + 1;
      
      updateTodayHistory();
      saveState();
      renderDashboard();
      closeModal();
      
      startGardenAnim();
    });
  }
});
