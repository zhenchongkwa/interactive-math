/* ============================================
   hero.js — ภาพประกอบ hero แบบ SVG

   ต่อยอดจาก renderHeroArt เดิม เพิ่ม
   - คลื่น sine ที่ไหลจริงๆ (คำนวณใหม่ทุกเฟรม ไม่ใช้ SMIL)
   - จุดวิ่งบนคลื่นที่คำนวณตำแหน่งเอง จึงเกาะเส้นได้เป๊ะแม้เส้นขยับ
   - พารัลแลกซ์ตามเมาส์ แต่ละชั้นขยับคนละความลึก
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('hero', function () {

    var host = document.getElementById('heroArt');
    if (!host) return;

    var W = 520, H = 460;
    var BASE_Y = 250;       // เส้นแกน x
    var AMP = 52;
    var WAVELEN = 150;
    var X0 = 20, X1 = 500;

    host.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="100%" aria-hidden="true">' +
        // ชั้นหลัง — ขยับเยอะสุด (โทนแก้วขาวโปร่งให้เข้ากับธีมเข้ม — ใส่ id ไว้เพราะ
        // เป็นสีขาวล้วน ต้อง patch เป็นเฉดเข้มตอน light mode ไม่งั้นจางหายบนพื้นขาว)
        '<g class="hl" data-depth="1">' +
          '<circle id="heroBlob" class="float" cx="380" cy="120" r="140" fill="rgba(255,255,255,.10)" style="animation-duration:9s"/>' +
          '<circle class="float" cx="150" cy="372" r="26" fill="rgba(116,210,247,.28)" style="animation-duration:6.5s;animation-delay:-3s"/>' +
          '<circle class="float" cx="330" cy="400" r="14" fill="rgba(116,210,247,.38)" style="animation-duration:5s;animation-delay:-1.4s"/>' +
        '</g>' +

        // ชั้นเส้นกริด / แกน
        '<g class="hl" data-depth=".55">' +
          '<circle id="heroRing" cx="270" cy="250" r="188" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="1.4" stroke-dasharray="4 7"/>' +
          '<line id="heroAxisV" x1="270" y1="62" x2="270" y2="438" stroke="rgba(255,255,255,.20)" stroke-width="1"/>' +
          '<line id="heroAxisH" x1="82" y1="250" x2="458" y2="250" stroke="rgba(255,255,255,.20)" stroke-width="1"/>' +
        '</g>' +

        // ชั้นรูปทรง
        '<g class="hl" data-depth=".8">' +
          '<circle cx="392" cy="112" r="46" fill="none" stroke="rgba(78,227,160,.75)" stroke-width="22"/>' +
          '<g class="float" style="animation-duration:7s;animation-delay:-2s">' +
            '<path id="heroTri" d="M410 300 L460 388 L360 388 Z" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.32)" stroke-width="1"/>' +
          '</g>' +
          '<rect id="heroSquare" class="float" x="52" y="72" width="26" height="26" rx="5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" transform="rotate(14 65 85)" style="animation-duration:5.5s;animation-delay:-1s"/>' +
        '</g>' +

        // พาราโบลา
        '<g class="hl" data-depth=".35">' +
          '<path id="heroParab" d="" fill="none" stroke="rgba(78,227,160,.5)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 6"/>' +
        '</g>' +

        // คลื่น sine — ชั้นหน้าสุด ขยับน้อยสุด
        '<g class="hl" data-depth=".18">' +
          '<path id="heroSine" d="" fill="none" stroke="#74d2f7" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<circle id="heroDot" r="6.5" fill="#4ee3a0"/>' +
          '<circle id="heroDot2" r="4" fill="#74d2f7" opacity=".7"/>' +
          '<circle cx="132" cy="252" r="6" fill="#4ee3a0"/>' +
          '<circle cx="270" cy="188" r="6" fill="#4ee3a0"/>' +
          '<circle cx="408" cy="252" r="6" fill="#74d2f7"/>' +
          '<text x="150" y="205" font-family="IBM Plex Mono, monospace" font-size="13" fill="#74d2f7">f(x) = sin(x)</text>' +
          '<text x="345" y="80" font-family="IBM Plex Mono, monospace" font-size="12" fill="#4ee3a0">y = x&#178;</text>' +
        '</g>' +
      '</svg>';

    var sinePath = document.getElementById('heroSine');
    var parabPath = document.getElementById('heroParab');
    var dot = document.getElementById('heroDot');
    var dot2 = document.getElementById('heroDot2');

    /* ---------- shape ประดับสีขาวล้วน ----------
       องค์ประกอบที่มีสีสัน (คลื่น sine, จุด, พาราโบลา, ตัวหนังสือสูตร) ใช้ hex
       เข้ม/ฟ้าอมเขียวอยู่แล้ว อ่านออกได้ทั้งสองธีม ไม่ต้องแก้
       ตัวที่ต้อง patch มีแค่ 6 ตัวนี้ที่เป็น rgba(255,255,255,...) ล้วน
       ห้าม rebuild SVG ใหม่ทั้งก้อนตอนสลับธีม — จะรีเซ็ต phase คลื่นกับตำแหน่ง
       parallax ที่กำลังขยับอยู่ จึงแค่ patch attribute ของ 6 ตัวนี้พอ */
    var HERO_SHAPES = {
      heroBlob:   { attr: 'fill',   dark: 'rgba(255,255,255,.10)', light: 'rgba(18,22,28,.06)' },
      heroRing:   { attr: 'stroke', dark: 'rgba(255,255,255,.26)', light: 'rgba(18,22,28,.22)' },
      heroAxisV:  { attr: 'stroke', dark: 'rgba(255,255,255,.20)', light: 'rgba(18,22,28,.16)' },
      heroAxisH:  { attr: 'stroke', dark: 'rgba(255,255,255,.20)', light: 'rgba(18,22,28,.16)' },
      heroSquare: { attr: 'stroke', dark: 'rgba(255,255,255,.55)', light: 'rgba(18,22,28,.42)' }
    };
    // สามเหลี่ยมมีสองแอตทริบิวต์ (fill+stroke) เลยแยกไว้ต่างหาก
    var HERO_TRI = { fillDark: 'rgba(255,255,255,.16)', fillLight: 'rgba(18,22,28,.08)',
                      strokeDark: 'rgba(255,255,255,.32)', strokeLight: 'rgba(18,22,28,.28)' };

    function applyHeroTheme(theme) {
      var light = theme === 'light';
      Object.keys(HERO_SHAPES).forEach(function (id) {
        var el = document.getElementById(id);
        var cfg = HERO_SHAPES[id];
        if (el) el.setAttribute(cfg.attr, light ? cfg.light : cfg.dark);
      });
      var tri = document.getElementById('heroTri');
      if (tri) {
        tri.setAttribute('fill', light ? HERO_TRI.fillLight : HERO_TRI.fillDark);
        tri.setAttribute('stroke', light ? HERO_TRI.strokeLight : HERO_TRI.strokeDark);
      }
    }
    applyHeroTheme(IM.theme);
    IM.onThemeChange(applyHeroTheme);

    var layers = [].slice.call(host.querySelectorAll('.hl')).map(function (g) {
      return { g: g, depth: parseFloat(g.dataset.depth) || 0, x: 0, y: 0 };
    });

    /* ---------- พาราโบลา (นิ่ง วาดครั้งเดียว) ---------- */
    (function drawParabola() {
      var d = '';
      for (var x = 150; x <= 400; x += 8) {
        var t = (x - 275) / 62;
        var y = 190 + t * t * 22;
        if (y > 430) continue;
        d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      }
      parabPath.setAttribute('d', d);
    })();

    /* ---------- คลื่นที่ไหล ---------- */

    function waveY(x, phase) {
      return BASE_Y + AMP * Math.sin((x / WAVELEN) * 2 * Math.PI + phase);
    }

    function buildWave(phase) {
      var d = '';
      for (var x = X0; x <= X1; x += 6) {
        d += (x === X0 ? 'M' : 'L') + x + ',' + waveY(x, phase).toFixed(1) + ' ';
      }
      return d;
    }

    var phase = 0;
    var travel = 0;

    // สถานะเริ่มต้น เผื่อ motionOK เป็น false แล้วไม่มี ticker มาวาดให้
    sinePath.setAttribute('d', buildWave(0));
    dot.setAttribute('cx', X0); dot.setAttribute('cy', waveY(X0, 0));
    dot2.setAttribute('cx', X0); dot2.setAttribute('cy', waveY(X0, 0));

    function tick(dt) {
      /* --- คลื่นไหลไปเรื่อยๆ --- */
      phase -= dt * 1.05;
      sinePath.setAttribute('d', buildWave(phase));

      /* --- จุดวิ่งบนคลื่น ---
         คำนวณตำแหน่งเองแทนการใช้ SMIL animateMotion
         จุดจึงเกาะเส้นได้เป๊ะแม้เส้นกำลังขยับ */
      travel += dt * 116;
      if (travel > X1 - X0) travel -= (X1 - X0);

      var dx1 = X0 + travel;
      dot.setAttribute('cx', dx1.toFixed(1));
      dot.setAttribute('cy', waveY(dx1, phase).toFixed(1));

      var dx2 = X0 + ((travel + (X1 - X0) * 0.55) % (X1 - X0));
      dot2.setAttribute('cx', dx2.toFixed(1));
      dot2.setAttribute('cy', waveY(dx2, phase).toFixed(1));

      /* --- พารัลแลกซ์ตามเมาส์ --- */
      var nx = 0, ny = 0;
      if (IM.pointer.active) {
        nx = IM.pointer.sx / w.innerWidth - 0.5;
        ny = IM.pointer.sy / w.innerHeight - 0.5;
      }

      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        // ชั้นลึกกว่าขยับมากกว่าและตามช้ากว่า → รู้สึกเป็นระยะจริง
        var wantX = -nx * L.depth * 34;
        var wantY = -ny * L.depth * 26;

        L.x = IM.damp(L.x, wantX, 3 + L.depth * 3, dt);
        L.y = IM.damp(L.y, wantY, 3 + L.depth * 3, dt);

        // ใช้ attribute ไม่ใช่ style.transform — รองรับกว้างกว่าใน SVG
        L.g.setAttribute('transform', 'translate(' + L.x.toFixed(2) + ',' + L.y.toFixed(2) + ')');
      }
    }

    var subscribed = false;

    function apply(ok) {
      /* IM.mouseFx() = มีเมาส์จริง และยังอยู่โหมดคอม (ดู core.js)
         parallax ตามเมาส์ไม่มีความหมายบนนิ้ว และคลื่นที่ไหลอยู่ก็ประกอบสตริง path
         ยาว 80 กว่าจุดใหม่ทุกเฟรมเพื่อการนั้น เฟรมนิ่งที่วาดไว้ตอนสร้างยังอยู่ครบ
         งานศิลป์จึงไม่หายไปไหน แค่หยุดเคลื่อน */
      if (ok && IM.mouseFx() && !subscribed) {
        IM.ticker.add(tick);
        subscribed = true;
      } else if ((!ok || !IM.mouseFx()) && subscribed) {
        IM.ticker.remove(tick);
        subscribed = false;
        for (var i = 0; i < layers.length; i++) layers[i].g.removeAttribute('transform');
      }
    }

    apply(IM.motionOK);
    IM.onMotionPrefChange(apply);
  });

})(window);
