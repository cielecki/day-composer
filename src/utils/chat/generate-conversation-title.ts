import { getPluginSettings } from "../../settings/LifeNavigatorSettings";
import { Message } from "./types";
import { LNMode } from '../mode/LNMode';
import { getFirstUserMessage } from "./get-first-user-message";
import { getFirstAssistantMessage } from "./get-first-assistant-message";
import { generateAITitle } from "./generate-aititle";
import { generateFallbackTitle } from "./generate-fallback-title";


export async function generateConversationTitle(
    messages: Message[],
    mode?: LNMode
): Promise<string> {
    const userMessage = getFirstUserMessage(messages);
    const assistantMessage = getFirstAssistantMessage(messages);

    if (!userMessage) {
        return mode?.ln_name ? `${mode.ln_name}: New Chat` : "New Chat";
    }

    // Try AI-generated title first
    try {
        const settings = getPluginSettings();
        if (settings.getSecret('ANTHROPIC_API_KEY') && assistantMessage) {
            const aiTitle = await generateAITitle(userMessage, assistantMessage, mode);
            if (aiTitle) return aiTitle;
        }
    } catch (error) {
        console.log("AI title generation failed, using fallback:", error);
    }

    // Fallback to rule-based naming
    return generateFallbackTitle(userMessage, mode);
}
