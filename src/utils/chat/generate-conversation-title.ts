import { getStore } from "../../store/plugin-store";
import { Message } from 'src/types/chat-types';
import { LNMode } from 'src/types/LNMode';
import { getFirstUserMessage } from "./get-first-user-message";
import { getFirstAssistantMessage } from "./get-first-assistant-message";
import { generateAITitle } from '../../utils/chat/generate-aititle';

function generateFallbackTitle(userMessage: string, mode?: LNMode): string {
    const modePrefix = mode?.ln_name || "Chat";

    // Try to extract key topics from user message
    const words = userMessage.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'can', 'could', 'would', 'should', 'please', 'help', 'me', 'i', 'you', 'my', 'your']);

    const keyWords = words
        .filter(word => word.length > 2 && !stopWords.has(word))
        .slice(0, 3);

    if (keyWords.length > 0) {
        const topic = keyWords
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        return `${modePrefix}: ${topic}`;
    }

    // Ultra fallback
    if (userMessage.length > 30) {
        return `${modePrefix}: Question`;
    } else {
        return `${modePrefix}: Quick Chat`;
    }
}

export async function generateChatTitle(
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
        if (getStore().getSecret('ANTHROPIC_API_KEY') && assistantMessage) {
            const aiTitle = await generateAITitle(userMessage, assistantMessage, mode);
            if (aiTitle) return aiTitle;
        }
    } catch (error) {
        console.log("AI title generation failed, using fallback:", error);
    }

    // Fallback to rule-based naming
    return generateFallbackTitle(userMessage, mode);
}
