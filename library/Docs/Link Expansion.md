# Link Expansion

The Life Navigator plugin provides tool calls that can be used to dynamically reference content in your vault. These tools use the new compass-first syntax for consistency and clarity.

## Tool Calls

### Daily Notes

#### Single Daily Note
Format: `` `🧭 daily_note(offset)` ``
- `offset` is the number of days offset from today
- Positive numbers refer to future dates
- Negative numbers refer to past dates
- `0` refers to today

Example: `` `🧭 daily_note(-1)` `` expands to yesterday's daily note

#### Daily Note Range
Format: `` `🧭 daily_notes(start_offset, end_offset)` ``
- `start_offset` and `end_offset` are the number of days offset from today
- Both values can be positive (future) or negative (past)
- The range is inclusive of both start and end dates
- The start date must be less than or equal to the end date

Example: `` `🧭 daily_notes(-7, 0)` `` expands to the last 7 days of daily notes

### Current Date and Time
Format: `` `🧭 current_date_time()` ``
Expands to the current date and time in ISO format.

### Current File and Selection
Format: `` `🧭 current_file_and_selection()` ``
Expands to the full content of the currently open file and any selected text, formatted in XML for clear context.

### Current Chat
Format: `` `🧭 current_chat()` ``
Expands to the current chat session.

## Usage Notes

1. All tool calls use the compass-first format: `` `🧭 tool_name(params)` ``
2. Tools support various parameter styles: positional, named, JavaScript object, and mixed
3. The expansion process is recursive - any tool calls within expanded content will also be expanded
4. Circular references are prevented by tracking visited paths
5. Only tools without side effects can be used in automatic link expansion
6. Regular wiki links can still be expanded using: `` `🧭 expand` [[File Name]] ``

## Examples

### Daily Notes
```markdown
# Yesterday's Notes
`🧭 daily_note(-1)`

# Last Week's Notes
`🧭 daily_notes(-7, 0)`

# Next Week's Notes
`🧭 daily_notes(1, 7)`
```

### Current Information
```markdown
Current time: `🧭 current_date_time()`
Current file and selection: `🧭 current_file_and_selection()`
Current chat: `🧭 current_chat()`
```

### Wiki Link Expansion
```markdown
`🧭 expand` [[About Me]]
`🧭 expand` [[Project Notes]]
```

## Purpose and Structure

Tool calls and link expansion allow you to build comprehensive AI prompts with maximum user control. The new compass-first format provides clear, consistent syntax for dynamic content inclusion.

This creates a powerful hierarchical structure:
- From a main mode, you can use `` `🧭 expand` [[Index]] `` to include an index file
- The index can link to multiple sub-files using `` `🧭 expand` [[About Me]] ``, `` `🧭 expand` [[Relationships]] ``, etc.
- Each sub-file can include even more specific documents
- Tool calls like `` `🧭 daily_note(0)` `` provide dynamic, date-based content

This system enables you to:
1. Organize information in a modular way
2. Control exactly what context is provided to the AI
3. Maintain separate documents while creating a unified context
4. Build complex context from simple, reusable components
5. Include dynamic content that updates automatically

## Tool Call Format

All Life Navigator tools use the compass-first format with backticks:

```markdown
`🧭 tool_name(parameters)`
```

This format is:
- **Consistent**: All tools use the same syntax pattern
- **Clear**: The compass emoji clearly indicates Life Navigator functionality  
- **Flexible**: Supports various parameter styles (positional, named, mixed, JavaScript object)
- **Safe**: Only tools without side effects execute during automatic expansion

## Wiki Link Expansion

Regular wiki links can be expanded using the expand tool:

```markdown
`🧭 expand` [[Note Title]]
```

This will include the full content of "Note Title" in your query context.

## HTML Comment Filtering

During the expansion process, Life Navigator automatically filters out top-level HTML comments from the final system prompt while preserving them in code blocks. This feature:

- **Removes top-level HTML comments**: Comments like `<!-- DELETED TASK: ... -->` used to mark deleted tasks are filtered out
- **Preserves code examples**: HTML comments inside markdown code blocks (fenced with ``` or indented with 4+ spaces) are kept intact
- **Handles multi-line comments**: Comments spanning multiple lines are properly detected and removed
- **Maintains code integrity**: Ensures that documentation and code examples remain unchanged

This filtering ensures that the AI doesn't see deleted task markers and other HTML annotations while maintaining the integrity of code examples and documentation.

