## Version 0.12.1 - June 15, 2025

### 🚀 Multiple Conversations Running Simultaneously

**Work on multiple tasks at once without switching contexts:**
<img width="379" alt="image" src="https://github.com/user-attachments/assets/04152abb-ac6f-4040-b58f-9b53368ea3e6" />
<img width="1048" alt="image" src="https://github.com/user-attachments/assets/3e706415-d17a-4b9e-947e-2cb304b04ab4" />

- **Parallel chats**: Open multiple Life Navigator windows and have different conversations running independently
- **Background processing**: Start a research task in one chat while planning your day in another
- **Smart notifications**: Unread indicators show which chats have new messages
- **Flexible workspace**: Open chats in any Obsidian panel or floating window

### 📝 Weekly, Monthly & Quarterly Notes Support

<img width="594" alt="image" src="https://github.com/user-attachments/assets/78ff17cf-0276-46f3-a68d-204004442b56" />

**Life Navigator now works with the Periodic Notes plugin:**

- **Beyond daily notes**: AI can now read your weekly reviews, monthly goals, and quarterly plans
- **Automatic detection**: Works with your existing Periodic Notes setup
- **Easy migration**: Existing modes will be automatically updated to use the new syntax

### 🤝 AI Task Delegation

**Your AI can now delegate tasks to other modes:**

- **Smart handoffs**: AI can create new chats with different modes when another mode would be better suited for a task
- **Fire and forget**: Delegated tasks run in separate chats without interrupting your current conversation
- **Automatic switching**: New delegated chats open automatically so you can see the results
- **Automatic updates of old format**: AI can detect old format of modes and tools and repair it

<img width="342" alt="image" src="https://github.com/user-attachments/assets/336c6f95-3535-4ac1-8675-fa182eef2125" />

### 🎙️ ElevenLabs Voice (Experimental)

<img width="725" alt="image" src="https://github.com/user-attachments/assets/7d5ba79f-9bdf-4a1b-ab06-15892047a7bd" />

**Optional premium voice upgrade for advanced users:**

- **3,000+ voices** vs the standard 11 voices
- **32+ languages** with native pronunciation
- **Ultra-fast responses** (75ms vs 500ms+)
- **99 languages** for speech recognition

*Requires ElevenLabs API key. Falls back to OpenAI if unavailable.*

### ✨ Interface Polish

- **Editable chat titles**: Click any chat title to rename it
- **Better mode selector**: Mode dropdown moved closer to the input area

<img width="379" alt="image" src="https://github.com/user-attachments/assets/baaa24d6-7bcb-40a7-9b41-89b89291ba4d" />

- **Improved task navigation**: Click task results to jump to the exact location in your notes
- **What's New modal**: See changelog after updates
- **Audio stop button**: Pause audio playback mid-sentence with a dedicated stop button
- **Smarter voice recording**: Record voice messages even while AI is responding - no more waiting
- **Better task feedback**: Task operations now show exactly which file was modified
- **Enhanced text highlighting**: More accurate highlighting when jumping to specific content in files
- **Directory expansion**: Use `🧭 expand` with folder names to include all files in a directory
- **Improved help flow**: Help buttons now create new Guide chats instead of interrupting your current conversation
- **Better Polish language support**: Proper pluralization and cleaner number displays for Polish users

---

## Version 0.11.3 - June 11, 2025

**Life Navigator now includes a context menu in your chat interface that puts all new features at your fingertips:**

- **💰 View Costs**: Instantly check your API usage and spending data for a given conversation
- **📁 Reveal in Finder**: Open your file manager and jump directly to your conversation files for easy backup, sharing, or organization
- **🗑️ Delete Chat**: Quickly remove conversations you no longer need
- **⭐ Star on GitHub**: Show your support by starring the Life Navigator project
- **💬 Join Community**: Connect with other users on Discord for support, tips, and discussions
- **👤 Follow Author**: Stay updated with the latest news and updates on Twitter/X

### 🎯 Smoother Setup Experience

- **Clearer language selection**: Removed confusing highlighting in language setup - now it's crystal clear which language options are available
- **Better API key guidance**: Step-by-step instructions with numbered steps make it much easier to set up your API keys with clear visual guidance and helpful tips

