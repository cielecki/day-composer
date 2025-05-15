# Documentation for Structured Edits to Markdown Files for Daily Notes

## 1. Overview

This document outlines specifications for structured edits to markdown files used for daily notes. The system provides operations for managing to-do items, notes, and organizational structures while preserving information in a non-destructive manner.

## 2. Markdown Structure

### 2.1 Task Status Markers
- Pending: `- [ ]`
- Completed: `- [x]`
- Abandoned: `- [-]`
- Moved: `- [>]`

### 2.2 Task Format

```markdown
- [ ] 📝 09:00-10:00 Task description
    Notes indented with 4 spaces
    Can span multiple lines
```

Time formats:
- Scheduled range: `09:00-10:00`
- Approximate time: `~13:30`
- Completion time: Added in parentheses at end, e.g., `(15:40)` or `(2023-10-18 15:40)`

### 2.3 Task Examples

```markdown
# Pending task with scheduled time range
- [ ] 📅 09:00-10:00 Weekly planning meeting
    Prepare agenda beforehand

# Pending task with approximate time
- [ ] 🚗 ~13:30 Take out the trash

# Completed task
- [x] 🚗 ~12:00 Refuel car (15:40)
    Added premium fuel this time

# Moved task
- [>] 📚 Read documentation → 2023-10-20

# Abandoned task
- [-] 📧 Email marketing team
    No longer needed after meeting
```

## 3. Core Operations

### 3.1 Completing a Task

**Process:**
1. Change `[ ]` to `[x]`
2. Add completion time in parentheses at the end:
   - Time only (HH:MM) if completed same day
   - Date and time (YYYY-MM-DD HH:MM) if different day
3. Add any notes about completion
4. Move the task and its notes to the "current" spot

**Example:**

Before:
```markdown
- [ ] 🚗 ~12:00 Refuel car
    Remember to check tire pressure
```

After (completed at 15:40):
```markdown
- [x] 🚗 ~12:00 Refuel car (15:40)
    Remember to check tire pressure
    Added premium fuel this time
```

### 3.2 Unchecking a Task

**Process:**
1. Change `[x]` to `[ ]`
2. Remove the completion time
3. Task position remains unchanged

**Example:**

Before:
```markdown
- [x] 📝 Write report (14:30)
    Added section on market analysis
```

After:
```markdown
- [ ] 📝 Write report
    Added section on market analysis
```

### 3.3 Skipping/Abandoning a Task

**Process:**
1. Change `[ ]` to `[-]`
2. Optionally add timestamp and reason
3. Position remains unchanged

**Example:**

Before:
```markdown
- [ ] 📞 Call John about project
```

After:
```markdown
- [-] 📞 Call John about project
    No longer needed as we decided to go with a different approach
```

### 3.4 Adding Notes

**Adding to existing task:**
1. Identify target task
2. Add text indented with 4 spaces after existing notes

**Creating a standalone note:**
1. Create a new completed task with current time
2. Add relevant emoji
3. Add note content indented under the task
4. Place at the "current" spot

**Example:**
```markdown
- [x] 📝 Note (16:45)
    Remembered we need to order new office supplies
```

## 4. The "Current" Spot Concept

The "current" spot is where newly completed tasks and notes are placed.

**Determining location:**
- After the last completed task if there's a clear section of completed tasks
- After the most recently completed task if tasks are mixed
- At the beginning if no completed tasks exist
- After any recently added notes

## 5. Organizational Operations

### 5.1 Adding New Tasks

**Process:**
1. Format: `- [ ] 🎯 [time-info] Task description`
2. Choose an emoji reflecting task content
3. Place at appropriate position:
   - At "current" spot
   - After specific task
   - In chronological order (for time-based tasks)

### 5.2 Moving Tasks Within a File

**Process:**
1. Identify task to move (including notes)
2. Specify target position using one of these methods:
   - **By reference task**: "Move task X before/after task Y"
   - **By section**: "Move task X to section Z"
   - **By time**: "Move task X to 11:00" (reordering chronologically)
   - **By position indicator**: "Move task X to current spot"
   - **By relative position**: "Move task X up/down 3 positions"
3. Move the task and all associated notes as a unit
4. Do not add any markers or create copies when moving within the same file

**Example command:**
```markdown
Move "Call marketing team" after "Weekly planning meeting"
```

### 5.3 Moving Tasks Between Files

**Moving to another daily note or backlog:**
1. Mark original with `[>]` and destination: `→ YYYY-MM-DD` or `→ Backlog-Name`
2. Create task in target file with original status
3. Add source reference to moved task

**Example:**

Original in today's note:
```markdown
- [>] 📚 Read documentation → 2023-10-20
```

In target date's note:
```markdown
- [ ] 📚 Read documentation (from 2023-10-15)
```

## 6. Backlog Management

### 6.1 Backlog Files Specifics
- No chronological order assumed
- User-defined sections preserved
- Completed tasks remain in place (not moved to "current" spot)

### 6.2 Moving Between Backlog and Daily Notes

Tasks can be moved freely between backlog files and daily notes using the same moving process described in section 5.3.

## 7. Implementation Considerations

### 7.1 Internal Representation

Markdown files should be parsed into a hierarchical structure that preserves the document organization:

```json
{
  "type": "document",
  "content": [
    {
      "type": "section",
      "level": 1,
      "title": "Morning",
      "content": [
        {
          "type": "task",
          "status": "pending",
          "emoji": "🚗",
          "time_info": {
            "scheduled": "09:00-10:00",
            "completed": null
          },
          "description": "Task description",
          "notes": ["Note line 1", "Note line 2"],
          "target": null,
          "source": null
        },
        {
          "type": "section",
          "level": 2,
          "title": "Early Morning",
          "content": [...]
        }
      ]
    },
    {
      "type": "task",
      "status": "completed",
      "emoji": "📚",
      "time_info": {
        "scheduled": "~13:30",
        "completed": "15:40"
      },
      "description": "Another task",
      "notes": ["A note"],
      "target": null,
      "source": null
    }
  ]
}
```

This representation allows tasks to appear at any level in the document, including within sections or subsections, reflecting a realistic markdown structure.

### 7.2 Non-Destructive Principles
- Never delete content
- Use markers to indicate changes
- Preserve metadata and references
- Add information rather than removing when in doubt

### 7.3 Handling Inconsistencies
- Be resilient to user-mangled files
- Handle tasks without emojis or with non-standard formatting
- Preserve user-defined structure
- Maintain indentation and formatting of notes

## 8. Key Guidelines

1. Every task should have an emoji reflecting its content (not status)
2. All notes should be associated with a task (4 spaces indentation)
3. Completed tasks include completion time
4. When moving tasks between files, mark original with `[>]`
5. When moving within a file, simply move the task without markers
6. No destructive operations - always preserve information
7. Don't assume specific structure beyond basic task formatting
8. Be resilient to variations in user formatting

This specification provides guidelines for implementing a robust system for structured editing of markdown files for daily notes and task management.
