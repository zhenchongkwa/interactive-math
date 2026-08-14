/* ============================================
   device.js — ปุ่มสลับโหมดคอมพิวเตอร์ / มือถือ

   คู่แฝดของ theme.js ทุกอย่าง: ไอคอนจอ/มือถือสลับกันด้วย CSS ล้วน
   (key จาก [data-device] บน <html> ซึ่ง inline script ใน <head> ตั้งไว้ก่อนแล้ว)
   ไฟล์นี้จึงทำแค่ผูกคลิก → IM.setDevice(...) และอัปเดต aria ให้ตรงสถานะ

   ที่เลือกจริงอยู่หน้ารวมลิงก์ ปุ่มนี้เป็นทางออกเผื่อการเดาอัตโนมัติผิด —
   เช่นแท็บเล็ตที่รายงานตัวเป็น pointer ละเอียด หรือคนที่อยากดูของอีกโหมด
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('device', function () {

    var btn = document.getElementById('deviceToggle');
    if (!btn) return;

    var mobile = IM.device === 'mobile';
    btn.setAttribute('aria-pressed', mobile ? 'true' : 'false');
    btn.setAttribute('aria-label', mobile ? 'สลับเป็นโหมดคอมพิวเตอร์' : 'สลับเป็นโหมดมือถือ');
    btn.setAttribute('title', mobile ? 'ตอนนี้: โหมดมือถือ' : 'ตอนนี้: โหมดคอมพิวเตอร์');

    // setDevice โหลดหน้าใหม่ให้เอง จึงไม่ต้อง sync อะไรหลังคลิก
    btn.addEventListener('click', function () {
      IM.setDevice(IM.device === 'mobile' ? 'desktop' : 'mobile');
    });
  });

})(window);
