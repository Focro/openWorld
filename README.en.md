<div align="center">

# OpenWorld

**A text RPG with a living world, fair rules and an AI narrator.**

[![Version](https://img.shields.io/github/package-json/v/Focro/openWorld?label=version&color=5b7c99)](https://github.com/Focro/openWorld/releases)
[![Tests](https://img.shields.io/github/actions/workflow/status/Focro/openWorld/ci.yml?branch=main&label=tests)](https://github.com/Focro/openWorld/actions)
[![License](https://img.shields.io/badge/license-all_rights_reserved-7a9a7e)](LICENSE)

[**Play in your browser**](https://focro.github.io/openWorld/) · [Changelog](CHANGELOG.md) · [Русский](README.md)

</div>

---

## What it is

OpenWorld is a platform for text role-playing games with many worlds. You describe what your character does in plain words. The engine checks whether it is possible and updates the world by its rules. The AI understands your free-form phrases, and next it will become the narrator: describing scenes and speaking for the people of the world, each with their own voice, age and temperament.

The first world is **Veloria**: six nations, each with its own government, peoples, faith and noble houses. You can be born into an ordinary family on the edge of Roven, or in a palace, and live a whole life.

It is made to be played on a phone, right in the browser, with nothing to install.

## What makes it different

- **A living world.** People have schedules, habits, memories and relationships with each other. Rumors spread and fade. The town goes on while you sleep.
- **Fair rules.** The AI cannot simply hand you gold or a victory. Everything it suggests goes through the engine: time, money, age, distance and the laws of the world.
- **Life from birth.** A baby cannot talk, a child cannot be a blacksmith, and personality grows from experience. Every child develops at their own pace.
- **Consequences.** Told the town square you came from another world? People heard you, and that can end badly. Death is final, but you can continue as an heir.
- **Your own AI key.** Each player connects their own key (DeepSeek, Claude, OpenAI or OpenRouter). The key is encrypted with your password in the browser and is never stored in plain text. Without a key the game runs on text commands.
- **Token friendly.** The engine understands simple actions by itself, without calling the AI, so even free limits last a long time.

## The world of Veloria

| | |
| --- | --- |
| Nations | Estran (crown), Sahrad (sultanate), Tarvek (elected Conclave), Varent (Trade League), Elindor (League of Woods and Lakes), Kharum (empire) |
| Map | 8 regions, 30 settlements, 31 routes, seasonal mountain passes |
| Society | 30 noble houses, clergy of six traditions, distinct names and looks for every people |
| Start | 16 backgrounds, from orphan to heir of a great house |

## How to play

1. Open [focro.github.io/openWorld](https://focro.github.io/openWorld/) on your phone or computer.
2. Create a character: background, family, age, temperament.
3. Type actions in plain words: "I go to the market", "I ask the baker for news".
4. AI is optional. To type completely freely, connect your own key in the AI settings (for now this needs your own proxy server, see `server/`).

The game is in Russian for now. English is planned.

## Status

Early alpha, current version **0.18.0**. Every life starts in childhood: be born in any of the six realms, into one of 57 families, from a stable loft to the royal court, at birth or at an age up to 12. The AI is the narrator: it describes places in a literary way and speaks for residents, each with their own voice, goals and morals, and it never decides for your hero. Accounts and a shared server are the next big step. Detailed town life exists only in Roven so far. Combat, illness and trials are still ahead. See the [CHANGELOG](CHANGELOG.md) for what changed in each version (in Russian).

## For developers

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # run locally
npm test         # tests
npm run build    # build for GitHub Pages
```

Stack: React, TypeScript, Vite, Vitest. The engine (`src/engine/`) is kept separate from the worlds (`src/worlds/`), so new worlds can be added without touching the rules. The AI proxy server lives in `server/`. Technical docs are in [docs/](docs/) (in Russian).

## Feedback

Found a bug or have an idea? [Open an issue](https://github.com/Focro/openWorld/issues/new/choose), I read everything.

## License

All rights reserved. Author: [Focro](https://github.com/Focro). The code and the world of Veloria are open to view and play, but may be copied or used only with the author's permission. See [LICENSE](LICENSE).
