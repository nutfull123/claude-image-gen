---
name: agy-image
description: Generate or edit images through the user's own logged-in Antigravity CLI (agy). Use when the user asks to create, draw, generate or edit an image with agy or Antigravity, or invokes /agy-image. Asks which model to use before every run, then shows the saved image.
---

# agy-image

Generate or edit images by driving the user's own `agy` CLI in headless mode. `agy` uses the
user's Antigravity subscription, so every run spends their quota: one run per request, no retries.

Follow the steps in order. Speak and label dialog options in the user's language.

## Hard rules

- Never pass `--dangerously-skip-permissions` to `agy`.
- Never read, store, or ask for credentials. Login is something the user does in `agy` themselves.
- Never hardcode or guess a model id. Only use ids printed by `agy models` in this run.
- Ask for the model every run, even if the user picked one a moment ago.
- The user's text never goes on a shell command line. It goes into a file, and the command reads the file.
- If a run fails, report it and stop. Do not run `agy` again unless the user asks.

## 1. Preflight

Run:

```bash
command -v agy && agy models
```

If `agy` is not found, the command fails, or no model rows are printed: stop here. Tell the user to
install the Antigravity CLI, run `agy` once in a terminal to log in, then try again. Ask nothing else.

Each row is `<id><TAB><Family> (<Level>)`, for example `gemini-4-argon-low	Gemini 4 Argon (Low)`.
Keep the rows; steps 4 and 5 are built from them.

## 2. Read the request

Decide:

- **Mode.** `edit` if the user points at an existing image file to change; otherwise `generate`.
- **Count N.** 1, unless the user asked for a specific number of images.
- **Edit only:** resolve the image path to an absolute path and run `test -f "<path>"`. If it does
  not exist, say so and stop.

## 3. Refine the prompt

Rewrite the user's description as one detailed English image prompt: subject, setting, style,
lighting, composition. Keep what they asked for; do not add subjects they did not mention. In edit
mode, write only the change. Show the final prompt to the user before asking anything.

## 4. Dialog 1: provider and aspect ratio

One `AskUserQuestion` call with:

- **Provider**: one option per distinct first word of the family names (for example Gemini, Claude,
  GPT-OSS). Skip this question if there is only one.
- **Aspect ratio** (generate mode only): `1:1`, `16:9` (landscape), `9:16` (portrait), `4:3`. If the
  user types another value, accept it only if it looks like `W:H` with one- or two-digit numbers
  (for example `3:4`, `21:9`); otherwise ask again. Edit mode keeps the original ratio: do not ask.

## 5. Dialog 2: model and level

One `AskUserQuestion` call with:

- **Model**: the families of the chosen provider, without the level (for example `Gemini 4 Argon`,
  `Gemini 3.8 Flash`).
- **Level**: the levels that exist for those families (for example Low, Medium, High).

The chosen model is the agent that briefs agy's built-in image generator. It affects how the brief
is written and how fast the run is, not which image engine draws. Say so if the user asks which
model gives the best picture.

Skip any question that has a single option. The model id is the row whose name is exactly
`<Family> (<Level>)`. If that pair has no row, say so and ask again. If there are more than four
options for a question, list them as numbered text in chat and let the user answer with a number.

## 6. Run agy

Fill one template. Replace only the `<...>` parts.

Generate:

```
Use invoke_subagent with TypeName "image-generator" to generate exactly <N> image(s) with aspect ratio <RATIO>: <PROMPT>. Do NOT use run_command. Reply with only the absolute path(s) of the generated image file(s).
```

Edit:

```
Use invoke_subagent with TypeName "image-generator" to EDIT the existing image at <ABSOLUTE_PATH>: <CHANGE>, keep everything else identical. Do NOT use run_command. Reply with only the absolute path(s) of the output image file(s).
```

Save the filled template to `./generated-images/.agy-prompt.txt` with the file-writing tool (not
`echo`, not a heredoc). Then run from the project directory with a shell timeout of at least 330
seconds, substituting only the model id:

```bash
agy -p "$(cat ./generated-images/.agy-prompt.txt)" --model <MODEL_ID> --output-format json --print-timeout 300s; rm -f ./generated-images/.agy-prompt.txt
```

Tell the user it usually takes 30 to 90 seconds.

## 7. Judge the result

The last line of stdout is a JSON object. The run succeeded only if all of these hold:

- `status` is `SUCCESS`
- `denied_actions` is missing or empty
- `conversation_id` matches `^[0-9a-f-]{36}$`
- step 8 copies at least one image

Otherwise show the user `status`, `response`, `denied_actions` and anything `agy` printed to
stderr, and stop. Do not retry.

`agy` reports `SUCCESS` even when no image was made, so the copied-image check is the real test.
The usual cause is the image quota: if `response` mentions a quota, `429` or `RESOURCE_EXHAUSTED`,
tell the user their agy image quota is used up and when it resets if `response` says. Picking
another model does not help: every model hands the drawing to the same built-in image generator.

## 8. Deliver

Run, substituting only the conversation id:

```bash
id=<CONVERSATION_ID>; ts=$(date +%Y%m%d-%H%M%S); k=1
find "$HOME/.gemini/antigravity-cli/brain/$id" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) | while IFS= read -r f; do
  ext="${f##*.}"
  while [ -e "generated-images/$ts-$k.$ext" ]; do k=$((k+1)); done
  cp -n "$f" "generated-images/$ts-$k.$ext" && echo "generated-images/$ts-$k.$ext"
  k=$((k+1))
done
```

Each printed line is a saved image. If nothing is printed, that is a failure: go back to step 7's
failure report.

Show every saved image to the user: use the file-sending tool if this session has one, otherwise
give a markdown link and the path. Then say which model was used and how many images were
delivered versus requested.
