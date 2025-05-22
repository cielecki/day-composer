# Usage: Exploring Your Starter Kit

In the starter kit, you have four modes: Songwriter, Reflection, Brawl Assistant, as well as some files in the info directory about me, backlog relationships and index. 

Let's walk through those files.

The info directory contains your master database of things about you. If you go to the about me file, it contains all the information about your context.

Feel free to adjust it in any way. At the beginning, it might be good to just delete all of the things from here and just put some basics in just to get started. 

Then have a look at the relationship file. It's basically something very similar, but it's just additional information about yourself, but in a separate file. 

It's here to show that you can organize it in both one file or multiple files, and what governs this is the index file which specifies the files that get injected into AI. Any new files you add, add them here so they get referred from AI. 

You can also create such links in those separate directories, so it's like all of those will get inlined into an AI context. 

There is also a very useful backlog file for storing your pending to-do lists which are not added to your daily notes. Feel free to edit that file and just add some stuff that is related to yourself. Remove anything from here. 

After you've clicked "Create Starter Kit" (step 20 in the installation), a new folder will appear in your vault, typically named "Starter Kit vX.X" or similar. This kit is your starting point for using the plugin. Here's what to explore:

1.  **Core Information Files (usually in an `Info` sub-directory):**
    *   `About Me.md`: This is where you can describe yourself, your preferences, goals, and any context you want the AI to have about you.
    *   `Relationships.md` (example): Shows how you can keep information about important people or entities in separate files.
    *   `Backlog.md`: A place to keep your to-do lists or pending tasks that aren't tied to a specific day.
    *   **Crucially, `_Index_.md`**: This file is the control center for what information is fed to the AI. It contains links to the other files (like `About Me.md`, `Backlog.md`, etc.). If you create new information files that you want the AI to use, you *must* add a link to them in `_Index_.md`.

2.  **Personalizing Your Information:**
    *   The starter files contain placeholder examples. It's **highly recommended** to personalize these files. You can either:
        *   **Delete** the placeholder examples entirely and write your own information from scratch.
        *   **Adapt** the examples, using them as inspiration but replacing the content with your own details.
    *   The more relevant and personal the information you provide, the more effectively the AI can assist you.
    *   **Note:** If you keep the placeholder text, it will be used in AI and skew it's responses, it's best to delete everything that you don't plan to immediatelly replace. You can always find the [original starter kit files](https://github.com/cielecki/life-navigator/tree/main/src/locales).

3.  **AI Modes (usually in a `Modes` sub-directory):**
    *   You'll find templates for different AI "personalities" or assistants (e.g., `Songwriter.md`, `Reflection.md`, `Brawl Assistant.md`).
    *   Explore these files. Each mode defines how the AI should behave, what icon/color it uses, and critically, which `Index.md` file (and thus which set of your personal data) it should use.
    *   You can customize these modes or create new ones to suit your needs.

This initial setup and personalization are key to getting the most out of Life Navigator.

## Understanding Your Starter Kit in Detail

### The Information Files: Your AI's Knowledge Base

**About Me.md:**
- This is your primary profile containing personal details that help the AI understand your context.
- Include information like your age, occupation, interests, goals, values, personality traits, and daily routines.
- Add health information, preferences, and anything else you'd like the AI to know about you.
- You can be as detailed or minimal as you prefer, but more relevant details lead to more personalized assistance.

**Relationships.md:**
- Use this file to document important people in your life.
- Include names, relationships to you, notable characteristics, and any important details about your interactions.
- This helps the AI understand your social context when you mention people by name.
- Example: "John - my brother, 34, lives in Berlin, has two kids, we talk weekly about our shared interest in hiking."

**Backlog.md:**
- A centralized place for tasks and ideas that aren't tied to a specific day.
- Unlike daily notes which capture day-specific activities, this is for ongoing projects and longer-term goals.
- Format suggestions: Use bullet points, checkboxes (- [ ]), or headers to organize different categories of tasks.
- Example sections might include "Work Projects," "Personal Goals," "Shopping List," or "Ideas to Explore."

**_Index_.md:**
- This is the crucial file that determines what information gets fed to the AI.
- It uses links to other files (like `[[About Me]]`) to include their content in the AI's context.
- **Important:** Any new information file you create must be linked in _Index_.md for the AI to "see" it.
- You can organize these links however you want; the AI will receive all linked content regardless of organization.
- Example of adding a new file: If you create "Health.md" with health information, add `[[Health]]` to _Index_.md.

## Customizing AI Modes

Life Navigator uses "modes" to create different AI personalities for different purposes. Each mode lives in its own markdown file and can be extensively customized.

