import Anthropic from "@anthropic-ai/sdk";
import { getStore } from 'src/store/plugin-store';
import { LNMode } from 'src/types/mode';
import { t } from 'src/i18n';

export async function generateAITitle(
    userMessage: string,
    assistantMessage: string,
    mode?: LNMode
): Promise<string | null> {
    try {
        const store = getStore();
        const anthropicClient = new Anthropic({
            apiKey: store.getSecret('ANTHROPIC_API_KEY'),
            dangerouslyAllowBrowser: true
        });

        const prompt = `${t('chat.titleGeneration.aiPrompt')}

${t('chat.titleGeneration.userLabel')} ${userMessage.substring(0, 200)}
${t('chat.titleGeneration.assistantLabel')} ${assistantMessage.substring(0, 200)}

${t('chat.titleGeneration.instructions')}

${t('chat.titleGeneration.examples')}`;

        const response = await anthropicClient.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 50,
            temperature: 0.3,
            messages: [{
                role: "user",
                content: prompt
            }]
        });

        const title = response.content[0]?.type === "text"
            ? response.content[0].text.trim()
            : null;

        // Validate title length (no longer expecting colon since we removed mode names)
        if (title && title.length <= 50 && title.length > 0) {
            // Clean up any potential quotation marks from the AI response
            return title.replace(/^["']|["']$/g, '');
        }

        return null;
    } catch (error) {
        console.debug("Error generating AI title:", error);
        return null;
    }
}
