/**
 * Evolving Digital Creatures - Core Ecosystem & Natural Selection Engine
 */

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

class Creature {
  static nextId = 1;

  constructor(x, y, traits, generation = 1) {
    this.id = Creature.nextId++;
    this.x = x;
    this.y = y;

    // Adjustable Genome Traits
    this.speed = clamp(traits.speed ?? 2.2, 0.6, 5.0);
    this.vision = clamp(traits.vision ?? 90, 20, 220);
    this.efficiency = clamp(traits.efficiency ?? 1.0, 0.4, 2.5);

    this.generation = generation;
    this.energy = traits.energy ?? 95;
    this.age = 0;
    this.childrenCount = 0;
    this.reproCooldown = 1.5;

    // Kinematics & Steering
    this.angle = Math.random() * Math.PI * 2;
    this.wanderAngle = this.angle;
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.tailPhase = Math.random() * Math.PI * 2;
    this.targetFood = null;

    // Visual radius scales subtly with efficiency/energy storage
    this.baseRadius = 6.5;
    this.lastBurnRate = 0;
  }

  get radius() {
    return this.baseRadius + clamp((this.energy - 60) * 0.018, -1.2, 3.0);
  }

  /**
   * Computes instantaneous metabolic energy burn per second.
   * Faster movement (v^2) and larger vision radius cost more energy,
   * while higher efficiency mitigates metabolic drain.
   */
  getBurnRate(metabolismMultiplier, isChasing = false) {
    const activeSpeed = isChasing ? this.speed : this.speed * 0.82;
    const basalCost = 1.6;
    const kineticCost = 1.15 * (activeSpeed * activeSpeed);
    const sensoryCost = 0.035 * this.vision;
    const efficiencyFactor = Math.pow(this.efficiency, 0.85);
    return metabolismMultiplier * ((basalCost + kineticCost + sensoryCost) / efficiencyFactor);
  }

  update(dt, sim) {
    this.age += dt;
    if (this.reproCooldown > 0) {
      this.reproCooldown -= dt;
    }

    // 1. Sensory scan: locate nearest food within vision radius
    let nearestFood = null;
    let minDistSq = this.vision * this.vision;

    for (let i = 0; i < sim.foods.length; i++) {
      const f = sim.foods[i];
      const dx = f.x - this.x;
      const dy = f.y - this.y;
      const dSq = dx * dx + dy * dy;
      if (dSq <= minDistSq) {
        minDistSq = dSq;
        nearestFood = f;
      }
    }

    this.targetFood = nearestFood;
    const isChasing = nearestFood !== null;

    // 2. Steering & Kinematics
    if (nearestFood) {
      const desiredAngle = Math.atan2(nearestFood.y - this.y, nearestFood.x - this.x);
      let diff = desiredAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = 7.5 * dt;
      this.angle += clamp(diff, -turnRate, turnRate);
      this.wanderAngle = this.angle;
    } else {
      // Smooth exploratory wander
      this.wanderAngle += (Math.random() - 0.5) * 4.5 * dt;
      let diff = this.wanderAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * 3.0 * dt;
    }

    // Soft wall avoidance
    const margin = 36;
    const turnForce = 5.5 * dt;
    if (this.x < margin) {
      this.angle += Math.sin(0 - this.angle) * turnForce;
      this.wanderAngle = this.angle;
    } else if (this.x > sim.width - margin) {
      this.angle += Math.sin(Math.PI - this.angle) * turnForce;
      this.wanderAngle = this.angle;
    }
    if (this.y < margin) {
      this.angle += Math.sin(Math.PI / 2 - this.angle) * turnForce;
      this.wanderAngle = this.angle;
    } else if (this.y > sim.height - margin) {
      this.angle += Math.sin(-Math.PI / 2 - this.angle) * turnForce;
      this.wanderAngle = this.angle;
    }

    const moveSpeed = (isChasing ? this.speed : this.speed * 0.85) * 34; // px per second
    this.vx = Math.cos(this.angle) * moveSpeed;
    this.vy = Math.sin(this.angle) * moveSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Keep strictly inside bounds
    const pad = this.radius + 4;
    if (this.x < pad) { this.x = pad; this.angle = Math.PI - this.angle; }
    if (this.x > sim.width - pad) { this.x = sim.width - pad; this.angle = Math.PI - this.angle; }
    if (this.y < pad) { this.y = pad; this.angle = -this.angle; }
    if (this.y > sim.height - pad) { this.y = sim.height - pad; this.angle = -this.angle; }

    // Advance swimming tail animation proportional to speed
    this.tailPhase += dt * (4 + this.speed * 4.2);

    // 3. Metabolic Energy Drain
    this.lastBurnRate = this.getBurnRate(sim.config.metabolismMultiplier, isChasing);
    this.energy -= this.lastBurnRate * dt;
  }

