# Interactive Math

**ภาษา:** [ไทย](#ภาษาไทย) · [English](#english)

โครงงานคณิตศาสตร์แบบลงมือทำ — เว็บไซต์เรียนรู้ + เครื่องคิดเลขบล็อก + กระดานเรขาคณิต
Hands-on math learning project — a website, a drag-block calculator, and a geometry board.

🔗 **Live:** https://lpk37943-cyber.github.io/interactive-math/

---

## ภาษาไทย

### เกี่ยวกับโครงงาน

Interactive Math เป็นโครงงานคอมพิวเตอร์ของนักเรียนโรงเรียนเลยพิทยาคม สร้างเครื่องมือเรียนคณิตศาสตร์ที่ให้ผู้เรียนได้ลงมือทดลองจริง แทนที่จะอ่านทฤษฎีเฉยๆ

ทั้งหมดเขียนด้วย HTML/CSS/JavaScript ล้วน — **ไม่มี framework ไม่มี build step ไม่มี dependency ไม่ต้องติดตั้งอะไรเลย** ดับเบิลคลิกไฟล์ `.html` เปิดในเบราว์เซอร์ก็ใช้งานได้ทันที ข้อจำกัดนี้เป็นตัวกำหนดการตัดสินใจทางเทคนิคเกือบทุกอย่างในโค้ด (ดูหัวข้อ [กฎที่ห้ามแหก](#กฎที่ห้ามแหก))

รวมโค้ดประมาณ 17,000 บรรทัด แบ่งเป็นสามแอปที่แชร์ระบบพื้นฐานชุดเดียวกัน

---

### แผนผังโฟลเดอร์

```
งาน/
├── index.html                      หน้ารวมลิงก์ — หน้าเดียวจบ ไม่โหลด CSS/JS จาก assets/
├── README.md                       ไฟล์นี้
├── โครงงานเว็บแอปแก้สมาการ.pdf      เอกสารรูปเล่มของโครงงาน
│
├── assets/                         ของที่ทุกหน้าใช้ร่วมกัน
│   ├── favicon.svg                 โลโก้: วงเวียน (เรขาคณิต) ซ้อนบนเครื่องหมายเท่ากับ (สมการ)
│   ├── apple-touch-icon.png
│   ├── logo-512.png
│   └── og-image.jpg                ภาพตอนแชร์ลิงก์
│
├── หน้าเว็บ/                        เว็บไซต์หลัก
│   ├── index.html                  hero · หมวดหมู่ · Math Lab · ทีม · ติดต่อ
│   ├── topics.html                 คลังบทเรียน — ค้นหา กรอง เล่นวิดีโอ
│   └── assets/
│       ├── css/                    tokens · layout · motion · lessons
│       ├── js/                     core · theme · device · scroll · cursor · field · tilt
│       │                           reveal · hero · lab · lessons · data-lessons · tools · main
│       └── video/                  ที่วางไฟล์วิดีโอบทเรียน (+ README.txt วิธีเพิ่ม)
│
├── เครื่องคิดเลข/                    เครื่องคิดเลขบล็อก
│   ├── เครื่องคิดเลข-บล็อก_2.html
│   ├── script.js         (3,748)   บล็อก · พีชคณิต · ตัวแก้สมการ · กราฟ
│   ├── shortcuts.js        (555)   เฟืองมุมขวา · การ์ดปุ่มลัด · ปุ่มธีม/อุปกรณ์
│   ├── style.css         (1,312)
│   └── assets/                     css: tokens · motion   js: core · field · reveal · cursor · main
│
└── เรขาคณิต/                        กระดานเรขาคณิต
    ├── index.html          (586)   แถบบน · แถบเครื่องมือ · แถบโหมด · หน้าต่างวิธีใช้
    ├── app.js            (2,584)   ทั้งกระดาน canvas อยู่ในไฟล์เดียว
    └── assets/                     css: tokens · layout · motion · geo   js: core · theme · device · geo-ui · main
```

---

### เครื่องมือทั้งสาม

#### 🌐 เว็บไซต์หลัก — [`หน้าเว็บ/index.html`](หน้าเว็บ/index.html)

- **หน้าแรก** — hero พร้อมข้อความที่ทยอยโผล่ทีละคำ, การ์ดหมวดหมู่ (สมการ / เรขาคณิต), ข้อมูลทีม, ช่องทางติดต่อ
- **ปุ่ม "เริ่มใช้งาน"** เปิดหน้าต่างให้เลือกว่าจะไปเครื่องคิดเลขหรือกระดานเรขาคณิต
- **Math Lab** — ปรับค่าตัวแปรด้วย slider แล้วดูกราฟเปลี่ยนสด มี 5 ฟังก์ชัน: sine, cosine, tangent, parabola, linear
- **คลังบทเรียน** ([`topics.html`](หน้าเว็บ/topics.html)) — ค้นหาชื่อ กรองตามหมวด เล่นวิดีโอในหน้าต่างซ้อน รองรับทั้งไฟล์ `.mp4` ในเครื่องและ YouTube ภาพปกวาดให้อัตโนมัติตามสีประจำหมวดถ้าไม่ได้ใส่เอง บทเรียนที่ยังไม่มีวิดีโอขึ้นป้าย "เร็วๆ นี้" โดยหน้าเว็บยังทำงานครบ

#### 🧮 เครื่องคิดเลขบล็อก — [`เครื่องคิดเลข/`](เครื่องคิดเลข/เครื่องคิดเลข-บล็อก_2.html)

ทุกตัวเลขและเครื่องหมายบนจอเป็น **บล็อกที่ลากได้จริง** ไม่ใช่ข้อความ

| ทำอะไร | ได้อะไร |
|---|---|
| ลาก | ย้ายบล็อกไปวางตรงไหนก็ได้ |
| **Shift** + ชี้ | ไฮไลต์เขียว บอกว่าจะยกทั้ง "พจน์" ไหน |
| **Shift** + ลาก | ยกทั้งพจน์ — ข้าม `=` แล้วเครื่องหมายกลับข้างให้เอง |
| **Shift** + ลาก ที่ตัวส่วน | ยกตัวหารออกมา — ข้าม `=` แล้วกลายเป็นตัวคูณ |
| คลิกที่ `=` ที่สว่างอยู่ | คิดคำตอบ กดซ้ำเพื่อถอนออก |
| **Ctrl** + คลิก | เล็งคีย์แพดไปที่ช่องนั้น แล้วพิมพ์ทับได้เลย |
| **Ctrl** + คลิก ที่เส้นเศษส่วน / ที่ทศนิยม | สลับไปมาระหว่างเศษส่วนกับทศนิยม (0.5 ↔ ½) |
| **Ctrl** + คลิก ที่เลขชี้กำลัง / ที่วงเล็บ | คลี่ 9² เป็น (9×9) และยุบ (3×3) กลับเป็น 3² |
| **Ctrl** + คลิก ที่เลขถัดไป | รวมเป็นเลขเดียว (4, 5 → 45) |

**ตัวแก้สมการ** — ตัวแปรตัวเดียวหาคำตอบให้ (หารากพหุนามตรงๆ ถ้าอ่านเป็นพหุนามได้ ไม่ได้ก็ตกไปที่วิธีเชิงตัวเลข) ถ้ามีคำตอบหลายค่าจะแสดงเป็นป้าย "N คำตอบ" ที่กางรายการออกได้

**กราฟอัตโนมัติ** — พอมีตัวแปรสองตัวกราฟจะโผล่ขึ้นมาเอง หมุนล้อเมาส์เพื่อซูม ลากเพื่อเลื่อนกรอบ ดับเบิลคลิกกลับกรอบตั้งต้น ชี้ที่เส้นโค้งเพื่ออ่านค่าตรงจุดนั้น จุดตัดแกนถูกทำเครื่องหมายให้

รองรับเศษส่วน ราก เลขชี้กำลังซ้อนชั้น เปอร์เซ็นต์ วงเล็บ และตัวแปร A–Z (กดปุ่ม "ตัวแปร A–Z" เพื่อเปิดแผง) เฟืองมุมบนขวาเปิดการ์ดรวมทุกอย่างที่กดได้

#### 📐 กระดานเรขาคณิต — [`เรขาคณิต/`](เรขาคณิต/index.html)

กระดาน canvas สำหรับวาดจุด เส้น และรูปทรงอย่างอิสระ — **10 พิกเซล = 1 เซนติเมตร**, สูงสุด 100 จุดต่อกระดาน

| ปุ่ม | ทำอะไร |
|---|---|
| **Ctrl** (ค้าง) | เปิดแถบเครื่องมือด้านล่าง |
| **Shift** (ค้าง) | แสดงความยาว พื้นที่ และมุมของสิ่งที่ชี้อยู่ทันที |
| **1** | วางจุดตรงตำแหน่งเมาส์ (ถ้าชี้ที่เส้นโค้งอยู่จะเกาะลงบนเส้นนั้น) |
| **Delete** / **Backspace** | ลบสิ่งที่เลือก ถ้าไม่ได้เลือกอะไรก็ลบสิ่งที่ชี้อยู่ |
| **X** / **Y** | เปิด-ปิดตารางเส้นนอน / เส้นตั้ง |
| **Esc** | เลิกใช้เครื่องมือและปิดตารางทั้งหมด |
| **Ctrl+Z** · **Ctrl+C** · **Ctrl+V** | ย้อนกลับ (ลึก 100 ขั้น) · คัดลอก · วาง |
| **Shift+Ctrl+คลิก** | กรอกค่าทับ — รูปจะถูกแก้ให้ได้ค่าตามที่กรอก |
| ลากบนที่ว่าง · ลากที่จุด · ที่จับวงกลม | ลากกรอบเลือกหลายชิ้น · ย้าย · หมุน |

**สิ่งที่กระดานทำให้เอง:**
- หา **รูปปิด** จากเส้นที่ลากไว้ (planar face traversal) — วาดสามเส้นเป็นสามเหลี่ยม มันรู้เองว่านั่นคือรูปที่มีพื้นที่
- **จุดที่ลากมาทับกันยุบรวมเป็นจุดเดียว** — ต่อรูปหลายชิ้นเข้าด้วยกันได้โดยไม่ต้องเล็งให้ตรงเป๊ะ
- **เส้นที่ตัดกันถูกหั่นตรงจุดตัด** ให้อัตโนมัติ
- วงกลมที่ถูกจุดดัดจะกลายเป็นเส้นโค้งเรียบ (spline)

**แถบเครื่องมือ:** แบ่งด้าน/แบ่งวงกลมเป็น n ส่วน · วาดรูป (วงกลม/วงรี, สามเหลี่ยม, สามเหลี่ยมมุมฉาก, สี่เหลี่ยม) · ขยาย-ย่อสิ่งที่เลือกด้วยตัวคูณ · ตั้งระยะห่างตารางเส้น

ปุ่ม "เริ่มจากตัวอย่าง" (สามเหลี่ยม/สี่เหลี่ยม/วงกลม) โผล่เฉพาะตอนกระดาษยังว่าง

---

### วิธีเปิดใช้งาน

เปิดผ่าน [ลิงก์ GitHub Pages](https://lpk37943-cyber.github.io/interactive-math/) หรือ clone แล้วดับเบิลคลิก `index.html` เปิดในเบราว์เซอร์ตรงๆ ก็ได้ — ไม่ต้องมีเซิร์ฟเวอร์ ไม่ต้องต่ออินเทอร์เน็ต

สิ่งเดียวที่ต้องใช้เน็ตคือฟอนต์จาก Google Fonts และวิดีโอที่ฝังจาก YouTube ถ้าไม่มีเน็ต ฟอนต์จะตกไปใช้ฟอนต์ของเครื่อง (`Leelawadee UI` / `Noto Sans Thai`) และทุกอย่างที่เหลือยังทำงานเหมือนเดิม

### คอมพิวเตอร์หรือมือถือ

หน้าแรกถามว่าใช้อุปกรณ์อะไร เดาให้ก่อนแล้วเลือกทับได้ **จำไว้ใช้ทุกหน้า** เปลี่ยนได้ตลอดจากปุ่มไอคอนจอ/มือถือที่ทุกหน้ามี

- **คอมพิวเตอร์** — เหมือนเดิมทุกพิกเซล ไม่ว่าจอจะแคบแค่ไหน
- **มือถือ** — จัดหน้าใหม่ให้แตะง่าย ตัดเอฟเฟกต์ที่ต้องมีเมาส์ (การ์ดเอียงตามเคอร์เซอร์, เคอร์เซอร์วาดเอง, อนุภาคพื้นหลัง, magnetic, parallax) และเพิ่มปุ่มแทนคีย์ลัด:
  - **เครื่องคิดเลข** ได้แถบโหมด `ปกติ / ยกพจน์ / แก้ค่า` แตะบล็อกเพื่อยกค้างไว้แล้วแตะที่หมายเพื่อวาง และปุ่ม `+ − ⟲` บนกราฟแทนล้อเมาส์
  - **กระดานเรขาคณิต** ได้แถบโหมด `วางจุด / เลือก / วัดค่า / แก้ค่า` พร้อมปุ่ม ลบ ย้อนกลับ คัดลอก วาง และตาราง — ระยะจับจุด/เส้นถูกขยายให้นิ้วด้วย

### ธีมสว่าง / มืด

ปุ่มดวงอาทิตย์-พระจันทร์อยู่ทุกหน้า ตัวเลือกที่กดเองถูกแชร์ข้ามทุกหน้า (คีย์ `im-theme`) แต่ **ค่าเริ่มต้นเมื่อยังไม่เคยเลือกเป็นของใครของมันโดยตั้งใจ** — เว็บหลักเริ่มมืด, กระดานเรขาคณิตเริ่มสว่างเพราะกระดาษต้องขาว, เครื่องคิดเลขตามระบบปฏิบัติการ

---

### สถาปัตยกรรมของโค้ด

ทั้งสามแอปแชร์ระบบพื้นฐานตัวเดียวกัน ชื่อ `IM` (`assets/js/core.js`)

**`core.js` ให้อะไรบ้าง**

| ของ | หน้าที่ |
|---|---|
| `IM.ticker` | `requestAnimationFrame` **ตัวเดียวของทั้งหน้า** ทุกโมดูลต้อง subscribe เข้ามา ห้ามเปิดของตัวเอง หยุดเองเมื่อไม่มีใครใช้หรือแท็บถูกซ่อน |
| `IM.pointer` | ผูก `pointermove` ที่ document **ครั้งเดียว** cursor/tilt/field อ่านค่าจากที่นี่ทั้งหมด มีทั้งตำแหน่งดิบ ตำแหน่งที่หน่วงแล้ว และความเร็ว |
| `IM.damp(a,b,λ,dt)` | หน่วงแบบไม่ผูกกับ frame rate — สูตร `a += (b-a)*0.1` ที่เขียนกันบ่อยให้ผลต่างกัน 2.4 เท่าระหว่างจอ 60Hz กับ 144Hz |
| `IM.docPos(el)` | ตำแหน่งจริงในหน้า โดยไม่สนใจ CSS transform (`getBoundingClientRect` รวมผลของ transform ทำให้วัดเพี้ยนตอน `.reveal` ยัง animate อยู่) |
| `IM.motionOK` / `IM.isCoarse` | เคารพ `prefers-reduced-motion` และรู้ว่าเป็นอุปกรณ์สัมผัสไหม |
| `IM.register` / `IM.modules` | ทุกไฟล์แค่ลงทะเบียนตัวเอง `main.js` เป็นตัวเรียกจริงตัวเดียว ตามลำดับที่กำหนดไว้ โมดูลเดียวพังไม่ทำให้ทั้งหน้าตาย |
| `IM.theme` / `IM.device` | อ่านค่าที่ inline script ใน `<head>` ตั้งไว้แล้ว **ไม่ใช่ตัวตัดสินใจเอง** |
| `IM.mouseFx()` | จุดเดียวที่ตอบว่า "ควรเปิดเอฟเฟกต์ที่ต้องมีเมาส์ไหม" — เช็ค `isCoarse` และโหมดอุปกรณ์คู่กันเสมอ |

**โมดูลโมชั่นของเว็บหลัก** — `scroll.js` (smooth scroll เอง) · `cursor.js` (เคอร์เซอร์วาดเอง) · `field.js` (อนุภาคพื้นหลัง) · `tilt.js` (การ์ดเอียงตามเมาส์) · `reveal.js` (ข้อความทยอยโผล่) · `hero.js`

**สถานะที่แชร์ข้ามหน้าผ่าน `localStorage`** มีสองคีย์เท่านั้น: `im-theme` (`light`/`dark`) และ `im-device` (`mobile`/`desktop`) ทั้งคู่ถูกอ่านโดย inline script ใน `<head>` ของทุกหน้า

---

### กฎที่ห้ามแหก

ข้อจำกัดพวกนี้มาจากการที่โครงงานต้องเปิดจาก `file://` ได้โดยไม่มีเซิร์ฟเวอร์ ทุกข้อมีคอมเมนต์กำกับไว้ในโค้ดแล้ว

1. **`<script>` ธรรมดาเท่านั้น ห้าม `type="module"`** — ES module โดน CORS block บน `file://` เพราะ origin เป็น `null`
2. **`data-lessons.js` ต้องเป็น `.js` ไม่ใช่ `.json`** — `fetch()` โดนบล็อกด้วยเหตุผลเดียวกัน จึงประกาศเป็นตัวแปร global แทน
3. **`core.js` มีสามสำเนา ต้องเหมือนกันทุกตัวอักษร** — แต่ละแอปโหลดจากโฟลเดอร์ตัวเอง แชร์โฟลเดอร์เดียวกันไม่ได้บน `file://` แก้ที่ไหนต้องคัดลอกให้ครบทั้งสาม ตรวจด้วย:
   ```bash
   diff หน้าเว็บ/assets/js/core.js เครื่องคิดเลข/assets/js/core.js
   diff หน้าเว็บ/assets/js/core.js เรขาคณิต/assets/js/core.js
   ```
   (`cursor.js` `field.js` `reveal.js` และ `tokens.css`/`layout.css` ก็ถูกคัดลอกแบบเดียวกัน)
4. **ลำดับสคริปต์:** `core.js` ต้องมาก่อนเสมอ `main.js` ต้องอยู่ท้ายสุดเสมอ
5. **สคริปต์ธีมและโหมดอุปกรณ์ต้องเป็น inline อยู่ใน `<head>` ก่อน `<link>` ทุกอัน** — ไม่งั้นหน้าจะถูกวาดด้วยธีม/เลย์เอาต์ผิดหนึ่งเฟรมแล้วกระพริบ
6. **กฎ CSS ของโหมดมือถือ key จาก `[data-device="mobile"]` เท่านั้น ห้ามใช้ `@media`** — โหมดคอมจึงไม่ match กฎใหม่สักข้อ ได้หน้าตาเดิมเป๊ะไม่ว่าจอจะแคบแค่ไหน
7. **หน้าเครื่องคิดเลขห้ามโหลด `tilt.js`** — มันเขียน `transform` ทุกเฟรม ทำให้ `getBoundingClientRect` ใน `script.js` วัดตำแหน่งเพี้ยน การลากบล็อกจะไม่ตรง
8. **`og:image` ต้องเป็น URL เต็ม** — ตัวขูดข้อมูลของ LINE/Facebook อ่าน path แบบสัมพัทธ์ไม่ออก ที่อยู่นี้ผูกกับ GitHub Pages ถ้าย้ายโฮสต์ต้องแก้ทั้งสี่หน้า
9. **ข้อความไทยหั่นทีละ "คำ" ด้วย `Intl.Segmenter('th')` เท่านั้น** — หั่นทีละตัวอักษรจะทำให้สระและวรรณยุกต์หลุดจากพยัญชนะ
10. **`tokens.css` ของเครื่องคิดเลขต้องโหลดก่อน `style.css`** — ไม่งั้น `*{margin:0;padding:0}` จะล้าง padding ของปุ่มจนคีย์แพดแบน
11. **`id` และ `data-*` ในแถบเครื่องมือ/แถบโหมด ห้ามเปลี่ยนชื่อ** — `app.js` และ `script.js` อ้างอิงอยู่
12. **`lab.js` เป็น FROZEN ZONE** — ยกมาจาก `index_1.html` เดิมแบบคัดลอกตรงๆ ตรรกะคณิตและการวาดกราฟห้ามแก้

---

### วิธีเพิ่มบทเรียนวิดีโอ

แก้ไฟล์เดียวคือ [`หน้าเว็บ/assets/js/data-lessons.js`](หน้าเว็บ/assets/js/data-lessons.js) (คำอธิบายเต็มอยู่ใน [`หน้าเว็บ/assets/video/README.txt`](หน้าเว็บ/assets/video/README.txt))

**ใช้ไฟล์ในเครื่อง** — วางไฟล์ `.mp4` (H.264 + AAC) ไว้ที่ `หน้าเว็บ/assets/video/` แล้วใส่ชื่อไฟล์:

```js
{
  id: 'eq-02', cat: 'equation', ep: 2,
  title: 'สมการเชิงเส้นตัวแปรเดียว',
  desc: 'หลักการย้ายข้าง การแก้สมการทีละขั้น',
  duration: '15:20',
  video: 'assets/video/eq-02.mp4', youtube: '', poster: ''
}
```

**ใช้ YouTube** — เอาเฉพาะรหัสคลิปจาก URL (`youtube.com/watch?v=ABC123xyz` → `ABC123xyz`) ใส่ในช่อง `youtube` แทน

เว้นทั้งสองช่องว่างไว้ = บทเรียนขึ้นป้าย "เร็วๆ นี้" กดดูไม่ได้ แต่หน้าเว็บยังแสดงผลครบ · ช่อง `poster` เว้นว่างได้ ระบบวาดภาพปกให้เองตามสีประจำหมวด · ถ้าเพิ่มหมวดใหม่ ต้องเพิ่มใน `categories` และเพิ่มรูปแบบภาพปกใน `lessons.js` → `autoPoster` ด้วย

---

### ทีมผู้จัดทำ

นักเรียนโรงเรียนเลยพิทยาคม

| | ชื่อ | หน้าที่ |
|---|---|---|
| 01 | นายเจิน ชง กวา | Developer / Project Manager — วางแผนและพัฒนาเว็บไซต์ |
| 02 | นายกิตติภณ พิมพะบุตร | Product Owner — คิดและตัดสินใจเรื่องฟีเจอร์ |
| 03 | นางสาวธัญธร อังวราวงศ์ | Tester / Document Manager — ทดสอบระบบและดำเนินเรื่องเอกสาร |

---
---

## English

### About

Interactive Math is a computer-science school project by students at Loei Pittayakhom School, building tools that let learners experiment with math hands-on instead of just reading theory.

Everything is plain HTML/CSS/JavaScript — **no framework, no build step, no dependencies, nothing to install.** Double-click an `.html` file and it works. That single constraint drives nearly every technical decision in the code (see [Rules you can't break](#rules-you-cant-break)).

About 17,000 lines across three apps that share one common runtime.

---

### Folder map

```
งาน/  (= "work")
├── index.html                      Link hub — self-contained, loads no CSS/JS from assets/
├── README.md                       This file
├── โครงงานเว็บแอปแก้สมาการ.pdf      The written project report
│
├── assets/                         Shared by every page
│   ├── favicon.svg                 Logo: a compass (geometry) over an equals sign (equations)
│   ├── apple-touch-icon.png
│   ├── logo-512.png
│   └── og-image.jpg                Link-share image
│
├── หน้าเว็บ/                        "Website" — the main site
│   ├── index.html                  Hero · topics · Math Lab · team · contact
│   ├── topics.html                 Lesson library — search, filter, play
│   └── assets/
│       ├── css/                    tokens · layout · motion · lessons
│       ├── js/                     core · theme · device · scroll · cursor · field · tilt
│       │                           reveal · hero · lab · lessons · data-lessons · tools · main
│       └── video/                  Where lesson video files go (+ README.txt)
│
├── เครื่องคิดเลข/                    "Calculator"
│   ├── เครื่องคิดเลข-บล็อก_2.html
│   ├── script.js         (3,748)   Blocks · algebra · equation solver · graph
│   ├── shortcuts.js        (555)   Corner gear · shortcut card · theme/device buttons
│   ├── style.css         (1,312)
│   └── assets/                     css: tokens · motion   js: core · field · reveal · cursor · main
│
└── เรขาคณิต/                        "Geometry"
    ├── index.html          (586)   Top bar · toolbar · mode bar · help modal
    ├── app.js            (2,584)   The whole canvas board in one file
    └── assets/                     css: tokens · layout · motion · geo   js: core · theme · device · geo-ui · main
```

---

### The three tools

#### 🌐 Main site — [`หน้าเว็บ/index.html`](หน้าเว็บ/index.html)

- **Home** — hero with word-by-word reveal, topic cards (equations / geometry), team, contact
- **"Get started"** opens a chooser for the calculator or the geometry board
- **Math Lab** — drag sliders and watch the graph respond live, across 5 functions: sine, cosine, tangent, parabola, linear
- **Lesson library** ([`topics.html`](หน้าเว็บ/topics.html)) — search by title, filter by category, play in a modal. Supports both local `.mp4` files and YouTube. Cover art is drawn automatically from the category colour if none is supplied; lessons without a video show a "coming soon" badge and the page still works.

#### 🧮 Block calculator — [`เครื่องคิดเลข/`](เครื่องคิดเลข/เครื่องคิดเลข-บล็อก_2.html)

Every digit and operator on the display is a **real draggable block**, not text.

| Do this | Get this |
|---|---|
| Drag | Move a block anywhere |
| **Shift** + hover | Green highlight showing which whole *term* would be lifted |
| **Shift** + drag | Carry the term — crossing the `=` flips its sign automatically |
| **Shift** + drag on a denominator | Lift the divisor out — crossing the `=` it becomes a multiplier |
| Click the lit `=` | Solve; click again to undo |
| **Ctrl** + click | Aim the keypad at that slot, then type straight over it |
| **Ctrl** + click a fraction bar / a decimal | Swap between fraction and decimal (0.5 ↔ ½) |
| **Ctrl** + click an exponent / a bracket | Expand 9² into (9×9), collapse (3×3) back into 3² |
| **Ctrl** + click the next digit | Merge into one number (4, 5 → 45) |

**Solver** — one variable and it finds the answer (polynomial roots directly when the equation reads as a polynomial, falling back to a numeric method when it doesn't). Several answers show as an "N answers" label that drops the full list down.

**Automatic graph** — a second variable makes the plot appear on its own. Wheel to zoom, drag to pan, double-click to reset the frame, hover the curve to read a point off it. Axis crossings are marked.

Handles fractions, roots, stacked exponents, percentages, brackets, and A–Z variables (via the "ตัวแปร A–Z" sheet). The corner gear opens a card listing everything that can be pressed.

#### 📐 Geometry board — [`เรขาคณิต/`](เรขาคณิต/index.html)

A canvas board for free-form points, lines, and shapes — **10 pixels = 1 cm**, up to 100 points per board.

| Key | What it does |
|---|---|
| **Ctrl** (hold) | Open the bottom toolbar |
| **Shift** (hold) | Show length, area, and angle of whatever is under the pointer, live |
| **1** | Place a point at the pointer (snaps onto a curve if you're pointing at one) |
| **Delete** / **Backspace** | Delete the selection, or whatever is under the pointer |
| **X** / **Y** | Toggle horizontal / vertical rulers |
| **Esc** | Drop the current tool and all rulers |
| **Ctrl+Z** · **Ctrl+C** · **Ctrl+V** | Undo (100 deep) · copy · paste |
| **Shift+Ctrl+click** | Type a value over a measurement — the shape is re-solved to match |
| Drag empty space · drag a point · rotate handle | Marquee select · move · rotate |

**What the board does on its own:**
- Finds **closed shapes** from whatever you've drawn (planar face traversal) — draw three lines and it knows that's a triangle with an area
- **Points dragged onto each other merge into one**, so joining shapes needs no precise aim
- **Crossing lines are split at the intersection** automatically
- Circles bent by points become smooth splines

**Toolbar:** bisect an edge or circle into *n* parts · draw shapes (circle/ellipse, triangle, right triangle, rectangle) · scale the selection by a multiplier · set ruler spacing.

Starter examples (triangle / square / circle) appear only while the board is still empty.

---

### Usage

Open the [GitHub Pages link](https://lpk37943-cyber.github.io/interactive-math/), or clone and double-click `index.html` — no server, no internet connection required.

The only things that need the network are Google Fonts and YouTube-hosted lesson videos. Offline, fonts fall back to the system stack (`Leelawadee UI` / `Noto Sans Thai`) and everything else behaves identically.

### Computer or phone

The landing page asks which one you're on — it guesses first, you can override, and the answer is **remembered across every page**. Switch any time from the monitor/phone button each page carries.

- **Computer** — pixel-for-pixel as it was, no matter how narrow the window gets
- **Phone** — one-column layout with finger-sized targets, the mouse-only effects turned off (cursor-following tilt, the drawn cursor, the particle field, magnetic buttons, parallax), and buttons where the keyboard shortcuts were:
  - the **calculator** gains a `normal / lift-term / edit` mode bar, tap-to-lift-then-tap-to-place, and `+ − ⟲` buttons on the plot in place of the wheel
  - the **geometry board** gains `place / select / measure / edit` modes plus delete, undo, copy, paste and the rulers — and its hit radii are widened for fingers

### Light / dark theme

A sun-moon button sits on every page. The choice you make is shared across all pages (`im-theme`), but **the default before you choose is deliberately per-page**: the main site starts dark, the geometry board starts light because paper should be white, and the calculator follows the OS.

---

### Code architecture

All three apps share one runtime, `IM` (`assets/js/core.js`).

**What `core.js` provides**

| Thing | Job |
|---|---|
| `IM.ticker` | The **single** `requestAnimationFrame` for the page. Every module subscribes here; none may start its own. Stops itself when nobody needs it or the tab is hidden. |
| `IM.pointer` | Binds `pointermove` on the document **once**. cursor/tilt/field all read from here. Carries raw position, damped position, and velocity. |
| `IM.damp(a,b,λ,dt)` | Frame-rate-independent damping — the commonly written `a += (b-a)*0.1` is off by 2.4× between a 60Hz and a 144Hz display. |
| `IM.docPos(el)` | True page position ignoring CSS transforms (`getBoundingClientRect` includes them, so it measures wrong while `.reveal` is still animating). |
| `IM.motionOK` / `IM.isCoarse` | Respects `prefers-reduced-motion`; knows whether this is a touch device. |
| `IM.register` / `IM.modules` | Every file just registers itself; `main.js` is the only thing that calls them, in a fixed order. One broken module never kills the page. |
| `IM.theme` / `IM.device` | **Read** what the inline `<head>` script already set — they never decide it themselves. |
| `IM.mouseFx()` | The one place that answers "should mouse-only effects run?" — always checking `isCoarse` and device mode together. |

**Main-site motion modules** — `scroll.js` (own smooth scroll) · `cursor.js` (drawn cursor) · `field.js` (particle backdrop) · `tilt.js` (cards tilting toward the mouse) · `reveal.js` (text revealing in) · `hero.js`

**Cross-page state** lives in exactly two `localStorage` keys: `im-theme` (`light`/`dark`) and `im-device` (`mobile`/`desktop`), both read by an inline script in every page's `<head>`.

---

### Rules you can't break

These follow from the project having to open over `file://` with no server. Every one is commented at its site in the code.

1. **Classic `<script>` only — never `type="module"`.** ES modules are CORS-blocked on `file://`, where the origin is `null`.
2. **`data-lessons.js` must stay `.js`, not `.json`.** `fetch()` is blocked for the same reason, so the data is declared as a global instead.
3. **`core.js` exists in three copies that must stay byte-identical.** Each app loads it from its own folder because a shared folder can't work over `file://`. Edit one, copy to all three; verify with:
   ```bash
   diff หน้าเว็บ/assets/js/core.js เครื่องคิดเลข/assets/js/core.js
   diff หน้าเว็บ/assets/js/core.js เรขาคณิต/assets/js/core.js
   ```
   (`cursor.js`, `field.js`, `reveal.js` and `tokens.css`/`layout.css` are duplicated the same way.)
4. **Script order:** `core.js` always first, `main.js` always last.
5. **The theme and device scripts must stay inline in `<head>`, before every `<link>`** — otherwise the page paints one frame with the wrong theme or layout and visibly flashes.
6. **Mobile CSS keys off `[data-device="mobile"]`, never `@media`** — so desktop mode matches none of the new rules and stays identical however narrow the window is.
7. **The calculator page must not load `tilt.js`** — it writes `transform` every frame, which throws off the `getBoundingClientRect` calls `script.js` uses to place dragged blocks.
8. **`og:image` must be an absolute URL.** LINE/Facebook scrapers can't resolve relative paths. The address is tied to GitHub Pages — moving hosts means editing all four pages.
9. **Thai text is split by *word* via `Intl.Segmenter('th')` only** — splitting per character detaches vowels and tone marks from their consonants.
10. **The calculator's `tokens.css` must load before `style.css`**, or its `*{margin:0;padding:0}` flattens the keypad's button padding.
11. **Don't rename `id` or `data-*` attributes** in the toolbars and mode bars — `app.js` and `script.js` reference them.
12. **`lab.js` is a frozen zone** — lifted verbatim from the original `index_1.html`. Its math and graph drawing must not be touched.

---

### Adding a lesson video

One file to edit: [`หน้าเว็บ/assets/js/data-lessons.js`](หน้าเว็บ/assets/js/data-lessons.js) (full walkthrough in [`หน้าเว็บ/assets/video/README.txt`](หน้าเว็บ/assets/video/README.txt))

**Local file** — drop an `.mp4` (H.264 + AAC) into `หน้าเว็บ/assets/video/` and name it:

```js
{
  id: 'eq-02', cat: 'equation', ep: 2,
  title: 'สมการเชิงเส้นตัวแปรเดียว',
  desc: 'หลักการย้ายข้าง การแก้สมการทีละขั้น',
  duration: '15:20',
  video: 'assets/video/eq-02.mp4', youtube: '', poster: ''
}
```

**YouTube** — take just the clip id from the URL (`youtube.com/watch?v=ABC123xyz` → `ABC123xyz`) and put it in `youtube` instead.

Leave both blank and the lesson shows a "coming soon" badge and can't be opened, while the page still renders fully. `poster` is optional — cover art is drawn from the category colour. Adding a new category means adding it to `categories` *and* adding a cover-art pattern in `lessons.js` → `autoPoster`.

---

### Team

Students at Loei Pittayakhom School.

| | Name | Role |
|---|---|---|
| 01 | นายเจิน ชง กวา | Developer / Project Manager — planning and building the site |
| 02 | นายกิตติภณ พิมพะบุตร | Product Owner — deciding what gets built |
| 03 | นางสาวธัญธร อังวราวงศ์ | Tester / Document Manager — testing and documentation |
