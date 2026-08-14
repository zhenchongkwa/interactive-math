/* ============================================
   theme.js — ปุ่มสลับ dark mode / light mode

   ไอคอน sun/moon สลับกันแสดงด้วย CSS ล้วน (key จาก [data-theme] บน <html>)
   จึงไม่มี flash ตอนโหลดหน้า เพราะ attribute ถูกตั้งไว้แล้วโดย inline script
   กัน FOUC ใน <head> ก่อนที่ไฟล์นี้จะรันด้วยซ้ำ

   ไฟล์นี้ทำแค่ 2 อย่าง: ผูกปุ่มคลิก → IM.setTheme(...)
   และอัปเดต aria-label/aria-pressed ให้ตรงสถานะ (สิ่งเดียวที่ CSS ทำเองไม่ได้)
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('theme', function () {

    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    function sync(theme) {
      var isLight = theme === 'light';
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      btn.setAttribute('aria-label', isLight ? 'สลับเป็นธีมมืด' : 'สลับเป็นธีมสว่าง');
    }

    sync(IM.theme);
    IM.onThemeChange(sync);

    btn.addEventListener('click', function () {
      IM.setTheme(IM.theme === 'light' ? 'dark' : 'light');
    });
  });

})(window);