  /**
   * Mutate this creature's genome in place (used by the live inspector button)
   */
  mutateInPlace(strength = 0.15) {
    this.speed = clamp(this.speed * (1 + gaussianRandom() * strength), 0.6, 5.0);
    this.vision = clamp(this.vision * (1 + gaussianRandom() * strength), 20, 220);
    this.efficiency = clamp(this.efficiency * (1 + gaussianRandom() * strength), 0.4, 2.5);
  }

  /**
   * Create an offspring with inherited and potentially mutated traits
   */
  reproduce(sim) {
    const childEnergy = this.energy * 0.46;
    this.energy = this.energy * 0.48; // 6% division overhead
    this.reproCooldown = 2.0;
    this.childrenCount += 1;

    const mutRate = sim.config.mutationRate;
    const mutStrength = sim.config.mutationStrength;

    let newSpeed = this.speed;
    let newVision = this.vision;
    let newEfficiency = this.efficiency;
    let mutatedTraits = [];

    if (Math.random() < mutRate) {
      const delta = gaussianRandom() * mutStrength;
      newSpeed = clamp(this.speed * (1 + delta), 0.6, 5.0);
      if (Math.abs(newSpeed - this.speed) > 0.25) mutatedTraits.push('Speed');
    }
    if (Math.random() < mutRate) {
      const delta = gaussianRandom() * mutStrength;
      newVision = clamp(this.vision * (1 + delta), 20, 220);
      if (Math.abs(newVision - this.vision) > 12) mutatedTraits.push('Vision');
    }
    if (Math.random() < mutRate) {
      const delta = gaussianRandom() * mutStrength;
      newEfficiency = clamp(this.efficiency * (1 + delta), 0.4, 2.5);
      if (Math.abs(newEfficiency - this.efficiency) > 0.12) mutatedTraits.push('Efficiency');
    }

    const offsetAngle = this.angle + Math.PI + (Math.random() - 0.5) * 0.8;
    const childX = clamp(this.x + Math.cos(offsetAngle) * 14, 15, sim.width - 15);
    const childY = clamp(this.y + Math.sin(offsetAngle) * 14, 15, sim.height - 15);

    const child = new Creature(
      childX,
      childY,
      {
        speed: newSpeed,
        vision: newVision,
        efficiency: newEfficiency,
        energy: childEnergy
      },
      this.generation + 1
    );

    return { child, mutatedTraits };
  }

  /**
   * Compute monochrome luminance according to traits
   */
  getColor() {
    const normSpeed = clamp((this.speed - 0.6) / (5.0 - 0.6), 0, 1);
    const lum = Math.round(165 + normSpeed * 90);
    return `rgb(${lum}, ${lum}, ${lum})`;
  }
}

class FoodPellet {
  constructor(x, y, energyValue) {
    this.x = x;
    this.y = y;
    this.energy = energyValue;
    this.radius = 3 + (energyValue / 40) * 1.1;
    this.pulse = Math.random() * Math.PI * 2;
  }
}

class ParticleRing {
  constructor(x, y, color = '#ffffff', maxRadius = 22, duration = 0.55) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
    return this.elapsed < this.duration;
  }
}

class EcosystemSimulation {
  constructor(width, height) {
    this.width = width || 800;
    this.height = height || 600;

    this.config = {
      baselineSpeed: 2.2,
      baselineVision: 90,
      baselineEfficiency: 1.0,
      initialPopulation: 28,
      initialFood: 55,
      maxFood: 180,
      foodSpawnRate: 3.5, // pellets per second
      foodEnergy: 40,
      mutationRate: 0.75,
      mutationStrength: 0.15,
      metabolismMultiplier: 1.0,
      reproductionThreshold: 150,
      colorMode: 'mono',
      showVisionRings: false,
      showEnergyArcs: true
    };

    this.creatures = [];
    this.foods = [];
    this.particles = [];
    this.history = [];
    this.logs = [];

    this.simTime = 0;
    this.foodAccumulator = 0;
    this.historySampleTimer = 0;
    this.totalBirths = 0;
    this.totalDeaths = 0;
    this.maxGeneration = 1;
    this.selectedCreature = null;

    this.reset();
  }

  addLog(message) {
    const timeStr = `${Math.floor(this.simTime)}s`;
    this.logs.unshift({ time: timeStr, message });
    if (this.logs.length > 25) {
      this.logs.pop();
    }
  }

