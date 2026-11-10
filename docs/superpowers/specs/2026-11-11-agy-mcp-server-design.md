# Spec: agy-image MCP server สำหรับแท็บ Chat ของ Claude desktop

สถานะ: **ร่าง — รอเจ้าของตรวจ** (2026-11-11)
กิ่ง: `worktree-mcp-server` (ไม่รวมเข้า `main` จนกว่าเจ้าของสั่ง)

## วัตถุประสงค์

ให้ผู้ใช้สร้างและแก้ภาพด้วย `agy` ได้จากแท็บ Chat ของแอป Claude desktop
ซึ่ง skill `agy-image` เดิมใช้ไม่ได้ เพราะแชตรันคำสั่งบนเครื่องผู้ใช้ไม่ได้

สำเร็จเมื่อ: ผู้ใช้ติดตั้งไฟล์ `.mcpb` ด้วยการดับเบิลคลิก พิมพ์ขอภาพในแชต
ตอบคำถามเลือก model แล้วได้ภาพแสดงในแชตและไฟล์อยู่ใน `~/Pictures/agy-images/`

## สิ่งที่เจ้าของตัดสินแล้ว

| เรื่อง | ข้อตกลง |
|---|---|
| ติดตั้ง | ไฟล์ `.mcpb` ดาวน์โหลดจาก GitHub Releases แล้วดับเบิลคลิก |
| ที่เก็บภาพ | `~/Pictures/agy-images/` ไม่เขียนทับไฟล์เดิม |
| ถาม model | Claude เรียก `list_models` แล้วถามเป็นข้อความทุกครั้ง `generate_image` ปฏิเสธถ้าไม่ระบุ model |
| ที่อยู่โค้ด | โฟลเดอร์ `mcp/` ใน repo เดิม plugin `agy-image` ไม่ถูกแตะ |

## สิ่งที่ผมตัดสินเอง (ทักท้วงได้)

- **ไม่ใช้ไลบรารีภายนอก:** server เป็น Node.js ไฟล์เดียว พูดโปรโตคอล MCP ผ่าน stdio เอง
  (รองรับ `initialize`, `ping`, `tools/list`, `tools/call`) ไม่มี `node_modules`
  ข้อดี: bundle มี 2 ไฟล์ ไม่ต้อง build ข้อเสีย: ถ้าโปรโตคอลเพิ่มข้อบังคับใหม่ต้องแก้เอง
  ทางเลือกคือใช้ `@modelcontextprotocol/sdk` ซึ่งทำให้ bundle ใหญ่ขึ้นหลาย MB
- **หา `agy` เอง:** แอป desktop อาจไม่มี `~/.local/bin` ใน PATH server จึงลองตามลำดับ
  ค่าที่ผู้ใช้ตั้งตอนติดตั้ง → `agy` ใน PATH → `~/.local/bin/agy` → `/opt/homebrew/bin/agy`
  → `/usr/local/bin/agy`
- **ไม่ขัดเกลา prompt ใน server:** Claude ในแชตเป็นผู้ขัดเกลา ตามคำอธิบายของเครื่องมือ

## โครงสร้าง

```
mcp/
  manifest.json        รูปแบบ mcpb 0.3, server.type "node", user_config.agy_path (ไม่บังคับ)
  server/index.js      server ทั้งหมด
  test/server.test.js  ทดสอบด้วย node:test กับ agy ปลอม
```

## เครื่องมือ

### `list_models`

ไม่มีพารามิเตอร์ รัน `agy models` แล้วคืนรายการ `{id, name}` พร้อมข้อความว่า
ตัววาดภาพคือ Nano Banana 2 เสมอ และ model ที่เลือกเป็นตัวเขียนคำสั่ง

ถ้า `agy` ไม่พบ หรือยังไม่ login: คืน error บอกให้ติดตั้ง/รัน `agy` เพื่อ sign in

### `generate_image`

| พารามิเตอร์ | ชนิด | กฎ |
|---|---|---|
| `prompt` | string, บังคับ | 1–4000 ตัวอักษร |
| `model` | string, บังคับ | ต้องเป็น id ที่อยู่ในผล `agy models` ขณะนั้น |
| `aspect_ratio` | string | รูปแบบ `W:H` เลข 1–2 หลัก ค่าเริ่มต้น `1:1` ไม่ใช้ในโหมดแก้ภาพ |
| `count` | integer | 1–4 ค่าเริ่มต้น 1 |
| `reference_image` | string | path แบบ absolute ของไฟล์ที่มีอยู่จริง ถ้าใส่ = โหมดแก้ภาพ |

