'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ENTRY = path.join(__dirname, '..', 'server', 'index.js');
const LIB = path.join(__dirname, '..', 'server', 'lib.js');
const ID = '11111111-2222-3333-4444-555555555555';

// A stand-in for the real CLI so tests spend no image quota.
const FAKE_AGY = `#!/bin/sh
case "$1" in
  models)
    if [ -n "$FAKE_SIGNED_OUT" ]; then
      echo "Fetching available models..." >&2
      echo "Error: Please sign in to view available models." >&2
      exit 1
    fi
    printf 'gemini-3.8-flash-low\\tGemini 3.8 Flash (Low)\\nclaude-sonnet-5-5-low\\tClaude Sonnet 5.5 (Low)\\n'
    ;;
  -p)
    printf '%s' "$2" > "$HOME/last-prompt.txt"
    echo "$@" > "$HOME/last-args.txt"
    if [ -n "$FAKE_QUOTA" ]; then
      echo '{"conversation_id":"${ID}","status":"SUCCESS","response":"429 RESOURCE_EXHAUSTED: quota will reset in 1 hour"}'
      exit 0
    fi
    d="$HOME/.gemini/antigravity-cli/brain/${ID}"
    mkdir -p "$d/.system_generated"
    echo notimage > "$d/notes.txt"
    i=1
    while [ $i -le \${FAKE_COUNT:-1} ]; do echo "img$i" > "$d/pic_$i.jpg"; i=$((i+1)); done
    echo "root agent idle" >&2
    echo '{"conversation_id":"${ID}","status":"SUCCESS","response":"ok"}'
    ;;
esac
`;

function freshHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-mcp-'));
  const agy = path.join(home, 'fake-agy');
  fs.writeFileSync(agy, FAKE_AGY, { mode: 0o755 });
  process.env.HOME = home;
  process.env.AGY_PATH = agy;
  delete process.env.FAKE_SIGNED_OUT;
  delete process.env.FAKE_QUOTA;
  delete process.env.FAKE_COUNT;
  return home;
}

const server = () => require(LIB);
const outDir = (home) => path.join(home, 'Pictures', 'agy-images');
const ok = { prompt: 'a red apple', model: 'gemini-3.8-flash-low' };