### 🚀 Enhanced Library System

- **Version-matched content**: Library tools now automatically fetch content that matches your installed plugin version, ensuring perfect compatibility
- **Smart source detection**: Automatically uses the best source for library content based on your environment

### 🎯 What This Means for You

You'll enjoy a more streamlined experience with:
- Clear visibility into your API usage and costs
- Quick access to your conversation files for easy management
- A smoother, more intuitive setup process
- Reliable access to library content that matches your version

## Version 0.11.2 - January 10, 2025

### 🚀 Performance & Reliability Improvements

- **Cheaper AI responses**: Life Navigator now uses smart caching for Anthropic API responses to reduce wait times and lower your API costs. Your conversations will feel snappier, especially when working within the same context.

- **More reliable tools**: Fixed an issue where some tools (like accessing daily notes from specific dates) would incorrectly reject perfectly valid numbers. Now `🧭 daily_note(-1)` and similar commands work flawlessly every time.

### 🎯 What This Means for You

These improvements work automatically in the background - you don't need to change anything. You'll simply notice:
- Faster response times when working with similar content
- Lower API usage costs over time  
- More consistent tool behavior

### 🔧 Technical Notes

- Enhanced Anthropic API caching with extended cache control headers and 1-hour TTL
- Improved parameter validation system for integer values
- Better data integrity validation for cached responses

## Version 0.11.0 - June 8, 2025

### ⚠️ IMPORTANT: Breaking Changes - Action Required

**This update includes breaking changes that require you to update your existing notes and modes.** Life Navigator will help you through this process with built-in validation and fix tools.

#### What Stopped Working
Old Life Navigator link formats are **no longer supported** and will show as errors:

| ❌ Old Format (No Longer Works) | ✅ New Format (Use This Instead) |
|----------------------------------|-----------------------------------|
| `[[ln-current-date-and-time]] 🧭` | `` `🧭 current_date_time()` `` |
| `[[ln-day-note-(0)]] 🧭` | `` `🧭 daily_note(0)` `` |
| `[[ln-day-note-(-1)]] 🧭` | `` `🧭 daily_note(-1)` `` |
| `[[ln-day-note-(-7:0)]] 🧭` | `` `🧭 daily_notes(-7, 0)` `` |
| `[[ln-currently-open-file]] 🧭` | `` `🧭 current_file_and_selection()` `` |
| `[[ln-currently-selected-text]] 🧭` | `` `🧭 current_file_and_selection()` `` |
| `[[ln-current-chat]] 🧭` | `` `🧭 current_chat()` `` |
| `🔎` emoji | `🧭` emoji only |

#### How to Fix Your Content

**Life Navigator makes this easy with automatic detection and guided fixes:**

1. **Automatic Detection**: When you open Life Navigator, it will automatically detect any old formats in your modes and notes
2. **Fix Buttons**: You'll see "Fix" buttons throughout the interface when issues are found:
   - In the mode dropdown when your current mode has issues
   - In settings when tools need updating
   - In error messages when old links are found
3. **Click to Fix**: Simply click these "Fix" buttons - they'll switch to Guide mode and help you update your content
4. **AI Assistance**: The AI will show you exactly what needs to change and can help make the updates

#### Why This Change Benefits You

The new tool call system is much more powerful and flexible:
- **More options**: Support for calling all tools accessible by a mode directly in your notes
- **Seamless integration**: AI can now access your current editor content and daily notes directly during conversations and  get information from your notes when needed
- **Cleaner syntax**: `` `🧭 daily_note(-1)` `` is shorter and clearer than `[[ln-day-note-(-1)]] 🧭`
- **Future-proof**: New system supports many more capabilities and customization

### 🛠️ Migration Help - We've Got You Covered

- **Smart Validation System**: Automatically scans all your modes and tools to find issues
- **Contextual Fix Buttons**: Fix buttons appear exactly where you need them - no hunting around
- **Detailed Error Reports**: Clear explanations of what needs changing with before/after examples  
- **Guide Mode Integration**: All fix buttons connect to Guide mode for step-by-step assistance
- **Validation Tool**: Use the mode validator to check any file and get detailed migration guidance