  reset() {
    Creature.nextId = 1;
    this.creatures = [];
    this.foods = [];
    this.particles = [];
    this.history = [];
    this.logs = [];
    this.simTime = 0;
    this.foodAccumulator = 0;
    this.historySampleTimer = 0;
    this.totalBirths = 0;
    this.totalDeaths = 0;
    this.maxGeneration = 1;
    this.selectedCreature = null;

    // Spawn founder population with slight natural variation around baseline
    for (let i = 0; i < this.config.initialPopulation; i++) {
      this.spawnCreatureWithJitter(
        this.config.baselineSpeed,
        this.config.baselineVision,
        this.config.baselineEfficiency,
        0.08
      );
    }

    // Spawn initial food supply
    for (let i = 0; i < this.config.initialFood; i++) {
      this.spawnFood();
    }

    this.recordHistorySnapshot();
    this.addLog(
      `INIT: ${this.config.initialPopulation} organisms (SPD ${this.config.baselineSpeed.toFixed(1)}, VIS ${this.config.baselineVision}, EFF ${this.config.baselineEfficiency.toFixed(2)})`
    );
  }

  spawnCreatureWithJitter(speed, vision, efficiency, jitter = 0.05, x = null, y = null) {
    const px = x ?? (30 + Math.random() * (this.width - 60));
    const py = y ?? (30 + Math.random() * (this.height - 60));
    const c = new Creature(
      px,
      py,
      {
        speed: speed * (1 + gaussianRandom() * jitter),
        vision: vision * (1 + gaussianRandom() * jitter),
        efficiency: efficiency * (1 + gaussianRandom() * jitter),
        energy: 95 + Math.random() * 20
      },
      1
    );
    this.creatures.push(c);
    this.particles.push(new ParticleRing(px, py, '#ffffff', 18, 0.45));
    return c;
  }

  spawnFood(x = null, y = null) {
    if (this.foods.length >= this.config.maxFood && x === null) return;
    const pad = 22;
    const fx = x ?? (pad + Math.random() * (this.width - pad * 2));
    const fy = y ?? (pad + Math.random() * (this.height - pad * 2));
    this.foods.push(new FoodPellet(fx, fy, this.config.foodEnergy));
  }

  resize(width, height) {
    if (width > 100 && height > 100) {
      this.width = width;
      this.height = height;
    }
  }

  step(dt) {
    this.simTime += dt;

    // 1. Spawn food continuously
    this.foodAccumulator += this.config.foodSpawnRate * dt;
    while (this.foodAccumulator >= 1) {
      this.foodAccumulator -= 1;
      this.spawnFood();
    }

    // 2. Update food pulse animations
    for (let i = 0; i < this.foods.length; i++) {
      this.foods[i].pulse += dt * 3.5;
    }

    // 3. Update creatures, check foraging & reproduction & starvation
    const newbornList = [];

    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.update(dt, this);

      // Check food consumption
      for (let j = this.foods.length - 1; j >= 0; j--) {
        const f = this.foods[j];
        const dx = f.x - c.x;
        const dy = f.y - c.y;
        const reach = c.radius + f.radius + 2;
        if (dx * dx + dy * dy <= reach * reach) {
          // Absorb energy scaled by efficiency
          const absorbed = f.energy * (0.75 + 0.25 * c.efficiency);
          c.energy = Math.min(c.energy + absorbed, this.config.reproductionThreshold * 1.45);
          this.foods.splice(j, 1);
          break;
        }
      }

      // Check asexual reproduction (mitosis) when energy threshold reached
      if (
        c.energy >= this.config.reproductionThreshold &&
        c.reproCooldown <= 0 &&
        this.creatures.length + newbornList.length < 180
      ) {
        const { child, mutatedTraits } = c.reproduce(this);
        newbornList.push(child);
        this.totalBirths += 1;
        this.particles.push(new ParticleRing(child.x, child.y, '#ffffff', 24, 0.55));

        if (child.generation > this.maxGeneration) {
          this.maxGeneration = child.generation;
          this.addLog(
            `GEN ${this.maxGeneration} // SPD ${child.speed.toFixed(2)} VIS ${Math.round(child.vision)} EFF ${child.efficiency.toFixed(2)}`
          );
        } else if (mutatedTraits.length >= 2) {
          this.addLog(
            `MUTANT #${child.id} (G${child.generation}): ${mutatedTraits.join(' + ')}`
          );
        }
      }

      // Check death by starvation
      if (c.energy <= 0) {
        this.creatures.splice(i, 1);
        this.totalDeaths += 1;
        this.particles.push(new ParticleRing(c.x, c.y, 'rgba(255, 255, 255, 0.4)', 18, 0.4));
        if (this.selectedCreature && this.selectedCreature.id === c.id) {
          this.selectedCreature = null;
        }
      }
    }

    if (newbornList.length > 0) {
      this.creatures.push(...newbornList);
    }

