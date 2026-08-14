# Interactive Math

**ภาษา:** [ไทย](#ภาษาไทย) · [English](#english)

โครงงานคณิตศาสตร์แบบลงมือทำ — เว็บไซต์เรียนรู้ + เครื่องคิดเลขบล็อก + กระดานเรขาคณิต
Hands-on math learning project — a website, a drag-block calculator, and a geometry board.

🔗 **Live:** https://lpk37943-cyber.github.io/interactive-math/

---

## ภาษาไทย

### เกี่ยวกับโครงงาน

Interactive Math เป็นโครงงานคอมพิวเตอร์ของนักเรียนโรงเรียนเลยพิทยาคม สร้างเครื่องมือเรียนคณิตศาสตร์ที่ให้ผู้เรียนได้ลงมือทดลองจริง แทนที่จะอ่านทฤษฎีเฉยๆ ทั้งหมดเขียนด้วย HTML/CSS/JavaScript ล้วนๆ ไม่มี framework ไม่ต้องติดตั้งหรือ build อะไร เปิดไฟล์ตรงๆ ก็ใช้งานได้ทันที

### ส่วนประกอบ

| ส่วน | คืออะไร |
|---|---|
| 🌐 [`หน้าเว็บ/`](หน้าเว็บ/index.html) | หน้าเว็บหลัก มี Math Lab ให้ปรับค่ากราฟฟังก์ชันสด (sine/cosine/parabola ฯลฯ) และคลังบทเรียนวิดีโอที่ค้นหา/กรองตามหมวดได้ |
| 🧮 [`เครื่องคิดเลข/`](เครื่องคิดเลข/เครื่องคิดเลข-บล็อก_2.html) | เครื่องคิดเลขที่ทุกตัวเลข/เครื่องหมายเป็นบล็อกลากได้จริง — Shift ลากยกทั้งพจน์ข้าม "=" แล้วกลับเครื่องหมายให้เอง, Ctrl คลิกแก้ค่าในบล็อก, แก้สมการและวาดกราฟให้อัตโนมัติ |
| 📐 [`เรขาคณิต/`](เรขาคณิต/index.html) | กระดานวาดจุด-เส้น-รูปทรงอิสระ ระบบตรวจจับรูปปิดเองจากกราฟที่ลาก กด Shift ค้างดูมุม/ความยาว/พื้นที่ได้ทันที |
| 📄 [`โครงงานเว็บแอปแก้สมาการ.pdf`](โครงงานเว็บแอปแก้สมาการ.pdf) | เอกสารรูปเล่มของโครงงาน |

### วิธีใช้งาน

เปิดผ่านลิงก์ GitHub Pages ด้านบนได้เลย หรือจะ clone แล้วดับเบิลคลิกไฟล์ `.html` เปิดในเบราว์เซอร์โดยตรงก็ได้ ไม่ต้องมีเซิร์ฟเวอร์หรือเชื่อมต่ออินเทอร์เน็ต (ยกเว้นฟอนต์และวิดีโอ YouTube ที่ต้องใช้เน็ต)

### คอมพิวเตอร์หรือมือถือ

หน้าแรกจะถามว่าใช้อุปกรณ์อะไร เดาให้ก่อนแล้วเลือกทับได้ จำไว้ใช้ทุกหน้า เปลี่ยนได้ตลอดจากปุ่มไอคอนจอ/มือถือในทุกหน้า

- **คอมพิวเตอร์** — เหมือนเดิมทุกอย่าง
- **มือถือ** — จัดหน้าใหม่ให้แตะง่าย ตัดเอฟเฟกต์ที่ต้องมีเมาส์ (การ์ดเอียงตามเคอร์เซอร์ เคอร์เซอร์วาดเอง อนุภาคพื้นหลัง) และเพิ่มปุ่มแทนคีย์ลัด: เครื่องคิดเลขได้แถบโหมด ปกติ/ยกพจน์/แก้ค่า ส่วนกระดานเรขาคณิตได้แถบปุ่มวางจุด เลือก วัดค่า แก้ค่า พร้อมปุ่มลบ ย้อนกลับ คัดลอก วาง และตาราง

### ทีมผู้จัดทำ

นักเรียนโรงเรียนเลยพิทยาคม 3 คน — Developer/Project Manager, Product Owner, Tester/Document Manager

---

## English

### About

Interactive Math is a computer science school project by students at Loei Pittayakhom School, building tools that let learners experiment with math hands-on instead of just reading theory. Everything is plain HTML/CSS/JavaScript — no framework, no build step, no install. Open a file and it works.

### What's inside

| Part | What it does |
|---|---|
| 🌐 [`หน้าเว็บ/`](หน้าเว็บ/index.html) | The main site — a Math Lab with live-adjustable function graphs (sine/cosine/parabola, etc.) and a searchable/filterable video lesson library |
| 🧮 [`เครื่องคิดเลข/`](เครื่องคิดเลข/เครื่องคิดเลข-บล็อก_2.html) | A calculator where every digit and operator is a real draggable block — Shift-drag lifts a whole term across "=" and flips its sign automatically, Ctrl-click edits a value in place, and it solves equations and plots graphs on its own |
| 📐 [`เรขาคณิต/`](เรขาคณิต/index.html) | A free-form board for points, lines, and shapes — it detects closed polygons from whatever you draw, and holding Shift shows angles, lengths, and area live |
| 📄 [`โครงงานเว็บแอปแก้สมาการ.pdf`](โครงงานเว็บแอปแก้สมาการ.pdf) | The written project report |

### Usage

Open it via the GitHub Pages link above, or clone the repo and open any `.html` file directly in a browser — no server or internet connection required (except for web fonts and YouTube-hosted lesson videos).

### Computer or phone

The landing page asks which one you're on — it guesses first, you can override, and the answer is remembered across every page. Switch any time from the monitor/phone button each page carries.

- **Computer** — exactly as it was.
- **Phone** — one-column layout with finger-sized targets, the mouse-only effects turned off (cursor-following card tilt, the drawn cursor, the particle field), and buttons where the keyboard shortcuts were: the calculator gains a normal / lift-term / edit mode bar, and the geometry board gains place, select, measure and edit modes plus delete, undo, copy, paste and the rulers.

### Team

Three students at Loei Pittayakhom School — Developer/Project Manager, Product Owner, Tester/Document Manager.
