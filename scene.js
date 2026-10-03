/* =========================================================
   3D cover: your 75 days as a ring of glass beads.
   Pink = complete, gold = in progress, rose-grey = missed,
   frosted = still ahead. Floating gems mark the rewards and
   the centre arc fills with your streak. Click a bead to
   open that day. Fed by window.Hard75.snapshot().
   ========================================================= */
(() => {
  "use strict";
  const host = document.getElementById("scene3d");
  if (!host || !window.THREE || !window.Hard75) return;

  const THREE = window.THREE;
  const TOTAL = 75;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) {
    return; // no WebGL — the photo cover stays as is
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 100);
  scene.fog = new THREE.Fog(0xffeef6, 16, 34);

  /* ---------- Lights ---------- */
  scene.add(new THREE.HemisphereLight(0xfff3f8, 0xcfe0ff, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9b6ff, 1.2);
  rim.position.set(-8, 2, -6);
  scene.add(rim);
  const glow = new THREE.PointLight(0xff8cc6, 30, 18, 2);
  glow.position.set(0, 1.2, 0);
  scene.add(glow);

  /* ---------- World ---------- */
  const world = new THREE.Group();
  world.rotation.x = 0.42;
  scene.add(world);

  const R = 5.6;
  const beadPos = (n) => {
    const a = ((n - 1) / TOTAL) * Math.PI * 2 - Math.PI / 2;
    return new THREE.Vector3(Math.cos(a) * R, Math.sin(a * 3) * 0.28, Math.sin(a) * R);
  };

  // thin guide ring the beads sit on
  const guide = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.012, 8, 240),
    new THREE.MeshBasicMaterial({ color: 0xe9a8c8, transparent: true, opacity: 0.45 })
  );
  guide.rotation.x = Math.PI / 2;
  world.add(guide);

  const STYLE = {
    done:     { color: 0xf06aa8, emissive: 0xff5fa8, ei: 0.45, opacity: 1,    rough: 0.18, scale: 1 },
    progress: { color: 0xf7c66b, emissive: 0xf5a524, ei: 0.25, opacity: 1,    rough: 0.25, scale: 1 },
    today:    { color: 0xffffff, emissive: 0xff9cc9, ei: 0.35, opacity: 1,    rough: 0.1,  scale: 1.35 },
    missed:   { color: 0xc7aeb9, emissive: 0x000000, ei: 0,    opacity: 0.9,  rough: 0.7,  scale: 0.85 },
    future:   { color: 0xffffff, emissive: 0xf3d9ff, ei: 0.08, opacity: 0.55, rough: 0.35, scale: 0.85 },
  };

  const beadGeo = new THREE.SphereGeometry(0.2, 32, 20);
  const beads = [];
  for (let n = 1; n <= TOTAL; n++) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15,
      transparent: true, opacity: 0.6, emissive: 0x000000,
    });
    const m = new THREE.Mesh(beadGeo, mat);
    m.position.copy(beadPos(n));
    m.userData = { n, base: m.position.y, phase: n * 0.37, target: 1 };
    world.add(m);
    beads.push(m);
  }

  // halo for "today"
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.025, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0xff6fb1, transparent: true, opacity: 0.9 })
  );
  halo.visible = false;
  world.add(halo);

  // centre: faceted orb + streak arc
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0xffc2de, emissive: 0xd76cff, emissiveIntensity: 0.18, roughness: 0.15,
      clearcoat: 1, flatShading: true, transparent: true, opacity: 0.92,
    })
  );
  orb.position.y = 0.9;
  world.add(orb);

  const track = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.05, 12, 160),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
  );
  track.position.y = 0.9;
  track.rotation.x = Math.PI / 2;
  world.add(track);

  const arcMat = new THREE.MeshStandardMaterial({ color: 0xff5fa8, emissive: 0xff5fa8, emissiveIntensity: 0.8, roughness: 0.3 });
  let arc = null;
  let arcFrac = -1;
  function setArc(frac) {
    if (Math.abs(frac - arcFrac) < 1e-4) return;
    arcFrac = frac;
    if (arc) { world.remove(arc); arc.geometry.dispose(); arc = null; }
    if (frac <= 0) return;
    arc = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.075, 12, 200, Math.PI * 2 * Math.min(frac, 1)), arcMat);
    arc.position.y = 0.9;
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = -Math.PI / 2;
    world.add(arc);
  }

  // reward gems
  const GEM_COLORS = [0x8ec5ff, 0xc7a4ff, 0x6fd6b4, 0xffb36b, 0xff7aa8];
  const gemGeo = new THREE.OctahedronGeometry(0.3, 0);
  let gems = [];
  function setGems(rewards) {
    gems.forEach((g) => { world.remove(g); g.material.dispose(); });
    gems = rewards.slice().sort((a, b) => a.day - b.day).map((r, i) => {
      const c = GEM_COLORS[i % GEM_COLORS.length];
      const mat = new THREE.MeshPhysicalMaterial({
        color: r.unlocked ? c : 0xf4eef2,
        emissive: r.unlocked ? c : 0x000000,
        emissiveIntensity: r.unlocked ? 0.55 : 0,
        roughness: 0.12, clearcoat: 1, flatShading: true,
        transparent: true, opacity: r.unlocked ? 1 : 0.7,
      });
      const g = new THREE.Mesh(gemGeo, mat);
      const p = beadPos(Math.max(1, Math.min(TOTAL, r.day)));
      g.position.set(p.x, p.y + 0.85, p.z);
      g.scale.setScalar(r.unlocked ? 1.25 : 1);
      g.userData = { reward: r, base: p.y + 0.85, phase: i * 1.3 };
      world.add(g);
      return g;
    });
  }

  // floating pastel dust
  const DUST = 420;
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3);
  const dCol = new Float32Array(DUST * 3);
  const palette = [0xffb3d4, 0xd9c2ff, 0xbfe0ff, 0xffe2b3, 0xffffff].map((h) => new THREE.Color(h));
  for (let i = 0; i < DUST; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * 26;
    dPos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    dPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    const c = palette[i % palette.length];
    dCol.set([c.r, c.g, c.b], i * 3);
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute("color", new THREE.BufferAttribute(dCol, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  scene.add(dust);

  /* ---------- Data → visuals ---------- */
  let data = null;
  function update(snap) {
    data = snap;
    snap.days.forEach((d) => {
      const m = beads[d.n - 1];
      const st = STYLE[d.status];
      m.material.color.setHex(st.color);
      m.material.emissive.setHex(st.emissive);
      m.material.emissiveIntensity = st.ei;
      m.material.opacity = st.opacity;
      m.material.roughness = st.rough;
      m.userData.target = st.scale;
      m.userData.info = d;
    });
    const today = snap.current >= 1 && snap.current <= TOTAL ? beads[snap.current - 1] : null;
    halo.visible = !!today;
    if (today) halo.position.copy(today.position);
    setArc(snap.streak / TOTAL);
    setGems(snap.rewards);
    if (reduceMotion) draw(0);
  }

  /* ---------- Sizing ---------- */
  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole ring in frame on narrow screens
    const halfW = R + 1.6;
    const dist = Math.max(14, halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    camera.position.set(0, 1.2, dist);
    camera.lookAt(0, -0.9, 0);
    camera.updateProjectionMatrix();
    if (reduceMotion) draw(0);
  }
  new ResizeObserver(resize).observe(host);

  /* ---------- Interaction ---------- */
  const tip = document.getElementById("sceneTip");
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2(9, 9);
  const look = { x: 0, y: 0 };
  let hovered = null;
  const LABEL = { done: "💗 Complete", progress: "🟡 In progress", today: "☀️ Today", missed: "Missed", future: "Ahead" };

  function pick() {
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects([...beads, ...gems], false);
    return hits.length ? hits[0].object : null;
  }

  host.addEventListener("pointermove", (e) => {
    const b = host.getBoundingClientRect();
    ptr.x = ((e.clientX - b.left) / b.width) * 2 - 1;
    ptr.y = -((e.clientY - b.top) / b.height) * 2 + 1;
    look.x = ptr.x; look.y = ptr.y;
    const obj = pick();
    hovered = obj;
    host.style.cursor = obj ? "pointer" : "";
    if (obj) {
      const u = obj.userData;
      tip.innerHTML = u.reward
        ? `${u.reward.emoji} <b>${u.reward.title}</b> · Day ${u.reward.day} · ${u.reward.unlocked ? "✨ unlocked" : "🔒 locked"}`
        : `<b>Day ${u.n}</b> · ${u.info?.date || ""} · ${LABEL[u.info?.status] || ""}`;
      tip.style.left = e.clientX - b.left + "px";
      tip.style.top = e.clientY - b.top + "px";
      tip.classList.add("show");
    } else {
      tip.classList.remove("show");
    }
    if (reduceMotion) draw(0);
  });
  host.addEventListener("pointerleave", () => {
    hovered = null; look.x = 0; look.y = 0;
    tip.classList.remove("show");
    host.style.cursor = "";
  });
  host.addEventListener("click", (e) => {
    const b = host.getBoundingClientRect();
    ptr.x = ((e.clientX - b.left) / b.width) * 2 - 1;
    ptr.y = -((e.clientY - b.top) / b.height) * 2 + 1;
    const obj = pick();
    if (!obj) return;
    if (obj.userData.reward) document.getElementById("rewards").scrollIntoView({ behavior: "smooth" });
    else window.Hard75.openDay(obj.userData.n);
  });

  /* ---------- Loop ---------- */
  const clock = new THREE.Clock();
  let spin = 0;
  function draw(dt) {
    const t = clock.elapsedTime;
    spin += dt * 0.06;
    world.rotation.y += ((spin + look.x * 0.35) - world.rotation.y) * 0.06;
    world.rotation.x += ((0.42 - look.y * 0.12) - world.rotation.x) * 0.06;

    beads.forEach((m) => {
      const u = m.userData;
      m.position.y = u.base + Math.sin(t * 1.2 + u.phase) * 0.06;
      const s = u.target * (m === hovered ? 1.45 : 1);
      m.scale.setScalar(m.scale.x + (s - m.scale.x) * 0.15);
    });
    gems.forEach((g) => {
      g.rotation.y += dt * (g.userData.reward.unlocked ? 1.4 : 0.5);
      g.position.y = g.userData.base + Math.sin(t * 1.5 + g.userData.phase) * 0.12;
    });
    if (halo.visible && data) {
      const today = beads[data.current - 1];
      halo.position.copy(today.position);
      halo.quaternion.copy(camera.quaternion);
      halo.quaternion.premultiply(world.quaternion.clone().invert());
      halo.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
      halo.material.opacity = 0.65 + Math.sin(t * 3) * 0.25;
    }
    orb.rotation.y += dt * 0.35;
    orb.rotation.x += dt * 0.12;
    orb.position.y = 0.9 + Math.sin(t * 0.9) * 0.15;

    const p = dust.geometry.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = p.array[i * 3 + 1] + dt * (0.12 + (i % 7) * 0.03);
      if (y > 6) y = -6;
      p.array[i * 3 + 1] = y;
    }
    p.needsUpdate = true;
    dust.rotation.y = t * 0.02;

    renderer.render(scene, camera);
  }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    draw(dt);
  }

  // Dark mode tweaks
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = () => { scene.fog.color.setHex(dark.matches ? 0x1d1820 : 0xffeef6); };
  dark.addEventListener?.("change", applyTheme);
  applyTheme();

  window.HardScene = { update };
  resize();
  update(window.Hard75.snapshot());
  if (reduceMotion) { clock.getDelta(); draw(0); } else loop();
})();
