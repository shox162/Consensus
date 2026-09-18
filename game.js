(() => {
  const canvas = document.getElementById("table");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const keyList = document.getElementById("keyList");
  const wheelsEl = document.getElementById("wheels");
  const phasePill = document.getElementById("phasePill");
  const statusText = document.getElementById("statusText");
  const pointers = new Map();

  const I18N = {
    sr: {
      docTitle: "Stanica 3 — Reach Consensus · demo",
      kicker: "Swiss Pavilion · EXPO 2027 · Stanica 3",
      title: "Reach Consensus",
      players: "Igrači",
      balance: "Balans",
      overlap: "Preklapanje",
      attract: "Atrakcija",
      hold: "Hold merge",
      flow: "Tok",
      start: "Start",
      reset: "Reset",
      hint: "Prvi taster ili dodir volana pokreće igru. Na telefonu: drži ◀ ▶ ili prevuci prsten. Na tastaturi: A/D i J/L.",
      wheels: "Touch volani",
      status_ready: "Pritisni volan ili ◀ ▶ da krene.",
      status_move: "Pritisni volan ili ◀ ▶ da krene.",
      tableAria: "Sto sa krugovima",
      langLabel: "Jezik",
      phase_ready: "spreman",
      phase_play: "u toku",
      phase_win: "konsenzus",
      status_ready: "Pritisni volan ili ◀ ▶ da krene.",
      status_move: "Pritisni volan ili ◀ ▶ da krene.",
      status_reset: "Nova runda za {sec}s.",
      status_live: "Volani su živi. Spoji krugove preklapanjem.",
      status_merge: "Merge: {names}. Sada voze jedan krug.",
      status_win: "Konsenzus. Jedan krug — niko nije stigao sam.",
      status_touch: "Dodir {ovl}% · spajanje {pct}%",
      status_merging: "Merge...",
      player: "Igrač {n}",
      drivesWith: "→ vozi sa {names}",
    },
    en: {
      docTitle: "Station 3 — Reach Consensus · demo",
      kicker: "Swiss Pavilion · EXPO 2027 · Station 3",
      title: "Reach Consensus",
      players: "Players",
      balance: "Balance",
      overlap: "Overlap",
      attract: "Attraction",
      hold: "Hold merge",
      flow: "Flow",
      start: "Start",
      reset: "Reset",
      hint: "The first wheel key or touch starts the game. On a phone: hold ◀ ▶ or drag a ring. On a keyboard: A/D and J/L.",
      wheels: "Touch wheels",
      tableAria: "Table with circles",
      langLabel: "Language",
      phase_ready: "ready",
      phase_play: "in play",
      phase_win: "consensus",
      status_ready: "Press a wheel or ◀ ▶ to start.",
      status_move: "Press a wheel or ◀ ▶ to start.",
      status_reset: "New round in {sec}s.",
      status_live: "Wheels are live. Overlap the circles to merge.",
      status_merge: "Merge: {names}. They now steer one circle.",
      status_win: "Consensus. One circle — nobody got there alone.",
      status_touch: "Touch {ovl}% · merging {pct}%",
      status_merging: "Merging...",
      player: "Player {n}",
      drivesWith: "→ steering with {names}",
    },
  };

  const COLORS = [
    { fill: "#2fd3c5", name: "Tirkiz" },
    { fill: "#f08a3a", name: "Narandžasta" },
    { fill: "#7aa7ff", name: "Plava" },
    { fill: "#e6d36a", name: "Zlatna" },
    { fill: "#d97ad3", name: "Ljubičasta" },
    { fill: "#9be37a", name: "Zelena" },
  ];

  const SCHEMES = {
    2: [
      { left: "KeyA", right: "KeyD", label: "A / D" },
      { left: "KeyJ", right: "KeyL", label: "J / L" },
    ],
    4: [
      { left: "KeyA", right: "KeyD", label: "A / D" },
      { left: "KeyJ", right: "KeyL", label: "J / L" },
      { left: "ArrowLeft", right: "ArrowRight", label: "← / →" },
      { left: "KeyF", right: "KeyH", label: "F / H" },
    ],
    6: [
      { left: "KeyA", right: "KeyD", label: "A / D" },
      { left: "KeyJ", right: "KeyL", label: "J / L" },
      { left: "ArrowLeft", right: "ArrowRight", label: "← / →" },
      { left: "KeyF", right: "KeyH", label: "F / H" },
      { left: "Digit1", right: "Digit3", label: "1 / 3" },
      { left: "KeyU", right: "KeyO", label: "U / O" },
    ],
  };

  const state = {
    playerCount: 2,
    phase: "ready",
    players: [],
    groups: [],
    obstacles: [],
    keys: new Set(),
    overlapNeed: 0.2,
    attract: 0.55,
    holdNeed: 0.12,
    mergePairs: new Map(),
    mergeHint: null,
    flashes: [],
    winT: 0,
    last: performance.now(),
    lang: localStorage.getItem("s3-lang") === "en" ? "en" : "sr",
    statusKey: "status_move",
    statusVars: {},
  };

  const W = canvas.width;
  const H = canvas.height;
  const CX = W / 2;
  const CY = H / 2;
  const TABLE_R = 390;

  function t(key, vars = {}) {
    const pack = I18N[state.lang] || I18N.sr;
    return String(pack[key] || I18N.en[key] || key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  }

  function applyStaticI18n() {
    document.documentElement.lang = state.lang === "en" ? "en" : "sr";
    document.title = t("docTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });
    const switcher = document.getElementById("langSwitch");
    switcher.setAttribute("aria-label", t("langLabel"));
    switcher.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.lang === state.lang);
    });
  }

  function refreshChrome() {
    phasePill.textContent = t(`phase_${state.phase}`);
    phasePill.className = "pill" + (state.phase === "win" ? " win" : state.statusKey === "status_merge" ? " merge" : "");
    statusText.textContent = t(state.statusKey, state.statusVars);
    renderKeys();
  }

  function setStatus(key, vars) {
    state.statusKey = key;
    state.statusVars = vars || {};
    statusText.textContent = t(key, state.statusVars);
  }

  function setPhase(phase, statusKey, vars) {
    state.phase = phase;
    if (statusKey) {
      state.statusKey = statusKey;
      state.statusVars = vars || {};
    }
    refreshChrome();
  }

  function setLang(next) {
    state.lang = next === "en" ? "en" : "sr";
    localStorage.setItem("s3-lang", state.lang);
    applyStaticI18n();
    refreshChrome();
  }

  function spawn(count) {
    state.playerCount = count;
    state.players = [];
    state.groups = [];
    state.mergePairs.clear();
    state.flashes = [];
    state.winT = 0;
    const scheme = SCHEMES[count];
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / count + Math.PI / count;
      const dist = TABLE_R - 118;
      const player = {
        id: i,
        color: COLORS[i],
        left: scheme[i].left,
        right: scheme[i].right,
        label: scheme[i].label,
        impulse: 0,
        touchLeft: false,
        touchRight: false,
      };
      state.players.push(player);
      state.groups.push({
        id: `g${i}`,
        drivers: [i],
        x: CX + Math.cos(ang) * dist,
        y: CY + Math.sin(ang) * dist,
        heading: ang + Math.PI,
        r: 28,
        color: COLORS[i].fill,
        speed: 78,
        touchSteer: 0,
      });
    }
    state.obstacles = [
      { x: CX - 70, y: CY - 40, r: 36 },
      { x: CX + 90, y: CY + 20, r: 32 },
      { x: CX + 10, y: CY + 110, r: 28 },
      { x: CX - 20, y: CY - 130, r: 24 },
    ];
    pointers.clear();
    renderWheels();
    setPhase("ready", "status_ready");
  }

  function renderWheels() {
    wheelsEl.innerHTML = state.players
      .map((p) => `
        <div class="wheel" data-player="${p.id}">
          <button type="button" data-player="${p.id}" data-dir="-1" aria-label="left">◀</button>
          <span class="who"><i style="background:${p.color.fill};color:${p.color.fill}"></i>${p.id + 1}</span>
          <button type="button" data-player="${p.id}" data-dir="1" aria-label="right">▶</button>
        </div>`)
      .join("");
  }

  function tryStart() {
    if (state.phase === "ready") setPhase("play", "status_live");
  }

  function groupForDrivers(drivers) {
    return state.groups.find((g) => drivers.every((d) => g.drivers.includes(d)));
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function hitGroup(pt) {
    let best = null;
    let bestD = Infinity;
    for (const g of state.groups) {
      const d = Math.hypot(g.x - pt.x, g.y - pt.y);
      if (d < g.r + 56 && d < bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  function applyCanvasSteer(g, pt) {
    const ang = Math.atan2(pt.y - g.y, pt.x - g.x);
    let diff = ang - g.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.touchSteer = Math.max(-1.5, Math.min(1.5, diff / 0.65));
  }

  function clearTouches() {
    state.keys.clear();
    pointers.clear();
    for (const p of state.players) {
      p.touchLeft = false;
      p.touchRight = false;
    }
    for (const g of state.groups) g.touchSteer = 0;
    wheelsEl.querySelectorAll("button.held").forEach((b) => b.classList.remove("held"));
  }

  function renderKeys() {
    keyList.innerHTML = state.players
      .map((p) => {
        const live = state.groups.find((g) => g.drivers.includes(p.id));
        const extra = live && live.drivers.length > 1
          ? ` <span class="merged">${t("drivesWith", { names: live.drivers.filter((d) => d !== p.id).map((d) => d + 1).join("+") })}</span>`
          : "";
        return `<li><span><i class="swatch" style="background:${p.color.fill};color:${p.color.fill}"></i>${t("player", { n: p.id + 1 })}${extra}</span><span class="kbd">${p.label}</span></li>`;
      })
      .join("");
  }

  function steerOf(group) {
    let steer = 0;
    for (const id of group.drivers) {
      const p = state.players[id];
      if (state.keys.has(p.left)) steer -= 1;
      if (state.keys.has(p.right)) steer += 1;
      if (p.touchLeft) steer -= 1;
      if (p.touchRight) steer += 1;
      steer += p.impulse;
    }
    steer += group.touchSteer || 0;
    return steer;
  }

  function overlapAmount(a, b) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const sum = a.r + b.r;
    if (d >= sum) return 0;
    return (sum - d) / sum;
  }

  function mixHex(a, b) {
    const pa = a.match(/\w\w/g).map((x) => parseInt(x, 16));
    const pb = b.match(/\w\w/g).map((x) => parseInt(x, 16));
    const m = pa.map((v, i) => Math.round((v + pb[i]) / 2));
    return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  function merge(a, b) {
    const drivers = [...a.drivers, ...b.drivers];
    const area = a.r * a.r + b.r * b.r;
    const g = {
      id: `g${drivers.join("")}`,
      drivers,
      x: (a.x * a.r + b.x * b.r) / (a.r + b.r),
      y: (a.y * a.r + b.y * b.r) / (a.r + b.r),
      heading: Math.atan2(
        Math.sin(a.heading) + Math.sin(b.heading),
        Math.cos(a.heading) + Math.cos(b.heading)
      ),
      r: Math.sqrt(area),
      color: mixHex(a.color, b.color),
      speed: 70 + drivers.length * 4,
      touchSteer: (a.touchSteer || 0) + (b.touchSteer || 0),
    };
    state.groups = state.groups.filter((x) => x !== a && x !== b);
    state.groups.push(g);
    state.flashes.push({ x: g.x, y: g.y, r: g.r, t: 0 });
    const names = drivers.map((d) => d + 1).join(" + ");
    if (state.groups.length === 1) setPhase("win", "status_win");
    else setPhase("play", "status_merge", { names });
  }

  function bounceRim(g) {
    const dx = g.x - CX;
    const dy = g.y - CY;
    const d = Math.hypot(dx, dy);
    const max = TABLE_R - g.r - 8;
    if (d > max) {
      g.x = CX + (dx / d) * max;
      g.y = CY + (dy / d) * max;
      const nx = dx / d;
      const ny = dy / d;
      const vx = Math.cos(g.heading);
      const vy = Math.sin(g.heading);
      const dot = vx * nx + vy * ny;
      const rx = vx - 2 * dot * nx;
      const ry = vy - 2 * dot * ny;
      g.heading = Math.atan2(ry, rx);
    }
  }

  function bounceObs(g) {
    for (const o of state.obstacles) {
      const dx = g.x - o.x;
      const dy = g.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = g.r + o.r;
      if (d < min && d > 0.001) {
        g.x = o.x + (dx / d) * min;
        g.y = o.y + (dy / d) * min;
        const nx = dx / d;
        const ny = dy / d;
        const vx = Math.cos(g.heading);
        const vy = Math.sin(g.heading);
        const dot = vx * nx + vy * ny;
        if (dot < 0) g.heading = Math.atan2(vy - 2 * dot * ny, vx - 2 * dot * nx);
      }
    }
  }

  function step(dt) {
    if (state.phase === "ready") return;
    if (state.phase === "win") {
      state.winT += dt;
      const left = Math.max(0, 5 - state.winT);
      setStatus("status_reset", { sec: left.toFixed(1) });
      if (state.winT >= 5) {
        spawn(state.playerCount);
        return;
      }
    }

    for (const p of state.players) {
      p.impulse *= Math.max(0, 1 - dt * 8);
      if (Math.abs(p.impulse) < 0.02) p.impulse = 0;
    }
    for (const g of state.groups) {
      const steer = steerOf(g);
      const turn = 2.15 * steer * dt;
      g.heading += turn;
      const attract = { x: 0, y: 0 };
      for (const other of state.groups) {
        if (other === g) continue;
        const d = Math.hypot(other.x - g.x, other.y - g.y);
        const reach = (g.r + other.r) * (1.55 + state.attract);
        if (d < reach && d > 0.001) {
          const touching = d < g.r + other.r;
          const f = ((reach - d) / reach) * state.attract * (touching ? 90 : 38);
          attract.x += ((other.x - g.x) / d) * f;
          attract.y += ((other.y - g.y) / d) * f;
        }
      }
      let touch = 0;
      for (const other of state.groups) {
        if (other === g) continue;
        touch = Math.max(touch, overlapAmount(g, other));
      }
      const crawl = touch > 0 ? Math.max(0.22, 1 - touch * 1.6) : 1;
      g.x += Math.cos(g.heading) * g.speed * crawl * dt + attract.x * dt;
      g.y += Math.sin(g.heading) * g.speed * crawl * dt + attract.y * dt;
      bounceRim(g);
      if (touch === 0) bounceObs(g);
    }

    const seen = new Set();
    let hint = null;
    for (let i = 0; i < state.groups.length; i++) {
      for (let j = i + 1; j < state.groups.length; j++) {
        const a = state.groups[i];
        const b = state.groups[j];
        const key = [a.id, b.id].sort().join("|");
        const ovl = overlapAmount(a, b);
        const prev = state.mergePairs.get(key) || 0;
        let next = prev;
        if (ovl >= state.overlapNeed) next = prev + dt;
        else if (ovl > 0) next = prev + dt * 0.45;
        else next = Math.max(0, prev - dt * 1.1);
        if (next > 0) state.mergePairs.set(key, next);
        else state.mergePairs.delete(key);
        const progress = state.holdNeed <= 0 ? (ovl >= state.overlapNeed ? 1 : 0) : Math.min(1, next / state.holdNeed);
        if (ovl > 0 && (!hint || progress > hint.progress)) {
          hint = { a, b, ovl, progress };
        }
        if ((ovl >= state.overlapNeed && next >= state.holdNeed) || ovl >= Math.max(0.42, state.overlapNeed + 0.15)) {
          merge(a, b);
          state.mergePairs.clear();
          state.mergeHint = null;
          return;
        }
        seen.add(key);
      }
    }
    for (const key of [...state.mergePairs.keys()]) {
      if (!seen.has(key)) state.mergePairs.delete(key);
    }
    state.mergeHint = hint;
    if (hint && state.phase === "play") {
      const pct = Math.round(hint.progress * 100);
      if (pct >= 100) setStatus("status_merging");
      else setStatus("status_touch", { ovl: Math.round(hint.ovl * 100), pct });
    }

    for (const f of state.flashes) f.t += dt;
    state.flashes = state.flashes.filter((f) => f.t < 0.6);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, TABLE_R + 16, 0, Math.PI * 2);
    ctx.fillStyle = "#121821";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CX, CY, TABLE_R, 0, Math.PI * 2);
    const floor = ctx.createRadialGradient(CX, CY, 40, CX, CY, TABLE_R);
    floor.addColorStop(0, state.phase === "win" ? "#3a4450" : "#1b232d");
    floor.addColorStop(1, "#0b1016");
    ctx.fillStyle = floor;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(CX, CY, (TABLE_R * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const o of state.obstacles) {
      const shade = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, 4, o.x, o.y, o.r);
      shade.addColorStop(0, "#2a3340");
      shade.addColorStop(1, "#0a0d12");
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (state.phase !== "ready") {
      for (let i = 0; i < state.groups.length; i++) {
        for (let j = i + 1; j < state.groups.length; j++) {
          const a = state.groups[i];
          const b = state.groups[j];
          const ovl = overlapAmount(a, b);
          if (ovl > 0.02) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(47,211,197,${0.2 + ovl})`;
            ctx.lineWidth = 2 + ovl * 6;
            ctx.stroke();
          }
        }
      }
    }

    for (const f of state.flashes) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + f.t * 80, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${1 - f.t / 0.6})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    for (const g of state.groups) drawRing(g);

    if (state.phase === "win") drawThunder();
    ctx.restore();
  }

  function drawRing(g) {
    const steer = steerOf(g);
    ctx.save();
    ctx.shadowColor = g.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.strokeStyle = g.color;
    ctx.lineWidth = Math.max(5, g.r * 0.16);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r - 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const hint = state.mergeHint;
    if (hint && (hint.a === g || hint.b === g) && hint.progress > 0) {
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r + 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hint.progress);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r + 7, g.heading - 0.7, g.heading + 0.7);
    ctx.strokeStyle = steer === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const c = Math.cos(g.heading);
    const s = Math.sin(g.heading);
    const pt = (d, o) => [g.x + c * d - s * o, g.y + s * d + c * o];
    const tip = pt(g.r + 20, 0);
    const left = pt(g.r - 1, 12);
    const right = pt(g.r - 1, -12);
    const neck = pt(g.r + 5, 0);
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(left[0], left[1]);
    ctx.lineTo(neck[0], neck[1]);
    ctx.lineTo(right[0], right[1]);
    ctx.closePath();
    ctx.fillStyle = g.color;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.6;
    ctx.fill();
    ctx.stroke();

    const tail = pt(g.r - 10, 0);
    ctx.beginPath();
    ctx.moveTo(neck[0], neck[1]);
    ctx.lineTo(tail[0], tail[1]);
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = g.color;
    ctx.font = `700 ${Math.max(13, Math.min(20, g.r * 0.48))}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(g.drivers.map((d) => d + 1).join("+"), g.x, g.y);
    ctx.restore();
  }

  function thunderFlash() {
    const t = state.winT;
    if (t < 0.06) return 1;
    if (t < 0.12) return 0.06;
    if (t < 0.2) return 0.95;
    if (t < 0.3) return 0.1;
    if (t < 0.4) return 0.72;
    if (t < 1) return 0.08 + Math.abs(Math.sin(t * 48)) * 0.16;
    return Math.max(0, 0.08 * (1 - (t - 1) / 4));
  }

  function drawThunder() {
    const flash = thunderFlash();
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, TABLE_R, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(236,242,255,${flash})`;
    ctx.fill();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - state.last) / 1000);
    state.last = now;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  document.getElementById("countSeg").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-count]");
    if (!btn) return;
    document.querySelectorAll("#countSeg button").forEach((b) => b.classList.toggle("on", b === btn));
    spawn(Number(btn.dataset.count));
  });

  const bind = (id, key, fmt) => {
    const el = document.getElementById(id);
    const lab = document.getElementById(key);
    const apply = () => {
      const v = Number(el.value);
      if (id === "overlap") {
        state.overlapNeed = v / 100;
        lab.textContent = `${v}%`;
      } else if (id === "attract") {
        state.attract = v / 100;
        lab.textContent = (v / 100).toFixed(2);
      } else {
        state.holdNeed = v / 10;
        lab.textContent = `${(v / 10).toFixed(2)}s`;
      }
    };
    el.addEventListener("input", apply);
    apply();
  };
  bind("overlap", "ovlVal");
  bind("attract", "attVal");
  bind("hold", "holdVal");

  window.addEventListener("keydown", (e) => {
    if (state.phase === "win") return;
    const player = state.players.find((p) => p.left === e.code || p.right === e.code);
    if (player) {
      e.preventDefault();
      if (!e.repeat) player.impulse += player.left === e.code ? -1.6 : 1.6;
    }
    state.keys.add(e.code);
    if (player) tryStart();
  });
  document.getElementById("langSwitch").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lang]");
    if (btn) setLang(btn.dataset.lang);
  });
  window.addEventListener("keyup", (e) => state.keys.delete(e.code));
  window.addEventListener("blur", clearTouches);

  function releaseWheelPointer(e) {
    const rec = pointers.get(e.pointerId);
    if (!rec || rec.kind !== "wheel") return;
    pointers.delete(e.pointerId);
    const p = state.players[rec.playerId];
    if (p) {
      if (rec.dir < 0) p.touchLeft = false;
      else p.touchRight = false;
    }
    const btn = wheelsEl.querySelector(`button[data-player="${rec.playerId}"][data-dir="${rec.dir}"]`);
    if (btn) btn.classList.remove("held");
  }

  wheelsEl.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button[data-player]");
    if (!btn) return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    const playerId = Number(btn.dataset.player);
    const dir = Number(btn.dataset.dir);
    pointers.set(e.pointerId, { kind: "wheel", playerId, dir });
    const p = state.players[playerId];
    if (p) {
      if (dir < 0) p.touchLeft = true;
      else p.touchRight = true;
      p.impulse += dir * 1.6;
    }
    btn.classList.add("held");
    tryStart();
  });
  wheelsEl.addEventListener("pointerup", releaseWheelPointer);
  wheelsEl.addEventListener("pointercancel", releaseWheelPointer);
  wheelsEl.addEventListener("lostpointercapture", releaseWheelPointer);

  function endCanvasPointer(e) {
    const rec = pointers.get(e.pointerId);
    if (!rec || rec.kind !== "canvas") return;
    pointers.delete(e.pointerId);
    const still = [...pointers.values()].some(
      (r) => r.kind === "canvas" && r.drivers.some((d) => rec.drivers.includes(d))
    );
    if (!still) {
      const g = groupForDrivers(rec.drivers);
      if (g) g.touchSteer = 0;
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const pt = canvasPoint(e);
    const g = hitGroup(pt);
    if (!g) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, { kind: "canvas", drivers: g.drivers.slice() });
    applyCanvasSteer(g, pt);
    tryStart();
  });
  canvas.addEventListener("pointermove", (e) => {
    const rec = pointers.get(e.pointerId);
    if (!rec || rec.kind !== "canvas") return;
    const g = groupForDrivers(rec.drivers);
    if (!g) return;
    rec.drivers = g.drivers.slice();
    applyCanvasSteer(g, canvasPoint(e));
  });
  canvas.addEventListener("pointerup", endCanvasPointer);
  canvas.addEventListener("pointercancel", endCanvasPointer);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  wheelsEl.addEventListener("contextmenu", (e) => e.preventDefault());

  window.Station3 = {
    state,
    spawn,
    setPhase,
    snapshot() {
      return {
        phase: state.phase,
        groups: state.groups.map((g) => ({
          drivers: g.drivers.slice(),
          x: Math.round(g.x),
          y: Math.round(g.y),
          r: Math.round(g.r),
        })),
      };
    },
  };

  applyStaticI18n();
  spawn(2);
  requestAnimationFrame(loop);
})();
