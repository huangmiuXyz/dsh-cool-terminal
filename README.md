![dsh-cool-terminal cover](https://cdn.cooltea.top/dsh-cool-terminal/readme-cover-v0.4.0.png)

# dsh-cool-terminal

English · [中文](./README.zh.md)

![license: MIT](https://img.shields.io/badge/license-MIT-green) ![node: >=22.19](https://img.shields.io/badge/node-%3E%3D22.19-blue)

## Description

DeepSeek Harness terminal plugin — a real shell, workspace sync, persistent state, common-command management, and command completion.

## Features

- **Grouped by workspace** — Consoles are grouped by your DSH Workspaces automatically, each folder shows its terminal count, and the whole sidebar can collapse out of view.
- **Persistent across sessions and reloads** — Shell sessions, scrollback, and the current path are preserved across conversation switches and page reloads, picking up right where you left off.
- **Per-console command history** — Each console keeps its own history; pressing `↑` never pulls in commands from other consoles.
- **Common command management** — Add, edit, delete, and use the common commands you create.
- **Open the live directory** — Open the directory a console is currently in directly in your desktop file manager, even after it has changed with `cd`.
- **Compact terminal header** — Shows the active terminal's name with tiny icon actions for renaming it, opening its current directory, and closing it.
- **Inline command completion** — Typing in a console pops matching common commands up under the caret; hovering a row or pressing `↑`/`↓` selects one, and `Enter` fills it into the command line without running it.
- **Bilingual (English / Chinese)** — Every string the plugin renders follows DSH's language setting and switches live, with new console names minted in the language on screen.
- **Right sidebar** — The same terminal workbench is also a dockable right-sidebar tab; switching sessions or collapsing the panel keeps every shell running.

## Installation

Use DSH's add-plugin feature and enter the package name: `dsh-cool-terminal`.

## Current limitations

- Consoles run a real local shell as the DSH process user — this is not the confined one-shot shell, so treat them as a localhost-trusted environment.
- Consoles are process-local and do not survive a DSH restart.
- A console's size follows the pane that currently shows it; when the same console is visible in two places at once, the last pane to re-measure wins.
- The right-sidebar tab is opened once per session from the guide page; the layout belongs to that session.
- Closing the terminal tab detaches its screen but does not end the shells; they are ended by deleting a console or unloading the plugin.

## Contributing

Contributions via Issues and PRs are welcome.

```
// Clone project
git clone https://github.com/CoolTea001/dsh-cool-terminal.git

// Install dependencies
cd dsh-cool-terminal
pnpm install

// Start local development
pnpm run dev

// Local install: use DSH's add-plugin feature and enter the local project path

// Restart DSH service
dsh web
```

## License

MIT © CoolTea
