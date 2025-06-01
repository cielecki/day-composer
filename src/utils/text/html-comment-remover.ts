/**
 * Remove top-level HTML comments while preserving them in code blocks
 * @param content The content to remove top-level HTML comments from
 * @returns The content with top-level HTML comments removed
 */
export function removeTopLevelHtmlComments(content: string): string {
	// Split content into lines for processing
	const lines = content.split('\n');
	const result: string[] = [];
	let inCodeBlock = false;
	let codeBlockFence = '';
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		// Check for fenced code blocks (``` or ~~~)
		const fenceMatch = line.match(/^(\s*)(```|~~~)(.*)$/);
		if (fenceMatch) {
			const [, indent, fence, rest] = fenceMatch;
			if (!inCodeBlock) {
				// Starting a code block
				inCodeBlock = true;
				codeBlockFence = fence;
				result.push(line);
				continue;
			} else if (fence === codeBlockFence && indent.length === 0) {
				// Ending the code block (must be at same indentation level)
				inCodeBlock = false;
				codeBlockFence = '';
				result.push(line);
				continue;
			}
		}
		
		// Check for indented code blocks (4+ spaces or 1+ tabs at start of line)
		const isIndentedCode = /^(\s{4,}|\t+)/.test(line) && line.trim() !== '';
		
		// If we're in a code block or this is an indented code line, preserve everything
		if (inCodeBlock || isIndentedCode) {
			result.push(line);
			continue;
		}
		
		// For non-code lines, remove HTML comments
		// Handle multi-line comments that might span across lines
		let processedLine = line;
		
		// Remove complete HTML comments on this line
		processedLine = processedLine.replace(/<!--[\s\S]*?-->/g, '');
		
		// Handle comments that start on this line but might continue
		if (processedLine.includes('<!--') && !processedLine.includes('-->')) {
			// Comment starts here, find where it ends
			const commentStart = processedLine.indexOf('<!--');
			let commentEnd = -1;
			let j = i + 1;
			
			// Look for the end of the comment in subsequent lines
			while (j < lines.length && commentEnd === -1) {
				const nextLine = lines[j];
				const endIndex = nextLine.indexOf('-->');
				if (endIndex !== -1) {
					commentEnd = j;
					// Remove the comment content from current line
					processedLine = processedLine.substring(0, commentStart);
					// Skip lines that are part of the comment
					i = j;
					// Add the remainder of the line after the comment end
					const remainder = lines[j].substring(endIndex + 3);
					if (remainder.trim()) {
						processedLine += remainder;
					}
					break;
				}
				j++;
			}
			
			// If we never found the end, remove everything from the comment start
			if (commentEnd === -1) {
				processedLine = processedLine.substring(0, commentStart);
			}
		}
		
		result.push(processedLine);
	}
	
	return result.join('\n');
} 