# Managing Long Text Translations

This directory contains dedicated files for long text content like system prompts, mode descriptions, and other lengthy translations that would make JSON files unreadable.

## Directory Structure

```
src/locales/prompts/
├── README.md                    # This file
├── lifeNavigator.en.ts         # English Life Navigator prompts
├── lifeNavigator.pl.ts         # Polish Life Navigator prompts
└── [futureMode].[lang].ts      # Future mode prompt files
```

## Why This Approach?

**Problems with JSON:**
- Long system prompts make JSON files unreadable for humans and AI assistants
- No native multiline support in JSON
- Difficult to edit and maintain long texts
- Version control diffs become unwieldy

**Benefits of TypeScript Files:**
- ✅ Beautiful multiline template literals with proper formatting
- ✅ Syntax highlighting and editor support
- ✅ Type safety and IntelliSense
- ✅ Easy to read, edit, and maintain
- ✅ Clean version control diffs
- ✅ No escaping needed for quotes or special characters

## File Naming Convention

```
[modeName].[languageCode].ts
```

Examples:
- `lifeNavigator.en.ts` - English Life Navigator prompts
- `lifeNavigator.pl.ts` - Polish Life Navigator prompts
- `assistant.en.ts` - Future Assistant mode prompts
- `planner.fr.ts` - Future French Planner mode prompts

## File Structure

Each file should export constants for different types of content:

```typescript
export const [modeName]SystemPrompt = `
Your multiline system prompt here...

## With proper formatting
- And lists
- That are readable
`;

export const [modeName]MainDescription = `
Short description that appears in the UI.
`;

export const [modeName]VoiceInstructions = `
Instructions for voice interaction.
`;
```

## Adding New Long Texts

### 1. Create the dedicated files

For a new mode called "Assistant":

```bash
# Create English version
touch src/locales/prompts/assistant.en.ts

# Create Polish version  
touch src/locales/prompts/assistant.pl.ts
```

### 2. Add your content

**assistant.en.ts:**
```typescript
export const assistantSystemPrompt = `You are an Assistant AI that helps with...

## Your capabilities include:
- Task management
- Information organization
- Problem solving
`;

export const assistantMainDescription = `I'm your professional assistant, ready to help with tasks and organization.`;
```

### 3. Import in i18n.ts

Add imports:
```typescript
import { 
  assistantSystemPrompt as enAssistantSystemPrompt, 
  assistantMainDescription as enAssistantMainDescription 
} from './locales/prompts/assistant.en';
import { 
  assistantSystemPrompt as plAssistantSystemPrompt, 
  assistantMainDescription as plAssistantMainDescription 
} from './locales/prompts/assistant.pl';
```

### 4. Merge with translations

Add to the merge logic:
```typescript
const enTranslations = {
  ...en,
  prebuiltModes: {
    ...en.prebuiltModes,
    assistant: {
      ...en.prebuiltModes.assistant,
      systemPrompt: enAssistantSystemPrompt,
      mainDescription: enAssistantMainDescription
    }
  }
};
```

## Best Practices

### ✅ DO:
- Use meaningful, descriptive variable names
- Keep consistent naming conventions across files
- Use proper markdown formatting in prompts
- Add translations for all supported languages
- Use template literals (backticks) for multiline content
- Escape backticks inside template literals with `\``

### ❌ DON'T:
- Mix short and long texts in the same file
- Use JSON for content longer than 2-3 lines
- Forget to add corresponding translations for all languages
- Use inconsistent formatting between language versions

## Alternative Approaches Considered

### YAML Files
**Pros:** Native multiline support, clean syntax
**Cons:** Requires additional parsing, build complexity, editor support varies

### Markdown Files
**Pros:** Great for documentation-style content
**Cons:** Requires file reading at runtime, less type safety

### External JSON with References
**Pros:** Keeps JSON structure
**Cons:** Still doesn't solve readability, adds complexity

### Template Literal Files (Chosen)
**Pros:** Type safety, great editor support, no runtime overhead, perfect for multiline text
**Cons:** Slightly more initial setup

## Future Enhancements

- **Script Automation**: Create scripts to automatically generate template files for new modes
- **Validation**: Add TypeScript interfaces to ensure consistent structure
- **Hot Reloading**: Development-time hot reloading for prompt changes
- **Translation Helpers**: Tools to help maintain consistency across language versions 