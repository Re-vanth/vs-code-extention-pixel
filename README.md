# Copilot Pixel Companion

> Your AI coding buddy, one pixel at a time.

A VS Code extension that puts a small animated pixel-art character in the Activity Bar. The character reacts to activity it can actually observe in your editor, and it always tells you *how* it knows what it knows.

![Character preview](media/icon.png)

---

## Table of contents

- [What it does](#what-it-does)
- [Honest activity detection](#honest-activity-detection)
  - [Direct signals](#direct-signals)
  - [Inferred signals](#inferred-signals)
  - [Manual signals](#manual-signals)
  - [What this extension deliberately does not do](#what-this-extension-deliberately-does-not-do)
- [Characters](#characters)
- [Environments](#environments)
- [Installation](#installation)
- [Commands](#commands)
- [Settings](#settings)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Development](#development)
- [Building and packaging](#building-and-packaging)
- [Testing](#testing)
- [Privacy and security](#privacy-and-security)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## What it does

Copilot Pixel Companion ships a webview view in the Activity Bar containing:

- **An animated character** with ten states — idle, thinking, typing, coding, reviewing, success, error, waiting, paused and sleeping.
- **A status line** describing what the character is doing, in character ("Byte is thinking...").
- **A confidence badge** on every activity: `direct`, `inferred`, `manual` or `none`.
- **An activity timeline** listing recent events with their source and detection confidence.
- **A diagnostics panel** showing which integrations are available and why any are not.
- **Controls** for switching character, environment and animation mode, plus a manual state picker.

An optional status bar item mirrors the current state, and every visual can be turned off individually.

---

## Honest activity detection

This is the part of the extension that matters most, so it is worth reading carefully.

**VS Code's stable extension API does not expose chat request or chat response lifecycle events.** There is no `onDidSubmitChatRequest`, no `onDidChangeChatSession`, and no Copilot-specific progress API in the published `vscode` typings — this was verified against `@types/vscode` 1.85 (this extension's engine target) and against the newest 1.140 release. An extension therefore *cannot* observe when Copilot starts streaming a response, and it equally *cannot* observe a genuine completion signal.

Rather than pretend otherwise, this extension splits every signal into two clearly-labelled categories, and the UI always shows which one produced the current state.

### Direct signals

Reported as `direct`. These come from APIs that explicitly name Copilot or the language model, so attributing them to Copilot is factually correct.

| Signal | Source | What it really means |
| --- | --- | --- |
| `vscode.lm.onDidChangeChatModels` | `copilot-chat` | The chat model registry changed. This happens when Copilot registers or switches models. It is **not** a request-start signal. |
| `vscode.lm.registerTool` invocation | `copilot-tools` | A tool registered by this extension was invoked *by* the language model. This is the one genuinely Copilot-driven signal an extension can produce. |
| Copilot extension presence | — | Reported in diagnostics: whether `github.copilot`, `github.copilot-chat` or `github.copilot-chat-ui` is installed. |

### Inferred signals

Reported as `inferred`. These are generic VS Code events that are *consistent* with AI-assisted work but do not prove it. A human typing produces exactly the same events.

| Signal | Source | What it really means |
| --- | --- | --- |
| Document edits (debounced 700 ms) | `vscode-editor` | Something changed a document. Could be you, could be Copilot. |
| Document saves | `vscode-editor` | A file was saved. |
| Active editor changed | `vscode-workspace` | Focus moved. |
| Task started / ended | `vscode-task` | A VS Code task ran. |

Inferred activity expires automatically after `copilotPixelCompanion.activityTimeoutSeconds` (default 30 s). It is never treated as proof that anything completed, and it can be disabled entirely with `copilotPixelCompanion.showInferredActivity`.

### Manual signals

Reported as `manual`. You picked the state, so there is nothing to infer.

### What this extension deliberately does not do

- **No fabricated progress percentage.** There is no percentage bar, no spinner claiming to track generation, and no "42% complete" anywhere in the UI. VS Code exposes no real progress signal, so any such number would be fiction.
- **No claiming to have detected a Copilot request** when only unrelated document edits were observed. An edit-driven state is always labelled `inferred`.
- **No reading of Copilot internals.** The extension does not open Copilot's storage files, extension databases, logs or caches.
- **No token or credential extraction** from any other extension.
- **No inspection of Copilot's reasoning** or hidden tool execution.
- **No network requests.** Everything works fully offline after install.

---

## Characters

| Character | Description |
| --- | --- |
| **Byte** (default) | A tiny purple and cyan robotic cat. Ears, tail and a swappable set of props — a keyboard, a document, a magnifying glass. |
| **Pixel** | A small floating ghost with a trailing wisp and a soft glow. |
| **Bugsy** | A tiny green bug-like robot with antennae and a segmented shell. |

Every character has hand-authored sprites for all ten states. The art is generated procedurally by a script (`npm run assets`) that writes plain PNG files with no third-party dependencies — the pixels live in the repository, they are never fetched at runtime.

Adding a character requires no code changes: drop a folder with a `manifest.json` into `media/sprites/` and it shows up in the picker.

---

## Environments

Three pixel-art backdrops are bundled:

- **Cozy Desk** — a warm lit desk with a monitor (default)
- **Night Studio** — a dark room with city lights outside
- **Pixel Garden** — a quiet outdoor scene with plants

---

## Installation

### From a `.vsix` package

```bash
code --install-extension vscode-copilot-pixel-companion-0.1.0.vsix
```

Or in VS Code: open the Extensions view, choose **...** > **Install from VSIX...**, and pick the file.

### Requirements

- VS Code **1.85.0** or newer.
- GitHub Copilot is *optional*. Without it the extension still runs — the companion simply falls back to inferred signals, and the diagnostics panel explains exactly which integrations are unavailable.

---

## Commands

All commands are available from the Command Palette under the **Copilot Pixel Companion** category.

| Command | ID | Description |
| --- | --- | --- |
| Show Companion | `copilotPixelCompanion.show` | Reveals the Activity Bar container and focuses the view. |
| Hide Companion | `copilotPixelCompanion.hide` | Closes the side bar. |
| Toggle Companion | `copilotPixelCompanion.toggle` | Shows or hides the view depending on current visibility. |
| Set Character | `copilotPixelCompanion.setCharacter` | Quick-picks a character. |
| Set Environment | `copilotPixelCompanion.setEnvironment` | Quick-picks a backdrop. |
| Toggle Animations | `copilotPixelCompanion.setAnimationEnabled` | Flips `animationsEnabled`. |
| Set Manual State | `copilotPixelCompanion.setManualState` | Picks a state by hand. Enables manual mode. |
| Clear Activity History | `copilotPixelCompanion.clearActivityHistory` | Empties the timeline. |
| Reset Settings | `copilotPixelCompanion.resetSettings` | Restores every setting to its packaged default (with confirmation). |
| Show Diagnostics | `copilotPixelCompanion.showDiagnostics` | Writes adapter availability to the output channel and opens the settings. |

---

## Settings

All settings live under the `copilotPixelCompanion` section.

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Master switch. When off, no views or status bar items are created. |
| `character` | string | `byte` | Which character to show. One of `byte`, `pixel`, `bugsy`. |
| `environment` | string | `cozyDesk` | Which backdrop to show. One of `cozyDesk`, `nightStudio`, `pixelGarden`. |
| `animationsEnabled` | boolean | `true` | When off, the character renders a static pose. |
| `animationSpeed` | string | `normal` | `slow`, `normal` or `fast`. |
| `characterSize` | string | `medium` | `small`, `medium` or `large`. |
| `reducedMotion` | boolean | `false` | Disables non-essential animation and particle effects. |
| `showStatusBar` | boolean | `true` | Show the status bar item. |
| `showElapsedTime` | boolean | `true` | Show how long the current observed activity has been running. Elapsed time is **not** task progress. |
| `showActivityTimeline` | boolean | `true` | Show the timeline panel. |
| `showInferredActivity` | boolean | `true` | Allow generic editor activity to drive the character. Always labelled as inferred. |
| `manualMode` | boolean | `false` | Drive the state manually. Automatic detection is suspended. |
| `activityTimeoutSeconds` | number | `30` | Seconds before stale inferred activity expires. Never treated as proof of completion. |
| `persistActivityHistory` | boolean | `false` | Keep the timeline between sessions in local extension storage. Only sanitized labels and timestamps. |
| `showActivityDetails` | boolean | `true` | Show the source and detection confidence. |
| `maxActivityHistory` | number | `20` | Maximum timeline entries kept in memory. |

---

## Architecture

```
Copilot activity sources
        │
        ▼
Activity adapters ──────► normalized ActivityEvent
        │
        ▼
ActivityManager ────────► ActivityStateMachine (deterministic FSM)
        │                              │
        │                              ▼
        │                    ActivityState + timeline
        ▼
CompanionViewProvider ──► typed message protocol ──► webview
                                                     │
                                                     ▼
                                            AnimationController
                                            SpriteRenderer
                                            ParticleSystem
```

- **Adapters** observe one VS Code surface each and translate it into the shared `ActivityEvent` vocabulary. They know nothing about characters or the webview.
- **`ActivityManager`** owns the adapters, correlates events by activity id, expires stale inferred activity, and keeps a bounded timeline.
- **`ActivityStateMachine`** reduces concurrent activities to one character state using a fixed priority table. Success and error are *overlays* — they play on top of the current state and then revert, rather than replacing it.
- **The webview** is a pure renderer. It never infers activity, and every message it receives is validated against a typed protocol before it is applied.

Adding a new detection source means writing one adapter and registering it in `src/extension.ts`. Nothing else changes.

### Activity correlation

Events are correlated by `id`. A `completed` or `failed` event for an unknown id is ignored, so a late-arriving completion can never terminate a newer activity. This is covered by unit tests.

### Priority

When several activities overlap, the highest-priority state wins:

```
error (100) > thinking (90) = coding (90) > typing (85) > waiting (70)
              > reviewing (60) > success (50) > sleeping (30) > paused (25)
              > unknown (20) > idle (10)
```

---

## Project layout

```
vscode-copilot-pixel-companion/
├── src/
│   ├── activity/
│   │   ├── activityTypes.ts          # shared vocabulary, priority table, labels
│   │   ├── activityStateMachine.ts   # deterministic FSM, activity correlation
│   │   ├── activityManager.ts        # adapter ownership, history, expiry
│   │   ├── copilotActivityAdapter.ts # Copilot + language-model-tool signals
│   │   ├── editorActivityAdapter.ts  # inferred editor signals
│   │   └── manualActivityAdapter.ts  # user-driven states
│   ├── character/
│   │   ├── characterTypes.ts
│   │   └── characterRegistry.ts      # manifest-driven sprite discovery
│   ├── commands/commandManager.ts    # every contributed command
│   ├── configuration/configurationManager.ts
│   ├── protocol/messages.ts          # typed protocol + runtime validation
│   ├── utilities/logger.ts
│   ├── views/
│   │   ├── companionViewProvider.ts  # webview view, CSP, HTML
│   │   └── statusBarManager.ts
│   └── extension.ts
├── webview/
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── components/companionApp.ts
│       ├── renderer/
│       │   ├── animationController.ts
│       │   ├── spriteRenderer.ts
│       │   └── particleSystem.ts
│       └── styles/main.css
├── media/
│   ├── activity-bar-icon.svg
│   ├── environments/
│   └── sprites/{byte,pixel,bugsy}/
├── test/
│   ├── unit/                         # plain Node, no VS Code host needed
│   └── suite/                        # integration, runs inside VS Code
├── tools/
│   ├── generate-assets.js            # procedural pixel art + PNG encoder
│   ├── lib/png.js                    # dependency-free PNG encoder
│   ├── preview.js                    # contact-sheet preview renderer
│   ├── runUnitTests.js
│   ├── unitSetup.js                  # installs the `vscode` module stub
│   └── vscodeMock.js
├── esbuild.js
└── package.json
```

---

## Development

```bash
npm install
npm run compile        # type-check + bundle
```

Then press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with the extension loaded.

Useful scripts:

```bash
npm run assets        # regenerate all sprite sheets and environments
npm run compile       # tsc for the extension, tsc --noEmit for the webview, esbuild bundle
npm run watch         # tsc in watch mode
npm run lint          # eslint over src, webview/src and test
npm test              # unit tests (pretest compiles first)
npm run test:unit     # unit tests only
npm run test:integration   # integration tests inside a real VS Code
```

### Regenerating the artwork

All sprites are drawn in code by `tools/generate-assets.js` — rectangles, ellipses, triangles and lines on a 32×32 grid, plus a small PNG encoder in `tools/lib/png.js` (zlib deflate + CRC32, no dependencies). To preview the result:

```bash
node tools/preview.js byte    # writes out/preview-byte.png
```

The contact sheet has one row per state, frames left to right, on a checkerboard background so you can see the alpha channel.

### Testing without Copilot installed

The extension does not require Copilot. Without it:

- The Copilot adapter reports itself as unavailable in diagnostics.
- The character reacts to inferred editor activity only, and the badge reads `inferred`.
- Manual mode works exactly the same.

This is the expected configuration in CI, and the integration tests run in it.

---

## Building and packaging

```bash
npm run compile
npm run package        # produces vscode-copilot-pixel-companion-0.1.0.vsix
```

`npm run package` uses `vsce package --no-dependencies`, since the extension has no runtime dependencies. The `.vsix` is written to the project root.

Install it with:

```bash
code --install-extension vscode-copilot-pixel-companion-0.1.0.vsix
```

---

## Testing

**Unit tests** cover the parts that do not need a VS Code host. They stub the `vscode` module through `Module._load` interception, so they run in plain Node and are fast:

- `activityStateMachine.test.ts` — state transitions, activity correlation, stale-completion rejection, overlay behaviour, expiry rules.
- `activityManager.test.ts` — adapter lifecycle, history bounds, notification behaviour.
- `animationController.test.ts` — frame advancement, looping, reduced motion, one-shot completion.
- `messages.test.ts` — protocol validation, rejecting malformed or unexpected payloads.

**Integration tests** (`test/suite/`) run inside a real Extension Development Host and check that the extension activates, contributes its commands, and that the view provider responds to webview messages.

---

## Privacy and security

- **No telemetry.** Nothing is collected or sent anywhere.
- **No network requests.** The extension works fully offline after install. There is no remote script, no CDN and no analytics endpoint.
- **No prompt, response or code access.** The extension never reads chat content, completions, source code, file contents or workspace paths.
- **No file paths in the timeline.** Entries contain a short sanitized label, a source name and a timestamp — nothing more.
- **No reading of other extensions' internals.** Copilot's storage, caches and databases are never opened.
- **No credentials.** Tokens are never read from anywhere.
- **Optional local persistence only.** With `persistActivityHistory` enabled, sanitized labels and timestamps are stored in VS Code's local extension storage. Nothing else is persisted, and it never leaves the machine.
- **Restrictive webview CSP.** `default-src 'none'`, a per-render nonce for the single script tag, and `localResourceRoots` limited to `media/` and `webview/dist/`. There is no `eval`, no remote script and no unsafe HTML insertion.
- **Validated messages in both directions.** Every message the webview sends is checked field by field before it is acted on; every message the extension sends conforms to a typed protocol.
- **No secrets in the repository.** The extension ships no tokens or keys.

---

## Troubleshooting

**The character never leaves idle.**
The most likely cause is that no activity was detected. Open the diagnostics panel (`Copilot Pixel Companion: Show Diagnostics`) and check which adapters are available. If Copilot is not installed, only inferred signals exist — and if `showInferredActivity` is off, nothing will drive the character. Manual mode is the quick way to confirm the renderer works.

**The character reacts to activity I was doing myself.**
That is expected and is the honest behaviour of inferred signals — a manual edit looks exactly like a Copilot edit. The badge reads `inferred` to make that visible. Set `showInferredActivity` to `false` if you would rather only see direct signals.

**The status bar item does not appear.**
`showStatusBar` may be `false`, or `enabled` may be `false`.

**Animations look choppy.**
Try `animationSpeed: fast`, or reduce the character size. `reducedMotion: true` disables particle effects.

**The extension does not activate.**
Check the **Copilot Pixel Companion** output channel (`View` > `Output`, then pick the channel). Activation failures are logged there.

**I want to reset everything.**
Run `Copilot Pixel Companion: Reset Settings`, or clear the extension's stored data via `code --command` is not needed — use the **Reset Settings** command.

---

## Known limitations

- **No true Copilot request lifecycle.** The VS Code API does not expose one, so "thinking" and "typing" states are driven by the best available proxies and are labelled accordingly. This is a platform limitation, not an oversight.
- **No progress percentage.** Deliberately absent. There is no real progress data to show.
- **Inline completions are not detected.** VS Code exposes no event for when an inline suggestion is shown or accepted.
- **The character cannot distinguish you from Copilot** when the only signal is a document edit.
- **Character sprites are fixed.** Ten states per character, authored by hand. There is no runtime animation synthesis.

---

## Contributing

Issues and pull requests are welcome.

1. Fork and clone the repository.
2. `npm install`
3. Make your change in `src/` or `webview/src/`.
4. `npm run compile && npm run lint && npm test`
5. If you touched the artwork, run `npm run assets` and check the result with `node tools/preview.js <character>`.
6. Open a pull request describing what changed and why.

If you are adding a detection source, please preserve the direct/inferred distinction — an adapter that cannot tell the difference should report `inferred`.

---

## License

MIT — see [LICENSE](LICENSE).
