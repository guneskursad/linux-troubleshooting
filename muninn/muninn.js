// Muninn scene player for the CPU and load page, Case A draft.
// Every scene is a pure function of time: render(el, t) with t in [0, T).
// The last frame flows into the first one, so the page loops live
// and capture.mjs can export exact, seamless loop videos from the same code.
(() => {
  const BASE = document.currentScript.src.replace(/[^/]*$/, '');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const POSES = ['idle', 'think', 'point', 'type', 'surprised', 'smug', 'tired'];
  const TAU = Math.PI * 2;

  // ---- timeline helpers ----
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const inOut = x => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const outCubic = x => 1 - Math.pow(1 - x, 3);
  const lin = x => x;
  // piecewise value between keyframes [[t, v], ...]
  function kf(t, pts, e = inOut) {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, va] = pts[i], [b, vb] = pts[i + 1];
      if (t < b) return va + (vb - va) * e(clamp((t - a) / (b - a)));
    }
    return pts[pts.length - 1][1];
  }
  // last list entry whose time has passed: [[t, value], ...]
  const at = (t, list) => { let r = list[0][1]; for (const [x, v] of list) if (t >= x) r = v; return r; };

  // ---- sprite stack: all poses stacked, one visible ----
  function buildStack(box, names) {
    const m = {};
    names.forEach(n => {
      const i = new Image();
      i.src = BASE + (n.startsWith('walk/') ? 'img/' + n + '.png' : 'img/muninn-' + n + '.png');
      i.alt = ''; i.draggable = false;
      box.appendChild(i); m[n] = i;
    });
    box.firstChild && box.firstChild.setAttribute('alt', '');
    return { box, m, cur: null };
  }
  function show(st, name) {
    if (st.cur === name) return;
    if (st.cur) st.m[st.cur].style.visibility = 'hidden';
    st.m[name].style.visibility = 'visible';
    st.cur = name;
  }
  // breathing, pop on a pose change, shake: all derived from t
  function act(st, name, t, T, o = {}) {
    show(st, name);
    let x = 0, y = 0, s = 1 + 0.012 * Math.sin(TAU * (o.k || 2) * t / T);
    for (const p of o.pops || []) {
      const u = (t - p) / .5;
      if (u >= 0 && u < 1) { y += 12 * (1 - outCubic(u)); s *= 1 + 0.05 * Math.sin(Math.PI * u) * (1 - u * .5); }
    }
    if (o.shake != null) {
      const u = t - o.shake;
      if (u >= 0 && u < 1.05) x += 5 * (1 - u / 1.05) * Math.sin(TAU * u * 2.9);
    }
    st.box.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
  }
  const setText = (el, list, t) => {
    const txt = at(t, list);
    const node = el.querySelector('.mu-say span');
    if (node.textContent !== txt) node.textContent = txt;
  };

  // ---- scenes ----
  const scenes = {
    // 1 · load and vCPU
    load: {
      T: 9, hold: 6,
      init(el) {
        el._st = buildStack(el.querySelector('.mu-sprites'), POSES);
        el._dots = [...el.querySelectorAll('.mu-dots span')];
        el._val = el.querySelector('.mu-load strong');
      },
      render(el, t) {
        const T = this.T;
        act(el._st, at(t, [[0, 'idle'], [4.2, 'think'], [8.2, 'idle']]), t, T, { pops: [4.2] });
        const o = kf(t, [[0, .35], [.4, .35], [.9, 1], [8.2, 1], [8.8, .35]]);
        el._dots.forEach(d => { d.style.opacity = o.toFixed(3); });
        el._val.textContent = kf(t, [[0, 0], [.4, 0], [1.5, 1.05], [8.2, 1.05], [8.8, 0]]).toFixed(2);
        setText(el, [[0, 'Load 1.05. 8 vCPU. Sakin görünüyor.'],
          [4.2, 'Düşük load, CPU’nun rahat olduğunu kanıtlamaz. Bir CPU tam doluysa load yine yaklaşık 1.0 görünür.'],
          [8.2, 'Load 1.05. 8 vCPU. Sakin görünüyor.']], t);
      }
    },
    // 2 · per CPU
    cpus: {
      T: 11, hold: 8,
      init(el) {
        el._st = buildStack(el.querySelector('.mu-sprites'), POSES);
        el._cpus = [...el.querySelectorAll('.mu-cpu')];
      },
      render(el, t) {
        const T = this.T;
        act(el._st, at(t, [[0, 'idle'], [3.2, 'surprised'], [4.7, 'point'], [10, 'idle']]), t, T,
          { pops: [4.7, 10], shake: 3.2 });
        const p = kf(t, [[0, 0], [.7, 0], [1.9, 1], [9.6, 1], [10.4, 0]]);
        const pulse = kf(t, [[2, 0], [2.4, 1], [9.4, 1], [9.8, 0]]) * (.5 + .5 * Math.sin(TAU * t / 1.4));
        el._cpus.forEach(c => {
          const v = parseFloat(c.dataset.v);
          c.querySelector('.fill').style.height = Math.max(1.5, v * p) + '%';
          if (c.classList.contains('hot')) c.querySelector('.well').style.boxShadow = '0 0 0 ' + (7 * pulse).toFixed(2) + 'px rgba(255,135,95,.35)';
        });
        setText(el, [[0, 'Ortalama CPU %13. Rahat görünüyor.'], [3.2, 'Dur. CPU3 %98.'],
          [4.7, 'Yedi CPU boş. Tek CPU dolu. Ortalama bunu gizledi.'],
          [10, 'Ortalama CPU %13. Rahat görünüyor.']], t);
      }
    },
    // 3 · ps in a terminal
    ps: {
      T: 13.5, hold: 9,
      CMD: 'ps -eo pid,pcpu,nlwp,comm --sort=-pcpu | head -n 5',
      init(el) {
        el._st = buildStack(el.querySelector('.mu-sprites'), POSES);
        el._typed = el.querySelector('.mu-typed');
        el._cur = el.querySelector('.cur');
        el._rows = [...el.querySelectorAll('.mu-term .row')];
      },
      render(el, t) {
        const T = this.T;
        act(el._st, at(t, [[0, 'type'], [5, 'think'], [12.2, 'type']]), t, T, { pops: [5, 12.2] });
        const n = Math.floor(kf(t, [[.4, 0], [2.5, this.CMD.length], [11.2, this.CMD.length], [11.9, 0]], lin));
        el._typed.textContent = this.CMD.slice(0, n);
        el._cur.style.opacity = Math.floor(t * 2) % 2 ? 0 : 1;
        el._rows.forEach((r, i) => {
          const o = kf(t, [[3 + .4 * i, 0], [3.3 + .4 * i, 1], [11.2, 1], [11.7, 0]], lin);
          r.style.opacity = o.toFixed(3);
          r.style.transform = 'translateY(' + ((1 - o) * 4).toFixed(2) + 'px)';
        });
        setText(el, [[0, 'CPU3 dolu. Şimdi hangi process?'],
          [5, 'PID 5120, report-gen, %98. Üç thread var ama CPU’yu biri dolduruyor.'],
          [12.2, 'CPU3 dolu. Şimdi hangi process?']], t);
      }
    },
    // 4 · walking to the busy thread
    threads: {
      T: 14, hold: 8, CYCLE: 2.0, WALK_FROM: .6, WALK_TO: 2.6,
      init(el) {
        const names = ['point'];
        for (let i = 0; i < 8; i++) names.push('walk/w' + i);
        el._w = buildStack(el.querySelector('.mu-walker'), names);
        // the pointing sprite is wider; shift it so the torso stays where the walk frames end
        el._w.m['point'].style.left = 'calc(50% + 30px)';
        el._lanes = el.querySelector('.mu-lanes');
        el._bars = [...el.querySelectorAll('.mu-lane')];
      },
      render(el, t) {
        const track = el.querySelector('.mu-track'), W = track.clientWidth || 700;
        const x = kf(t, [[this.WALK_FROM, -.32 * W], [this.WALK_TO, .07 * W]], lin);
        const w = el.querySelector('.mu-walker');
        w.style.left = x.toFixed(2) + 'px';
        w.style.opacity = kf(t, [[12.7, 1], [13.4, 0], [14, 0]], inOut).toFixed(3);
        let name, o = {};
        if (t >= 3.0 && t < 12.7) name = 'point';
        else if (t >= this.WALK_TO && t < 3.0) name = 'walk/w0';
        else name = 'walk/w' + (Math.floor(((t - this.WALK_FROM) / this.CYCLE) * 8) % 8 + 8) % 8;
        show(el._w, name);
        // pop on the point pose
        const u = (t - 3.0) / .5, pop = u >= 0 && u < 1;
        w.style.transform = pop ? 'translateY(' + (10 * (1 - outCubic(u))).toFixed(2) + 'px)' : 'none';
        const p = kf(t, [[3.2, 0], [4.6, 1], [12, 1], [12.7, 0]]);
        el._bars.forEach(l => { l.querySelector('i').style.width = Math.max(2, parseFloat(l.dataset.v) * p) + '%'; });
        setText(el, [[0, 'Thread’lere bakalım. Hangisi CPU’yu dolduruyor?'],
          [3.0, 'TID 5120, CPU3, %98. TID 5124 ve 5125 boşta. Tek thread tek CPU’yu doldurur.'],
          [12.7, 'Thread’lere bakalım. Hangisi CPU’yu dolduruyor?']], t);
      }
    },
    // 5 · run queue
    queue: {
      T: 11.5, hold: 7,
      init(el) {
        el._st = buildStack(el.querySelector('.mu-sprites'), POSES);
        el._chip = el.querySelector('.chip');
        el._spark = el.querySelector('.mu-spark');
      },
      render(el, t) {
        const T = this.T;
        act(el._st, at(t, [[0, 'idle'], [3.2, 'smug'], [10, 'idle']]), t, T, { pops: [3.2, 10] });
        el._chip.style.left = kf(t, [[1, -150], [2, 112], [10, 112], [10.8, -150]], inOut).toFixed(2) + 'px';
        el._chip.style.opacity = kf(t, [[1, 0], [1.3, 1], [10.4, 1], [10.8, 0]], lin).toFixed(3);
        let a = 0;
        if (t >= 3.4 && t < 6.2) a = Math.sin(Math.PI * (((t - 3.4) / 1.4) % 1));
        el._spark.style.opacity = a.toFixed(3);
        el._spark.style.transform = 'scale(' + (.4 + .6 * a).toFixed(3) + ') rotate(' + (25 * a).toFixed(1) + 'deg)';
        setText(el, [[0, 'Peki sırada bekleyen iş var mı?'],
          [3.2, 'Kuyruk boş. r = 1–2. Yavaşlık CPU sıralaması değil, işin tek thread’e bağlı olması.'],
          [10, 'Peki sırada bekleyen iş var mı?']], t);
      }
    },
    // hero: breathing only
    hero: {
      T: 3.6, hold: 0,
      init(el) { el._st = buildStack(el.querySelector('.mu-sprites'), ['idle']); },
      render(el, t) { act(el._st, 'idle', t, this.T, { k: 1 }); }
    }
  };
  // ---- generic scenes for Case B, C and D (config driven) ----
  const prog = (t, T) => kf(t, [[0, 0], [.8, 0], [2.4, 1], [T - 1.8, 1], [T - .8, 0]]);
  const TXT = (s, k) => { const n = s.querySelector(k); return n; };
  const base = (cfg, extra) => ({
    T: cfg.T, hold: cfg.hold,
    init(el) { el._st = buildStack(el.querySelector('.mu-sprites'), POSES); extra.init && extra.init(el, cfg); },
    render(el, t) {
      act(el._st, at(t, cfg.poses), t, cfg.T, { pops: cfg.pops || [] });
      extra.render(el, prog(t, cfg.T), t, cfg);
      setText(el, cfg.say, t);
    }
  });
  const kinds = {
    // dots + load counter
    load: {
      init(el) { el._dots = [...el.querySelectorAll('.mu-dots span')]; el._val = el.querySelector('.mu-load strong'); },
      render(el, p, t, c) {
        el._dots.forEach((d, i) => { d.style.opacity = (.35 + .65 * clamp(p * 8 - i * .5)).toFixed(3); });
        el._val.textContent = (c.load * p).toFixed(2);
      }
    },
    // one stacked horizontal bar + big metric
    stack: {
      init(el) { el._segs = [...el.querySelectorAll('.mu-stack i')]; el._met = el.querySelector('.mu-metric'); },
      render(el, p, t, c) {
        el._segs.forEach(s => { s.style.width = (parseFloat(s.dataset.v) * p).toFixed(2) + '%'; });
        el._met.textContent = c.metric(p);
      }
    },
    // per-CPU stacked bars
    cpus: {
      init(el) { el._wells = [...el.querySelectorAll('.mu-cpus .well')]; },
      render(el, p) {
        el._wells.forEach(w => w.querySelectorAll('i').forEach(s => { s.style.height = (parseFloat(s.dataset.v) * p).toFixed(2) + '%'; }));
      }
    },
    // labelled horizontal rows
    rows: {
      init(el) { el._bars = [...el.querySelectorAll('.mu-rows .mu-lane')]; },
      render(el, p) { el._bars.forEach(l => { l.querySelector('i').style.width = Math.max(2, parseFloat(l.dataset.v) * p) + '%'; }); }
    }
  };
  const CFG = {
    b1: ['load', { T: 10, hold: 6, load: 14.2, poses: [[0, 'idle'], [3.2, 'surprised'], [9, 'idle']], pops: [3.2], say: [[0, 'Load 14.20. 8 vCPU.'], [3.2, 'vCPU başına 1,78 task. CPU’dan fazla iş var.'], [9, 'Load 14.20. 8 vCPU.']] }],
    b2: ['stack', { T: 10.5, hold: 6, metric: p => 'r = ' + Math.round(13 * p) + ' · 8 vCPU', poses: [[0, 'think'], [3.4, 'point'], [9.4, 'think']], pops: [3.4], say: [[0, 'Kuyrukta kaç task var?'], [3.4, 'r = 13. vCPU 8. Beş task sırada bekliyor.'], [9.4, 'Kuyrukta kaç task var?']] }],
    b3: ['cpus', { T: 10, hold: 6, poses: [[0, 'idle'], [3.2, 'surprised'], [9, 'idle']], pops: [3.2], say: [[0, 'Hangi CPU dolu?'], [3.2, 'Sekiz CPU’nun hepsi dolu. Sorun tek CPU değil.'], [9, 'Hangi CPU dolu?']] }],
    b4: ['rows', { T: 10.5, hold: 6, poses: [[0, 'type'], [3.4, 'point'], [9.4, 'type']], pops: [3.4], say: [[0, 'Bu yükü hangi process taşıyor?'], [3.4, 'batch-worker %718. Yedi CPU’yu tek başına dolduruyor.'], [9.4, 'Bu yükü hangi process taşıyor?']] }],
    c1: ['load', { T: 10, hold: 6, load: 12.4, poses: [[0, 'idle'], [3.2, 'think'], [9, 'idle']], pops: [3.2], say: [[0, 'Load 12.40. CPU dolu mu?'], [3.2, 'Load yüksek. Bu load CPU işi olmayabilir.'], [9, 'Load 12.40. CPU dolu mu?']] }],
    c2: ['stack', { T: 10.5, hold: 6, metric: p => 'b = ' + Math.round(10 * p) + ' · wa %' + Math.round(50 * p), poses: [[0, 'think'], [3.4, 'surprised'], [9.4, 'think']], pops: [3.4], say: [[0, 'CPU zamanı nereye gidiyor?'], [3.4, 'Yarısı I/O bekliyor. 10 task disk bekliyor.'], [9.4, 'CPU zamanı nereye gidiyor?']] }],
    c3: ['rows', { T: 10.5, hold: 6, poses: [[0, 'type'], [3.4, 'point'], [9.4, 'type']], pops: [3.4], say: [[0, 'Diski hangi process okuyor?'], [3.4, 'report-api saniyede 46 MB okuyor.'], [9.4, 'Diski hangi process okuyor?']] }],
    c4: ['rows', { T: 10.5, hold: 6, poses: [[0, 'type'], [3.4, 'tired'], [9.4, 'type']], pops: [3.4], say: [[0, 'Hangi disk meşgul?'], [3.4, 'sda %99 dolu. İstekler kuyrukta bekliyor.'], [9.4, 'Hangi disk meşgul?']] }],
    d1: ['load', { T: 10, hold: 6, load: 9.1, poses: [[0, 'idle'], [3.2, 'think'], [9, 'idle']], pops: [3.2], say: [[0, 'Load 9.10. 8 vCPU.'], [3.2, 'Load vCPU sayısının üstünde. CPU’nun çalıştığını kanıtlamaz.'], [9, 'Load 9.10. 8 vCPU.']] }],
    d2: ['stack', { T: 10.5, hold: 6, metric: p => 'st %' + Math.round(20 * p), poses: [[0, 'think'], [3.4, 'surprised'], [9.4, 'think']], pops: [3.4], say: [[0, 'VM CPU’yu tam kullanabildi mi?'], [3.4, 'Hayır. %20 steal: hypervisor CPU’yu başkasına verdi.'], [9.4, 'VM CPU’yu tam kullanabildi mi?']] }],
    d3: ['cpus', { T: 10, hold: 6, poses: [[0, 'idle'], [3.2, 'point'], [9, 'idle']], pops: [3.2], say: [[0, 'Steal tek CPU’da mı?'], [3.2, 'Hayır. Sekiz CPU’da da yaklaşık %20. Sorun VM’in dışında.'], [9, 'Steal tek CPU’da mı?']] }]
  };
  Object.keys(CFG).forEach(k => { scenes[k] = base(CFG[k][1], kinds[CFG[k][0]]); });


  // ---- player ----
  const els = [...document.querySelectorAll('[data-scene]')];
  els.forEach(el => scenes[el.dataset.scene].init(el));
  const render = (el, t) => scenes[el.dataset.scene].render(el, t);
  window.MU = { scenes, els, render };

  if (reduce) { els.forEach(el => render(el, scenes[el.dataset.scene].hold)); return; }
  els.forEach(el => render(el, 0));
  const live = new Map();
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) live.set(e.target, performance.now()); else live.delete(e.target);
  }), { threshold: 0.2 });
  els.forEach(el => io.observe(el));
  const loop = now => {
    if (!window.MU.freeze) live.forEach((t0, el) => render(el, (((now - t0) / 1000) % scenes[el.dataset.scene].T)));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // ---- heading peeks: reveal when scrolled into view ----
  const peeks = [...document.querySelectorAll('.mu-peek')];
  if (peeks.length) {
    document.documentElement.classList.add('mu-armed');
    const pio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); pio.unobserve(e.target); }
    }), { threshold: 0.4 });
    peeks.forEach(p => pio.observe(p));
  }
})();
