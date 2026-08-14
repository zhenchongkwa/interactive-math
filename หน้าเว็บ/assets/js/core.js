/* ============================================
   core.js — หัวใจของระบบโมชั่น
   rAF ticker ตัวเดียว + pointer singleton + damp + motionOK

   ทุกโมดูลต้อง subscribe เข้ามาที่ ticker ตัวนี้
   ห้ามเปิด requestAnimationFrame ของตัวเอง
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM || (w.IM = {});

  /* ---------- math helpers ---------- */

  IM.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /**
   * Damping ที่ไม่ผูกกับ frame rate
   *
   * สูตรที่คนเขียนกันบ่อย  a += (b - a) * 0.1  นั้น "ผิด"
   * เพราะจอ 144Hz เรียก 144 ครั้ง/วินาที ส่วน 60Hz เรียก 60 ครั้ง/วินาที
   * ผลคือความหน่วงต่างกัน 2.4 เท่าบนเครื่องคนละตัว
   *
   * รูป exponential ข้างล่างให้ผลเท่ากันทุก refresh rate
   * lambda สูง = ตามเร็ว (cursor ~18), lambda ต่ำ = หน่วงนุ่ม (parallax ~4)
   */
  IM.damp = function (a, b, lambda, dt) {
    return b + (a - b) * Math.exp(-lambda * dt);
  };

  /**
   * ตำแหน่งของ element ในพิกัด document โดย "ไม่สนใจ CSS transform"
   *
   * ทำไมไม่ใช้ getBoundingClientRect: rect รวมผลของ transform ทุกชั้นด้วย
   * การ์ดของเราอยู่ใน .reveal ที่เริ่มด้วย translateY(28px)
   * ถ้าวัดด้วย rect ตอนนั้นจะได้ตำแหน่งต่ำกว่าความจริง 28px
   * แล้วพอ reveal จบ ค่าที่ cache ไว้ก็ผิดทันที
   *
   * offsetLeft/offsetTop/offsetWidth/offsetHeight เป็นค่า layout ล้วน
   * transform ไม่มีผล จึงวัดได้ถูกต้องไม่ว่าจะกำลัง animate อยู่หรือไม่
   */
  IM.docPos = function (el) {
    var x = 0, y = 0, n = el;
    while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  };

  /* ---------- motion preference ---------- */

  var mqReduce = w.matchMedia('(prefers-reduced-motion: reduce)');
  var mqCoarse = w.matchMedia('(pointer: coarse)');

  IM.motionOK = !mqReduce.matches;
  IM.isCoarse = mqCoarse.matches;

  var prefListeners = [];
  IM.onMotionPrefChange = function (fn) { prefListeners.push(fn); };

  function emitPref() {
    IM.motionOK = !mqReduce.matches;
    IM.isCoarse = mqCoarse.matches;
    for (var i = 0; i < prefListeners.length; i++) {
      try { prefListeners[i](IM.motionOK); } catch (e) { console.warn('[IM] pref listener', e); }
    }
  }
  // Safari เก่าใช้ addListener — รองรับทั้งสองแบบ
  if (mqReduce.addEventListener) {
    mqReduce.addEventListener('change', emitPref);
    mqCoarse.addEventListener('change', emitPref);
  } else if (mqReduce.addListener) {
    mqReduce.addListener(emitPref);
    mqCoarse.addListener(emitPref);
  }

  /* ---------- ticker ---------- */

  var subs = [];
  var rafId = 0;
  var lastTime = 0;
  var running = false;

  function frame(now) {
    // dt เป็นวินาที และ cap ไว้ที่ 1/20 วิ
    // กันภาพกระโดดตอนกลับมาจาก tab ที่ถูกซ่อน หรือเครื่องหน่วงยาว
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = now;

    // สำเนา array ก่อนวน เผื่อมี callback ที่ remove ตัวเองระหว่างทาง
    var list = subs.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](dt, now); } catch (e) { console.warn('[IM] ticker sub', e); }
    }

    rafId = w.requestAnimationFrame(frame);
  }

  function start() {
    if (running || !subs.length) return;
    running = true;
    lastTime = 0;               // reset เสมอ ไม่งั้น dt แรกจะเพี้ยน
    rafId = w.requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    w.cancelAnimationFrame(rafId);
    rafId = 0;
    lastTime = 0;
  }

  IM.ticker = {
    add: function (fn) {
      if (subs.indexOf(fn) === -1) subs.push(fn);
      start();
      return fn;
    },
    remove: function (fn) {
      var i = subs.indexOf(fn);
      if (i > -1) subs.splice(i, 1);
      if (!subs.length) stop();      // ไม่มีใครใช้แล้วก็ไม่ต้องเผา CPU
    },
    get count() { return subs.length; }
  };

  // tab ซ่อน = หยุด rAF ทั้งหมด (เบราว์เซอร์ throttle อยู่แล้วแต่หยุดเองชัวร์กว่า)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  /* ---------- pointer singleton ----------
     ผูก listener ที่ document ครั้งเดียว
     cursor / tilt / field อ่านจากที่นี่ทั้งหมด
     ห้ามให้แต่ละโมดูลผูก pointermove เอง                       */

  var pointer = IM.pointer = {
    x: w.innerWidth / 2,   // ตำแหน่งดิบ (viewport coords)
    y: w.innerHeight / 2,
    sx: w.innerWidth / 2,  // ตำแหน่งที่ผ่าน damp แล้ว
    sy: w.innerHeight / 2,
    vx: 0,                 // ความเร็ว px/s
    vy: 0,
    speed: 0,
    active: false,         // เมาส์เคยขยับในหน้านี้แล้วหรือยัง
    down: false,
    target: null           // element ที่มี [data-cursor] ใต้เมาส์ตอนนี้
  };

  var prevSx = pointer.sx;
  var prevSy = pointer.sy;

  document.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  }, { passive: true });

  document.addEventListener('pointerdown', function () { pointer.down = true; }, { passive: true });
  document.addEventListener('pointerup', function () { pointer.down = false; }, { passive: true });

  // เมาส์ออกนอกหน้าต่าง — ให้ effect ต่างๆ คลายกลับตรงกลาง
  document.addEventListener('pointerleave', function () { pointer.active = false; }, { passive: true });

  // ตรวจว่าอยู่เหนือ element ที่ interactive แบบ delegated ครั้งเดียว
  // ใช้ convention [data-cursor] แทนการผูก listener ทีละตัว
  document.addEventListener('pointerover', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-cursor]') : null;
    pointer.target = t;
  }, { passive: true });

  // pointer update ต้องรันก่อน subscriber ตัวอื่นเสมอ จึง add เป็นตัวแรก
  IM.ticker.add(function (dt) {
    pointer.sx = IM.damp(pointer.sx, pointer.x, 14, dt);
    pointer.sy = IM.damp(pointer.sy, pointer.y, 14, dt);

    pointer.vx = (pointer.sx - prevSx) / dt;
    pointer.vy = (pointer.sy - prevSy) / dt;
    pointer.speed = Math.hypot(pointer.vx, pointer.vy);

    prevSx = pointer.sx;
    prevSy = pointer.sy;
  });

  /* ---------- viewport singleton ----------
     rect ของ viewport ที่โมดูลอื่นใช้ร่วมกัน อัปเดตแบบ debounce */

  var vp = IM.viewport = { w: w.innerWidth, h: w.innerHeight, dpr: Math.min(w.devicePixelRatio || 1, 2) };
  var resizeSubs = [];
  var resizeTimer = 0;

  IM.onResize = function (fn) { resizeSubs.push(fn); return fn; };

  w.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      vp.w = w.innerWidth;
      vp.h = w.innerHeight;
      vp.dpr = Math.min(w.devicePixelRatio || 1, 2);
      for (var i = 0; i < resizeSubs.length; i++) {
        try { resizeSubs[i](vp); } catch (e) { console.warn('[IM] resize sub', e); }
      }
      IM.invalidateLayout();
    }, 150);
  }, { passive: true });

  /* ---------- layout invalidation ----------
     โมดูลที่ cache ตำแหน่งไว้ (magnetic, tilt, parallax) ต้องวัดใหม่
     เมื่อ layout ขยับ ไม่ใช่แค่ตอน resize

     เคสที่กัดจริง: .reveal เริ่มด้วย translateY(28px)
     ถ้าวัดตำแหน่งการ์ดตอนนั้น จะได้ค่าต่ำกว่าความจริง 28px
     พอ reveal จบแล้วตำแหน่งเลื่อนขึ้น แต่ค่าที่ cache ไว้ยังเป็นของเก่า
     → hover ไม่ตรงกับที่ตาเห็น
     จึงต้องยิง invalidate ตอน transition ของ reveal จบด้วย            */

  var layoutSubs = [];
  var layoutTimer = 0;

  IM.onLayout = function (fn) { layoutSubs.push(fn); return fn; };

  IM.invalidateLayout = function () {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(function () {
      for (var i = 0; i < layoutSubs.length; i++) {
        try { layoutSubs[i](); } catch (e) { console.warn('[IM] layout sub', e); }
      }
    }, 120);
  };

  w.addEventListener('load', function () { IM.invalidateLayout(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { IM.invalidateLayout(); });
  }

  /* ---------- boot registry ----------
     แต่ละไฟล์แค่ลงทะเบียนไว้ main.js เป็นตัวเรียกจริงตัวเดียว */

  IM.modules = {};
  IM.register = function (name, initFn) { IM.modules[name] = initFn; };

  /* ---------- scroll lock ----------
     ตั้งเป็น true ตอนมี overlay เปิด (เช่น หน้าต่างวิดีโอ)
     scroll.js จะหยุดทั้ง wheel handler และการสั่ง scrollTo ทุกเฟรม
     ไม่งั้นหน้าเบื้องหลังจะไหลตามขณะดูวิดีโอ */
  IM.scrollLocked = false;

  /* ---------- theme (dark/light) ----------
     แพทเทิร์นเดียวกับ motionOK/onMotionPrefChange ข้างบน
     ค่าเริ่มต้นอ่านจาก data-theme ที่ inline script กัน FOUC ใน <head> ตั้งไว้แล้ว
     (ต้องรันก่อน CSS โหลดถึงจะไม่มีพื้นมืดวาบตอนเลือก light ไว้)
     ห้ามให้ core.js เป็นคนตัดสินใจค่าเริ่มต้นเอง — แค่ "อ่าน" สถานะที่ตั้งไว้แล้ว    */

  IM.theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

  var themeListeners = [];
  IM.onThemeChange = function (fn) { themeListeners.push(fn); };

  IM.setTheme = function (next) {
    IM.theme = next;
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');

    // localStorage อาจถูกบล็อก (private mode / เบราว์เซอร์บางตัว) — อย่าให้พังทั้งฟีเจอร์
    try { localStorage.setItem('im-theme', next); } catch (e) {}

    for (var i = 0; i < themeListeners.length; i++) {
      try { themeListeners[i](next); } catch (e) { console.warn('[IM] theme listener', e); }
    }
  };

  /* ---------- โหมดอุปกรณ์ (desktop/mobile) ----------
     แพทเทิร์นเดียวกับธีมข้างบนทุกอย่าง ต่างกันที่ค่าเริ่มต้นเดาจากอุปกรณ์ให้ก่อน
     แล้วผู้ใช้เลือกทับได้ที่หน้ารวมลิงก์ เลือกแล้วจำไว้ใช้ทุกหน้า

     ค่าถูกตั้งโดย inline script ใน <head> ของทุกหน้า ซึ่งต้องรันก่อน CSS โหลด
     ไม่งั้นมือถือจะเห็นเลย์เอาต์คอมวาบขึ้นมาก่อนหนึ่งเฟรม ที่นี่แค่ "อ่าน"
     ค่านั้นเหมือนที่ IM.theme ทำ ห้ามให้ core.js เป็นคนตัดสินใจเอง

     กฎ CSS ของโหมดมือถือทุกข้อ key จาก [data-device="mobile"] ไม่ใช่ @media
     โหมดคอมจึงไม่ match กฎใหม่สักข้อ — ได้หน้าตาเดิมเป๊ะไม่ว่าจอจะแคบแค่ไหน
     และคนที่เปิดบนมือถือแต่เลือก "คอมพิวเตอร์" ก็ได้ของเดิมจริงๆ ไม่ใช่ของครึ่งๆ */

  IM.device = document.documentElement.dataset.device === 'mobile' ? 'mobile' : 'desktop';
  IM.isMobile = IM.device === 'mobile';

  /* เอฟเฟกต์ที่จ่ายค่าทุกเฟรมเพื่อสิ่งที่ต้องมีเมาส์ถึงจะได้กลับมา — การ์ดเอียงตามเคอร์เซอร์,
     เคอร์เซอร์วาดเอง, magnetic, parallax, canvas อนุภาค — ควรทำงานเมื่อ "มีเมาส์จริง
     และผู้ใช้ยังอยู่โหมดคอม" เท่านั้น สองเงื่อนไขนี้ต้องเช็คคู่กันเสมอ ถ้าปล่อยให้แต่ละไฟล์
     เขียนเอง จะมีไฟล์ที่ลืมข้างหนึ่งเสมอ (ก่อนหน้านี้ field/hero/scroll ลืม isCoarse กันหมด) */
  IM.mouseFx = function () { return !IM.isCoarse && IM.device !== 'mobile'; };

  IM.setDevice = function (next) {
    if (next !== 'mobile' && next !== 'desktop') return;
    try { localStorage.setItem('im-device', next); } catch (e) {}
    if (next === IM.device) return;
    /* โหลดใหม่แทนการสลับสด: โมดูลตัดสินใจว่าจะ subscribe ticker ไหมตอนบูตครั้งเดียว
       และ script.js/app.js ผูก listener ตามโหมดไปแล้ว การถอดทุกอย่างกลับกลางคัน
       มีทางพลาดมากกว่าที่ได้ — reload คือทางที่ถูกเสมอ */
    w.location.reload();
  };

})(window);
