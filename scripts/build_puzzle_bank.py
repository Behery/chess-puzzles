"""Extract a small, reproducible offline puzzle bank from the CC0 Lichess sample."""

from __future__ import annotations

import bz2
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "puzzle-source.bz2"
OUTPUT = ROOT / "src" / "puzzle-bank.json"
# Download SOURCE from the CC0 sample linked in README.md before running this script.


def classify(rating: int, player_moves: int) -> str | None:
    if rating <= 1300 and player_moves <= 2:
        return "easy"
    if 1300 < rating <= 1900 and 2 <= player_moves <= 3:
        return "medium"
    if rating > 1900 and player_moves >= 3:
        return "hard"
    return None


bank: dict[str, list[dict]] = {key: [] for key in ("easy", "medium", "hard")}
counts: Counter[str] = Counter()
with bz2.open(SOURCE, "rt", encoding="utf-8") as source:
    for line in source:
        puzzle = json.loads(line)["puzzle"]
        fen = puzzle["FEN"]
        moves = puzzle["Moves"].split()
        rating = int(puzzle["Rating"])
        themes = set(puzzle["Themes"].split())
        if not any(theme.startswith("mateIn") for theme in themes):
            continue
        player_moves = len(moves) // 2
        fullmove = int(fen.split()[5])
        board = fen.split()[0]
        white = sum(piece.isupper() for piece in board if piece.isalpha())
        black = sum(piece.islower() for piece in board if piece.isalpha())

        if not (7 <= fullmove <= 32 and white >= 7 and black >= 7 and white + black >= 18):
            continue
        if int(puzzle["Popularity"]) < 60 or player_moves < 1 or len(moves) % 2:
            continue
        if any(len(move) == 5 and move[4] != "q" for move in moves):
            continue
        difficulty = classify(rating, player_moves)
        if difficulty is None:
            continue
        counts[difficulty] += 1
        bank[difficulty].append({
            "id": puzzle["PuzzleId"],
            "fen": fen,
            "moves": moves,
            "goal": f"Checkmate in {player_moves} {'move' if player_moves == 1 else 'moves'}",
            "rating": rating,
        })

OUTPUT.write_text(json.dumps(bank, separators=(",", ":")), encoding="utf-8")
print("Eligible:", dict(counts))
print("Bundled:", {key: len(entries) for key, entries in bank.items()})
print("Size:", OUTPUT.stat().st_size, "bytes")
