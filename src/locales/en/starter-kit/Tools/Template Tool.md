---
tags: ["ln-tool"]
ln-tool-description: "A basic template for creating your own custom tools"
ln-tool-version: "1.0.0"
ln-tool-icon: "wrench"
ln-tool-enabled: true
---

# Template Tool

This is a basic template for creating user-defined tools. Copy this file and modify it to create your own custom tools for Life Navigator.

## How to Use This Template

### 1. Copy and Rename
- Copy this file to create a new tool
- Give it a descriptive name that reflects its purpose
- Place it anywhere in your vault (it will be automatically discovered)

### 2. Update the Frontmatter
Required fields in the YAML frontmatter:
- **`tags`**: Must include `["ln-tool"]` for the tool to be discovered
- **`ln-tool-name`**: The display name for your tool
- **`ln-tool-description`**: Brief description of what the tool does  
- **`ln-tool-version`**: Version number (increment when making changes)
- **`ln-tool-enabled`**: Set to `true` to enable the tool

Optional customization:
- **`ln-tool-icon`**: Choose from [Lucide icons](https://lucide.dev/)

### 2. Modify the Schema
- **Add parameters**: Define what inputs your tool needs
- **Set types**: `string`, `number`, `boolean`, `array`, `object`
- **Add descriptions**: Help the AI understand when and how to use each parameter
- **Set required fields**: Mark which parameters are mandatory

### 3. Write the JavaScript Code  
- **Use the `execute` function**: This is called when the tool runs
- **Access inputs via `input`**: Get the parameters passed by the AI
- **Use `progress()` for updates**: Show progress messages in the chat
- **Use `setLabel()` for status**: Update the tool's display text
- **Use `addNavigationTarget()` for links**: Create clickable links in the chat
- **Access Obsidian APIs via `plugin.app`**: Full access to vault, files, etc.

### 4. Test Your Tool
1. Save the file
2. Go to Life Navigator settings
3. Find your tool in the User-Defined Tools section  
4. Click "Approve" to enable it
5. Test it in conversation with your AI assistant

## Tool Template Schema

```json
{
  "name": "template_tool",
  "description": "A template tool that demonstrates basic functionality",
  "input_schema": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string", 
        "description": "A message to display"
      },
      "count": {
        "type": "number",
        "description": "Number of times to repeat the message"
      }
    },
    "required": ["message"]
  }
}
```

## Tool Implementation

```javascript
async function execute(input, { progress, setLabel, addNavigationTarget, plugin }) {
  try {
    // Update the tool label to show it's running
    setLabel("Running template tool...");
    
    // Show initial progress
    progress("Starting template tool execution");
    
    // Get input parameters with defaults
    const message = input.message || "Hello from template tool!";
    const count = input.count || 1;
    
    // Simulate some work with progress updates
    for (let i = 1; i <= count; i++) {
      progress(`Processing iteration ${i} of ${count}`);
      
      // Create a simple note with the message
      const fileName = `Template Output ${i} - ${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
      const content = `# Template Tool Output\n\nMessage: ${message}\nIteration: ${i}\nGenerated: ${new Date().toLocaleString()}`;
      
      // Create the file
      await plugin.app.vault.create(fileName, content);
      
      // Add navigation target so user can click to open the file
      addNavigationTarget({
        type: 'file',
        path: fileName,
        label: `Open ${fileName}`
      });
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Update final status
    setLabel(`Template tool completed (${count} files created)`);
    progress(`✅ Template tool finished successfully! Created ${count} file(s).`);
    
  } catch (error) {
    progress(`❌ Error: ${error.message}`);
    setLabel("Template tool failed");
    throw error;
  }
}
```

## Key Concepts

### Tool Discovery
Tools are automatically discovered by scanning for files with the `ln-tool` tag in their frontmatter. No manual registration required.

### Security Model
All tools must be explicitly approved before they can execute. This prevents malicious code from running automatically.

### Parameter Validation
The JSON schema automatically validates inputs from the AI, ensuring your tool receives the expected data types.

### Progress Reporting
Use `progress()` to provide real-time updates that appear in the chat, helping users understand what the tool is doing.

### Navigation Integration
Use `addNavigationTarget()` to create clickable links that can open files, navigate to specific locations, or trigger other actions.

### Error Handling
Always wrap your code in try-catch blocks and provide meaningful error messages to help with debugging.

## Best Practices

1. **Start Simple**: Begin with basic functionality and add complexity gradually
2. **Validate Inputs**: Check that required parameters are present and valid
3. **Provide Feedback**: Use progress updates to keep users informed
4. **Handle Errors**: Always include error handling and recovery
5. **Test Thoroughly**: Test with various inputs and edge cases
6. **Document Well**: Include clear descriptions in your schema and comments in your code
7. **Version Control**: Increment the version number when making changes

## Examples

For more examples and inspiration, check out the other tools included in the starter kit:
- Weather Tool: API integration example
- Image Generation Tool: File creation and external API usage  
- YouTube Transcript Tool: Data processing and file manipulation

## Getting Help

If you need help creating tools:
1. Check the other tool examples in the starter kit
2. Use the Tool Creator mode for assistance
3. Visit the [project documentation](https://github.com/cielecki/life-navigator) for more resources 