### Understanding the Mode Structure

Each mode file (e.g., `Assistant.md`, `Reflection.md`, `Brawl Assistant.md`) contains several key elements:

- **System Prompt:** The instructions that shape the AI's personality and behavior.
- **Configuration:** Settings for appearance (icon, color) and functionality (which index file to use, voice settings).
- **Context Handling:** Instructions for how the mode should handle information from your vault.

### Customizing AI Personality

You can modify any mode to better suit your preferences:

1. **Changing Personality Traits:** 
   - Example: The "Brawl Assistant" (Ziomal) mode is designed to be motivational but somewhat aggressive. You can edit its system prompt to be less aggressive or change its gender presentation.
   - Look for language in the system prompt that defines personality and modify it.
   - Example change: "You are Ziomal, a tough, no-nonsense male coach" → "You are Ziomal, a firm but supportive female coach"

2. **Voice Selection:**
   - Each mode can have a specific AI voice for text-to-speech responses.
   - Visit [OpenAI's Voice Demo](https://platform.openai.com/docs/guides/text-to-speech) to listen to different voice options (like Nova, Echo, Shimmer, Alloy, etc.).
   - In the mode file, look for a setting like `voice: "alloy"` and change it to your preferred voice name.
   - Note that voice availability may depend on your OpenAI subscription.

3. **Icon and Color Customization:**
   - Each mode can have a unique icon and color in the interface.
   - Look for settings like `icon: "brain"` and `color: "#ff5500"` in the mode file.
   - Change the icon name to any [Lucide icon name](https://lucide.dev/icons/).
   - Change the color to any valid CSS color (hex code, rgb value, or color name).

### The System Prompt Explained

The system prompt is the most important part of each mode file:

- It's the set of instructions that defines how the AI behaves in that mode.
- It automatically includes:
  - Content from your _Index_.md file (and all linked files)
  - Recent daily notes (if configured)
  - The current time and date
  - Any special instructions for that particular mode

To view the complete system prompt for any mode:
1. Open the Life Navigator panel
2. Select your desired mode
3. Look for the "Show system prompt" option (usually in a menu or info icon)
4. You can view and even copy the full prompt to understand what the AI "sees".
5. You can also use the copied prompt in tools like chatgpt or other ai tools, and use it as a pellet of information about yourself.

## How the AI "Learns" and "Remembers"

It's important to understand how Life Navigator's AI memory works:

- **No Persistent Memory:** The AI does not have a traditional "memory" that evolves over time on its own.
- **Context-Based Knowledge:** The AI only "knows" what's explicitly provided in:
  1. Files linked in your _Index_.md
  2. Content from recent daily notes (if configured in the mode)
  3. The current conversation (limited to the current session)
  
- **Updating the AI's Knowledge:**
  - To "teach" the AI something new, add it to one of your information files (e.g., About Me.md).
  - To help the AI "remember" a conversation, you need to save important points to your daily note or another file linked in _Index_.md.
  - Example workflow: Have a reflection with the AI, then ask it (or another mode) to "save these thoughts to today's note."

## Interacting with the AI

### Voice Commands and Transcription

Life Navigator supports voice interaction:

- Click the microphone icon to start voice recording.
- Speak your question or command clearly.
- Be aware that transcription errors can occur:
  - Example: Words that sound similar might be misinterpreted (e.g., "peace" → "penis").
  - You can always edit the transcribed text before sending it to the AI.
  - The AI may sometimes begin responding during transcription (this is a known issue that may be improved in future versions).

### Workflow Tips for Effective Use

**Saving Insights:**
1. Use the Reflection mode to explore thoughts or ideas.
2. When you reach valuable insights, switch to Assistant mode.
3. Ask: "Please save the key points from our reflection to today's note."
4. The Assistant will create a summary in your daily note for future reference.

**Daily Context with Dynamic Links:**
- Use special link syntax to reference daily notes relative to the current date:
  - `[[ln-day-note-(0)]] 🔎` refers to today's note
  - `[[ln-day-note-(-1)]] 🔎` refers to yesterday's note
  - `[[ln-day-note-(-7)]] 🔎` refers to the note from a week ago
  - `[[ln-day-note-(3)]] 🔎` refers to the note 3 days in the future

- These links, when used with the 🔎 symbol, will include the content of these notes in your AI context.
- This is especially useful for providing recent context or planning future activities.

## Using Different Modes for Different Tasks

Life Navigator comes with several pre-configured modes, each designed for specific purposes:

**Assistant Mode:**
- General-purpose helper for tasks, scheduling, and information management.
- Best for: Daily planning, answering questions, organizing ideas, managing tasks.
- Example prompt: "Help me organize my schedule for tomorrow."

**Reflection Mode:**
- Thoughtful, contemplative personality focused on deeper thinking.
- Best for: Journaling, processing emotions, exploring ideas, philosophical discussions.
- Example prompt: "I'm feeling anxious about my presentation tomorrow. Let's explore why."

**Brawl Assistant (Ziomal) Mode:**
- Motivational, direct personality for encouragement and accountability.
- Best for: Motivation, breaking through procrastination, fitness goals, habit formation.
- Example prompt: "I've been putting off my workout for three days. I need some motivation."

**Songwriter Mode:**
- Creative personality focused on artistic expression.
- Best for: Creative writing, songwriting, poetry, generating ideas.
- Example prompt: "Help me write lyrics about overcoming a challenge."

You can switch between modes at any time based on your current needs. Each mode has access to the same information (via your _Index_.md), but will respond with different tones and approaches.

## Practical Usage Tips

### Working with Example Content

When you first create the starter kit, you might be hesitant to delete the example content right away:

- It's completely fine to keep the examples initially as you learn how the system works.
- You can gradually replace sections with your own information as you become more comfortable.
- Consider creating a backup of the original examples in a separate folder if you want to reference them later.
- Remember that any example content you keep will influence the AI's understanding of your context.
- Approach: Start by adding your own information alongside examples, then gradually remove examples that aren't relevant to you.

### Mobile App Usage

Life Navigator works on both desktop and mobile Obsidian apps, but there are some important considerations for mobile use:

1. **Setting Up Mobile Access:**
   - Ensure your vault is syncing properly to your mobile device (via iCloud, Dropbox, etc.).
   - When first opening the vault on mobile, you'll need to explicitly trust community plugins.
   - Navigate to Settings → Community plugins → Turn on "Restricted mode" toggle → Confirm.

2. **Language Settings:**
   - If you want to change the interface language on mobile, go to Settings → About → Language.
   - Make sure this matches the language setting on your desktop for consistency.

3. **Optimizing Mobile Workflow:**
   - Consider setting your daily note to open automatically on startup for quick access.
   - In Settings → Core plugins → Daily notes → Options → "Open daily note on startup".
   - Use voice input for faster note-taking on mobile.

4. **Avoiding Sync Conflicts:**
   - **Important:** Try not to edit the same file simultaneously on both desktop and mobile.
   - iCloud and other sync services may have delays, which can cause conflicts or lost changes.
   - Wait for sync to complete (check sync status) before editing the same file on a different device.
   - If you've been editing on desktop, give it a few minutes to sync before continuing on mobile, and vice versa.

### Adding New Information Files

As you use Life Navigator, you'll likely want to add new files to organize different aspects of your life:

1. **Creating Topic-Specific Files:**
   - Create a new note in your vault (e.g., "Health.md", "Finances.md", "Hobbies.md").
   - Add relevant information in any format you prefer.
   - Place it in the same directory as your other information files (typically in the Info folder).

2. **The Crucial Step - Adding to _Index_.md:**
   - **Important:** For the AI to "see" your new file, you must add a link to it in _Index_.md.
   - Open your _Index_.md file.
   - Add a new link using the format: `[[Your New File]]` (without the .md extension).
   - Example: If you created "Health.md" with health information, add `[[Health]]` to _Index_.md.
   - Save the _Index_.md file.

3. **Example from a Real User:**
   - During an onboarding session, a user created a file called "Seks.md" (Polish for "Sex") to track thoughts about their relationship.
   - After creating and filling out the file, they added `[[Seks]]` to their _Index_.md file.
   - This made all that context available to the AI when discussing relationship topics.

### Rapid Journaling Techniques

Life Navigator excels at quick capture of thoughts and tasks:

1. **Voice-to-Text Journaling:**
   - Open the Life Navigator panel and select an appropriate mode (often Assistant).
   - Use the microphone button to record your thoughts without typing.
   - Ask the AI to "save this to today's note" to preserve the conversation.

2. **Quick Task Logging:**
   - Use Assistant mode to say or type something like: "I just finished my workout" or "I completed the project report."
   - The AI can acknowledge this and offer to log it to your daily note.
   - This creates a record of completed tasks that can be referenced later.

3. **End-of-Day Reflection:**
   - Use Reflection mode to ask: "Help me reflect on what I accomplished today."
   - The AI will use context from your daily note (if available) to help summarize your day.
   - Ask it to save insights to prepare for tomorrow.

### Bullet journal rapid formatting

### Link Expansion

Life Navigator supports special link formats that enhance your note-taking experience. For more details, see [Link Expansion](link-expansion.md).
