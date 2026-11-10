# claude-image-gen

A Claude Code plugin that generates and edits images from chat by driving your own
[Antigravity CLI](https://antigravity.google/docs) (`agy`).

[ภาษาไทย](#ภาษาไทย)

> **You must be logged in to the `agy` CLI in a terminal before this plugin can do anything.**
> The plugin has no account, key or login of its own. See [Step 2](#step-2-log-in-to-agy-required).

## What it does

You describe a picture in Claude Code. Claude rewrites it as a detailed prompt, asks which agy
model and aspect ratio to use, runs `agy` (in Claude's Terminal panel when the app has one, so you
can watch), and saves the result to `./generated-images/` in your project.

- Generate one image, or several if you ask for a number
- Edit an existing image file ("make the sky night in ./your-photo.jpg")
- Aspect ratios: 1:1, 16:9, 9:16, 4:3, or type your own (for example 3:4)

The plugin is a single skill file. It has no server, no scripts and no dependencies.

## Setup

Anything written like `your-email@gmail.com` or `./your-photo.jpg` is a placeholder: replace it
with your own. Everything else can be copied as it is.

### Step 1: Install what it needs

- [Claude Code](https://claude.com/claude-code)
- Antigravity CLI `agy`, version 1.4.10 or newer. Follow the
  [Antigravity docs](https://antigravity.google/docs) to install it.
- A Google account whose plan includes Antigravity image generation

Check that `agy` is installed:

```bash
agy --version
```

### Step 2: Log in to agy (required)

Do this once, in a normal terminal, before you use the plugin.

1. Run `agy` with nothing after it:

   ```bash
   agy
   ```

2. Sign in with your own Google account (`your-email@gmail.com`) when it asks.
3. Leave agy with `/exit`, then check that the login worked:

   ```bash
   agy models
   ```

   You should see a list of models. If you see "Please sign in", repeat from 1.

The plugin uses whichever account `agy` is signed in to and spends that account's quota. It never
asks for, reads or stores your email, password, token or API key. If you are not logged in, the
plugin stops at its first step and tells you to come back here.

### Step 3: Install the plugin

Type these two lines in Claude Code, one after the other:

```
/plugin marketplace add nutfull123/claude-image-gen
/plugin install agy-image@claude-image-gen
```

Or run them from a terminal:

```bash
claude plugin marketplace add nutfull123/claude-image-gen
```

```bash
claude plugin install agy-image@claude-image-gen
```

Then start a new Claude Code session.

### Step 4: Make an image

```
/agy-image:agy-image a lighthouse on a cliff at sunset
/agy-image:agy-image 3 pictures of an orange cat on a windowsill
/agy-image:agy-image edit ./your-photo.jpg so it is night time
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
and how fast the run is.

The pictures themselves are drawn by **Nano Banana 2** (`gemini-3.1-flash-image`), which agy uses
for every model. The plugin shows this before each run. agy 1.4.10 has no setting to switch to
another image engine such as Nano Banana Pro.

## Troubleshooting

| What you see | What to do |
|---|---|
| "agy not found" | Install the Antigravity CLI (Step 1) |
| "Please sign in" or no models listed | Log in to agy in a terminal (Step 2) |
| "Plugin not found" when installing | Run the `marketplace add` line first (Step 3) |
| Quota or `429 RESOURCE_EXHAUSTED` | Your agy image quota is used up. It is separate from the model limits shown in Antigravity's Settings > Models, so those can still look full. Wait for the reset time agy reports. Switching model does not help |
| `denied_actions` in the report | agy tried to run a shell command and headless mode refused it. Ask again; do not enable permission bypass |
| No image after a "SUCCESS" | agy reports success even when nothing was drawn. Read the message it returned; it is usually the quota |
| Timeout | A run is cut off after 300 seconds. Ask for fewer images per request |

## Limits

- Tested end to end on macOS with agy 1.4.10. On Linux only the plugin's shell steps were tested
  (Alpine, without a real agy). Windows is untested.
- Every run spends your agy image quota. The plugin never retries on its own.
- Images are read from agy's own folder (`~/.gemini/antigravity-cli/brain/`). If a future agy
  version moves it, the plugin will report "no image" until it is updated.

## License

MIT

---

## ภาษาไทย

plugin สำหรับ Claude Code ที่สร้างและแก้ภาพจากในแชต โดยสั่งงาน `agy` (Antigravity CLI) ของคุณเอง

> **ต้อง login `agy` CLI ใน terminal ไว้ก่อน plugin จึงจะใช้ได้**
> plugin ไม่มีบัญชี คีย์ หรือระบบ login ของตัวเอง ดู[ขั้นที่ 2](#ขั้นที่-2-login-agy-ต้องทำ)

### การตั้งค่า

ข้อความแบบ `your-email@gmail.com` หรือ `./your-photo.jpg` เป็นตัวอย่าง ให้เปลี่ยนเป็นของคุณเอง
ส่วนอื่นคัดลอกไปใช้ได้เลย

#### ขั้นที่ 1: ติดตั้งสิ่งที่ต้องมี

- [Claude Code](https://claude.com/claude-code)
- Antigravity CLI `agy` รุ่น 1.4.10 ขึ้นไป ติดตั้งตาม[เอกสารของ Antigravity](https://antigravity.google/docs)
- บัญชี Google ที่แพ็กเกจรวมการสร้างภาพของ Antigravity

ตรวจว่าติดตั้ง `agy` แล้ว:

```bash
agy --version
```

#### ขั้นที่ 2: login agy (ต้องทำ)

ทำครั้งเดียวใน terminal ปกติ ก่อนใช้ plugin

1. รัน `agy` โดยไม่ใส่อะไรต่อท้าย:

   ```bash
   agy
   ```

2. sign in ด้วยบัญชี Google ของคุณเอง (`your-email@gmail.com`) เมื่อระบบถาม
3. ออกจาก agy ด้วย `/exit` แล้วตรวจว่า login สำเร็จ:

   ```bash
   agy models
   ```

   ต้องเห็นรายการ model ถ้าเห็น "Please sign in" ให้ทำซ้ำตั้งแต่ข้อ 1

plugin ใช้บัญชีที่ `agy` sign in อยู่ และใช้โควตาของบัญชีนั้น plugin ไม่ขอ ไม่อ่าน และไม่เก็บอีเมล
รหัสผ่าน token หรือ API key ของคุณ ถ้ายังไม่ login plugin จะหยุดตั้งแต่ขั้นแรกและบอกให้กลับมาทำขั้นนี้

#### ขั้นที่ 3: ติดตั้ง plugin

พิมพ์ 2 บรรทัดนี้ใน Claude Code ทีละบรรทัด:

```
/plugin marketplace add nutfull123/claude-image-gen
/plugin install agy-image@claude-image-gen
```

จากนั้นเปิดเซสชัน Claude Code ใหม่

#### ขั้นที่ 4: สร้างภาพ

```
/agy-image:agy-image วาดประภาคารบนหน้าผาตอนพระอาทิตย์ตก
/agy-image:agy-image ขอ 3 รูป แมวส้มนั่งริมหน้าต่าง
/agy-image:agy-image แก้รูป ./your-photo.jpg ให้เป็นตอนกลางคืน
```

หรือพิมพ์ธรรมดาก็ได้ เช่น "ใช้ agy วาดประภาคารตอนพระอาทิตย์ตก"

ทุกครั้งก่อนส่ง Claude จะถาม 2 กล่อง:

1. ค่ายและสัดส่วนภาพ (1:1, 16:9 แนวนอน, 9:16 แนวตั้ง, 4:3 หรือพิมพ์เอง)
2. รุ่นและระดับ (low / medium / high)

ใช้เวลาราว 30–90 วินาทีต่อครั้ง ไฟล์ภาพอยู่ที่ `./generated-images/` และไม่เขียนทับไฟล์เดิม

### ถ้าใช้ไม่ได้

| สิ่งที่เห็น | วิธีแก้ |
|---|---|
| "agy not found" | ติดตั้ง Antigravity CLI (ขั้นที่ 1) |
| "Please sign in" หรือไม่มีรายการ model | login agy ใน terminal (ขั้นที่ 2) |
| ติดตั้งแล้วขึ้นว่าไม่พบ plugin | รันบรรทัด `marketplace add` ก่อน (ขั้นที่ 3) |
| โควตาหมด หรือ `429 RESOURCE_EXHAUSTED` | โควตาสร้างภาพของ agy หมด รอเวลารีเซ็ตที่ agy แจ้ง เปลี่ยน model ไม่ช่วย |

### ข้อควรรู้

- รายการ model ดึงสดจาก `agy models` จึงเห็นเฉพาะตัวที่บัญชีคุณใช้ได้
- ตัววาดภาพคือ **Nano Banana 2** (`gemini-3.1-flash-image`) ซึ่ง agy ใช้กับทุก model plugin จะแสดงชื่อนี้ก่อนรันทุกครั้ง
- model ที่เลือกเป็นตัวเขียนคำสั่งให้ Nano Banana 2 และ agy 1.4.10 ยังเปลี่ยนเป็นตัววาดอื่น เช่น Nano Banana Pro ไม่ได้
- agy รันในแผง Terminal ของ Claude ให้เห็น ถ้าแอปมีแผงนั้น ไม่เช่นนั้นรันเบื้องหลัง
- โควตาสร้างภาพแยกจากโควตา model ในหน้า Settings > Models ของ Antigravity
- plugin ไม่ลองใหม่เอง และไม่แตะ credential ของคุณ
- ทดสอบครบบน macOS เท่านั้น
