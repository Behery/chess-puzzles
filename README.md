# Chess Puzzle

An installable, offline chess puzzle game for phones and PCs. The first version creates mate-in-one positions locally, shows which side to play, and checks the move using `chess.js`. It works without an account or server.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. To verify a production build:

```sh
npm run build
npm run preview
```

Install the app from your browser while online. Once installed, the app and puzzle generator are cached for offline use.

## Tests

```sh
npm test
npm run test:e2e
```

The unit tests check generated puzzles for both sides and verify every mating move. The browser test loads the production app, reloads offline, solves a puzzle, and generates another one offline. Browser tests use Microsoft Edge; change the Playwright channel in `playwright.config.ts` if you use another Chromium browser.

## Scope

The generator composes legal king, queen, and rook positions and keeps only positions with a mate in one. These are chess compositions rather than positions sampled from recorded games. Multi-move tactics and difficulty levels are future milestones.

The app is licensed under GPLv3; see [LICENSE](LICENSE). Its current chess rules dependency, `chess.js`, is BSD-2-Clause licensed.