### 🚀 New Powerful Tool Call System

**Revolutionary way to use Life Navigator tools directly in your notes:**

#### Multiple Ways to Call Tools
```
`🧭 current_date_time()`                    # No parameters
`🧭 daily_note(-1)`                         # Simple parameters  
`🧭 note_read(path="My Note.md")`           # Named parameters
`🧭 tools_list({safe_only: true})`         # JavaScript objects
`🧭 expand` [[Wiki Link]]                   # Special expand syntax
```

#### Smart Safety System
- **Safe tools** (like reading dates, notes) work automatically in link expansion
- **Potentially dangerous tools** (like creating/editing files) only work in chat conversations

#### Discover Available Tools
Have your ai use `` `🧭 tools_list()` `` to see all available tools for your current mode

### 📊 Enhanced Validation & Quality Control

- **Comprehensive Validation**: Automatic checking of modes and tools for completeness and correctness
- **Icon Validation**: Ensures all mode and tool icons are valid and will display properly
- **Parameter Validation**: Tools validate their inputs before running, preventing errors
- **Better Error Messages**: Clear, helpful error messages instead of technical jargon
- **Multi-language Support**: All validation messages properly translated

### 🎯 User Experience Improvements

- **Auto-Setup**: Life Navigator automatically opens when first installed to guide you through setup
- **Retry Any Message**: Every AI response now has a retry button to regenerate from that point
- **Better Error Handling**: Errors appear in chat instead of disruptive popups
- **Improved Performance**: Better file monitoring system that responds faster to changes

### 🏗️ Under the Hood Improvements

- **Modernized Format**: Mode and tool files now use clean, readable attribute names (`description` instead of `ln_description`)
- **Consistent APIs**: All note editing tools now use the same parameter names for consistency
- **Better File Management**: Improved file watching and change detection
- **Enhanced Internationalization**: Better support for multiple languages with proper grammar rules

### 🐛 Bug Fixes

- **Task Editing**: Fixed task editing to highlight only the changed task instead of the entire file
- **Todo Display**: Fixed todo labels showing correct text after editing
- **Navigation**: Proper navigation targeting after file modifications  
- **Settings**: Fix buttons in settings now properly close the modal
- **Translation**: Fixed various translation issues for non-English users

---

**Ready to Upgrade?** Life Navigator will guide you through the process. Look for the fix buttons and let the AI help you migrate your content to the new, more powerful format!

## Version 0.10.6 - June 6, 2025

### Added
- **Safe note deletion**: New note_delete tool provides safe deletion by moving files to a Trash/Śmietnik directory instead of permanent deletion. Creates trash directory automatically and handles duplicate filenames by adding numbers.
- **Guide mode A/B/C choices**: Guide mode now provides clear A/B/C options at the end of responses to eliminate decision fatigue and create guided conversation flow. Users get actionable choices for exploring features, library content, and next steps with simple "Type A, B, or C to continue" prompts.
- **New compass emoji for link expansion**: The compass emoji 🧭 is now the primary symbol for link expansion, replacing the magnifying glass 🔎. The old magnifying glass emoji is still supported for backward compatibility, so your existing setups will continue to work perfectly.
- **Analytics Mode**: New specialized mode for thorough pattern analysis and accountability conversations that examines 30 days of daily notes to provide data-driven insights about productivity, health, habits, and goal progress
- **Tool Call History in Saved Conversations**: Saved conversations now include information about which tools were used and their labels, making saved chats more complete and useful for reference without cluttering them with large tool results
- **Enhanced Guide Mode**: Comprehensive improvements to the Guide prebuilt mode including:
  - Always browse library index AND check user's actual vault content before making recommendations
  - Clear distinction between library templates/examples vs user's installed content
  - Never assumes library content is installed without checking user's vault first
  - Improved library tool descriptions to clarify they show remote templates, not user content
  - Better vault assessment using vault_find and note_read tools
  - Context limitations notice explaining Guide mode is for discovery/development, not personal reflection
  - Development and prototyping support for creating custom modes and tools
  - Manual references to comprehensive development documentation
  - Mode and tool validation capabilities with automatic quality checking
  - Learning persistence to avoid repeating concepts user already understands
