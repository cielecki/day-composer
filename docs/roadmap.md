# Life Navigator - Roadmap

This document outlines potential future features and improvements for the Life Navigator plugin, based on user feedback and development ideas.

## In Development

**Link Expansion to Tool Call Migration:**
Consider migrating certain link expansion functionality to tool calls for better consistency and flexibility:
- Convert `ln-day-note` from link expansion to tool calls
- Convert `ln-currently-open-file` and `ln-currently-selected-text` from link expansion to tool calls
- Potentially add support for calling any tool calls through link format (e.g., `[[tool-name]] 🧭`)
This would provide more structured access to dynamic content, better error handling, and align with the existing tool architecture while potentially maintaining backward compatibility and expanding link format capabilities to all tools.

**Parallel Conversations:**
Implement support for multiple concurrent conversation windows, allowing users to maintain separate contexts and modes simultaneously. Each window would maintain its own state , enabling more efficient multitasking and context switching.

## Floating Ideas

**Tool Architecture Review:**
Investigate whether any other tools should be migrated to user tools to improve plugin architecture and user customization capabilities. This would involve reviewing the current tool system to identify tools that could benefit from being user-configurable rather than built-in, potentially improving flexibility and allowing users to better customize their Life Navigator experience.

**Thinking Blocks Control:**
Research and implement enabling/disabling thinking blocks in Life Navigator - check if Anthropic will accept removal of thinking blocks.

**Weekly and Monthly Note Support:**
Introduce support for weekly and monthly summaries via `ln-monthly-note` and `ln-weekly-note` link expansions, following the standards from the periodic notes plugin. This would extend the existing daily note functionality to support broader time periods, allowing users to access and reference their weekly and monthly notes directly within Life Navigator conversations for better long-term planning and reflection.

**Enhanced Model Support:**
Add support for multiple AI models including Google's Gemini and local models through LMStudio/Ollama integration. This would provide users with more flexibility in choosing their preferred AI provider while maintaining the core Life Navigator functionality. Local model support would be desktop-only, enabling offline functionality and enhanced privacy by processing sensitive data locally. The plugin will automatically detect if running on mobile and disable local model features. A new model selection option in mode settings would allow users to easily switch between different AI providers.

**Todo Tools Support for Better Rich Text Format of Daily Notes:**
Maybe todo tools should support better a rich text format of the entire daily note? maybe they should be less rigid?

**Tool Management for Modes:**
Implement a tool management system for modes based on tags with a dedicated UI interface for editing modes. Prebuilt modes would have read-only interfaces, while custom modes could be fully editable. This interface should allow users to edit all mode settings including tool configurations, permissions, and parameters through an intuitive visual editor.

**Prompt Caching for Anthropic:**
Implement prompt caching to make conversations faster and more cost-effective by storing frequently used context and reducing repetitive processing. This would improve response times and create a smoother conversational experience for users.

**Eleven Labs Audio Generation:**
Develop a prototype for generating audio content using Eleven Labs' text-to-speech capabilities within Life Navigator. This would explore advanced voice synthesis options, potentially offering more natural-sounding speech, voice customization, and enhanced audio quality compared to current TTS solutions. The prototype would evaluate integration feasibility, cost-effectiveness, and user experience improvements for audio-based interactions.

**Streaming Audio Playback:**
Rework the audio system to enable streaming speech playback that starts before message generation is complete. This would provide a more responsive and natural conversation experience by allowing users to hear the AI's response as it's being generated, rather than waiting for the entire message to be completed before audio playback begins.

**File Attachment Support:**
Add support for file attachments (not just images) in Life Navigator chat with automatic PDF to text conversion and drag & drop functionality from both file system and internally from Obsidian. This would allow users to seamlessly work with various document types and reference materials directly within their conversations.

**Google Calendar Integration and Management:**
Implement a comprehensive calendar system that combines external calendar integration with internal event management. The system will:
- Extract upcoming events from Google Calendar (today + next 7 days) to inform daily task planning
- Provide full calendar functionality for creating and managing events directly within Life Navigator
- Enable seamless integration between calendar events and daily task workflows
- Support event creation, editing, scheduling, and recurring event management
- Allow users to maintain their own calendar events while leveraging external calendar data

**Automatic Update Notifications:**
Implement periodic scanning for plugin updates with a hovering dialog that displays "update available" notifications. This would improve user experience by keeping users informed about new versions. Investigation needed to determine if this is feasible within Obsidian's plugin architecture and API limitations.

