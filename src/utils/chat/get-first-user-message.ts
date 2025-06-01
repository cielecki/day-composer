import { Message, ContentBlock } from "./types";

export function getFirstUserMessage(messages: Message[]): string | null {
    const firstUserMsg = messages.find(msg => msg.role === "user");
    if (!firstUserMsg || !firstUserMsg.content) return null;

    // Ensure content is an array of ContentBlock
    const contentBlocks = Array.isArray(firstUserMsg.content)
        ? firstUserMsg.content
        : [{ type: "text", text: firstUserMsg.content }];

    // Extract text from content blocks
    const textBlocks = contentBlocks
        .filter((block: ContentBlock) => block.type === "text")
        .map((block: any) => block.text)
        .join(" ");

    return textBlocks.trim() || null;
}
