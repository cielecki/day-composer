# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Library Index System**: Created comprehensive `library/index.md` file that catalogs all library content with descriptions and AI-guidance for when files should be downloaded. This enables intelligent file selection based on user context rather than browsing all files.
- **Library Browse & View Tools**: New simplified tool pair for browsing and downloading Life Navigator library content:
  - **Library List Tool** (`library_list`): Browse all available library content using curated index with descriptions and context guidance
  - **Library View Tool** (`library_view`): Download and preview library content using relative paths from library_list
  - **Index-Based Browsing**: Library list tool now reads from `library/index.md` instead of scanning repository via API for faster, more targeted results
  - **Curated Descriptions**: Each file includes description and "Use When" guidance to help AI determine relevance
  - **Simplified Architecture**: Uses relative paths instead of full URLs, removes unnecessary parameters and icons
  - **Library-Focused**: Specifically designed for Life Navigator repository's `/library` directory
  - **Markdown-Only**: Optimized for .md files, letting AI determine content types from paths
  - **Download & Save**: Optional vault saving with auto-generated or custom filenames
  - **Clean Integration**: Tools work together seamlessly - browse with list, download with view
- **Secret Management Tools**: New built-in tools for managing secrets (API keys, tokens, passwords) in the plugin's storage system:
  - **Secret Save Tool**: Allows AI to securely save secrets with validation, overwrite detection, and security reminders
  - **Secret List Tool**: Lists configured secret names without exposing values for security review and management
  - **Secure Storage**: Integrates with existing secrets management system used by user-defined tools
  - **Validation**: Ensures secret keys follow naming conventions (uppercase with underscores)
  - **Security Features**: Provides security notices about plain text storage and hides sensitive values
  - **Global Access**: Saved secrets are available to user-defined tools via `getSecret()` function
- **Mode and Tool Validation Tools**: Added two new built-in validation tools for quality assurance and debugging:
  - **Mode Validator Tool**: Validates Life Navigator mode files for completeness, correctness, and functionality. Checks frontmatter structure, required attributes, link expansion, system prompt rendering, and ensures all mode settings are valid.
  - **Tool Validator Tool**: Validates user-defined tool files for proper structure, schema validity, JavaScript code syntax, and integration with the tool system. Helps identify issues before tools are executed.
  - Both tools provide comprehensive reports with errors, warnings, and informational messages, and include navigation targets to open the validated files for editing.
- **URL Download Tool**: Simple tool for downloading content from any URL and displaying it directly in the chat:
  - **URL Validation**: Ensures proper URL format before attempting download
  - **Content Display**: Shows downloaded content with metadata (content type, length, status)
  - **Error Handling**: Clear error messages for invalid URLs or failed requests
  - **User Agent**: Properly identifies as Life Navigator for web requests
- **Comprehensive Note Editing Tool**: Replaced simple append-to functionality with advanced `note_edit` tool supporting multiple edit operations in sequence:
  - **Replace**: Replace first occurrence of text (supports multiline)
  - **Insert**: Insert content at various positions (after/before text, after/before line numbers, append to end, prepend to start)
  - **Sequential Processing**: Apply multiple edits in one operation with detailed feedback for each step
  - **Enhanced Error Handling**: Descriptive error messages when search text isn't found or line numbers are out of bounds
- **Enhanced Note Creation**: Extended `note_create` tool with auto-versioning capability:
  - **Auto-versioning**: Automatically create versioned filenames when file exists (e.g., 'note.md' becomes 'note 2.md')
  - **Intelligent Naming**: Sequential versioning with proper extension handling
  - **Backward Compatibility**: Optional feature that maintains existing behavior when disabled
