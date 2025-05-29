# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **OpenAI Skip Tracking**: Added tracking of OpenAI API key configuration and skip decisions in tutorial settings. The setup flow now remembers when users skip OpenAI configuration and won't show the OpenAI setup screen again until tutorial is reset. This ensures users who choose to skip voice features aren't repeatedly prompted for OpenAI API keys during subsequent plugin sessions.
- **Settings Page Actions**: Enhanced the settings page with new action buttons. Added "Check for Updates" button that automatically checks for and downloads new plugin versions. Added "Create Starter Kit" button for quick starter kit creation from settings. Added "Reset Tutorial" button that resets the setup flow state and shows onboarding screens again on next plugin open. Added "View Documentation" button that opens the GitHub user guide in the browser for easy access to help and instructions. **Tutorial settings restructuring**: Moved tutorial-related settings into a dedicated `tutorial` object for better organization and future extensibility.
- **Setup Flow with Multiple Screens**: Implemented a comprehensive onboarding experience with sequential setup screens. The setup flow now guides users through four distinct stages: (1) Language Configuration screen to set Obsidian's interface language for optimal experience, (2) Create Starter Kit screen when no modes exist, (3) Anthropic API Key configuration screen when modes exist but no Anthropic key is configured, and (4) OpenAI API Key configuration screen when Anthropic is configured but OpenAI is missing. Each screen provides clear instructions, step-by-step guidance, and proper visual design with the ability to skip optional steps or navigate to settings. **Improved layout**: API key links are now integrated within the step instructions, input labels are positioned near input fields, and settings access uses link styling instead of full buttons for better visual hierarchy. **Dynamic state checking**: Setup flow now automatically detects when API keys are configured outside the setup (e.g., through Obsidian settings) and updates the current step accordingly. **Language support**: Currently supports English and Polish with automatic detection of Obsidian's language setting.
- **GPT-4o Image Generation Tool**: New `generate_image` tool that creates images using OpenAI's latest GPT-4o image generation model (gpt-image-1). Features superior instruction following and photorealistic results compared to previous DALL-E models. Supports customizable size (square, portrait, landscape, auto) and quality settings (low, medium, high, auto). Images are saved directly to the vault with automatic directory creation and navigation support.
- **Clickable Tool Call Blocks**: Tool call blocks in the chat interface are now clickable and provide direct navigation to relevant files and locations
- **Model Selection for Modes**: Added `ln_model` attribute to Life Navigator modes allowing users to specify which Anthropic model to use for each mode
- **YouTube Transcript Download Tool**: New `download_youtube_transcript` tool that downloads transcripts from YouTube videos and saves them to Obsidian files. Supports multiple languages, timestamp inclusion/exclusion, and handles various YouTube URL formats. Includes automatic fallback to default language if specified language is unavailable.
- **HTML Comment Filtering**: System prompts now automatically filter out top-level HTML comments while preserving them in code blocks. This prevents deleted task comments and other HTML annotations from being included in AI context while maintaining code examples intact.

### Changed
- **User Guide Documentation**: Completely updated the user guide to reflect the new sequential setup process. Added detailed sections covering the four-step setup flow (Language Configuration, Starter Kit Creation, Anthropic API Key, OpenAI API Key), new settings page organization, tutorial reset functionality, and comprehensive troubleshooting for setup-related issues. Enhanced mobile usage guidance and advanced features documentation.
- **Setup Screen Icons**: Replaced custom SVG icons with Lucide icons across all setup screens for consistency and better visual integration. Language Selection uses "languages" icon, Starter Kit Creation uses "rocket" icon, Anthropic API Key uses "key" icon, and OpenAI API Key uses "mic" icon to represent voice functionality.
- **Settings Page Layout**: Reorganized settings page for better user experience. Security notice now appears directly below API Keys section where it's most relevant. Life Navigator Actions moved to bottom of settings page for better logical flow. Settings now follow order: API Keys → Advanced Settings → Actions.
- **Reset Tutorial Implementation**: Reset Tutorial functionality is now implemented as a proper command (like Create Starter Kit) instead of directly calling settings methods. Added "Reset Tutorial" command that can be invoked from the command palette and properly integrated with Obsidian's command system. Settings page now invokes this command for consistency with other actions.

### Fixed
- **OpenAI Skip Button**: Fixed skip button functionality in OpenAI setup screen with improved visual feedback and proper loading states. Button now shows "Saving..." text when processing the skip action and provides console logging for debugging. The skip action properly saves the `openaiKeyConfigured` flag and prevents the OpenAI setup screen from appearing again until tutorial is reset.
- **Language Selection Screen**: Fixed language display issues in the setup flow. Now shows only native language names (English, Polski) instead of redundant combinations. Current language info is only displayed for unsupported languages. Removed skip option to ensure users must actively select a language before proceeding. Language selection now happens directly through clicking language buttons for better user experience.
- **Unsupported Language Support**: Added support for currently configured unsupported languages as an option in language selection. Users can now choose to keep their current language setting (e.g., German, French) which will use English for AI interactions while maintaining their Obsidian interface language. Voice features (speech-to-text and text-to-speech) automatically adapt to the user's Obsidian language setting, providing full multilingual voice support regardless of AI interaction language.
- **Language Setup Text Clarity**: Improved language selection screen text to accurately reflect automatic behavior. Text now clearly states that Obsidian will restart automatically when selecting a different language, and emphasizes that voice features automatically work in the chosen language without additional configuration. Removed restart confirmation prompts to make language changes truly seamless.
- **Mode List Update on Deletion**: Fixed issue where the mode list in the dropdown would not update when deleting starter pack or single mode files. The mode list now properly refreshes when mode files are deleted, ensuring the UI stays in sync with the actual available modes.
- **Message Editing Index Bug**: Fixed bug where "Can only edit user messages" error would sometimes appear when editing user messages. The issue was caused by a mismatch between filtered conversation indices (used for display) and original conversation indices (used for editing). Now correctly maps filtered indices to original conversation indices.
- **Handover Mode Tool**: Improved handover messaging to clearly indicate when a new mode has taken control of the conversation. The new mode now receives explicit instructions to continue executing the user's task with its specialized capabilities.

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
