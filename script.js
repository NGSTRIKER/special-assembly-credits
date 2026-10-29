/* =========================================================
   Special Assembly – Vote of Thanks  ·  Timeline engine + FX
   ========================================================= */
(() => {
  "use strict";

  const body = document.body;
  const scenes = [...document.querySelectorAll(".scene")];
  const durs = scenes.map(s => parseFloat(s.dataset.dur) || 4);
  const starts = durs.reduce((a, d, i) => (a.push(i ? a[i - 1] + durs[i - 1] : 0), a), []);
  const TOTAL = durs.reduce((a, b) => a + b, 0);
  const SKIT = [3, 4, 5, 6];
  const CLOSE = scenes.length - 1;

  const params = new URLSearchParams(location.search);
  const $ = id => document.getElementById(id);
  const bar = $("bar"), timeEl = $("time"), btnPlay = $("btnPlay"), btnLoop = $("btnLoop");
  const dots = [...document.querySelectorAll(".dots i")];

  let t = 0, playing = true, loop = params.has("loop"), cur = -1, last = 0;
  const leaveTimers = new Map();

  /* ---------- tick marks on progress bar ---------- */
  starts.slice(1).forEach(s => {
    const i = document.createElement("i");
    i.style.left = (s / TOTAL * 100) + "%";
    $("ticks").appendChild(i);
  });

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const sceneAt = time => {
    for (let i = starts.length - 1; i >= 0; i--) if (time >= starts[i]) return i;
    return 0;
  };

  function setScene(i, force) {
    if (i === cur && !force) return;
    const prev = cur;
    cur = i;

    scenes.forEach((s, k) => {
      if (k !== i) s.classList.remove("active");
    });

    if (prev >= 0 && prev !== i) {
      const p = scenes[prev];
      p.classList.add("leaving");
      clearTimeout(leaveTimers.get(p));
      leaveTimers.set(p, setTimeout(() => p.classList.remove("leaving"), 1100));
    }

    const s = scenes[i];
    s.classList.remove("leaving", "active");
    void s.offsetWidth;            // restart CSS animations
    s.classList.add("active");

    body.classList.toggle("in-skit", SKIT.includes(i));
    body.classList.toggle("bright", s.dataset.fx === "bright");
    body.classList.toggle("spot", s.dataset.fx === "spot");
    body.classList.toggle("warm", s.dataset.fx === "warm-glow");
    dots.forEach((d, k) => d.classList.toggle("on", SKIT[k] === i));

    fx.celebrate(i === CLOSE);
  }

  function render() {
    setScene(sceneAt(Math.min(t, TOTAL - 0.001)));
    bar.style.width = (t / TOTAL * 100) + "%";
    timeEl.textContent = `${fmt(t)} / ${fmt(TOTAL)}`;
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (playing) {
      t += dt;
      if (t >= TOTAL) {
        if (loop) { t = 0; cur = -1; }
        else { t = TOTAL; setPlaying(false); }
      }
    }
    render();
    fx.step(dt);
    requestAnimationFrame(frame);
  }

  function setPlaying(p) {
    if (p && t >= TOTAL) seek(0);
    playing = p;
    body.classList.toggle("paused", !p);
    btnPlay.textContent = p ? "❚❚" : "▶";
  }

  function seek(time) {
    t = Math.max(0, Math.min(time, TOTAL - 0.01));
    setScene(sceneAt(t), true);
  }

  /* ---------- controls ---------- */
  btnPlay.onclick = () => setPlaying(!playing);
  $("btnRestart").onclick = () => { seek(0); setPlaying(true); };
  const setLoop = v => { loop = v; btnLoop.textContent = `⟳ Loop: ${v ? "On" : "Off"}`; };
  btnLoop.onclick = () => setLoop(!loop);
  const toggleFs = () => document.fullscreenElement
    ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
  $("btnFs").onclick = toggleFs;
  document.querySelector(".progress").addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width * TOTAL);
  });

  addEventListener("keydown", e => {
    switch (e.key) {
      case " ": case "k": e.preventDefault(); setPlaying(!playing); break;
      case "r": case "R": seek(0); setPlaying(true); break;
      case "f": case "F": toggleFs(); break;
      case "l": case "L": setLoop(!loop); break;
      case "ArrowRight": seek(starts[Math.min(cur + 1, CLOSE)]); break;
      case "ArrowLeft": seek(starts[Math.max(cur - 1, 0)]); break;
      default: return;
    }
    poke();
  });

  /* auto-hide cursor + controls */
  let idleTimer;
  function poke() {
    body.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => body.classList.add("idle"), 2200);
  }
  addEventListener("mousemove", poke);
  body.classList.add("idle");

  /* =========================================================
     Canvas FX : drifting gold dust + closing confetti
     ========================================================= */
  const fx = (() => {
    const cv = $("fx"), ctx = cv.getContext("2d");
    let W = 0, H = 0, DPR = 1;
    const dust = [], confetti = [];
    let celebrating = false, spawnAcc = 0;

    // pre-rendered glow sprite (much cheaper than shadowBlur)
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const sg = sprite.getContext("2d");
    const g = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,240,205,1)");
    g.addColorStop(.25, "rgba(255,214,140,.55)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    sg.fillStyle = g; sg.fillRect(0, 0, 64, 64);

    const COLORS = ["#f3d18a", "#fff3d1", "#e8a3b8", "#c99a45", "#b9a4ff", "#ffffff", "#ffd27a"];

    function resize() {
      DPR = Math.min(devicePixelRatio || 1, 1.5);
      W = innerWidth; H = innerHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    addEventListener("resize", resize);

    const N = Math.round(Math.min(70, (innerWidth * innerHeight) / 22000));
    for (let i = 0; i < N; i++) dust.push(newDust(true));
    function newDust(anyY) {
      return {
        x: Math.random() * W,
        y: anyY ? Math.random() * H : H + 20,
        r: 6 + Math.random() * 16,
        vy: -(6 + Math.random() * 16),
        sway: 10 + Math.random() * 25,
        ph: Math.random() * Math.PI * 2,
        tw: .6 + Math.random() * 1.6,
        a: .25 + Math.random() * .5
      };
    }

    function piece(x, y, vx, vy) {
      return {
        x, y, vx, vy,
        w: 6 + Math.random() * 7, h: 9 + Math.random() * 10,
        rot: Math.random() * Math.PI, vr: (Math.random() - .5) * 10,
        flip: Math.random() * Math.PI, vf: 4 + Math.random() * 8,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0, max: 5 + Math.random() * 3
      };
    }

    function burst() {
      const n = Math.min(220, Math.round(W / 7));
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side < 0 ? -10 : W + 10;
        const ang = (-Math.PI / 2) + side * -(.45 + Math.random() * .6);
        const sp = 700 + Math.random() * 800;
        confetti.push(piece(x, H * (.75 + Math.random() * .2), Math.cos(ang) * sp * -side * side, Math.sin(ang) * sp));
      }
      // fix horizontal direction: left cannon shoots right, right cannon shoots left
      for (let i = confetti.length - n; i < confetti.length; i++) {
        const p = confetti[i];
        p.vx = Math.abs(p.vx) * (p.x < W / 2 ? 1 : -1);
      }
    }

    function celebrate(on) {
      if (on && !celebrating) burst();
      if (!on) confetti.length = 0;
      celebrating = on;
    }

    function step(dt) {
      ctx.clearRect(0, 0, W, H);
      const now = performance.now() / 1000;

      // gold dust
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < dust.length; i++) {
        const d = dust[i];
        d.y += d.vy * dt;
        if (d.y < -30) dust[i] = newDust(false);
        const x = d.x + Math.sin(now * .5 + d.ph) * d.sway;
        ctx.globalAlpha = d.a * (.55 + .45 * Math.sin(now * d.tw + d.ph));
        ctx.drawImage(sprite, x - d.r, d.y - d.r, d.r * 2, d.r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      // gentle confetti rain while closing scene is up
      if (celebrating && playing) {
        spawnAcc += dt * 26;
        while (spawnAcc > 1) {
          spawnAcc--;
          confetti.push(piece(Math.random() * W, -20, (Math.random() - .5) * 60, 60 + Math.random() * 80));
        }
      }

      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        if (playing) {
          p.life += dt;
          p.vy += 520 * dt;                    // gravity
          p.vx *= Math.pow(.45, dt);           // air drag
          p.vy *= Math.pow(.35, dt);
          p.x += (p.vx + Math.sin(p.life * 3 + p.flip) * 30) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          p.flip += p.vf * dt;
        }
        if (p.y > H + 40 || p.life > p.max) { confetti.splice(i, 1); continue; }
        const fade = Math.min(1, (p.max - p.life) / .8);
        ctx.globalAlpha = fade;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.flip));       // 3D tumble
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    return { step, celebrate };
  })();

  /* ---------- boot: wait for fonts so nothing reflows mid-animation ---------- */
  const start = () => {
    body.classList.remove("booting");
    if (params.has("still")) body.classList.add("still");
    seek(params.has("t") ? parseFloat(params.get("t")) || 0 : 0);
    setLoop(loop);
    setPlaying(!params.has("paused"));
    last = performance.now();
    requestAnimationFrame(frame);
  };
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => setTimeout(start, 250));
})();
