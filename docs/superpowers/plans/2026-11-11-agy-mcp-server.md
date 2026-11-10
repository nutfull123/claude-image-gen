# agy-image MCP Server Implementation Plan

**Goal:** A dependency-free Node.js MCP server, packaged as a `.mcpb` bundle, that lets the Chat tab of Claude desktop generate and edit images through the user's logged-in `agy` CLI.

**Architecture:** One CommonJS file speaks MCP over stdio (newline-delimited JSON-RPC) and shells out to `agy` with `execFile` (argument array, no shell). Pure helpers are exported for tests; a fake `agy` shell script stands in for the real CLI so tests spend no quota.

**Tech Stack:** Node.js ≥ 18 standard library only, `node:test`, mcpb manifest 0.3.

**Spec:** `docs/superpowers/specs/2026-11-11-agy-mcp-server-design.md`. Prompt templates: `handoff.md`.

## Global Constraints

- No npm dependencies. No build step.
- Never pass `--dangerously-skip-permissions`. Never read or store credentials.
- No hardcoded model ids. `model` must be in the live `agy models` output.
- User text reaches `agy` only as an `execFile` argument.
- Never overwrite an image (`COPYFILE_EXCL`).
- stdout carries protocol messages only; logs go to stderr.
- Work stays on branch `worktree-mcp-server` until the owner says merge.

## Review Focus

1. Hostile prompt text (`"$(touch pwned)"`, backticks) → passed literally, nothing executed. (Task 1 test 3)
2. `SUCCESS` with no image / quota text → tool error naming the quota. (Task 1 test 4)
3. Bad arguments → rejected before `agy -p` runs. (Task 1 test 5)
4. Two runs in the same second → both files kept. (Task 1 test 2)
5. `agy` missing from the app's PATH → fallback locations tried, clear error if none. (Task 1 test 1b)

## Task 1: Server and tests

**Files:** Create `mcp/server/index.js`, `mcp/test/server.test.js`.

**Interfaces (exports of `index.js`):**
- `parseModels(stdout: string): {id: string, name: string}[]`
- `buildPrompt({prompt, count, aspect_ratio, reference_image}): string`
- `listModels(): Promise<{id, name}[]>` — rejects with a user-facing message
- `generateImage(args): Promise<{files: string[]}>` — rejects with a user-facing message
- `handle(message: object): Promise<object|null>` — one JSON-RPC message in, response out (null for notifications)

Environment read at call time: `HOME`, `AGY_PATH`.

- [ ] Write the six test groups from the spec's "การทดสอบ" section. Run `node --test mcp/test/` — expected: FAIL, module not found.
- [ ] Implement `index.js`. Run `node --test mcp/test/` — expected: all pass.
- [ ] Commit.

## Task 2: Bundle

**Files:** Create `mcp/manifest.json`. Modify `.gitignore` (add `*.mcpb`).

- [ ] Write the manifest: `manifest_version` `0.3`, name `agy-image`, `server.type` `node`, `mcp_config` running `node ${__dirname}/server/index.js` with env `AGY_PATH=${user_config.agy_path}`, optional string `user_config.agy_path`, both tools listed.
- [ ] `npx -y @anthropic-ai/mcpb validate mcp/manifest.json` — expected: valid.
- [ ] `npx -y @anthropic-ai/mcpb pack mcp agy-image.mcpb` — expected: file created, contains only `manifest.json` and `server/index.js` (add `mcp/.mcpbignore` with `test/` if needed).
- [ ] Commit.

## Task 3: Real run and docs

- [ ] Drive the server over stdio with the real `agy`: `initialize`, `tools/call list_models`, `tools/call generate_image` (1 image, `gemini-3.8-flash-low`). Expected: one new file in `~/Pictures/agy-images/`. Spends one image of quota.
- [ ] Add a "Use it in the Claude desktop Chat tab" section to `README.md` (English and Thai): requirements, download and double-click, what it asks, where files go, limits.
- [ ] Commit. Do not merge, push, or publish a release until the owner says so.
