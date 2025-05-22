# Usage: Exploring Your Starter Pack

In the starter package, you have four modes: Songwriter, Reflection, Brawl Assistant, as well as some files in the info directory about me, backlog relationships and index. 

Let's walk through those files.

The info directory contains your master database of things about you. If you go to the about me file, it contains all the information about your context.

Feel free to adjust it in any way. At the beginning, it might be good to just delete all of the things from here and just put some basics in just to get started. 

Then have a look at the relationship file. It's basically something very similar, but it's just additional information about yourself, but in a separate file. 

It's here to show that you can organize it in both one file or multiple files, and what governs this is the index file which specifies the files that get injected into AI. Any new files you add, add them here so they get referred from AI. 

You can also create such links in those separate directories, so it's like all of those will get inlined into an AI context. 

There is also a very useful backlog file for storing your pending to-do lists which are not added to your daily notes. Feel free to edit that file and just add some stuff that is related to yourself. Remove anything from here. 

After you've clicked "Create Starter Pack" (step 20 in the installation), a new folder will appear in your vault, typically named "Starter Pack vX.X" or similar. This pack is your starting point for using the plugin. Here's what to explore:

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
    *   **Note:** If you keep the placeholder text, it will be used in AI and skew it's responses, it's best to delete everything that you don't plan to immediatelly replace. You can always find the [original starter pack files](https://github.com/cielecki/life-navigator/tree/main/src/locales).

3.  **AI Modes (usually in a `Modes` sub-directory):**
    *   You'll find templates for different AI "personalities" or assistants (e.g., `Songwriter.md`, `Reflection.md`, `Brawl Assistant.md`).
    *   Explore these files. Each mode defines how the AI should behave, what icon/color it uses, and critically, which `Index.md` file (and thus which set of your personal data) it should use.
    *   You can customize these modes or create new ones to suit your needs.

This initial setup and personalization are key to getting the most out of Life Navigator.


### Bullet journal rapid formatting

### Link Expansion

Life Navigator supports special link formats that enhance your note-taking experience. For more details, see [Link Expansion](link-expansion.md).
