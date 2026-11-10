# Handoff: claude-image-gen

สถานะ: **สร้างเสร็จและเผยแพร่แล้ว** (2026-11-10)
แผนลงมือทำ: `docs/superpowers/plans/2026-11-10-agy-image-plugin.md`

## วัตถุประสงค์

ให้ผู้ใช้ Claude Code สั่งสร้างหรือแก้ภาพจากในแชตได้ โดย Claude ส่งคำสั่งไปให้ `agy` CLI
(Google Antigravity, ใช้โควตา subscription ของผู้ใช้เอง) แล้วนำไฟล์ภาพกลับมาแสดง/ให้ดาวน์โหลดใน Claude
เผยแพร่เป็น GitHub repo ให้ผู้อื่นติดตั้งใช้ได้

## สิ่งที่ตกลงแล้ว

| เรื่อง | ข้อตกลง |
|---|---|
| รูปแบบ | Claude Code plugin ที่มี `SKILL.md` ไฟล์เดียว ไม่มี script ไม่มี MCP server |
| คำสั่ง | `/agy-image:agy-image` (ยืนยันแล้วจากการโหลด plugin จริง) |
| รายการ model | ดึงสดจาก `agy models` ทุกครั้ง ไม่ฝังรายชื่อในโค้ด ส่งค่าที่เลือกเป็น `--model` |
| ถาม model | ถามทุกครั้งก่อนส่ง ไม่จำค่าเดิม |
| วิธีเลือก | กล่องตัวเลือก 2 กล่อง: (1) ค่าย + สัดส่วนภาพ (2) รุ่น + ระดับ low/medium/high ขั้นที่มีตัวเลือกเดียวให้ข้าม |
| สัดส่วนภาพ | ตัวเลือก 1:1, 16:9 แนวนอน, 9:16 แนวตั้ง, 4:3 และพิมพ์ค่าอื่นเองได้ โหมดแก้ภาพไม่ถาม (คงสัดส่วนเดิม) |
| แก้ภาพ | รองรับ: ผู้ใช้ให้ path ภาพต้นฉบับ + บอกสิ่งที่จะเปลี่ยน |
| จำนวนภาพ | ปกติ 1 ภาพต่อคำสั่ง ถ้าผู้ใช้ขอหลายภาพให้ทำตามจำนวนที่ขอ |
| prompt | Claude ขัดเกลาเป็นภาษาอังกฤษ และแสดง prompt สุดท้ายให้เห็นก่อนถามเลือก model |
| การรัน | เบื้องหลังด้วยเครื่องมือ shell ปกติ (ใช้ได้ทั้ง CLI และ desktop app) |
| การเชื่อมต่อ | login ของ `agy` เท่านั้น skill ตรวจด้วย `agy models` ถ้าไม่ผ่านให้หยุดและบอกผู้ใช้ไป login เอง plugin ไม่แตะ credential |
| ปลายทางไฟล์ | คัดลอกไป `./generated-images/` ตั้งชื่อตามวันเวลา ไม่เขียนทับไฟล์เดิม แล้วแสดงในแชต |
| ล้มเหลว | รายงานข้อความจาก agy ตามจริง ไม่ลองใหม่เอง (กันเปลืองโควตา) |
| repo | `nutfull123/claude-image-gen`, public, MIT, README อังกฤษ + ส่วนภาษาไทย ติดตั้งผ่าน plugin marketplace สร้างและ push เมื่อเจ้าของสั่งเท่านั้น |

## ข้อเท็จจริงที่ทดสอบแล้ว (agy 1.4.10, macOS, 2026-11-10)

- `agy -p "<prompt>" --model <id> --output-format json --print-timeout <t>` รันแบบไม่โต้ตอบได้
  คืน JSON มี `status`, `response`, `conversation_id`, `denied_actions`
- การสร้างภาพทำผ่าน subagent `image-generator` (เรียกด้วย `invoke_subagent`, `Model: inherit`)
  ไม่ต้องใช้ `--dangerously-skip-permissions`
- ถ้า agy พยายามรัน shell command จะถูกปฏิเสธใน headless mode (`denied_actions`)
  → prompt ต้องสั่งใช้ `image-generator` และห้าม `run_command`
- ไฟล์ภาพอยู่ที่ `~/.gemini/antigravity-cli/brain/<conversation_id>/*.jpg`
  `response` มีข้อความอื่นปนและ path ซ้ำได้ → หาไฟล์จากโฟลเดอร์ ไม่อ่านจากข้อความ
