export interface UserDefinedTool {
  // Tool identification
  filePath: string;
  name: string;
  description: string;
  
  // UI customization  
  icon: string;
  iconColor?: string;
  
  // Execution
  executeCode: string;
  schema: any; // Parsed JSON schema
  enabled: boolean;
  
  // Security
  approved: boolean;
  codeHash: string;
  schemaHash: string; // Separate hash for schema
  lastModified: number;
}

export interface ToolApproval {
  toolPath: string;
  codeHash: string;
  schemaHash: string;
  approvedAt: number;
  approvedByUser: boolean;
}

export interface UserToolExecutionContext {
  // Input parameters from the AI model
  params: any;
  
  // Plugin instance for accessing Obsidian APIs
  plugin: any; // MyPlugin type
  
  // Progress reporting (appears in chat as status updates)
  progress: (message: string) => void;
  
  // Navigation targets (clickable links in chat)
  addNavigationTarget: (target: any) => void; // NavigationTarget type
  
  // Action text/label management (updates the tool's display text in chat)
  setLabel: (text: string) => void;
} 