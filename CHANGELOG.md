# Changelog

All notable changes to this project will be documented in this file.

## [0.10.6] - 2025-06-06

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

## [0.10.4] - 2025-06-05

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

## [0.10.2] - 2025-06-05

### Added
- **Smart text selection**: Easily share any text you've highlighted with the AI using the new `[[ln-currently-selected-text]] 🔎` link. Perfect for editing specific parts of text.
- **Rapid voice recording**: You can now record your next message even if ai is responding to your previous message.
- **Cleaner tool displays**: Multi-line text in AI tools now shows with proper formatting instead of cramped single lines, making everything easier to read.

### Fixed
- **Smarter chat history**: Opening old conversations no longer automatically saves them or moves them to the top unless you actually make changes. Your history stays organized exactly how you left it.
- **Better reading experience**: When you scroll up to read previous messages, the chat stays put instead of annoyingly jumping to the bottom every few seconds.
- **Remembers your preferences**: Your selected mode now stays active when you restart the app - no more having to reselect your favorite mode every time.
- **Perfect conversation flow**: Switching between conversations or starting new messages now works smoothly without any conflicts or interruptions.

## [0.10.1] - 2025-06-04

### Fixed
- **Task organization**: Completed tasks now stay organized together instead of appearing in random places
- **Tool names**: Fixed confusing technical names showing up - you now see friendly names like "Add Task" instead of "task_add"  
- **Broken links**: Fixed links in documentation that weren't working
- **Polish language**: Chat titles in history now show in Polish when you have Polish selected
- **History dropdown**: Fixed annoying flicker when clicking the conversation history button
- **Language consistency**: All dropdown messages and search boxes now properly show in your selected language
- **Error messages**: Task-related error messages now appear in Polish when you have Polish selected

## [0.10.0] - 2025-06-04

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

## [0.9.3] - 2025-06-02

### Added
- **Better audio controls**: You can now pause and resume audio playback instead of having to stop and restart. Audio remembers exactly where you left off. Audio is also cached so replaying the same message is instant.

### Fixed
- **Mobile text highlighting**: Much better highlighting on phones and tablets, especially iPhones. Text now highlights properly and scrolls to the right position on your screen.
- **Polish language completeness**: Fixed missing Polish translations for task actions - everything now shows in Polish when you have Polish selected.

## [0.9.0] - 2025-06-01

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

## [0.7.4] - 2025-05-26

### Changed
- **English Starter Kit Recreated**: Completely recreated the English starter kit by translating from the Polish version. All content has been thoroughly translated including filenames, with key translations like "Ziomal" → "Bro" and "O mnie" → "About Me". The English starter kit now matches the comprehensive structure and content of the Polish version.

### Fixed
- **Chat Autoscroll During Agent Response**: Fixed autoscroll functionality to properly scroll to bottom while agent is typing/streaming responses, ensuring users can always see the latest content being generated. Optimized to prevent double-scrolling by using MutationObserver during streaming and conversation-based scrolling otherwise.
- **Starter Kit Directory Creation**: Fixed starter kit creation to handle existing directories by automatically generating unique names (e.g., "Starter Kit v0.4 2", "Starter Kit v0.4 3") instead of failing when a directory already exists

## [0.6.13] - 2025-05-25

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

## [0.6.12] - 2025-05-23

### Changed
- Showing mic and send button at the same time

### Fixed
- Styling of main chat
- Better view of pills
- Better editing of messages
- Less invasive thinking indicator
- Removing empty messages so chat can continue
- Skipping current mode in handover options

## [0.6.11] - 2025-05-23

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

## [0.6.10] - 2025-05-22

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

## [0.6.7] - 2025-05-22

### Added
- Added `ln-currently-open-file` special link to embed content from the currently open file
- Added `ln-current-chat` special link to embed the current chat content

### Changed
- Standardized naming from "Starter Pack" to "Starter Kit" throughout the codebase for consistency

## [0.6.6] - 2025-05-22


## [Unreleased]

### Fixed
- **Todo editing display**: Fixed issue where todo labels showed the original text instead of the new text after editing, and success messages displayed template placeholders instead of actual values


### Added
- **Tool parameter validation**: Tools now validate all parameters against their JSON schema before execution, providing clear error messages to the AI when parameters are invalid or missing. This prevents tools from running with incorrect data and improves error feedback.

### Enhanced
- **Schema-based parameter validation**: All tool parameters are now validated for type correctness, required fields, string length constraints, number ranges, array sizes, enum values, and nested object properties. Invalid parameters are caught early with descriptive error messages.
- **Translation cleanup script improvements**: The script now explicitly detects and warns about dynamic translation keys that break static analysis, provides clear step-by-step instructions for fixing issues, and gives specific guidance on what to do after adding new translation keys

### Changed
- **Mode attributes now use human-readable names**: Changed from `ln_` prefixes to clear names (`ln_description` → `description`, `ln_icon` → `icon`, etc.) for better readability and following Obsidian naming conventions
- **Static error messages for old format modes**: Replaced dynamic error messages with static ones to improve translation management and prevent runtime issues
- **Validation messages now properly translated**: Tool and mode validation completion messages show different status based on results (success, warnings, errors) with proper translations instead of hard-coded English text

