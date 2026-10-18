/**
 * Monochrome Live Evolution Charts & Population Distribution Renderer
 */

class EvolutionCharts {
  constructor(traitsCanvas, popCanvas, distCanvas) {
    this.traitsCanvas = traitsCanvas;
    this.popCanvas = popCanvas;
    this.distCanvas = distCanvas;

    this.traitsCtx = traitsCanvas.getContext('2d');
    this.popCtx = popCanvas.getContext('2d');
    this.distCtx = distCanvas.getContext('2d');

    this.resizeAll();
  }

  resizeCanvas(canvas, ctx) {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(100, Math.floor(rect.width));
    const h = Math.max(80, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  resizeAll() {
    this.resizeCanvas(this.traitsCanvas, this.traitsCtx);
    this.resizeCanvas(this.popCanvas, this.popCtx);
    this.resizeCanvas(this.distCanvas, this.distCtx);
  }

  render(sim) {
    this.renderTraitsChart(sim.history);
    this.renderPopulationChart(sim.history);
    this.renderDistributionChart(sim.creatures);
  }

  drawGrid(ctx, w, h, pad) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    const rows = 3;
    const plotH = h - pad.top - pad.bottom;
    for (let i = 0; i <= rows; i++) {
      const y = pad.top + (plotH / rows) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }
  }

  drawSeries(ctx, points, w, h, pad, color, lineDash = [], fillAlpha = 0) {
    if (points.length < 2) return;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.save();
    ctx.setLineDash(lineDash);
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = pad.left + (i / (points.length - 1)) * plotW;
      const y = pad.top + (1 - Math.max(0, Math.min(1, points[i]))) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    if (fillAlpha > 0) {
      ctx.setLineDash([]);
      ctx.lineTo(pad.left + plotW, pad.top + plotH);
      ctx.lineTo(pad.left, pad.top + plotH);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 255, 255, ${fillAlpha})`;
      ctx.fill();
    }
    ctx.restore();
  }

  renderTraitsChart(history) {
    const ctx = this.traitsCtx;
    const { w, h } = this.resizeCanvas(this.traitsCanvas, ctx);
    const pad = { top: 6, right: 6, bottom: 10, left: 6 };

    this.drawGrid(ctx, w, h, pad);
    if (history.length < 2) return;

    const speedSeries = history.map((d) => (d.avgSpeed - 0.6) / (5.0 - 0.6));
    const visionSeries = history.map((d) => (d.avgVision - 20) / (220 - 20));
    const effSeries = history.map((d) => (d.avgEfficiency - 0.4) / (2.5 - 0.4));

    // Speed = Solid White, Vision = Dashed Light Gray, Efficiency = Dotted Mid Gray
    this.drawSeries(ctx, speedSeries, w, h, pad, '#ffffff', [], 0.05);
    this.drawSeries(ctx, visionSeries, w, h, pad, '#b3b3b3', [5, 3], 0);
    this.drawSeries(ctx, effSeries, w, h, pad, '#808080', [2, 2], 0);
  }

  renderPopulationChart(history) {
    const ctx = this.popCtx;
    const { w, h } = this.resizeCanvas(this.popCanvas, ctx);
    const pad = { top: 6, right: 6, bottom: 10, left: 6 };

    this.drawGrid(ctx, w, h, pad);
    if (history.length < 2) return;

    let maxVal = 60;
    for (let i = 0; i < history.length; i++) {
      maxVal = Math.max(maxVal, history[i].population, history[i].foodCount / 2.5);
    }

    const popSeries = history.map((d) => d.population / maxVal);
    const foodSeries = history.map((d) => (d.foodCount / 3) / maxVal);

    this.drawSeries(ctx, foodSeries, w, h, pad, '#8c8c8c', [4, 4], 0);
    this.drawSeries(ctx, popSeries, w, h, pad, '#ffffff', [], 0.1);
  }

  renderDistributionChart(creatures) {
    const ctx = this.distCtx;
    const { w, h } = this.resizeCanvas(this.distCanvas, ctx);
    ctx.clearRect(0, 0, w, h);

    const bins = 12;
    const speedBins = new Array(bins).fill(0);
    const visionBins = new Array(bins).fill(0);
    const effBins = new Array(bins).fill(0);

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      const sIdx = Math.min(bins - 1, Math.max(0, Math.floor(((c.speed - 0.6) / 4.4) * bins)));
      const vIdx = Math.min(bins - 1, Math.max(0, Math.floor(((c.vision - 20) / 200) * bins)));
      const eIdx = Math.min(bins - 1, Math.max(0, Math.floor(((c.efficiency - 0.4) / 2.1) * bins)));
      speedBins[sIdx]++;
      visionBins[vIdx]++;
      effBins[eIdx]++;
    }

    const maxCount = Math.max(4, ...speedBins, ...visionBins, ...effBins);

    const rows = [
      { label: 'SPD', data: speedBins, color: '#ffffff' },
      { label: 'VIS', data: visionBins, color: '#cccccc' },
      { label: 'EFF', data: effBins, color: '#999999' }
    ];

    const rowHeight = Math.floor((h - 6) / 3);
    const labelW = 34;
    const plotW = w - labelW - 6;
    const barGap = 2;
    const barW = (plotW - barGap * (bins - 1)) / bins;

    ctx.font = '700 9px Silkscreen, monospace';
    ctx.textBaseline = 'middle';

    rows.forEach((row, rIdx) => {
      const topY = 3 + rIdx * rowHeight;
      const maxBarH = rowHeight - 8;
      const baseLineY = topY + maxBarH;

      ctx.fillStyle = '#a3a3a3';
      ctx.fillText(row.label, 2, topY + maxBarH * 0.5);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(labelW, baseLineY);
      ctx.lineTo(labelW + plotW, baseLineY);
      ctx.stroke();

      for (let b = 0; b < bins; b++) {
        const count = row.data[b];
        const ratio = count / maxCount;
        const bh = Math.max(2, ratio * maxBarH);
        const bx = labelW + b * (barW + barGap);
        const by = baseLineY - bh;

        ctx.fillStyle = count > 0 ? row.color : 'rgba(255, 255, 255, 0.1)';
        ctx.globalAlpha = count > 0 ? 0.35 + ratio * 0.65 : 0.4;
        ctx.fillRect(bx, by, barW, bh);
      }
      ctx.globalAlpha = 1;
    });
  }
}

window.EvolutionCharts = EvolutionCharts;
