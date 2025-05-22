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

## Special Links

Life Navigator supports several special link types that provide dynamic content:

### ln-day-note

This special link format allows you to reference daily notes relative to the current date.

```markdown
[[ln-day-note-(0)]] 🔎  # Today's daily note
[[ln-day-note-(-1)]] 🔎 # Yesterday's daily note
[[ln-day-note-(1)]] 🔎  # Tomorrow's daily note
```

The number in parentheses represents the offset in days from the current date.

### ln-current-date-and-time

This special link outputs the current date and time:

```markdown
[[ln-current-date-and-time]] 🔎
```

### ln-currently-open-file

This special link embeds the content of the currently open file in the editor. It's useful for referencing and including the content you're currently working on.

```markdown
[[ln-currently-open-file]] 🔎
```

The content will be properly formatted with indentation and wrapped in XML tags with the file path as an attribute.

### ln-current-chat

This special link embeds the current conversation from the Life Navigator. It formats the conversation with clear user and assistant markers.

```markdown
[[ln-current-chat]] 🔎
```

This is particularly useful in speech to text prompt.

## Magnifying Glass Requirement

All special links must be followed by a magnifying glass emoji (🔎) to trigger the expansion. This is intentional to prevent accidental expansions.

