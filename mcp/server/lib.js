'use strict';
// MCP server (stdio, newline-delimited JSON-RPC) that drives the user's own logged-in `agy` CLI.
// shortcut: hand-rolled protocol with no SDK, covers initialize/ping/tools only; switch to
// @modelcontextprotocol/sdk if the server ever needs resources, prompts or streaming.

const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const VERSION = '0.1.1';
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const INLINE_LIMIT = 700 * 1024; // bytes of image shown inline per call; the rest are returned as paths
const ENGINE_NOTE =
  'Images are always drawn by Nano Banana 2 (gemini-3.1-flash-image). The chosen model only writes the brief for it.';
const SIGN_IN_HELP =
  'Open a terminal, run `agy` with no arguments, sign in with your own Google account, then try again.';

const outDir = () => path.join(os.homedir(), 'Pictures', 'agy-images');
const brainDir = (id) => path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain', id);

function agyCandidates() {
  const configured = process.env.AGY_PATH;
  const list = [];
  // An unset optional setting can arrive as the literal "${user_config.agy_path}".
  if (configured && !configured.startsWith('${')) list.push(configured);
  list.push(
    'agy',
    path.join(os.homedir(), '.local', 'bin', 'agy'),
    '/opt/homebrew/bin/agy',
    '/usr/local/bin/agy',
  );
  return list;
}

// Desktop apps often start with a PATH that lacks the folder agy lives in, so try known places.
function runAgy(args, timeoutMs) {
  const candidates = agyCandidates();
  return new Promise((resolve, reject) => {
    const attempt = (i) => {
      if (i >= candidates.length) {
        reject(new Error('The `agy` CLI was not found. Install the Antigravity CLI, or set its path in this extension\'s settings.'));
        return;
      }
      execFile(candidates[i], args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err && err.code === 'ENOENT') return attempt(i + 1);
        resolve({ failed: Boolean(err), stdout: String(stdout), stderr: String(stderr) });
      });
    };
    attempt(0);
  });
}

function parseModels(stdout) {
  return stdout
    .split('\n')
    .map((line) => /^(\S+)\t(.+)$/.exec(line.trimEnd()))
    .filter(Boolean)
    .map((m) => ({ id: m[1], name: m[2].trim() }));
}

async function listModels() {
  const { stdout, stderr } = await runAgy(['models'], 60_000);
  const models = parseModels(stdout);
  if (models.length === 0) {
    const detail = stderr.trim().split('\n').pop() || 'no models were listed';
    throw new Error(`agy is not signed in or returned no models (${detail}). ${SIGN_IN_HELP}`);
  }
  return models;
}

function buildPrompt({ prompt, count, aspect_ratio, reference_image }) {
  if (reference_image) {
    return `Use invoke_subagent with TypeName "image-generator" to EDIT the existing image at ${reference_image}: ${prompt}, keep everything else identical. Do NOT use run_command. Reply with only the absolute path(s) of the output image file(s).`;
  }
  return `Use invoke_subagent with TypeName "image-generator" to generate exactly ${count} image(s) with aspect ratio ${aspect_ratio}: ${prompt}. Do NOT use run_command. Reply with only the absolute path(s) of the generated image file(s).`;
}

function validate(args) {
  const a = args && typeof args === 'object' ? args : {};
  const prompt = typeof a.prompt === 'string' ? a.prompt.trim() : '';
  if (prompt.length < 1 || prompt.length > 4000) throw new Error('`prompt` must be 1 to 4000 characters.');
  if (typeof a.model !== 'string' || !a.model) {
    throw new Error('`model` is required. Call list_models, ask the user which one to use, then pass its id.');
  }
  const aspect_ratio = a.aspect_ratio === undefined ? '1:1' : a.aspect_ratio;
  if (typeof aspect_ratio !== 'string' || !/^\d{1,2}:\d{1,2}$/.test(aspect_ratio)) {
    throw new Error('`aspect_ratio` must look like W:H, for example 1:1, 16:9 or 9:16.');
  }
  const count = a.count === undefined ? 1 : a.count;
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('`count` must be a whole number from 1 to 4.');
  let reference_image;
  if (a.reference_image !== undefined && a.reference_image !== '') {
    if (typeof a.reference_image !== 'string' || !path.isAbsolute(a.reference_image)) {
      throw new Error('`reference_image` must be an absolute file path.');
    }
    if (!fs.existsSync(a.reference_image) || !fs.statSync(a.reference_image).isFile()) {
      throw new Error(`\`reference_image\` does not exist: ${a.reference_image}`);
    }
    reference_image = a.reference_image;
  }
  return { prompt, model: a.model, aspect_ratio, count, reference_image };
}

