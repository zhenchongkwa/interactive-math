/* ============================================
   main.js — จุดบูตเดียวของทั้งเว็บ

   ไฟล์อื่นแค่ลงทะเบียนตัวเองไว้ที่ IM.register(...)
   ไฟล์นี้เป็นตัวเรียกจริงตัวเดียว จึงคุมลำดับได้ชัดเจน
   และถ้าโมดูลไหนพัง โมดูลที่เหลือยังทำงานต่อได้
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  /* ลำดับสำคัญ: scroll ต้องมาก่อนเพราะโมดูลอื่นวัดตำแหน่งจากหน้าที่ layout นิ่งแล้ว
     และ lessons ต้องมาก่อน tilt/cursor เพราะมันสร้างการ์ดขึ้นมาใหม่
     ทั้งสองตัวนั้นถึงจะวัดตำแหน่งการ์ดได้ครบ

     แต่ละหน้าโหลดสคริปต์ไม่เท่ากัน (hero/lab มีแค่หน้าแรก, lessons มีแค่หน้าคลังบทเรียน)
     จึงข้ามตัวที่ไม่ได้ลงทะเบียนไว้เงียบๆ ไม่ใช่ข้อผิดพลาด */
  var ORDER = ['scroll', 'theme', 'geo', 'hero', 'lab', 'lessons', 'tools', 'reveal', 'field', 'tilt', 'cursor'];

  function boot() {
    for (var i = 0; i < ORDER.length; i++) {
      var name = ORDER[i];
      var fn = IM.modules[name];
      if (typeof fn !== 'function') continue;
      try {
        fn();
      } catch (e) {
        // โมดูลเดียวพังต้องไม่ทำให้ทั้งหน้าตาย
        console.error('[IM] โมดูล "' + name + '" เกิดข้อผิดพลาด:', e);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);
