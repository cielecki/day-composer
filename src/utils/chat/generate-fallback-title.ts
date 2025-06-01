import { LNMode } from "src/types/types";

export function generateFallbackTitle(userMessage: string, mode?: LNMode): string {
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
