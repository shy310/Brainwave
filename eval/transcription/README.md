# Transcription evaluation set

Used to choose `TRANSCRIBE_MODE` / `TRANSCRIBE_MODEL` from data instead of guesses (Phase 1E).

## What goes here

- `clips.json` lists the clips: `id`, `file`, `language` (`he` or `en`), optional `topic` and `math: true` when the clip has spoken math.
- `audio/<file>` holds about one minute of real lecture audio per clip: 5 Hebrew (some mixing in English technical terms) and 5 English, several with spoken math. **Audio is git-ignored**, because it's real classroom audio. Keep it only where everyone in the recording agreed to its use.
- `refs/<id>.txt` holds the checked reference transcript: the words as actually spoken, checked by a person. Write math as it is said ("x squared plus one"), and leave out filler words.

## Run

```bash
OPENROUTER_API_KEY=… npx tsx scripts/eval-transcription.ts --llm google/gemini-2.5-flash
```

By default every speech-to-text model in `DEFAULT_MODELS` is tried. `--llm` adds today's LLM transcriber (the same prompt as production) for comparison. Results land in `results/` as JSON (every transcript) and Markdown (the summary table).

WER is pooled over all words: total errors divided by total reference words. Text is lowercased, and Hebrew niqqud, geresh and punctuation are removed before comparing. Cost comes from each response's `usage.cost`, not from a price list.
