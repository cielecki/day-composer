#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load environment variables from .env file if it exists
function loadEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            // Only set if not already set in process.env
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      // Silently ignore errors loading .env file
      return false;
    }
  }
  
  return false;
}

// Load .env file at startup
const envLoaded = loadEnvFile();

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

// Default Journal directory path
const DEFAULT_JOURNAL_PATH = '/Users/maciel/Library/Mobile Documents/iCloud~md~obsidian/Documents/Journal';

// Get Journal directory path from command line args, environment variable, or use default
function getJournalPath() {
  const customPath = process.argv[2];
  const envPath = process.env.JOURNAL_PATH;
  return customPath || envPath || DEFAULT_JOURNAL_PATH;
}

// Find all markdown files in the Journal directory
function findMarkdownFiles(journalPath) {
  if (!fs.existsSync(journalPath)) {
    log(colors.red, `❌ Journal directory not found: ${journalPath}`);
    process.exit(1);
  }

  const markdownFiles = [];
  
  try {
    const entries = fs.readdirSync(journalPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        markdownFiles.push(path.join(journalPath, entry.name));
      }
    }
  } catch (error) {
    log(colors.red, `❌ Error reading Journal directory: ${error.message}`);
    process.exit(1);
  }

  return markdownFiles;
}

// Extract task with its indented content
function extractTaskWithContent(lines, taskLineIndex) {
  const taskLines = [lines[taskLineIndex]];
  const taskIndentation = getIndentationLevel(lines[taskLineIndex]);
  
  // Look for indented content following the task
  for (let i = taskLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Empty lines are included if they're followed by more indented content
    if (line.trim() === '') {
      // Check if the next non-empty line is still indented
      let nextNonEmptyIndex = i + 1;
      while (nextNonEmptyIndex < lines.length && lines[nextNonEmptyIndex].trim() === '') {
        nextNonEmptyIndex++;
      }
      
      if (nextNonEmptyIndex < lines.length && 
          getIndentationLevel(lines[nextNonEmptyIndex]) > taskIndentation) {
        taskLines.push(line);
        continue;
      } else {
        break;
      }
    }
    
    const lineIndentation = getIndentationLevel(line);
    
    // If this line is indented more than the task, include it
    if (lineIndentation > taskIndentation) {
      taskLines.push(line);
    } else {
      // We've reached the end of the indented content
      break;
    }
  }
  
  return taskLines;
}

// Get indentation level of a line
function getIndentationLevel(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

// Find and process the first unclaimed task in a file
function processFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    log(colors.red, `❌ Error reading file ${filePath}: ${error.message}`);
    return null;
  }

  const lines = content.split('\n');
  // Only match tasks that start at the beginning of the line (no indentation)
  // and have exactly empty brackets [ ]
  const todoRegex = /^- \[ \] (.+)$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(todoRegex);
    
    if (match) {
      const [fullMatch, taskText] = match;
      
      // Skip tasks that already have identification (contain parentheses with content)
      if (/\([^)]+\)/.test(taskText)) {
        continue; // Skip this task, it already has identification
      }
      
      // Found an unclaimed task without identification
      
      // Extract the task and its indented content
      const taskContent = extractTaskWithContent(lines, i);
      
      // Mark the task as claimed (change [ ] to [?])
      lines[i] = line.replace('- [ ]', '- [?]');
      
      // Write the modified content back to the file
      try {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      } catch (error) {
        log(colors.red, `❌ Error writing file ${filePath}: ${error.message}`);
        return null;
      }
      
      // Return the extracted task information
      return {
        filePath,
        taskContent,
        originalTaskText: taskText
      };
    }
  }
  
  return null; // No unclaimed tasks found
}

// Get directory basename for prefix
function getDirectoryPrefix() {
  const cwd = process.cwd();
  
  // Look for pattern: /Documents/{project-name}/.obsidian/plugins/
  // We want to extract the {project-name} part
  const pathParts = cwd.split(path.sep);
  const documentsIndex = pathParts.findIndex(part => part === 'Documents');
  
  if (documentsIndex !== -1 && documentsIndex + 1 < pathParts.length) {
    // Return the directory name right after Documents
    return `(${pathParts[documentsIndex + 1]})`;
  }
  
  // Fallback to current directory basename if pattern not found
  return `(${path.basename(cwd)})`;
}

// Main function
function main() {
  // Check if task.md already exists - fail immediately if it does
  const taskFilePath = path.join(process.cwd(), 'task.md');
  if (fs.existsSync(taskFilePath)) {
    log(colors.red, colors.bold, '❌ Task file already exists!\n');
    log(colors.yellow, `📄 Existing file: ${taskFilePath}`);
    log(colors.dim, '💡 Complete or remove the existing task before claiming a new one');
    process.exit(1);
  }
  
  const backlogPath = getBacklogPath();
  
  log(colors.blue, colors.bold, '🔍 Task Disposer - Finding next available task...\n');
  log(colors.cyan, `📄 Scanning backlog file: ${backlogPath}`);
  
  // Check if the backlog file exists
  if (!fs.existsSync(backlogPath)) {
    log(colors.red, `❌ Backlog file not found: ${backlogPath}`);
    process.exit(1);
  }
  
  // Process the backlog file to find the first available task
  const result = processFile(backlogPath);
  
  if (result) {
    // Found and claimed a task
    const directoryPrefix = getDirectoryPrefix();
    const fileName = path.basename(result.filePath, '.md');
    
    // Format the task output with directory prefix right after the checkbox
    const formattedTaskContent = result.taskContent.map((line, index) => {
      if (index === 0) {
        // First line: insert directory prefix right after the checkbox
        return line.replace('- [?]', `- [?] ${directoryPrefix}`);
      }
      return line; // Keep other lines unchanged
    });
    
    const taskOutput = formattedTaskContent.join('\n');
    
    log(colors.green, colors.bold, '\n✅ Task claimed successfully!\n');
    log(colors.dim, `📄 File: ${fileName}`);
    log(colors.dim, `🔒 Marked as claimed in: ${result.filePath}`);
    
    // Write task to task.md file
    const taskFilePath = path.join(process.cwd(), 'task.md');
    try {
      fs.writeFileSync(taskFilePath, taskOutput, 'utf8');
      log(colors.dim, `💾 Task saved to: ${taskFilePath}\n`);
    } catch (error) {
      log(colors.yellow, `⚠️  Warning: Could not save task to file: ${error.message}\n`);
    }
    
    // Output the task content with directory prefix
    console.log(taskOutput);
    
    process.exit(0);
  }
  
  // No unclaimed tasks found
  log(colors.yellow, '\n⚠️  No unclaimed tasks found in the backlog file');
  log(colors.dim, 'All tasks are either completed or already claimed (marked with [?])');
  process.exit(0);
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log(colors.red, '❌ Unexpected error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log(colors.red, '❌ Unhandled promise rejection:', error.message);
  process.exit(1);
});

// Run the script
main(); 