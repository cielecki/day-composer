import { Message, ContentBlock } from "../../types/chat-types";

export function getFirstAssistantMessage(messages: Message[]): string | null {
    const firstAssistantMsg = messages.find(msg => msg.role === "assistant");
    if (!firstAssistantMsg || !firstAssistantMsg.content) return null;

    // Ensure content is an array of ContentBlock
    const contentBlocks = Array.isArray(firstAssistantMsg.content)
        ? firstAssistantMsg.content
        : [{ type: "text", text: firstAssistantMsg.content }];

    // Extract text from content blocks (exclude thinking blocks)
    const textBlocks = contentBlocks
        .filter((block: ContentBlock) => block.type === "text")
        .map((block: any) => block.text)
        .join(" ");

    return textBlocks.trim() || null;
}
