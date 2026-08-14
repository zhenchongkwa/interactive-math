/* ============================================
   cursor.js — เคอร์เซอร์พิเศษ + ปุ่มดูดเมาส์ (magnetic)

   สองชั้น: จุดเล็กปักที่ตำแหน่งเมาส์เป๊ะ + วงแหวนตามช้ากว่าเป็นหาง
   ขยับด้วย transform อย่างเดียว ไม่แตะ left/top (จะ trigger layout ทุกเฟรม)

   บนอุปกรณ์สัมผัสหรือเมื่อผู้ใช้ตั้ง reduced motion
   จะไม่สร้างอะไรเลยและไม่ซ่อนเคอร์เซอร์ระบบ
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('cursor', function () {

    var root = document.documentElement;
    var dot = null, ring = null;
    var live = false;

    // จุดใช้ตำแหน่งดิบตรงๆ ส่วนวงแหวนผ่าน damp จึงต้องเก็บตำแหน่งของตัวเองไว้
    var dx = w.innerWidth / 2, dy = w.innerHeight / 2;
    var rx = dx, ry = dy;
    var ringScale = 1;
    var wasHot = false;

    /* ---------------------------------------------
       MAGNETIC — cache ตำแหน่งไว้ ไม่เรียก
       getBoundingClientRect ใน loop (layout thrash)
       --------------------------------------------- */

    var magnets = [];

    function measureMagnets() {
      magnets = [].slice.call(document.querySelectorAll('.magnetic')).map(function (el) {
        // IM.docPos ไม่สนใจ transform จึงไม่ต้องล้าง transform ก่อนวัด
        // และไม่โดน .reveal ที่กำลัง animate อยู่กวนค่า
        var p = IM.docPos(el);
        return {
          el: el,
          // พิกัด document แล้วค่อยลบ scroll ตอนใช้
          cx: p.x + p.w / 2,
          cy: p.y + p.h / 2,
          radius: Math.max(p.w, p.h) / 2 + 68,
          hidden: p.w === 0 || p.h === 0,   // ปุ่มที่ถูก media query ซ่อนไว้
          ox: 0, oy: 0
        };
      });
    }

    /* ---------------------------------------------
       LOOP
       --------------------------------------------- */

    function tick(dt) {
      var px = IM.pointer.x;
      var py = IM.pointer.y;

      /* --- เคอร์เซอร์ ---
         จุดปักอยู่ที่ตำแหน่งเมาส์ตรงๆ ไม่ผ่าน damp

         เดิมจุดถูกหน่วงด้วย lambda 34 ซึ่งไล่ตามได้แค่ 43% ของระยะห่างต่อเฟรม
         วัดแล้วตอนลากเมาส์ 1000 px/s จุดตามหลังของจริงราว 22 px — และเพราะหน้านี้
         ซ่อนเคอร์เซอร์ของระบบทิ้ง (คลาส .im-cursor) สิ่งที่ผู้ใช้เห็นจึงมีแค่จุดที่ตามไม่ทัน
         อ่านออกมาเป็น "เว็บแล็ค" ทั้งที่เฟรมเรตไม่ได้ตก

         วงแหวนยังหน่วงเหมือนเดิม หางที่ลากตามเป็นเอฟเฟกต์ที่ตั้งใจ และไม่ได้ทำหน้าที่
         บอกตำแหน่งจึงช้าได้ ตัวที่ต้องเป๊ะคือจุดซึ่งทำหน้าที่แทนปลายลูกศรจริง */
      dx = px;
      dy = py;
      rx = IM.damp(rx, px, 11, dt);      // วงแหวน: หน่วงกว่า เห็นเป็นหางตาม
      ry = IM.damp(ry, py, 11, dt);

      var hot = !!IM.pointer.target;
      var want = IM.pointer.down ? 0.72 : (hot ? 1.7 : 1);
      ringScale = IM.damp(ringScale, want, 12, dt);

      dot.style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0) scale(' + ringScale.toFixed(3) + ')';
      // แตะ classList เฉพาะตอนค่าเปลี่ยนจริง ไม่ใช่ทุกเฟรม
      if (hot !== wasHot) { ring.classList.toggle('is-hot', hot); wasHot = hot; }

      /* --- ปุ่มดูดเมาส์ --- */
      var sx = w.scrollX, sy = w.scrollY;

      for (var i = 0; i < magnets.length; i++) {
        var m = magnets[i];
        if (m.hidden) continue;          // ปุ่มที่ถูกซ่อนไม่ต้องคิด

        var vx = m.cx - sx;              // ตำแหน่งกึ่งกลางใน viewport
        var vy = m.cy - sy;

        var ddx = px - vx;
        var ddy = py - vy;
        var dist = Math.hypot(ddx, ddy);

        var tx = 0, ty = 0;
        if (IM.pointer.active && dist < m.radius) {
          var pull = 1 - dist / m.radius;         // ยิ่งใกล้ยิ่งดูดแรง
          tx = IM.clamp(ddx * 0.32 * pull, -14, 14);
          ty = IM.clamp(ddy * 0.32 * pull, -14, 14);
        }

        m.ox = IM.damp(m.ox, tx, 13, dt);
        m.oy = IM.damp(m.oy, ty, 13, dt);

        // ต่ำกว่า 0.05px แล้วเขียน '' ทิ้ง เพื่อไม่ให้ค้าง transform ที่ไม่จำเป็น
        if (Math.abs(m.ox) < 0.05 && Math.abs(m.oy) < 0.05) {
          m.ox = m.oy = 0;
          if (m.el.style.transform) m.el.style.transform = '';
        } else {
          m.el.style.transform = 'translate3d(' + m.ox.toFixed(2) + 'px,' + m.oy.toFixed(2) + 'px,0)';
        }
      }
    }

    /* ---------------------------------------------
       เปิด / ปิด
       --------------------------------------------- */

    function enable() {
      if (live) return;

      dot = document.createElement('div');
      dot.className = 'cur-dot';
      dot.setAttribute('aria-hidden', 'true');

      ring = document.createElement('div');
      ring.className = 'cur-ring';
      ring.setAttribute('aria-hidden', 'true');

      document.body.appendChild(ring);
      document.body.appendChild(dot);

      measureMagnets();
      IM.ticker.add(tick);

      // ซ่อนเคอร์เซอร์ระบบ "หลัง" ตัวแทนอยู่ใน DOM แล้วเท่านั้น
      // ถ้าใส่คลาสนี้ก่อน ผู้ใช้จะไม่เห็นเคอร์เซอร์อะไรเลยแม้แต่วินาทีเดียว
      root.classList.add('im-cursor');
      live = true;
    }

    function disable() {
      if (!live) return;

      IM.ticker.remove(tick);
      root.classList.remove('im-cursor');

      if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
      if (ring && ring.parentNode) ring.parentNode.removeChild(ring);
      dot = ring = null;

      for (var i = 0; i < magnets.length; i++) magnets[i].el.style.transform = '';
      live = false;
    }

    function apply(ok) {
      // อุปกรณ์สัมผัสไม่มีเคอร์เซอร์ให้แทน และ magnetic ก็ไม่มีความหมาย
      // เช่นเดียวกับโหมดมือถือที่ผู้ใช้เลือกเอง — IM.mouseFx() รวมสองข้อนั้นไว้ (ดู core.js)
      if (ok && IM.mouseFx()) enable();
      else disable();
    }

    apply(IM.motionOK);
    IM.onMotionPrefChange(apply);

    // วัดใหม่ทุกครั้งที่ layout ขยับ (resize / ฟอนต์โหลดเสร็จ / reveal จบ)
    IM.onLayout(function () { if (live) measureMagnets(); });
  });

})(window);
