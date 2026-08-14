/* ============================================
   field.js — พื้นหลังอนุภาคบน canvas ที่ตอบสนองเมาส์

   อนุภาคลอยช้าๆ เชื่อมเส้นถึงกันเมื่ออยู่ใกล้
   เมาส์ผ่านตรงไหน อนุภาคแถวนั้นจะถูกผลักออกแล้วค่อยๆ ไหลกลับ
   เส้นเชื่อมใกล้เคอร์เซอร์จะสว่างขึ้น
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('field', function () {

    var canvas = document.createElement('canvas');
    canvas.id = 'field';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    /* ---------- สีดึงจาก CSS custom properties ----------
       ธีมยังคุมจาก tokens.css ที่เดียว ไม่ hardcode ซ้ำ

       อ่านผ่านฟังก์ชันแทนที่จะอ่านครั้งเดียวตอน setup() เฉยๆ
       เพราะตอนสลับ dark/light ตัวแปร --green/--blue เปลี่ยนค่าจริง
       ถ้าไม่มาอ่านซ้ำ อนุภาคจะค้างสีธีมเก่าจนกว่าจะ resize หน้าต่าง */

    function readVar(name, fallback) {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    }
    function hexToRgb(hex) {
      var h = hex.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    var rgbGreen, rgbBlue;

    function readColors() {
      rgbGreen = hexToRgb(readVar('--green', '#0e7c5c')).join(',');
      rgbBlue = hexToRgb(readVar('--blue', '#2e9fd6')).join(',');
    }
    readColors();
    IM.onThemeChange(readColors);

    /* ---------- ค่าคงที่ ---------- */

    // ระยะเชื่อมเส้นคำนวณจากระยะห่างเฉลี่ยของอนุภาคใน setup()
    // ถ้า fix ไว้ตายตัว จอเล็กจะกลายเป็นตาข่ายทึบเพราะอนุภาคอยู่ชิดกัน
    var LINK_DIST = 132;
    var LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    var MOUSE_R = 168;                // รัศมีที่เมาส์ออกแรงผลัก
    var MOUSE_R_SQ = MOUSE_R * MOUSE_R;
    var PUSH = 1250;                  // ความแรงของการผลัก (px/s²)

    var particles = [];
    var vw = 0, vh = 0, dpr = 1;

    /* ---------- setup / resize ---------- */

    function setup() {
      vw = w.innerWidth;
      vh = w.innerHeight;
      dpr = Math.min(w.devicePixelRatio || 1, 2);   // cap ที่ 2 — จอ 3x ไม่คุ้ม fill rate

      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = vw + 'px';
      canvas.style.height = vh + 'px';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);       // วาดด้วยพิกัด CSS ได้เลย

      // จำนวนอนุภาคผูกกับพื้นที่จอ มี cap กันเครื่องอืดบนจอใหญ่
      var count = Math.round(IM.clamp((vw * vh) / 16000, 30, 110));

      // ระยะเชื่อมอิงระยะห่างเฉลี่ยจริง → ความหนาแน่นคงที่ทุกขนาดจอ
      // (~2-3 เส้นต่ออนุภาค ไม่ว่าจะจอเล็กหรือจอใหญ่)
      var spacing = Math.sqrt((vw * vh) / count);
      LINK_DIST = IM.clamp(spacing * 1.12, 62, 150);
      LINK_DIST_SQ = LINK_DIST * LINK_DIST;

      buildParticles(count);
    }

    function buildParticles(count) {
      var old = particles;
      particles = [];

      for (var i = 0; i < count; i++) {
        if (old[i]) {
          // เก็บของเดิมไว้ ไม่ให้กระพริบตอน resize
          old[i].x = IM.clamp(old[i].x, 0, vw);
          old[i].y = IM.clamp(old[i].y, 0, vh);
          particles.push(old[i]);
          continue;
        }
        var isBlue = Math.random() < 0.22;
        particles.push({
          x: Math.random() * vw,
          y: Math.random() * vh,
          bvx: (Math.random() - 0.5) * 22,   // ความเร็วลอยพื้นฐาน px/s
          bvy: (Math.random() - 0.5) * 22,
          vx: 0,
          vy: 0,
          r: 1.1 + Math.random() * 1.9,
          blue: isBlue,
          glow: 0
        });
      }
      for (var j = 0; j < particles.length; j++) {
        particles[j].vx = particles[j].bvx;
        particles[j].vy = particles[j].bvy;
      }
    }

    setup();
    IM.onResize(setup);

    /* ---------- loop ---------- */

    function tick(dt) {
      var p, i, j;
      var mx = IM.pointer.x;
      var my = IM.pointer.y;
      var mouseOn = IM.pointer.active;

      ctx.clearRect(0, 0, vw, vh);

      /* --- 1. ฟิสิกส์ --- */
      for (i = 0; i < particles.length; i++) {
        p = particles[i];

        if (mouseOn) {
          var dx = p.x - mx;
          var dy = p.y - my;
          var dSq = dx * dx + dy * dy;          // เทียบระยะกำลังสอง ไม่ต้องเรียก sqrt

          if (dSq < MOUSE_R_SQ && dSq > 0.01) {
            var d = Math.sqrt(dSq);             // เรียก sqrt เฉพาะตัวที่อยู่ในรัศมีจริงๆ
            var falloff = 1 - d / MOUSE_R;
            var force = falloff * falloff;      // กำลังสอง = ใกล้แล้วแรงพุ่งขึ้นชัด

            p.vx += (dx / d) * force * PUSH * dt;
            p.vy += (dy / d) * force * PUSH * dt;
            p.glow = Math.max(p.glow, force);
          }
        }

        // คลายกลับสู่ความเร็วลอยพื้นฐาน — ทำให้ "ไหลกลับ" แทนที่จะกระเด็นหายไป
        p.vx = IM.damp(p.vx, p.bvx, 2.2, dt);
        p.vy = IM.damp(p.vy, p.bvy, 2.2, dt);
        p.glow = IM.damp(p.glow, 0, 3.2, dt);

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // วนขอบจอ
        if (p.x < -20) p.x = vw + 20; else if (p.x > vw + 20) p.x = -20;
        if (p.y < -20) p.y = vh + 20; else if (p.y > vh + 20) p.y = -20;
      }

      /* --- 2. เส้นเชื่อม ---
         O(n²) แต่ที่ 110 อนุภาค = ~6,000 คู่ต่อเฟรม ซึ่งถูกมาก
         จึงไม่ต้องทำ spatial grid ให้ซับซ้อน */
      ctx.lineWidth = 1;
      for (i = 0; i < particles.length; i++) {
        var a = particles[i];
        for (j = i + 1; j < particles.length; j++) {
          var b = particles[j];
          var lx = a.x - b.x;
          var ly = a.y - b.y;
          var lSq = lx * lx + ly * ly;
          if (lSq > LINK_DIST_SQ) continue;

          var t = 1 - lSq / LINK_DIST_SQ;        // ใกล้ = ทึบกว่า
          var boost = (a.glow + b.glow) * 0.5;   // เส้นแถวเคอร์เซอร์สว่างขึ้น
          var alpha = t * 0.17 + boost * 0.42;
          if (alpha < 0.012) continue;

          ctx.strokeStyle = 'rgba(' + rgbGreen + ',' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      /* --- 3. อนุภาค --- */
      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        var rr = p.r * (1 + p.glow * 1.5);
        var op = 0.34 + p.glow * 0.55;

        ctx.fillStyle = 'rgba(' + (p.blue ? rgbBlue : rgbGreen) + ',' + op.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, 6.283185);
        ctx.fill();
      }
    }

    /* ---------- เปิด/ปิดตาม motion preference ---------- */

    var subscribed = false;

    function apply(ok) {
      /* IM.mouseFx() = มีเมาส์จริง และยังอยู่โหมดคอม (ดู core.js)
         อนุภาคผลักตัวหนีเมาส์ ซึ่งนิ้วไม่เคยได้เห็น เหลือแค่จุดลอยกับเส้นเชื่อมที่วาดใหม่
         ทุกเฟรมด้วยการวนแบบ O(n²) — บนมือถือคือการเผาแบตเพื่อภาพที่ไม่มีใครได้ */
      if (ok && IM.mouseFx() && !subscribed) {
        IM.ticker.add(tick);
        subscribed = true;
        canvas.classList.add('is-on');
      } else if ((!ok || !IM.mouseFx()) && subscribed) {
        IM.ticker.remove(tick);
        subscribed = false;
        canvas.classList.remove('is-on');
        ctx.clearRect(0, 0, vw, vh);
      }
    }

    apply(IM.motionOK);
    IM.onMotionPrefChange(apply);
  });

})(window);
