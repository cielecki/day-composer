# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Automatic Update Notifications**: Added automatic startup version checking that notifies users when new plugin versions are available. Features include: configurable auto-check setting in Advanced Settings (enabled by default), frequency limiting to check maximum once per 24 hours, non-intrusive notifications that direct users to plugin settings for manual updates, version tracking to avoid repeated notifications for the same version, and silent failure handling to avoid interrupting user experience. Users can disable automatic checks in settings while retaining manual update functionality.
- **Daily Note Range Support**: Added support for daily note ranges using the format `[[ln-day-note-(start:end)]] 🔎`. This allows referencing multiple daily notes in a single link, with start and end offsets from today. For example, `[[ln-day-note-(-7:0)]] 🔎` expands to show the last 7 days of daily notes. The implementation efficiently expands ranges into individual daily note links, reusing existing single note processing logic.
- **Progressive Tool Execution System**: Implemented a revolutionary context-based tool execution system that provides real-time progress reporting for long-running operations. Tools now report their progress incrementally instead of waiting until completion, giving users immediate feedback on what's happening. Features include: context-based execution with unified parameter passing, real-time progress messages streamed to the UI, dynamic navigation target reporting as they become available, and seamless abort signal integration for responsive cancellation. The deep research tool has been converted to showcase this system with live progress updates during web scraping, analysis, and report generation phases. This provides a much better user experience for long-running operations like research, file processing, and complex task operations.
- **Auto-Send During Audio Playback**: When transcription completes while audio is playing, the system now automatically stops the audio and sends the transcribed message. Additionally, clicking the microphone button to start recording now automatically stops any playing audio. This provides a seamless experience where users can interrupt audio playback with voice input and have their message sent immediately without manual intervention.
- **OpenAI Skip Tracking**: Added tracking of OpenAI API key configuration and skip decisions in tutorial settings. The setup flow now remembers when users skip OpenAI configuration and won't show the OpenAI setup screen again until tutorial is reset. This ensures users who choose to skip voice features aren't repeatedly prompted for OpenAI API keys during subsequent plugin sessions.
- **Firecrawl Deep Research Tool**: New `deep_research` tool that conducts comprehensive web research using Firecrawl's AI-powered research capabilities. Searches multiple sources, extracts relevant information, and synthesizes findings into detailed reports with citations. Features configurable research depth (1-10 iterations), URL limits (5-50 sources), and timeout settings (60-300 seconds). Requires Firecrawl API key configuration in settings. Provides real-time progress tracking with activity indicators for search, scraping, analysis, and synthesis phases.
- **Settings Page Actions**: Enhanced the settings page with new action buttons. Added "Check for Updates" button that automatically checks for and downloads new plugin versions. Added "Create Starter Kit" button for quick starter kit creation from settings. Added "Reset Tutorial" button that resets the setup flow state and shows onboarding screens again on next plugin open. Added "View Documentation" button that opens the GitHub user guide in the browser for easy access to help and instructions. **Tutorial settings restructuring**: Moved tutorial-related settings into a dedicated `tutorial` object for better organization and future extensibility.
- **Setup Flow with Multiple Screens**: Implemented a comprehensive onboarding experience with sequential setup screens. The setup flow now guides users through four distinct stages: (1) Language Configuration screen to set Obsidian's interface language for optimal experience, (2) Create Starter Kit screen when no modes exist, (3) Anthropic API Key configuration screen when modes exist but no Anthropic key is configured, and (4) OpenAI API Key configuration screen when Anthropic is configured but OpenAI is missing. Each screen provides clear instructions, step-by-step guidance, and proper visual design with the ability to skip optional steps or navigate to settings. **Improved layout**: API key links are now integrated within the step instructions, input labels are positioned near input fields, and settings access uses link styling instead of full buttons for better visual hierarchy. **Dynamic state checking**: Setup flow now automatically detects when API keys are configured outside the setup (e.g., through Obsidian settings) and updates the current step accordingly. **Language support**: Currently supports English and Polish with automatic detection of Obsidian's language setting.
- **GPT-4o Image Generation Tool**: New `generate_image` tool that creates images using OpenAI's latest GPT-4o image generation model (gpt-image-1). Features superior instruction following and photorealistic results compared to previous DALL-E models. Supports customizable size (square, portrait, landscape, auto) and quality settings (low, medium, high, auto). Images are saved directly to the vault with automatic directory creation and navigation support.
- **Clickable Tool Call Blocks**: Tool call blocks in the chat interface are now clickable and provide direct navigation to relevant files and locations
- **Model Selection for Modes**: Added `ln_model` attribute to Life Navigator modes allowing users to specify which Anthropic model to use for each mode
- **YouTube Transcript Download Tool**: New `download_youtube_transcript` tool that downloads transcripts from YouTube videos and saves them to Obsidian files. Supports multiple languages, timestamp inclusion/exclusion, and handles various YouTube URL formats. Includes automatic fallback to default language if specified language is unavailable.
- **HTML Comment Filtering**: System prompts now automatically filter out top-level HTML comments while preserving them in code blocks. This prevents deleted task comments and other HTML annotations from being included in AI context while maintaining code examples intact.
- **Unique File/Directory Name Generation**: Created reusable utility functions for generating unique file and directory names by appending numbers when paths already exist. Deep research tool now automatically generates unique filenames (e.g., "research.md", "research 2.md") instead of throwing errors when files exist and overwrite is disabled. Path determination happens at the end of the research process to avoid reserving filenames during potentially long-running operations. Extracted existing directory naming logic from starter kit creation into shared utilities for consistent behavior across all file operations.
- **Revolutionary TTS Streaming System**: Production-ready streaming text-to-speech with seamless, low-latency audio playback
  - **Intelligent Text Chunking**: Automatically splits text at natural speech boundaries (sentences, clauses, conjunctions)
  - **Predictive Buffer Management**: Starts generating next chunk before current finishes for gap-free playback
  - **Adaptive Performance**: Learns from network speed and API response times for optimal timing
  - **Mobile Optimized**: Uses only HTML Audio elements for maximum iOS and Android compatibility
  - **Production Quality**: Automatic error recovery, memory management, and retry logic
  - **Real-time Monitoring**: Buffer health, progress tracking, and performance metrics
  - **Configurable Settings**: Adjustable chunk sizes, timing parameters, and debug options
  - **Test Interface**: Built-in test modal with real-time monitoring and custom text input
  - **Direct Integration**: Seamlessly integrated into existing TTS context for backward compatibility
