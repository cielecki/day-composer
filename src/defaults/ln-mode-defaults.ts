import { AICMode } from "../types/types";
import { TTS_VOICES, TTSVoice } from "../settings/PluginSettings";
import { t } from '../i18n';
import { modeToNoteContent } from "src/utils/mode-utils";
import path from "path";

/**
 * Default configuration for AIC modes.
 * These values will be used when a mode doesn't specify certain parameters.
 */
export function getDefaultAICMode(): AICMode {
  return {
    // UI defaults
    ln_name: t('modes.default.name'),
    ln_path: "",
    ln_icon: "brain",
    ln_icon_color: "#888888",
    ln_description: t('modes.default.description'),
    
    // Behavior defaults
    ln_system_prompt: t('modes.default.systemPrompt'),
    ln_example_usages: [],
    
    // API parameters
    ln_thinking_budget_tokens: 2000,
    ln_max_tokens: 4096,
    
    // TTS defaults
    ln_voice_autoplay: true,
    ln_voice: "alloy",
    ln_voice_instructions: t('voice.instructions.default'),
    ln_voice_speed: 1.0,
  }
}

/**
 * Merge user-defined AIC mode with default values
 * @param userMode The user-defined AIC mode
 * @returns Complete AIC mode with all required fields
 */
export function mergeWithDefaultMode(userMode: Partial<AICMode>): AICMode {
  return {
    ...getDefaultAICMode(),
    ...userMode,
  } as AICMode;
}

export function validateModeSettings(mode: AICMode): AICMode {
  const validatedMode = { ...mode };
  const defaultMode = getDefaultAICMode();
  
  // Validate voice if present
  if (mode.ln_voice && !TTS_VOICES.includes(mode.ln_voice as TTSVoice)) {
    console.warn(`Invalid voice selected: ${mode.ln_voice}, falling back to default`);
    validatedMode.ln_voice = defaultMode.ln_voice;
  }
  
  // Validate thinking budget (must be positive number)
  if (mode.ln_thinking_budget_tokens !== undefined && 
      (typeof mode.ln_thinking_budget_tokens !== 'number' || 
       mode.ln_thinking_budget_tokens < 0)) {
    validatedMode.ln_thinking_budget_tokens = defaultMode.ln_thinking_budget_tokens;
  }
  
  // Validate max tokens (must be positive number)
  if (mode.ln_max_tokens !== undefined && 
      (typeof mode.ln_max_tokens !== 'number' || 
       mode.ln_max_tokens <= 0)) {
    validatedMode.ln_max_tokens = defaultMode.ln_max_tokens;
  }
  
  return validatedMode;
}

