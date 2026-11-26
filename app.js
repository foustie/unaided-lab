(() => {
  const cortexCanvas = document.getElementById("cortex-canvas");
  const ctx = cortexCanvas.getContext("2d");
  const eegCanvas = document.getElementById("eeg-canvas");
  const eegCtx = eegCanvas.getContext("2d");
  const eegStat = document.getElementById("eeg-stat");
  const buttons = document.querySelectorAll(".sw-btn");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mode = "unaided";
  let energy = 1;
  let width = 0;
  let height = 0;
  let dpr = 1;

  const nodes = [];
  const edges = [];
  const pulses = [];

  function buildCortex() {
    nodes.length = 0;
    edges.length = 0;
    pulses.length = 0;

    const isWide = width > 820;
    const cx = isWide ? width * 0.68 : width * 0.5;
    const cy = isWide ? height * 0.5 : height * 0.36;
    const rx = isWide ? Math.min(width * 0.3, 400) : Math.min(width * 0.46, 220);
    const ry = isWide ? Math.min(height * 0.38, 300) : Math.min(height * 0.26, 170);
    const count = isWide ? 108 : 60;

    // Input & output anchors for the Crutch bypass beam
    nodes.push({
      x: cx - rx * 0.94,
      y: cy + ry * 0.06,
      bx: cx - rx * 0.94,
      by: cy + ry * 0.06,
      r: 3.4,
      phase: 0,
      charge: 0.7,
      anchor: true
    });
    nodes.push({
      x: cx + rx * 0.94,
      y: cy - ry * 0.06,
      bx: cx + rx * 0.94,
      by: cy - ry * 0.06,
      r: 3.4,
      phase: 1.4,
      charge: 0.7,
      anchor: true
    });

    for (let i = 0; i < count; i++) {
      const lobe = i % 2 === 0 ? -0.18 : 0.16;
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random());
      const x = cx + (Math.cos(angle) * rad * 0.9 + lobe * 0.52) * rx;
      const y = cy + (Math.sin(angle) * rad * (0.86 + 0.14 * Math.cos(angle * 2))) * ry;
      nodes.push({
        x,
        y,
        bx: x,
        by: y,
        r: 1.5 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        charge: Math.random() * 0.4,
        anchor: false
      });
    }

    const maxDist = isWide ? 122 : 90;
    for (let i = 2; i < nodes.length; i++) {
      let links = 0;
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.hypot(nodes[i].bx - nodes[j].bx, nodes[i].by - nodes[j].by);
        if (dist < maxDist && links < 4) {
          edges.push({ a: i, b: j });
          links++;
        }
      }
    }

    for (let aIdx = 0; aIdx < 2; aIdx++) {
      nodes
        .map((n, idx) => ({ idx, d: Math.hypot(n.bx - nodes[aIdx].bx, n.by - nodes[aIdx].by) }))
        .filter((o) => o.idx >= 2)
        .sort((x, y) => x.d - y.d)
        .slice(0, 4)
        .forEach((o) => edges.push({ a: aIdx, b: o.idx }));
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    cortexCanvas.width = Math.floor(width * dpr);
    cortexCanvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rect = eegCanvas.getBoundingClientRect();
    eegCanvas.width = Math.max(140, Math.floor(rect.width * dpr));
    eegCanvas.height = Math.floor(44 * dpr);
    eegCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildCortex();
  }

  function spawnPulse(edgeIdx, speedScale = 1, warm = true) {
    if (pulses.length > 100 || edges.length === 0) return;
    const e = edges[edgeIdx];
    const rev = Math.random() > 0.5;
    pulses.push({
      from: rev ? e.b : e.a,
      to: rev ? e.a : e.b,
      t: 0,
      speed: (0.016 + Math.random() * 0.022) * speedScale,
      warm
    });
  }

  function sparkNear(x, y) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < 140) {
        n.charge = Math.min(1, n.charge + (1 - d / 140) * 0.9);
      }
    }
    for (let k = 0; k < edges.length; k++) {
      const nA = nodes[edges[k].a];
      if (Math.hypot(nA.x - x, nA.y - y) < 130 && Math.random() < 0.38) {
        spawnPulse(k, 1.4, mode === "unaided");
      }
    }
  }

  const samples = new Array(110).fill(0);
  let eegTick = 0;

  function drawEEG() {
    const w = eegCanvas.width / dpr;
    const h = eegCanvas.height / dpr;
    eegCtx.clearRect(0, 0, w, h);

    eegTick += 0.2 + energy * 0.28;
    const gamma =
      Math.sin(eegTick * 1.9) * 8 +
      Math.sin(eegTick * 4.8) * 5.5 +
      Math.cos(eegTick * 8.1) * 3.2;
    const spike = Math.random() < 0.07 * energy ? (Math.random() > 0.5 ? 9 : -8) : 0;
    const flat = Math.sin(eegTick * 0.4) * 1.6;
    samples.push(flat * (1 - energy) + (gamma + spike) * energy);
    if (samples.length > 110) samples.shift();

    eegCtx.save();
    eegCtx.strokeStyle = energy > 0.45 ? "#FF4226" : "#6F7C8C";
    eegCtx.lineWidth = 1.75;
    eegCtx.shadowBlur = energy > 0.45 ? 10 : 0;
    eegCtx.shadowColor = "rgba(255, 66, 38, 0.85)";
    eegCtx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const px = (i / (samples.length - 1)) * w;
      const py = h / 2 - samples[i];
      if (i === 0) eegCtx.moveTo(px, py);
      else eegCtx.lineTo(px, py);
    }
    eegCtx.stroke();
    eegCtx.restore();
  }

  let frame = 0;
  function tick(ts) {
    frame++;
    energy += ((mode === "unaided" ? 1 : 0) - energy) * 0.065;
    ctx.clearRect(0, 0, width, height);

    const t = ts * 0.001;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const amp = 2 + energy * 5;
      n.x = n.bx + Math.sin(t * 0.85 + n.phase) * amp;
      n.y = n.by + Math.cos(t * 0.72 + n.phase * 1.2) * amp;
      n.charge *= 0.965;
      if (energy > 0.5 && Math.random() < 0.008 * energy) {
        n.charge = Math.min(1, n.charge + 0.75);
      }
    }

    for (let i = 0; i < edges.length; i++) {
      const a = nodes[edges[i].a];
      const b = nodes[edges[i].b];
      const glow = Math.max(a.charge, b.charge) * energy;
      const alpha = 0.045 + energy * 0.13 + glow * 0.36;
      ctx.strokeStyle =
        energy > 0.35
          ? `rgba(255, ${Math.round(98 + glow * 115)}, ${Math.round(58 + glow * 65)}, ${alpha.toFixed(3)})`
          : `rgba(115, 130, 148, ${(0.045 + glow * 0.06).toFixed(3)})`;
      ctx.lineWidth = 0.85 + glow * 1.25;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (energy < 0.75 && nodes.length >= 2) {
      const inNode = nodes[0];
      const outNode = nodes[1];
      const bypass = (1 - energy) * 0.88;
      ctx.save();
      ctx.strokeStyle = `rgba(150, 170, 195, ${bypass.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 44;
      ctx.beginPath();
      ctx.moveTo(inNode.x, inNode.y);
      ctx.lineTo(outNode.x, outNode.y);
      ctx.stroke();

      const prog = (t * 0.78) % 1;
      const px = inNode.x + (outNode.x - inNode.x) * prog;
      const py = inNode.y + (outNode.y - inNode.y) * prog;
      ctx.fillStyle = `rgba(220, 232, 248, ${bypass.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (energy > 0.25 && Math.random() < 0.55 * energy && edges.length > 0) {
      spawnPulse(Math.floor(Math.random() * edges.length), 0.95 + energy * 0.65, true);
    }

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += p.speed;
      if (p.t >= 1) {
        nodes[p.to].charge = Math.min(1, nodes[p.to].charge + 0.8 * energy);
        pulses.splice(i, 1);
        continue;
      }
      const a = nodes[p.from];
      const b = nodes[p.to];
      ctx.fillStyle = p.warm ? "rgba(255, 209, 102, 0.96)" : "rgba(170, 190, 210, 0.65)";
      ctx.beginPath();
      ctx.arc(a.x + (b.x - a.x) * p.t, a.y + (b.y - a.y) * p.t, p.warm ? 2.5 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const lit = n.charge * energy;
      const radius = n.r + lit * 2.3;
      if (lit > 0.18) {
        ctx.fillStyle = `rgba(255, 66, 38, ${(lit * 0.4).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle =
        energy > 0.35
          ? `rgba(255, ${Math.round(135 + lit * 120)}, ${Math.round(90 + lit * 135)}, ${(0.32 + energy * 0.35 + lit * 0.33).toFixed(3)})`
          : `rgba(128, 142, 160, ${(0.2 + (n.anchor ? 0.58 : 0)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (frame % 24 === 0) {
      eegStat.textContent = mode === "unaided"
        ? `${36 + Math.floor(Math.random() * 8)} Hz`
        : `${6 + Math.floor(Math.random() * 2)} Hz`;
    }

    drawEEG();
    if (!reducedMotion) requestAnimationFrame(tick);
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
      for (let i = 0; i < 22 && edges.length > 0; i++) {
        spawnPulse(Math.floor(Math.random() * edges.length), 1.45, true);
      }
    }
  }

  buttons.forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

  window.addEventListener("pointermove", (e) => {
    if (mode === "unaided") sparkNear(e.clientX, e.clientY);
  });

  window.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("a, button")) sparkNear(e.clientX, e.clientY);
  });

  window.addEventListener("resize", resize);
  resize();
  setMode("unaided");
  requestAnimationFrame(tick);
})();
