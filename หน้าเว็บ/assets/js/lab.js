/* ============================================
   lab.js — ห้องทดลองคณิต (MATH LAB)

   *** FROZEN ZONE ***
   โค้ดทั้งหมดในไฟล์นี้ยกมาจาก index_1.html แบบคัดลอกตรงๆ
   ตรรกะคณิต การวาดกราฟ slider และรายการฟังก์ชัน เหมือนเดิมทุกบรรทัด

   สิ่งที่ตั้งใจ "ไม่ทำ" ในนี้:
   - ไม่มี crosshair / ไม่อ่านค่าตามเมาส์
   - ไม่มี curve morph / draw-on animation
   - ไม่มี 3D tilt บน .panel
   การเปลี่ยนแปลงเดียวคือห่อไว้ใน IM.register เพื่อให้ main.js เรียก
   (บวกอีกหนึ่ง: ถอด height="auto" ออกจาก <svg> เพราะ SVG ไม่รับคำว่า auto
   เบราว์เซอร์จึงโยน error ลง console ทุกครั้งที่วาดกราฟ — width:100% กับ viewBox
   ให้สัดส่วนเดียวกันอยู่แล้ว ภาพจึงเท่าเดิมทุกพิกเซล)
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('lab', function () {

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const FUNCS = {
      sine: {
        label: 'Sine', dotColor: '#0e7c5c', title: 'Sine Function',
        params: [{ key: 'A', label: 'Amplitude (A)', min: .3, max: 2.5, step: .1, def: 1 },
        { key: 'f', label: 'Frequency (f)', min: .3, max: 3, step: .1, def: 1 },
        { key: 'phase', label: 'Phase (&phi;)', min: -3.1, max: 3.1, step: .1, def: 0 }],
        domain: { xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -4, yMax: 4 },
        fx: (x, p) => p.A * Math.sin(p.f * x + p.phase),
        formula: p => `f(x) = ${p.A.toFixed(1)}·sin(${p.f.toFixed(1)}x + ${p.phase.toFixed(1)})`
      },
      cosine: {
        label: 'Cosine', dotColor: '#2e9fd6', title: 'Cosine Function',
        params: [{ key: 'A', label: 'Amplitude (A)', min: .3, max: 2.5, step: .1, def: 1 },
        { key: 'f', label: 'Frequency (f)', min: .3, max: 3, step: .1, def: 1 },
        { key: 'phase', label: 'Phase (&phi;)', min: -3.1, max: 3.1, step: .1, def: 0 }],
        domain: { xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -4, yMax: 4 },
        fx: (x, p) => p.A * Math.cos(p.f * x + p.phase),
        formula: p => `f(x) = ${p.A.toFixed(1)}·cos(${p.f.toFixed(1)}x + ${p.phase.toFixed(1)})`
      },
      tangent: {
        label: 'Tangent', dotColor: '#0a5c44', title: 'Tangent Function',
        params: [{ key: 'A', label: 'Amplitude (A)', min: .3, max: 2, step: .1, def: 1 },
        { key: 'f', label: 'Frequency (f)', min: .3, max: 2, step: .1, def: 1 }],
        domain: { xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -4, yMax: 4 },
        fx: (x, p) => p.A * Math.tan(p.f * x),
        formula: p => `f(x) = ${p.A.toFixed(1)}·tan(${p.f.toFixed(1)}x)`
      },
      parabola: {
        label: 'Parabola', dotColor: '#2e9fd6', title: 'Parabola',
        params: [{ key: 'a', label: 'Steepness (a)', min: -2, max: 2, step: .1, def: 1 },
        { key: 'c', label: 'Shift (c)', min: -4, max: 4, step: .5, def: 0 }],
        domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 8 },
        fx: (x, p) => p.a * x * x + p.c,
        formula: p => `f(x) = ${p.a.toFixed(1)}x² + ${p.c.toFixed(1)}`
      },
      linear: {
        label: 'Linear', dotColor: '#0e7c5c', title: 'Linear Function',
        params: [{ key: 'm', label: 'Slope (m)', min: -3, max: 3, step: .1, def: 1 },
        { key: 'b', label: 'Intercept (b)', min: -4, max: 4, step: .5, def: 0 }],
        domain: { xMin: -6, xMax: 6, yMin: -6, yMax: 6 },
        fx: (x, p) => p.m * x + p.b,
        formula: p => `f(x) = ${p.m.toFixed(1)}x + ${p.b.toFixed(1)}`
      }
    };

    let currentType = 'sine';
    let currentParams = {};
    Object.keys(FUNCS).forEach(k => {
      currentParams[k] = {};
      FUNCS[k].params.forEach(p => currentParams[k][p.key] = p.def);
    });

    const GW = 640, GH = 340, ML = 52, MR = 18, MT = 18, MB = 30;

    function toPx(x, y, dom) {
      const px = ML + (x - dom.xMin) / (dom.xMax - dom.xMin) * (GW - ML - MR);
      const py = MT + (1 - (y - dom.yMin) / (dom.yMax - dom.yMin)) * (GH - MT - MB);
      return [px, py];
    }

    function buildPath(type, params) {
      const cfg = FUNCS[type], dom = cfg.domain;
      const samples = 420;
      let d = '', started = false, prevPy = null;
      for (let i = 0; i <= samples; i++) {
        const x = dom.xMin + (dom.xMax - dom.xMin) * (i / samples);
        let y = cfg.fx(x, params);
        if (!isFinite(y)) continue;
        const [px, py] = toPx(x, clamp(y, dom.yMin - 2, dom.yMax + 2), dom);
        const big = Math.abs(y) > dom.yMax * 1.6;
        const jump = prevPy !== null && Math.abs(py - prevPy) > (GH * .55);
        if (big || jump || !started) {
          d += `M${px.toFixed(1)},${py.toFixed(1)} `;
          started = true;
        } else {
          d += `L${px.toFixed(1)},${py.toFixed(1)} `;
        }
        prevPy = py;
      }
      return d;
    }

    function gridLines(dom) {
      let lines = '';
      const [ox, oy] = toPx(0, 0, dom);
      // axes
      lines += `<line x1="${ML}" y1="${oy}" x2="${GW - MR}" y2="${oy}" stroke="#0c2b2333" stroke-width="1"/>`;
      lines += `<line x1="${ox}" y1="${MT}" x2="${ox}" y2="${GH - MB}" stroke="#0c2b2333" stroke-width="1"/>`;
      // y ticks
      const ySteps = 4;
      for (let i = -ySteps; i <= ySteps; i++) {
        const yv = (dom.yMax / ySteps) * i;
        if (yv < dom.yMin || yv > dom.yMax) continue;
        const [, py] = toPx(0, yv, dom);
        lines += `<line x1="${ML}" y1="${py.toFixed(1)}" x2="${GW - MR}" y2="${py.toFixed(1)}" stroke="#0c2b230f" stroke-width="1" stroke-dasharray="3 5"/>`;
        if (Math.abs(yv) > 0.01) lines += `<text x="${ML - 10}" y="${(py + 4).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="10.5" fill="#8aa89d">${yv.toFixed(1)}</text>`;
      }
      return lines;
    }

    function renderGraph() {
      const cfg = FUNCS[currentType], params = currentParams[currentType], dom = cfg.domain;
      const d = buildPath(currentType, params);
      document.getElementById('graphBox').innerHTML = `
  <svg viewBox="0 0 ${GW} ${GH}" width="100%">
    ${gridLines(dom)}
    <path id="fnPath" d="${d}" fill="none" stroke="${cfg.dotColor}" stroke-width="2.6" stroke-linecap="round"/>
    <circle r="6" fill="${cfg.dotColor}">
      <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
        <mpath href="#fnPath"/>
      </animateMotion>
    </circle>
  </svg>`;
      document.getElementById('graphTitle').textContent = cfg.title;
      document.getElementById('formulaTag').innerHTML = cfg.formula(params);
    }

    function renderSliders() {
      const cfg = FUNCS[currentType], params = currentParams[currentType];
      const host = document.getElementById('sliderHost');
      host.innerHTML = '';
      cfg.params.forEach(p => {
        const group = document.createElement('div');
        group.className = 'slider-group';
        group.innerHTML = `<label>${p.label} <b id="val-${p.key}">${params[p.key].toFixed(1)}</b></label>
      <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${params[p.key]}" data-key="${p.key}">`;
        host.appendChild(group);
        group.querySelector('input').addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          params[p.key] = val;
          document.getElementById(`val-${p.key}`).textContent = val.toFixed(1);
          renderGraph();
        });
      });
    }

    function renderFuncList() {
      const host = document.getElementById('funcList');
      host.innerHTML = '';
      Object.entries(FUNCS).forEach(([key, cfg]) => {
        const item = document.createElement('div');
        item.className = 'func-item' + (key === currentType ? ' active' : '');
        item.innerHTML = `<span class="fdot"></span>${cfg.label}`;
        item.addEventListener('click', () => {
          currentType = key;
          host.querySelectorAll('.func-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          renderSliders();
          renderGraph();
        });
        host.appendChild(item);
      });
    }

    renderFuncList();
    renderSliders();
    renderGraph();
  });

})(window);