- **Direct Setup Guidance**: Guide mode now focuses on helping users create their actual Life Navigator setup immediately rather than simulations, providing more authentic and immediately useful onboarding
- **Development Documentation**: New comprehensive guides for extending Life Navigator:
  - Mode Development Guide with templates, best practices, and troubleshooting
  - Tool Development Guide covering JavaScript tools, security, and API integration
  - Updated library index with development resources and Analytics mode
- **Mobile tool expansion**: Long press on tool blocks now expands/collapses them on mobile devices, providing the mobile equivalent of desktop's shift+click functionality

### Fixed
- **System prompt view with unresolved links**: Fixed issue where clicking "View system prompt" would fail silently when the mode contained unresolved links (like `[[Backlog2]] 🧭`). Now shows a clear error message explaining which links couldn't be found and how to fix them.
- **Input state persistence**: Input text and attached images now clear automatically when starting a new chat or switching between conversations, preventing confusion and ensuring a clean slate for each conversation.

### Enhanced
- **Guide Mode Intelligence**: Now emphasizes library exploration, provides development guidance, and offers clear A/B/C choices for next steps
- **Library Organization**: Updated index with development documentation and Analytics mode for better discoverability

## Version 0.10.4 - June 5, 2025

### Fixed
- **Message validation cutting off conversations**: Fixed critical issue where the last assistant and user messages weren't being sent to AI when conversations contained incomplete tool calls or thinking blocks earlier in the conversation. Now properly skips problematic messages while preserving valid messages at the end of conversations.
- **Chat history saving**: Fixed issue where conversation history wasn't saving on Mac due to missing conversations directory. The plugin now automatically creates the required directory on startup.

### Enhanced
- **Improved note editing tool**: Fixed multiline text replacement issues by adding smart text normalization that handles different line endings, whitespace, and formatting. Now shows edited content with ±3 lines of context (marking edited lines with ●) and creates precise navigation targets that highlight exactly the edited lines.
- **Better find tool feedback**: The find tool now shows specific counts like "Found 5 items in root" instead of the generic "Found content in root"

### Changed
- **Library tool renamed**: The library content viewing tool is now called "library_read" instead of "library_view" and shows specific file paths in completion messages, making it consistent with the document reading tool
- **Mode name change**: Life Navigator mode is now called "Guide" to better reflect its purpose as a helpful assistant that guides users through their tasks and goals


### Fixed
- **Improved comment indentation**: Task tools now consistently use proper comment indentation.

## Version 0.10.2 - June 5, 2025

### Added
- **Smart text selection**: Easily share any text you've highlighted with the AI using the new `[[ln-currently-selected-text]] 🔎` link. Perfect for editing specific parts of text.
- **Rapid voice recording**: You can now record your next message even if ai is responding to your previous message.
- **Cleaner tool displays**: Multi-line text in AI tools now shows with proper formatting instead of cramped single lines, making everything easier to read.

### Fixed
- **Smarter chat history**: Opening old conversations no longer automatically saves them or moves them to the top unless you actually make changes. Your history stays organized exactly how you left it.
- **Better reading experience**: When you scroll up to read previous messages, the chat stays put instead of annoyingly jumping to the bottom every few seconds.
- **Remembers your preferences**: Your selected mode now stays active when you restart the app - no more having to reselect your favorite mode every time.
- **Perfect conversation flow**: Switching between conversations or starting new messages now works smoothly without any conflicts or interruptions.

## Version 0.10.1 - June 4, 2025

### Fixed
- **Task organization**: Completed tasks now stay organized together instead of appearing in random places
- **Tool names**: Fixed confusing technical names showing up - you now see friendly names like "Add Task" instead of "task_add"  
- **Broken links**: Fixed links in documentation that weren't working
- **Polish language**: Chat titles in history now show in Polish when you have Polish selected
- **History dropdown**: Fixed annoying flicker when clicking the conversation history button
- **Language consistency**: All dropdown messages and search boxes now properly show in your selected language
- **Error messages**: Task-related error messages now appear in Polish when you have Polish selected

