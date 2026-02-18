# Edit & AI Reintegration Plan

## Overview

When a user edits a journal entry, the system treats it **like a new entry**: the AI re-reads the full content and re-categorizes it. This ensures the entry is correctly stored, tagged, and integrated into the user's timeline and life description.

---

## Behavior

### On Edit

1. **User edits** title, transcription (body), and/or user tags.
2. **Save** → `entries:update` persists the changes immediately.
3. **If transcription changed** → trigger `reCategorizeEntry(entryId, newText)` in the background.
4. **Re-categorization** re-runs the same AI pipeline as create:
   - Title
   - Summary
   - Mood (valence + granular)
   - Life domains
   - Entities
   - Keywords

### Why "Like a New Entry"

- Editing can fundamentally change the meaning (e.g., adding a paragraph about work stress).
- Old tags/summary may no longer apply.
- Re-running the full categorization keeps the AI’s view in sync with the content.
- Timeline, PatternCard, and search all read from these fields → they automatically reflect the new categorization.

---

## Technical Flow

```
User saves edit
    ↓
entries:update(id, { transcription, title, userTags })
    ↓
DB updated, return updated entry
    ↓
[if transcription in patch] → reCategorizeEntry(id, newTranscription)
    ↓
AI categorizes (Ollama)
    ↓
DB updated with new title, summary, mood, domains, entities, keywords
    ↓
Renderer refreshes selected entry after delay (or on focus)
```

---

## Differences from Create

| Aspect | Create | Edit (re-categorize) |
|--------|--------|----------------------|
| Title | Preserve pathway auto-title if set | **Overwrite** – AI generates fresh title from new content |
| userTags | Preserve pathway + user tags | **Preserve** – user tags are explicit; only AI fields change |
| pathwayId, pathwayDay, promptId | Set at create | **Preserve** – structural metadata unchanged |

---

## UI

- **Edit** button in EntryDetail header (or in More menu).
- Edit mode: editable title, transcription (textarea), tags.
- **Save** / **Cancel**.
- Optional: brief “AI is updating tags…” after save; entry refreshes when re-categorization completes.

---

## Timeline & Life Description

- Timeline and PatternCard read from `entries` in the store.
- When an entry is updated, the store is updated.
- When AI re-categorization finishes, a refresh of the selected entry pulls the latest AI fields.
- No extra “life description” entity yet; this design supports adding one later (aggregating entries by domains, mood, etc.).