ขั้นตอน: ตรวจพารามิเตอร์ → สร้างข้อความสั่ง agy จากแม่แบบเดิมใน `handoff.md` →
รัน `agy -p <ข้อความ> --model <id> --output-format json --print-timeout 300s`
โดยส่งอาร์กิวเมนต์เป็นอาร์เรย์ ไม่ผ่าน shell → อ่าน JSON บรรทัดสุดท้าย →
หาไฟล์ภาพใน `~/.gemini/antigravity-cli/brain/<conversation_id>/` →
คัดลอกไป `~/Pictures/agy-images/YYYYMMDD-HHMMSS-<k>.<ext>` → คืนผล

ผลสำเร็จ: ข้อความบอก path ของทุกไฟล์ + ภาพแนบแบบ MCP image content
สำหรับไฟล์ที่เล็กกว่า 700 KB (ไฟล์ใหญ่กว่านั้นคืนแค่ path)

ถือว่าล้มเหลวเมื่อ: `status` ไม่ใช่ `SUCCESS`, `denied_actions` ไม่ว่าง,
`conversation_id` ไม่ตรงรูปแบบ UUID, หรือไม่มีไฟล์ภาพ
คืน error พร้อม `response` ของ agy และถ้าเป็นโควตา (`429`/`RESOURCE_EXHAUSTED`)
บอกว่าโควตาภาพหมดและเปลี่ยน model ไม่ช่วย ไม่ลองซ้ำเอง

## ข้อบังคับ

- ไม่ส่ง `--dangerously-skip-permissions` ให้ `agy`
- ไม่อ่าน ไม่เก็บ ไม่ขอ credential
- ไม่มี model id ฝังในโค้ด
- ข้อความจากผู้ใช้ไม่ผ่าน shell
- ไม่เขียนทับไฟล์ภาพเดิม
- ไม่เขียนอะไรลง stdout นอกจากข้อความโปรโตคอล (log ไป stderr)

## การทดสอบ

อัตโนมัติ (`node --test`, ใช้ `agy` ปลอมที่เป็น shell script):

1. `list_models` แปลงผล 13 แถวถูก และคืน error เมื่อ agy ปลอมตอบ "Please sign in"
2. `generate_image` สำเร็จ: ได้ไฟล์ในโฟลเดอร์ปลายทาง และรันซ้ำไม่เขียนทับ
3. prompt ที่มี `"$(touch pwned)"` และ backtick: ไม่มีไฟล์ `pwned` เกิดขึ้น
4. agy ปลอมตอบ `SUCCESS` แต่ไม่มีไฟล์ + ข้อความ 429: คืน error เรื่องโควตา
5. พารามิเตอร์ผิด: model ไม่อยู่ในรายการ, สัดส่วนผิดรูปแบบ, count 0 และ 5,
   reference_image ไม่มีอยู่จริง → ถูกปฏิเสธก่อนเรียก agy
6. โปรโตคอล: `initialize` → `tools/list` → `tools/call` ผ่าน stdio ได้คำตอบถูกรูปแบบ

ด้วยมือ (ต้องมีเจ้าของ): ติดตั้ง `.mcpb` ในแอป Claude desktop แล้วสร้างภาพจริง 1 ภาพ
และแก้ภาพ 1 ภาพจากแท็บ Chat

## ความเสี่ยงที่ยังไม่ได้ยืนยัน

- แอป Claude desktop แสดงภาพที่ MCP ส่งกลับให้ผู้ใช้เห็นในแชตหรือไม่
  ถ้าไม่แสดง ผู้ใช้ยังได้ path ไฟล์ และจะแก้เป็นเปิดโฟลเดอร์ให้แทน
- ขีดจำกัดขนาดผลลัพธ์ของเครื่องมือในแอป (ตั้ง 700 KB ไว้ก่อนตามการประมาณ)
- PATH ของแอป desktop บนเครื่องผู้ใช้อื่น
- ทดสอบได้บน macOS เท่านั้น

## นอกขอบเขต

- claude.ai บนเว็บและมือถือ
- กล่องตัวเลือกแบบใน skill และการแสดง agy ในแผง Terminal
- การส่งเข้ารายการส่วนขยายทางการของ Anthropic
