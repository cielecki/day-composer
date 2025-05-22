## Development

### First time developing plugins?

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Clone this repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/life-navigator` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to source files. Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.

## Releasing new releases

### Automated Releases (Recommended)

This plugin uses GitHub Actions to automate the release process. To release a new version:

1. Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
2. Commit and push your changes to the main branch.
3. Create and push a new tag that matches your manifest version exactly:
   ```bash
   git tag 1.0.1
   git push origin 1.0.1
   ```
4. The GitHub Action will automatically:
   - Verify that the tag matches the version in manifest.json
   - Build the plugin
   - Create a GitHub release
   - Attach main.js, manifest.json, and styles.css to the release
   - Update versions.json with the new version and minimum app version

### Manual Releases (Alternative)

If you prefer to release manually:

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`.
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments.
- Publish the release.

## API Documentation

See https://github.com/obsidianmd/obsidian-api
