/* ============================================
   shortcuts.js — the gear in the corner, and the card of everything that can be pressed

   The calculator hides most of what it can do behind ctrl and shift: a term lights up green
   only once shift is held, a fraction turns into a decimal only on a ctrl-click of the bar
   itself. None of that announces itself, so this is where it is written down.

   Nothing here touches script.js. The panel is built and owned entirely by this file, and
   the calculator goes on knowing nothing about it.
   ============================================ */
(function (w) {
  'use strict';

  /* ---------- what the card says ----------
     Each row is a set of key chips and what pressing them does. Keeping it as data rather
     than markup means a row is added by writing one line, the way the A-Z keys are built
     from a string in script.js.

     A section may carry a `touch` version of itself — its own title and its own rows — and on
     a phone that is what is shown in its place. It is not an extra section appended to the
     end: a reader on a phone has no Ctrl, no Shift, no wheel and nothing to hover, so a card
     that lists those and then explains underneath what they became would be a card three
     quarters of which cannot be pressed. Sections with no `touch` (the keypad ones) are the
     same on both, and are written once. */

  var SECTIONS = [
    {
      title: 'บนจอแสดงผล',
      rows: [
        { k: ['ลาก'], d: 'ย้ายบล็อกไปวางตรงไหนก็ได้' },
        { k: ['Shift', 'ชี้'], d: 'ไฮไลต์เขียว — บอกว่าจะยกทั้งพจน์ไหน' },
        { k: ['Shift', 'ลาก'], d: 'ยกทั้งพจน์; ข้าม = แล้วเครื่องหมายกลับข้างให้เอง' },
        { k: ['Shift', 'ลาก'], d: 'ที่ตัวส่วน — ยกตัวหารออก; ข้าม = แล้วกลายเป็นตัวคูณ' },
        { k: ['คลิก'], d: 'ที่ = ซึ่งสว่างอยู่ — คิดคำตอบ; กดซ้ำเพื่อถอนออก' },
        { k: ['ชี้'], d: 'ที่ป้าย "N คำตอบ" — รายการคำตอบทั้งหมดจะหล่นลงมา' },
        { k: ['คลิก'], d: 'ที่พื้นที่ว่างของจอ — เลิกเล็งคีย์แพด' }
      ],
      touch: {
        title: 'บนจอแสดงผล',
        rows: [
          { k: ['ลาก'], d: 'ย้ายบล็อกไปวางตรงไหนก็ได้' },
          { k: ['แตะ'], d: 'ที่บล็อก — ยกค้างไว้ แล้วแตะที่หมายเพื่อวาง' },
          { k: ['ยกพจน์'], d: 'เปิดโหมดนี้แล้วไฮไลต์เขียวจะบอกว่าจะยกทั้งพจน์ไหน' },
          { k: ['ยกพจน์', 'ลาก'], d: 'ยกทั้งพจน์; ข้าม = แล้วเครื่องหมายกลับข้างให้เอง' },
          { k: ['ยกพจน์', 'ลาก'], d: 'ที่ตัวส่วน — ยกตัวหารออก; ข้าม = แล้วกลายเป็นตัวคูณ' },
          { k: ['แตะ'], d: 'ที่ = ซึ่งสว่างอยู่ — คิดคำตอบ; แตะซ้ำเพื่อถอนออก' },
          { k: ['แตะ'], d: 'ที่ป้าย "N คำตอบ" — รายการคำตอบทั้งหมดจะหล่นลงมา; แตะซ้ำเพื่อเก็บ' },
          { k: ['แตะ'], d: 'ที่พื้นที่ว่างของจอ — เลิกเล็งคีย์แพด' }
        ]
      }
    },
    {
      title: 'Ctrl — แก้ค่าในบล็อก',
      rows: [
        { k: ['Ctrl', 'ชี้'], d: 'ไฮไลต์ฟ้า — บอกว่าคลิกแล้วจะเล็งไปที่ช่องไหน' },
        { k: ['Ctrl', 'คลิก'], d: 'เล็งคีย์แพดไปที่ช่องนั้น แล้วพิมพ์ทับได้เลย' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่เส้นเศษส่วน — เขียนกลับเป็นทศนิยม' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่ทศนิยม — เขียนเป็นเศษส่วน (0.5 → ½)' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่เลขชี้กำลังซึ่งเล็งอยู่แล้ว — 9² คลี่เป็น (9×9)' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่วงเล็บของ (3×3) — ยุบกลับเป็น 3²' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่ตัวอักษรเขียว — แสดง/ซ่อนคำตอบของมัน' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่เลขตัวถัดไปขณะเล็งเลขอยู่ — รวมเป็นเลขเดียว (4,5 → 45)' }
      ],
      touch: {
        title: 'โหมด "แก้ค่า" — แก้ค่าในบล็อก',
        rows: [
          { k: ['แตะ'], d: 'เล็งคีย์แพดไปที่ช่องนั้น แล้วพิมพ์ทับได้เลย' },
          { k: ['แตะ'], d: 'ที่เส้นเศษส่วน — เขียนกลับเป็นทศนิยม' },
          { k: ['แตะ'], d: 'ที่ทศนิยม — เขียนเป็นเศษส่วน (0.5 → ½)' },
          { k: ['แตะ'], d: 'ที่เลขชี้กำลังซึ่งเล็งอยู่แล้ว — 9² คลี่เป็น (9×9)' },
          { k: ['แตะ'], d: 'ที่วงเล็บของ (3×3) — ยุบกลับเป็น 3²' },
          { k: ['แตะ'], d: 'ที่ตัวอักษรเขียว — แสดง/ซ่อนคำตอบของมัน' },
          { k: ['แตะ'], d: 'ที่เลขตัวถัดไปขณะเล็งเลขอยู่ — รวมเป็นเลขเดียว (4,5 → 45)' }
        ]
      }
    },
    {
      /* The keypad is the one part of this machine that was always just buttons, so it reads
         the same whichever device is holding it. */
      title: 'ปุ่มที่เขียนทับบล็อกเดิม',
      rows: [
        { k: ['x²'], d: 'ยกกำลังบนบล็อกเดิม ไม่ใช่สร้างบล็อกใหม่ — กดซ้ำได้' },
        { k: ['²√x'], d: 'รากครอบทั้งจำนวน — 1, 6, ²√x ได้ √16 ไม่ใช่ 1×√6' },
        { k: ['÷'], d: 'ซ้อนเป็นเศษส่วน แล้วเลื่อนคีย์แพดไปใต้เส้นให้' },
        { k: ['%'], d: 'ส่วนร้อย — 5, 0, % ได้ 50% ซึ่งมีค่า 0.5' },
        { k: ['+/-'], d: 'สลับเครื่องหมายของทั้งจำนวน' },
        { k: ['A–Z'], d: 'ใส่ตัวแปร — หนึ่งตัวจะแก้สมการให้, สองตัวจะวาดกราฟให้' }
      ]
    },
    {
      title: 'กราฟ (โผล่เองเมื่อมี 2 ตัวแปร)',
      rows: [
        { k: ['ล้อเมาส์'], d: 'ซูมเข้า-ออก' },
        { k: ['ลาก'], d: 'เลื่อนกรอบไปดูที่อื่น' },
        { k: ['ดับเบิลคลิก'], d: 'กลับไปกรอบตั้งต้น' },
        { k: ['ชี้'], d: 'ที่เส้น — อ่านพิกัดตรงจุดนั้น' }
      ],
      touch: {
        title: 'กราฟ (โผล่เองเมื่อมี 2 ตัวแปร)',
        rows: [
          // ป้ายเดียวไม่ใช่สองป้าย: ตัวคั่นระหว่างป้ายคือ "+" ซึ่งจะอ่านออกมาเป็น "++−"
          { k: ['+ −'], d: 'ปุ่มบนหัวกราฟ — ซูมเข้า-ออก' },
          { k: ['ลาก'], d: 'เลื่อนกรอบไปดูที่อื่น' },
          { k: ['⟲'], d: 'ปุ่มบนหัวกราฟ — กลับไปกรอบตั้งต้น' },
          { k: ['แตะ'], d: 'ที่เส้น — อ่านพิกัดตรงจุดนั้น' }
        ]
      }
    },
    {
      title: 'เพิ่มเติม',
      rows: [
        { k: ['☀'], d: 'ปุ่มข้างเกียร์ — สลับโหมดสว่าง/มืด (จำค่าที่เลือกไว้)' },
        { k: ['⌷'], d: 'ปุ่มถัดไป — สลับโหมดคอมพิวเตอร์/มือถือ' },
        { k: ['⌘'], d: 'บน Mac ใช้แทน Ctrl ได้ทุกที่' },
        { k: ['Esc'], d: 'ปิดหน้าต่างนี้' }
      ],
      touch: {
        title: 'เพิ่มเติม',
        rows: [
          // ตัวคั่นระหว่างป้ายแปลว่า "กดพร้อมกัน" ซึ่งไม่ใช่ความหมายของสามโหมดนี้
          { k: ['แถบโหมด'], d: 'เหนือจอ — ปกติ / ยกพจน์ / แก้ค่า เลือกได้ทีละอัน ใต้ปุ่มมีคำอธิบายของโหมดที่เลือกอยู่' },
          { k: ['☀'], d: 'ปุ่มมุมขวาบน — สลับโหมดสว่าง/มืด (จำค่าที่เลือกไว้)' },
          { k: ['⌷'], d: 'ปุ่มข้างกัน — กลับไปโหมดคอมพิวเตอร์' },
          { k: ['แตะนอกหน้าต่าง'], d: 'ปิดหน้าต่างนี้' }
        ]
      }
    }
  ];

  /* ---------- building it ---------- */

  var SVG = 'http://www.w3.org/2000/svg';

  function svgNode(name, attrs) {
    var node = document.createElementNS(SVG, name);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  /* Every icon here is drawn rather than written, so there is no icon font to load and
     nothing to go missing when the page is opened straight off the disk. The three below are
     the same drawings the geometry page uses, down to the path data and the 2px stroke, so
     the two tools read as one set.

     What used to sit on the help button was called a gear but was drawn as a small circle
     ringed with eight spokes — the same shape as the sun on the theme button beside it. At
     20px the pair was indistinguishable. A "?" says what the button does and cannot be
     mistaken for the one next to it. */
  function helpIcon() {
    var svg = strokeSvg();
    svg.appendChild(svgNode('circle', { cx: 12, cy: 12, r: 9.2 }));
    svg.appendChild(svgNode('path', { d: 'M9.2 9.3a2.9 2.9 0 1 1 3.7 3.1c-.6.2-.9.7-.9 1.3v.6' }));
    svg.appendChild(svgNode('path', { d: 'M12 17.4h.01' }));
    return svg;
  }

  // The shell the three corner icons share: stroke, no fill, round ends.
  function strokeSvg() {
    return svgNode('svg', {
      width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });
  }

  function closeIcon() {
    var svg = svgNode('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' });
    svg.appendChild(svgNode('path', {
      d: 'M6 6l12 12M18 6L6 18',
      stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round'
    }));
    return svg;
  }

  // The sun and the moon are each drawn as what you are in, the same reading the rest of
  // the site uses (theme.js keys the pair to [data-theme] in CSS): standing in the dark,
  // the button shows a moon.
  function sunIcon() {
    var svg = strokeSvg();
    svg.appendChild(svgNode('circle', { cx: 12, cy: 12, r: 4.2 }));
    svg.appendChild(svgNode('path', {
      d: 'M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7' +
         'M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7'
    }));
    return svg;
  }

  function moonIcon() {
    var svg = strokeSvg();
    svg.appendChild(svgNode('path', {
      d: 'M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7Z'
    }));
    return svg;
  }

  // The pair for the device switch, read the same way as the sun and the moon: the button
  // shows what you are standing in, not what pressing it would fetch. Same drawings the
  // other two pages use for the same button.
  function monitorIcon() {
    var svg = strokeSvg();
    svg.appendChild(svgNode('rect', { x: 2.6, y: 4, width: 18.8, height: 12.4, rx: 1.8 }));
    svg.appendChild(svgNode('path', { d: 'M9 20.4h6M12 16.4v4' }));
    return svg;
  }

  function phoneIcon() {
    var svg = strokeSvg();
    svg.appendChild(svgNode('rect', { x: 6.6, y: 2.4, width: 10.8, height: 19.2, rx: 2.4 }));
    svg.appendChild(svgNode('path', { d: 'M10.6 5.4h2.8' }));
    return svg;
  }

  var lamp = document.createElement('button');
  lamp.className = 'gear lamp';
  lamp.type = 'button';
  lamp.dataset.cursor = '';

  var slate = document.createElement('button');
  slate.className = 'gear slate';
  slate.type = 'button';
  slate.dataset.cursor = '';

  var toggle = document.createElement('button');
  toggle.className = 'gear';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'ปุ่มลัดและวิธีใช้');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'shortcuts');
  toggle.dataset.cursor = '';            // the ring in cursor.js grows over anything marked so
  toggle.appendChild(helpIcon());

  var panel = document.createElement('div');
  panel.className = 'sheet';
  panel.id = 'shortcuts';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', 'ปุ่มลัดและวิธีใช้');
  panel.hidden = true;

  var head = document.createElement('div');
  head.className = 'sheet-head';
  var heading = document.createElement('h2');
  heading.textContent = 'ปุ่มลัด';
  var shut = document.createElement('button');
  shut.className = 'sheet-shut';
  shut.type = 'button';
  shut.setAttribute('aria-label', 'ปิด');
  shut.dataset.cursor = '';
  shut.appendChild(closeIcon());
  head.appendChild(heading);
  head.appendChild(shut);
  panel.appendChild(head);

  var onPhone = !!(w.IM && w.IM.isMobile);

  SECTIONS.forEach(function (whole) {
    // On a phone a section speaks in taps and modes where it has been written to; where it
    // has not, it was the same on both to begin with.
    var section = onPhone && whole.touch ? whole.touch : whole;

    var title = document.createElement('h3');
    title.className = 'sheet-title';
    title.textContent = section.title;
    panel.appendChild(title);

    var list = document.createElement('dl');
    list.className = 'sheet-list';
    section.rows.forEach(function (row) {
      var keys = document.createElement('dt');
      row.k.forEach(function (key, i) {
        if (i > 0) keys.appendChild(document.createTextNode('+'));
        var chip = document.createElement('kbd');
        chip.textContent = key;
        keys.appendChild(chip);
      });
      var says = document.createElement('dd');
      says.textContent = row.d;
      list.appendChild(keys);
      list.appendChild(says);
    });
    panel.appendChild(list);
  });

  document.body.appendChild(slate);
  document.body.appendChild(lamp);
  document.body.appendChild(toggle);
  document.body.appendChild(panel);

  /* ---------- desktop and mobile ----------
     Which one the page opened in was settled before the first stylesheet loaded, by the
     inline script in the head, the same way the theme was. The choice proper is made on the
     landing page; this is the way out when the guess was wrong — a tablet reporting a fine
     pointer, or someone who wants to see the other one.

     IM.setDevice reloads the page, since what a module subscribes to is decided once at
     boot. Nothing here has to put anything back. */

  var IM = w.IM;

  function showDevice() {
    var mobile = IM && IM.device === 'mobile';
    slate.textContent = '';
    slate.appendChild(mobile ? phoneIcon() : monitorIcon());
    slate.setAttribute('aria-label', mobile ? 'สลับเป็นโหมดคอมพิวเตอร์' : 'สลับเป็นโหมดมือถือ');
    slate.setAttribute('title', mobile ? 'ตอนนี้: โหมดมือถือ' : 'ตอนนี้: โหมดคอมพิวเตอร์');
    slate.setAttribute('aria-pressed', String(!!mobile));
  }

  showDevice();

  slate.addEventListener('click', function (e) {
    e.stopPropagation();                 // ...or the document listener would shut the card
    if (IM && IM.setDevice) IM.setDevice(IM.device === 'mobile' ? 'desktop' : 'mobile');
  });

  /* ---------- light and dark ----------
     Which one the page opens in was settled before the first stylesheet loaded, by the
     inline script in the head — doing it from here would paint one theme and then flip it,
     a flash on every load. All this does is show the state, turn it over, and remember.

     Remembering is what stops following the system: a page that overrode your choice every
     time the machine went dark at sunset would be a page that ignored you. Until a choice
     is made, though, following is exactly right, so the system is listened to up to that
     point and no further. */

  var root = document.documentElement;
  /* Shared with the main site and the geometry board, which write the same 'light'/'dark'
     through IM.setTheme. It used to be a key of this page's own, so a choice made here was
     forgotten the moment you followed a link, and one made there never reached this page —
     the button looked broken from either side. The key in the head script must match. */
  var THEME_KEY = 'im-theme';
  var systemLight = window.matchMedia('(prefers-color-scheme: light)');

  function remembered() {
    // file:// throws on localStorage in some browsers rather than returning null.
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function showTheme() {
    var dark = root.dataset.theme !== 'light';
    lamp.textContent = '';
    lamp.appendChild(dark ? moonIcon() : sunIcon());
    lamp.setAttribute('aria-label', dark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด');
    lamp.setAttribute('title', dark ? 'โหมดสว่าง' : 'โหมดมืด');
    lamp.setAttribute('aria-pressed', String(!dark));
  }

  function wearTheme(name, remember) {
    root.dataset.theme = name;
    if (remember) {
      try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* nothing to be done */ }
    }
    showTheme();
  }

  showTheme();

  lamp.addEventListener('click', function (e) {
    e.stopPropagation();                 // ...or the document listener would shut the card
    wearTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true);
  });

  var followSystem = function (e) {
    if (remembered() !== null) return;    // a choice has been made; stop following
    wearTheme(e.matches ? 'light' : 'dark', false);
  };
  if (systemLight.addEventListener) systemLight.addEventListener('change', followSystem);
  else if (systemLight.addListener) systemLight.addListener(followSystem);   // older Safari

  /* ---------- opening and shutting ---------- */

  var open = false;

  function show(next) {
    if (next === open) return;
    open = next;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('gear-on', open);
    // Focus follows the panel in and comes back out with it, so the card can be read and
    // dismissed without reaching for the mouse.
    if (open) panel.focus();
    else toggle.focus();
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();                 // ...or the document listener below would shut it again
    showLetters(false);                  // the two cards share one corner; only one at a time
    show(!open);
  });
  shut.addEventListener('click', function () { show(false); });

  // Anywhere outside puts it away. The panel stops its own clicks from reaching here, so
  // reading the card never closes it.
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { show(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) show(false);
  });

  panel.tabIndex = -1;

  /* ---------- the letters drawer ----------
     A–Z used to sit in the machine as a second keypad, on screen the whole time. It is
     reached for far less than the digits (see .letters button in style.css), so it is folded
     away behind its own toggle instead — the same show/hide/focus shape as the card above,
     aimed at a different button and a different panel. The two share one corner, so opening
     either closes the other rather than letting them stack. */

  var lettersToggle = document.getElementById('lettersToggle');
  var lettersPanel = document.getElementById('letters');
  var lettersOpen = false;

  function showLetters(next) {
    if (!lettersToggle || !lettersPanel) return;
    if (next === lettersOpen) return;
    lettersOpen = next;
    lettersPanel.hidden = !lettersOpen;
    lettersToggle.setAttribute('aria-expanded', String(lettersOpen));
    if (lettersOpen) lettersPanel.focus();
    else lettersToggle.focus();
  }

  if (lettersToggle && lettersPanel) {
    // Hidden from here, not from the HTML — if this script fails before reaching this line,
    // the grid is left showing exactly as it always did, not stuck behind a toggle nothing
    // can press.
    lettersPanel.hidden = true;
    lettersPanel.tabIndex = -1;

    lettersToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      show(false);
      showLetters(!lettersOpen);
    });

    // Nothing stops propagation inside the panel, on purpose: picking a letter is meant to
    // close the drawer behind it, the same as a click outside it would. script.js's own
    // handler on the letter (bound directly to the button) runs first and writes it into the
    // display; the click then bubbles up untouched to the document listener below, which
    // closes the drawer after — one press both types the letter and puts the keypad away.
    document.addEventListener('click', function () { showLetters(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lettersOpen) showLetters(false);
    });
  }

  /* ---------- the ring says what the cursor used to ----------
     cursor.js hides the system cursor across the whole page with one rule in motion.css:
     html.im-cursor *{cursor:none}. The drawn pair then stays whole and unbroken wherever the
     pointer goes, which is the point of having it — but it takes the readings with it. Grab
     on a block, pointer on a slot the keypad can be aimed at or on the two-pixel bar of a
     fraction, grabbing on the graph: those said what could be done here, and a dot says
     nothing at all.

     So the ring says it instead, in the display's own colours. Green is what a shift-drag
     would carry, the same green the ribbon lights in. Blue is what a ctrl-click would aim
     the keypad at, the same blue the slot lights in. The ring and the block under it change
     together and match, which is a plainer sentence than either was alone.

     None of it is worked out here. script.js has already decided all of it and written the
     answer onto the DOM — .block-carry is exactly what markCarry() found shift would lift,
     .picking and .choosing are exactly which key is down. Reading its answer back keeps one
     source for it; deciding again in a second file would only give the two of them room to
     drift apart. */

  var root = document.documentElement;
  var display = document.getElementById('display');
  var STATES = ['cur-grab', 'cur-aim', 'cur-carry', 'cur-press'];

  // Followed in the same order the stylesheet reads its own rules in, so the ring and the
  // block under it can never disagree about which one applies.
  function stateAt(target) {
    if (!target || !target.closest) return '';
    // Only the plot is dragged — the strips above and below it are read, not moved.
    if (target.closest('.graph-plot')) return 'grab';
    if (target.closest('#graph')) return '';

    var block = target.closest('#display .block');
    if (block === null) return '';
    // A value on show for a letter is an annotation, not a control — nothing to offer.
    if (block.classList.contains('block-hint')) return '';

    if (display.classList.contains('choosing')) {
      if (target.closest('.half-carry')) return 'carry';
      if (block.classList.contains('block-carry')) return 'carry';
      return '';
    }
    if (display.classList.contains('picking')) {
      if (target.closest('.bar, sup, .numerator, .denominator')) return 'aim';
      if (block.classList.contains('block-var')) return 'aim';
      if (block.classList.contains('block-aimable')) return 'aim';
      return '';                          // ctrl is down but this block takes nothing
    }
    if (block.classList.contains('block-equals') && block.classList.contains('active')) {
      return 'press';
    }
    return 'grab';
  }

  var worn = '';

  // The pieces are looked up each time rather than held onto: cursor.js builds them at
  // DOMContentLoaded, which is after this file has run, and builds them afresh whenever the
  // motion preference changes. Only a real change reaches the DOM, so this costs nothing on
  // the moves — which is most of them — that land on the same kind of thing as the last.
  function wear(state) {
    if (state === worn) return;
    worn = state;
    var pieces = document.querySelectorAll('.cur-dot, .cur-ring');
    for (var i = 0; i < pieces.length; i++) {
      pieces[i].classList.remove('cur-grab', 'cur-aim', 'cur-carry', 'cur-press');
      if (state !== '') pieces[i].classList.add('cur-' + state);
    }
  }

  var lastTarget = null;

  // mousemove, and on the document, rather than pointermove: pointermove runs before the
  // display's own handler has worked out what shift would carry, so it would read the
  // marking left over from wherever the pointer was a moment ago. A mousemove on the
  // document bubbles up after that handler has finished, and reads what it just wrote.
  document.addEventListener('mousemove', function (e) {
    lastTarget = e.target;
    wear(stateAt(e.target));
  }, { passive: true });

  // Holding ctrl or shift changes what the very same spot offers, without the pointer having
  // moved at all. This file is loaded after script.js, so these run after its own trackPicking
  // has set .picking and .choosing — the classes read here are already the new ones.
  function recheck() { wear(stateAt(lastTarget)); }
  window.addEventListener('keydown', recheck);
  window.addEventListener('keyup', recheck);
  window.addEventListener('blur', function () { wear(''); });

  /* A native drag swallows mousemove and pointermove both, leaving only dragover — and
     cursor.js follows IM.pointer, which is fed by pointermove. So through a drag the drawn
     pair would sit frozen where the drag began while the browser draws a cursor of its own
     somewhere else entirely. It steps out for the duration and comes back on the drop.
     Carrying a fraction by hand is followed by mousemove from the press onwards, and so is
     the graph, so neither goes through this. */
  document.addEventListener('dragstart', function () { root.classList.add('cursor-away'); });
  document.addEventListener('dragend', function () {
    root.classList.remove('cursor-away');
    wear(stateAt(lastTarget));
  });

  // The keys are the other thing on the page worth pointing at, so the ring swells over them
  // the way it does over the gear — [data-cursor] is how cursor.js is told, and marking them
  // from here covers the A-Z keys script.js builds without reaching into it.
  var keys = document.querySelectorAll('.grid button, .letters button');
  for (var k = 0; k < keys.length; k++) keys[k].dataset.cursor = '';

})(window);