interface StarterPackFile {
  name: string;
  content: string;
}
export function getStarterPackContents(): StarterPackFile[] {
  const defaultMode = getDefaultAICMode();
  const modes = [
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.createDailyNote.name'),
      ln_example_usages: [
        t('modes.builtIn.createDailyNote.exampleUsage'),
      ],
      ln_voice_autoplay: true,
      ln_voice: "alloy",
      ln_voice_instructions: t('modes.builtIn.createDailyNote.voiceInstructions'),
      ln_voice_speed: 1.1,
      ln_icon: "calendar-with-checkmark",
      ln_icon_color: "#4caf50",
      ln_description: t('modes.builtIn.createDailyNote.description'),
      ln_system_prompt: defaultMode.ln_system_prompt,
    }),
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.searchNotes.name'),
      ln_voice_autoplay: false,
      ln_voice: "echo",
      ln_voice_instructions: t('modes.builtIn.searchNotes.voiceInstructions'),
      ln_voice_speed: 0.9,
      ln_icon: "search",
      ln_icon_color: "#2196f3",
      ln_description: t('modes.builtIn.searchNotes.description'),
      ln_system_prompt: t('modes.builtIn.searchNotes.systemPrompt'),
    }),
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.dailyReflection.name'),
      ln_example_usages: [
        t('modes.builtIn.dailyReflection.exampleUsage'),
      ],
      ln_voice_autoplay: true,
      ln_voice: "nova",
      ln_voice_instructions: t('modes.builtIn.dailyReflection.voiceInstructions'),
      ln_voice_speed: 0.85,
      ln_icon: "lucide-sun-moon",
      ln_icon_color: "#ff9800",
      ln_description: t('modes.builtIn.dailyReflection.description'),
      ln_system_prompt: defaultMode.ln_system_prompt,
    }),
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.testSearch.name'),
      ln_example_usages: [
        t('modes.builtIn.testSearch.exampleUsage'),
      ],
      ln_voice_autoplay: true,
      ln_voice: "shimmer",
      ln_voice_instructions: t('modes.builtIn.testSearch.voiceInstructions'),
      ln_voice_speed: 1.0,
      ln_icon: "magnifying-glass",
      ln_icon_color: "#ff5722",
      ln_description: t('modes.builtIn.testSearch.description'),
      ln_system_prompt: defaultMode.ln_system_prompt,
    }),
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.addGoals.name'),
      ln_example_usages: [
        t('modes.builtIn.addGoals.exampleUsage'),
      ],
      ln_voice_autoplay: true,
      ln_voice: "fable",
      ln_voice_instructions: t('modes.builtIn.addGoals.voiceInstructions'),
      ln_voice_speed: 1.15,
      ln_icon: "target",
      ln_icon_color: "#9c27b0",
      ln_description: t('modes.builtIn.addGoals.description'),
      ln_system_prompt: defaultMode.ln_system_prompt,
    }),
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.addReflection.name'),
      ln_example_usages: [
        t('modes.builtIn.addReflection.exampleUsage'),
      ],
      ln_voice_autoplay: true,
      ln_voice: "onyx",
      ln_voice_instructions: t('modes.builtIn.addReflection.voiceInstructions'),
      ln_voice_speed: 0.95,
      ln_icon: "lucide-history",
      ln_icon_color: "#673ab7",
      ln_description: t('modes.builtIn.addReflection.description'),
      ln_system_prompt: defaultMode.ln_system_prompt,
    }),
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.createTomorrowNote.name'),
      ln_example_usages: [
        t('modes.builtIn.createTomorrowNote.exampleUsage'),
      ],
      ln_voice_autoplay: true,
      ln_voice: "alloy",
      ln_voice_instructions: t('modes.builtIn.createTomorrowNote.voiceInstructions'),
      ln_voice_speed: 1.05,
      ln_icon: "lucide-calendar-plus",
      ln_icon_color: "#3f51b5",
      ln_description: t('modes.builtIn.createTomorrowNote.description'),
      ln_system_prompt: defaultMode.ln_system_prompt,
    }),
    mergeWithDefaultMode({
      ln_name: t('modes.builtIn.searchProjectPlanning.name'),
      ln_example_usages: [
        t('modes.builtIn.searchProjectPlanning.exampleUsage'),
      ],
      ln_voice_autoplay: true,
      ln_voice: "echo",
      ln_voice_instructions: t('modes.builtIn.searchProjectPlanning.voiceInstructions'),
      ln_voice_speed: 1.0,
      ln_icon: "lucide-file-search",
      ln_icon_color: "#00bcd4",
      ln_description: t('modes.builtIn.searchProjectPlanning.description'),
      ln_system_prompt: defaultMode.ln_system_prompt,
    }),
  ];

  const infoFiles = [
    {
      name: 'Info/Me.md',
      content:
`
<!-- 
TODO: Replace this example content with your actual personal information
Format: Use markdown lists with relevant details like name, location, age, etc.
Remove this comment block when adding your real information
-->
* Name: John Doe
* Location: Downtown area between District A and District B near Central Square
* Age: 35 (born in 1989)
* Height: 175 cm
* Relationship status: Single, currently dating
`.trim()
    },
    {
      name: 'Info/Relationships.md',
      content:
`
<!-- 
TODO: Replace this example content with your actual relationships information
Format: Use markdown lists with relevant details like age, location, and relationship context
Remove this comment block when adding your real information
-->
## Family
* Parents: James and Mary Doe (both living in hometown)
* Siblings: Sarah Doe (32, lives in hometown), Michael Doe (29, lives in New York)

## Romantic
* Currently dating Emma Chen (31, met 6 months ago)
* Previous relationship: Lisa Thompson (dated for 2 years, ended amicably)

## Close Friends
* Alex Rodriguez (34, college friend, lives nearby)
* Maria Garcia (33, work colleague, close friend for 5 years)
* David Kim (36, gym buddy, meets weekly for workouts)

## Professional
* Mentor: Dr. Robert Wilson (65, retired professor)
* Work best friend: Sarah Johnson (28, marketing team)
`.trim()
    },
    {
      name: 'Info/_Index_.md',
      content:
`
<!-- 
This is an index file that lists all information files that can be included in modes.
Add new information files here as they are created.
-->
[[Me]] 🔎
[[Relationships]] 🔎
`.trim()
    }
  ];

  return [
    ...modes.map(mode => ({
      name: path.join('Modes', `${mode.ln_name}.md`),
      content: modeToNoteContent(mode)
    })),
    ...infoFiles
  ];
}