test('1a list_models parses rows', async () => {
  freshHome();
  assert.deepEqual(await server().listModels(), [
    { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
    { id: 'claude-sonnet-5-5-low', name: 'Claude Sonnet 5.5 (Low)' },
  ]);
});

test('1b list_models explains signed-out and missing agy', async () => {
  freshHome();
  process.env.FAKE_SIGNED_OUT = '1';
  await assert.rejects(server().listModels(), /sign in/i);
  delete process.env.FAKE_SIGNED_OUT;
  process.env.AGY_PATH = '/nonexistent/agy';
  const savedPath = process.env.PATH;
  process.env.PATH = '/usr/bin:/bin';
  try {
    await assert.rejects(server().listModels(), /not found|install/i);
  } finally {
    process.env.PATH = savedPath;
  }
});

test('2 generate copies images and never overwrites', async () => {
  const home = freshHome();
  process.env.FAKE_COUNT = '2';
  const first = await server().generateImage({ ...ok, count: 2 });
  const second = await server().generateImage({ ...ok, count: 2 });
  assert.equal(first.files.length, 2);
  assert.equal(second.files.length, 2);
  const all = fs.readdirSync(outDir(home));
  assert.equal(all.length, 4);
  assert.equal(new Set([...first.files, ...second.files]).size, 4);
  for (const f of all) assert.match(f, /^\d{8}-\d{6}-\d+\.jpg$/);
  const args = fs.readFileSync(path.join(home, 'last-args.txt'), 'utf8');
  assert.match(args, /--model gemini-3\.8-flash-low --output-format json --print-timeout 300s/);
  assert.doesNotMatch(args, /dangerously/);
});

test('3 hostile prompt text is passed literally', async () => {
  const home = freshHome();
  const cwd = process.cwd();
  process.chdir(home);
  try {
    await server().generateImage({ ...ok, prompt: 'a sign saying "$(touch pwned)" and `touch pwned2`' });
  } finally {
    process.chdir(cwd);
  }
  assert.equal(fs.existsSync(path.join(home, 'pwned')), false);
  assert.equal(fs.existsSync(path.join(home, 'pwned2')), false);
  const sent = fs.readFileSync(path.join(home, 'last-prompt.txt'), 'utf8');
  assert.ok(sent.includes('"$(touch pwned)" and `touch pwned2`'));
  assert.ok(sent.includes('Do NOT use run_command'));
});

test('4 SUCCESS without an image is a quota error', async () => {
  const home = freshHome();
  process.env.FAKE_QUOTA = '1';
  await assert.rejects(server().generateImage(ok), /quota/i);
  assert.equal(fs.existsSync(outDir(home)) && fs.readdirSync(outDir(home)).length > 0, false);
});

test('5 bad arguments are rejected before agy -p runs', async () => {
  const home = freshHome();
  const bad = [
    { ...ok, model: 'made-up-model' },
    { ...ok, model: undefined },
    { ...ok, prompt: '' },
    { ...ok, aspect_ratio: 'wide' },
    { ...ok, count: 0 },
    { ...ok, count: 5 },
    { ...ok, reference_image: path.join(home, 'missing.jpg') },
    { ...ok, reference_image: 'relative.jpg' },
  ];
  for (const args of bad) await assert.rejects(server().generateImage(args), Error, JSON.stringify(args));
  assert.equal(fs.existsSync(path.join(home, 'last-prompt.txt')), false);
});

test('5b edit mode uses the reference path and the edit template', async () => {
  const home = freshHome();
  const ref = path.join(home, 'my ref.jpg');
  fs.writeFileSync(ref, 'x');
  await server().generateImage({ ...ok, prompt: 'make it night', reference_image: ref });
  const sent = fs.readFileSync(path.join(home, 'last-prompt.txt'), 'utf8');
  assert.ok(sent.includes(`EDIT the existing image at ${ref}: make it night`));
});

test('6 protocol over stdio', async () => {
  const home = freshHome();
  const child = spawn(process.execPath, [ENTRY], { env: process.env });
  const lines = [];
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      lines.push(JSON.parse(buf.slice(0, i)));
      buf = buf.slice(i + 1);
    }
  });
  const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'generate_image', arguments: ok } });
  send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'generate_image', arguments: { prompt: 'x' } } });
  send({ jsonrpc: '2.0', id: 5, method: 'no/such' });
  const deadline = Date.now() + 10000;
  while (lines.length < 5 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  child.kill();
  const by = Object.fromEntries(lines.map((l) => [l.id, l]));
  assert.equal(by[1].result.protocolVersion, '2025-06-18');
  assert.ok(by[1].result.capabilities.tools);
  assert.deepEqual(by[2].result.tools.map((t) => t.name).sort(), ['generate_image', 'list_models']);
  assert.deepEqual(by[2].result.tools.find((t) => t.name === 'generate_image').inputSchema.required, ['prompt', 'model']);
  assert.equal(by[3].result.isError, undefined);
  assert.equal(by[3].result.content[0].type, 'text');
  assert.equal(by[3].result.content[1].type, 'image');
  assert.equal(by[3].result.content[1].mimeType, 'image/jpeg');
  assert.equal(by[4].result.isError, true);
  assert.equal(by[5].error.code, -32601);
  assert.equal(fs.readdirSync(outDir(home)).length, 1);
});

test('7 entry starts when loaded by another script, as Claude desktop does', async () => {
  freshHome();
  // Loading the entry via -e makes require.main differ from the entry module.
  const child = spawn(process.execPath, ['-e', `require(${JSON.stringify(ENTRY)})`], { env: process.env });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) + '\n');
  const deadline = Date.now() + 5000;
  while (!out.includes('\n') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  child.kill();
  assert.equal(JSON.parse(out.split('\n')[0]).id, 0);
});
