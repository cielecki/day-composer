# Life Navigator - Development Guide

## Overview

Life Navigator is an AI-powered Obsidian plugin that transforms your note-taking experience into a comprehensive life management system. This guide covers everything you need to know to contribute to the project, from setting up your development environment to understanding the codebase architecture.

## Project Architecture

### Core Components

- **Main Plugin (`src/main.ts`)**: Entry point and plugin lifecycle management
- **AI Coach View (`src/ai-coach-view.tsx`)**: Main UI component for the chat interface
- **Context Collector (`src/context-collector.ts`)**: Manages AI context from linked files
- **Tools System (`src/tools/`)**: AI function calling tools for task management and file operations
- **Mode System (`src/services/ModeManagerService.ts`)**: Manages different AI personalities/modes
- **Components (`src/components/`)**: React UI components for the interface

### Key Technologies

- **TypeScript**: Primary language for type safety and better development experience
- **React**: UI framework for the chat interface and components
- **esbuild**: Fast bundling and compilation
- **Obsidian API**: Integration with Obsidian's plugin system
- **Anthropic Claude & OpenAI**: AI model providers
- **i18next**: Internationalization support

## Development Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Obsidian** installed on your system
- **Git** for version control

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/cielecki/life-navigator.git
   cd life-navigator
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Development in Obsidian vault** (recommended):
   ```bash
   # Create a symlink in your test vault's plugins directory
   ln -s /path/to/life-navigator /path/to/your/vault/.obsidian/plugins/life-navigator
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Enable the plugin in Obsidian**:
   - Open Obsidian Settings
   - Go to Community Plugins
   - Enable "Life Navigator"

### Development Workflow

1. **Make changes** to source files in `src/`
2. **esbuild watches** and automatically recompiles to `main.js`
3. **Reload Obsidian** to see changes (Ctrl/Cmd + R)
4. **Test your changes** in the AI Coach view

## Project Structure

```
life-navigator/
├── src/                          # Source code
│   ├── main.ts                   # Plugin entry point
│   ├── ai-coach-view.tsx         # Main chat interface
│   ├── context-collector.ts      # AI context management
│   ├── components/               # React UI components
│   │   ├── AICoachApp.tsx        # Main chat application
│   │   ├── UnifiedInputArea.tsx  # Voice/text input component
│   │   └── ...
│   ├── tools/                    # AI function calling tools
│   │   ├── add-todo.ts           # Task creation
│   │   ├── check-todo.ts         # Task completion
│   │   └── ...
│   ├── services/                 # Core services
│   ├── settings/                 # Plugin settings
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions
├── docs/                         # Documentation
├── scripts/                      # Build and utility scripts
├── styles.css                    # Plugin styles
├── manifest.json                 # Plugin metadata
├── package.json                  # Node.js dependencies
└── esbuild.config.mjs           # Build configuration
```

## Key Features Implementation

### AI Context System

The plugin uses a sophisticated context expansion system through `context-collector.ts`:

- **Link Expansion**: Files linked with 🔎 emoji are automatically included in AI context
- **Dynamic Context**: Context is collected in real-time based on current conversation
- **Privacy Control**: Users have explicit control over what data is shared with AI

### Mode System

AI personalities are managed through markdown files:

- **Mode Files**: Each mode is a `.md` file with YAML frontmatter
- **Dynamic Loading**: Modes are loaded and parsed at runtime
- **Customizable**: Users can create custom modes with specific prompts and behaviors

### Tools Architecture

The tools system enables AI function calling:

- **Modular Design**: Each tool is a separate TypeScript file
- **Type Safety**: Strongly typed tool parameters and responses
- **Obsidian Integration**: Direct manipulation of vault files and tasks

## Building and Testing

### Development Build

```bash
npm run dev
```

This starts esbuild in watch mode, automatically recompiling when files change.

### Production Build

```bash
npm run build
```

Creates an optimized build with minification and no source maps.

### Starter Kit Generation

```bash
npm run generate-starter
```

Regenerates the starter kit files from the `src/generated/` directory.

## Release Process

### Automated Releases (Recommended)

1. **Update version** using the version script:
   ```bash
   node scripts/version.js X.X.X
   ```
   This script automatically:
   - Updates `package.json` and `manifest.json` with the new version
   - Commits the changes with message "chore: bump version to X.X.X"
   - Creates an annotated git tag
   - Pushes both commits and tags to the repository

   If no version is specified, it will automatically bump the patch version (e.g., 0.6.17 → 0.6.18).

2. **GitHub Actions** automatically builds and creates release when the tag is pushed

### Manual Release

If you need to create a release manually without using the automated script:

1. **Update version files manually**:
   - Update `version` field in `package.json`
   - Update `version` field in `manifest.json`

2. **Build the plugin**:
   ```bash
   npm run build
   ```

3. **Create GitHub release**:
   - Create a new release on GitHub with tag matching the manifest version
   - Upload `main.js`, `manifest.json`, and `styles.css` as assets

**Note**: The automated script (`node scripts/version.js X.X.X`) is strongly recommended as it handles all git operations and ensures consistency.

## Contributing Guidelines

### Code Style

- **TypeScript**: Use strict typing, avoid `any`
- **React**: Functional components with hooks
- **Naming**: Use descriptive names, follow existing conventions
- **Comments**: Document complex logic and AI tool functions

### Pull Request Process

1. **Fork** the repository
2. **Create feature branch** from main
3. **Make changes** with clear, focused commits
4. **Test thoroughly** in Obsidian
5. **Submit PR** with detailed description

### Testing

- **Manual Testing**: Test all features in Obsidian
- **Cross-Platform**: Test on desktop and mobile
- **Edge Cases**: Test with various vault configurations
- **AI Integration**: Verify AI tools work correctly

## Debugging

### Common Issues

1. **Plugin not loading**: Check browser console for errors
2. **Build failures**: Ensure all dependencies are installed
3. **AI errors**: Verify API keys are configured correctly
4. **Context issues**: Check link expansion syntax

### Debug Tools

- **Browser DevTools**: Access via Ctrl/Cmd + Shift + I in Obsidian
- **Console Logging**: Use `console.log()` for debugging
- **Obsidian Debug**: Enable debug mode in Obsidian settings

## API Keys and Configuration

### Required API Keys

- **Anthropic Claude**: For main AI functionality
- **OpenAI**: For voice transcription and TTS

### Configuration

API keys are stored in plugin settings and never logged or transmitted except to respective AI providers.

## Internationalization

The plugin supports multiple languages through i18next:

- **Translation Files**: Located in `src/locales/`
- **Usage**: Use `t('key')` function for translatable strings
- **Adding Languages**: Create new locale files and update configuration

## Architecture Decisions

### Why React?

- **Complex UI**: Chat interface requires sophisticated state management
- **Component Reusability**: Modular UI components
- **Developer Experience**: Better debugging and development tools

### Why esbuild?

- **Speed**: Fast compilation for development workflow
- **Simplicity**: Minimal configuration required
- **Modern**: Supports latest JavaScript/TypeScript features

### Why Obsidian?

- **Privacy**: Local data storage and control
- **Extensibility**: Rich plugin ecosystem
- **Markdown**: Universal, future-proof format
- **Community**: Active user base and development community

## Future Development

See [roadmap.md](roadmap.md) for planned features and improvements.

## Getting Help

- **Discord**: Join our [community server](https://discord.gg/VrxZdr3JWH)
- **GitHub Issues**: Report bugs and request features
- **Discussions**: General questions and ideas

## Resources

- **Obsidian API**: https://github.com/obsidianmd/obsidian-api
- **Plugin Development**: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- **TypeScript**: https://www.typescriptlang.org/docs/
- **React**: https://react.dev/learn 