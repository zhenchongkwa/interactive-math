/* ============================================
   scroll.js — smooth scroll + header state + scrollspy + parallax

   สำคัญ: smooth scroll ตัวนี้ทำผ่าน window.scrollTo()
   ไม่ใช่การ transform wrapper
   เพราะถ้า transform wrapper แล้ว position:sticky ของ header จะพังทันที
   (sticky อ้างอิง scroll container ถ้า wrapper ถูกเลื่อน header จะเลื่อนตาม)

   การใช้ scrollTo ทำให้ scroll position เป็นของจริง
   → sticky ทำงาน, IntersectionObserver ทำงาน, scrollbar จริงยังอยู่
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;
  var doc = document;

  IM.register('scroll', function () {

    var header = doc.getElementById('siteHeader');
    var navLinks = doc.getElementById('navLinks');
    var menuBtn = doc.getElementById('menuBtn');
    var underline = doc.getElementById('navUnderline');
    var links = navLinks ? [].slice.call(navLinks.querySelectorAll('a')) : [];

    /* ---------------------------------------------
       1. SMOOTH SCROLL (Lenis-style, scrollTo based)
       --------------------------------------------- */

    var targetY = w.scrollY;
    var currentY = w.scrollY;
    var maxY = 0;
    var smoothOn = false;

    function measure() {
      maxY = Math.max(0, doc.documentElement.scrollHeight - w.innerHeight);
    }
    measure();
    IM.onResize(measure);

    function tickScroll(dt) {
      if (!smoothOn || IM.scrollLocked) return;

      // lambda 8.5 = นุ่มแต่ยังตามมือ ไม่ล่องลอย
      currentY = IM.damp(currentY, targetY, 8.5, dt);

      // ระยะน้อยกว่า .12px แล้ว snap ทิ้ง ไม่ต้องเรียก scrollTo ทุกเฟรมตลอดกาล
      if (Math.abs(targetY - currentY) < 0.12) currentY = targetY;

      w.scrollTo(0, currentY);
    }

    function onWheel(e) {
      if (!smoothOn) return;
      // มี overlay เปิดอยู่ (เช่น หน้าต่างวิดีโอ) ต้องไม่ลากหน้าหลัง
      if (IM.scrollLocked) return;
      // ปล่อยผ่านถ้ากด ctrl (pinch zoom) หรือกำลัง scroll ในกล่องที่ scroll ได้เอง
      if (e.ctrlKey) return;

      e.preventDefault();

      // deltaMode: 0 = pixel, 1 = line, 2 = page
      var mult = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? w.innerHeight : 1;
      targetY = IM.clamp(targetY + e.deltaY * mult, 0, maxY);
    }

    // ถ้า scroll มาจากทางอื่น (ลาก scrollbar, ปุ่มลูกศร, Page Down, find-in-page)
    // ต้อง resync ไม่งั้น smooth scroll จะดึงกลับไปตำแหน่งเก่า
    function onScroll() {
      if (smoothOn && Math.abs(w.scrollY - currentY) > 3) {
        currentY = targetY = w.scrollY;
      }
      onHeaderScroll();
    }

    function enableSmooth(on) {
      smoothOn = on;
      if (on) {
        currentY = targetY = w.scrollY;
        w.addEventListener('wheel', onWheel, { passive: false });
      } else {
        w.removeEventListener('wheel', onWheel, { passive: false });
      }
    }

    // ปิด smooth scroll บน touch เสมอ — native momentum ให้ผลดีกว่ามาก
    // ปิดเมื่อผู้ใช้ตั้งค่า reduced motion และปิดในโหมดมือถือด้วย (IM.mouseFx ดู core.js)
    //
    // เงื่อนไขตรงนี้ต้องเป็นชุดเดียวกับที่ใช้ตัดสินว่าจะต่อ ticker ไหมท้ายไฟล์ ห้ามแยกจากกัน:
    // smoothOn เปิดแต่ไม่มี ticker มาขยับ currentY = หน้าเลื่อนไม่ได้เลยทั้งหน้า
    enableSmooth(IM.motionOK && IM.mouseFx());
    IM.onMotionPrefChange(function (ok) { enableSmooth(ok && IM.mouseFx()); });

    /* ---------------------------------------------
       2. ANCHOR LINKS
       ต้อง preventDefault แล้ว animate targetY เอง
       ไม่งั้นเบราว์เซอร์จะกระโดดสวน smooth scroll
       --------------------------------------------- */

    function headerH() { return header ? header.offsetHeight : 0; }

    function scrollToEl(el) {
      var y = Math.round(el.getBoundingClientRect().top + w.scrollY - headerH() - 8);
      y = IM.clamp(y, 0, maxY);

      if (smoothOn) {
        targetY = y;
      } else {
        w.scrollTo({ top: y, behavior: IM.motionOK ? 'smooth' : 'auto' });
      }
    }

    /* ---------------------------------------------
       2b. เปิดหน้ามาพร้อม #hash จากอีกหน้าหนึ่ง
       เช่น กด "ห้องทดลองคณิต" จาก topics.html → index.html#lab

       เบราว์เซอร์จะเลื่อนไปที่ element ตรงๆ โดยไม่รู้ว่ามี header ลอยทับอยู่
       หัวข้อจึงโดนแถบเมนูบัง ต้องหักความสูง header ออกเอง
       และ #home จะได้ y ติดลบแล้วถูก clamp เป็น 0 = บนสุดพอดี
       --------------------------------------------- */

    var userMoved = false;
    ['wheel', 'touchstart', 'keydown'].forEach(function (evt) {
      w.addEventListener(evt, function () { userMoved = true; }, { passive: true, once: true });
    });

    function applyHashOnLoad() {
      if (userMoved) return;                 // ผู้ใช้เลื่อนเองแล้ว อย่าไปกระชากกลับ
      var id = (w.location.hash || '').replace('#', '');
      if (!id) return;
      var el = doc.getElementById(id);
      if (!el) return;

      measure();
      var y = IM.clamp(
        Math.round(el.getBoundingClientRect().top + w.scrollY - headerH() - 8),
        0, maxY
      );
      w.scrollTo(0, y);
      currentY = targetY = y;
    }

    applyHashOnLoad();
    // ตำแหน่งขยับได้อีกหลังรูป/ฟอนต์โหลดเสร็จ จึงจัดซ้ำอีกรอบ
    w.addEventListener('load', applyHashOnLoad);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(applyHashOnLoad);

    doc.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;

      var id = a.getAttribute('href').slice(1);
      if (!id) return;

      var el = doc.getElementById(id);
      if (!el) return;

      e.preventDefault();
      measure();
      scrollToEl(el);

      // ปิดเมนูมือถือหลังเลือก
      if (navLinks && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
      }
    });

    /* ---------------------------------------------
       3. HEADER STATE
       --------------------------------------------- */

    function onHeaderScroll() {
      if (header) header.classList.toggle('scrolled', w.scrollY > 10);
    }
    w.addEventListener('scroll', onScroll, { passive: true });
    onHeaderScroll();

    /* ---------------------------------------------
       3b. LIQUID GLASS — แสง specular ที่ไหลบนแถบเมนู

       CSS ทำวัสดุแก้ว (blur/saturate/ขอบไล่เฉด) ไว้แล้ว
       ส่วนนี้ทำให้ "ไหล" คือ
       - ตำแหน่งแสงวิ่งตามเมาส์
       - เลื่อนหน้าเร็วเท่าไหร่ แสงยิ่งสว่างและแผ่กว้างขึ้น
       เขียนแค่ CSS custom property ไม่แตะ style อื่น
       --------------------------------------------- */

    var navEl = header ? header.querySelector('nav') : null;
    var navBox = { left: 0, width: 1 };

    function measureNav() {
      if (!navEl) return;
      var r = navEl.getBoundingClientRect();
      navBox.left = r.left;
      navBox.width = r.width || 1;
    }
    measureNav();
    IM.onLayout(measureNav);

    var sheenX = 50;
    var sheenBoost = 0;
    var lastGlassY = w.scrollY;

    function tickGlass(dt) {
      if (!navEl || !IM.motionOK) return;

      // ไม่ใช่โหมดแก้ว ก็ไม่ต้องคำนวณอะไรเลย
      if (!header.classList.contains('scrolled')) {
        lastGlassY = w.scrollY;
        return;
      }

      // ตำแหน่งแสงตามเมาส์ คิดเป็น % ของความกว้างแถบ
      var wantX = IM.pointer.active
        ? IM.clamp((IM.pointer.x - navBox.left) / navBox.width * 100, -8, 108)
        : 50;
      sheenX = IM.damp(sheenX, wantX, 5, dt);

      // ความเร็วสกรอลล์ → ความสว่าง/ความกว้างของแสง
      var vel = Math.abs(w.scrollY - lastGlassY) / Math.max(dt, 0.0001);
      lastGlassY = w.scrollY;
      sheenBoost = IM.damp(sheenBoost, IM.clamp(vel / 2600, 0, 1), 4.5, dt);

      navEl.style.setProperty('--sheen-x', sheenX.toFixed(1) + '%');
      navEl.style.setProperty('--sheen-boost', sheenBoost.toFixed(3));
      navEl.style.setProperty('--sheen-w', (180 + sheenBoost * 230).toFixed(0) + 'px');
    }

    /* ---------------------------------------------
       4. MOBILE MENU
       --------------------------------------------- */

    if (menuBtn && navLinks) {
      menuBtn.addEventListener('click', function () {
        var open = navLinks.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    /* ---------------------------------------------
       5. NAV UNDERLINE + SCROLLSPY
       ยกมาจากของเดิม ทำงานได้ปกติเพราะ scroll position เป็นของจริง
       --------------------------------------------- */

    function moveUnderline(link) {
      if (!underline || !link || w.innerWidth <= 920) return;
      underline.style.left = link.offsetLeft + 'px';
      underline.style.width = link.offsetWidth + 'px';
    }

    function syncUnderline() {
      moveUnderline(navLinks ? navLinks.querySelector('a.active') : null);
    }

    w.addEventListener('load', function () {
      measure();
      moveUnderline(navLinks ? (navLinks.querySelector('a.active') || links[0]) : null);
    });
    IM.onResize(function () { measure(); syncUnderline(); });

    var sections = links
      .map(function (l) { return doc.getElementById(l.dataset.target); })
      .filter(Boolean);

    if (sections.length && 'IntersectionObserver' in w) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.id;
          links.forEach(function (l) { l.classList.toggle('active', l.dataset.target === id); });
          syncUnderline();
        });
      }, { rootMargin: '-40% 0px -50% 0px' });
      sections.forEach(function (s) { spy.observe(s); });
    }

    // ตั้งตำแหน่งเริ่มต้นหลัง font โหลดเสร็จ (ความกว้างลิงก์เปลี่ยนตามฟอนต์)
    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () { syncUnderline(); measure(); });
    }
    // ต้องเคารพลิงก์ที่ถูกทำเครื่องหมาย active ไว้ใน HTML
    // ไม่งั้นหน้าที่ไม่ใช่หน้าแรก แคปซูลจะไปเกาะเมนูตัวแรกผิดตัว
    moveUnderline((navLinks && navLinks.querySelector('a.active')) || links[0]);

    /* ---------------------------------------------
       6. SCROLL-LINKED PARALLAX
       ขับจาก ticker กลาง ใช้แต่ translate3d
       [data-parallax="0.18"] — บวก = เลื่อนช้ากว่าหน้า
       --------------------------------------------- */

    var pxEls = [].slice.call(doc.querySelectorAll('[data-parallax]')).map(function (el) {
      return {
        el: el,
        rate: parseFloat(el.dataset.parallax) || 0,
        offset: 0,
        current: 0
      };
    });

    function measureParallax() {
      for (var i = 0; i < pxEls.length; i++) {
        var p = pxEls[i];
        // IM.docPos ไม่สนใจ transform จึงไม่ต้องล้าง transform ของตัวเองก่อนวัด
        var d = IM.docPos(p.el);
        p.center = d.y + d.h / 2;
      }
    }
    measureParallax();
    IM.onLayout(function () { measure(); measureParallax(); });

    function tickParallax(dt) {
      if (!pxEls.length || !IM.motionOK) return;

      var vh = w.innerHeight;
      var sy = w.scrollY;

      for (var i = 0; i < pxEls.length; i++) {
        var p = pxEls[i];
        // ระยะจากกึ่งกลางจอ (-1 .. 1 โดยประมาณ)
        var rel = (p.center - sy - vh / 2) / vh;
        var want = rel * p.rate * 100;

        p.current = IM.damp(p.current, want, 6, dt);
        if (Math.abs(p.current - want) < 0.02) p.current = want;

        p.el.style.transform = 'translate3d(0,' + p.current.toFixed(2) + 'px,0)';
      }
    }

    /* ---------------------------------------------
       7. subscribe เข้า ticker กลางตัวเดียว
       --------------------------------------------- */

    /* โหมดมือถือไม่ต่อเลย ทั้งสามตัวไม่มีอะไรให้ทำ: tickScroll ถูกปิดไปพร้อม smooth scroll
       ข้างบนแล้ว ส่วน parallax กับแสงที่ไล่ไปตามแถบนำทางเป็นของที่ต้องมีเมาส์ถึงจะเห็น
       ต่อไว้ก็ได้แค่ rAF ที่วนเปล่าทุกเฟรม

       header .scrolled มาจาก scroll listener จริง และ scrollspy ใช้ IntersectionObserver
       ทั้งคู่ไม่ได้พึ่ง ticker จึงยังทำงานครบในโหมดมือถือ */
    if (IM.mouseFx()) {
      IM.ticker.add(function (dt) {
        tickScroll(dt);
        tickParallax(dt);
        tickGlass(dt);
      });
    }

    // เผื่อรูปหรือฟอนต์โหลดเสร็จทีหลังแล้วความสูงหน้าเปลี่ยน
    w.addEventListener('load', function () { measure(); measureParallax(); });
  });

})(window);
