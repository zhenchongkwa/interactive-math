(function () {
  'use strict';

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var toolbar = document.getElementById('toolbar');
  var noticeEl = document.getElementById('notice');

  // ---------- ข้อมูล ----------
  var points = [];          // { id, x, y }
  var edges  = [];          // { id, a, b }   a,b = point id
  var faces  = [];          // [ [pid, pid, ...], ... ]  รูปปิด คำนวณใหม่ทุกครั้งที่กราฟเปลี่ยน
  var circles = [];         // { id, cx, cy, rx, ry }  เส้นโค้งจริง ไม่มีจุดมุมสักจุด (rx≠ry = วงรี)
  var nextPointId = 1, nextEdgeId = 1, nextCircleId = 1;

  var selection = [];                         // เลือกพร้อมกันได้หลายตัว: [{ type, id }]
  var hover     = { type: null, id: null };
  var drag      = null;                       // { ids: [pid...], lastX, lastY }
  var mouse     = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var shiftHeld = false;
  var ctrlHeld  = false;
  var labels    = [];                         // ป้ายตัวเลขที่วาดอยู่ในเฟรมล่าสุด ใช้ให้คลิกโดนได้
  var editor    = null;                       // { input, lab } ตอนกำลังกรอกค่า
  var activeTool  = null;                     // เครื่องมือที่เปิดอยู่บนแถบ
  var overToolbar = false;                    // เมาส์อยู่บนแถบไหม (กันแถบหายกลางคันตอนจะกด)
  var marquee     = null;                     // { x0, y0, x1, y1 } กรอบลากเลือก
  var shapeKind   = null;                     // 'rect' | 'tri' | 'circle'
  var creating    = null;                     // { kind, x0, y0, x1, y1 } กำลังลากสร้างรูป
  var gridX       = false;                    // ตารางเส้นนอน (ขนานแกน x) — ปุ่ม x
  var gridY       = false;                    // ตารางเส้นตั้ง (ขนานแกน y) — ปุ่ม y
  var rotating    = null;                     // { cx, cy, r, prevA, total, orig, origC }
  // มุมมอง (pan) — ทุกจุด/เส้น/รูปเก็บพิกัด "โลก" เหมือนเดิมทุกที่ camera ถูกลบออกจาก
  // localPos() ตอนอ่านเมาส์ (โลก = จอ - camera) แล้วบวกกลับครั้งเดียวตอนวาดผ่าน ctx.translate
  // ในนี้ที่เดียว — ฟังก์ชันอื่นทั้งไฟล์จึงไม่ต้องรู้จักกล้องเลย
  var camera      = { x: 0, y: 0 };
  var panning     = null;                     // { lastClientX, lastClientY } กำลังลากพื้นที่ว่าง
  var undoStack   = [];                       // สถานะก่อนหน้าแต่ละครั้งที่แก้รูป
  var clipboard   = null;                     // { points, edges, circles }
  var UNDO_MAX    = 100;

  var HIT_POINT = 10, HIT_EDGE = 6, POINT_R = 4, SELECT_R = 8;
  var MERGE_DIST = POINT_R * 2;               // ใกล้กว่านี้ถือว่าจุดทับกัน ให้ยุบเป็นจุดเดียว
  var MARQUEE_MIN  = 3;                       // ลากสั้นกว่านี้ถือว่าแค่คลิก

  /* ---------- โหมดมือถือ ----------
     ทุกอย่างในแอปนี้เดิมผูกกับคีย์บอร์ด: Ctrl เลือก/เชื่อม, Shift ดูค่าที่วัดได้,
     1 วางจุด, Delete ลบ นิ้วไม่มีปุ่มพวกนั้นสักปุ่ม จึงมีแถบปุ่มบนจอมาตั้งธงพวกนี้แทน
     (โครงสร้างอยู่ใน index.html สไตล์อยู่ใน geo.css การผูกอยู่ท้ายไฟล์นี้)

     ธงถูก "หรือ" เข้ากับปุ่มจริงเสมอ ไม่ได้แทนที่ ทั้งสองทางจึงใช้ร่วมกันได้
     และโค้ดเดิมทุกบรรทัดที่อ่าน ctrlOn/shiftOn ไม่ต้องรู้ว่ามาจากทางไหน */
  var touchMods = { ctrl: false, shift: false };
  var placeMode = false;                      // แตะกระดาษเพื่อวางจุด — แทนปุ่ม 1
  var onPhone   = !!(window.IM && window.IM.isMobile);

  /* ปลดโหมดที่ค้างอยู่บนแถบปุ่มมือถือ ตัวจริงถูกใส่ให้ตอนผูกแถบท้ายไฟล์ (ซึ่งเป็นที่เดียว
     ที่รู้จัก wearMode) ค่าเริ่มต้นเป็นฟังก์ชันเปล่า เพราะโหมดคอมไม่มีแถบนั้นให้ปลด
     setTool ต้องเรียกตัวนี้: โหมด "วางจุด" ถูกเช็คก่อนสาขาของเครื่องมือใน pointerdown
     ถ้าไม่ปลด เลือกเครื่องมือแบ่งด้านแล้วแตะเส้นจะได้จุดใหม่แทนการแบ่ง */
  var clearTouchMode = function () {};

  function ctrlOn(e)  { return e.ctrlKey  || touchMods.ctrl; }
  function shiftOn(e) { return e.shiftKey || touchMods.shift; }

  /* นิ้วบังพื้นที่ราว 44px และเล็งหยาบกว่าเมาส์มาก ระยะที่ถือว่า "จับโดน" จึงต้องกว้างขึ้น
     ขยายเฉพาะระยะจับ ไม่แตะ POINT_R ซึ่งเป็นขนาดที่วาดจริง จุดจึงยังหน้าตาเดิมเป๊ะ
     และ MERGE_DIST ที่คิดจาก POINT_R ก็ไม่ขยับตาม — ไม่งั้นจุดคนละจุดจะยุบรวมกันเอง */
  if (onPhone) { HIT_POINT = 20; HIT_EDGE = 13; }

  /* ---------- จานสี ----------
     ทุกสีที่วาดลง canvas มาจาก CSS custom property ใน assets/css/geo.css ที่เดียว
     สีของรูปกับสีของแถบเครื่องมือรอบข้างจึงสลับธีมไปพร้อมกันเสมอ
     ห้าม hardcode สีเพิ่มในไฟล์นี้ — ให้เพิ่ม token ใน geo.css แล้วมาอ่านตรงนี้แทน

     ค่าที่ตั้งไว้ข้างล่างคือชุดสว่างเดิม ใช้เป็น fallback เผื่อเปิดไฟล์นี้โดยไม่มี geo.css
     (เช่นเอา app.js ไปใช้เดี่ยวๆ) แอปจะได้ยังวาดออกมาอ่านได้ ไม่ใช่จอดำล้วน */
  var P = {
    paper:'#ffffff', paperHi:'#ffffff', paperLo:'#eef2f6',
    gridMinor:'rgba(19,26,36,.055)', gridMajor:'rgba(19,26,36,.13)',
    stroke:'#000000', faceHover:'#f0f0f0',
    accent:'#1a73e8',
    accentFill:'rgba(26,115,232,.16)',
    marqueeFill:'rgba(26,115,232,.12)',
    guide:'rgba(20,26,34,.3)',
    labelBg:'rgba(255,255,255,.9)', labelLine:'rgba(19,26,36,.16)',
    labelFont:'12px system-ui, sans-serif'
  };

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    // token ที่หายไปให้คงค่าเดิมไว้ ดีกว่าได้ค่าว่างแล้ว canvas เงียบไม่วาดอะไรเลย
    function v(name, cur) { return cs.getPropertyValue(name).trim() || cur; }

    P.paper       = v('--paper',        P.paper);
    P.paperHi     = v('--paper-hi',     P.paperHi);
    P.paperLo     = v('--paper-lo',     P.paperLo);
    P.gridMinor   = v('--grid-minor',   P.gridMinor);
    P.gridMajor   = v('--grid-major',   P.gridMajor);
    P.stroke      = v('--stroke',       P.stroke);
    P.faceHover   = v('--face-hover',   P.faceHover);
    P.accent      = v('--accent-draw',  P.accent);
    P.accentFill  = v('--accent-fill',  P.accentFill);
    P.marqueeFill = v('--marquee-fill', P.marqueeFill);
    P.guide       = v('--guide',        P.guide);
    P.labelBg     = v('--label-bg',     P.labelBg);
    P.labelLine   = v('--label-line',   P.labelLine);
    P.labelFont   = v('--label-font',   P.labelFont);

    paperGrad = null;                         // กระดาษเปลี่ยนสี ต้องผสมไล่เฉดใหม่
  }

  /* ไล่เฉดทแยงของกระดาษ สร้างครั้งเดียวแล้วเก็บไว้ ไม่ใช่ทุกเฟรม
     (draw() ถูกเรียกทุก rAF การผสม gradient ใหม่ 60 ครั้ง/วินาทีเปลืองเปล่าๆ) */
  var paperGrad = null;

  function makePaperGrad() {
    var g = ctx.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
    g.addColorStop(0, P.paperHi);
    g.addColorStop(0.5, P.paper);
    g.addColorStop(1, P.paperLo);
    paperGrad = g;
  }

  // ---------- เพดานจำนวนจุด ----------
  var POINT_WARN = 50, POINT_MAX = 100;
  var warnedMany = false, noticeTimer = null;

  // แถบข้อความ ข้อความซ้ำแค่ตั้งเวลาใหม่ ไม่ซ้อนกัน
  function notify(msg) {
    if (!noticeEl) return;
    noticeEl.textContent = msg;
    noticeEl.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { noticeEl.classList.remove('show'); }, 3000);
  }

  function notifyFull() {
    notify('สร้างจุดไม่ได้แล้ว (เกิน ' + POINT_MAX + ' จุด) โปรดลบจุดเพื่อทำต่อ');
  }

  // เช็คก่อนเริ่มงานที่ต้องสร้างหลายจุด จะได้ไม่ได้รูปครึ่ง ๆ กลาง ๆ
  function canAddPoints(n) {
    if (points.length + n <= POINT_MAX) return true;
    notifyFull();
    return false;
  }

  // ---------- หน่วยวัด: 10 พิกเซล = 1 ซม ----------
  var PX_PER_CM = 10;
  function toCm(px)    { return px / PX_PER_CM; }
  function toPx(cm)    { return cm * PX_PER_CM; }
  function toCm2(px2)  { return px2 / (PX_PER_CM * PX_PER_CM); }
  function toPx2(cm2)  { return cm2 * PX_PER_CM * PX_PER_CM; }
  function numLen(px)  { return toCm(px).toFixed(1); }
  function numArea(a)  { return toCm2(a).toFixed(1); }
  function fmtLen(px)  { return numLen(px) + ' ซม'; }
  function fmtArea(a)  { return numArea(a) + ' ตร.ซม'; }

  // ---------- ตัวช่วย ----------
  function pt(id) {
    for (var i = 0; i < points.length; i++) if (points[i].id === id) return points[i];
    return null;
  }

  function circleById(id) {
    for (var i = 0; i < circles.length; i++) if (circles[i].id === id) return circles[i];
    return null;
  }

  // แปลงพิกัดเข้าไปอยู่ในระบบของวงรี (หมุนกลับตามมุมเอียงของวง)
  function ellipseLocal(cr, x, y) {
    var dx = x - cr.cx, dy = y - cr.cy, r = cr.rot || 0;
    var c = Math.cos(-r), s = Math.sin(-r);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  // ค่าฟังก์ชันวงรี: 1 = อยู่บนเส้นพอดี, <1 = ข้างใน, >1 = ข้างนอก
  function ellipseK(cr, x, y) {
    if (cr.rx <= 0 || cr.ry <= 0) return Infinity;
    var L = ellipseLocal(cr, x, y);
    return Math.hypot(L.x / cr.rx, L.y / cr.ry);
  }

  // ครึ่งความกว้าง/สูงของกรอบสี่เหลี่ยมที่ครอบวงรีเอียง
  function ellipseHalf(cr) {
    var r = cr.rot || 0, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    return { x: Math.hypot(cr.rx * c, cr.ry * s), y: Math.hypot(cr.rx * s, cr.ry * c) };
  }

  // ---------- จุดที่เกาะอยู่บนเส้นรอบวง ----------
  // จุดที่เกิดจากเส้นตัดวงจะถูกผูกกับวงไว้ด้วยมุม t เพื่อให้ขยับตามวงและเลื่อนไปตามเส้นรอบวงได้
  function bindToCircle(p, cr) {
    if (!p || !cr || cr.rx <= 0 || cr.ry <= 0) return;
    var L = ellipseLocal(cr, p.x, p.y);        // ต้องคิดในระบบของวง ไม่งั้นวงที่เอียงจะได้มุมผิด
    p.on = { c: cr.id, t: Math.atan2(L.y / cr.ry, L.x / cr.rx) };
  }

  // ทิศแทนเจนต์ของวงรีที่มุม t (ทิศไปทาง t เพิ่ม)
  function ellipseTangent(cr, t) {
    var r = cr.rot || 0, c = Math.cos(r), s = Math.sin(r);
    var dx = -cr.rx * Math.sin(t), dy = cr.ry * Math.cos(t);
    var x = dx * c - dy * s, y = dx * s + dy * c;
    var L = Math.hypot(x, y);
    return L < 1e-9 ? { x: 1, y: 0 } : { x: x / L, y: y / L };
  }

  function placeOnCircle(p) {                   // วางจุดกลับลงบนเส้นรอบวงตามมุมที่เก็บไว้
    var cr = p.on && circleById(p.on.c);
    if (!cr) { delete p.on; return false; }
    var r = cr.rot || 0, c = Math.cos(r), s = Math.sin(r);
    var lx = cr.rx * Math.cos(p.on.t), ly = cr.ry * Math.sin(p.on.t);
    p.x = cr.cx + lx * c - ly * s;
    p.y = cr.cy + lx * s + ly * c;
    p.on.tan = ellipseTangent(cr, p.on.t);      // ยังเป็นวงรีอยู่ แทนเจนต์อัปเดตตามวงได้
    return true;
  }

  function projectOnCircle(p) {                 // ลากไปไหนก็ดึงกลับมาเกาะเส้นรอบวง
    var cr = p.on && circleById(p.on.c);
    if (!cr || cr.rx <= 0 || cr.ry <= 0) { delete p.on; return; }
    if (isSpline(cr)) return;                   // โหมดเส้นโค้ง: ลากอิสระ เส้นจะดัดตามจุด
    var L = ellipseLocal(cr, p.x, p.y);
    p.on.t = Math.atan2(L.y / cr.ry, L.x / cr.rx);
    placeOnCircle(p);
  }

  function syncCirclePoints() {
    for (var i = 0; i < points.length; i++) {
      if (points[i].on && !isSpline(circleById(points[i].on.c))) placeOnCircle(points[i]);
    }
  }

  // ---------- วงที่ถูกดัดด้วยจุด ----------
  // จุดที่เกาะวง เรียงตามมุม t (t ใช้เป็นลำดับรอบวง แม้จุดจะถูกลากออกนอกวงรีแล้วก็ตาม)
  function circlePts(cr) {
    var out = [], i;
    if (!cr) return out;
    for (i = 0; i < points.length; i++) {
      if (points[i].on && points[i].on.c === cr.id) out.push(points[i]);
    }
    out.sort(function (a, b) { return a.on.t - b.on.t; });
    return out;
  }

  // ตั้งแต่ 3 จุดขึ้นไปถือว่าเลิกเป็นวงรี กลายเป็นเส้นโค้งที่ลากจุดดัดได้
  function isSpline(cr) { return !!cr && circlePts(cr).length >= 3; }

  function hasGap(cr, pid) {
    return !!(cr.gaps && cr.gaps.indexOf(pid) !== -1);
  }

  // ช่วงโค้งนี้ยังมีอยู่จริงไหม (ใช้ตรวจรายการที่เลือกหลังรูปเปลี่ยน)
  function arcExists(arcId) {
    var parts = String(arcId).split(':');
    var cr = circleById(parseInt(parts[0], 10)), pid = parseInt(parts[1], 10);
    if (!cr || hasGap(cr, pid)) return false;
    var P = circlePts(cr);
    if (P.length < 3) return false;
    for (var i = 0; i < P.length; i++) if (P[i].id === pid) return true;
    return false;
  }

  function unitDir(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    return L < 1e-9 ? { x: 0, y: 0 } : { x: dx / L, y: dy / L };
  }

  // ทิศแทนเจนต์ที่ตรึงไว้กับตัวจุด — สำคัญมาก: ถ้าคำนวณสด ๆ จากจุดข้างเคียง
  // การลากจุดหนึ่งจะไปเปลี่ยนแทนเจนต์ของเพื่อนบ้าน ทำให้ช่วงโค้งที่ไม่ได้แตะด้วยเปลี่ยนรูปตามไป 4 ช่วง
  // พอตรึงไว้ การลากจุดจะกระทบแค่ 2 ช่วงที่จุดนั้นเป็นปลายเท่านั้น
  function ptTangent(P, i) {
    var p = P[i];
    if (p.on && p.on.tan) return p.on.tan;
    var n = P.length;
    return unitDir(P[(i - 1 + n) % n], P[(i + 1) % n]);   // ของเก่าที่ยังไม่มีค่าเก็บไว้
  }

  // ช่วงโค้งจาก P[i] ไป P[i+1] เป็นเบซิเยร์ ความยาวแขนคุมด้วยคอร์ด × 0.39
  // ค่านี้ทำให้จุด 4 จุดรอบวงกลมได้เส้นโค้งทับวงกลมเดิมเกือบพอดี (สูตร Catmull-Rom /6 จะบุ๋มเข้าไปราว 12%)
  function spanCurve(P, i) {
    var n = P.length;
    var p1 = P[i], p2 = P[(i + 1) % n];
    var k = 0.39 * Math.hypot(p2.x - p1.x, p2.y - p1.y);
    var t1 = ptTangent(P, i), t2 = ptTangent(P, (i + 1) % n);
    return {
      p1: p1, p2: p2,
      c1: { x: p1.x + t1.x * k, y: p1.y + t1.y * k },
      c2: { x: p2.x - t2.x * k, y: p2.y - t2.y * k }
    };
  }

  function bezierAt(s, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * s.p1.x + b * s.c1.x + c * s.c2.x + d * s.p2.x,
             y: a * s.p1.y + b * s.c1.y + c * s.c2.y + d * s.p2.y };
  }

  // แตกช่วงโค้งเป็นเส้นตรงสั้น ๆ ไว้ใช้จับคลิก/วัดความยาว/หาพื้นที่
  function spanSamples(P, i, n) {
    var s = spanCurve(P, i), out = [], k;
    n = n || 16;
    for (k = 0; k <= n; k++) out.push(bezierAt(s, k / n));
    return out;
  }

  // เส้นรอบรูปที่แตกเป็นจุดแล้ว ใช้ทดสอบว่าเมาส์อยู่ข้างในไหม (คืน null ถ้าเส้นขาด)
  function splineOutline(cr) {
    var P = circlePts(cr), out = [], i, k;
    if (P.length < 3) return null;
    for (i = 0; i < P.length; i++) {
      if (hasGap(cr, P[i].id)) return null;
      var sm = spanSamples(P, i, 12);
      for (k = 0; k < sm.length - 1; k++) out.push(sm[k]);
    }
    return out;
  }

  // ความยาวเส้นรอบ (เฉพาะช่วงที่ยังไม่ถูกลบ) และพื้นที่ (ปิดครบวงเท่านั้นถึงจะมีความหมาย)
  function splineMetrics(cr) {
    var P = circlePts(cr), i, k, len = 0, closed = true, outline = [];
    for (i = 0; i < P.length; i++) {
      var gap = hasGap(cr, P[i].id);
      var pts = spanSamples(P, i, 16);
      if (gap) { closed = false; } else {
        for (k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k-1].x, pts[k].y - pts[k-1].y);
      }
      for (k = 0; k < pts.length - 1; k++) outline.push(pts[k]);
    }
    return { len: len, closed: closed, area: closed ? Math.abs(signedArea(outline)) : 0 };
  }

  // ระยะจากจุดถึงเส้นรอบวงรี วัดตามแนวรัศมีที่ลากจากศูนย์กลางผ่านจุดนั้น
  function ellipseEdgeDist(cr, x, y) {
    var k = ellipseK(cr, x, y);
    if (!isFinite(k)) return Infinity;
    var d = Math.hypot(x - cr.cx, y - cr.cy);
    if (k === 0) return Math.min(cr.rx, cr.ry);
    return Math.abs(d - d / k);
  }

  function edgeById(id) {
    for (var i = 0; i < edges.length; i++) if (edges[i].id === id) return edges[i];
    return null;
  }

  // ---------- รายการที่ถูกเลือก ----------
  function selIndex(type, id) {
    for (var i = 0; i < selection.length; i++) {
      if (selection[i].type === type && selection[i].id === id) return i;
    }
    return -1;
  }

  function selHas(type, id) { return selIndex(type, id) !== -1; }

  function selAdd(type, id) {                 // ดันไปท้ายสุดเสมอ ท้ายสุด = ตัวที่เลือกล่าสุด
    var i = selIndex(type, id);
    if (i !== -1) selection.splice(i, 1);
    selection.push({ type: type, id: id });
  }

  function selRemove(type, id) {
    var i = selIndex(type, id);
    if (i !== -1) selection.splice(i, 1);
  }

  function selLast() { return selection.length ? selection[selection.length - 1] : null; }

  // เลือกทุกอย่างที่อยู่ใน "กรอบ" ทั้งตัว (ด้านต้องอยู่ในกรอบทั้งสองปลาย รูปต้องอยู่ครบทุกมุม)
  function selectInRect(r) {
    var x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1);
    var y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1);
    function inside(p) { return !!p && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; }
    var i, j;

    for (i = 0; i < points.length; i++) {
      if (inside(points[i])) selAdd('point', points[i].id);
    }
    for (i = 0; i < edges.length; i++) {
      if (inside(pt(edges[i].a)) && inside(pt(edges[i].b))) selAdd('edge', edges[i].id);
    }
    for (i = 0; i < faces.length; i++) {
      var all = true;
      for (j = 0; j < faces[i].length; j++) {
        if (!inside(pt(faces[i][j]))) { all = false; break; }
      }
      if (all) selAdd('face', faceKey(faces[i]));
    }
    for (i = 0; i < circles.length; i++) {              // วงต้องอยู่ในกรอบทั้งวง
      var cr = circles[i], h = ellipseHalf(cr);
      if (cr.cx - h.x >= x0 && cr.cx + h.x <= x1 &&
          cr.cy - h.y >= y0 && cr.cy + h.y <= y1) selAdd('circle', cr.id);
    }
  }

  function edgeBetween(a, b) {
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e;
    }
    return null;
  }

  // รหัสประจำรูปร่าง: ใช้เซ็ตของจุด เพื่อให้คงเดิมแม้ faces ถูกสร้างใหม่ทุกเฟรม
  function faceKey(f) {
    return f.slice().sort(function (a, b) { return a - b; }).join(',');
  }

  function faceByKey(k) {
    for (var i = 0; i < faces.length; i++) if (faceKey(faces[i]) === k) return faces[i];
    return null;
  }

  function signedArea(poly) {
    var s = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    }
    return s / 2;
  }

  function distToSeg(x, y, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  }

  function pointInPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // ---------- หัวใจ: หารูปปิดจากกราฟ (planar face traversal) ----------
  // เดินตาม half-edge: จาก u->v ตัวถัดไปคือ v->w โดย w คือเพื่อนบ้านของ v ที่อยู่ก่อนหน้า u
  // ในลำดับเชิงมุม  ผลลัพธ์: รูปปิดภายในมีพื้นที่ (shoelace) เป็นบวก ส่วนหน้านอก/กิ่งที่ไม่ปิดเป็นลบ
  function rebuildFaces() {
    faces = [];
    if (edges.length === 0) return;

    var P = Object.create(null), adj = Object.create(null), i, j;
    for (i = 0; i < points.length; i++) { P[points[i].id] = points[i]; adj[points[i].id] = []; }
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!adj[e.a] || !adj[e.b]) continue;
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    }

    // เรียงเพื่อนบ้านของแต่ละจุดตามมุม
    Object.keys(adj).forEach(function (key) {
      var o = P[key];
      adj[key].sort(function (m, n) {
        var A = P[m], B = P[n];
        return Math.atan2(A.y - o.y, A.x - o.x) - Math.atan2(B.y - o.y, B.x - o.x);
      });
    });

    var visited = Object.create(null);
    var starts = [];
    for (i = 0; i < edges.length; i++) { starts.push([edges[i].a, edges[i].b], [edges[i].b, edges[i].a]); }

    for (i = 0; i < starts.length; i++) {
      if (visited[starts[i][0] + '>' + starts[i][1]]) continue;

      var cycle = [], cu = starts[i][0], cv = starts[i][1], guard = 0;
      while (true) {
        var k = cu + '>' + cv;
        if (visited[k]) break;
        visited[k] = true;
        cycle.push(cu);
        var nb = adj[cv];
        var idx = nb.indexOf(cu);
        var w = nb[(idx - 1 + nb.length) % nb.length];
        cu = cv; cv = w;
        if (++guard > 20000) break;
      }

      if (cycle.length >= 3) {
        var poly = [];
        for (j = 0; j < cycle.length; j++) poly.push(P[cycle[j]]);
        if (signedArea(poly) > 0.5) faces.push(cycle);   // เก็บเฉพาะรูปปิดจริง
      }
    }
  }

  function connect(a, b) {
    if (a === b) return null;
    if (edgeBetween(a, b)) return null;                    // กันด้านซ้ำ
    var e = { id: nextEdgeId++, a: a, b: b };
    edges.push(e);
    return e;
  }

  function addEdge(a, b) {
    connect(a, b);
    settle();
  }

  // เรียกหลังทุกการเปลี่ยนแปลงรูปทรง: รวมจุดที่ทับกัน -> หาจุดตัด -> หารูปปิด -> ตรวจว่าสิ่งที่เลือกยังอยู่
  function settle() {
    syncCirclePoints();     // จุดที่เกาะวงต้องอยู่บนเส้นรอบวงเสมอ
    mergeOverlapping();
    splitIntersections();
    mergeOverlapping();     // จุดตัดที่งอกมาชิดจุดเดิมก็ยุบรวมด้วย
    syncCirclePoints();
    rebuildFaces();
    for (var i = selection.length - 1; i >= 0; i--) {          // ตัวที่หายไปแล้วก็เอาออกจากรายการเลือก
      var s = selection[i], ok;
      if (s.type === 'point')       ok = !!pt(s.id);
      else if (s.type === 'edge')   ok = !!edgeById(s.id);
      else if (s.type === 'circle') ok = !!circleById(s.id);
      else if (s.type === 'arc')    ok = arcExists(s.id);
      else                          ok = !!faceByKey(s.id);
      if (!ok) selection.splice(i, 1);
    }
    if (points.length <= POINT_WARN) warnedMany = false;   // ลบจนน้อยลงแล้ว ให้เตือนใหม่ได้อีกรอบ
  }

  // ---------- รวมจุดที่ทับกัน ----------
  // ย้ายด้านทุกเส้นของ dropId ไปห้อยกับ keepId แล้วทิ้ง dropId
  function absorbPoint(keepId, dropId) {
    var i, j;
    for (i = edges.length - 1; i >= 0; i--) {
      var e = edges[i];
      if (e.a === dropId) e.a = keepId;
      if (e.b === dropId) e.b = keepId;
      if (e.a === e.b) edges.splice(i, 1);                 // ด้านที่กลายเป็นวนหาตัวเอง
    }
    for (i = edges.length - 1; i >= 0; i--) {              // ด้านซ้ำที่เกิดจากการรวม
      for (j = 0; j < i; j++) {
        if ((edges[i].a === edges[j].a && edges[i].b === edges[j].b) ||
            (edges[i].a === edges[j].b && edges[i].b === edges[j].a)) { edges.splice(i, 1); break; }
      }
    }
    var keep = pt(keepId);
    for (i = points.length - 1; i >= 0; i--) {
      if (points[i].id === dropId) {
        if (keep && !keep.on && points[i].on) keep.on = points[i].on;   // สืบทอดการเกาะวง
        points.splice(i, 1);
      }
    }
    for (i = selection.length - 1; i >= 0; i--) {
      if (selection[i].type === 'point' && selection[i].id === dropId) {
        if (selHas('point', keepId)) selection.splice(i, 1);   // ซ้ำกับที่เลือกอยู่แล้ว
        else selection[i].id = keepId;
      }
    }
    if (drag) {
      for (i = 0; i < drag.ids.length; i++) if (drag.ids[i] === dropId) drag.ids[i] = keepId;
    }
  }

  function mergeOverlapping() {
    var guard = 0;
    while (guard++ < 500) {
      var keepId = null, dropId = null;
      for (var i = 0; i < points.length && dropId === null; i++) {
        for (var j = i + 1; j < points.length; j++) {
          if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) <= MERGE_DIST) {
            keepId = points[i].id;      // จุดที่เกิดก่อนอยู่ต่อ อีกจุดยุบเข้ามา
            dropId = points[j].id;
            break;
          }
        }
      }
      if (dropId === null) return;
      absorbPoint(keepId, dropId);
    }
  }

  // ---------- ลบ ----------
  function removeEdge(e) {
    var i = edges.indexOf(e);
    if (i !== -1) edges.splice(i, 1);
  }

  function removePoint(id) {
    for (var i = edges.length - 1; i >= 0; i--) {
      if (edges[i].a === id || edges[i].b === id) edges.splice(i, 1);   // ด้านที่ต่อกับจุดนี้หายตาม
    }
    for (var j = points.length - 1; j >= 0; j--) {
      if (points[j].id === id) points.splice(j, 1);
    }
  }

  function degree(id) {
    var n = 0;
    for (var i = 0; i < edges.length; i++) if (edges[i].a === id || edges[i].b === id) n++;
    return n;
  }

  function deleteTarget(target) {
    if (!target || !target.type) return false;
    var i;
    if (target.type === 'point') {
      removePoint(target.id);
    } else if (target.type === 'edge') {
      var e = edgeById(target.id);
      if (!e) return false;
      removeEdge(e);
    } else if (target.type === 'face') {
      var f = faceByKey(target.id);
      if (!f) return false;
      for (i = 0; i < f.length; i++) {
        var fe = edgeBetween(f[i], f[(i + 1) % f.length]);
        if (fe) removeEdge(fe);
      }
      for (i = 0; i < f.length; i++) {                  // เก็บกวาดจุดที่ไม่เหลือด้านแล้ว
        if (degree(f[i]) === 0) removePoint(f[i]);
      }
    } else if (target.type === 'circle') {
      var idx = -1;
      for (i = 0; i < circles.length; i++) if (circles[i].id === target.id) { idx = i; break; }
      if (idx === -1) return false;
      circles.splice(idx, 1);
    } else if (target.type === 'arc') {          // ลบเฉพาะช่วงโค้ง เหลือจุดกับช่วงอื่นไว้
      var parts = String(target.id).split(':');
      var acr = circleById(parseInt(parts[0], 10));
      var apid = parseInt(parts[1], 10);
      if (!acr) return false;
      if (!acr.gaps) acr.gaps = [];
      if (acr.gaps.indexOf(apid) === -1) acr.gaps.push(apid);
    } else {
      return false;
    }
    return true;
  }

  // ---------- จุดตัดของเส้น ----------
  // คืนจุดตัดเฉพาะตอนที่ตัดกันจริงกลางเส้น ถ้าแค่ปลายชนกันถือว่าไม่ตัด
  function segIntersect(p1, p2, p3, p4) {
    if (!p1 || !p2 || !p3 || !p4) return null;
    var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
    var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
    var den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return null;              // ขนานกันหรือทับกันสนิท
    var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
    var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
    if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
    var X = { x: p1.x + t * d1x, y: p1.y + t * d1y };
    var ends = [p1, p2, p3, p4];
    for (var i = 0; i < 4; i++) {
      if (Math.hypot(ends[i].x - X.x, ends[i].y - X.y) < 1) return null;   // ชิดปลายเกินไป = แค่แตะ
    }
    return X;
  }

  function splitAt(e1, e2, X) {
    var P = null;
    for (var i = 0; i < points.length; i++) {            // มีจุดตรงนั้นอยู่แล้วก็ใช้จุดเดิม
      if (Math.hypot(points[i].x - X.x, points[i].y - X.y) < 1) { P = points[i]; break; }
    }
    if (!P) { var id = addPoint(X.x, X.y); if (id === null) return false; P = pt(id); }

    var a1 = e1.a, b1 = e1.b, a2 = e2.a, b2 = e2.b;
    removeEdge(e1); removeEdge(e2);
    connect(a1, P.id); connect(P.id, b1);
    connect(a2, P.id); connect(P.id, b2);
    return true;
  }

  // จุดที่เส้นตรงพาดผ่านเส้นรอบวง — ย่อพิกัดด้วย rx,ry ให้วงรีกลายเป็นวงกลมหนึ่งหน่วยก่อน
  // แล้วแก้สมการกำลังสอง ค่า t ที่ได้ใช้กับเส้นเดิมได้เลยเพราะการย่อเป็นการแปลงเชิงเส้น
  // รับเฉพาะที่ตัดกลางเส้นจริง ๆ กติกาเดียวกับ segIntersect คือปลายชนไม่นับ
  function circleSegIntersections(cr, p1, p2) {
    if (!p1 || !p2 || cr.rx <= 0 || cr.ry <= 0) return [];
    var L1 = ellipseLocal(cr, p1.x, p1.y), L2 = ellipseLocal(cr, p2.x, p2.y);
    var dx = (L2.x - L1.x) / cr.rx, dy = (L2.y - L1.y) / cr.ry;
    var fx = L1.x / cr.rx, fy = L1.y / cr.ry;
    var a = dx * dx + dy * dy;
    if (a < 1e-12) return [];
    var b = 2 * (fx * dx + fy * dy);
    var c = fx * fx + fy * fy - 1;
    var disc = b * b - 4 * a * c;
    if (disc <= 0) return [];                            // ไม่ตัด หรือแค่สัมผัส (รากซ้ำ)
    var sq = Math.sqrt(disc), out = [];
    var ox = p2.x - p1.x, oy = p2.y - p1.y;                 // ทิศจริง (ยังไม่ถูกย่อ)
    [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].forEach(function (t) {
      if (t <= 0 || t >= 1) return;
      var X = { x: p1.x + t * ox, y: p1.y + t * oy };
      if (Math.hypot(X.x - p1.x, X.y - p1.y) < 1) return;   // ชิดปลายเกินไป
      if (Math.hypot(X.x - p2.x, X.y - p2.y) < 1) return;
      out.push(X);
    });
    return out;
  }

  // หั่นด้านหนึ่งเส้นที่จุด X (ใช้จุดเดิมถ้ามีอยู่ตรงนั้นแล้ว)
  function splitEdgeAt(e, X) {
    var P = null;
    for (var i = 0; i < points.length; i++) {
      if (Math.hypot(points[i].x - X.x, points[i].y - X.y) < 1) { P = points[i]; break; }
    }
    if (!P) { var id = addPoint(X.x, X.y); if (id === null) return null; P = pt(id); }
    var a = e.a, b = e.b;
    removeEdge(e);
    connect(a, P.id);
    connect(P.id, b);
    return P;
  }

  function splitIntersections() {
    var guard = 0, i, j;
    while (guard++ < 500) {
      var hitPair = null;
      for (i = 0; i < edges.length && !hitPair; i++) {
        for (j = i + 1; j < edges.length; j++) {
          var e1 = edges[i], e2 = edges[j];
          if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue;  // มีจุดร่วมกันอยู่แล้ว
          var X = segIntersect(pt(e1.a), pt(e1.b), pt(e2.a), pt(e2.b));
          if (X) { hitPair = { e1: e1, e2: e2, X: X }; break; }
        }
      }
      // ถ้าหั่นไม่ได้เพราะจุดเต็ม (addPoint เตือนให้แล้ว) ให้ออกจากลูปทันที
      // ไม่ปล่อยให้วนหาคู่เดิมซ้ำจนครบ 500 รอบทุกครั้งที่ settle
      if (hitPair) {
        if (!splitAt(hitPair.e1, hitPair.e2, hitPair.X)) return;
        continue;
      }

      var hitCircle = null;                              // หมดคู่เส้นแล้วค่อยหาเส้นพาดวงกลม
      for (i = 0; i < edges.length && !hitCircle; i++) {
        for (j = 0; j < circles.length; j++) {
          if (isSpline(circles[j])) continue;   // วงที่ถูกดัดแล้ว สมการวงรีใช้ไม่ได้
          var xs = circleSegIntersections(circles[j], pt(edges[i].a), pt(edges[i].b));
          if (xs.length) { hitCircle = { e: edges[i], X: xs[0], cr: circles[j] }; break; }
        }
      }
      if (!hitCircle) return;
      var cutP = splitEdgeAt(hitCircle.e, hitCircle.X);
      if (!cutP) return;
      bindToCircle(cutP, hitCircle.cr);
    }
  }

  // ---------- หาว่าเมาส์ชี้อะไรอยู่: จุด -> ด้าน -> พื้นที่ในรูป ----------
  function hitTest(x, y) {
    var i;
    for (i = points.length - 1; i >= 0; i--) {
      if (Math.hypot(x - points[i].x, y - points[i].y) <= HIT_POINT) {
        return { type: 'point', id: points[i].id };
      }
    }
    for (i = edges.length - 1; i >= 0; i--) {
      var a = pt(edges[i].a), b = pt(edges[i].b);
      if (!a || !b) continue;
      if (distToSeg(x, y, a.x, a.y, b.x, b.y) <= HIT_EDGE) {
        return { type: 'edge', id: edges[i].id };
      }
    }
    for (i = circles.length - 1; i >= 0; i--) {          // เส้นรอบวง
      var cc = circles[i], CP = circlePts(cc);
      if (CP.length >= 3) {                              // โหมดเส้นโค้ง: จับทีละช่วง
        for (var q = 0; q < CP.length; q++) {
          if (hasGap(cc, CP[q].id)) continue;
          var sm = spanSamples(CP, q, 16);
          for (var k = 0; k < sm.length - 1; k++) {
            if (distToSeg(x, y, sm[k].x, sm[k].y, sm[k+1].x, sm[k+1].y) <= HIT_EDGE) {
              return { type: 'arc', id: cc.id + ':' + CP[q].id };
            }
          }
        }
      } else if (ellipseEdgeDist(cc, x, y) <= HIT_EDGE) {
        return { type: 'circle', id: cc.id };
      }
    }
    var best = null, bestArea = Infinity;
    for (i = 0; i < faces.length; i++) {
      var poly = faces[i].map(pt);
      if (poly.indexOf(null) !== -1) continue;
      if (pointInPoly(x, y, poly)) {
        var ar = Math.abs(signedArea(poly));
        if (ar < bestArea) { bestArea = ar; best = faceKey(faces[i]); }   // รูปเล็กสุดที่ครอบอยู่
      }
    }
    if (best) return { type: 'face', id: best };

    for (i = circles.length - 1; i >= 0; i--) {          // พื้นที่ในวง (ท้ายสุด รูปที่อยู่ในวงยังเลือกได้)
      var ci = circles[i];
      if (circlePts(ci).length >= 3) {
        var poly = splineOutline(ci);                    // ข้างในเส้นโค้ง = ทั้งวง
        if (poly && pointInPoly(x, y, poly)) return { type: 'circle', id: ci.id };
      } else if (ellipseK(ci, x, y) <= 1) {
        return { type: 'circle', id: ci.id };
      }
    }
    return { type: null, id: null };
  }

  // ---------- มุมที่จุดหนึ่ง ----------
  // คืนค่ามุมภายในของทุกรูปร่างที่จุดนั้นเป็นสมาชิก
  function anglesAt(pid) {
    var v = pt(pid), out = [], i, j;
    if (!v) return out;

    for (i = 0; i < faces.length; i++) {
      var f = faces[i];
      var at = f.indexOf(pid);
      if (at === -1) continue;
      var prev = pt(f[(at - 1 + f.length) % f.length]);
      var next = pt(f[(at + 1) % f.length]);
      if (!prev || !next) continue;
      var ang = angleBetween(prev, v, next);
      if (ang === null) continue;
      // รูปปิดถูกจัดทิศให้พื้นที่เป็นบวกเสมอ -> cross ติดลบแปลว่ามุมกลับ (> 180°)
      var cross = (v.x - prev.x) * (next.y - v.y) - (v.y - prev.y) * (next.x - v.x);
      if (cross < 0) ang = 2 * Math.PI - ang;
      out.push({ prev: prev, next: next, ang: ang });
    }

    if (out.length === 0) {
      // ไม่อยู่ในรูปปิดใดเลย แต่ถ้ามีด้านพอดี 2 ด้าน ก็แสดงมุมระหว่างสองด้านนั้น
      var nb = [];
      for (j = 0; j < edges.length; j++) {
        if (edges[j].a === pid) nb.push(pt(edges[j].b));
        else if (edges[j].b === pid) nb.push(pt(edges[j].a));
      }
      if (nb.length === 2 && nb[0] && nb[1]) {
        var a2 = angleBetween(nb[0], v, nb[1]);
        if (a2 !== null) out.push({ prev: nb[0], next: nb[1], ang: a2 });
      }
    }
    return out;
  }

  function angleBetween(prev, v, next) {
    var u1x = prev.x - v.x, u1y = prev.y - v.y;
    var u2x = next.x - v.x, u2y = next.y - v.y;
    var l1 = Math.hypot(u1x, u1y), l2 = Math.hypot(u2x, u2y);
    if (l1 === 0 || l2 === 0) return null;
    var c = (u1x * u2x + u1y * u2y) / (l1 * l2);
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  // ---------- วาด ----------
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paperGrad = null;                         // ไล่เฉดกินเต็มจอ จอเปลี่ยนขนาดก็ต้องผสมใหม่
  }

  // รวบรวมว่าจุด/ด้านไหนต้องเป็นสีฟ้า ตามสิ่งที่ถูกเลือกอยู่
  function selectedParts() {
    var v = Object.create(null), e = Object.create(null), i, j;
    for (j = 0; j < selection.length; j++) {
      var s = selection[j];
      if (s.type === 'point') {
        v[s.id] = true;
      } else if (s.type === 'edge') {
        var se = edgeById(s.id);
        if (se) { e[se.id] = true; v[se.a] = true; v[se.b] = true; }
      } else if (s.type === 'face') {
        var f = faceByKey(s.id);
        if (f) for (i = 0; i < f.length; i++) {
          v[f[i]] = true;
          var fe = edgeBetween(f[i], f[(i + 1) % f.length]);
          if (fe) e[fe.id] = true;
        }
      }
    }
    return { verts: v, edges: e };
  }

  function draw() {
    if (!drag && !panning) {
      var h = hitTest(mouse.x, mouse.y);
      // ป้ายตัวเลขวางห่างจากตัวมันเอง (ป้ายมุมห่างถึง 36px) กว่าเมาส์จะเดินไปถึง
      // ก็หลุด hover แล้วป้ายหายก่อนคลิกโดน จึงต้องล็อกเป้าหมายไว้ระหว่างเดินไปหาป้าย
      var keep = shiftHeld && labels.length &&
                 (hitLabel(mouse.x, mouse.y) ||
                  (nearLabel(mouse.x, mouse.y, 46) && (!h.type || h.type === 'face')));
      if (!keep) hover = h;
    }

    if (!paperGrad) makePaperGrad();
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);   // กระดาษอยู่พิกัดจอ ไม่เลื่อนตาม pan

    // ตั้งแต่นี่ถึง restore() ทุกอย่างวาดในพิกัดโลกเดียวกับที่ hitTest/จุด/เส้นใช้อยู่แล้ว —
    // ปรับที่เดียวตรงนี้แทนการแปลงพิกัดทุกจุดที่วาด (คู่กับ localPos() ที่แปลงขาเข้า)
    ctx.save();
    ctx.translate(camera.x, camera.y);

    var sel = selectedParts();
    var i, j;

    // รูปร่าง: ฟ้าอ่อนตอนถูกเลือก / เทาอ่อนตอนชี้เฉย ๆ
    for (i = 0; i < faces.length; i++) {
      var k = faceKey(faces[i]);
      var isSel = selHas('face', k);
      var isHov = (hover.type === 'face' && hover.id === k);
      if (!isSel && !isHov) continue;
      var poly = faces[i].map(pt);
      if (poly.indexOf(null) !== -1) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (j = 1; j < poly.length; j++) ctx.lineTo(poly[j].x, poly[j].y);
      ctx.closePath();
      ctx.fillStyle = isSel ? P.accentFill : P.faceHover;
      ctx.fill();
    }

    // วงกลม/วงรี (เส้นโค้งจริง ไม่มีมุม) หรือเส้นโค้งที่ถูกดัดด้วยจุด
    for (i = 0; i < circles.length; i++) {
      var cr = circles[i];
      var cOn = selHas('circle', cr.id);
      var CP = circlePts(cr);

      if (CP.length >= 3) {                     // โหมดเส้นโค้งผ่านจุด วาดทีละช่วง ข้ามช่วงที่ถูกลบ
        for (j = 0; j < CP.length; j++) {
          if (hasGap(cr, CP[j].id)) continue;
          var aOn = cOn || selHas('arc', cr.id + ':' + CP[j].id);
          var sc = spanCurve(CP, j);
          ctx.beginPath();
          ctx.moveTo(sc.p1.x, sc.p1.y);
          ctx.bezierCurveTo(sc.c1.x, sc.c1.y, sc.c2.x, sc.c2.y, sc.p2.x, sc.p2.y);
          ctx.strokeStyle = aOn ? P.accent : P.stroke;
          ctx.lineWidth = aOn ? 2.5 : 1;
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.ellipse(cr.cx, cr.cy, cr.rx, cr.ry, cr.rot || 0, 0, Math.PI * 2);
        ctx.strokeStyle = cOn ? P.accent : P.stroke;
        ctx.lineWidth = cOn ? 2.5 : 1;
        ctx.stroke();
      }
    }

    // ด้าน
    for (i = 0; i < edges.length; i++) {
      var a = pt(edges[i].a), b = pt(edges[i].b);
      if (!a || !b) continue;
      var eOn = !!sel.edges[edges[i].id];
      ctx.strokeStyle = eOn ? P.accent : P.stroke;
      ctx.lineWidth = eOn ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // จุด
    for (i = 0; i < points.length; i++) {
      var p = points[i];
      var pOn = !!sel.verts[p.id];
      ctx.beginPath();
      ctx.arc(p.x, p.y, POINT_R, 0, Math.PI * 2);
      ctx.fillStyle = pOn ? P.accent : P.stroke;
      ctx.fill();
      if (selHas('point', p.id)) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, SELECT_R, 0, Math.PI * 2);
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (gridX || gridY) drawGuides();

    labels = [];                    // ป้ายเก่าหมดอายุทุกเฟรม จะได้ไม่คลิกโดนของที่ไม่ได้แสดงแล้ว
    if (shiftHeld) drawMeasure();

    if (marquee) {                  // กรอบลากเลือก วาดทับบนสุด
      var mx = Math.min(marquee.x0, marquee.x1), my = Math.min(marquee.y0, marquee.y1);
      var mw = Math.abs(marquee.x1 - marquee.x0), mh = Math.abs(marquee.y1 - marquee.y0);
      ctx.fillStyle = P.marqueeFill;
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(mx + 0.5, my + 0.5, mw, mh);
    }

    if (creating) drawShapePreview(creating);   // พรีวิวรูปที่กำลังลากสร้าง

    // ที่จับหมุน โผล่เมื่อมีของถูกเลือกและไม่ได้กำลังลากอย่างอื่นอยู่
    if (selection.length && !drag && !creating && !marquee && !toolUsesCanvas()) drawRotUI();

    ctx.restore();
    refreshExamples();
    drawRaf = requestAnimationFrame(draw);
  }

  /* ลูปข้างบนวนตลอดเวลาโดยไม่สนว่ามีอะไรเปลี่ยนไหม ซึ่งเป็นเจตนา — กระดานนี้มีทั้ง hover,
     เส้นนำ, ที่จับหมุน และค่าที่วัดได้ ที่ต้องอัปเดตตามเมาส์ตลอด การไล่ตั้งธง dirty ให้ครบ
     ทุกจุดที่เปลี่ยนสถานะมีทางพลาดมากกว่าที่ได้

     แต่ตอนแท็บถูกซ่อนไม่มีใครดูอยู่ วาดต่อคือเผา CPU กับแบตทิ้งเปล่าๆ core.js หยุด ticker
     ของตัวเองตอน visibilitychange อยู่แล้ว แต่ลูปนี้เป็น rAF ของ app.js เอง จึงไม่ได้ถูกหยุด
     ไปด้วย ต้องหยุดเองตรงนี้

     เบราว์เซอร์ throttle rAF ในแท็บที่ซ่อนอยู่แล้ว แต่ throttle ไม่ใช่หยุด และบางเบราว์เซอร์
     ยังปล่อยให้เดินต่อเมื่อหน้าต่างแค่ถูกบัง ไม่ได้ย่อ — หยุดเองชัวร์กว่า */
  var drawRaf = 0;

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(drawRaf);
      drawRaf = 0;
    } else if (!drawRaf) {
      drawRaf = requestAnimationFrame(draw);
    }
  });

  // ตารางเส้น + จุดพรีวิวว่ากด 1 แล้วจุดจะไปลงตรงไหน
  // เรียกจากใน draw() ขณะที่ ctx ยัง translate(camera.x, camera.y) ค้างอยู่ พิกัดในนี้จึง
  // เป็นพิกัดโลกเหมือนที่อื่นทั้งไฟล์ — ไม่ใช่ตัวเลขที่ต้องแปลงเอง
  function drawGuides() {
    var W = window.innerWidth, H = window.innerHeight, v, step, n, path;
    ctx.lineWidth = 1;

    /* ทุกเส้นที่ 5 เข้มกว่าเพื่อน จะได้กวาดตานับช่องเป็นสิบๆ ได้โดยไม่ต้องไล่ทีละเส้น
       ต้องแยกเป็นสอง path เพราะ strokeStyle เปลี่ยนกลาง path เดียวไม่ได้ */
    var minor = new Path2D(), major = new Path2D();

    /* มุมมองที่เห็นอยู่ตอนนี้ แปลงจากขอบจอ [0,W]x[0,H] เป็นพิกัดโลก — pan ไปทางไหน
       ขอบเขตที่ต้องมีเส้นตารางก็ขยับตาม ไม่งั้นฝั่งที่ pan เผยออกมาจะว่างไม่มีเส้นเลย */
    var worldLeft = -camera.x, worldRight = W - camera.x;
    var worldTop = -camera.y, worldBottom = H - camera.y;

    if (gridX) {                                // เส้นนอน นับจากขอบบนลงมา ยึดจุดกำเนิดโลก (0,0)
      step = gridStep('x');                     // เสมอ ไม่งั้นเส้นหนาทุก 5 ช่องจะกระตุกเวลาลาก
      n = Math.floor(worldTop / step);
      for (v = n * step; v <= worldBottom; v += step, n++) {
        path = (n % 5 === 0) ? major : minor;
        path.moveTo(worldLeft, v + 0.5); path.lineTo(worldRight, v + 0.5);
      }
    }
    if (gridY) {                                // เส้นตั้ง นับจากขอบซ้ายไปขวา ยึดจุดกำเนิดโลกเช่นกัน
      step = gridStep('y');
      n = Math.floor(worldLeft / step);
      for (v = n * step; v <= worldRight; v += step, n++) {
        path = (n % 5 === 0) ? major : minor;
        path.moveTo(v + 0.5, worldTop); path.lineTo(v + 0.5, worldBottom);
      }
    }
    ctx.strokeStyle = P.gridMinor; ctx.stroke(minor);
    ctx.strokeStyle = P.gridMajor; ctx.stroke(major);

    var g = snapToGuides(mouse.x, mouse.y);     // วงกลวงบอกตำแหน่งที่จุดจะไปลง
    ctx.beginPath();
    ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = P.guide;
    ctx.stroke();
  }

  // กรอบที่ลาก normalize แล้ว — ถ้ามีเส้นนำอยู่ เลื่อนทั้งกรอบให้จุดกึ่งกลางรูปไปนั่งบนเส้น
  // (ทำที่นี่ที่เดียว พรีวิวกับรูปจริงจะได้ตรงกันเสมอ)
  function shapeBox(c) {
    var x0 = Math.min(c.x0, c.x1), x1 = Math.max(c.x0, c.x1);
    var y0 = Math.min(c.y0, c.y1), y1 = Math.max(c.y0, c.y1);
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var g = snapToGuides(cx, cy);
    var dx = g.x - cx, dy = g.y - cy;
    x0 += dx; x1 += dx; y0 += dy; y1 += dy;
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
  }

  function drawShapePreview(c) {
    var b = shapeBox(c);
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (c.kind === 'rect') {
      ctx.rect(b.x0, b.y0, b.w, b.h);
    } else if (c.kind === 'tri') {
      ctx.moveTo((b.x0 + b.x1) / 2, b.y0);
      ctx.lineTo(b.x1, b.y1);
      ctx.lineTo(b.x0, b.y1);
      ctx.closePath();
    } else if (c.kind === 'rtri') {
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.x0, b.y1);
      ctx.lineTo(b.x1, b.y1);
      ctx.closePath();
    } else {
      ctx.ellipse((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  // วาดตัวเลข แล้วจดกล่องของมันไว้ใน labels เพื่อให้ Ctrl+คลิกโดนได้
  // text = ที่แสดง, info.num = ตัวเลขล้วนสำหรับใส่ในกล่องกรอก
  // ctx.roundRect เพิ่งมีใน Safari 16 — มีก็ใช้ ไม่มีก็ต่อมุมเองด้วย arcTo
  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  function putLabel(text, x, y, info) {
    var w = ctx.measureText(text).width + 8;    // เผื่อขอบให้คลิกง่าย
    var h = 18;

    /* กล่องรองหลังตัวเลข — ป้ายวางทับเส้นรูปและเส้นตารางตลอดเวลา ถ้าปล่อยตัวเลขลอย
       บนพื้นเปล่าจะอ่านไม่ออกทันทีที่เปิดตาราง (ธีมมืดยิ่งชัด)
       save/restore เพราะคนเรียกตั้ง fillStyle/strokeStyle ไว้ก่อนแล้วยังใช้ต่อหลังจากนี้ */
    ctx.save();
    roundRectPath(x - w / 2, y - h / 2, w, h, 6);
    ctx.fillStyle = P.labelBg;
    ctx.fill();
    ctx.strokeStyle = P.labelLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.fillText(text, x, y);
    info.text = text;
    if (info.num === undefined) info.num = text;
    info.cx = x;
    info.cy = y;
    info.w = w;
    info.h = h;
    labels.push(info);
  }

  function hitLabel(x, y) {
    for (var i = labels.length - 1; i >= 0; i--) {
      var L = labels[i];
      if (Math.abs(x - L.cx) <= L.w / 2 && Math.abs(y - L.cy) <= L.h / 2) return L;
    }
    return null;
  }

  function nearLabel(x, y, r) {
    for (var i = 0; i < labels.length; i++) {
      if (Math.hypot(x - labels[i].cx, y - labels[i].cy) <= r) return true;
    }
    return false;
  }

  function drawMeasure() {
    ctx.fillStyle = P.stroke;
    ctx.strokeStyle = P.stroke;
    ctx.lineWidth = 1;
    ctx.font = P.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (hover.type === 'edge') {
      var e = edgeById(hover.id);
      if (!e) return;
      var a = pt(e.a), b = pt(e.b);
      if (!a || !b) return;
      var len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) return;
      var nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;   // ตั้งฉากกับด้าน
      putLabel(fmtLen(len),
               (a.x + b.x) / 2 + nx * 12, (a.y + b.y) / 2 + ny * 12,
               { kind: 'length', edgeId: e.id, num: numLen(len) });

    } else if (hover.type === 'point') {
      var v = pt(hover.id);
      if (!v) return;
      var list = anglesAt(hover.id);
      for (var i = 0; i < list.length; i++) drawAngle(v, list[i], 22 + i * 13);

    } else if (hover.type === 'face') {
      var f = faceByKey(hover.id);
      if (!f) return;
      var poly = f.map(pt);
      if (poly.indexOf(null) !== -1) return;
      var c = polyCentroid(poly);
      var ar = Math.abs(signedArea(poly));
      putLabel(fmtArea(ar), c.x, c.y,
               { kind: 'area', faceKey: hover.id, num: numArea(ar) });

    } else if (hover.type === 'circle') {
      var cr = circleById(hover.id);
      if (!cr) return;
      if (isSpline(cr)) { putSplineLabels(cr); return; }   // ถูกดัดแล้ว rx ry หมดความหมาย
      putLabel('rx ' + fmtLen(cr.rx), cr.cx, cr.cy - cr.ry - 12,
               { kind: 'radiusX', circleId: cr.id, num: numLen(cr.rx) });
      putLabel('ry ' + fmtLen(cr.ry), cr.cx, cr.cy + cr.ry + 12,
               { kind: 'radiusY', circleId: cr.id, num: numLen(cr.ry) });
      putLabel(fmtArea(Math.PI * cr.rx * cr.ry), cr.cx, cr.cy,
               { kind: 'circleArea', circleId: cr.id, num: numArea(Math.PI * cr.rx * cr.ry) });

    } else if (hover.type === 'arc') {           // วงที่ถูกดัดแล้ว: พื้นที่ + ความยาวเส้นรอบ
      putSplineLabels(circleById(parseInt(String(hover.id).split(':')[0], 10)));
    }
  }

  function putSplineLabels(cr) {
    if (!cr) return;
    var mt = splineMetrics(cr), P = circlePts(cr), sx = 0, sy = 0, q;
    if (!P.length) return;
    for (q = 0; q < P.length; q++) { sx += P[q].x; sy += P[q].y; }
    sx /= P.length; sy /= P.length;
    putLabel('รอบ ' + fmtLen(mt.len), sx, sy + 14, { kind: 'arcLen' });
    if (mt.closed) putLabel(fmtArea(mt.area), sx, sy - 6, { kind: 'arcArea' });
  }

  // จุดศูนย์ถ่วงของรูปหลายเหลี่ยม ใช้วางป้ายพื้นที่
  function polyCentroid(poly) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
      a += f;
      cx += (poly[j].x + poly[i].x) * f;
      cy += (poly[j].y + poly[i].y) * f;
    }
    if (Math.abs(a) < 1e-9) return poly[0];
    return { x: cx / (3 * a), y: cy / (3 * a) };
  }

  function drawAngle(v, item, r) {
    var a1 = Math.atan2(item.prev.y - v.y, item.prev.x - v.x);
    var a2 = Math.atan2(item.next.y - v.y, item.next.x - v.x);
    var d = a1 - a2;
    while (d < 0) d += 2 * Math.PI;
    while (d >= 2 * Math.PI) d -= 2 * Math.PI;

    // เลือกทิศกวาดที่กว้างเท่ากับมุมที่คำนวณได้ (อีกทิศคือ 360° ลบออก)
    var start, sweep;
    if (Math.abs(d - item.ang) < 1e-6) { start = a2; sweep = d; }
    else { start = a1; sweep = 2 * Math.PI - d; }

    ctx.beginPath();
    ctx.arc(v.x, v.y, r, start, start + sweep, false);
    ctx.stroke();

    var mid = start + sweep / 2;
    putLabel(
      (item.ang * 180 / Math.PI).toFixed(1) + '°',
      v.x + Math.cos(mid) * (r + 14),
      v.y + Math.sin(mid) * (r + 14),
      { kind: 'angle', vId: v.id, prevId: item.prev.id, nextId: item.next.id }
    );
  }

  // ---------- แก้รูปตามค่าที่กรอก ----------
  function rotateAround(p, c, ang) {
    var dx = p.x - c.x, dy = p.y - c.y;
    var s = Math.sin(ang), co = Math.cos(ang);
    p.x = c.x + dx * co - dy * s;
    p.y = c.y + dx * s + dy * co;
  }

  // วัดมุมแบบเดียวกับ anglesAt (รู้จักมุมกลับ >180° จากทิศของรูป) แต่คิดจากสามจุดตรง ๆ
  function measureAngle(v, prev, next) {
    var ang = angleBetween(prev, v, next);
    if (ang === null) return null;
    var cross = (v.x - prev.x) * (next.y - v.y) - (v.y - prev.y) * (next.x - v.x);
    return cross < 0 ? 2 * Math.PI - ang : ang;
  }

  // --- projection: ดันรูปให้เข้าเงื่อนไขหนึ่งข้อแบบสมมาตร ---
  function projectLength(c) {
    var a = pt(c.a), b = pt(c.b);
    if (!a || !b) return;
    var cur = Math.hypot(b.x - a.x, b.y - a.y);
    if (cur < 1e-9) return;
    var ux = (b.x - a.x) / cur, uy = (b.y - a.y) / cur, d = (c.value - cur) / 2;
    a.x -= ux * d; a.y -= uy * d;
    b.x += ux * d; b.y += uy * d;
  }

  function projectAngle(c) {
    var v = pt(c.v), p = pt(c.prev), n = pt(c.next);
    if (!v || !p || !n) return;
    var cur = measureAngle(v, p, n);
    if (cur === null) return;
    var half = (c.value - cur) / 2;
    if (Math.abs(half) < 1e-13) return;
    rotateAround(n, v, half);                  // หมุนแขนละครึ่ง ความยาวแขนคงเดิม
    rotateAround(p, v, -half);
    var after = measureAngle(v, p, n);         // ทิศหมุนมีแค่สองทาง ผิดทางก็กลับไปอีกทาง
    if (after === null || Math.abs(after - c.value) > 1e-9) {
      rotateAround(n, v, -2 * half);
      rotateAround(p, v, 2 * half);
    }
  }

  function projectArea(c) {
    var poly = c.ids.map(pt);
    if (poly.indexOf(null) !== -1) return;
    var cur = Math.abs(signedArea(poly));
    if (cur < 1e-9) return;
    var k = Math.sqrt(c.value / cur), ctr = polyCentroid(poly), done = Object.create(null);
    for (var i = 0; i < c.ids.length; i++) {
      if (done[c.ids[i]]) continue;            // รูปอาจวนผ่านจุดเดิมซ้ำ
      done[c.ids[i]] = true;
      poly[i].x = ctr.x + (poly[i].x - ctr.x) * k;
      poly[i].y = ctr.y + (poly[i].y - ctr.y) * k;
    }
  }

  function project(c) {
    if (c.kind === 'length')     projectLength(c);
    else if (c.kind === 'angle') projectAngle(c);
    else if (c.kind === 'area')  projectArea(c);
  }

  // ---------- ค่าที่ถูกล็อก = ค่าปัจจุบันของสิ่งที่กำลังเลือกอยู่ ----------
  function lockedConstraints() {
    var out = [], i, j;
    for (j = 0; j < selection.length; j++) {   // เลือกไว้กี่ตัวก็ล็อกครบทุกตัว
      var s = selection[j];
      if (s.type === 'edge') {
        var e = edgeById(s.id);
        var a = e && pt(e.a), b = e && pt(e.b);
        if (a && b) out.push({ kind: 'length', a: e.a, b: e.b,
                               value: Math.hypot(b.x - a.x, b.y - a.y) });

      } else if (s.type === 'point') {
        var list = anglesAt(s.id);             // จุดหนึ่งอาจมีหลายมุม ล็อกทุกมุม
        for (i = 0; i < list.length; i++) {
          out.push({ kind: 'angle', v: s.id,
                     prev: list[i].prev.id, next: list[i].next.id, value: list[i].ang });
        }

      } else if (s.type === 'face') {
        var f = faceByKey(s.id);
        var poly = f && f.map(pt);
        if (poly && poly.indexOf(null) === -1) {
          out.push({ kind: 'area', ids: f.slice(), value: Math.abs(signedArea(poly)) });
        }
      }
    }
    return out;
  }

  // ล็อกกับค่าที่กำลังกรอกเป็นตัวเดียวกันไหม ถ้าใช่ให้ค่าที่กรอกชนะ
  function sameTarget(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'length') return (a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a);
    if (a.kind === 'angle')  return a.v === b.v && a.prev === b.prev && a.next === b.next;
    return a.ids.slice().sort().join(',') === b.ids.slice().sort().join(',');
  }

  // วนดันเข้าเงื่อนไขทีละข้อสลับกันไปจนลงตัวทั้งค่าที่กรอกและค่าที่ล็อกไว้
  function solve(edit) {
    var cons = [], locks = lockedConstraints(), i, it;
    if (edit) cons.push(edit);
    for (i = 0; i < locks.length; i++) {
      if (!sameTarget(edit, locks[i])) cons.push(locks[i]);
    }
    if (!cons.length) return;
    for (it = 0; it < 400; it++) {
      for (i = 0; i < cons.length; i++) project(cons[i]);
    }
  }

  // ---------- กล่องกรอกค่า ----------
  // สร้างป้ายจากตัวจุด/ด้าน/รูปโดยตรง เผื่อผู้ใช้ Shift+Ctrl คลิกที่ตัวมันเลยไม่ได้จิ้มที่ตัวเลข
  function labelFor(hit) {
    if (!hit || !hit.type) return null;

    if (hit.type === 'edge') {
      var e = edgeById(hit.id);
      var a = e && pt(e.a), b = e && pt(e.b);
      if (!a || !b) return null;
      var len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) return null;
      var nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      return { kind: 'length', edgeId: e.id, text: fmtLen(len), num: numLen(len),
               cx: (a.x + b.x) / 2 + nx * 12, cy: (a.y + b.y) / 2 + ny * 12 };
    }

    if (hit.type === 'point') {
      var v = pt(hit.id);
      if (!v) return null;
      var list = anglesAt(hit.id);             // มีหลายมุมก็เอามุมแรก อยากเจาะจงให้จิ้มที่ตัวเลข
      if (!list.length) return null;
      return { kind: 'angle', vId: v.id, prevId: list[0].prev.id, nextId: list[0].next.id,
               text: (list[0].ang * 180 / Math.PI).toFixed(1) + '°', cx: v.x, cy: v.y - 30 };
    }

    if (hit.type === 'face') {
      var f = faceByKey(hit.id);
      var poly = f && f.map(pt);
      if (!poly || poly.indexOf(null) !== -1) return null;
      var c = polyCentroid(poly), ar = Math.abs(signedArea(poly));
      return { kind: 'area', faceKey: hit.id,
               text: fmtArea(ar), num: numArea(ar), cx: c.x, cy: c.y };
    }

    if (hit.type === 'circle') {                 // คลิกที่ตัววงเลย = แก้พื้นที่ (อยากแก้รัศมีให้จิ้มที่ rx/ry)
      var cr = circleById(hit.id);
      if (!cr || isSpline(cr)) return null;      // ถูกดัดแล้วไม่มีค่าให้กรอกตรง ๆ
      var ca = Math.PI * cr.rx * cr.ry;
      return { kind: 'circleArea', circleId: cr.id,
               text: fmtArea(ca), num: numArea(ca), cx: cr.cx, cy: cr.cy };
    }
    return null;
  }

  function openEditor(lab) {
    closeEditor();
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'value-input';
    input.value = (lab.num !== undefined ? lab.num : lab.text).replace('°', '');
    // lab.cx/cy คือพิกัดโลก แต่กล่องนี้เป็น position:fixed ต่อ document.body ตรงๆ ไม่ได้อยู่ใต้
    // ctx.translate ของ canvas — ต้องบวก camera กลับเป็นพิกัดจอเองตรงนี้ ไม่งั้นพอ pan ไปแล้ว
    // กล่องจะไปโผล่ผิดตำแหน่ง ไม่ตรงกับตัวเลขที่กดจริง
    input.style.left = (lab.cx + camera.x) + 'px';
    input.style.top = (lab.cy + camera.y) + 'px';

    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();                    // กันปุ่ม 1 / Delete ไปโดนตัวรูป
      if (ev.key === 'Enter') { ev.preventDefault(); commitEditor(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeEditor(); }
    });
    input.addEventListener('blur', function () { closeEditor(); });

    document.body.appendChild(input);
    editor = { input: input, lab: lab };
    input.focus();
    input.select();
  }

  function closeEditor() {
    if (!editor) return;
    var input = editor.input;
    editor = null;                             // เคลียร์ก่อน กัน blur วนเรียกซ้ำ
    if (input.parentNode) input.parentNode.removeChild(input);
    window.focus();
  }

  function commitEditor() {
    if (!editor) return;
    var lab = editor.lab;
    var value = parseFloat(editor.input.value);
    closeEditor();
    if (!isFinite(value)) return;              // กรอกมั่วก็ไม่ต้องแตะรูป
    pushUndo();

    // วงไม่ได้ใช้ตัวแปรร่วมกับจุดใด ๆ เซ็ตค่าตรง ๆ ได้เลย ไม่ต้องผ่าน solver
    if (lab.kind === 'radiusX' || lab.kind === 'radiusY' || lab.kind === 'circleArea') {
      var cr = circleById(lab.circleId);
      if (!cr || !(value > 0)) return;
      if (lab.kind === 'radiusX') cr.rx = toPx(value);
      else if (lab.kind === 'radiusY') cr.ry = toPx(value);
      else {                                     // แก้พื้นที่ = ย่อ/ขยายทั้งวงโดยคงสัดส่วนเดิม
        var cur = Math.PI * cr.rx * cr.ry;
        if (cur <= 0) return;
        var k = Math.sqrt(toPx2(value) / cur);
        cr.rx *= k; cr.ry *= k;
      }
      settle();
      return;
    }

    var edit = null;
    if (lab.kind === 'length' && value > 0) {
      var e = edgeById(lab.edgeId);
      if (e) edit = { kind: 'length', a: e.a, b: e.b, value: toPx(value) };

    } else if (lab.kind === 'angle' && value > 0 && value < 360) {
      edit = { kind: 'angle', v: lab.vId, prev: lab.prevId, next: lab.nextId,
               value: value * Math.PI / 180 };

    } else if (lab.kind === 'area' && value > 0) {
      var f = faceByKey(lab.faceKey);
      if (f) edit = { kind: 'area', ids: f.slice(), value: toPx2(value) };
    }
    if (!edit) return;

    solve(edit);
    settle();
  }

  // ---------- แถบเครื่องมือ ----------
  // เงื่อนไขเดิมทั้งสามข้อไม่มีข้อไหนเป็นจริงได้บนนิ้วเลย: ไม่มี Ctrl ไม่มี hover
  // แถบจึงจมอยู่ที่ opacity .42 ตลอดกาลจนกว่าจะเผลอไปแตะโดน — ในโหมดมือถือให้ค้างไว้เลย
  function updateToolbar() {
    toolbar.classList.toggle('show', onPhone || ctrlHeld || !!activeTool || overToolbar);
  }

  // เครื่องมือที่กินการคลิกบนพื้นที่วาด (resize ใช้แค่ช่องกรอก ไม่กิน)
  function toolUsesCanvas() {
    return activeTool === 'bisect' || activeTool === 'shape';
  }

  /* เครื่องมือกับโหมดบนแถบมือถือกินการแตะบนกระดาษคนละแบบ เปิดพร้อมกันไม่ได้
     เดิมกันไว้ทางเดียว (เลือกโหมดแล้วปิดเครื่องมือ) แต่ขาขากลับไม่มี — เปิดเครื่องมือ
     ทั้งที่โหมด "วางจุด" ยังค้างอยู่ แล้ว placeMode ที่ถูกเช็คก่อนใน pointerdown
     จะกลืนการแตะไปหมด เครื่องมือแบ่งด้านเลยใช้ไม่ได้เลยบนมือถือ ปิดขากลับให้ครบที่นี่ */
  function setTool(name) {
    activeTool = (activeTool === name) ? null : name;   // กดซ้ำที่เดิม = ปิดเครื่องมือ
    if (activeTool !== 'shape') shapeKind = null;
    if (activeTool) clearTouchMode();
    refreshToolButtons();
  }

  function setShapeKind(kind) {
    shapeKind = (shapeKind === kind) ? null : kind;     // กดซ้ำที่เดิม = ปิด
    activeTool = shapeKind ? 'shape' : null;
    if (activeTool) clearTouchMode();
    refreshToolButtons();
  }

  function refreshToolButtons() {
    var btns = toolbar.querySelectorAll('.tool');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.hasAttribute('data-shape')) {
        b.classList.toggle('active', b.getAttribute('data-shape') === shapeKind);
      } else {
        b.classList.toggle('active', b.getAttribute('data-tool') === activeTool);
      }
    }
    toolbar.classList.toggle('shape-open', activeTool === 'shape');
    toolbar.classList.toggle('bisect-open', activeTool === 'bisect');
    toolbar.classList.toggle('resize-open', activeTool === 'resize');
    toolbar.classList.toggle('scale-open', activeTool === 'scale');
    /* ที่นี่ที่เดียวที่รู้ว่ากล่องตัวเลือกกางอยู่ไหม — geo.css ใช้ธงนี้หลบแถบปุ่มโหมด
       ซึ่งกินพื้นที่เดียวกับที่กล่องกางขึ้นไปพอดี (แพทเทิร์นเดียวกับ geo-modal-open) */
    document.documentElement.classList.toggle('geo-tool-open', !!activeTool);
    canvas.style.cursor = toolUsesCanvas() ? 'crosshair' : '';
    updateToolbar();
  }

  function bisectCount() {
    var el = document.getElementById('bisect-count');
    var n = el ? parseInt(el.value, 10) : 1;
    if (!isFinite(n) || n < 1) n = 1;
    return Math.min(n, 50);
  }

  // วางจุดเกาะลงบนเส้นรอบวงตรงที่เมาส์ชี้ (ทั้งโหมดวงรีและโหมดเส้นโค้ง)
  function addPointOnCircle(ht) {
    var cid = (ht.type === 'arc') ? parseInt(String(ht.id).split(':')[0], 10) : ht.id;
    var cr = circleById(cid);
    if (!cr) return null;
    var id, p;

    if (ht.type === 'arc') {                     // โหมดเส้นโค้ง: หาจุดบนช่วงที่ใกล้เมาส์ที่สุด
      var afterId = parseInt(String(ht.id).split(':')[1], 10);
      var P = circlePts(cr), idx = -1, k;
      for (k = 0; k < P.length; k++) if (P[k].id === afterId) { idx = k; break; }
      if (idx === -1) return null;
      var sm = spanSamples(P, idx, 24), best = 0, bestD = Infinity;
      for (k = 0; k < sm.length; k++) {
        var d = Math.hypot(sm[k].x - mouse.x, sm[k].y - mouse.y);
        if (d < bestD) { bestD = d; best = k; }
      }
      id = addPoint(sm[best].x, sm[best].y);
      if (id === null) return null;
      p = pt(id);
      var nx = P[(idx + 1) % P.length];          // แทรกลำดับไว้ระหว่างสองจุดนั้น
      var t0 = P[idx].on.t, t1 = nx.on.t;
      if (t1 <= t0) t1 += Math.PI * 2;
      var lo = Math.max(0, best - 1), hi = Math.min(sm.length - 1, best + 1);
      p.on = { c: cr.id, t: t0 + (t1 - t0) * (best / (sm.length - 1)),
               tan: unitDir(sm[lo], sm[hi]) };   // แทนเจนต์เอาจากทิศของเส้นโค้งตรงนั้น
      return id;
    }

    var L = ellipseLocal(cr, mouse.x, mouse.y);  // โหมดวงรี: ฉายลงเส้นรอบวง
    id = addPoint(mouse.x, mouse.y);
    if (id === null) return null;
    p = pt(id);
    p.on = { c: cr.id, t: Math.atan2(L.y / cr.ry, L.x / cr.rx) };
    placeOnCircle(p);
    return id;
  }

  // แบ่งวง/ช่วงโค้ง ด้วยเครื่องมือแบ่ง
  function bisectCircle(ht, n) {
    var cid = (ht.type === 'arc') ? parseInt(String(ht.id).split(':')[0], 10) : ht.id;
    var cr = circleById(cid);
    if (!cr) return false;
    n = Math.max(1, Math.round(n || 1));
    var i, id, p;

    if (ht.type === 'arc') {                     // แบ่งเฉพาะช่วงนั้นเป็น n+1 ส่วน
      var afterId = parseInt(String(ht.id).split(':')[1], 10);
      var P = circlePts(cr), idx = -1;
      for (i = 0; i < P.length; i++) if (P[i].id === afterId) { idx = i; break; }
      if (idx === -1) return false;
      if (!canAddPoints(n)) return false;
      var sm = spanSamples(P, idx, 60);
      var t0 = P[idx].on.t, t1 = P[(idx + 1) % P.length].on.t;
      if (t1 <= t0) t1 += Math.PI * 2;
      pushUndo();
      for (i = 1; i <= n; i++) {
        var f = i / (n + 1);
        var si = Math.round(f * (sm.length - 1));
        id = addPoint(sm[si].x, sm[si].y);
        if (id === null) break;
        pt(id).on = { c: cr.id, t: t0 + (t1 - t0) * f,
                      tan: unitDir(sm[Math.max(0, si - 1)], sm[Math.min(sm.length - 1, si + 1)]) };
      }
      settle();
      return true;
    }

    if (!canAddPoints(n + 1)) return false;      // วงรีเปล่า: แบ่งรอบวงเป็น n+1 ส่วนเท่า ๆ กัน
    pushUndo();
    for (i = 0; i < n + 1; i++) {
      var t = -Math.PI / 2 + (Math.PI * 2 * i) / (n + 1);
      id = addPoint(cr.cx, cr.cy);
      if (id === null) break;
      p = pt(id);
      p.on = { c: cr.id, t: t };
      placeOnCircle(p);
    }
    settle();
    return true;
  }

  // เครื่องมือ "แบ่งด้าน": วาง n จุดแบ่งด้านออกเป็น n+1 ส่วนเท่า ๆ กัน
  function bisectEdge(edgeId, n) {
    var e = edgeById(edgeId);
    var a = e && pt(e.a), b = e && pt(e.b);
    if (!a || !b) return false;
    n = Math.max(1, Math.round(n || 1));
    if (!canAddPoints(n)) return false;
    pushUndo();

    var ax = a.x, ay = a.y, bx = b.x, by = b.y, aId = a.id, bId = b.id;
    removeEdge(e);
    var prev = aId;
    for (var i = 1; i <= n; i++) {
      var t = i / (n + 1);
      var id = addPoint(ax + (bx - ax) * t, ay + (by - ay) * t);
      connect(prev, id);
      prev = id;
    }
    connect(prev, bId);
    settle();
    return true;
  }

  // เครื่องมือ "ขยาย/ย่อ": คูณขนาดสิ่งที่เลือกด้วย k เท่ากันทั้งสองแกน (ไม่ยืด)
  function applyResize(k) {
    if (!isFinite(k) || k <= 0) { notify('ใส่ตัวคูณที่มากกว่า 0 เช่น 1.5 หรือ 0.5'); return; }
    if (Math.abs(k - 1) < 1e-9) return;
    var b = selectionBounds();
    if (!b) { notify('เลือกสิ่งที่จะขยายก่อน'); return; }

    var t = selectionTargets(), i;
    pushUndo();
    for (i = 0; i < t.ids.length; i++) {
      var p = pt(t.ids[i]);
      if (!p) continue;
      p.x = b.cx + (p.x - b.cx) * k;
      p.y = b.cy + (p.y - b.cy) * k;
    }
    for (i = 0; i < t.circleIds.length; i++) {
      var cr = circleById(t.circleIds[i]);
      if (!cr) continue;
      cr.cx = b.cx + (cr.cx - b.cx) * k;
      cr.cy = b.cy + (cr.cy - b.cy) * k;
      cr.rx *= k; cr.ry *= k;                    // rot ไม่แตะ รูปทรงจึงไม่บิด
    }
    syncCirclePoints();
    settle();
  }

  (function wireToolbar() {
    var btns = toolbar.querySelectorAll('.tool');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          if (btn.hasAttribute('data-shape')) setShapeKind(btn.getAttribute('data-shape'));
          else setTool(btn.getAttribute('data-tool'));
          btn.blur();
          window.focus();
        });
      })(btns[i]);
    }
    var numInput = document.getElementById('bisect-count');
    if (numInput) {
      // กันไม่ให้ปุ่มที่พิมพ์ลงช่องนี้ไปโดนตัวรูป (เลข 1 = สร้างจุด, Delete = ลบ)
      numInput.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); numInput.blur(); window.focus(); }
      });
      numInput.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    }

    // ปุ่มเปิด/ปิดเส้นของแต่ละแกน
    var axisBtns = toolbar.querySelectorAll('.axis-btn');
    for (var a = 0; a < axisBtns.length; a++) {
      (function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          toggleGrid(btn.getAttribute('data-grid'));
          btn.blur();
          window.focus();
        });
      })(axisBtns[a]);
    }

    // ช่องตั้งระยะห่างตาราง — ต้องกันปุ่มไม่ให้ทะลุไปโดนตัวรูป (1 = สร้างจุด, x/y = สลับตาราง)
    ['scale-x', 'scale-y'].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      box.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); box.blur(); window.focus(); }
      });
      box.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    });

    var scaleInput = document.getElementById('resize-scale');
    if (scaleInput) {
      scaleInput.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (ev.key === 'Enter') {                // Enter = สั่งขยาย และคงโฟกัสไว้ กด Enter ซ้ำได้เลย
          ev.preventDefault();
          applyResize(parseFloat(scaleInput.value));
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          scaleInput.blur();
          window.focus();
        }
      });
      scaleInput.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });

      /* ปุ่ม ✓ (โหมดมือถือเท่านั้น — geo.css ซ่อนบนเดสก์ท็อป)
         เรียก applyResize ตัวเดียวกับที่ Enter เรียก ไม่มีตรรกะของตัวเอง
         ไม่ blur ช่องกรอกหลังกด เพื่อให้กดซ้ำขยายต่อเนื่องได้เหมือนกด Enter รัวๆ */
      var applyBtn = document.getElementById('resize-apply');
      if (applyBtn) {
        applyBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          applyResize(parseFloat(scaleInput.value));
        });
        applyBtn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      }
    }

    toolbar.addEventListener('pointerenter', function () { overToolbar = true; updateToolbar(); });
    toolbar.addEventListener('pointerleave', function () { overToolbar = false; updateToolbar(); });
  })();

  // ตำแหน่งที่จุดจะไปลงจริง เมื่อเปิดเส้นนำไว้
  // เปิดเส้นเดียว = เลื่อนได้ตามแนวเส้น / เปิดทั้งสอง = ได้เฉพาะจุดตัด
  // เปิด/ปิดตารางของแกนหนึ่ง — ใช้ร่วมกันทั้งปุ่มบนแถบและปุ่มคีย์บอร์ด
  function setGrid(axis, on) {
    if (axis === 'x') gridX = on; else gridY = on;
    refreshGridButtons();
  }

  function toggleGrid(axis) {
    setGrid(axis, axis === 'x' ? !gridX : !gridY);
  }

  function refreshGridButtons() {
    var btns = toolbar.querySelectorAll('.axis-btn');
    for (var i = 0; i < btns.length; i++) {
      var ax = btns[i].getAttribute('data-grid');
      btns[i].classList.toggle('on', ax === 'x' ? gridX : gridY);
    }
  }

  // ระยะห่างเส้นตาราง อ่านเป็น ซม จากช่องกรอกแล้วแปลงเป็นพิกเซล
  function gridStep(axis) {
    var el = document.getElementById(axis === 'x' ? 'scale-x' : 'scale-y');
    var v = el ? parseFloat(el.value) : 2;
    if (!isFinite(v) || v < 0.2) v = 2;        // กันกรอก 0 แล้วได้เส้นเป็นหมื่นเส้น
    return toPx(v);
  }

  // ปัดเข้าเส้นตารางที่ใกล้ที่สุด — เปิดแกนเดียวเลื่อนได้ตามแนวเส้น
  // เปิดสองแกนจะเหลือแค่จุดตัดเองโดยอัตโนมัติ
  function snapToGuides(x, y) {
    var sx = x, sy = y, g;
    if (gridY) { g = gridStep('y'); sx = Math.round(x / g) * g; }   // เส้นตั้งล็อกค่า x
    if (gridX) { g = gridStep('x'); sy = Math.round(y / g) * g; }   // เส้นนอนล็อกค่า y
    return { x: sx, y: sy };
  }

  /* วางจุดหนึ่งจุดตรงพิกัดที่บอก พร้อมทุกอย่างที่ต้องทำรอบๆ มัน
     แยกออกมาจาก keydown ของปุ่ม 1 เพราะโหมดมือถือต้องเรียกด้วยพิกัดที่นิ้วแตะ
     ปุ่ม 1 ใช้ตำแหน่งเมาส์ที่ค้างอยู่ได้เพราะเมาส์ "ชี้" อยู่ตลอดเวลา ส่วนนิ้วไม่ชี้อะไรเลย
     จนกว่าจะแตะ — mouse.x/y ตอนนั้นจึงเป็นค่าค้างจากที่แตะครั้งก่อน ไม่ใช่ที่ที่ตั้งใจ */
  function placePointAt(x, y) {
    if (!canAddPoints(1)) return false;

    // แตะโดนเส้นรอบวงอยู่ = วางจุดเกาะลงบนเส้นนั้นเลย
    var ht = hitTest(x, y);
    if (ht.type === 'circle' || ht.type === 'arc') {
      pushUndo();
      if (addPointOnCircle(ht) !== null) settle();
      return true;
    }

    var g = snapToGuides(x, y);
    pushUndo();
    addPoint(g.x, g.y);
    settle();                                  // วางทับจุดเดิมก็ยุบรวมให้เลย
    return true;
  }

  // ประตูเดียวสำหรับสร้างจุด คืน null เมื่อเต็มเพดาน
  function addPoint(x, y) {
    if (points.length >= POINT_MAX) { notifyFull(); return null; }
    var p = { id: nextPointId++, x: x, y: y };
    points.push(p);
    if (points.length > POINT_WARN && !warnedMany) {
      warnedMany = true;
      notify('จุดเยอะแล้ว (' + points.length + ' จุด) โปรแกรมอาจเริ่มหน่วง');
    }
    return p.id;
  }

  // ลากกรอบเสร็จแล้วสร้างรูปจริง
  function commitShape(c) {
    var b = shapeBox(c);
    if (b.w < 3 || b.h < 3) return;             // ลากสั้นเกิน ถือว่าคลิกพลาด
    var need = (c.kind === 'rect') ? 4 : (c.kind === 'circle') ? 0 : 3;
    if (!canAddPoints(need)) return;            // ไม่พอก็ไม่สร้าง ไม่เอารูปครึ่ง ๆ
    pushUndo();

    if (c.kind === 'rect') {
      var p1 = addPoint(b.x0, b.y0), p2 = addPoint(b.x1, b.y0);
      var p3 = addPoint(b.x1, b.y1), p4 = addPoint(b.x0, b.y1);
      connect(p1, p2); connect(p2, p3); connect(p3, p4); connect(p4, p1);

    } else if (c.kind === 'tri') {
      var t1 = addPoint((b.x0 + b.x1) / 2, b.y0);
      var t2 = addPoint(b.x1, b.y1), t3 = addPoint(b.x0, b.y1);
      connect(t1, t2); connect(t2, t3); connect(t3, t1);

    } else if (c.kind === 'rtri') {                        // มุมฉากอยู่มุมล่างซ้าย
      var q1 = addPoint(b.x0, b.y0), q2 = addPoint(b.x0, b.y1), q3 = addPoint(b.x1, b.y1);
      connect(q1, q2); connect(q2, q3); connect(q3, q1);

    } else if (c.kind === 'circle') {                      // ยืดได้เต็มกรอบ = วงรี
      circles.push({ id: nextCircleId++,
                     cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2,
                     rx: b.w / 2, ry: b.h / 2, rot: 0 });
    }
    settle();
  }

  // ---------- ที่จับหมุนสิ่งที่เลือก ----------
  // ที่จับกว้าง 12px จิ้มด้วยนิ้วแทบไม่โดน และถ้าดันมันออกห่างกว่าเดิมด้วยจะเล็งง่ายขึ้นอีก
  var ROT_GAP = onPhone ? 40 : 30, ROT_HIT = onPhone ? 24 : 12;

  // จุด/วง ทั้งหมดที่อยู่ในสิ่งที่เลือก ใช้ทั้งหาขอบเขตและหมุน
  function selectionTargets() {
    var sel = selectedParts(), ids = [], cids = [], i;
    Object.keys(sel.verts).forEach(function (k) { if (pt(+k)) ids.push(+k); });
    for (i = 0; i < selection.length; i++) {
      if (selection[i].type === 'circle' && circleById(selection[i].id)) {
        cids.push(selection[i].id);
      } else if (selection[i].type === 'arc') {   // เลือกช่วงโค้ง = ขยับ/หมุนจุดทั้งวงนั้น
        var acr = circleById(parseInt(String(selection[i].id).split(':')[0], 10));
        var CP = acr ? circlePts(acr) : [];
        for (var k = 0; k < CP.length; k++) if (ids.indexOf(CP[k].id) === -1) ids.push(CP[k].id);
      }
    }
    return { ids: ids, circleIds: cids };
  }

  function selectionBounds() {
    var t = selectionTargets(), i, p, cr, h;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (i = 0; i < t.ids.length; i++) {
      p = pt(t.ids[i]);
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    for (i = 0; i < t.circleIds.length; i++) {
      cr = circleById(t.circleIds[i]); h = ellipseHalf(cr);
      if (cr.cx - h.x < minX) minX = cr.cx - h.x;
      if (cr.cx + h.x > maxX) maxX = cr.cx + h.x;
      if (cr.cy - h.y < minY) minY = cr.cy - h.y;
      if (cr.cy + h.y > maxY) maxY = cr.cy + h.y;
    }
    if (!isFinite(minX)) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY,
             cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  // จุดกึ่งกลางและรัศมีของวงหมุน (ที่จับอยู่เหนือสิ่งที่เลือก)
  function rotRing() {
    if (rotating) return { cx: rotating.cx, cy: rotating.cy, r: rotating.r };
    var b = selectionBounds();
    if (!b) return null;
    return { cx: b.cx, cy: b.cy, r: (b.maxY - b.minY) / 2 + ROT_GAP };
  }

  function rotHandlePos() {
    var g = rotRing();
    if (!g) return null;
    var a = rotating ? rotating.prevA : -Math.PI / 2;     // ปกติอยู่ตรงด้านบน
    return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a) };
  }

  function startRotate(m) {
    var g = rotRing(), t = selectionTargets(), i;
    if (!g) return;
    pushUndo();
    var orig = [], origC = [];
    for (i = 0; i < t.ids.length; i++) {
      var p = pt(t.ids[i]);
      orig.push({ id: p.id, x: p.x, y: p.y,
                  tan: (p.on && p.on.tan) ? { x: p.on.tan.x, y: p.on.tan.y } : null });
    }
    for (i = 0; i < t.circleIds.length; i++) {
      var cr = circleById(t.circleIds[i]);
      origC.push({ id: cr.id, cx: cr.cx, cy: cr.cy, rot: cr.rot || 0 });
    }
    rotating = { cx: g.cx, cy: g.cy, r: g.r, total: 0,
                 prevA: Math.atan2(m.y - g.cy, m.x - g.cx), orig: orig, origC: origC };
    rotating.a0 = rotating.prevA;
  }

  function updateRotate(m) {
    var a = Math.atan2(m.y - rotating.cy, m.x - rotating.cx);
    var d = a - rotating.prevA;                            // สะสมทีละช่วง จะได้หมุนเกินรอบได้
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    rotating.total += d;
    rotating.prevA = a;

    var c = Math.cos(rotating.total), s = Math.sin(rotating.total), i;
    for (i = 0; i < rotating.orig.length; i++) {           // หมุนจากตำแหน่งตั้งต้นเสมอ ไม่สะสมความคลาดเคลื่อน
      var o = rotating.orig[i], p = pt(o.id);
      if (!p) continue;
      var dx = o.x - rotating.cx, dy = o.y - rotating.cy;
      p.x = rotating.cx + dx * c - dy * s;
      p.y = rotating.cy + dx * s + dy * c;
      if (o.tan && p.on) {                       // แทนเจนต์ที่ตรึงไว้ต้องหมุนตามรูปด้วย
        p.on.tan = { x: o.tan.x * c - o.tan.y * s, y: o.tan.x * s + o.tan.y * c };
      }
    }
    for (i = 0; i < rotating.origC.length; i++) {
      var oc = rotating.origC[i], cr = circleById(oc.id);
      if (!cr) continue;
      var ex = oc.cx - rotating.cx, ey = oc.cy - rotating.cy;
      cr.cx = rotating.cx + ex * c - ey * s;
      cr.cy = rotating.cy + ex * s + ey * c;
      cr.rot = oc.rot + rotating.total;
    }
    syncCirclePoints();
    rebuildFaces();
  }

  function drawRotUI() {
    var g = rotRing(), h = rotHandlePos();
    if (!g || !h) return;

    if (rotating) {                                        // วงทางเดินหมุน + เส้นชี้ + มุม
      ctx.strokeStyle = P.guide;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(h.x, h.y); ctx.stroke();

      var ar = Math.min(34, g.r * 0.55);
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, ar, rotating.a0, rotating.a0 + rotating.total, rotating.total < 0);
      ctx.stroke();

      var mid = rotating.a0 + rotating.total / 2;
      ctx.fillStyle = P.stroke;
      ctx.font = P.labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((rotating.total * 180 / Math.PI).toFixed(1) + '°',
                   g.cx + Math.cos(mid) * (ar + 16), g.cy + Math.sin(mid) * (ar + 16));
    }

    ctx.beginPath();                                       // ตัวที่จับ
    ctx.arc(h.x, h.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = P.paper;
    ctx.fill();
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();                                       // ลูกศรโค้งในที่จับ
    ctx.arc(h.x, h.y, 5, -Math.PI * 0.85, Math.PI * 0.45);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    var ea = Math.PI * 0.45, ex = h.x + 5 * Math.cos(ea), ey = h.y + 5 * Math.sin(ea);
    ctx.beginPath();
    ctx.moveTo(ex - 3, ey - 1);
    ctx.lineTo(ex, ey + 3);
    ctx.lineTo(ex + 3, ey - 1);
    ctx.stroke();
  }

  // ---------- ย้อนกลับ / คัดลอก / วาง ----------
  function snapshot() {
    return JSON.stringify({ p: points, e: edges, c: circles,
                            np: nextPointId, ne: nextEdgeId, nc: nextCircleId });
  }

  // เก็บสถานะปัจจุบันไว้ก่อนจะแก้อะไร ถ้าเหมือนตัวบนสุดอยู่แล้วก็ไม่ต้องเก็บซ้ำ
  function pushUndo() {
    var s = snapshot();
    if (undoStack.length && undoStack[undoStack.length - 1] === s) return;
    undoStack.push(s);
    if (undoStack.length > UNDO_MAX) undoStack.shift();
  }

  function restore(s) {
    var d = JSON.parse(s);
    points = d.p; edges = d.e; circles = d.c;
    nextPointId = d.np; nextEdgeId = d.ne; nextCircleId = d.nc;
    selection = []; drag = null; marquee = null; creating = null; rotating = null;
    closeEditor();
    rebuildFaces();
  }

  function undo() {
    if (!undoStack.length) return;
    var cur = snapshot();
    var s = undoStack.pop();
    if (s === cur && undoStack.length) s = undoStack.pop();   // ตัวบนสุดเหมือนของปัจจุบัน ข้ามไปตัวก่อน
    restore(s);
  }

  function copySelection() {
    var pid = Object.create(null), eid = Object.create(null), cids = [], i, j;
    for (i = 0; i < selection.length; i++) {
      var s = selection[i];
      if (s.type === 'point') {
        pid[s.id] = true;
      } else if (s.type === 'edge') {
        var e = edgeById(s.id);
        if (e) { eid[e.id] = true; pid[e.a] = true; pid[e.b] = true; }
      } else if (s.type === 'face') {
        var f = faceByKey(s.id);
        if (f) for (j = 0; j < f.length; j++) {
          pid[f[j]] = true;
          var fe = edgeBetween(f[j], f[(j + 1) % f.length]);
          if (fe) eid[fe.id] = true;
        }
      } else if (s.type === 'circle') {
        if (circleById(s.id)) cids.push(s.id);
      }
    }
    for (i = 0; i < edges.length; i++) {          // ด้านที่ปลายทั้งสองอยู่ในชุดที่เลือก เอาไปด้วย
      if (pid[edges[i].a] && pid[edges[i].b]) eid[edges[i].id] = true;
    }

    var cp = [], ce = [], cc = [];
    Object.keys(pid).forEach(function (k) {
      var p = pt(+k);
      if (p) cp.push({ id: p.id, x: p.x, y: p.y, on: p.on ? { c: p.on.c, t: p.on.t } : null });
    });
    Object.keys(eid).forEach(function (k) {
      var e = edgeById(+k);
      if (e && pid[e.a] && pid[e.b]) ce.push({ a: e.a, b: e.b });
    });
    for (i = 0; i < cids.length; i++) {
      var c = circleById(cids[i]);
      if (c) cc.push({ id: c.id, cx: c.cx, cy: c.cy, rx: c.rx, ry: c.ry, rot: c.rot || 0 });
    }
    if (!cp.length && !cc.length) return false;
    clipboard = { points: cp, edges: ce, circles: cc };
    return true;
  }

  function pasteClipboard() {
    if (!clipboard) return false;
    var cp = clipboard.points, ce = clipboard.edges, cc = clipboard.circles, i;

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function grow(x, y) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    for (i = 0; i < cp.length; i++) grow(cp[i].x, cp[i].y);
    for (i = 0; i < cc.length; i++) {
      grow(cc[i].cx - cc[i].rx, cc[i].cy - cc[i].ry);
      grow(cc[i].cx + cc[i].rx, cc[i].cy + cc[i].ry);
    }
    if (!isFinite(minX)) return false;
    if (!canAddPoints(cp.length)) return false;   // วางไม่ครบก็ไม่วางเลย
    var dx = mouse.x - (minX + maxX) / 2;         // วางให้กึ่งกลางของที่คัดลอกมาอยู่ตรงเมาส์
    var dy = mouse.y - (minY + maxY) / 2;

    pushUndo();
    var mapP = Object.create(null), mapC = Object.create(null);
    for (i = 0; i < cc.length; i++) {
      var nc = { id: nextCircleId++, cx: cc[i].cx + dx, cy: cc[i].cy + dy,
                 rx: cc[i].rx, ry: cc[i].ry, rot: cc[i].rot || 0 };
      circles.push(nc);
      mapC[cc[i].id] = nc.id;
    }
    for (i = 0; i < cp.length; i++) {
      var npId = addPoint(cp[i].x + dx, cp[i].y + dy);
      if (npId === null) break;
      var np = pt(npId);
      if (cp[i].on && mapC[cp[i].on.c]) np.on = { c: mapC[cp[i].on.c], t: cp[i].on.t };
      mapP[cp[i].id] = np.id;
    }
    for (i = 0; i < ce.length; i++) connect(mapP[ce[i].a], mapP[ce[i].b]);

    selection = [];                               // เลือกของที่เพิ่งวางไว้ให้เลย จะได้ลากต่อได้ทันที
    Object.keys(mapP).forEach(function (k) { selAdd('point', mapP[k]); });
    Object.keys(mapC).forEach(function (k) { selAdd('circle', mapC[k]); });
    settle();
    return true;
  }

  // ---------- การโต้ตอบ ----------
  function startDrag(ids, x, y, circleIds) {
    pushUndo();
    drag = { ids: ids, circleIds: circleIds || [], lastX: x, lastY: y };
  }

  // ลากพื้นที่ว่าง = เลื่อนมุมมอง เก็บ clientX/clientY ดิบ ไม่ผ่าน localPos เพราะ localPos
  // ลบ camera ออกอยู่แล้ว — คำนวณ delta จากพิกัดที่ลบ camera ไปแล้วจะเกิด feedback loop
  // (ขยับกล้อง -> localPos เปลี่ยนตาม -> delta ผิด) นี่คือการเปลี่ยน "มุมมอง" ไม่ใช่ข้อมูลรูปทรง
  // จึงไม่เรียก pushUndo() แบบที่ startDrag ทำ — Ctrl+Z จะได้ไม่ย้อนการเลื่อนจอกลับ
  function startPan(e) {
    panning = { lastClientX: e.clientX, lastClientY: e.clientY };
    canvas.style.cursor = 'grabbing';
  }

  // จอ -> โลก: จุดแปลงพิกัดขาเข้าจุดเดียวของทั้งไฟล์ ทุกอย่างที่อ่านจากนี่
  // (hitTest, การสร้าง/ลากจุด, marquee, snapToGuides, หมุน ฯลฯ) จึงเห็นแต่พิกัดโลก
  function localPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left - camera.x, y: e.clientY - rect.top - camera.y };
  }

  /* drag / panning / rotating / creating / marquee เป็นตัวแปรเดี่ยวตัวละหนึ่ง ไม่ผูกกับ pointerId
     นิ้วที่สองที่แตะลงมาระหว่างลากจะเข้ามาเขียนทับ panning.lastClientX/Y แล้วกล้องกระโดด
     จึงรับเฉพาะนิ้วที่เริ่มลากไว้ ตลอดช่วงที่ยังลากอยู่ — ท่าสองนิ้วไม่มีในแอปนี้อยู่แล้ว

     เงื่อนไขผูกกับ "กำลังลากอยู่จริงไหม" ไม่ใช่กับ id ที่ค้างไว้เฉยๆ โดยตั้งใจ:
     pointerup หายไปได้จริง (สลับแท็บกลางคัน เบราว์เซอร์กลืน event ไป) ถ้ายึด id ไว้
     ตลอดกาลเมื่อนั้น แอปจะไม่รับนิ้วอีกเลยจนกว่าจะรีเฟรช แบบนี้พอปล่อยแล้วก็หายเอง */
  var activePointer = null;

  function dragging() {
    return !!(drag || panning || rotating || creating || marquee);
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (dragging() && e.pointerId !== activePointer) return;
    activePointer = e.pointerId;
    e.preventDefault();

    var m = localPos(e);
    ctrlHeld = ctrlOn(e);

    // โหมดวางจุด: แตะที่ไหนก็วางจุดตรงนั้น ไม่ไปเลือกหรือลากอะไรทั้งนั้น
    if (placeMode) {
      closeEditor();
      mouse.x = m.x; mouse.y = m.y;
      placePointAt(m.x, m.y);
      return;
    }

    // เครื่องมือแบ่ง: ใช้ได้ทั้งกับด้านตรง วงรี และช่วงโค้งของวง
    if (activeTool === 'bisect') {
      var th = hitTest(m.x, m.y);
      if (th.type === 'edge' || th.type === 'circle' || th.type === 'arc') {
        closeEditor();
        mouse.x = m.x; mouse.y = m.y;
        if (th.type === 'edge') bisectEdge(th.id, bisectCount());
        else bisectCircle(th, bisectCount());
        return;
      }
    }

    // เครื่องมือรูปร่าง: กดค้างแล้วลากเพื่อกำหนดขนาด
    if (activeTool === 'shape' && shapeKind) {
      closeEditor();
      window.focus();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      mouse.x = m.x; mouse.y = m.y;
      creating = { kind: shapeKind, x0: m.x, y0: m.y, x1: m.x, y1: m.y };
      return;
    }

    // จับที่หมุนของสิ่งที่เลือกอยู่
    if (!toolUsesCanvas() && selection.length) {
      var rh = rotHandlePos();
      if (rh && Math.hypot(m.x - rh.x, m.y - rh.y) <= ROT_HIT) {
        closeEditor();
        window.focus();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        mouse.x = m.x; mouse.y = m.y;
        startRotate(m);
        return;
      }
    }

    // Shift+Ctrl+คลิก = กรอกค่า จิ้มที่ตัวเลขก็ได้ จิ้มที่ตัวจุด/ด้าน/รูปเลยก็ได้
    // (บนมือถือคือปุ่ม "แก้ค่า" ซึ่งตั้งธงทั้งสองพร้อมกัน)
    if (shiftOn(e) && ctrlOn(e)) {
      var lab = hitLabel(m.x, m.y) || labelFor(hitTest(m.x, m.y));
      if (lab) { openEditor(lab); return; }    // return กันไม่ให้ไปเลือก/ลากของที่อยู่ตรงนั้น
    }
    closeEditor();                             // คลิกที่อื่นถือว่าเลิกกรอก

    window.focus();                                                 // กันกรณีคีย์บอร์ดยังไม่โฟกัสมาที่หน้านี้
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}   // ลากต่อได้แม้เมาส์ออกนอกกรอบ

    mouse.x = m.x; mouse.y = m.y;
    shiftHeld = shiftOn(e);

    var hit = hitTest(m.x, m.y);

    if (ctrlOn(e)) {
      if (hit.type === 'point') {
        var last = selLast();
        if (last && last.type === 'point' && last.id !== hit.id) {
          pushUndo();
          addEdge(last.id, hit.id);                 // เชื่อมด้านจากจุดที่เลือกล่าสุด
          selAdd('point', hit.id);                  // แล้วนับจุดใหม่เป็นตัวล่าสุดต่อ
        } else if (last && last.type === 'point' && last.id === hit.id) {
          selRemove('point', hit.id);               // คลิกซ้ำที่ตัวล่าสุด = เอาออก
        } else {
          selAdd('point', hit.id);
        }
        startDrag([hit.id], m.x, m.y);              // กด Ctrl ค้างแล้วลากจุดได้ด้วย
      } else if (hit.type === 'edge') {
        if (selHas('edge', hit.id)) selRemove('edge', hit.id);
        else selAdd('edge', hit.id);
        var ed = edgeById(hit.id);
        if (ed) startDrag([ed.a, ed.b], m.x, m.y);
      } else if (hit.type === 'face') {
        if (selHas('face', hit.id)) selRemove('face', hit.id);
        else selAdd('face', hit.id);
        var f = faceByKey(hit.id);
        if (f) startDrag(f.slice(), m.x, m.y);
      } else if (hit.type === 'circle') {
        if (selHas('circle', hit.id)) selRemove('circle', hit.id);
        else selAdd('circle', hit.id);
        startDrag([], m.x, m.y, [hit.id]);
      } else if (hit.type === 'arc') {
        if (selHas('arc', hit.id)) selRemove('arc', hit.id);
        else selAdd('arc', hit.id);
      } else {
        marquee = { x0: m.x, y0: m.y, x1: m.x, y1: m.y };  // ที่ว่าง = เริ่มลากกรอบเลือก
      }
    } else if (hit.type === 'point') {
      startDrag([hit.id], m.x, m.y);
    } else if (hit.type === 'circle') {
      startDrag([], m.x, m.y, [hit.id]);                   // คลิกเปล่าที่วงกลมก็ลากย้ายได้
    } else {
      startPan(e);                                          // ที่ว่างไม่กด Ctrl = ลากเลื่อนมุมมอง
    }

    hover = hit;
  });

  canvas.addEventListener('pointermove', function (e) {
    if (dragging() && e.pointerId !== activePointer) return;
    var m = localPos(e);
    mouse.x = m.x; mouse.y = m.y;
    shiftHeld = shiftOn(e);
    if (ctrlHeld !== ctrlOn(e)) { ctrlHeld = ctrlOn(e); updateToolbar(); }

    if (rotating) { updateRotate(m); return; }
    if (creating) { creating.x1 = m.x; creating.y1 = m.y; return; }
    if (marquee)  { marquee.x1 = m.x;  marquee.y1 = m.y;  return; }
    if (panning) {                      // delta จาก clientX/Y ดิบ เหตุผลเดียวกับใน startPan
      camera.x += e.clientX - panning.lastClientX;
      camera.y += e.clientY - panning.lastClientY;
      panning.lastClientX = e.clientX;
      panning.lastClientY = e.clientY;
      return;
    }

    if (drag) {
      var dx = m.x - drag.lastX, dy = m.y - drag.lastY;
      drag.lastX = m.x; drag.lastY = m.y;
      for (var i = 0; i < drag.ids.length; i++) {
        var p = pt(drag.ids[i]);
        if (p) {
          p.x += dx; p.y += dy;
          if (p.on) projectOnCircle(p);          // จุดที่เกาะวงให้เลื่อนไปตามเส้นรอบวง
        }
      }
      for (i = 0; i < drag.circleIds.length; i++) {
        var cr = circleById(drag.circleIds[i]);
        if (cr) { cr.cx += dx; cr.cy += dy; }
      }
      if (drag.circleIds.length) syncCirclePoints();   // ลากวง จุดที่เกาะอยู่ไปด้วย
      rebuildFaces();
    }
  });

  function endDrag(e) {
    if (e && e.pointerId !== undefined) {
      // นิ้วอื่นปล่อยไม่นับ นิ้วที่กำลังลากอยู่ยังลากต่อ
      if (dragging() && e.pointerId !== activePointer) return;
      activePointer = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    if (rotating) {
      rotating = null;
      settle();
    }

    if (creating) {
      var cs = creating;
      creating = null;
      commitShape(cs);
    }

    if (marquee) {
      var mq = marquee;
      marquee = null;
      if (Math.abs(mq.x1 - mq.x0) < MARQUEE_MIN && Math.abs(mq.y1 - mq.y0) < MARQUEE_MIN) {
        selection = [];                 // คลิก Ctrl ที่ว่าง = ล้างการเลือกทั้งหมด
      } else {
        var before = selection.length;
        selectInRect(mq);               // ลากเป็นกรอบ = เลือกทุกอย่างในกรอบ
        if (selection.length === before) selection = [];   // กรอบไม่โดนอะไรเลย ก็ถือว่าล้าง
      }
    }

    if (drag) {          // ลากเสร็จแล้วค่อยหาจุดตัด จะได้ไม่งอกจุดรัว ๆ ระหว่างลาก
      drag = null;
      settle();
    }

    if (panning) {       // มุมมองอย่างเดียว ไม่ใช่ข้อมูลรูปทรง — ไม่เรียก settle()
      panning = null;
      canvas.style.cursor = '';
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointerup', endDrag);

  // เช็คปุ่มจากตำแหน่งจริงบนแป้น (e.code) เป็นหลัก เพราะถ้าสลับเป็นแป้นภาษาไทย
  // ปุ่ม 1 จะส่ง e.key มาเป็น 'ๅ' ไม่ใช่ '1' แล้วจะกดไม่ติด
  function isCreateKey(e) {
    return e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1';
  }

  function isDeleteKey(e) {
    return e.code === 'Delete' || e.code === 'Backspace' ||
           e.key === 'Delete'  || e.key === 'Backspace';
  }

  /* หน้าต่างปุ่มลัดเปิดอยู่ = ผู้ใช้กำลัง "อ่าน" ปุ่ม ไม่ใช่ "สั่ง"
     ธงนี้ geo-ui.js ใส่ไว้บน <html> ถ้าไม่เช็ค คนที่อ่านแล้วลองกด 1 ตาม
     จะมีจุดงอกอยู่หลังหน้าต่างโดยไม่รู้ตัว */
  function keysBlocked() {
    return document.documentElement.classList.contains('geo-modal-open');
  }

  window.addEventListener('keydown', function (e) {
    if (editor) return;                        // กำลังกรอกค่าอยู่ ปล่อยให้พิมพ์ลงกล่องไป
    if (keysBlocked()) return;
    shiftHeld = shiftOn(e);
    if (ctrlHeld !== ctrlOn(e)) { ctrlHeld = ctrlOn(e); updateToolbar(); }

    if (e.key === 'Escape') {                            // เลิกใช้เครื่องมือ + ปิดตาราง
      setTool(null);
      setGrid('x', false); setGrid('y', false);
      return;
    }

    // ตารางเส้น: x = เส้นนอนทั้งระนาบ (ล็อกค่า y), y = เส้นตั้งทั้งระนาบ (ล็อกค่า x)
    // กดสลับเปิด/ปิด ตารางค้างไว้ได้ ระยะห่างตั้งที่ปุ่มไม้บรรทัดในแถบเครื่องมือ
    // เช็คจาก e.code เพราะแป้นไทยส่ง e.key มาเป็น ป / ั
    if (!e.ctrlKey && !e.altKey) {
      if (e.code === 'KeyX') { e.preventDefault(); if (!e.repeat) toggleGrid('x'); return; }
      if (e.code === 'KeyY') { e.preventDefault(); if (!e.repeat) toggleGrid('y'); return; }
    }

    // Ctrl+Z / C / V — เช็คจาก e.code เพราะแป้นไทยส่ง e.key มาเป็น ผ / แ / อ
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (e.code === 'KeyZ') { e.preventDefault(); undo(); return; }
      if (e.code === 'KeyC') { e.preventDefault(); copySelection(); return; }
      if (e.code === 'KeyV') { e.preventDefault(); pasteClipboard(); return; }
    }

    if (isCreateKey(e)) {
      e.preventDefault();
      placePointAt(mouse.x, mouse.y);            // ตรงที่เมาส์ชี้อยู่
      return;
    }

    if (isDeleteKey(e)) {
      e.preventDefault();
      deleteSelected();
    }
  });

  /* ลบทุกอย่างที่เลือกอยู่ ถ้าไม่ได้เลือกอะไรก็ลบสิ่งที่เมาส์ชี้อยู่
     แยกจาก keydown เพราะปุ่ม "ลบ" บนแถบมือถือต้องเรียกตัวเดียวกันนี้
     บนนิ้วจะไม่มีของที่ "ชี้อยู่" ปุ่มจึงมีผลเฉพาะเมื่อเลือกอะไรไว้แล้ว ซึ่งตรงกับที่เห็น */
  function deleteSelected() {
    var targets = selection.length ? selection.slice() : [hitTest(mouse.x, mouse.y)];
    var did = false;
    pushUndo();
    for (var i = 0; i < targets.length; i++) {
      if (deleteTarget(targets[i])) did = true;
    }
    if (did) {
      selection = [];
      drag = null;
      rebuildFaces();
    }
    return did;
  }

  window.addEventListener('keyup', function (e) {
    if (editor) return;
    /* keyup ไม่ return ทิ้งเหมือน keydown — ต้องปล่อยให้ Ctrl/Shift ที่ค้างอยู่
       ตอนเปิดหน้าต่างได้คลายออก ไม่งั้นแถบเครื่องมือจะค้างเปิดหลังปิดหน้าต่าง
       ผ่าน ctrlOn/shiftOn เพื่อให้ปุ่มบนจอที่กดค้างไว้ไม่ถูกปล่อยตามปุ่มจริง */
    shiftHeld = shiftOn(e);
    if (ctrlHeld !== ctrlOn(e)) { ctrlHeld = ctrlOn(e); updateToolbar(); }
  });
  window.addEventListener('blur', function () {
    // ธงจากปุ่มบนจอเป็นสวิตช์ที่ผู้ใช้ตั้งไว้เอง เช่นเดียวกับตาราง จึงไม่ล้างตอนสลับหน้าต่าง
    shiftHeld = touchMods.shift; ctrlHeld = touchMods.ctrl;
    drag = null; marquee = null; creating = null; rotating = null;
    activePointer = null;
    updateToolbar();
  });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', function () { closeEditor(); resize(); });

  /* ============================================
     แถบปุ่มโหมด (โหมดมือถือเท่านั้น)

     แอปนี้ซ่อนความสามารถไว้หลังคีย์บอร์ดเกือบทั้งหมด นิ้วจึงต้องมีปุ่มมาแทน
     ปุ่มที่นี่ไม่ได้ทำงานเอง — มันแค่ตั้งธงหรือเรียกฟังก์ชันเดิมที่ปุ่มจริงเรียกอยู่แล้ว
     ตรรกะทั้งหมดจึงยังมีฉบับเดียว ไม่มีสองทางที่ต้องคอยแก้ให้ตรงกัน

     "ไม่เลือกอะไรเลย" คือโหมดเลื่อนจอ ซึ่งเป็นพฤติกรรมเดิมของการลากที่ว่างอยู่แล้ว
     จึงไม่มีปุ่มแยกให้มัน
     ============================================ */
  var modeBar = document.getElementById('geoModes');

  if (onPhone && modeBar) {
    // ปุ่มสลับค้าง: ตั้งธงอะไรบ้างเมื่อโหมดนี้เปิดอยู่
    var MODES = {
      place:   { ctrl: false, shift: false, place: true  },   // แตะวางจุด
      select:  { ctrl: true,  shift: false, place: false },   // เลือก / เชื่อมด้าน
      measure: { ctrl: false, shift: true,  place: false },   // ดูค่าที่วัดได้
      edit:    { ctrl: true,  shift: true,  place: false }    // กรอกค่าทับ
    };
    var mode = null;

    function wearMode(next) {
      mode = (mode === next) ? null : next;                   // กดซ้ำที่เดิม = ปิด
      var on = MODES[mode] || { ctrl: false, shift: false, place: false };
      touchMods.ctrl = on.ctrl;
      touchMods.shift = on.shift;
      placeMode = on.place;
      ctrlHeld = on.ctrl;
      shiftHeld = on.shift;

      // เครื่องมือบนแถบล่างกับโหมดตรงนี้ต่างก็กินการแตะบนกระดาษ เปิดพร้อมกันไม่ได้
      if (mode) setTool(null);

      var btns = modeBar.querySelectorAll('[data-mode]');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i], is = b.getAttribute('data-mode') === mode;
        b.classList.toggle('active', is);
        b.setAttribute('aria-pressed', String(is));
      }
      updateToolbar();
    }

    // สั่งงานทันที ทุกตัวคือฟังก์ชันเดิมที่คีย์ลัดเรียกอยู่แล้ว
    var ACTIONS = {
      del:   deleteSelected,
      undo:  undo,
      copy:  copySelection,
      paste: pasteClipboard,
      gridx: function () { toggleGrid('x'); },
      gridy: function () { toggleGrid('y'); }
    };

    modeBar.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-mode'))       wearMode(btn.getAttribute('data-mode'));
      else if (btn.hasAttribute('data-act'))   (ACTIONS[btn.getAttribute('data-act')] || function () {})();
    });

    /* ปุ่มตารางเป็นสวิตช์ค้าง เช่นเดียวกับปุ่มแกนบนแถบเครื่องมือ — ต้องสะท้อนสถานะจริง
       ไม่ใช่แค่สถานะที่ปุ่มนี้เคยกด เพราะกด x/y จากคีย์บอร์ดก็เปลี่ยนได้เหมือนกัน */
    var syncGrids = function () {
      var bx = modeBar.querySelector('[data-act="gridx"]');
      var by = modeBar.querySelector('[data-act="gridy"]');
      if (bx) { bx.classList.toggle('active', gridX); bx.setAttribute('aria-pressed', String(gridX)); }
      if (by) { by.classList.toggle('active', gridY); by.setAttribute('aria-pressed', String(gridY)); }
    };
    modeBar.addEventListener('click', syncGrids);
    window.addEventListener('keyup', syncGrids);

    /* ให้ setTool ปลดโหมดที่ค้างอยู่ได้ (ประกาศตัวแปรไว้หัวไฟล์ ที่นี่คือที่เดียวที่รู้จัก
       wearMode) เรียกด้วย null ตรงๆ ไม่ใช่ toggle จึงปลดเสมอไม่ว่าค้างโหมดไหนอยู่
       ไม่วนกลับ: wearMode ตั้ง mode = null ก่อน เงื่อนไข if (mode) setTool(null) ข้างใน
       จึงเป็นเท็จเสมอเมื่อถูกเรียกมาทางนี้ */
    clearTouchMode = function () { wearMode(null); };

    modeBar.hidden = false;
    wearMode('place');            // เปิดมาให้วางจุดได้เลย ไม่ต้องเดาว่าต้องกดอะไรก่อน
  }

  /* ============================================
     ตัวอย่างกดเดียวขึ้น

     สร้างผ่าน addPoint/connect/settle ตัวเดียวกับที่การวาดด้วยมือใช้ จึงได้รูปที่มีสถานะ
     เหมือนรูปที่ผู้ใช้วาดเองทุกประการ — ลากต่อได้ ลบได้ ย้อนได้ วัดค่าได้ ไม่ใช่ภาพนิ่ง
     ที่ฝังไว้เป็นกรณีพิเศษแล้วต้องคอยตามแก้เมื่อกฎอื่นเปลี่ยน

     พิกัดคิดจากกลางจอแล้วลบ camera ออก เพราะทุกอย่างในไฟล์นี้เก็บเป็นพิกัดโลก
     ถ้าเลื่อนกระดาษไปแล้วกดตัวอย่าง รูปจะยังมาโผล่ตรงกลางที่มองเห็นอยู่
     ============================================ */
  var examplesEl = document.getElementById('geoExamples');

  function loadExample(kind) {
    pushUndo();
    points = []; edges = []; circles = []; faces = []; selection = [];
    drag = null; marquee = null; creating = null; rotating = null;

    var cx = window.innerWidth / 2 - camera.x;
    var cy = window.innerHeight / 2 - camera.y;
    var r = Math.min(window.innerWidth, window.innerHeight) * 0.17;
    r = Math.max(70, Math.min(r, 150));

    if (kind === 'circle') {
      circles.push({ id: nextCircleId++, cx: cx, cy: cy, rx: r, ry: r });
    } else {
      // สามเหลี่ยมด้านเท่าวางปลายขึ้น ส่วนสี่เหลี่ยมเป็นจัตุรัสจริง ไม่ใช่ผืนผ้า
      // จะได้เห็นตอนกด Shift ว่าค่าที่วัดได้ออกมาเท่ากันจริงตามรูป
      var pts = kind === 'triangle'
        ? [[cx, cy - r], [cx + r * 0.866, cy + r * 0.5], [cx - r * 0.866, cy + r * 0.5]]
        : [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]];
      var ids = [];
      for (var i = 0; i < pts.length; i++) ids.push(addPoint(pts[i][0], pts[i][1]));
      for (i = 0; i < ids.length; i++) connect(ids[i], ids[(i + 1) % ids.length]);
    }
    settle();
  }

  if (examplesEl) {
    examplesEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-example]');
      if (!btn) return;
      loadExample(btn.getAttribute('data-example'));
    });
  }

  /* ซ่อนเมื่อกระดาษไม่ว่างแล้ว เช็คใน draw() ซึ่งเดินทุกเฟรมอยู่แล้ว แต่แตะ DOM เฉพาะตอน
     ค่าเปลี่ยนจริง — จุดถูกเพิ่ม/ลบได้จากหลายทาง (วาดเอง วาง undo ลบ) การไปตั้งธงให้ครบ
     ทุกทางมีโอกาสตกหล่นมากกว่าเทียบค่าเดียวต่อเฟรม */
  var boardWasEmpty = null;

  function refreshExamples() {
    if (!examplesEl) return;
    var empty = points.length === 0 && circles.length === 0;
    if (empty === boardWasEmpty) return;
    boardWasEmpty = empty;
    examplesEl.classList.toggle('is-gone', !empty);
  }

  readPalette();
  /* สลับธีมแล้วต้องอ่านจานสีใหม่ ไม่งั้นรูปที่วาดไว้จะค้างสีของธีมเก่าอยู่บนกระดาษสีใหม่
     ครอบด้วย if เพราะ app.js ต้องยังเปิดเดี่ยวๆ ได้ถ้าไม่มี assets/js/core.js */
  if (window.IM && window.IM.onThemeChange) window.IM.onThemeChange(readPalette);

  resize();
  window.focus();
  draw();
})();
