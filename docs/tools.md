# Life Navigator Tools

Life Navigator provides AI assistants with a comprehensive set of tools to help manage your Obsidian vault and daily activities. These tools allow the AI to interact with your notes, manage tasks, and perform various operations on your behalf.

## Document Management Tools

### Create Document
**Tool:** `create_document`
- Creates new markdown files in your vault
- Automatically handles file path creation and content formatting
- Useful for creating new notes, templates, or structured documents

### Read Document
**Tool:** `read_document`
- Reads the content of existing files in your vault
- Allows the AI to access and reference information from your notes
- Essential for providing contextual assistance based on your existing content

### Append to Document
**Tool:** `append_to_document`
- Adds content to the end of existing files
- Perfect for adding new entries to journals, logs, or ongoing notes
- Maintains existing content while extending it

### Search Vault
**Tool:** `search_vault`
- Searches through all files in your vault for specific content
- Helps find relevant information across your entire knowledge base
- Supports both text content and file name searches

## Task Management Tools

### Add Todo
**Tool:** `add_todo`
- Creates new todo items in your daily notes or specified files
- Supports emoji categorization and detailed descriptions
- Integrates with your daily planning workflow

### Check Todo
**Tool:** `check_todo`
- Marks todo items as completed with timestamps
- Moves completed tasks to appropriate sections
- Tracks completion times for habit analysis

### Uncheck Todo
**Tool:** `uncheck_todo`
- Reverts completed todos back to pending status
- Useful for tasks that need to be repeated or were marked done by mistake

### Edit Todo
**Tool:** `edit_todo`
- Modifies existing todo items
- Can change text, emoji, or other properties
- Maintains task history and context

### Remove Todo
**Tool:** `remove_todo`
- Removes todo items from notes
- Adds HTML comments to track removed tasks
- Helps clean up completed or irrelevant tasks

### Move Todo
**Tool:** `move_todo`
- Transfers todo items between different notes or dates
- Useful for rescheduling tasks or organizing by priority
- Maintains task context during moves

### Abandon Todo
**Tool:** `abandon_todo`
- Marks tasks as abandoned with timestamps
- Moves abandoned tasks to the beginning of notes for visibility
- Helps track what didn't work out and why

### Create Completed Todo
**Tool:** `create_completed_todo`
- Creates a todo item that's already marked as completed
- Useful for logging activities that were done but not previously planned
- Includes completion timestamps

## Content Tools

### YouTube Transcript Download
**Tool:** `download_youtube_transcript`
- Downloads transcripts from YouTube videos and saves them to Obsidian files
- Browser-compatible implementation using Obsidian's built-in request capabilities
- Supports multiple languages with automatic fallback to English
- Handles various YouTube URL formats (full URLs, short URLs, video IDs)
- Configurable options:
  - **Language**: Specify transcript language (e.g., 'en', 'pl', 'fr')
  - **Include Timestamps**: Option to include/exclude timestamps in output
  - **Overwrite**: Control whether to overwrite existing files
- Output includes metadata (video URL, language, generation timestamp)
- Formatted as clean markdown with proper structure
- Works by extracting caption data from YouTube's web player

**Example Usage:**
```
Download transcript from: https://www.youtube.com/watch?v=VIDEO_ID
Save to: Transcripts/Video Title.md
Language: en
Include timestamps: true
```

**Note:** This tool requires that the YouTube video has captions available (either auto-generated or manually uploaded). Private videos or videos without captions will not work.

## System Tools

### Handover Mode
**Tool:** `handover_mode`
- Allows the AI to switch between different modes during conversations
- Enables transitions between different personalities or specialized contexts
- Useful for moving from planning to reflection or from general assistance to specific expertise

## Tool Filtering

Life Navigator supports tool filtering per mode, allowing you to control which tools are available in different contexts:

- **Allowed Tools**: Specify which tools a mode can use (supports wildcards like `*todo*`)
- **Disallowed Tools**: Explicitly block certain tools from a mode
- **Default Behavior**: All tools are available unless specifically filtered

This allows you to create specialized modes that only have access to relevant tools, improving focus and reducing complexity.

## Usage Tips

1. **Voice Commands**: Most tools work well with natural voice commands like "add a task to exercise today" or "mark my workout as done"

2. **Context Awareness**: Tools automatically work with your current context - they know about your daily notes, current date, and active files

3. **Error Handling**: Tools provide clear feedback when operations can't be completed, helping you understand what went wrong

4. **Batch Operations**: Many tools can handle multiple items at once when requested naturally

5. **Integration**: Tools work together seamlessly - you can search for content, read it, and then create new documents based on what you found

For more information about configuring tool access in different modes, see the [tool-filtering documentation](tool-filtering.md). 