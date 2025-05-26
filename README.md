# Life Navigator Project

<div align="center">
  <img src="https://github.com/user-attachments/assets/430e7b0d-4d7c-4e41-8738-00ff9eb361a2" width="300" alt="Life Navigator Project Logo">
</div>

Life Navigator is an open-source experiment in creating a deeply personal AI companion that lives in your private notes and helps you navigate life with greater awareness and intentionality. Unlike generic AI assistants, it builds deep context about your life through daily voice journaling, then reflects patterns you can't see yourself, holds you accountable to your goals, and provides personalized guidance in multiple "modes" - from empathetic reflection to tough-love motivation. It's not just a tool but a new practice of living: where every day you dialogue with an AI that truly knows you, turning the chaos of daily life into structured growth while keeping all your data completely private on your own devices.

<div align="center">
  <a href="https://discord.gg/VrxZdr3JWH">
    <img src="https://img.shields.io/badge/Discord-Server-5865F2.svg?logo=discord&label=Life%20Navigator%20Community&style=flat" alt="Discord">
  </a>
</div>

## The Obsidian Plugin

This vision is currently materialized as a plugin for [Obsidian](https://obsidian.md), the privacy-first knowledge management app. We chose Obsidian because it aligns perfectly with our core principles: your notes are just markdown files on your computer, you have complete control over your data, and the vibrant plugin ecosystem allows for deep customization. The Life Navigator plugin transforms Obsidian into a powerful AI-augmented journaling and life management system.

**New to Obsidian?** Check out [why we chose Obsidian](docs/why-obsidian.md) as the foundation for Life Navigator.

### 🌟 Key Features

#### 🎙️ **Mobile-First Voice Journaling**
Designed for on-the-go use, Life Navigator lets you capture thoughts, update to-do lists, and manage your daily notes using voice input throughout your day. Whether you're commuting, walking, or just want hands-free interaction, simply speak your thoughts and let the AI organize them into your journal and task management system.

#### 🧠 **Context-Aware AI That Knows You Deeply**
Unlike generic ChatGPT, Life Navigator's AI has access to your personal context, goals, relationships, and history through your linked files. It can provide personalized coaching, insights, and guidance based on your actual life situation, not generic responses.

#### 🔍 **Granular Control Over AI Context**
Through the link expansion system, you have complete control over what information the AI can access. No RAGs, no guessing what AI can see - you explicitly choose what context to share using our special link syntax with the 🔎 emoji.

#### 🔒 **Maximum Data Privacy**
All your personal information is stored locally in your Obsidian vault on your private devices and synced through your own iCloud (or preferred sync service). Unlike other AI tools that store your data in startup databases, Life Navigator keeps everything under your control. The information you choose to share is sent only to trusted API providers (Anthropic and OpenAI) who [don't use API data for training](https://community.openai.com/t/data-privacy-with-openai-api/929399) and have strong data retention policies.

#### 🎭 **Multiple AI Personalities (Modes)**
Switch between different AI personalities based on your needs:
- **🤝 Assistant Mode**: General-purpose helper for tasks, scheduling, and information management
- **🧘 Reflection Mode**: Thoughtful, contemplative personality for deeper thinking and insights
- **📅 Daily Planner Mode**: Intelligent scheduling and task management personality that helps organize your day, set priorities, and maintain focus on what matters most
- **💪 Brawl Assistant (Ziomal)**: Motivational, direct personality for encouragement and accountability
- **🎵 Songwriter Mode**: Creative personality for artistic expression
- **➕ Custom Modes**: Create your own AI personalities with specific traits, voices, and purposes

#### 🔄 **Intelligent Task & Habit Management**
- Automatic daily planning based on your ideal day structure
- Smart task tracking with voice-activated updates
- Habit building with contextual reminders
- Flexible scheduling that adapts to your actual life

#### 🔮 **Pattern Recognition & Insights**
The AI analyzes your journal entries and behaviors to:
- Identify patterns you might miss
- Suggest improvements to your routines
- Alert you to correlations (like mood and sleep)
- Provide periodic reflections on your progress

### 🚀 Getting Started

#### Prerequisites
- Obsidian installed on your device
- API keys for OpenAI and/or Anthropic
- Basic familiarity with markdown (helpful but not required)

#### Installation
For detailed installation instructions, please refer to the [installation guide](docs/installation.md).

#### Quick Start
1. Install the Life Navigator plugin
2. Create your starter kit with pre-configured modes and templates
3. Fill in your personal context files (About Me, Relationships, Goals)
4. Start your first daily note and ask the AI to plan your day
5. Use voice input throughout the day to update progress and capture thoughts

### 📖 Documentation

- **[Installation Guide](docs/installation.md)** - Step-by-step setup instructions
- **[User Guide](docs/user-guide.md)** - Comprehensive guide to using Life Navigator
- **[Why Obsidian?](docs/why-obsidian.md)** - Understanding our choice of platform
- **[Development Guide](docs/DEVELOPMENT.md)** - For contributors and developers
- **[Roadmap](docs/ROADMAP.md)** - Future features and improvements

### 🤝 Community & Support

Join our growing community of Life Navigator users:

- **[Discord Server](https://discord.gg/VrxZdr3JWH)** - Get help, share experiences, and connect with other users
- **[GitHub Discussions](https://github.com/cielecki/life-navigator/discussions)** - Feature requests and general discussions
- **[Issues](https://github.com/cielecki/life-navigator/issues)** - Bug reports and technical issues

### 🛠️ Customization

Life Navigator is designed to be deeply customizable:

- **Create Custom Modes**: Design AI personalities that match your needs
- **Modify Prompts**: Adjust how the AI responds and behaves
- **Build Templates**: Create your own daily note structures and planning algorithms

### 🔐 Privacy & Security

Your privacy is paramount:

- **Local Storage**: All notes stored as plain text files on your devices
- **You Control Sync**: Use iCloud, Dropbox, or any sync service you trust
- **Minimal API Usage**: Only the context you explicitly choose is sent to AI providers
- **No Analytics**: We don't track your usage or collect any data
- **Open Source**: Inspect the code yourself to verify our privacy claims

### 🌱 Philosophy

Life Navigator represents a different relationship with AI:

- **AI as Growth Partner**: Not just a tool, but a companion in personal development
- **Intentional Technology**: Replace mindless scrolling with meaningful AI interactions
- **Augmented Self-Awareness**: Use AI to see patterns and blind spots in your behavior
- **Privacy-First Design**: Your most intimate thoughts deserve the highest security

### 🚧 Current Status

Life Navigator is in active development and currently in beta. While the core features are stable and being used daily by our community, you may encounter bugs or limitations. We welcome feedback and contributions to make this tool better for everyone.

### 📝 License

This project is open source and available under the [AGPL-3.0 license](LICENSE).

### 🙏 Acknowledgments

Special thanks to:
- The Obsidian team for creating an amazing platform
- Our early testers and community members for invaluable feedback
- Contributors who have helped improve the codebase

---

<div align="center">
  <i>Life Navigator - Transform your relationship with AI from exploitation to empowerment</i>
</div>