## Version 0.10.0 - June 4, 2025

### Added
- **LifeNavigator mode**: New built-in mode that helps guide you and gives instructions. It's always available and can't be deleted.

- **Tool and mode library**: New library system where LifeNavigator can download and set up helpful tools and modes for you. Comes with useful tools and modes to get started.

- **Better secrets management**: Improved way to store your API keys and other sensitive information securely. Your old API keys are automatically moved over.

- **New tools for the AI to help you**:
    - **Advanced note editing**: AI can now make complex edits to your notes, not just add text at the end
    - **File moving**: AI can move files to different folders in your vault
    - **Save conversations**: AI can save your current chat to a note in your vault
    - **Check modes and tools**: AI can verify that your custom modes and tools are set up correctly
    - **Download from web**: AI can grab content from any website and show it in the chat
    - **Better file search**: Improved search tool (renamed from "list directory" to "find")
    - **Browse library**: AI can explore and recommend tools and modes from the library

- **Link control for modes**: You can now control whether your custom modes automatically expand note links or not

- **Create your own tools**: You can now create custom tools by tagging notes with `ln-tool`. The AI will ask for permission before running any custom tools you create.

- **Shift-click to expand**: Hold Shift and click on tool blocks to expand them without navigating away

### Changed
- **Simpler setup**: Cleaner setup screen that's easier to use

### Removed
- **Built-in specialized tools**: YouTube transcripts, image generation, and deep research are now available as downloadable tools instead of being built-in. This makes the core plugin simpler while keeping all the functionality.
- **Manual mode creation**: The "New Mode" button is removed - ask the AI to create modes for you instead

## Version 0.9.3 - June 2, 2025

### Added
- **Better audio controls**: You can now pause and resume audio playback instead of having to stop and restart. Audio remembers exactly where you left off. Audio is also cached so replaying the same message is instant.

### Fixed
- **Mobile text highlighting**: Much better highlighting on phones and tablets, especially iPhones. Text now highlights properly and scrolls to the right position on your screen.
- **Polish language completeness**: Fixed missing Polish translations for task actions - everything now shows in Polish when you have Polish selected.

## Version 0.9.0 - June 1, 2025

### Added

- **Vault exploration**: AI can now browse your vault folders and find files by tags much better
- **Update notifications**: Get notified when new plugin versions are available
- **Multiple daily notes**: Reference several daily notes at once using `[[ln-day-note-(-6:0)]] 🔎` to show the last 7 days
- **Progress updates**: Long operations like research now show live progress instead of leaving you wondering what's happening
- **Smart audio handling**: When you finish recording while audio is playing, it automatically stops the audio and sends your message
- **Remember OpenAI setup**: Skip OpenAI configuration once you've done it - won't ask again until you reset
- **Deep web research**: AI can do comprehensive research across multiple websites and create detailed reports with sources (needs Firecrawl API key)
- **Better settings page**: New buttons for checking updates, creating starter kits, resetting tutorial, and viewing docs
- **Step-by-step setup**: Cleaner onboarding with separate screens for language, starter kit, and API keys
- **Image generation**: Create high-quality images using OpenAI and save them directly to your vault
- **Clickable tool results**: Click on tool blocks in chat to jump directly to the relevant files
- **Choose AI model per mode**: Each mode can use a different Anthropic model
- **YouTube transcripts**: Download transcripts from YouTube videos as notes in your vault
- **Smarter file naming**: Automatically creates unique names (like "research 2.md") to avoid overwriting files
- **Smooth audio playback**: Much better text-to-speech with seamless streaming
- **Better mobile editing**: Edit messages using the full input area instead of tiny inline boxes - much better on phones
- **Conversation history**: Save, search, and return to past conversations. Edit titles, add tags, and continue where you left off
- **Cleaner AI context**: Improved how AI processes your notes for better responses

## Version 0.7.4 - May 26, 2025