- **User-Defined Tools**: Introduced comprehensive system for creating custom tools from Obsidian notes. Users can create tools by adding `ln-tool` tag to note frontmatter with JSON schema and JavaScript implementation. Includes security approval system, sandboxed execution, and example tools for YouTube transcript downloads and weather reports. Feature is disabled by default with clear security warnings. Converted deep research functionality to user-defined tool using direct Firecrawl API requests instead of external dependencies. Converted image generation functionality to user-defined tool using direct OpenAI API requests instead of external dependencies.
- **Generic Secrets Management**: Replaced specific API key fields with flexible secrets system allowing any key-value pairs. Includes UI for adding/editing/deleting secrets with automatic migration from old API keys. Updated to use industry-standard environment variable naming conventions (OPENAI_API_KEY, ANTHROPIC_API_KEY, FIRECRAWL_API_KEY) for better compatibility with other tools and development environments. Added global `getSecret()` function available to all user-defined tools for secure access to API keys and secrets.
- **Security Approval System**: Added security approval system for user-defined tools with code verification and persistent approvals.
- **Three Example User-Defined Tools**: Added three example user-defined tools: YouTube Transcript Tool, Weather Tool, and Template Tool.
- **Tool Creator AI Mode**: Added **Tool Creator** mode for specialized assistance in building user-defined tools with comprehensive guidance and examples.
- **Example User-Defined Tools in Starter Kit**: Example user-defined tools now included in starter kit instead of requiring commands to create.
- **Shift-Click Tool Block Expansion**: Tool blocks with navigation targets can now be expanded/folded using shift-click without triggering navigation, providing better control over content visibility while preserving normal click-to-navigate behavior.
- **Pre-built Modes System**: Introduced LifeNavigator mode that's always available and cannot be deleted
- **Library Tools Integration**: Added `library-list` and `library-view` tools specifically for Life Navigator library content discovery

### Changed
- **API Key Storage**: Migrated from specific API key fields (openAIApiKey, anthropicApiKey, firecrawlApiKey) to generic secrets system with backward compatibility.
- **Setup Screen Overhaul**: Simplified setup screen CSS by removing excessive animations, transforms, and over-styled elements. Replaced 90s-era web design patterns with clean, modern styling that follows Obsidian's design principles. Reduced CSS from ~320 lines to ~90 lines while maintaining functionality and improving visual appeal. Improved language selection interface in setup flow with better visual hierarchy, cleaner current language indicator using a checkmark icon instead of text, and enhanced button styling with proper selected states.
- **User-Defined Tool Naming**: Tool names now come from filenames (like modes) instead of frontmatter `ln-tool-name` field. This makes tool creation simpler and more consistent with how modes work. Tool files can be renamed to change the tool name, and no frontmatter field is required for naming.
- **Secrets**: Fixed issue where secrets edited in settings would not persist after app reload due to legacy loading overwriting the secrets object and improper async handling in the settings UI. The loading process now properly handles migration without overwriting new secrets, and all save operations are properly awaited. Additionally, the saveSettings() method now explicitly excludes legacy API keys from saved data, ensuring complete removal of old properties from data.json after migration.
- **Vault Search Tool**: Improved vault search functionality to use Obsidian's built-in fuzzy search API (`prepareFuzzySearch`) instead of simple string matching. This provides more accurate search results with proper scoring, better relevance ranking, and fuzzy matching capabilities that match Obsidian's native search behavior. Search now covers both file paths and content with intelligent result prioritization.
- **Vault Find Tool**: Renamed `vault_list_directory` tool to `vault_find` to better reflect its search capabilities similar to the Linux `find` command. Updated tool description, translations, and changed icon from folder to search to emphasize its find/search functionality rather than simple directory listing.
- **Complete Starter Kit Removal**: Replaced starter kit system with pre-built modes for better user experience
- **Setup Flow Simplification**: Removed starter kit creation step from setup since pre-built modes are always available
- **Mode Management**: Pre-built modes are protected from deletion and don't show "Open in editor" option

### Fixed
- **Waveform Visibility During Transcription**: Fixed waveform visualization to remain visible during transcription instead of disappearing. The waveform now stays static during transcription (showing the last recorded pattern) and is cleared after transcription completes. This provides better visual feedback by maintaining the visual indication during processing while stopping the distracting animation.
- **Configurable Vault Config Directory**: Fixed hardcoded `.obsidian` directory reference in daily notes settings to use the configurable vault config directory (`app.vault.configDir`) instead, ensuring compatibility with custom Obsidian configuration directories.

