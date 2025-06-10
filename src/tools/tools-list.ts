import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { getObsidianTools } from '../obsidian-tools';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { TFile } from 'obsidian';

// Simple pattern matching function (copied from tool-filter.ts to avoid circular imports)
function matchesPattern(text: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }
  
  if (pattern.startsWith("*") && pattern.endsWith("*")) {
    // Contains pattern: *text*
    const searchText = pattern.slice(1, -1);
    return text.includes(searchText);
  }
  
  if (pattern.startsWith("*")) {
    // Ends with pattern: *text
    const suffix = pattern.slice(1);
    return text.endsWith(suffix);
  }
  
  if (pattern.endsWith("*")) {
    // Starts with pattern: text*
    const prefix = pattern.slice(0, -1);
    return text.startsWith(prefix);
  }
  
  // Exact match
  return text === pattern;
}

const schema = {
  name: "tools_list",
  description: "Lists available tools with optional filtering by mode and side effects. Useful for discovering what tools are available for use in tool calls or link expansion.",
  input_schema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        description: "Optional mode name to filter tools available for that specific mode"
      },
      safe_only: {
        type: "boolean",
        description: "If true, only shows tools without side effects that are safe for link expansion",
        default: false
      },
      include_user_tools: {
        type: "boolean", 
        description: "Whether to include user-defined tools in the listing",
        default: true
      }
    },
    required: []
  }
};

type ToolsListInput = {
  mode?: string;
  safe_only?: boolean;
  include_user_tools?: boolean;
}

export const toolsListTool: ObsidianTool<ToolsListInput> = {
  specification: schema,
  icon: "list",
  sideEffects: false, // This tool is read-only and safe for link expansion
  get initialLabel() {
    return t('tools.toolsList.label');
  },
  execute: async (context: ToolExecutionContext<ToolsListInput>): Promise<void> => {
    const { params } = context;
    const { mode, safe_only = false, include_user_tools = true } = params;

    context.setLabel(t('tools.toolsList.inProgress'));

    try {
      const obsidianTools = getObsidianTools();
      let tools = await obsidianTools.getTools();

      // Filter by mode if specified
      if (mode) {
        try {
          // Try to load the mode to get its tool filtering configuration
          const plugin = LifeNavigatorPlugin.getInstance();
          const modeFile = plugin.app.vault.getAbstractFileByPath(`library/Modes/${mode}.md`);
          
          if (modeFile && modeFile instanceof TFile) {
            const metadata = plugin.app.metadataCache.getFileCache(modeFile);
            
            // Create a minimal mode config for tool filtering
            const modeConfig = {
              tools_allowed: metadata?.frontmatter?.tools_allowed || ["*"],
              tools_disallowed: metadata?.frontmatter?.tools_disallowed || []
            };
            
            // Simple filtering based on allowed/disallowed patterns
            tools = tools.filter(tool => {
              const toolName = tool.specification.name;
              
              // Check disallowed patterns first
              for (const pattern of modeConfig.tools_disallowed) {
                if (matchesPattern(toolName, pattern)) {
                  return false;
                }
              }
              
              // Check allowed patterns
              for (const pattern of modeConfig.tools_allowed) {
                if (matchesPattern(toolName, pattern)) {
                  return true;
                }
              }
              
              return false;
            });
            
            context.progress(`Filtered tools for mode: ${mode}`);
          } else {
            context.progress(`Warning: Mode '${mode}' not found, showing all tools`);
          }
        } catch (error) {
          context.progress(`Warning: Could not load mode '${mode}', showing all tools`);
        }
      }

      // Filter by side effects if requested
      if (safe_only) {
        tools = tools.filter(tool => !tool.sideEffects);
        context.progress(`Filtered to show only safe tools (no side effects)`);
      }

      // Filter user tools if requested
      if (!include_user_tools) {
        tools = tools.filter(tool => !tool.specification.name.startsWith('user_'));
        context.progress(`Excluded user-defined tools from listing`);
      }

      // Group tools by category
      const coreTools = tools.filter(tool => !tool.specification.name.startsWith('user_'));
      const userTools = tools.filter(tool => tool.specification.name.startsWith('user_'));

      // Build the output
      let output = `# Available Tools\n\n`;
      
      if (mode) {
        output += `**Mode:** ${mode}\n`;
      }
      if (safe_only) {
        output += `**Filter:** Safe tools only (no side effects)\n`;
      }
      output += `**Total:** ${tools.length} tools\n\n`;

      // Core tools section
      if (coreTools.length > 0) {
        output += `## Core Tools (${coreTools.length})\n\n`;
        
        for (const tool of coreTools) {
          const safetyBadge = tool.sideEffects ? "⚠️" : "✅";
          const sideEffectsText = tool.sideEffects ? "Has side effects" : "Safe for link expansion";
          
          output += `### ${safetyBadge} \`${tool.specification.name}\`\n`;
          output += `**Description:** ${tool.specification.description}\n`;
          output += `**Safety:** ${sideEffectsText}\n`;
          
          // Show parameters if any
          const properties = tool.specification.input_schema.properties;
          if (properties && Object.keys(properties).length > 0) {
            output += `**Parameters:**\n`;
            for (const [paramName, paramSchema] of Object.entries(properties)) {
              const schema = paramSchema as any;
              const required = tool.specification.input_schema.required?.includes(paramName) ? " (required)" : "";
              output += `- \`${paramName}\`: ${schema.description || 'No description'}${required}\n`;
            }
          } else {
            output += `**Parameters:** None\n`;
          }
          
          output += `\n`;
        }
      }

      // User tools section
      if (userTools.length > 0 && include_user_tools) {
        output += `## User-Defined Tools (${userTools.length})\n\n`;
        
        for (const tool of userTools) {
          const safetyBadge = tool.sideEffects ? "⚠️" : "✅";
          const sideEffectsText = tool.sideEffects ? "Has side effects" : "Safe for link expansion";
          
          output += `### ${safetyBadge} \`${tool.specification.name}\`\n`;
          output += `**Description:** ${tool.specification.description}\n`;
          output += `**Safety:** ${sideEffectsText}\n`;
          
          // Show parameters if any
          const properties = tool.specification.input_schema.properties;
          if (properties && Object.keys(properties).length > 0) {
            output += `**Parameters:**\n`;
            for (const [paramName, paramSchema] of Object.entries(properties)) {
              const schema = paramSchema as any;
              const required = tool.specification.input_schema.required?.includes(paramName) ? " (required)" : "";
              output += `- \`${paramName}\`: ${schema.description || 'No description'}${required}\n`;
            }
          } else {
            output += `**Parameters:** None\n`;
          }
          
          output += `\n`;
        }
      }

      // Usage examples
      output += `## Usage Examples\n\n`;
      output += `### In Tool Calls\n`;
      output += `\`tool_name()\` 🧭 - Zero parameters\n`;
      output += `\`tool_name("value")\` 🧭 - Positional parameter\n`;
      output += `\`tool_name(param="value")\` 🧭 - Named parameter\n`;
      output += `\`tool_name({param: "value"})\` 🧭 - JavaScript object\n\n`;
      
      if (safe_only || coreTools.some(tool => !tool.sideEffects)) {
        output += `### In Link Expansion\n`;
        output += `Safe tools (✅) can be used in link expansion:\n`;
        output += `\`safe_tool_name()\` 🧭 - Will be expanded inline\n\n`;
      }

      context.setLabel(t('tools.toolsList.completed'));
      context.progress(output);

    } catch (error) {
      context.setLabel(t('tools.toolsList.failed'));
      throw error;
    }
  }
}; 