### Changed
- **English Starter Kit Recreated**: Completely recreated the English starter kit by translating from the Polish version. All content has been thoroughly translated including filenames, with key translations like "Ziomal" → "Bro" and "O mnie" → "About Me". The English starter kit now matches the comprehensive structure and content of the Polish version.

### Fixed
- **Chat Autoscroll During Agent Response**: Fixed autoscroll functionality to properly scroll to bottom while agent is typing/streaming responses, ensuring users can always see the latest content being generated. Optimized to prevent double-scrolling by using MutationObserver during streaming and conversation-based scrolling otherwise.
- **Starter Kit Directory Creation**: Fixed starter kit creation to handle existing directories by automatically generating unique names (e.g., "Starter Kit v0.4 2", "Starter Kit v0.4 3") instead of failing when a directory already exists

## Version 0.6.13 - May 25, 2025

### Added
- **Edit Todo Tool**: New `edit_todo` tool allows editing existing todo items
- **Remove Todo Tool**: New `remove_todo` tool for removing todo items without deletion
- **Time Parameter for Abandon Todo**: Added `time` parameter to abandon-todo tool for consistent time tracking across all task operations
- **Circular Image Thumbnails**: Improved attached image visualization with compact circular thumbnails and positioned remove buttons for a cleaner, more modern interface

### Changed
- **Relaxed todo format**: All tools now don't enforce emojis etc
- **Edit Todo Tool Parameters**: Simplified edit_todo tool parameter structure by flattening nested objects to direct parameters for better AI model compatibility
- **Enhanced Time Markers**: Both check-todo and abandon-todo tools now use translatable time markers ("completed at XX:XX" / "abandoned at XX:XX") instead of simple timestamps

### Fixed
- **Voice Instructions**: Fixed voice instructions in Bro/Ziomal and Assistant/Asystentka modes with proper personality-matching instructions
- **New Mode Creation**: Fixed new modes using generic translated voice instructions instead of proper detailed DEFAULT_VOICE_INSTRUCTIONS
- **Task Search in Tools**: Improved task search precision by using exact text matching instead of fuzzy matching
- **Multiple Task Moving Order**: Fixed issue where multiple tasks being moved would be inserted in reverse order instead of preserving the parameter order
- **Abandon todo now moves task to the beginning of the note**: Abandoned tasks are now moved to the beginning of the note for better visibility, same as completed tasks
- **Enhanced moveTaskToCurrentSpot function**: Expanded positioning support to handle 'beginning', 'end', and 'after' positions, unifying task movement logic across all tools
- **Translation of removed task comments**: Fixed "Removed task" text in HTML comments to be properly translated in Polish and other languages
- **Mobile Waveform Visualization**: Fixed flat waveform issue on mobile devices by improving AudioContext state management, adding automatic recovery mechanisms, handling mobile browser audio interruptions, and implementing better error detection and recovery
- **Voice Recording with Images**: Fixed issue where the microphone button would disappear when attaching images - users can now record voice notes even when images are attached
- **Recording Input Behavior**: Input field and placeholder are now completely hidden during voice recording and transcription, image preview area is hidden during transcription, and image editing (paste, attach, remove) is disabled during recording and transcription
- **Mobile Usage Example Pills**: Improved styling and visibility of usage example buttons (pills) on mobile devices with better contrast, touch-friendly sizing, proper Obsidian theme integration, and enhanced accessibility features

## Version 0.6.12 - May 25, 2025

### Changed
- Showing mic and send button at the same time

### Fixed
- Styling of main chat
- Better view of pills
- Better editing of messages
- Less invasive thinking indicator
- Removing empty messages so chat can continue
- Skipping current mode in handover options

## Version 0.6.11 - May 23, 2025

### Added
- **Tool Filtering for Modes**: New configuration options for controlling which tools are available in each mode
  - Added `ln_tools_allowed` and `ln_tools_disallowed` fields to mode configuration
  - Supports simple wildcard patterns (e.g., `*todo*`, `create_*`, `*document`)
  - Disallowed patterns take precedence over allowed patterns
  - Default behavior allows all tools (`["*"]`) for backward compatibility
  - Updated starter kit modes with example tool filtering configurations