- Command palette integration: `🎵 Test TTS Streaming System` for easy testing
- Comprehensive TTS streaming configuration panel in plugin settings
- **Mobile-Friendly Message Editing**: Completely redesigned message editing for mobile devices. Instead of inline editing that becomes unusable when the keyboard appears, clicking edit now transforms the primary unified input area into editing mode. Features include: editing header with "Editing message" label and close button, conversation view filtered to show only messages up to the edited one, support for editing both text and images in the unified input area, proper Cancel/Save button controls, seamless return to previous state when cancelled, voice recording support during editing, and automatic transcription appending to existing text. This provides a much better mobile UX similar to modern messaging apps.
- **Conversation History**: Implemented comprehensive conversation storage and review functionality
  - JSON-based database with migration support for conversation persistence
  - Automatic conversation saving with debounced updates
  - Search and filter conversations by title, content, or tags
  - Edit conversation titles and add custom tags
  - Load previous conversations to continue interactions
  - Conversation metadata including creation date, message count, and associated mode
  - Beautiful UI inspired by Obsidian Smart Composer for browsing conversation history
  - Data stored securely in `.obsidian/plugins/life-navigator/conversations.json`
  - Export functionality for backup and data portability

### Changed
- **User Guide Documentation**: Completely updated the user guide to reflect the new sequential setup process. Added detailed sections covering the four-step setup flow (Language Configuration, Starter Kit Creation, Anthropic API Key, OpenAI API Key), new settings page organization, tutorial reset functionality, and comprehensive troubleshooting for setup-related issues. Enhanced mobile usage guidance and advanced features documentation.
- **Setup Screen Icons**: Replaced custom SVG icons with Lucide icons across all setup screens for consistency and better visual integration. Language Selection uses "languages" icon, Starter Kit Creation uses "rocket" icon, Anthropic API Key uses "key" icon, and OpenAI API Key uses "mic" icon to represent voice functionality.
- **Settings Page Layout**: Reorganized settings page for better user experience. Security notice now appears directly below API Keys section where it's most relevant. Life Navigator Actions moved to bottom of settings page for better logical flow. Settings now follow order: API Keys → Advanced Settings → Actions.
- **Reset Tutorial Implementation**: Reset Tutorial functionality is now implemented as a proper command (like Create Starter Kit) instead of directly calling settings methods. Added "Reset Tutorial" command that can be invoked from the command palette and properly integrated with Obsidian's command system. Settings page now invokes this command for consistency with other actions.
- **Voice Recording Enhancement**: Voice recording can now be used even when there's existing text in the input area - the transcription will be appended to the existing message and automatically sent

