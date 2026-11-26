(() => {
  const canvas = document.getElementById("cortex-canvas");
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let mouseX = -9999;
  let mouseY = -9999;

  // 3D cortical point cloud (two subtle hemispheres, slow architectural rotation)
  const points = [];
  const edges = [];
  const signals = [];

  function init() {
    points.length = 0;
    edges.length = 0;
    signals.length = 0;

    const count = width > 820 ? 115 : 64;
    for (let i = 0; i < count; i++) {
      // Distribute on a 3D brain-proportioned ellipsoid with subtle hemispheric split
      const hemi = i % 2 === 0 ? -1 : 1;
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 0.72 + Math.random() * 0.28;

      const x = (Math.sin(phi) * Math.cos(theta) * 0.85 + hemi * 0.22) * r;
      const y = Math.cos(phi) * 0.72 * r;
      const z = Math.sin(phi) * Math.sin(theta) * 1.05 * r;

      points.push({ x, y, z, charge: 0 });
    }

    for (let i = 0; i < points.length; i++) {
      let links = 0;
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(
          points[i].x - points[j].x,
          points[i].y - points[j].y,
          points[i].z - points[j].z
        );
        if (d < 0.48 && links < 4) {
          edges.push([i, j]);
          links++;
        }
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init();
  }

  function render(ts) {
    const t = ts * 0.00022;
    ctx.clearRect(0, 0, width, height);

    const isWide = width > 820;
    const cx = isWide ? width * 0.72 : width * 0.5;
    const cy = isWide ? height * 0.5 : height * 0.34;
    const scale = isWide ? Math.min(width * 0.27, 340) : Math.min(width * 0.42, 200);

    const cosY = Math.cos(t);
    const sinY = Math.sin(t);
    const cosX = Math.cos(0.24);
    const sinX = Math.sin(0.24);

    const projected = new Array(points.length);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      p.charge *= 0.96;

      // Rotate Y then X
      const rx = p.x * cosY - p.z * sinY;
      const rz1 = p.x * sinY + p.z * cosY;
      const ry = p.y * cosX - rz1 * sinX;
      const rz = p.y * sinX + rz1 * cosX;

      const persp = 2.6 / (2.6 - rz * 0.65);
      const sx = cx + rx * scale * persp;
      const sy = cy + ry * scale * persp;

      const md = Math.hypot(sx - mouseX, sy - mouseY);
      if (md < 130) {
        p.charge = Math.min(1, p.charge + (1 - md / 130) * 0.4);
      }

      projected[i] = { sx, sy, depth: (rz + 1.2) / 2.4, charge: p.charge };
    }

    // Spawn occasional quiet synaptic pulses
    if (!reducedMotion && signals.length < 28 && edges.length > 0 && Math.random() < 0.24) {
      const e = edges[Math.floor(Math.random() * edges.length)];
      const flip = Math.random() > 0.5;
      signals.push({
        a: flip ? e[1] : e[0],
        b: flip ? e[0] : e[1],
        p: 0,
        speed: 0.012 + Math.random() * 0.015
      });
    }

    // Draw structural edges
    for (let i = 0; i < edges.length; i++) {
      const a = projected[edges[i][0]];
      const b = projected[edges[i][1]];
      const avgDepth = (a.depth + b.depth) * 0.5;
      const hot = Math.max(a.charge, b.charge);
      const alpha = 0.045 + avgDepth * 0.09 + hot * 0.26;
      ctx.strokeStyle = hot > 0.25
        ? `rgba(229, 72, 43, ${alpha.toFixed(3)})`
        : `rgba(245, 243, 238, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.75 + hot * 0.7;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }

    // Draw travelling signals
    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      s.p += s.speed;
      if (s.p >= 1) {
        points[s.b].charge = Math.min(1, points[s.b].charge + 0.85);
        signals.splice(i, 1);
        continue;
      }
      const a = projected[s.a];
      const b = projected[s.b];
      const px = a.sx + (b.sx - a.sx) * s.p;
      const py = a.sy + (b.sy - a.sy) * s.p;
      ctx.fillStyle = "rgba(229, 72, 43, 0.92)";
      ctx.beginPath();
      ctx.arc(px, py, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw nodes
    for (let i = 0; i < projected.length; i++) {
      const n = projected[i];
      const alpha = 0.16 + n.depth * 0.45 + n.charge * 0.35;
      const r = 1.2 + n.depth * 1.4 + n.charge * 1.3;
      ctx.fillStyle = n.charge > 0.3
        ? `rgba(229, 72, 43, ${Math.min(1, alpha).toFixed(3)})`
        : `rgba(245, 243, 238, ${Math.min(1, alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reducedMotion) {
      requestAnimationFrame(render);
    }
  }

  window.addEventListener("pointermove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(render);
})();
