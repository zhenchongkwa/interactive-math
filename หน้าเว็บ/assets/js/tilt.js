/* ============================================
   tilt.js — การ์ดเอียง 3D + แสงสะท้อนวิ่งตามเมาส์

   perspective อยู่ที่ container (.tilt-scene) ไม่ใช่ที่การ์ด
   การ์ดในแถวเดียวกันจึงใช้ vanishing point ร่วมกัน ดูเป็นฉากเดียว

   หมายเหตุ: ไม่ใช้กับ .panel ของ Math Lab (frozen zone)
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('tilt', function () {

    var MAX_DEG = 7;        // เกินกว่านี้เริ่มดูเป็นของเล่น ไม่พรีเมียม
    var LIFT_Z = 16;        // ยกขึ้นมาหาคนดูตอน hover

    var cards = [];

    function measure() {
      cards = [].slice.call(document.querySelectorAll('.tilt')).map(function (el) {
        // IM.docPos วัดจาก offset chain จึงไม่โดน transform ของตัวเอง
        // หรือของ .tilt-scene/.reveal ที่ครอบอยู่กวนค่า
        var p = IM.docPos(el);
        return {
          el: el,
          left: p.x,
          top: p.y,
          wdt: p.w,
          hgt: p.h,
          rx: 0, ry: 0, z: 0,     // ค่าปัจจุบันที่ผ่าน damp
          inside: false
        };
      });
    }

    function tick(dt) {
      var px = IM.pointer.x;
      var py = IM.pointer.y;
      var sx = w.scrollX, sy = w.scrollY;
      var vh = w.innerHeight;
      var active = IM.pointer.active;

      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];

        // ตำแหน่งการ์ดใน viewport
        var l = c.left - sx;
        var t = c.top - sy;

        // การ์ดที่อยู่นอกจอไม่ต้องคิดอะไรเลย
        if (t > vh + 100 || t + c.hgt < -100) {
          if (c.rx || c.ry || c.z) {
            c.rx = c.ry = c.z = 0;
            c.inside = false;
            c.el.style.transform = '';
            c.el.classList.remove('is-lift');
          }
          continue;
        }

        var relX = (px - l) / c.wdt;      // 0..1 ภายในการ์ด
        var relY = (py - t) / c.hgt;

        var inside = active && relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1;

        if (inside !== c.inside) {
          c.inside = inside;
          c.el.classList.toggle('is-lift', inside);
        }

        var wantRx = 0, wantRy = 0, wantZ = 0;
        if (inside) {
          // แปลง 0..1 เป็น -1..1
          wantRx = -((relY - 0.5) * 2) * MAX_DEG;
          wantRy = ((relX - 0.5) * 2) * MAX_DEG;
          wantZ = LIFT_Z;

          // JS เขียนแค่ตำแหน่งแสงเป็น % ส่วนการวาด gradient เป็นงานของ CSS
          c.el.style.setProperty('--mx', (relX * 100).toFixed(1) + '%');
          c.el.style.setProperty('--my', (relY * 100).toFixed(1) + '%');
        }

        c.rx = IM.damp(c.rx, wantRx, 11, dt);
        c.ry = IM.damp(c.ry, wantRy, 11, dt);
        c.z = IM.damp(c.z, wantZ, 11, dt);

        if (Math.abs(c.rx) < 0.01 && Math.abs(c.ry) < 0.01 && Math.abs(c.z) < 0.05) {
          if (c.el.style.transform) {
            c.rx = c.ry = c.z = 0;
            c.el.style.transform = '';
          }
          continue;
        }

        c.el.style.transform =
          'rotateX(' + c.rx.toFixed(3) + 'deg) rotateY(' + c.ry.toFixed(3) + 'deg) translateZ(' + c.z.toFixed(2) + 'px)';
      }
    }

    var subscribed = false;

    function apply(ok) {
      // IM.mouseFx() = มีเมาส์จริง และยังอยู่โหมดคอม (ดู core.js)
      // นี่คือ "การ์ดหมุนตามเมาส์" ซึ่งบนจอสัมผัสไม่มีอะไรให้หมุนตาม
      if (ok && IM.mouseFx() && !subscribed) {
        measure();
        IM.ticker.add(tick);
        subscribed = true;
      } else if ((!ok || !IM.mouseFx()) && subscribed) {
        IM.ticker.remove(tick);
        subscribed = false;
        for (var i = 0; i < cards.length; i++) {
          cards[i].el.style.transform = '';
          cards[i].el.classList.remove('is-lift');
        }
      }
    }

    apply(IM.motionOK);
    IM.onMotionPrefChange(apply);

    // วัดใหม่ทุกครั้งที่ layout ขยับ (resize / ฟอนต์โหลดเสร็จ / reveal จบ)
    IM.onLayout(function () { if (subscribed) measure(); });
  });

})(window);