### Fixed
- **Compact Conversation History Layout**: Simplified conversation history dropdown to show only conversation title and timestamp on a single line. Removed mode display and message count to make the dropdown more compact and allow more conversations to be visible at once. Reduced padding and optimized styling for better space utilization.
- **Conversation History Dropdown Icon Buttons**: Improved edit and delete buttons in conversation history dropdown to use proper Lucide icon buttons (pencil and trash-2 icons) instead of emoji characters. The buttons now have consistent styling with other icon buttons in the interface, including proper sizing and alignment.
- **Conversation History Dropdown Styling**: Fixed conversation history dropdown not displaying as a proper floating overlay. The dropdown was showing inline in the sidebar flow instead of as a positioned dropdown relative to the history button. Fixed by moving the dropdown to be positioned relative to the history button, replacing Tailwind CSS classes with proper CSS classes defined in styles.css, and ensuring correct z-index and positioning for proper dropdown behavior.
- **Conversation Database Initialization Error**: Fixed critical error "Conversation database not initialized" that occurred when the LifeNavigatorView component was rendered before the database finished initializing. The fix makes conversation database access conditional and only renders the conversation history dropdown when the database is ready, eliminating the race condition between component rendering and asynchronous database initialization.
- **Thinking Block Animation and API Validation**: Fixed issue where thinking block animation continued after stopping chat mid-thinking and resolved API validation errors when stopping incomplete thinking blocks. Solution includes proper abort event detection, cleanup of animation flags, and filtering of incomplete thinking blocks from API calls according to Anthropic requirements (only thinking blocks with signatures generated by Anthropic can be sent to the API). Cleaned up implementation by removing debug console logs while maintaining essential error logging.
- **Windows Starter Kit Creation**: Fixed critical bug on Windows where starter kit creation would fail with "Folder already exists" error after creating only the first file. Improved nested directory creation logic to handle Windows path normalization properly and avoid race conditions. The fix ensures that nested directories (like "Info/About Me") are created recursively with proper parent directory checks, resolving the Windows-specific filesystem handling issues.
- **Tool Translation Completeness**: Fixed missing translations in multiple tools where hardcoded English text was used instead of proper localization. Updated deep research tool result messages, navigation descriptions across all tools (create/read/append document, download transcript, todo operations), and error messages in handover mode tool. All user-facing text is now properly translated for both English and Polish locales, ensuring consistent language experience throughout the plugin.
- **HTML Comment Task Parsing**: Fixed critical bug where tasks inside HTML comments (e.g., `<!-- USUNIĘTE ZADANIE: - [ ] task -->`) were incorrectly parsed as real tasks. The markdown parser now properly tracks HTML comment boundaries and ignores task syntax within comments, ensuring that only actual markdown tasks are processed for operations like add_todo with position "beginning". This prevents tools from inserting new tasks at incorrect locations based on commented-out tasks.
- **Incomplete Tool Call Handling**: Fixed critical bug where stopping generation during tool calls would cause Anthropic API errors ("tool_use ids were found without tool_result blocks"). Implemented comprehensive solution including: (1) Message validation that filters incomplete tool calls before sending to Anthropic API, (2) Cleanup functions for partial tool calls when generation is stopped, (3) Improved abort handling with proper UI state reset to prevent persistent "generating" indicators, and (4) User feedback when incomplete tool calls are removed. This ensures robust handling of interrupted tool calls and prevents API errors from malformed message sequences.
- **Console Log Translation**: Fixed console log statements that were incorrectly using translation functions. Console logs are now in plain English only and translation keys for logs have been removed from all language files. Console messages should never be translated as they are for debugging purposes.
- **OpenAI Skip Button**: Fixed skip button functionality in OpenAI setup screen with improved visual feedback and proper loading states. Button now shows "Saving..." text when processing the skip action and provides console logging for debugging. The skip action properly saves the `openaiKeyConfigured` flag and prevents the OpenAI setup screen from appearing again until tutorial is reset.
- **Language Selection Screen**: Fixed language display issues in the setup flow. Now shows only native language names (English, Polski) instead of redundant combinations. Current language preference is properly highlighted and the selection process works correctly without showing technical identifiers to users.
- **Conversation History Modal Display**: Fixed issue where conversation history was displaying as a modal within the sidebar, creating a weird nested modal experience. Now uses Obsidian's native Modal API to display as a proper system-level modal that overlays the entire interface. Created new `ConversationHistoryModal` component that extends Obsidian's Modal class for proper integration with the application's modal system.
- **Conversation Auto-Save**: Fixed conversation auto-save mechanism that wasn't triggering properly. Changed from using `conversationRef.current` as a dependency (which doesn't trigger re-renders) to using a `conversationVersion` state that increments when conversations change. Auto-save now works correctly with a 2-second debounce after conversation changes, ensuring conversations are preserved even if the plugin is closed unexpectedly.
- **Conversation History Interface**: Replaced modal interface with a dropdown component similar to the mode selector. The new dropdown provides instant access to recent conversations with search functionality, conversation title editing, and delete options. Conversations are now saved immediately after the first exchange between user and assistant, with AI-generated titles that capture the main topic or intent of the conversation. The interface is more efficient and follows the existing design patterns established in the application.
- **Mobile-Friendly Conversation History Buttons**: Improved edit and delete buttons in conversation history dropdown for better mobile usability. Buttons now use the standard `clickable-icon` class with larger size (18px instead of 14px) and are always visible instead of only appearing on hover. This ensures better touch targets and accessibility on mobile devices.
- **Message Content Block Styling**: Reduced border-radius on user message content blocks from 12px to 4px and general message containers from 8px to 4px for a cleaner, more integrated appearance that doesn't look out of place when overlaying chat content.

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