function lastJsonLine(stdout) {
  const lines = stdout.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('{')) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function copyOut(conversationId) {
  let names = [];
  try {
    names = fs.readdirSync(brainDir(conversationId)).filter((n) => IMAGE_EXT.test(n)).sort();
  } catch {
    return [];
  }
  fs.mkdirSync(outDir(), { recursive: true });
  const ts = stamp();
  const files = [];
  let k = 1;
  for (const name of names) {
    const ext = path.extname(name).slice(1).toLowerCase();
    for (;;) {
      const dest = path.join(outDir(), `${ts}-${k}.${ext}`);
      k += 1;
      try {
        fs.copyFileSync(path.join(brainDir(conversationId), name), dest, fs.constants.COPYFILE_EXCL);
        files.push(dest);
        break;
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
    }
  }
  return files;
}

async function generateImage(rawArgs) {
  const args = validate(rawArgs);
  const models = await listModels();
  if (!models.some((m) => m.id === args.model)) {
    throw new Error(`Unknown model "${args.model}". Use one of: ${models.map((m) => m.id).join(', ')}`);
  }
  const { stdout, stderr } = await runAgy(
    ['-p', buildPrompt(args), '--model', args.model, '--output-format', 'json', '--print-timeout', '300s'],
    330_000,
  );
  const result = lastJsonLine(stdout);
  if (!result) {
    throw new Error(`agy returned no result. ${stderr.trim().split('\n').slice(-3).join(' ')}`.trim());
  }
  const response = String(result.response || '').trim();
  const denied = Array.isArray(result.denied_actions) && result.denied_actions.length > 0;
  const idOk = typeof result.conversation_id === 'string' && /^[0-9a-f-]{36}$/.test(result.conversation_id);
  const files = result.status === 'SUCCESS' && !denied && idOk ? copyOut(result.conversation_id) : [];
  if (files.length === 0) {
    // agy reports SUCCESS even when nothing was drawn, so the copied files are the real test.
    if (/quota|429|RESOURCE_EXHAUSTED/i.test(response)) {
      throw new Error(`The agy image quota is used up. Switching model does not help: every model uses the same image engine. agy said: ${response}`);
    }
    if (denied) throw new Error(`agy refused an action in headless mode (${JSON.stringify(result.denied_actions)}). Ask again. agy said: ${response}`);
    throw new Error(`No image was produced (status ${result.status}). agy said: ${response || '(nothing)'}`);
  }
  return { files, model: args.model, requested: args.reference_image ? 1 : args.count };
}

const TOOLS = [
  {
    name: 'list_models',
    description:
      'List the agy models this account can use. Call this before every generate_image, show the list to the user, and ask them which model to use. Never pick for them and never reuse an earlier choice. ' +
      ENGINE_NOTE,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'generate_image',
    description:
      'Generate or edit images with the user\'s own logged-in agy CLI (spends their agy image quota; takes 30-90 seconds). ' +
      'Before calling: rewrite the user\'s request as one detailed English image prompt and show it to them, call list_models, and ask which model and aspect ratio they want. ' +
      'Pass reference_image to edit an existing picture; prompt is then only the change. On failure, report the error and do not call again unless the user asks. ' +
      ENGINE_NOTE,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed English image prompt, or the change to make in edit mode.' },
        model: { type: 'string', description: 'A model id from list_models, chosen by the user.' },
        aspect_ratio: { type: 'string', description: 'W:H such as 1:1, 16:9, 9:16, 4:3. Default 1:1. Ignored when editing.' },
        count: { type: 'integer', minimum: 1, maximum: 4, description: 'How many images. Default 1.' },
        reference_image: { type: 'string', description: 'Absolute path of an existing image to edit.' },
      },
      required: ['prompt', 'model'],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args) {
  if (name === 'list_models') {
    const models = await listModels();
    const rows = models.map((m, i) => `${i + 1}. ${m.name} (id: ${m.id})`).join('\n');
    return [{ type: 'text', text: `${rows}\n\n${ENGINE_NOTE}\nAsk the user which model to use before generating.` }];
  }
  if (name === 'generate_image') {
    const { files, model, requested } = await generateImage(args);
    const content = [
      {
        type: 'text',
        text: `Saved ${files.length} of ${requested} requested image(s):\n${files.join('\n')}\nBrief written by ${model}; drawn by Nano Banana 2. Tell the user these paths; only some images may be shown inline.`,
      },
    ];
    let budget = INLINE_LIMIT; // shared by all images: clients cap the size of one tool result
    for (const file of files) {
      const size = fs.statSync(file).size;
      if (size <= budget) {
        budget -= size;
        content.push({
          type: 'image',
          data: fs.readFileSync(file).toString('base64'),
          mimeType: MIME[path.extname(file).slice(1)],
        });
      }
    }
    return content;
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(msg) {
  if (!msg || typeof msg !== 'object' || msg.id === undefined || msg.id === null) return null; // notification
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'agy-image', version: VERSION },
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call':
      try {
        const params = msg.params || {};
        return reply({ content: await callTool(params.name, params.arguments) });
      } catch (err) {
        return reply({ content: [{ type: 'text', text: err.message }], isError: true });
      }
    default:
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } };
  }
}

function main() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      return;
    }
    const out = await handle(msg);
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
  });
}

module.exports = { parseModels, buildPrompt, listModels, generateImage, handle, main };
