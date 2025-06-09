# Tool Filtering for Modes

Life Navigator supports configuring which tools are available to each mode through simple pattern-based filtering. This allows you to create specialized modes that only have access to relevant tools.

## Configuration

Add these fields to your mode's frontmatter:

```yaml
tools_allowed:
  - "*todo*"        # Allow all tools containing "todo"
  - "create_*"      # Allow all tools starting with "create_"
  - "search_vault"  # Allow specific tool by exact name

tools_disallowed:
  - "handover_mode" # Disallow specific tool
  - "*document*"    # Disallow all tools containing "document"
```

## Pattern Matching

The filtering system supports simple wildcard patterns:

- `*` - Matches everything (default)
- `exact_name` - Exact tool name match
- `prefix*` - Matches tools starting with "prefix"
- `*suffix` - Matches tools ending with "suffix"
- `*contains*` - Matches tools containing "contains"

## Precedence Rules

1. **Disallowed patterns take precedence** - If a tool matches any disallowed pattern, it's excluded
2. **Allowed patterns are checked next** - Tool must match at least one allowed pattern
3. **Default behavior** - If no patterns are specified, all tools are allowed (`["*"]`)

## Available Tools

Current tools in Life Navigator:

### Document Operations
- `create_document` - Create new documents
- `read_document` - Read existing documents  
- `append_to_document` - Add content to documents
- `search_vault` - Search for documents

### Todo Management
- `add_todo` - Add new todo items
- `check_todo` - Mark todos as completed
- `uncheck_todo` - Mark todos as incomplete
- `move_todo` - Move todos between dates
- `abandon_todo` - Mark todos as abandoned
- `create_completed_todo` - Create already-completed todos
- `show_todos` - Display todo items

### Mode Management
- `handover_mode` - Switch between modes

## Example Configurations

### Assistant Mode (Task-focused)
```yaml
tools_allowed:
  - "*todo*"
  - "*document*"
  - "show_todos"
tools_disallowed:
  - "handover_mode"
```

### Reflection Mode (Read-only analysis)
```yaml
tools_allowed:
  - "*"
tools_disallowed:
  - "*todo*"
  - "create_document"
  - "append_to_document"
```

### Songwriter Mode (Creative writing)
```yaml
tools_allowed:
  - "create_document"
  - "read_document"
  - "search_vault"
tools_disallowed: []
```

## Use Cases

- **Safety**: Prevent destructive operations in analysis modes
- **Focus**: Limit tools to relevant functionality for specialized tasks
- **User Experience**: Reduce cognitive load by hiding irrelevant tools
- **Workflow**: Create purpose-built modes for specific workflows

## Backward Compatibility

Existing modes without tool filtering configuration will continue to work with all tools available, maintaining full backward compatibility. 