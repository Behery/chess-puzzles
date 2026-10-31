# Chess Puzzle

An installable, offline chess puzzle game for phones and PCs. It shows which side to play, gives a goal, and lets you choose a difficulty. The board and solution line come from real Lichess games. It works without an account or server.

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

Install the app from your browser while online. Once installed, the app and its 22,930 bundled puzzles are cached for offline use.

## Playing

Select a piece to see its legal destinations. The first press of **Hint** marks the piece for the next move; the second marks its destination. **Solve** animates the complete solution from the starting position. **Back** and **Forward** replay accepted moves and opponent replies; return to the latest position to continue solving. The board marks the most recent move. Reduced-motion settings skip the movement animation.

## Difficulty

| Level | Selection rule |
| --- | --- |
| Easy | Rating up to 1300, one or two player moves; includes mate in one and other tactics |
| Medium | Rating 1301–1900, two or three player moves |
| Hard | Rating above 1900, at least three player moves |

Every starting board is from a recorded game between moves 7 and 32, with at least seven pieces per side before the opponent's setup move. The app picks puzzles without repeats during a session and restarts a level after its pool is exhausted.

## Tests

```sh
npm test
npm run test:e2e
```

The unit tests validate every bundled position and solution line, difficulty rule, and mating goal. The browser tests reload the production app offline, solve each difficulty, and check the phone layout. Browser tests use Microsoft Edge; change the Playwright channel in `playwright.config.ts` if you use another Chromium browser.

## Puzzle data

The bundled bank is a filtered extract of the [Lichess combined puzzle and game sample](https://github.com/mcognetta/lichess-combined-puzzle-game-db), published under CC0. To rebuild it, download its `combined_puzzle_db_first_50k.ndjson.bz2` file as `puzzle-source.bz2` in the project root, then run `python scripts/build_puzzle_bank.py`. The source archive is excluded from Git.

Each puzzle is prepared locally by applying the recorded opponent move before showing the board. The bank is finite, so puzzles eventually repeat after a level is exhausted. The app is licensed under GPLv3; see [LICENSE](LICENSE). Its chess rules dependency, `chess.js`, is BSD-2-Clause licensed.
