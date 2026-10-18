/**
 * Main Application Controller & Minimalist Game UI Wiring
 */

document.addEventListener('DOMContentLoaded', () => {
  const simCanvas = document.getElementById('sim-canvas');
  const simCtx = simCanvas.getContext('2d');
  const canvasWrapper = document.getElementById('canvas-wrapper');

  // Initialize simulation & charts
  const rect = canvasWrapper.getBoundingClientRect();
  const sim = new EcosystemSimulation(rect.width || 800, rect.height || 600);

  const charts = new EvolutionCharts(
    document.getElementById('chart-traits'),
    document.getElementById('chart-population'),
    document.getElementById('chart-distribution')
  );

  let isPaused = false;
  let simSpeedMultiplier = 1;
  let lastFrameTime = performance.now();

  // DOM References - Top Bar
  const statPopulation = document.getElementById('stat-population');
  const statFood = document.getElementById('stat-food');
  const statGeneration = document.getElementById('stat-generation');
  const statBirthsDeaths = document.getElementById('stat-births-deaths');
  const statTime = document.getElementById('stat-time');

  const btnTogglePlay = document.getElementById('btn-toggle-play');
  const iconPause = document.getElementById('icon-pause');
  const iconPlay = document.getElementById('icon-play');
  const btnReset = document.getElementById('btn-reset');
  const speedButtons = document.querySelectorAll('.btn-speed');

  // DOM References - Trait Sliders
  const traitTargetBadge = document.getElementById('trait-target-badge');
  const sliderSpeed = document.getElementById('slider-speed');
  const valSpeed = document.getElementById('val-speed');
  const sliderVision = document.getElementById('slider-vision');
  const valVision = document.getElementById('val-vision');
  const sliderEfficiency = document.getElementById('slider-efficiency');
  const valEfficiency = document.getElementById('val-efficiency');

  const btnSpawnCustom = document.getElementById('btn-spawn-custom');
  const btnApplyAll = document.getElementById('btn-apply-all');

  // DOM References - Mutation & Selection Sliders
  const sliderMutationRate = document.getElementById('slider-mutation-rate');
  const valMutationRate = document.getElementById('val-mutation-rate');
  const sliderMutationStep = document.getElementById('slider-mutation-step');
  const valMutationStep = document.getElementById('val-mutation-step');
  const sliderMetabolism = document.getElementById('slider-metabolism');
  const valMetabolism = document.getElementById('val-metabolism');
  const sliderReproThreshold = document.getElementById('slider-repro-threshold');
  const valReproThreshold = document.getElementById('val-repro-threshold');

  // DOM References - World & Icon Toggles
  const sliderFoodRate = document.getElementById('slider-food-rate');
  const valFoodRate = document.getElementById('val-food-rate');
  const sliderFoodEnergy = document.getElementById('slider-food-energy');
  const valFoodEnergy = document.getElementById('val-food-energy');
  const btnToggleVision = document.getElementById('btn-toggle-vision');
  const btnToggleEnergy = document.getElementById('btn-toggle-energy');

  // DOM References - Overlay & Inspector
  const avgSpeedEl = document.getElementById('avg-speed');
  const avgVisionEl = document.getElementById('avg-vision');
  const avgEfficiencyEl = document.getElementById('avg-efficiency');

  const inspectorCard = document.getElementById('inspector-card');
  const inspTitle = document.getElementById('insp-title');
  const inspGen = document.getElementById('insp-gen');
  const inspEnergy = document.getElementById('insp-energy');
  const inspAge = document.getElementById('insp-age');
  const inspChildren = document.getElementById('insp-children');
  const inspBurn = document.getElementById('insp-burn');
  const btnCloseInspector = document.getElementById('btn-close-inspector');
  const btnMutateSelected = document.getElementById('btn-mutate-selected');
  const btnCloneSelected = document.getElementById('btn-clone-selected');

  const evolutionLogEl = document.getElementById('evolution-log');

  // Resize Handler
  function handleResize() {
    const r = canvasWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    simCanvas.width = r.width * dpr;
    simCanvas.height = r.height * dpr;
    simCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sim.resize(r.width, r.height);
    charts.resizeAll();
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  // Sync Trait Sliders with either Selected Creature or Baseline Config
  function syncTraitSlidersFromState() {
    if (sim.selectedCreature) {
      const c = sim.selectedCreature;
      traitTargetBadge.textContent = `#${c.id}`;
      traitTargetBadge.classList.add('live-edit');
      sliderSpeed.value = c.speed.toFixed(1);
      valSpeed.textContent = c.speed.toFixed(2);
      sliderVision.value = Math.round(c.vision);
      valVision.textContent = `${Math.round(c.vision)}`;
      sliderEfficiency.value = c.efficiency.toFixed(2);
      valEfficiency.textContent = c.efficiency.toFixed(2);
    } else {
      traitTargetBadge.textContent = 'SPAWN';
      traitTargetBadge.classList.remove('live-edit');
      sliderSpeed.value = sim.config.baselineSpeed;
      valSpeed.textContent = sim.config.baselineSpeed.toFixed(1);
      sliderVision.value = sim.config.baselineVision;
      valVision.textContent = `${sim.config.baselineVision}`;
      sliderEfficiency.value = sim.config.baselineEfficiency;
      valEfficiency.textContent = sim.config.baselineEfficiency.toFixed(2);
    }
  }

  // Trait Slider Listeners
  sliderSpeed.addEventListener('input', () => {
    const v = parseFloat(sliderSpeed.value);
    sim.config.baselineSpeed = v;
    if (sim.selectedCreature) {
      sim.selectedCreature.speed = v;
      valSpeed.textContent = v.toFixed(2);
    } else {
      valSpeed.textContent = v.toFixed(1);
    }
  });

  sliderVision.addEventListener('input', () => {
    const v = parseFloat(sliderVision.value);
    sim.config.baselineVision = v;
    valVision.textContent = `${Math.round(v)}`;
    if (sim.selectedCreature) {
      sim.selectedCreature.vision = v;
    }
  });

  sliderEfficiency.addEventListener('input', () => {
    const v = parseFloat(sliderEfficiency.value);
    sim.config.baselineEfficiency = v;
    valEfficiency.textContent = v.toFixed(2);
    if (sim.selectedCreature) {
      sim.selectedCreature.efficiency = v;
    }
  });

  // Spawn Custom Creatures Button
  btnSpawnCustom.addEventListener('click', () => {
    const s = parseFloat(sliderSpeed.value);
    const v = parseFloat(sliderVision.value);
    const e = parseFloat(sliderEfficiency.value);
    for (let i = 0; i < 5; i++) {
      sim.spawnCreatureWithJitter(s, v, e, 0.03);
    }
    sim.addLog(`+5 SPAWNED // SPD ${s.toFixed(1)} VIS ${Math.round(v)} EFF ${e.toFixed(2)}`);
  });

  // Apply Trait Sliders to All Living Creatures
  btnApplyAll.addEventListener('click', () => {
    const s = parseFloat(sliderSpeed.value);
    const v = parseFloat(sliderVision.value);
    const e = parseFloat(sliderEfficiency.value);
    sim.creatures.forEach((c) => {
      c.speed = s;
      c.vision = v;
      c.efficiency = e;
    });
    sim.addLog(`SYNC ALL (${sim.creatures.length}) // SPD ${s.toFixed(1)} VIS ${Math.round(v)} EFF ${e.toFixed(2)}`);
  });

  // Mutation & Selection Controls
  sliderMutationRate.addEventListener('input', () => {
    const pct = parseInt(sliderMutationRate.value, 10);
    valMutationRate.textContent = `${pct}%`;
    sim.config.mutationRate = pct / 100;
  });

  sliderMutationStep.addEventListener('input', () => {
    const pct = parseInt(sliderMutationStep.value, 10);
    valMutationStep.textContent = `${pct}%`;
    sim.config.mutationStrength = pct / 100;
  });

  sliderMetabolism.addEventListener('input', () => {
    const v = parseFloat(sliderMetabolism.value);
    valMetabolism.textContent = `${v.toFixed(1)}x`;
    sim.config.metabolismMultiplier = v;
  });

  sliderReproThreshold.addEventListener('input', () => {
    const v = parseInt(sliderReproThreshold.value, 10);
    valReproThreshold.textContent = `${v}`;
    sim.config.reproductionThreshold = v;
  });

  // Environment & Icon Toggle Controls
  sliderFoodRate.addEventListener('input', () => {
    const v = parseFloat(sliderFoodRate.value);
    valFoodRate.textContent = `${v.toFixed(1)}`;
    sim.config.foodSpawnRate = v;
  });

  sliderFoodEnergy.addEventListener('input', () => {
    const v = parseInt(sliderFoodEnergy.value, 10);
    valFoodEnergy.textContent = `${v}`;
    sim.config.foodEnergy = v;
  });

  btnToggleVision.addEventListener('click', () => {
    sim.config.showVisionRings = !sim.config.showVisionRings;
    btnToggleVision.classList.toggle('active', sim.config.showVisionRings);
  });

  btnToggleEnergy.addEventListener('click', () => {
    sim.config.showEnergyArcs = !sim.config.showEnergyArcs;
    btnToggleEnergy.classList.toggle('active', sim.config.showEnergyArcs);
  });

  // Playback Controls
  btnTogglePlay.addEventListener('click', () => {
    isPaused = !isPaused;
    iconPause.classList.toggle('hidden', isPaused);
    iconPlay.classList.toggle('hidden', !isPaused);
    btnTogglePlay.classList.toggle('active', !isPaused);
  });

  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      speedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      simSpeedMultiplier = parseInt(btn.dataset.speed, 10) || 1;
    });
  });

  btnReset.addEventListener('click', () => {
    sim.reset();
    syncTraitSlidersFromState();
  });

  // Canvas Interaction: Click to select creature or drop food cluster
  simCanvas.addEventListener('click', (e) => {
    const r = simCanvas.getBoundingClientRect();
    const clickX = e.clientX - r.left;
    const clickY = e.clientY - r.top;

    let clickedCreature = null;
    let bestDistSq = 20 * 20;
    for (let i = 0; i < sim.creatures.length; i++) {
      const c = sim.creatures[i];
      const dx = c.x - clickX;
      const dy = c.y - clickY;
      const dSq = dx * dx + dy * dy;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        clickedCreature = c;
      }
    }

    if (clickedCreature) {
      sim.selectedCreature = clickedCreature;
      syncTraitSlidersFromState();
    } else if (sim.selectedCreature) {
      sim.selectedCreature = null;
      syncTraitSlidersFromState();
    } else {
      for (let i = 0; i < 3; i++) {
        sim.spawnFood(
          clickX + (Math.random() - 0.5) * 24,
          clickY + (Math.random() - 0.5) * 24
        );
      }
    }
  });

  // Inspector Card Actions
  btnCloseInspector.addEventListener('click', () => {
    sim.selectedCreature = null;
    syncTraitSlidersFromState();
  });

  btnMutateSelected.addEventListener('click', () => {
    const c = sim.selectedCreature;
    if (!c) return;
    c.mutateInPlace(Math.max(0.15, sim.config.mutationStrength));
    sim.particles.push({
      x: c.x,
      y: c.y,
      color: '#ffffff',
      maxRadius: 28,
      duration: 0.5,
      elapsed: 0,
      update(dt) {
        this.elapsed += dt;
        return this.elapsed < this.duration;
      }
    });
    syncTraitSlidersFromState();
    sim.addLog(
      `MUTATED #${c.id} // SPD ${c.speed.toFixed(2)} VIS ${Math.round(c.vision)} EFF ${c.efficiency.toFixed(2)}`
    );
  });

  btnCloneSelected.addEventListener('click', () => {
    const c = sim.selectedCreature;
    if (!c) return;
    c.energy = Math.max(c.energy, sim.config.reproductionThreshold);
    const { child } = c.reproduce(sim);
    sim.creatures.push(child);
    sim.totalBirths += 1;
    if (child.generation > sim.maxGeneration) {
      sim.maxGeneration = child.generation;
    }
    sim.addLog(`SPLIT #${c.id} -> #${child.id} (G${child.generation})`);
  });

  // UI Refresh Helper
  let lastLogSignature = '';

  function updateUI() {
    statPopulation.textContent = sim.creatures.length;
    statFood.textContent = sim.foods.length;
    statGeneration.textContent = sim.maxGeneration;
    statBirthsDeaths.textContent = `${sim.totalBirths}/${sim.totalDeaths}`;
    statTime.textContent = `${Math.floor(sim.simTime)}s`;

    const { avgSpeed, avgVision, avgEfficiency } = sim.getAverages();
    avgSpeedEl.textContent = avgSpeed.toFixed(2);
    avgVisionEl.textContent = `${Math.round(avgVision)}`;
    avgEfficiencyEl.textContent = avgEfficiency.toFixed(2);

    if (sim.selectedCreature) {
      const c = sim.selectedCreature;
      inspectorCard.classList.remove('hidden');
      inspTitle.textContent = `#${c.id}`;
      inspGen.textContent = `GEN ${c.generation}`;
      inspEnergy.textContent = `${Math.round(c.energy)}/${sim.config.reproductionThreshold}`;
      inspAge.textContent = `${c.age.toFixed(1)}s`;
      inspChildren.textContent = `${c.childrenCount}`;
      inspBurn.textContent = `${c.lastBurnRate.toFixed(1)}/s`;
    } else {
      if (!inspectorCard.classList.contains('hidden')) {
        inspectorCard.classList.add('hidden');
        syncTraitSlidersFromState();
      }
    }

    const topLog = sim.logs[0] ? `${sim.logs.length}:${sim.logs[0].time}:${sim.logs[0].message}` : '';
    if (topLog !== lastLogSignature) {
      lastLogSignature = topLog;
      evolutionLogEl.innerHTML = sim.logs
        .slice(0, 12)
        .map(
          (item) =>
            `<li><span class="log-time">[${item.time}]</span>${item.message}</li>`
        )
        .join('');
    }
  }

  // Main Animation Loop
  let uiTickCounter = 0;

  function animate(now) {
    const rawDt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (!isPaused) {
      const subSteps = simSpeedMultiplier;
      for (let s = 0; s < subSteps; s++) {
        sim.step(rawDt);
      }
    }

    sim.render(simCtx);

    uiTickCounter++;
    if (uiTickCounter % 4 === 0) {
      updateUI();
      charts.render(sim);
    }

    requestAnimationFrame(animate);
  }

  updateUI();
  charts.render(sim);
  requestAnimationFrame(animate);
});