    // 4. Extinction safeguard: re-seed founders if population hits 0
    if (this.creatures.length === 0) {
      this.addLog('EXTINCTION // Reseeding 10 organisms');
      for (let i = 0; i < 10; i++) {
        this.spawnCreatureWithJitter(
          this.config.baselineSpeed,
          this.config.baselineVision,
          this.config.baselineEfficiency,
          0.15
        );
      }
    }

    // 5. Update particle effects
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) {
        this.particles.splice(i, 1);
      }
    }

    // 6. Sample statistics for live charts every 0.8s of sim time
    this.historySampleTimer += dt;
    if (this.historySampleTimer >= 0.8) {
      this.historySampleTimer = 0;
      this.recordHistorySnapshot();
    }
  }

  getAverages() {
    const n = this.creatures.length;
    if (n === 0) {
      return {
        avgSpeed: this.config.baselineSpeed,
        avgVision: this.config.baselineVision,
        avgEfficiency: this.config.baselineEfficiency
      };
    }
    let sumSpeed = 0;
    let sumVision = 0;
    let sumEff = 0;
    for (let i = 0; i < n; i++) {
      const c = this.creatures[i];
      sumSpeed += c.speed;
      sumVision += c.vision;
      sumEff += c.efficiency;
    }
    return {
      avgSpeed: sumSpeed / n,
      avgVision: sumVision / n,
      avgEfficiency: sumEff / n
    };
  }

  recordHistorySnapshot() {
    const { avgSpeed, avgVision, avgEfficiency } = this.getAverages();
    this.history.push({
      time: this.simTime,
      population: this.creatures.length,
      foodCount: this.foods.length,
      avgSpeed,
      avgVision,
      avgEfficiency
    });
    if (this.history.length > 160) {
      this.history.shift();
    }
  }

  /**
   * Render ecosystem onto the main HTML5 canvas in crisp black & white
   */
  render(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);

    // Subtle monochrome dot matrix / grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 48;
    for (let x = gridSize; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = gridSize; y < this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();

    // Render Food Pellets (crisp geometric squares/diamonds)
    for (let i = 0; i < this.foods.length; i++) {
      const f = this.foods[i];
      const pulseSize = f.radius + Math.sin(f.pulse) * 0.8;

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-pulseSize * 0.7, -pulseSize * 0.7, pulseSize * 1.4, pulseSize * 1.4);
      ctx.restore();
    }

    // Render Particle Rings
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const progress = clamp(p.elapsed / p.duration, 0, 1);
      const r = 4 + progress * p.maxRadius;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Render Creatures
    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i];
      const isSelected = this.selectedCreature && this.selectedCreature.id === c.id;
      const strokeColor = c.getColor();
      const r = c.radius;

      // 1. Vision Ring
      if (this.config.showVisionRings || isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.vision, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
          ? 'rgba(255, 255, 255, 0.55)'
          : 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();

        if (isSelected && c.targetFood) {
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.targetFood.x, c.targetFood.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.setLineDash([2, 3]);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Energy Progress Arc
      if (this.config.showEnergyArcs || isSelected) {
        const energyRatio = clamp(c.energy / this.config.reproductionThreshold, 0, 1);
        ctx.save();
        ctx.beginPath();
        ctx.arc(
          c.x,
          c.y,
          r + 4,
          -Math.PI / 2,
          -Math.PI / 2 + energyRatio * Math.PI * 2
        );
        ctx.strokeStyle = energyRatio > 0.75 ? '#ffffff' : 'rgba(255, 255, 255, 0.42)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Selection Target Reticle
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        const box = r + 9;
        ctx.strokeRect(c.x - box, c.y - box, box * 2, box * 2);
        ctx.restore();
      }

      // 4. Creature Body & Flagellum
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      // Flagellum / Tail length scales with Speed trait
      const tailLen = 5 + c.speed * 3.2;
      const wag = Math.sin(c.tailPhase) * (2.2 + c.speed * 0.7);
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.quadraticCurveTo(-r - tailLen * 0.5, wag, -r - tailLen, -wag * 0.6);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Cell Body
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.18, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#090909';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Inner Nucleus (size reflects Energy Efficiency trait)
      const nucleusRadius = clamp(r * 0.26 * c.efficiency, 1.4, r * 0.62);
      ctx.beginPath();
      ctx.arc(-r * 0.15, 0, nucleusRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Eyespots (size reflects Vision trait)
      const eyeSize = clamp(1.0 + (c.vision / 220) * 1.6, 1.0, 2.5);
      const eyeOffsetX = r * 0.55;
      const eyeOffsetY = r * 0.4;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeOffsetX, -eyeOffsetY, eyeSize, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}

window.EcosystemSimulation = EcosystemSimulation;
