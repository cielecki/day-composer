# Link Expansion

The plugin supports special link formats that enhance your note-taking experience and AI interactions:

## Purpose and Structure

Link expansion allows you to build comprehensive AI prompts with maximum user control. When a link is followed by a magnifying glass emoji (🔎), its content is expanded and included in the AI's context.

This creates a powerful hierarchical structure:
- From a main mode, you can link to an index file (as in the starter kit)
- The index can link to multiple sub-files (like "About Me", "Relationships", etc.)
- Each sub-file can link to even more specific documents

This web of links enables you to:
1. Organize information in a modular way
2. Control exactly what context is provided to the AI
3. Maintain separate documents while creating a unified context
4. Build complex context from simple, reusable components

## Regular Link Expansion

Links followed by a magnifying glass emoji will be expanded when used in Life Navigator modes:

```markdown
[[Note Title]] 🔎
```

This will include the full content of "Note Title" in your query context.

## Special Link Types

### Dynamic Day Note Links

You can use a special format to reference daily notes relative to the current date:

```markdown
[[ln-day-note-(X)]] 🔎
```

Where `X` is a number representing how many days to offset from today:
- Negative numbers represent past days: `[[ln-day-note-(-3)]] 🔎` refers to the note from 3 days ago
- Positive numbers represent future days: `[[ln-day-note-(2)]] 🔎` refers to the note 2 days from now
- Zero represents today: `[[ln-day-note-(0)]] 🔎` refers to today's note

This uses the same format as the daily note range feature in the context building for LN modes.

### Current Date and Time

You can include the current date and time in your expanded content:

```markdown
[[ln-current-date-and-time]] 🔎
```

This will be replaced with the current date and time in your locale's format.

