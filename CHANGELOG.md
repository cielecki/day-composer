# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [0.6.7] - 2025-05-22

### Added
- Added `ln-currently-open-file` special link to embed content from the currently open file
- Added `ln-current-chat` special link to embed the current chat content

### Changed
- Standardized naming from "Starter Pack" to "Starter Kit" throughout the codebase for consistency

## [0.6.6] - 2025-05-22

### Added
- Check for updates now asks for reloading obsidian using a dedicated dialog
- Customizable prompt for transcriptions

### Fixed
- Check for updates is now translated and is properly named
- Styling issue that broke all mod-cta buttons in obsidian
- Transcription issues

## [0.6.5] - 2025-05-22
...
