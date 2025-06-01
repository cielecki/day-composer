import { getPluginSettings } from "src/settings/PluginSettings";
import { Message, LNMode } from "src/types/types";


export async function generateConversationTitle(
    messages: Message[],
    mode?: LNMode
): Promise<string> {
    const userMessage = this.getFirstUserMessage(messages);
    const assistantMessage = this.getFirstAssistantMessage(messages);

    if (!userMessage) {
        return mode?.ln_name ? `${mode.ln_name}: New Chat` : "New Chat";
    }

    // Try AI-generated title first
    try {
        const settings = getPluginSettings();
        if (settings.anthropicApiKey && assistantMessage) {
            const aiTitle = await this.generateAITitle(userMessage, assistantMessage, mode);
            if (aiTitle) return aiTitle;
        }
    } catch (error) {
        console.log("AI title generation failed, using fallback:", error);
    }

    // Fallback to rule-based naming
    return this.generateFallbackTitle(userMessage, mode);
}
