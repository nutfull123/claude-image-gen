# claude-image-gen

A Claude Code plugin that generates and edits images from chat by driving your own
[Antigravity CLI](https://antigravity.google/docs) (`agy`).

[ภาษาไทย](#ภาษาไทย)

## What it does

You describe a picture in Claude Code. Claude rewrites it as a detailed prompt, asks which agy
model and aspect ratio to use, runs `agy` in the background, and saves the result to
`./generated-images/` in your project.

- Generate one image, or several if you ask for a number
- Edit an existing image file ("make the sky night in ./photo.jpg")
- Aspect ratios: 1:1, 16:9, 9:16, 4:3, or type your own (for example 3:4)

The plugin is a single skill file. It has no server, no scripts and no dependencies, and it never
sees your credentials.

## Requirements

- Claude Code
- Antigravity CLI `agy` 1.4.10 or newer, with a plan that includes image generation
- You are logged in: run `agy` once in a terminal and follow the prompts

## Install

In Claude Code:

```
/plugin install agy-image@claude-image-gen
```

Or from a terminal:

```bash
claude plugin marketplace add nutfull123/claude-image-gen
```

```bash
claude plugin install agy-image@claude-image-gen
```

## Usage

```
/agy-image:agy-image a lighthouse on a cliff at sunset
/agy-image:agy-image 3 pictures of an orange cat on a windowsill
/agy-image:agy-image edit ./photo.jpg so it is night time
```

Plain requests work too: "use agy to draw a lighthouse at sunset".

Every run asks two short questions before anything is sent:

1. Provider and aspect ratio
2. Model and level (low / medium / high)

A run usually takes 30 to 90 seconds. Files are saved as
`./generated-images/YYYYMMDD-HHMMSS-1.jpg`; existing files are never overwritten.

## How model choice works

The list comes live from `agy models`, so you only see models your account can use. The model you
pick is the agent that briefs agy's built-in image generator. It changes how the brief is written
and how fast the run is; the image engine underneath is the same for every model.

## Troubleshooting

| What you see | What to do |
|---|---|
| "agy not found" or no models listed | Install the Antigravity CLI, run `agy` once to log in, try again |
| Quota or `429 RESOURCE_EXHAUSTED` | Your agy image quota is used up. Wait for the reset time agy reports. Switching model does not help |
| `denied_actions` in the report | agy tried to run a shell command and headless mode refused it. Ask again; do not enable permission bypass |
| No image after a "SUCCESS" | agy reports success even when nothing was drawn. Read the message it returned; it is usually the quota |
| Timeout | A run is cut off after 300 seconds. Ask for fewer images per request |

## Limits

- Tested on macOS with agy 1.4.10 only. Windows and Linux are untested.
- Every run spends your agy image quota. The plugin never retries on its own.
- Images are read from agy's own folder (`~/.gemini/antigravity-cli/brain/`). If a future agy
  version moves it, the plugin will report "no image" until it is updated.

## License

MIT

---

## ภาษาไทย

plugin สำหรับ Claude Code ที่สร้างและแก้ภาพจากในแชต โดยสั่งงาน `agy` (Antigravity CLI) ของคุณเอง

### สิ่งที่ต้องมี

- Claude Code
- Antigravity CLI `agy` รุ่น 1.4.10 ขึ้นไป และแพ็กเกจที่สร้างภาพได้
- login แล้ว: รัน `agy` ใน terminal หนึ่งครั้งแล้วทำตามขั้นตอนบนจอ

### ติดตั้ง

พิมพ์ใน Claude Code:

```
/plugin marketplace add nutfull123/claude-image-gen
/plugin install agy-image@claude-image-gen
```

### วิธีใช้

```
/agy-image:agy-image วาดประภาคารบนหน้าผาตอนพระอาทิตย์ตก
/agy-image:agy-image ขอ 3 รูป แมวส้มนั่งริมหน้าต่าง
/agy-image:agy-image แก้รูป ./photo.jpg ให้เป็นตอนกลางคืน
```

หรือพิมพ์ธรรมดาก็ได้ เช่น "ใช้ agy วาดประภาคารตอนพระอาทิตย์ตก"

ทุกครั้งก่อนส่ง Claude จะถาม 2 กล่อง:

1. ค่ายและสัดส่วนภาพ (1:1, 16:9 แนวนอน, 9:16 แนวตั้ง, 4:3 หรือพิมพ์เอง)
2. รุ่นและระดับ (low / medium / high)

ใช้เวลาราว 30–90 วินาทีต่อครั้ง ไฟล์ภาพอยู่ที่ `./generated-images/` และไม่เขียนทับไฟล์เดิม

### ข้อควรรู้

- รายการ model ดึงสดจาก `agy models` จึงเห็นเฉพาะตัวที่บัญชีคุณใช้ได้
- model ที่เลือกเป็นตัวเขียนคำสั่งให้ตัวสร้างภาพของ agy ซึ่งเป็นตัวเดียวกันทุก model
- ทุกครั้งใช้โควตาสร้างภาพของ agy ถ้าโควตาหมดต้องรอเวลารีเซ็ตที่ agy แจ้ง เปลี่ยน model ไม่ช่วย
- plugin ไม่ลองใหม่เอง และไม่แตะ credential ของคุณ
- ทดสอบบน macOS เท่านั้น
