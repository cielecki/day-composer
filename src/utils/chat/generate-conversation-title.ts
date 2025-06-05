import { getStore } from "../../store/plugin-store";
import { Message } from 'src/types/chat-types';
import { LNMode } from 'src/types/LNMode';
import { getFirstUserMessage } from "./get-first-user-message";
import { getFirstAssistantMessage } from "./get-first-assistant-message";
import { generateAITitle } from '../../utils/chat/generate-aititle';
import { t } from 'src/i18n';

export async function generateChatTitle(
    messages: Message[],
    mode?: LNMode
): Promise<string> {
    const userMessage = getFirstUserMessage(messages);
    const assistantMessage = getFirstAssistantMessage(messages);

    if (!userMessage) {
        return t('chat.titles.newChat');
    }

    // Try AI-generated title first
    try {
        if (getStore().getSecret('ANTHROPIC_API_KEY') && assistantMessage) {
            const aiTitle = await generateAITitle(userMessage, assistantMessage, mode);
            if (aiTitle) return aiTitle;
        }
    } catch (error) {
        console.debug("AI title generation failed, using fallback:", error);
    }

    // Fallback to rule-based naming
    return t('chat.titles.newChat');
}
