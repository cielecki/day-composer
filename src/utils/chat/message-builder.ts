import { ContentBlock, Message, AttachedImage } from "../../types/chat-types";

/**
 * Creates a user message with text and optional images
 */
export const createUserMessage = (userMessage: string, images?: AttachedImage[]): Message => {
	let contentBlocks: ContentBlock[] = [];
	
	// Add text block if the message isn't empty
	if (userMessage.trim() !== '') {
		contentBlocks.push({ type: "text", text: userMessage });
	}
	
	// Add image blocks if provided
	if (images && images.length > 0) {
		const imageBlocks = images.map(img => {
			// Convert AttachedImage to ImageBlock format
			const extractedMimeType = img.src.split(";")[0].split(":")[1];
			// Validate and normalize media type
			let media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
			switch (extractedMimeType) {
				case "image/jpg":
				case "image/jpeg":
					media_type = "image/jpeg";
					break;
				case "image/png":
					media_type = "image/png";
					break;
				case "image/gif":
					media_type = "image/gif";
					break;
				case "image/webp":
					media_type = "image/webp";
					break;
				default:
					// Default to PNG for unsupported types
					media_type = "image/png";
					break;
			}
			
			return {
				type: "image" as const,
				source: {
					type: "base64" as const,
					media_type,
					data: img.src.split(",")[1], // Extract base64 data without the prefix
				},
			};
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
			const mediaType = imageBlock.source.media_type || 'image/png';
			return {
				id: Math.random().toString(36).substring(2, 11),
				name: `image.${mediaType.split('/')[1] || 'png'}`,
				src: `data:${mediaType};base64,${imageBlock.source.data}`
			};
		}
		return null;
	}).filter(Boolean) as AttachedImage[];

	return { text: textContent, images };
}; 