**Update Check Tool:**
Implement a tool that allows users to check for plugin updates directly through the Life Navigator chat interface, providing an alternative to navigating through Obsidian's settings. This would offer users a convenient way to check for updates on-demand during their workflow without leaving the conversation context.

**Enhanced Web Content Tools:**
Improve the url-downloader tool to convert results to markdown format and make it highly resilient to various schemes of providing content from URLs. Additionally, implement a basic Google search tool to allow users to search the web directly from Life Navigator. Both features could leverage services like Firecrawl to handle complex web content extraction, JavaScript-rendered pages, and provide reliable search results (https://docs.firecrawl.dev/features/search) that can be processed and integrated into conversations.

**YouTube Content Enhancement:**
Expand YouTube downloader capabilities in Life Navigator to support entire channels, automatic downloading of new videos, and subscription monitoring functionality. This would allow users to efficiently manage and access YouTube content within their knowledge workflow.

**Enhanced Guide Mode with General Obsidian Support:**
Expand the Guide mode capabilities to help users resolve general Obsidian issues by scanning and incorporating knowledge from the broader Obsidian knowledge base. This would enable the Guide mode to assist with common Obsidian problems, plugin conflicts, workflow optimization, and general troubleshooting beyond just Life Navigator-specific guidance. Includes investigating useful resources like Notion import processes (https://www.notion.com/help/export-your-content) and other common Obsidian workflows that users frequently need help with.

**Obsidian Link Support in AI-Generated Text:**
Add support for Obsidian's `[[]]` link syntax in AI-generated text and update analyst prompts to use this syntax. This would enable the AI to create proper internal links when generating content, making the output more integrated with Obsidian's linking system and allowing users to navigate seamlessly between AI-generated content and their existing notes.

**Endless Chat Interface:**
Implement an endless chat window in Obsidian with a recent messages view that includes truncated context and a "load previous messages" option similar to Cursor's interface. This would provide a more seamless chat experience with better context management. Furthermore we could have cursor like context summarisation.

**Mode Switch Button Relocation:**
Move the mode switching button closer to the text input area for improved accessibility and faster mode changes during conversations. This will enhance the user experience by reducing the distance users need to move their cursor to switch modes.

**AI Model Aliases:**
Implement aliases for AI models to allow users to use custom or simplified model names in the mode settings. This would provide more flexibility in model naming and configuration. Requires verification that lower-tier models perform well enough to warrant this feature.

**Fire and forget chat workflow:**
Rethink the concept of creating a new chat for each voice message without automatically switching to it.

**Boomerang Tasks:**
Implement a framework for handling tasks that "boomerang" back to the user on a framework like agents 2.0.

**Audio Feedback System:**
Add audio signals/sounds to Life Navigator for various actions (task completion, end of speech, start of transcription processing) to provide better user feedback and interaction cues.

**Flat Design Input Buttons:**
Evaluate transitioning to a flat design approach for input buttons and interface elements to create a more modern, streamlined visual experience. This would involve reviewing the current button styling and potentially adopting a minimalist design approach that reduces visual clutter while maintaining functionality.

**Mode Settings Editor:**
Create a comprehensive mode settings editor that allows users to configure all mode parameters through a user-friendly interface.

**Task List Tool:**
Re-implement a function to display the list of tasks as a tool call, accessible by the user.

## Science Fiction Ideas (Not doable within Obsidian)

**Document Collaboration:**
Enable document sharing with collaborative editing capabilities, allowing multiple users to check off todos, add notes, and see updates in real-time. This would enhance team productivity and coordination, though technical feasibility within Obsidian's architecture needs to be evaluated.

**Proactive Agent Notifications:**
Investigate the possibility of an agent that activates based on cron jobs or random events and sends notifications to the user (e.g., mobile notification, SMS). **This is only possible via external app.**

**Passive Listening Agent:**
Explore the ability to enter a voice-activated mode where the system waits for a wake phrase like "Hi Navigator" to start interacting. **This is only possible via external app.**

**Computer Activity Monitoring and Plan Adherence:**
Explore intelligent computer activity monitoring that tracks task adherence and discovers new tasks based on actual usage patterns. The system would analyze applications, websites, files, and time allocation to verify plan adherence, redirect users when they deviate, suggest tasks from recurring patterns, and provide productivity insights. This creates seamless integration between digital behavior tracking and personal productivity management. **Privacy and user consent would be paramount, with full control over monitored data.**

## General Notes

*   This roadmap is a living document and priorities may shift based on user feedback and development capacity.
*   Suggestions and contributions are welcome via the plugin's GitHub repository. 
