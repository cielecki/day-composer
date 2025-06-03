/**
 * Generate a unique conversation ID
 */

export function generateChatId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 15);
	return `conv_${timestamp}_${random}`;
}
