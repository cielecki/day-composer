# Task Management System

This document outlines the implementation of the enhanced task management system for daily notes and backlogs. The system has been redesigned to support the rich task format and operations specified in `docs/tasks.md`.

## Architecture Overview

The system follows a layered architecture:

```
┌─────────────────┐
│   Tool Layer    │
│ (User-facing)   │
└───────┬─────────┘
        │
┌───────▼─────────┐
│  Operations     │
│  Layer          │
└───────┬─────────┘
        │
┌───────▼─────────┐
│  Document       │
│  Model Layer    │
└───────┬─────────┘
        │
┌───────▼─────────┐
│  File System    │
│  Layer          │
└─────────────────┘
```

### 1. Document Model Layer

The foundation of the system is a rich document model that parses and represents markdown files as structured objects. The key innovation is preserving arbitrary user content while providing structure for tasks and sections.

**Implementation**: `src/tools/utils/markdown-parser.ts`

This layer provides:
- Parsing of markdown to structured document objects
- Representation of tasks with all specified attributes (status, emoji, time info, comments, etc.)
- Handling of arbitrary user content through TextBlocks
- Serialization back to markdown with proper formatting

### 2. Operations Layer

This layer implements the core operations on tasks such as creation, completion, abandonment, and moving.

**Implementation**: `src/tools/utils/task-operations.ts` 

Key operations include:
- Finding tasks in documents by description
- Locating the "current spot" for completed tasks
- Applying operations to tasks (complete, uncheck, abandon, etc.)
- Moving tasks between documents

### 3. Utility Support Layer

Additional utilities to support the system:

**Implementation**: 
- `src/tools/utils/emoji-utils.ts` - Smart emoji suggestions for tasks
- Existing utilities like `daily-notes-utils.ts`, `file-utils.ts`, etc.

### 4. Tool Layer (User-facing)

The user-facing tools that implement the commands:

**Implementation**:
- `src/tools/add-todo.ts` - Adding new tasks
- `src/tools/check-todo.ts` - Completing tasks
- `src/tools/uncheck-todo.ts` - Unchecking tasks
- `src/tools/move-todo.ts` - Moving tasks between files
- `src/tools/abandon-todo.ts` - Abandoning tasks
- `src/tools/create-completed-todo.ts` - Creating completed todo entries for notes in daily logs

## Key Features and Improvements

### 1. Enhanced Task Format

The system now fully supports:
- Multiple task status markers: `[ ]` (pending), `[x]` (completed), `[-]` (abandoned), `[>]` (moved)
- Emojis for task categorization
- Rich time information (scheduled ranges, approximate times, completion times)
- Proper indentation for task comments (4 spaces)
- Source/target references for moved tasks

### 2. Advanced Task Operations

The system implements all operations specified in the documentation:
- Task completion with automatic time tracking (requires task to be in pending state)
- Moving tasks to the "current spot" based on document context
- Task abandonment with reason recording and placement at "current spot"
- Unchecking tasks with placement at "current spot" 
- State validation to enforce proper task workflows (e.g., must uncheck tasks before checking them off again)
- Consistent comment formatting

### 3. Non-destructive Editing

All operations maintain the user's document structure:
- Preserves arbitrary content
- Handles inconsistent formatting gracefully
- Maintains original indentation and spacing

### 4. Daily Note Focus

The system is designed with a daily note-centric approach:
- By default, tools only search in the daily note when no specific file path is provided
- Operations preserve the user's organization in daily notes
- Explicit file paths can be provided when working with tasks in other files or backlogs
- Clear error messages direct users to specify file paths when tasks aren't found in daily notes

### 5. Backlog Support

Special handling for backlog files:
- Preserves tasks in their original position in backlog files
- Proper referencing between daily notes and backlogs

## Future Enhancements

Potential future enhancements to consider:

1. **Task Sorting** - Automatically organize tasks by time in sections
2. **Task Statistics** - Provide insights into completion rates and times
3. **Task Templates** - Allow users to define and insert task templates
4. **Quick Entry** - Simplified syntax for rapid entry of multiple tasks
5. **Visualization** - Calendar or timeline views of scheduled tasks

---

This implementation provides a robust foundation for task management in markdown files, addressing all the requirements specified in the task documentation while ensuring a non-destructive approach to editing user content.
