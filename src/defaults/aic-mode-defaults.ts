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
    aic_name: t('modes.default.name'),
    aic_path: "",
    aic_icon: "brain",
    aic_icon_color: "#888888",
    aic_description: t('modes.default.description'),
    
    // Behavior defaults
    aic_system_prompt: t('modes.default.systemPrompt'),
    aic_example_usages: [],
    
    // API parameters
    aic_thinking_budget_tokens: 2000,
    aic_max_tokens: 4096,
    
    // TTS defaults
    aic_voice_autoplay: true,
    aic_voice: "alloy",
    aic_voice_instructions: t('voice.instructions.default'),
    aic_voice_speed: 1.0,
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
  if (mode.aic_voice && !TTS_VOICES.includes(mode.aic_voice as TTSVoice)) {
    console.warn(`Invalid voice selected: ${mode.aic_voice}, falling back to default`);
    validatedMode.aic_voice = defaultMode.aic_voice;
  }
  
  // Validate thinking budget (must be positive number)
  if (mode.aic_thinking_budget_tokens !== undefined && 
      (typeof mode.aic_thinking_budget_tokens !== 'number' || 
       mode.aic_thinking_budget_tokens < 0)) {
    validatedMode.aic_thinking_budget_tokens = defaultMode.aic_thinking_budget_tokens;
  }
  
  // Validate max tokens (must be positive number)
  if (mode.aic_max_tokens !== undefined && 
      (typeof mode.aic_max_tokens !== 'number' || 
       mode.aic_max_tokens <= 0)) {
    validatedMode.aic_max_tokens = defaultMode.aic_max_tokens;
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
      aic_name: t('modes.builtIn.createDailyNote.name'),
      aic_example_usages: [
        t('modes.builtIn.createDailyNote.exampleUsage'),
      ],
      aic_voice_autoplay: true,
      aic_voice: "alloy",
      aic_voice_instructions: t('modes.builtIn.createDailyNote.voiceInstructions'),
      aic_voice_speed: 1.1,
      aic_icon: "calendar-with-checkmark",
      aic_icon_color: "#4caf50",
      aic_description: t('modes.builtIn.createDailyNote.description'),
      aic_system_prompt: defaultMode.aic_system_prompt,
    }),
    mergeWithDefaultMode({
      aic_name: t('modes.builtIn.searchNotes.name'),
      aic_voice_autoplay: false,
      aic_voice: "echo",
      aic_voice_instructions: t('modes.builtIn.searchNotes.voiceInstructions'),
      aic_voice_speed: 0.9,
      aic_icon: "search",
      aic_icon_color: "#2196f3",
      aic_description: t('modes.builtIn.searchNotes.description'),
      aic_system_prompt: t('modes.builtIn.searchNotes.systemPrompt'),
    }),
    mergeWithDefaultMode({
      aic_name: t('modes.builtIn.dailyReflection.name'),
      aic_example_usages: [
        t('modes.builtIn.dailyReflection.exampleUsage'),
      ],
      aic_voice_autoplay: true,
      aic_voice: "nova",
      aic_voice_instructions: t('modes.builtIn.dailyReflection.voiceInstructions'),
      aic_voice_speed: 0.85,
      aic_icon: "lucide-sun-moon",
      aic_icon_color: "#ff9800",
      aic_description: t('modes.builtIn.dailyReflection.description'),
      aic_system_prompt: defaultMode.aic_system_prompt,
    }),
    mergeWithDefaultMode({
      aic_name: t('modes.builtIn.testSearch.name'),
      aic_example_usages: [
        t('modes.builtIn.testSearch.exampleUsage'),
      ],
      aic_voice_autoplay: true,
      aic_voice: "shimmer",
      aic_voice_instructions: t('modes.builtIn.testSearch.voiceInstructions'),
      aic_voice_speed: 1.0,
      aic_icon: "magnifying-glass",
      aic_icon_color: "#ff5722",
      aic_description: t('modes.builtIn.testSearch.description'),
      aic_system_prompt: defaultMode.aic_system_prompt,
    }),
    mergeWithDefaultMode({
      aic_name: t('modes.builtIn.addGoals.name'),
      aic_example_usages: [
        t('modes.builtIn.addGoals.exampleUsage'),
      ],
      aic_voice_autoplay: true,
      aic_voice: "fable",
      aic_voice_instructions: t('modes.builtIn.addGoals.voiceInstructions'),
      aic_voice_speed: 1.15,
      aic_icon: "target",
      aic_icon_color: "#9c27b0",
      aic_description: t('modes.builtIn.addGoals.description'),
      aic_system_prompt: defaultMode.aic_system_prompt,
    }),
    mergeWithDefaultMode({
      aic_name: t('modes.builtIn.addReflection.name'),
      aic_example_usages: [
        t('modes.builtIn.addReflection.exampleUsage'),
      ],
      aic_voice_autoplay: true,
      aic_voice: "onyx",
      aic_voice_instructions: t('modes.builtIn.addReflection.voiceInstructions'),
      aic_voice_speed: 0.95,
      aic_icon: "lucide-history",
      aic_icon_color: "#673ab7",
      aic_description: t('modes.builtIn.addReflection.description'),
      aic_system_prompt: defaultMode.aic_system_prompt,
    }),
    mergeWithDefaultMode({
      aic_name: t('modes.builtIn.createTomorrowNote.name'),
      aic_example_usages: [
        t('modes.builtIn.createTomorrowNote.exampleUsage'),
      ],
      aic_voice_autoplay: true,
      aic_voice: "alloy",
      aic_voice_instructions: t('modes.builtIn.createTomorrowNote.voiceInstructions'),
      aic_voice_speed: 1.05,
      aic_icon: "lucide-calendar-plus",
      aic_icon_color: "#3f51b5",
      aic_description: t('modes.builtIn.createTomorrowNote.description'),
      aic_system_prompt: defaultMode.aic_system_prompt,
    }),
    mergeWithDefaultMode({
      aic_name: t('modes.builtIn.searchProjectPlanning.name'),
      aic_example_usages: [
        t('modes.builtIn.searchProjectPlanning.exampleUsage'),
      ],
      aic_voice_autoplay: true,
      aic_voice: "echo",
      aic_voice_instructions: t('modes.builtIn.searchProjectPlanning.voiceInstructions'),
      aic_voice_speed: 1.0,
      aic_icon: "lucide-file-search",
      aic_icon_color: "#00bcd4",
      aic_description: t('modes.builtIn.searchProjectPlanning.description'),
      aic_system_prompt: defaultMode.aic_system_prompt,
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
      name: path.join('Modes', `${mode.aic_name}.md`),
      content: modeToNoteContent(mode)
    })),
    ...infoFiles
  ];
}

