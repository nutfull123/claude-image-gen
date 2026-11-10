# agy-image Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code plugin whose single skill lets a user generate or edit images from chat by driving the user's own logged-in `agy` CLI.

**Architecture:** No code. One `SKILL.md` instructs Claude to preflight `agy`, refine the prompt, ask for model and aspect ratio with `AskUserQuestion`, run `agy -p` headless, copy the result out of agy's `brain/` folder into the project, and show it. The repo root is both the plugin and its own marketplace.

**Tech Stack:** Claude Code plugin format (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/<name>/SKILL.md`), `agy` CLI ≥ 1.4.10, POSIX shell commands run by Claude.

**Spec:** `handoff.md` (repo root). Read it first; the tested `agy` behaviour and the two prompt templates live there.

## Global Constraints

- No scripts, no MCP server, no dependencies. Everything is instructions in `SKILL.md`.
- Never pass `--dangerously-skip-permissions` to `agy`.
- Never read, store, or ask for credentials. Auth is the user's own `agy` login.
- Model list comes from `agy models` at run time. No model id is hardcoded anywhere, including README examples that claim to be exhaustive.
- Ask for the model on every run. Do not remember the previous choice.
- User text never reaches the shell unquoted: write the final agy prompt to a file with the Write tool, pass it as `"$(cat <file>)"`.
- On failure, report agy's own output and stop. No automatic retry.
- Never overwrite an existing file in `./generated-images/`.
- Do not create the GitHub repo or push until the owner says to start Task 4.

## Review Focus

1. Prompt containing `"`, `` ` ``, `$(...)` or newlines → image is generated from the literal text, nothing is executed. (Task 2, check C)
2. `agy` missing or not logged in → skill stops before asking any question and tells the user to run `agy` to log in. (Task 2, check D)
3. `status` is `SUCCESS` but the brain folder has no image, or `denied_actions` is non-empty → reported as a failure with agy's `response`, not as success. (Task 2, step 2 rule 7)
4. Several images in one run, or two runs in the same second → every file is kept, none overwritten. (Task 2, check B)
5. Reference image path with spaces, relative, or nonexistent → resolved to an absolute path and checked with `test -f` before agy is called. (Task 2, check E)

---

### Task 1: Plugin scaffold

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `LICENSE` (MIT, 2026, holder `nutfull123`)
- Create: `.gitignore` containing `generated-images/`

**Interfaces:**
- Produces: plugin name `agy-image`; marketplace name `claude-image-gen`; skill directory `skills/agy-image/` (Task 2 fills it).

- [ ] **Step 1: Confirm the current plugin format.** Load the `plugin-authoring` skill or ask the `claude-code-guide` agent for the required fields of `plugin.json` and `marketplace.json` and for how a plugin skill is invoked (`/agy-image` vs `/agy-image:agy-image`). Record the real invocation in `handoff.md`, replacing the "ตรวจตอนสร้าง" note.

- [ ] **Step 2: Write `plugin.json`** with `name: "agy-image"`, `version: "0.1.0"`, a one-line description, `license: "MIT"`, `repository: "https://github.com/nutfull123/claude-image-gen"`.

- [ ] **Step 3: Write `marketplace.json`** with `name: "claude-image-gen"`, an `owner.name` of `nutfull123`, and one plugin entry `agy-image` whose `source` is the repo root.

- [ ] **Step 4: `git init`, validate, commit**

Run: `claude plugin validate .`
Expected: validation passes with no errors. If the subcommand does not exist, state that and rely on Task 4's install test instead.

```bash
git add .claude-plugin LICENSE .gitignore handoff.md docs
git commit -m "chore: scaffold agy-image plugin"
```

### Task 2: The skill

**Files:**
- Create: `skills/agy-image/SKILL.md`

**Interfaces:**
- Consumes: nothing from Task 1 beyond the directory.
- Produces: the skill `agy-image`, which README (Task 3) documents.

- [ ] **Step 1: Write the frontmatter.** `name: agy-image`; `description` says it generates or edits images through the Antigravity `agy` CLI and triggers on requests to create/draw/generate/edit an image "with agy" or via `/agy-image`.

- [ ] **Step 2: Write the body as these numbered rules, in this order.**

  1. **Preflight.** Run `command -v agy` then `agy models`. If either fails or the list is empty: stop, tell the user to install Antigravity CLI and run `agy` once to log in, ask nothing else.
  2. **Read the request.** Decide mode (generate, or edit if the user gave an image path), count N (default 1; the user's number if they asked for several), and the subject. In edit mode resolve the path to absolute and run `test -f`; if missing, stop and say so.
  3. **Refine.** Rewrite the description as one detailed English image prompt. Print it to the user before any question.
  4. **Dialog 1** (`AskUserQuestion`, one call): question "ค่าย" with one option per distinct first word of the display names from `agy models`; in generate mode a second question "สัดส่วนภาพ" with options `1:1`, `16:9 แนวนอน`, `9:16 แนวตั้ง`, `4:3`. A typed "Other" ratio is accepted only if it matches `^\d{1,2}:\d{1,2}$`; otherwise ask again. Skip the "ค่าย" question when there is only one.
  5. **Dialog 2** (`AskUserQuestion`, one call): question "รุ่น" listing the families in the chosen provider (display name without the parenthesised level), and question "ระดับ" listing the levels that exist for those families. Skip any question with one option. Resolve to the `agy models` row whose display name is `<family> (<level>)`; if that pair does not exist, say so and re-ask.
  6. **Run.** Fill the matching template from `handoff.md` (copy both templates verbatim into the skill). Write it to a file in the session temp dir with the Write tool, then run from the project directory with a 330 s shell timeout:
     `agy -p "$(cat <file>)" --model <id> --output-format json --print-timeout 300s`
  7. **Judge the result.** Success requires all of: JSON parsed, `status` is `SUCCESS`, `denied_actions` absent or empty, and at least one `*.jpg|*.jpeg|*.png|*.webp` directly inside `~/.gemini/antigravity-cli/brain/<conversation_id>/`. Anything else: show `status`, `response`, `denied_actions` and stderr, then stop. No retry.
  8. **Deliver.** `mkdir -p ./generated-images`; copy each image as `YYYYMMDD-HHMMSS-<k>.<ext>` using `cp -n`, bumping `<k>` until the name is free. Show each with `SendUserFile` when that tool exists, otherwise a markdown link plus the path. State the model used and the count delivered versus requested.

- [ ] **Step 3: Run the checks in a scratch project directory with the plugin loaded** (`claude --plugin-dir <repo>` or the equivalent found in Task 1 Step 1). Each check is a real run; record model, duration and outcome in the commit message body.

  - **A — generate:** "วาดประภาคารตอนพระอาทิตย์ตก" → both dialogs appear, pick `16:9`. Expected: one file in `./generated-images/`, `sips -g pixelWidth -g pixelHeight` reports width > height.
  - **B — multiple:** "ขอ 2 รูป แมวส้ม" → Expected: 2 new files, the file from check A still present and unchanged.
  - **C — hostile text:** description `a sign that says "$(touch pwned)" and `id`` → Expected: an image is produced or agy fails cleanly; `test ! -e pwned` passes in the project directory.
  - **D — no agy:** run with `PATH` stripped of `agy`'s directory. Expected: stop message with login instructions, no dialog shown.
  - **E — edit:** copy a check-A image to `./my ref.jpg`, ask to "แก้รูป ./my ref.jpg ให้เป็นตอนกลางคืน". Expected: no ratio question; output has the same pixel size as the reference. Then repeat with `./missing.jpg`. Expected: stops before calling agy.

- [ ] **Step 4: Commit**

```bash
git add skills/agy-image/SKILL.md
git commit -m "feat: add agy-image skill"
```

### Task 3: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the invocation name recorded in Task 1 Step 1; marketplace name `claude-image-gen`; plugin name `agy-image`.

- [ ] **Step 1: Write the English section** with exactly these headings: What it does; Requirements (Claude Code, Antigravity CLI `agy` ≥ 1.4.10 with an active subscription, logged in by running `agy`); Install (the two marketplace commands, using the real syntax confirmed in Task 1); Usage (generate, several images, edit an existing image, where files land); How model choice works (live from `agy models`, asked every time); Troubleshooting (not logged in, `denied_actions`, no image produced, timeout); Limits (tested on macOS only; uses the user's agy quota; no retry); License.

- [ ] **Step 2: Add a `## ภาษาไทย` section** covering the same Requirements, Install and Usage content.

- [ ] **Step 3: Verify every command in the README by running it**, then commit.

```bash
git add README.md
git commit -m "docs: add README"
```

### Task 4: Publish (only after the owner says go)

**Files:** none.

- [ ] **Step 1: Create and push.**

```bash
gh repo create nutfull123/claude-image-gen --public --source . --remote origin --push --description "Generate and edit images from Claude Code through the Antigravity agy CLI"
```

Expected: repo URL printed; `git status` reports the branch is up to date with `origin`.

- [ ] **Step 2: Install from GitHub in a clean scratch directory** using the README's install commands, then repeat check A from Task 2.
Expected: the skill is listed, and one image lands in `./generated-images/`.

- [ ] **Step 3: Report** the repo URL, the install commands, and anything from "ยังไม่ได้ทดสอบ" in `handoff.md` that is still untested.
