import Anthropic from "@anthropic-ai/sdk";
import { getPluginSettings } from "../../settings/PluginSettings";
import { LNMode } from '../mode/LNMode';


export async function generateAITitle(
    userMessage: string,
    assistantMessage: string,
    mode?: LNMode
): Promise<string | null> {
    try {
        const settings = getPluginSettings();
        const anthropicClient = new Anthropic({
            apiKey: settings.anthropicApiKey,
            dangerouslyAllowBrowser: true
        });

        const modeContext = mode ? `The conversation is in "${mode.ln_name}" mode. ` : "";

        const prompt = `${modeContext}Based on this conversation exchange, generate a concise, descriptive title (maximum 4-5 words):

User: ${userMessage.substring(0, 200)}
Assistant: ${assistantMessage.substring(0, 200)}

Generate a title that captures the main topic or intent. Use format "${mode?.ln_name || 'Chat'}: [Topic]".
Examples:
- "Bro: Weekend Plans"
- "Assistant: React Help" 
- "Coach: Workout Tips"

Only respond with the title, nothing else.`;

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

        // Validate title format and length
        if (title && title.length <= 50 && title.includes(":")) {
            return title;
        }

        return null;
    } catch (error) {
        console.log("Error generating AI title:", error);
        return null;
    }
}
