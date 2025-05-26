# Installation

## Desktop Installation

1.  **Install Obsidian for desktop** from [obsidian.md](https://obsidian.md/).

2.  **Set up a vault:** For multi-device access (e.g., Mac and mobile), consider setting it up in a shared drive like iCloud.
    - When creating a new vault, choose "Create new vault"
    - Pick a name for your vault
    - **Important:** Make sure the vault location is set to iCloud Drive (or another sync service) if you plan to use it on mobile

3.  **Enter the vault in Obsidian.**

4.  **Language Setting:** It's recommended to set your Obsidian's interface language (Settings → General → Language) to the language you are going to write your notes in (e.g., English or Polish) before proceeding. The Life Navigator plugin's content, file names, AI interactions, and voice conversations will all be in this language.
    - After changing language, click "Relaunch" to apply the changes

5.  **Enable Community Plugins:**
    - Go to **Settings → Community plugins** 
    - Ensure **"Community plugins"** is enabled (toggled on)
    - You may see a warning about community plugins - click "Turn on community plugins"

6.  **Install Life Navigator:**
    - **Option A (Recommended):** If "Life Navigator" is available in the Community Plugins browser, click "Browse" and search for "Life Navigator", then install it directly. If you use this method, skip to step 12.
    - **Option B (Manual Installation):** If the plugin is not yet available in the community browser, or you need a specific version, continue with the manual installation steps below.

7.  **Download the plugin files (Manual Installation Only):**
    - Open your web browser and go to the latest release: [https://github.com/cielecki/life-navigator/releases](https://github.com/cielecki/life-navigator/releases)
    - Download these three files from the "Assets" section:
      - `main.js`
      - `manifest.json` 
      - `styles.css`
    - **Note:** All three files are required for the plugin to work properly

8.  **Access your vault's folder (Manual Installation Only):**
    - Open your vault's folder in your computer's file explorer (Finder on Mac, File Explorer on Windows)
    - You can usually find this in your iCloud Drive if you set it up there

9.  **Show hidden files to access the .obsidian directory (Manual Installation Only):**
    - **On Mac:** In Finder, press `Cmd+Shift+.` (Command + Shift + Period) to show hidden files
    - **On Windows:** In File Explorer, go to the "View" tab and check the "Hidden items" box
    - You should now see a `.obsidian` folder in your vault directory

10. **Create the plugin directory structure (Manual Installation Only):**
    - Enter the `.obsidian` directory
    - Create a new folder named `plugins` if it doesn't already exist
    - Inside the `plugins` directory, create a new folder named `life-navigator` (with a hyphen, not underscore)

11. **Install the plugin files (Manual Installation Only):**
    - Move the three downloaded files (`main.js`, `manifest.json`, and `styles.css`) into the `life-navigator` directory you just created

12. **Restart Obsidian (Manual Installation Only):**
    - Completely close and restart Obsidian to ensure it recognizes the new plugin
    - This step is crucial for manual installation - the plugin won't appear without a restart

13. **Enable the plugin:**
    - Go back to **Settings → Community plugins**
    - Under "Installed plugins," you should now see "Life Navigator"
    - Enable it using the toggle switch
    - If you don't see it, try the "Check for updates" button or restart Obsidian again

## API Key Configuration

14. **Configure Life Navigator settings:**
    - Click the gear/cog icon next to "Life Navigator" in the Community Plugins list to open plugin settings
    - You'll need to set up two API keys for the AI functionality

15. **Anthropic API Key:**
    - In a web browser, go to [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
    - You might need to create an Anthropic account if you don't have one
    - Create a new API key (API keys are like special passwords that allow the plugin to use Anthropic's AI services)
    - Copy the key and paste it into the "Anthropic API Key" field in the plugin settings

16. **OpenAI API Key:**
    - In a web browser, go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
    - You might need to create an OpenAI account if you don't have one
    - Create a new API key
    - Copy the key and paste it into the "OpenAI API Key" field in the plugin settings

17. **Save settings:**
    - Once both keys are pasted, they are automatically saved
    - No further "activation" step is needed within the plugin
    - **Note:** Usage of these AI services might incur costs depending on the provider's pricing and your usage

## Getting Started

18. **Access Life Navigator:**
    - Close the settings window
    - In the left ribbon of Obsidian, find a new compass icon labeled "Life Navigator"
    - Click it to open the plugin's side panel

19. **Create your starter kit:**
    - Click the "Create Starter Kit" button in the Life Navigator panel
    - This will create a new directory in your vault with example files to get you started
    - The starter kit includes example modes, information templates, and configuration files

## Mobile Setup

20. **Install Obsidian mobile app:**
    - Download the Obsidian app from your device's app store
    - Open the app and select "Open folder as vault"
    - Choose your vault from iCloud Drive (or your chosen sync service)

21. **Enable community plugins on mobile:**
    - Go to **Settings → Community plugins**
    - Turn on "Community plugins" 
    - You may need to toggle "Restricted mode" and confirm to enable community plugins
    - The Life Navigator plugin should automatically sync and be available

22. **Important sync considerations:**
    - Wait for files to sync between devices before editing the same file on multiple devices
    - iCloud and other sync services may have delays
    - If you've been editing on desktop, give it a few minutes to sync before continuing on mobile, and vice versa

## Troubleshooting

**Plugin not appearing after installation:**
- Ensure all three files (main.js, manifest.json, styles.css) are in the correct directory
- Verify the directory name is `life-navigator`
- Restart Obsidian completely
- Check that community plugins are enabled

**Mobile sync issues:**
- Ensure your vault is properly set up in iCloud Drive or your chosen sync service
- Allow time for sync to complete between devices
- Check that community plugins are enabled

**API key issues:**
- Verify both Anthropic and OpenAI API keys are correctly entered
- Check that your API accounts have sufficient credits/usage allowance

## Next Steps

After completing the installation, please refer to the [User Guide](user-guide.md) for detailed instructions on how to use Life Navigator effectively. The guide will walk you through exploring the starter kit, customizing your information, and using the different AI modes.
