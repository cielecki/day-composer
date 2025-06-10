# Tool Call Marker System

Life Navigator now supports a powerful new syntax for calling tools directly in your notes using the `` `🧭 tool_name(params)` `` format. This system provides a flexible, JavaScript-like syntax for executing tools with various parameter styles.

## Basic Syntax

The basic format is:
```
`🧭 tool_name(parameters)`
```

The compass emoji (🧭) is wrapped in backticks and triggers the tool execution during link expansion.

## Parameter Styles

### 1. Zero Parameters
For tools that don't need any parameters:
```
`🧭 current_date_time()`
`🧭 tools_list()`
```

### 2. Positional Parameters
Pass parameters in order, like JavaScript function calls:
```
`🧭 daily_note(-1)`
`🧭 note_read("My Note.md", true)`
```

### 3. Named Parameters
Use Python-style named parameters for clarity:
```
`🧭 note_read(path="My Note.md", expand_links=true)`
`🧭 tools_list(mode="Planner", safe_only=true)`
```

### 4. JavaScript Object Syntax
Pass a single object with all parameters:
```
`🧭 note_read({path: "My Note.md", expand_links: true})`
`🧭 tools_list({mode: "Planner", safe_only: true})`
```

### 5. Mixed Parameters
Combine positional and named parameters:
```
`🧭 note_read("My Note.md", expand_links=true)`
`🧭 task_add("Buy groceries", emoji="🛒", priority=1)`
```

## Safety and Side Effects

Tools are marked with a `sideEffects` property:

- **Safe tools** (`sideEffects: false`): Can be executed during link expansion
  - `🧭 current_date_time()` - Gets current date/time
  - `🧭 daily_note()` / `🧭 daily_notes()` - Reads daily notes
  - `🧭 current_file_and_selection()` - Gets content of currently open file and selected text
  - `🧭 current_chat()` - Gets current chat conversation content
  - `🧭 note_read()` - Reads file content
  - `🧭 tools_list()` - Lists available tools
  - `🧭 vault_search()` - Searches vault content

- **Tools with side effects** (`sideEffects: true`): Only executed in chat context
  - `🧭 note_create()` - Creates new files
  - `🧭 note_edit()` - Modifies existing files
  - `🧭 task_add()` - Adds tasks to files
  - All task modification tools

## Available Tools

Use the `🧭 tools_list()` tool to discover available tools:

```
`🧭 tools_list()`                    # List all tools
`🧭 tools_list(safe_only=true)`      # Only safe tools
`🧭 tools_list(mode="Planner")`      # Tools for specific mode
```

## Examples

### Get Current Information
```
Today is `🧭 current_date_time()`

Yesterday's notes:
`🧭 daily_note(-1)`

Last week's notes:
`🧭 daily_notes(-7, 0)`
```

### Read and Process Notes
```
Current project status:
`🧭 note_read(path="Projects/Current.md", expand_links=true)`

Available tools for this mode:
`🧭 tools_list(safe_only=true)`
```

### Get Current Context
```
Current file and selection context:
`🧭 current_file_and_selection()`
```

**Note:** The `🧭 current_file_and_selection()` tool combines both file content and text selection information into a single XML response, providing comprehensive context about what's currently open and selected.

### Wiki Link Expansion
```
`🧭 expand` [[About Me]]
`🧭 expand` [[Project Notes]]
```

### Complex Tool Calls
```
`🧭 note_read({
  path: "Meeting Notes/2024-01-15.md",
  expand_links: true
})`
```

## Migration from Special Links

The new tool call system replaces old special links. **Note: Old formats are no longer supported** and will show as validation errors:

| Old Special Link | New Tool Call |
|------------------|---------------|
| `[[ln-current-date-and-time]] 🧭` | `` `🧭 current_date_time()` `` |
| `[[ln-day-note-(-1)]] 🧭` | `` `🧭 daily_note(-1)` `` |
| `[[ln-day-note-(0)]] 🧭` | `` `🧭 daily_note(0)` `` |
| `[[ln-day-note-(-7:0)]] 🧭` | `` `🧭 daily_notes(-7, 0)` `` |
| `[[ln-currently-open-file]] 🧭` | `` `🧭 current_file_and_selection()` `` |
| `[[ln-current-chat]] 🧭` | `` `🧭 current_chat()` `` |
| `[[ln-currently-selected-text]] 🧭` | `` `🧭 current_file_and_selection()` `` |
| `[[About Me]] 🧭` | `` `🧭 expand` [[About Me]] `` |

The new format provides a cleaner, more consistent syntax.

## Migration Detection

You can detect old special link syntax that needs updating using the mode validator:

```
`🧭 mode_validator(file_path="My Mode.md")`
```

This will:
- Scan the file for old special link patterns
- Report validation errors for outdated syntax
- Provide exact replacement suggestions
- Guide you on what needs to be updated manually

The validator provides read-only analysis - you'll need to use tools like `🧭 note_edit()` to make the actual changes.

## Error Handling

If a tool call fails, you'll see an error message in place of the tool call:
- `[Tool not found: invalid_tool]` - Tool doesn't exist
- `[Tool has side effects and cannot be used in link expansion]` - Unsafe tool in link expansion
- `[Error executing tool_name(): error details]` - Execution error

## Best Practices

1. **Use safe tools in templates**: Only use tools without side effects in note templates that will be expanded automatically
2. **Prefer named parameters**: For complex tools, named parameters are more readable
3. **Check available tools**: Use `tools_list()` to discover what tools are available in your current mode
4. **Test tool calls**: Try tool calls in chat first before embedding them in important notes

## User-Defined Tools

Custom tools created with the `ln-tool` tag can also be called using this syntax. User tools default to having side effects unless explicitly marked as safe with `sideEffects: false` in their frontmatter.

```
`🧭 my_custom_tool(param1="value")`
```

The tool call system provides a powerful, flexible way to integrate Life Navigator's functionality directly into your notes while maintaining safety and consistency. 