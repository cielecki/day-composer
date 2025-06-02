# Link Expansion

The Life Navigator plugin provides several special link formats that can be used to dynamically reference content in your vault. These links are expanded when they are followed by a magnifying glass emoji (🔎).

## Special Link Formats

### Daily Notes

#### Single Daily Note
Format: `[[ln-day-note-(X)]] 🔎`
- `X` is the number of days offset from today
- Positive numbers refer to future dates
- Negative numbers refer to past dates
- `0` refers to today

Example: `[[ln-day-note-(-1)]] 🔎` expands to yesterday's daily note

#### Daily Note Range
Format: `[[ln-day-note-(start:end)]] 🔎`
- `start` and `end` are the number of days offset from today
- Both values can be positive (future) or negative (past)
- The range is inclusive of both start and end dates
- The start date must be less than or equal to the end date

Example: `[[ln-day-note-(-7:0)]] 🔎` expands to the last 7 days of daily notes

### Current Date and Time
Format: `[[ln-current-date-and-time]] 🔎`
Expands to the current date and time in ISO format.

### Currently Open File
Format: `[[ln-currently-open-file]] 🔎`
Expands to the path of the currently open file.

### Current Chat
Format: `[[ln-current-chat]] 🔎`
Expands to the current chat session.

## Usage Notes

1. All special links must be followed by a magnifying glass emoji (🔎) to be expanded
2. Links can be aliased using the standard Obsidian format: `[[target|alias]]`
3. The expansion process is recursive - any links within expanded content will also be expanded
4. Circular references are prevented by tracking visited paths
5. Only markdown files are resolved and expanded

## Examples

### Daily Notes
```markdown
# Yesterday's Notes
[[ln-day-note-(-1)]] 🔎

# Last Week's Notes
[[ln-day-note-(-7:0)]] 🔎

# Next Week's Notes
[[ln-day-note-(1:7)]] 🔎
```

### Current Information
```markdown
Current time: [[ln-current-date-and-time]] 🔎
Current file: [[ln-currently-open-file]] 🔎
Current chat: [[ln-current-chat]] 🔎
```

### Aliased Links
```markdown
[[ln-day-note-(-1)|Yesterday's Notes]] 🔎
[[ln-day-note-(-7:0)|Last Week's Notes]] 🔎
```

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

## Magnifying Glass Requirement

All special links must be followed by a magnifying glass emoji (🔎) to trigger the expansion. This is intentional to prevent accidental expansions.

## HTML Comment Filtering

During the link expansion process, Life Navigator automatically filters out top-level HTML comments from the final system prompt while preserving them in code blocks. This feature:

- **Removes top-level HTML comments**: Comments like `<!-- DELETED TASK: ... -->` used to mark deleted tasks are filtered out
- **Preserves code examples**: HTML comments inside markdown code blocks (fenced with ``` or indented with 4+ spaces) are kept intact
- **Handles multi-line comments**: Comments spanning multiple lines are properly detected and removed
- **Maintains code integrity**: Ensures that documentation and code examples remain unchanged

This filtering ensures that the AI doesn't see deleted task markers and other HTML annotations while maintaining the integrity of code examples and documentation.

