import { App, TFile } from 'obsidian';
import { UserDefinedTool } from './types';
import { createHash } from 'crypto';

export class UserDefinedToolScanner {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async scanForTools(): Promise<UserDefinedTool[]> {
    const tools: UserDefinedTool[] = [];
    
    // Find all files with ln-tool tag
    const files = this.app.vault.getMarkdownFiles();
    
    for (const file of files) {
      const metadata = this.app.metadataCache.getFileCache(file);
      
      // Check if file has ln-tool tag
      const tags = metadata?.frontmatter?.tags || metadata?.tags || [];
      const hasLnToolTag = Array.isArray(tags) 
        ? tags.includes('ln-tool')
        : tags === 'ln-tool';
      
      if (hasLnToolTag) {
        try {
          const tool = await this.parseToolFromFile(file);
          tools.push(tool);
        } catch (error) {
          console.warn(`Failed to parse tool from ${file.path}:`, error);
        }
      }
    }
    
    return tools;
  }
  
  private async parseToolFromFile(file: TFile): Promise<UserDefinedTool> {
    const content = await this.app.vault.read(file);
    const metadata = this.app.metadataCache.getFileCache(file);
    
    // Extract JSON schema blocks
    const jsonCodeBlocks = this.extractJSONBlocks(content);
    let schema = {};
    if (jsonCodeBlocks.length > 0) {
      try {
        schema = JSON.parse(jsonCodeBlocks[0]);
      } catch (error) {
        console.warn(`Failed to parse JSON schema in ${file.path}:`, error);
        throw new Error(`Invalid JSON schema: ${error.message}`);
      }
    }
    
    // Extract JavaScript code blocks
    const jsCodeBlocks = this.extractJavaScriptBlocks(content);
    if (jsCodeBlocks.length === 0) {
      throw new Error('No JavaScript code blocks found');
    }
    
    const executeCode = jsCodeBlocks[0]; // Use first JS block
    
    return {
      filePath: file.path,
      name: metadata?.frontmatter?.['ln-tool-name'] || file.basename,
      description: metadata?.frontmatter?.['ln-tool-description'] || '',
      icon: metadata?.frontmatter?.['ln-tool-icon'] || 'gear',
      iconColor: metadata?.frontmatter?.['ln-tool-icon-color'],
      executeCode,
      schema,
      enabled: metadata?.frontmatter?.['ln-tool-enabled'] !== false,
      approved: false,
      codeHash: this.calculateHash(executeCode),
      schemaHash: this.calculateHash(JSON.stringify(schema)),
      lastModified: file.stat.mtime
    };
  }
  
  private extractJSONBlocks(content: string): string[] {
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    const blocks: string[] = [];
    let match;
    
    while ((match = jsonBlockRegex.exec(content)) !== null) {
      blocks.push(match[1].trim());
    }
    
    return blocks;
  }
  
  private extractJavaScriptBlocks(content: string): string[] {
    const jsBlockRegex = /```(?:javascript|js)\s*\n([\s\S]*?)\n```/g;
    const blocks: string[] = [];
    let match;
    
    while ((match = jsBlockRegex.exec(content)) !== null) {
      blocks.push(match[1].trim());
    }
    
    return blocks;
  }

  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
} 