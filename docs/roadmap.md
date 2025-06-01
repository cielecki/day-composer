# Life Navigator - Roadmap

This document outlines potential future features and improvements for the Life Navigator plugin, based on user feedback and development ideas.

## Accepted/Implemented Ideas

**User-Defined Tools:** Introduce the ability for the user to add extra tools to the system. Investigate methods for loading extra tools (e.g., eval, JSON, MCP). This could allow accessing calendar for example.

**Introduce support for weekly and monthly summaries:**
via ln-monthly-note and ln-weekly-note.

## Floating Ideas

**Mode Settings Editor:**
Create a comprehensive mode settings editor that allows users to configure all mode parameters through a user-friendly interface.

**Gemini Model Support and Model Selection:**
Add support for Gemini model from Google, and add a model selection option from the mode settings.

**Task List Tool:**
Re-implement a function to display the list of tasks as a tool call, accessible by the user.

**Weather Fetching Tool:**
Implement a tool to fetch and display weather information.

**Fire and forget chat workflow:**
Rethink the concept of creating a new chat for each voice message without automatically switching to it.

**Google Calendar Integration:**
Create a system to extract calendar information about upcoming events (today plus next 7 days) so the system can include this data in daily tasks.

**Endless Chat Interface:**
Implement an endless chat window in Obsidian with a recent messages view that includes truncated context and a "load previous messages" option similar to Cursor's interface. This would provide a more seamless chat experience with better context management.

**Audio Feedback System:**
Add audio signals/sounds to Life Navigator for various actions (task completion, end of speech, start of transcription processing) to provide better user feedback and interaction cues.

**Proactive Agent Notifications:**
Investigate the possibility of an agent that activates based on cron jobs or random events and sends notifications to the user (e.g., mobile notification, SMS). **This is only possible via external app.**

**Passive Listening Agent:**
Explore the ability to enter a voice-activated mode where the system waits for a wake phrase like "Hi Navigator" to start interacting. **This is only possible via external app.**


## General Notes

*   This roadmap is a living document and priorities may shift based on user feedback and development capacity.
*   Suggestions and contributions are welcome via the plugin's GitHub repository. 