- **Handover Mode Tool**: New AI tool that allows changing the active mode during conversations
  - Enables AI to switch between different personalities, contexts, or specialized modes

### Changed
- **Enhanced speaker button** Enhanced speaker button with three distinct states: default, generating speech (spinner), and playing (pause button)
- **Improved task insertion logic**: Tasks are now inserted after the task preceding the first uncompleted one, preserving any text/comments between them. This ensures that related content stays with their associated tasks while maintaining logical flow.
- **Improved abandon todo visibility**: Abandoned tasks are now moved to the beginning of the note for better visibility, same as completed tasks
change: enforce thinking in claude, as it's needed for handover to work

### Fixed
- **Fixed multi-line comment indentation**: When todos are checked off or completed with multi-line comments, all lines are now properly indented with 4 spaces instead of only the first line

## Version 0.6.10 - May 22, 2025

### Added
- Added persistence of active mode between plugin sessions

### Changed
- Upgraded from Claude 3.7 Sonnet to Claude 4 Sonnet
- Updated Anthropic SDK from v0.39.0 to v0.52.0
- Renamed "Create a Single Mode" to "Create a New Mode" in UI for better clarity
- Mode name is now derived from file name rather than ln-name attribute
- Improved tool input display to be more compact and generic

### Fixed
- Fixed button text for "Dodawanie zadania" (Adding task) that wasn't changing after task completion
- Fixed Polish translation issues:
  - Added proper translation for "Reading document" tool
  - Fixed pluralization logic for tasks count in Polish language
  - Improved translation system to better handle numbered items
  - Fixed "Oznaczanie zadania 0 zadania" issue by removing task count in in-progress messages
- Fixed error handling in document reading:
  - Now properly throws an error when file is not found instead of returning error message as content
  - Improved error message format for missing files
- Fixed styling issues for non-dark mode users with better theme variable usage

## Version 0.6.7 - May 22, 2025

### Added
- Added `ln-currently-open-file` special link to embed content from the currently open file
- Added `ln-current-chat` special link to embed the current chat content

### Changed
- Standardized naming from "Starter Pack" to "Starter Kit" throughout the codebase for consistency

## Version 0.6.6 - May 22, 2025

### 🚀 Performance Improvements

- **Lightning-fast conversation history**: Completely redesigned the conversation history dropdown with virtual scrolling and smart lazy loading. Opening the dropdown is now instant even with hundreds of conversations, and titles load progressively as you scroll. Conversations are intelligently preloaded into memory for instant switching when you hover near them.

### 🎯 Visual Feedback for Active Chats

- **Pulsating active chat indicator**: Chat history now shows a subtle pulsating animation for any conversation that is currently generating a response. When you have multiple chats running simultaneously, you can easily see which ones are actively working just by glancing at the chat history dropdown.

### 🔄 Automatic Conversation Migration

- **Seamless old conversation access**: Old conversation files from previous versions are now automatically migrated when accessed. No need to run migration scripts - just open any old conversation and it will be seamlessly converted to the new format in the background. Your old chats remain fully accessible while benefiting from the improved performance of the new file format.

- **Simplified file storage**: Conversation files now use simple ID-based names (like `conv_123456.json`) instead of complex title-based names. All metadata including titles and read status is stored inside the file contents, eliminating file renaming operations and improving reliability. This makes the system faster and more robust, especially when managing large numbers of conversations.

### 🚀 New System Prompt View

**View system prompts in a dedicated view instead of modal for a much better experience:**

### 🚀 Improved View Opening Behavior

**Life Navigator now opens views (system prompts, cost analysis,etc.) just like Obsidian opens files - smart, consistent, and user-friendly**

### Added
- **Multiple Chat Support**: Life Navigator now supports loading and managing multiple conversations simultaneously
  - Each view can maintain its own active chat without affecting other views
  - Chat state (messages, generation status, editing state) is now isolated per chat
  - Added `loadChat`, `unloadChat`, and `createNewChat` functions to the store
  - Conversation database now works with specific chat IDs
  - Chat stop and autosave functions are now per-chat
  - unread indicator for chats

