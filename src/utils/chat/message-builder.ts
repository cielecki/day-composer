import { ContentBlock, Message } from "../../types/chat-types";

export interface AttachedImage {
	id: string;
	name: string;
	src: string; // base64 data URL
}

/**
 * Creates a user message with text and optional images
 */
export const createUserMessage = (userMessage: string, images?: any[]): Message => {
	let contentBlocks: ContentBlock[] = [];
	
	// Add text block if the message isn't empty
	if (userMessage.trim() !== '') {
		contentBlocks.push({ type: "text", text: userMessage });
	}
	
	// Add image blocks if provided
	if (images && images.length > 0) {
		const imageBlocks = images.map(img => {
			// Check if this is already in API format (from editing mode)
			if (img.type === "image" && img.source) {
				return img;
			} else {
				// Handle AttachedImage format (with src property)
				return {
					type: "image",
					source: {
						type: "base64",
						media_type: img.src.split(";")[0].split(":")[1], // Extract MIME type
						data: img.src.split(",")[1], // Extract base64 data without the prefix
					},
				};
			}
		});
		
		contentBlocks = [...contentBlocks, ...imageBlocks];
	}
	
	return { role: "user", content: contentBlocks };
};

/**
 * Extracts text and images from a user message for editing
 */
export const extractUserMessageContent = (message: Message): { text: string; images: AttachedImage[] } => {
	const contentBlocks = Array.isArray(message.content) ? message.content : [];
	
	const textContent = contentBlocks
		.filter(block => block.type === 'text')
		.map(block => (block as any).text || '')
		.join('\n');
	
	const imageBlocks = contentBlocks.filter(block => block.type === 'image');
	
	const images = imageBlocks.map(block => {
		const imageBlock = block as any;
		if (imageBlock.source && imageBlock.source.data) {
			return {
				id: Math.random().toString(36).substring(2, 11),
				name: `image.${imageBlock.source.media_type?.split('/')[1] || 'png'}`,
				src: `data:${imageBlock.source.media_type || 'image/png'};base64,${imageBlock.source.data}`
			};
		}
		return null;
	}).filter(Boolean) as AttachedImage[];

	return { text: textContent, images };
}; 