### Added
- **Old format detection with guided fix**: When old `ln_` format is detected in mode files, a static error message is displayed with a button that automatically switches to guide mode and asks for help fixing the mode file formatting

### Fixed
- **Documentation examples updated**: Fixed Tool Development Guide and Tool Creator mode examples that were using outdated `ln_` format attributes, which could mislead AI when creating modes and tools

### Added
- **Comprehensive validation system**: New centralized validation for both mode and tool files that detects various issues including old format, missing fields, invalid values, and security concerns. Validation runs automatically when files are loaded and provides detailed error reports.
- **Contextual fix buttons**: Smart fix buttons appear throughout the UI when validation issues are detected:
  - Empty chat shows fix button for the current mode if it has validation issues
  - Mode dropdown shows fix button for the currently selected mode if it has issues (positioned as last option before mode switching section)  
  - Guide mode shows fix buttons for modes and tools when issues exist
  - Settings tool section shows fix button when tool validation errors are found
  - All buttons automatically switch to Guide mode and send appropriate help messages
- **Enhanced validation tool**: Updated mode validator tool now supports both modes and tools with comprehensive validation using the centralized system, providing detailed reports with specific error types and severity levels.

### Fixed
- **Note editing tool parameter consistency**: Unified all note editing operations to use a single 'content' parameter instead of having separate 'content' and 'replacement_text' parameters. This makes the API more consistent and intuitive - all operations now use 'content' for the text they work with.

### Enhanced
- **Icon validation for modes and tools**: All mode and tool icons are now validated to ensure they are valid Lucide icons available in Obsidian. The validation system checks icon names and provides helpful error messages with links to the Lucide icon library when invalid icons are used.
- **Tool attributes now use human-readable names**: Updated all tool parameters from `ln_` prefixes to clear names (`ln_description` → `description`, `ln_icon` → `icon`, `ln_version` → `version`, `ln_enabled` → `enabled`) for consistency with mode format and better readability. All library tools and documentation updated to use new format while maintaining backward compatibility.
- **Backward compatibility**: Mode and tool files using old `ln_` format continue to work while validation system detects and reports the format issues for user awareness.
- **Validation tracking**: Store now tracks invalid modes and tools separately, enabling targeted fix suggestions and better user experience.
- **Improved internationalization**: Validation messages now use separate translation keys for different plural forms instead of handling pluralization in code, providing better language support and maintaining proper grammar rules for each language.
- **Detailed validation error messages**: Validation fix buttons now show actual file paths instead of just counts, making it easier to identify which specific files need attention. Messages display up to 5 file paths and indicate when there are more files with issues.
- **Mode validator tool translations**: Fixed hardcoded English text in the mode validator tool to use proper translation keys, ensuring all tool labels and status messages display correctly in the user's selected language.
- **Enhanced error message interface**: Error messages now display clean icon-based buttons (retry and help) using the same styling as other interface elements, improving visual consistency and user experience
- **Improved error message styling**: Updated error message buttons to use consistent clickable-icon styling with proper icons (life-buoy for help, rotate-ccw for retry) instead of text-based buttons

### Added
- **Retry button on all assistant messages**: Every assistant message now has a retry button that allows you to retry from that point in the conversation. The retry removes the selected message and all messages after it, then generates a new response.

### Fixed
- **API error handling**: Fixed critical error where error messages were being sent to the Anthropic API with an invalid 'error_message' content type. Error messages are now converted to regular text blocks so the AI can be aware of errors and provide better assistance.
- **Error message context**: Error messages now include the mode name when asking for help, providing better context to the AI about which mode is experiencing the problem.
- **Error messages with fix buttons**: When link expansion errors occur (like missing `[[Backlog2]] 🧭` links), they now appear as styled error messages in the chat instead of popup notifications. Error messages include a "Fix with Guide" button that automatically switches to Guide mode and sends an appropriate help request.

### Enhanced
- **Shared file monitoring**: Improved performance by creating a reusable file watcher utility that both modes and tools systems now use with debouncing to prevent excessive reloading during rapid file changes. The utility uses a clean tag-based approach similar to the existing `hasModeTag` function, reducing code duplication and ensuring consistent behavior across both systems.

### Fixed
- **Task editing navigation**: Fixed issue where editing a task would cause the entire file to be selected instead of just the modified task. The problem was that navigation targets were calculated using the old document structure instead of the updated one after task modification.


### Added
- **Expand Life Navigator links in note reading**: The note_read tool now supports an optional `expand_links` parameter that expands special Life Navigator links (like `[[ln-day-note-(-1)]] 🧭`, `[[ln-current-date-and-time]] 🧭`) when reading files. This allows AI to access dynamic content when analyzing notes.

### Changed
- **In-Chat Error Handling:**
Replace popup notifications with in-chat error messages for better user experience and context preservation. When API key errors, authentication failures, or other system errors occur, display them as special error messages directly in the chat interface instead of disruptive popup notifications. This would keep error information accessible within the conversation context, allow users to reference errors while troubleshooting, and maintain a smoother conversational flow without interrupting the user's workflow.