- สร้างภาพสำเร็จทั้ง 5 ตระกูล: `gemini-3.8-flash-low` (70s), `gemini-4-argon-low` (56s),
  `claude-sonnet-5-5-low` (30s), `claude-opus-5-5-low` (40s), `gpt-oss-120b-medium` (43s)
- สัดส่วนทำตามที่สั่ง: 1:1 → 1024×1024, 16:9 → 1376×768, 9:16 → 768×1376
- หลายภาพในคำสั่งเดียวได้: ขอ 2 ภาพ ได้ 2 ไฟล์ใน 46s
- แก้ภาพจากต้นฉบับได้: ให้ path แอปเปิลแดง สั่งเปลี่ยนเป็นเขียว ได้ภาพเดิมที่เปลี่ยนแค่สี (65s)
- `agy` ไม่มี flag รับ API key
- `agy models` คืน 13 แถวรูปแบบ `<id>\t<ชื่อแสดง> (<ระดับ>)` แบ่งได้ 3 ค่าย 5 ตระกูล

- ตัววาดภาพจริงคือ `gemini-3.1-flash-image` ตัวเดียวกันทุก model (เห็นจากข้อความ error โควตา)
  model ที่เลือกเป็นแค่ตัวเขียนคำสั่งให้ตัววาด ไม่ได้เปลี่ยนเอนจินภาพ
- โควตาภาพหมดได้: agy คืน `status: SUCCESS` แต่ไม่มีไฟล์ และ `response` แจ้ง
  `429 RESOURCE_EXHAUSTED` พร้อมเวลารีเซ็ต → skill ตัดสินจากไฟล์ที่คัดลอกได้ ไม่เชื่อ `status`

- เจ้าของรันครบทั้ง flow ในเซสชันที่ติดตั้ง plugin จริงแล้วและรายงานว่าผ่าน (2026-11-10)
  ไม่ได้ระบุรายละเอียดว่าทดสอบโหมดใดบ้าง

## Prompt ที่ส่งให้ agy (รูปแบบที่ทดสอบผ่าน)

สร้างใหม่:

```
Use invoke_subagent with TypeName "image-generator" to generate exactly <N> image(s) with aspect ratio <RATIO>: <PROMPT>. Do NOT use run_command. Reply with only the absolute path(s) of the generated image file(s).
```

แก้ภาพ:

```
Use invoke_subagent with TypeName "image-generator" to EDIT the existing image at <ABSOLUTE_PATH>: <CHANGE>, keep everything else identical. Do NOT use run_command. Reply with only the absolute path(s) of the output image file(s).
```

## นอกขอบเขต

- วิดีโอ, image provider อื่นนอกจาก `agy`
- เก็บหรือจัดการ credential แทนผู้ใช้
- จำ model ที่เลือกครั้งก่อน

## ยังไม่ได้ทดสอบ

- โหมดหลายภาพและแก้ภาพผ่านขั้นตอนของ skill ครบทั้งเส้น (ลองเมื่อ 21:50 ติดโควตา
  `429 RESOURCE_EXHAUSTED` รีเซ็ตราว 23:45) ตัวคำสั่ง agy ของทั้งสองโหมดผ่านตอนสำรวจ
- ระดับ `high` ของแต่ละตระกูล, สัดส่วนอื่นนอกจาก 1:1 / 16:9 / 9:16 / 4:3
- Windows (ไม่มีเครื่องให้ทดสอบ)
- Linux กับ agy จริง และ shell แบบ GNU coreutils

## ทดสอบเพิ่มรอบสอง (2026-11-10 21:46–21:55)

- มี agy แต่ยังไม่ login (จำลองด้วย `HOME` ว่าง): `agy models` ออก exit 1, stdout ว่าง,
  stderr `Please sign in to view available models` → เมื่อโหลด plugin จริง skill หยุดที่
  preflight และบอกให้รัน `agy` เพื่อ sign in ไม่ถามอะไรต่อ
- Linux (Alpine 3.23 และ 3.24 ใน Docker, busybox sh): คำสั่ง preflight และคำสั่งคัดลอกไฟล์
  ของ skill ทำงานถูก กับโฟลเดอร์ผลลัพธ์จำลอง — ชื่อไฟล์มีช่องว่าง, นามสกุลตัวใหญ่,
  ข้ามไฟล์ที่ไม่ใช่ภาพและโฟลเดอร์ย่อย, รันซ้ำไม่เขียนทับ
- path ภาพต้นฉบับที่มีช่องว่าง และ path ที่ไม่มีอยู่: `test -f` แยกได้ถูก
