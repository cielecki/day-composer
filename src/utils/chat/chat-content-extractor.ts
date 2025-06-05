import { App } from "obsidian";
import { t } from 'src/i18n';
import { formatConversationContent } from './conversation-formatter';

/**
 * Get the current chat content from the active view
 * @param app The Obsidian App instance
 * @returns The formatted chat content or an error message
 */
export function getCurrentChatContent(app: App): string {
	try {
		// Find all LifeNavigatorView leaves in the workspace
		const lifeNavigatorViewLeaves = app.workspace.getLeavesOfType("life-navigator-view");
		
		// If no leaves found, return error message
		if (!lifeNavigatorViewLeaves || lifeNavigatorViewLeaves.length === 0) {
			console.debug("No Life Navigator view leaves found");
			return t('errors.chat.noContent');
		}
		
		// Get the view instance from the first leaf
		const lifeNavigatorViewLeaf = lifeNavigatorViewLeaves[0];
		const view = lifeNavigatorViewLeaf.view;
		
		// The conversation is likely stored in the AIAgentContext
		// Try to access the Life Navigator plugin (this is the proper way to access plugins)
		// @ts-ignore - Accessing plugins this way requires ignoring TypeScript
		const plugin = app.plugins?.plugins?.["life-navigator"];
		if (plugin) {
			console.debug("Found Life Navigator plugin:", plugin);
			
			// Look for conversation in AIAgentProvider's conversationRef
			// @ts-ignore - Using internal plugin structure
			if (plugin.aiAgent && plugin.aiAgent.conversation) {
				console.debug("Found conversation in plugin.aiAgent");
				return formatConversationContent(plugin.aiAgent.conversation);
			}
		}
		
		// Try to find the conversation via DOM inspection
		try {
			// Find the conversation container in the DOM
			const lifeNavigatorView = app.workspace.containerEl.querySelector('.life-navigator-view');
			if (lifeNavigatorView) {
				console.debug("Found Life Navigator view in DOM");
				
				// Debug: Log the HTML structure
				console.debug("Life Navigator view HTML:", lifeNavigatorView.innerHTML);
				
				// Try different selectors for messages
				const selectors = [
					'.message', 
					'.conversation-container > div',
					'.markdown-content',
					'[class*="message"]',
					'[class*="conversation"] > div'
				];
				
				let messageElements: NodeListOf<Element> | null = null;
				let successfulSelector = '';
				
				// Try each selector until we find elements
				for (const selector of selectors) {
					const elements = lifeNavigatorView.querySelectorAll(selector);
					console.debug(`Selector "${selector}" found ${elements.length} elements`);
					
					if (elements && elements.length > 0) {
						messageElements = elements;
						successfulSelector = selector;
						break;
					}
				}
				
				if (messageElements && messageElements.length > 0) {
					console.debug(`Found message elements with selector "${successfulSelector}"`);
					
					// Extract user and assistant messages
					const conversation: any[] = [];
					
					messageElements.forEach((el, index) => {
						console.debug(`Message element ${index} classes:`, el.className);
						console.debug(`Message element ${index} innerHTML:`, el.innerHTML);
						
						// Try to determine if this is a user or assistant message
						const isUser = 
							el.classList.contains('user') || 
							el.innerHTML.includes('User') ||
							el.textContent?.includes('👤');
						
						const isAssistant = 
							el.classList.contains('assistant') || 
							el.innerHTML.includes('Assistant') ||
							el.textContent?.includes('🤖');
						
						// If we can't determine the role, skip this element
						if (!isUser && !isAssistant) return;
						
						// Find the content - try different selectors
						const contentSelectors = ['.message-content', '.markdown-content', 'p', 'div'];
						let contentEl = null;
						
						for (const selector of contentSelectors) {
							const candidate = el.querySelector(selector);
							if (candidate && candidate.textContent) {
								contentEl = candidate;
								break;
							}
						}
						
						// If no specific content element found, use the element itself
						if (!contentEl && el.textContent) {
							contentEl = el;
						}
						
						if (contentEl) {
							const textContent = contentEl.textContent || "";
							const cleanText = textContent
								.replace(/👤\s*User:\s*/g, '')  // Remove "👤 User:" prefix
								.replace(/🤖\s*Assistant:\s*/g, '')  // Remove "🤖 Assistant:" prefix
								.trim();
							
							if (cleanText) {
								conversation.push({
									role: isUser ? "user" : "assistant",
									content: [{ type: "text", text: cleanText }]
								});
							}
						}
					});
					
					if (conversation.length > 0) {
						console.debug("Successfully extracted conversation from DOM:", conversation);
						return formatConversationContent(conversation);
					}
				}
				
				// If we couldn't find messages but the chat is not empty
				// Return a placeholder conversation
				if (lifeNavigatorView.textContent && !lifeNavigatorView.textContent.includes('No chat content')) {
					console.debug("Found chat content but couldn't parse messages, returning empty chat message");
					// Return a clear "chat is empty" message instead of the raw text
					return t('chat.empty');
				}
			}
		} catch (domError) {
			console.error("Error extracting conversation from DOM:", domError);
		}
		
		// Direct global window access
		try {
			// @ts-ignore - Access global objects
			if (window && window.lifeNavigator && window.lifeNavigator.aiAgent) {
				// @ts-ignore
				const conversation = window.lifeNavigator.aiAgent.conversation;
				if (Array.isArray(conversation) && conversation.length > 0) {
					console.debug("Found conversation in global window.lifeNavigator");
					return formatConversationContent(conversation);
				}
			}
		} catch (windowError) {
			console.error("Error accessing global objects:", windowError);
		}
		
		// Cast to any to avoid TypeScript errors
		const lifeNavigatorView = view as any;
		
		// Try direct property access as a fallback
		if (lifeNavigatorView && typeof lifeNavigatorView.conversation !== 'undefined') {
			const conversation = lifeNavigatorView.conversation;
			
			if (Array.isArray(conversation) && conversation.length > 0) {
				console.debug("Successfully retrieved conversation using getter");
				return formatConversationContent(conversation);
			}
		}
		
		// Fallback to accessing the private _conversation property directly
		if (lifeNavigatorView && Array.isArray(lifeNavigatorView._conversation) && lifeNavigatorView._conversation.length > 0) {
			console.debug("Found conversation in _conversation property");
			return formatConversationContent(lifeNavigatorView._conversation);
		}
		
		console.debug("No conversation found in LifeNavigatorView");
		return t('errors.chat.noContent');
	} catch (error) {
		console.error("Error getting chat content:", error);
		return t('errors.chat.noContent');
	}
} 