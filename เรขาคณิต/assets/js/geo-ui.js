/* ============================================
   geo-ui.js — ส่วนประกอบหน้าจอของเครื่องมือเรขาคณิต

   ทำ 2 อย่างที่ app.js ไม่ควรต้องรู้จัก:
   1. หน้าต่างรวมปุ่มลัด — แอปนี้ซ่อนความสามารถไว้ในคีย์บอร์ดเกือบทั้งหมด
      (Ctrl เปิดแถบเครื่องมือ, Shift ดูค่าที่วัดได้, 1 วางจุด ฯลฯ)
      ถ้าไม่มีที่ให้อ่าน ผู้ใช้ใหม่จะเจอแค่หน้าจอว่างๆ
   2. ข้อความใบ้ตอนเปิดครั้งแรก — ชี้ทางไปยังสองอย่างนั้น แล้วหายไปเมื่อรู้แล้ว

   ตรรกะเปิด/ปิดหน้าต่างยกแบบมาจาก tools.js ทั้งหมด (Escape, คลิกฉากหลัง,
   คืนโฟกัส, กัน bfcache คืนสภาพหน้าต่างที่เปิดค้าง) ตัดเฉพาะส่วนล็อกสกรอลล์
   ที่ไม่มีความหมายกับหน้าที่ overflow:hidden อยู่แล้ว
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('geo', function () {

    var root = document.documentElement;

    /* ============================================
       หน้าต่างปุ่มลัด
       ============================================ */

    var modal    = document.getElementById('geoHelp');
    var opener   = document.getElementById('geoHelpOpen');
    var closeBtn = document.getElementById('geoHelpClose');
    var lastFocus = null;

    function openModal() {
      if (!modal || !modal.hidden) return;
      lastFocus = document.activeElement;
      modal.hidden = false;
      void modal.offsetWidth;               // บังคับ reflow ก่อนใส่คลาส ไม่งั้น transition ไม่ทำงาน
      modal.classList.add('is-open');

      /* ธงบน <html> ให้ app.js หยุดรับคีย์ระหว่างหน้าต่างเปิด
         ไม่งั้นอ่านปุ่มลัดไปกด 1 ตาม จะมีจุดงอกอยู่หลังหน้าต่างโดยไม่รู้ตัว */
      root.classList.add('geo-modal-open');

      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      if (!modal || modal.hidden) return;
      modal.classList.remove('is-open');
      root.classList.remove('geo-modal-open');
      setTimeout(function () { modal.hidden = true; }, 300);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    if (modal && opener) {
      opener.addEventListener('click', openModal);
      if (closeBtn) closeBtn.addEventListener('click', closeModal);

      // คลิกที่ฉากหลังหรือขอบนอกแผงเพื่อปิด (เช็คจาก target ตรงๆ แบบเดียวกับ tools.js)
      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.classList.contains('tm-backdrop')) closeModal();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || modal.hidden) return;
        closeModal();
        /* หยุด event ไว้ที่นี่ — app.js ผูก keydown ไว้ที่ window ซึ่งเป็นปลายทางถัดไป
           ของ bubble ถ้าปล่อยผ่าน Escape ที่ตั้งใจแค่ปิดหน้าต่าง จะไปปิดเครื่องมือ
           ที่เปิดค้างไว้ก่อนหน้าด้วย */
        e.stopPropagation();
      });

      /* กดปุ่มย้อนกลับของเบราว์เซอร์อาจได้หน้าเดิมคืนจาก bfcache พร้อม DOM ทั้งดุ้น
         หน้าต่างที่เปิดค้างไว้จะโผล่มาอีกครั้ง ปิดให้เลย */
      w.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        modal.classList.remove('is-open');
        modal.hidden = true;
        root.classList.remove('geo-modal-open');
      });
    }

    /* ============================================
       ข้อความใบ้ครั้งแรก

       หายเมื่อผู้ใช้กด Ctrl (แปลว่าเจอแถบเครื่องมือแล้ว), เปิดหน้าต่างปุ่มลัด,
       หรือครบเวลา แล้วจำไว้ว่าเคยเห็นแล้วจะได้ไม่ทวงซ้ำทุกครั้งที่เปิดแอป
       ============================================ */

    var hint = document.getElementById('geoHint');
    if (!hint) return;

    var SEEN_KEY = 'geo-hint-seen';

    // เปิดจาก file:// บางเบราว์เซอร์บล็อก localStorage — ห้ามให้ทั้งโมดูลตายเพราะเรื่องนี้
    function seen() {
      try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
    }
    function markSeen() {
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    }

    if (seen()) { hint.hidden = true; return; }

    var timer = setTimeout(dismiss, 11000);

    function dismiss() {
      if (hint.hidden || hint.classList.contains('is-gone')) return;
      clearTimeout(timer);
      hint.classList.add('is-gone');
      setTimeout(function () { hint.hidden = true; }, 600);
      markSeen();
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Control' || e.ctrlKey) dismiss();
    });
    if (opener) opener.addEventListener('click', dismiss);
  });

})(window);