### Removed
- **Built-in YouTube Transcript Tool**: Removed the built-in `download_youtube_transcript` tool in favor of the user-defined YouTube transcript tool available in the starter kit. This simplifies the codebase while maintaining functionality through the more flexible user-defined tool system.
- **Built-in Image Generation Tool**: Removed the built-in `generate_image` tool in favor of the user-defined image generation tool available in the starter kit. The new tool uses direct API requests instead of external dependencies, simplifying the codebase while maintaining full functionality.
- **Built-in Deep Research Tool**: Removed the built-in `deep_research` tool in favor of the user-defined deep research tool available in the starter kit. The new tool uses direct API requests instead of external dependencies, simplifying the codebase while maintaining full functionality.
- **Firecrawl SDK Dependency**: Removed `@mendable/firecrawl-js` package dependency as deep research functionality now uses direct API requests, reducing bundle size and external dependencies.
- **Starter Kit System**: Completely removed starter kit creation, generation scripts, and related commands
## [0.9.3] - 2025-06-02

### Added
- **Audio Pause/Resume and Caching**: Enhanced audio controls with true pause/resume functionality and intelligent caching. Audio can be paused and resumed from the exact same position, not just stopped and restarted. Generated audio is cached within components for instant playback on repeated requests, improving performance and reducing API calls. Separate play/pause and stop buttons provide better control over audio playback. Cache uses legacy TTS for reliable audio generation and consistent results. Stop button remains active when audio is paused and resets everything back to the initial state (speaker icon ready to start from beginning). Fixed race condition where stopping audio generation would still play audio when generation completed in background. Main input area properly shows stop button when audio is paused instead of send button.

### Fixed
- **Mobile Highlighting & Scroll Positioning**: Enhanced text highlighting system for mobile devices, especially iOS. Replaced unreliable selection-based highlighting with robust CodeMirror decorations, added mobile-specific CSS with hardware acceleration, implemented iOS-specific focus handling, added visual pulse animation for better visibility on touch devices, and **fixed scroll positioning to ensure highlighted text appears properly on screen**. The system now uses proper `EditorView.scrollIntoView()` with device-optimized positioning (top positioning on mobile, center on desktop) and includes fallback visibility checks.
- **Polish Translation Completeness**: Fixed missing Polish translations for task unchecking and other tool actions. All tool action text (create completed todo, handover mode, read document, abandon todo, add todo) now properly displays in Polish instead of showing English text when Polish is selected as the language.

## [0.9.0] - 2025-06-01

### Added

- **Vault Exploration Tools**: Two new tools help AI browse your vault structure and find tagged files. AI can now navigate directories and locate content by tags more effectively.
- **Automatic Update Notifications**: Get notified when new plugin versions are available.
- **Daily Note Range Support**: Use `[[ln-day-note-(start:end)]] 🔎` to reference multiple daily notes at once. Example: `[[ln-day-note-(-6:0)]] 🔎` shows the last 7 days.
- **Real-Time Progress Updates**: Long-running operations like deep research now show live progress instead of making you wait with no feedback.
- **Auto-Send During Audio Playback**: When you finish recording while audio is playing, it automatically stops the audio and sends your message.
- **OpenAI Setup Memory**: Skip OpenAI configuration once and won't be asked again until you reset the tutorial.
- **Deep Research Tool**: Comprehensive web research using Firecrawl. Searches multiple sources and creates detailed reports with citations. Requires Firecrawl API key.
- **Enhanced Settings Page**: New action buttons for checking updates, creating starter kits, resetting tutorial, and viewing documentation.
- **Guided Setup Flow**: Step-by-step onboarding with separate screens for language selection, starter kit creation, and API key configuration.
- **GPT-4o Image Generation Tool**: Create high-quality images using OpenAI's latest model. Images are saved directly to your vault.
- **Clickable Tool Calls**: Click on tool call blocks in chat to navigate directly to relevant files and locations.
- **Model Selection for Modes**: Choose which Anthropic model each mode uses via the `ln_model` attribute.
- **YouTube Transcript Downloads**: Download transcripts from YouTube videos and save them as Obsidian files. Supports multiple languages and timestamp options.
- **Improved File Handling**: Automatic unique filename generation prevents overwrite errors (e.g., "research.md", "research 2.md").
- **Streaming Text-to-Speech**: Smooth, low-latency audio playback with intelligent text chunking and predictive buffering.
- **Mobile Message Editing**: Edit messages using the main input area instead of cramped inline editing. Much better experience on phones and tablets.
- **Conversation History**: Save, search, and revisit past conversations. Edit titles, add tags, and continue previous chats seamlessly.
- **AI Context Optimization**: Improved AI context handling by removing HTML comments from context data to prevent instructional information from skewing AI responses.

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

