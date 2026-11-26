(() => {
  const cortexCanvas = document.getElementById("cortex-canvas");
  const ctx = cortexCanvas.getContext("2d");
  const eegCanvas = document.getElementById("eeg-canvas");
  const eegCtx = eegCanvas.getContext("2d");

  const statePill = document.getElementById("state-pill");
  const valLoad = document.getElementById("val-load");
  const valHz = document.getElementById("val-hz");
  const valRet = document.getElementById("val-ret");
  const modeCaption = document.getElementById("mode-caption");
  const eegChannel = document.getElementById("eeg-channel");
  const buttons = document.querySelectorAll(".mode-btn");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mode = "unaided";
  let energy = 1; // smoothly lerps between 0 (crutch) and 1 (unaided)
  let width = 0;
  let height = 0;
  let dpr = 1;
  let pointer = { x: -9999, y: -9999, active: false };

  // Neural graph state
  const nodes = [];
  const edges = [];
  const pulses = [];

  // Brain-like elliptical silhouette centered right-of-center on desktop
  function buildCortex() {
    nodes.length = 0;
    edges.length = 0;
    pulses.length = 0;

    const isWide = width > 840;
    const cx = isWide ? width * 0.69 : width * 0.52;
    const cy = isWide ? height * 0.46 : height * 0.34;
    const rx = isWide ? Math.min(width * 0.27, 360) : Math.min(width * 0.44, 210);
    const ry = isWide ? Math.min(height * 0.34, 270) : Math.min(height * 0.24, 155);
    const count = isWide ? 96 : 56;

    // Input and output anchor nodes for the "Crutch shortcut" line
    nodes.push({
      x: cx - rx * 0.92,
      y: cy + ry * 0.08,
      bx: cx - rx * 0.92,
      by: cy + ry * 0.08,
      r: 3.2,
      phase: 0,
      charge: 0.7,
      anchor: "in"
    });
    nodes.push({
      x: cx + rx * 0.92,
      y: cy - ry * 0.06,
      bx: cx + rx * 0.92,
      by: cy - ry * 0.06,
      r: 3.2,
      phase: 1.5,
      charge: 0.7,
      anchor: "out"
    });

    for (let i = 0; i < count; i++) {
      // Two slightly overlapping cortical lobes for an organic brain silhouette
      const lobe = i % 2 === 0 ? -0.18 : 0.16;
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random());
      const x = cx + (Math.cos(angle) * rad * 0.88 + lobe * 0.5) * rx;
      const y = cy + (Math.sin(angle) * rad * (0.86 + 0.14 * Math.cos(angle * 2))) * ry;
      nodes.push({
        x,
        y,
        bx: x,
        by: y,
        r: 1.4 + Math.random() * 2.1,
        phase: Math.random() * Math.PI * 2,
        charge: Math.random() * 0.4,
        anchor: null
      });
    }

    const maxDist = isWide ? 115 : 88;
    for (let i = 2; i < nodes.length; i++) {
      let connections = 0;
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].bx - nodes[j].bx;
        const dy = nodes[i].by - nodes[j].by;
        const dist = Math.hypot(dx, dy);
        if (dist < maxDist && connections < 4) {
          edges.push({ a: i, b: j, dist });
          connections++;
        }
      }
    }

    // Connect anchors to nearby interior nodes
    for (let aIdx = 0; aIdx < 2; aIdx++) {
      const sorted = nodes
        .map((n, idx) => ({ idx, d: Math.hypot(n.bx - nodes[aIdx].bx, n.by - nodes[aIdx].by) }))
        .filter((o) => o.idx >= 2)
        .sort((x, y) => x.d - y.d)
        .slice(0, 4);
      sorted.forEach((o) => edges.push({ a: aIdx, b: o.idx, dist: o.d }));
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    cortexCanvas.width = Math.floor(width * dpr);
    cortexCanvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const eegRect = eegCanvas.getBoundingClientRect();
    eegCanvas.width = Math.max(300, Math.floor(eegRect.width * dpr));
    eegCanvas.height = Math.floor(78 * dpr);
    eegCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildCortex();
  }

  function spawnPulse(edgeIdx, speedScale = 1, warm = true) {
    if (pulses.length > 90 || edges.length === 0) return;
    const e = edges[edgeIdx];
    const reverse = Math.random() > 0.5;
    pulses.push({
      from: reverse ? e.b : e.a,
      to: reverse ? e.a : e.b,
      t: 0,
      speed: (0.015 + Math.random() * 0.022) * speedScale,
      warm
    });
  }

  function sparkNear(x, y) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < 130) {
        n.charge = Math.min(1, n.charge + (1 - d / 130) * 0.85);
      }
    }
    for (let k = 0; k < edges.length; k++) {
      const nA = nodes[edges[k].a];
      if (Math.hypot(nA.x - x, nA.y - y) < 120 && Math.random() < 0.35) {
        spawnPulse(k, 1.35, mode === "unaided");
      }
    }
  }

  // EEG waveform history
  const eegSamples = new Array(220).fill(0);
  let eegTick = 0;

  function drawEEG(t) {
    const w = eegCanvas.width / dpr;
    const h = eegCanvas.height / dpr;

    eegCtx.clearRect(0, 0, w, h);

    // Subtle calibration grid
    eegCtx.strokeStyle = "rgba(243, 241, 236, 0.06)";
    eegCtx.lineWidth = 1;
    eegCtx.beginPath();
    for (let x = 0; x < w; x += 36) {
      eegCtx.moveTo(x, 0);
      eegCtx.lineTo(x, h);
    }
    eegCtx.moveTo(0, h / 2);
    eegCtx.lineTo(w, h / 2);
    eegCtx.stroke();

    // Generate next EEG sample based on cognitive energy
    eegTick += 0.18 + energy * 0.24;
    const gamma =
      Math.sin(eegTick * 1.9) * 14 +
      Math.sin(eegTick * 4.7) * 9 +
      Math.cos(eegTick * 8.3) * 5 +
      (Math.random() - 0.5) * 6;
    const spike = Math.random() < 0.06 * energy ? (Math.random() > 0.5 ? 16 : -14) : 0;
    const passive = Math.sin(eegTick * 0.45) * 3.2 + (Math.random() - 0.5) * 1.4;
    const sample = passive * (1 - energy) + (gamma + spike) * energy;

    eegSamples.push(sample);
    if (eegSamples.length > 220) eegSamples.shift();

    // Draw glow + core trace
    const strokeColor = energy > 0.45
      ? `rgba(255, ${Math.round(92 + 55 * energy)}, 46, 0.95)`
      : "rgba(130, 148, 168, 0.72)";

    eegCtx.save();
    eegCtx.strokeStyle = strokeColor;
    eegCtx.lineWidth = 1.65;
    eegCtx.shadowBlur = energy > 0.45 ? 10 : 0;
    eegCtx.shadowColor = "rgba(255, 77, 46, 0.75)";
    eegCtx.beginPath();
    for (let i = 0; i < eegSamples.length; i++) {
      const px = (i / (eegSamples.length - 1)) * w;
      const py = h / 2 - eegSamples[i];
      if (i === 0) eegCtx.moveTo(px, py);
      else eegCtx.lineTo(px, py);
    }
    eegCtx.stroke();
    eegCtx.restore();

    // Live head dot
    const lastY = h / 2 - eegSamples[eegSamples.length - 1];
    eegCtx.fillStyle = energy > 0.45 ? "#FFD166" : "#9BA7B5";
    eegCtx.beginPath();
    eegCtx.arc(w - 2, lastY, 2.8, 0, Math.PI * 2);
    eegCtx.fill();
  }

  let frame = 0;
  function tick(ts) {
    frame++;
    const target = mode === "unaided" ? 1 : 0;
    energy += (target - energy) * 0.06;

    ctx.clearRect(0, 0, width, height);

    // Subtle organic breathing drift on nodes
    const t = ts * 0.001;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const amp = 2.5 + energy * 4.5;
      n.x = n.bx + Math.sin(t * 0.8 + n.phase) * amp;
      n.y = n.by + Math.cos(t * 0.7 + n.phase * 1.3) * amp;
      n.charge *= 0.965;
      if (energy > 0.5 && Math.random() < 0.006 * energy) {
        n.charge = Math.min(1, n.charge + 0.7);
      }
    }

    // Draw cortical edges
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const a = nodes[e.a];
      const b = nodes[e.b];
      const activeGlow = Math.max(a.charge, b.charge) * energy;
      const alpha = 0.04 + energy * 0.11 + activeGlow * 0.32;
      ctx.strokeStyle =
        energy > 0.35
          ? `rgba(255, ${Math.round(115 + activeGlow * 95)}, ${Math.round(70 + activeGlow * 50)}, ${alpha.toFixed(3)})`
          : `rgba(120, 136, 154, ${(0.05 + activeGlow * 0.08).toFixed(3)})`;
      ctx.lineWidth = 0.8 + activeGlow * 1.1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // In Crutch mode, draw one cold straight bypass beam (AI skips the human cortex)
    if (energy < 0.75 && nodes.length >= 2) {
      const inNode = nodes[0];
      const outNode = nodes[1];
      const bypassAlpha = (1 - energy) * 0.85;
      ctx.save();
      ctx.strokeStyle = `rgba(155, 175, 198, ${bypassAlpha.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.moveTo(inNode.x, inNode.y);
      ctx.lineTo(outNode.x, outNode.y);
      ctx.stroke();

      // Single fast cold packet bypassing the brain
      const progress = (t * 0.75) % 1;
      const px = inNode.x + (outNode.x - inNode.x) * progress;
      const py = inNode.y + (outNode.y - inNode.y) * progress;
      ctx.fillStyle = `rgba(210, 226, 245, ${bypassAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Spawn live synaptic pulses in Unaided mode
    if (energy > 0.25 && Math.random() < 0.45 * energy && edges.length > 0) {
      spawnPulse(Math.floor(Math.random() * edges.length), 0.9 + energy * 0.6, true);
    }

    // Update & render pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += p.speed;
      if (p.t >= 1) {
        nodes[p.to].charge = Math.min(1, nodes[p.to].charge + 0.75 * energy);
        pulses.splice(i, 1);
        continue;
      }
      const a = nodes[p.from];
      const b = nodes[p.to];
      const px = a.x + (b.x - a.x) * p.t;
      const py = a.y + (b.y - a.y) * p.t;
      ctx.fillStyle = p.warm ? "rgba(255, 209, 102, 0.95)" : "rgba(170, 190, 210, 0.65)";
      ctx.beginPath();
      ctx.arc(px, py, p.warm ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render neurons
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const lit = n.charge * energy;
      const radius = n.r + lit * 2.1;
      if (lit > 0.2) {
        ctx.fillStyle = `rgba(255, 77, 46, ${(lit * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle =
        energy > 0.35
          ? `rgba(255, ${Math.round(140 + lit * 115)}, ${Math.round(95 + lit * 130)}, ${(0.3 + energy * 0.35 + lit * 0.35).toFixed(3)})`
          : `rgba(128, 142, 160, ${(0.22 + (n.anchor ? 0.55 : 0)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Live jitter on telemetry numbers every ~20 frames
    if (frame % 22 === 0) {
      if (mode === "unaided") {
        valLoad.textContent = `${84 + Math.floor(Math.random() * 11)}%`;
        valHz.textContent = `${(36 + Math.random() * 8).toFixed(1)} Hz (GAMMA)`;
      } else {
        valLoad.textContent = `${9 + Math.floor(Math.random() * 6)}%`;
        valHz.textContent = `${(6.1 + Math.random() * 1.8).toFixed(1)} Hz (PASSIVE)`;
      }
    }

    drawEEG(t);

    if (!reducedMotion) {
      requestAnimationFrame(tick);
    }
  }

  function setMode(nextMode) {
    mode = nextMode;
    document.body.dataset.mode = nextMode;
    buttons.forEach((btn) => {
      const active = btn.dataset.mode === nextMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    if (nextMode === "unaided") {
      statePill.textContent = "STATE: UNAIDED RECALL";
      valRet.textContent = "HIGH";
      eegChannel.textContent = "CH-01 GAMMA SYNC · LIVE";
      modeCaption.textContent = "Active retrieval firing across pathways. Move cursor or tap canvas to trigger synaptic recall.";
      // Burst of wake-up pulses
      for (let i = 0; i < 18 && edges.length > 0; i++) {
        spawnPulse(Math.floor(Math.random() * edges.length), 1.4, true);
      }
    } else {
      statePill.textContent = "STATE: COGNITIVE BYPASS";
      valRet.textContent = "COLLAPSING";
      eegChannel.textContent = "CH-01 PASSIVE BYPASS · FLAT";
      modeCaption.textContent = "Instant answer shortcut bypasses the cortex. You win the battle and lose the war.";
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  window.addEventListener("pointermove", (e) => {
    pointer = { x: e.clientX, y: e.clientY, active: true };
    if (mode === "unaided") {
      sparkNear(e.clientX, e.clientY);
    }
  });

  window.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button")) return;
    sparkNear(e.clientX, e.clientY);
  });

  window.addEventListener("resize", resize);
  resize();
  setMode("unaided");
  requestAnimationFrame(tick);
})();