### Changed
- **Chat Store Architecture**: Completely refactored to support multiple loaded chats
  - Replaced single `current` chat with a `loaded` Map of chat ID → ChatWithState
  - All chat-related actions now require a `chatId` parameter
  - Per-chat state includes: isGenerating, editingMessage, liveToolResults, abortController, saveTimeout
  - The `activeId` is now managed at the component level instead of globally

### Technical Details
- Extended `Chat` interface with new `ChatWithState` type for runtime state management
- Updated `runConversationTurn` to work with specific chat IDs
- Modified database slice to handle chat ID-based operations
- Component-level state management for active chat selection


### 🚀 Critical Multi-Chat System Fixes

- **Fixed chat loading from history**: Resolved issue where loading conversations from the history dropdown would fail to properly initialize chat state, causing assistant messages to not appear and conversations to become unresponsive
- **Fixed missing mode state in loaded chats**: When loading conversations from history, the chat's active mode is now properly restored from the saved conversation data instead of using the global mode
- **Enhanced chat initialization**: Added robust chat loading verification to ensure chats are properly loaded before use, with automatic fallback for missing chats
- **Improved conversation selection**: History dropdown now properly opens conversations in new tabs using the plugin's standardized view management system
- **Better error handling**: Chat loading failures now provide clear feedback and graceful degradation instead of silent failures
- **Fixed chat interruption on view switching**: Chats now continue running in the background when switching between conversations, allowing multiple chats to operate independently without interrupting each other
- **Added "Open in New Tab" option**: New menu item in the 3-dot menu allows you to open the current chat in a new tab for better multi-chat workflow

### 🎯 What This Means for You

The multi-chat system now works reliably:
- Loading conversations from history works properly and maintains their original mode settings
- Assistant messages appear correctly in loaded conversations
- Each chat maintains its own independent state and mode configuration
- Conversation selection opens properly in new tabs for better organization
- Chats continue running in the background when you switch views, so you can have multiple conversations going simultaneously
- Easy access to open any chat in a new tab via the 3-dot menu for better workspace organization

### Improved
- **Ribbon icon behavior**: Clicking the Life Navigator ribbon icon now focuses existing views in the right sidebar instead of always creating new ones, preventing duplicate panels and providing better workspace management
- **Simplified default mode system**: Replaced complex `getDefaultModeId()` logic with a simple constant that always defaults to the Guide mode, eliminating user confusion and simplifying the codebase significantly

### Fixed
- **Conversation history dropdown sizing**: Fixed virtual dropdown list where skeleton items (loading placeholders) had different heights than loaded items, causing jarring size changes when items loaded. The dropdown now shows consistent item heights throughout the loading process for a smoother experience.
- **Task text handling**: All task-related tools now consistently handle todo text by removing task markers (e.g. '- [ ]') and cleaning up whitespace. This ensures uniform behavior across all task operations.

### Developer Experience
- Automated final review workflow using AI-powered script instead of manual 7-step process

### Fixed
- **Conversation history dropdown styling**: Fixed long conversation titles being cut off by ellipsis hiding the unread indicator. Replaced non-portable webkit-box CSS with modern flexbox layout ensuring unread indicators are always visible regardless of title length. Moved unread indicator to the beginning of titles for better visual proximity.

### Added
- **Task Delegation Tool**: New `mode_delegate` tool enables fire-and-forget delegation of self-contained tasks to specialized modes. Perfect for when you need a different mode to handle a specific task without switching your current conversation. The tool creates a new independent conversation in the target mode and immediately starts working on the delegated task.

### Removed
- **Handover Mode Tool**: Removed the old `handover_mode` tool which switched modes within the same conversation. The new `mode_delegate` tool provides a better approach by creating independent conversations for delegated tasks.

### Enhanced
- **Auto-save conversations while typing**: Conversations now automatically save as you type or attach images, with a smart 2-second delay that prevents unnecessary saves while you're actively writing. Your work is protected without interrupting your flow.
### Changed
- **Improved input area layout**: Moved the mode dropdown to the bottom left of the input area for easier access while typing. The dropdown is now more compact and cursor-like, showing both the mode icon and name. Image attachment button moved to the right side for better logical flow of controls.
