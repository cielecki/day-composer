# Installation

**Note:** If the "Life Navigator" plugin is available in Obsidian's Community Plugins browser, that is the recommended method of installation. These manual steps are primarily for installing specific versions directly from GitHub releases or if the plugin is not yet listed in the community browser.

1.  Install Obsidian for desktop from [obsidian.md](https://obsidian.md/).
2.  Set up a vault. For multi-device access (e.g., Mac and mobile), consider setting it up in a shared drive like iCloud.
3.  Enter the vault in Obsidian.
4.  **Language Setting:** It's recommended to set your Obsidian's interface language (Settings -> About -> Language) to the langue you are going to write your notes in (e.g., English or Polish) before proceeding. The Life Navigator plugin's content, file names and ai interactions depend on this setting.
5.  Go to **Settings -> Community plugins** and ensure **"Community plugins"** is enabled (toggled on).
6.  Open your web browser and go to the latest release of the plugin here: [https://github.com/cielecki/life-navigator/releases](https://github.com/cielecki/life-navigator/releases). Download the `main.js`, `manifest.json`, and `styles.css` files from the "Assets" section of that release.
7.  Open your vault's folder in your computer's file explorer (e.g., Finder on Mac, File Explorer on Windows).
8.  You now need to access the hidden `.obsidian` configuration directory within your vault's main folder.
    *   **On Mac:** In Finder, press `Cmd+Shift+.` (Command + Shift + Period) to show hidden files.
    *   **On Windows:** In File Explorer, go to the "View" tab and check the "Hidden items" box.
9.  Enter the now visible `.obsidian` directory.
10. Inside the `.obsidian` directory, create a new folder named `plugins` if it doesn't already exist.
11. Inside the `plugins` directory, create a new folder named `life-navigator`.
12. Move the `main.js`, `manifest.json`, and `styles.css` files you downloaded in step 6 into this `life-navigator` directory.
13. Completely close and restart Obsidian to ensure it recognizes the new plugin.
14. Within Obsidian, go back to **Settings -> Community plugins**. Under "Installed plugins," you should now see "Life Navigator." Enable it using the toggle switch.
15. Open the plugin settings for Life Navigator (usually a cog icon next to the plugin name in the Community Plugins list).
16. **Anthropic API Key:**
    *   In a web browser, go to [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
    *   You might need to create an Anthropic account if you don't have one.
    *   Create a new API key. API keys are like special passwords that allow the plugin to use Anthropic's AI services.
    *   Copy the key and paste it into the "Anthropic API Key" field in the plugin settings.
17. **OpenAI API Key:**
    *   In a web browser, go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys).
    *   You might need to create an OpenAI account if you don't have one.
    *   Create a new API key.
    *   Copy the key and paste it into the "OpenAI API Key" field in the plugin settings.
18. **Note on API Keys:** Once pasted, the keys are saved. No further "activation" step is usually needed within the plugin. Be aware that usage of these AI services might incur costs depending on the provider's pricing and your usage.
19. Close the settings. In the left ribbon of Obsidian, find a new button labeled "Life Navigator." Click it to open the plugin's side panel.
20. Click the "Create Starter Kit" button. This will create a new directory in your vault with example files to get you started with Life Navigator.
21. **Mobile App:** If you plan to use Life Navigator on mobile, install the Obsidian mobile app. Ensure your vault (e.g., via iCloud) synchronizes to your mobile phone. On the mobile app, you will also need to enable the plugin.
22. **Next Steps:** After completing the installation, please refer to the [USAGE.md](user-guide.md) guide for detailed instructions on how to use Life Navigator effectively. The guide will walk you through exploring the starter kit, customizing your information, and using the different AI modes.
