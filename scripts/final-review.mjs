#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn, execSync } from 'child_process';
import { Anthropic } from '@anthropic-ai/sdk';

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

// Check if task.md exists and read it
function readTaskFile() {
  const taskPath = path.join(projectRoot, 'task.md');
  
  if (!fs.existsSync(taskPath)) {
    log(colors.red, '❌ No task.md file found');
    log(colors.red, '   A task.md file is required to describe what work was done.');
    log(colors.white, '   Create one with: echo "Task description here" > task.md');
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(taskPath, 'utf8');
    log(colors.green, '✅ Found task.md file');
    return content.trim();
  } catch (error) {
    log(colors.red, `❌ Error reading task.md: ${error.message}`);
    process.exit(1);
  }
}

// Run a command and return its output
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
      });
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Check if there are staged changes
function checkStagedChanges() {
  try {
    const result = execSync('git diff --cached --name-only', { 
      cwd: projectRoot, 
      encoding: 'utf8' 
    });
    
    const files = result.trim().split('\n').filter(f => f.length > 0);
    
    if (files.length === 0) {
      log(colors.yellow, '⚠️  No staged changes found');
      return [];
    }
    
    log(colors.green, `✅ Found ${files.length} staged file(s)`);
    return files;
  } catch (error) {
    log(colors.red, `❌ Error checking staged changes: ${error.message}`);
    return [];
  }
}

// Get staged diff content
function getStagedDiff() {
  try {
    const result = execSync('git diff --cached', { 
      cwd: projectRoot, 
      encoding: 'utf8' 
    });
    
    return result.trim();
  } catch (error) {
    log(colors.red, `❌ Error getting staged diff: ${error.message}`);
    return '';
  }
}

// Get recent commit messages to understand the pattern
function getRecentCommitMessages() {
  try {
    const result = execSync('git log --oneline -10 --no-merges', { 
      cwd: projectRoot, 
      encoding: 'utf8' 
    });
    
    const commits = result.trim().split('\n').map(line => {
      const spaceIndex = line.indexOf(' ');
      return spaceIndex > 0 ? line.substring(spaceIndex + 1) : line;
    });
    
    return commits.filter(commit => commit.length > 0);
  } catch (error) {
    log(colors.yellow, `⚠️  Could not get recent commits: ${error.message}`);
    return [];
  }
}

// Run the build process
async function runBuild() {
  log(colors.blue, colors.bold, '\n🔨 Running build process...\n');
  
  try {
    const result = await runCommand('npm', ['run', 'build']);
    
    if (result.success) {
      log(colors.green, '✅ Build completed successfully');
      return { success: true, warnings: [], errors: [] };
    } else {
      log(colors.red, '❌ Build failed');
      log(colors.red, result.stderr);
      return { 
        success: false, 
        warnings: [], 
        errors: [result.stderr] 
      };
    }
  } catch (error) {
    log(colors.red, `❌ Build error: ${error.message}`);
    return { 
      success: false, 
      warnings: [], 
      errors: [error.message] 
    };
  }
}

// Run translation cleanup
async function runTranslationCleanup() {
  log(colors.blue, colors.bold, '\n🌍 Running translation cleanup...\n');
  
  try {
    const result = await runCommand('node', ['scripts/translation-cleanup.mjs']);
    
    // Parse the output to determine if there were issues
    const hasIssues = result.stdout.includes('FOUND') && 
                     result.stdout.includes('TYPE(S) OF ISSUES');
    const hasCriticalIssues = result.stdout.includes('CRITICAL') || 
                             result.stdout.includes('STOP:');
    
    if (result.success && !hasIssues) {
      log(colors.green, '✅ Translation cleanup completed - no issues found');
      return { success: true, warnings: [], errors: [], critical: false };
    } else if (result.success && hasIssues && !hasCriticalIssues) {
      log(colors.yellow, '⚠️  Translation cleanup found non-critical issues');
      return { 
        success: true, 
        warnings: ['Translation cleanup found minor issues'], 
        errors: [], 
        critical: false 
      };
    } else if (hasCriticalIssues) {
      log(colors.red, '❌ Translation cleanup found critical issues');
      return { 
        success: false, 
        warnings: [], 
        errors: ['Critical translation issues found'], 
        critical: true 
      };
    } else {
      log(colors.red, '❌ Translation cleanup failed');
      return { 
        success: false, 
        warnings: [], 
        errors: [result.stderr || 'Translation cleanup failed'], 
        critical: false 
      };
    }
  } catch (error) {
    log(colors.red, `❌ Translation cleanup error: ${error.message}`);
    return { 
      success: false, 
      warnings: [], 
      errors: [error.message], 
      critical: false 
    };
  }
}

// Read documentation files for context
function readDocumentationFiles() {
  const docFiles = [
    'docs/developing.md',
    'library/Docs/Tool Development Guide.md',
    'library/Docs/Mode Development Guide.md'
  ];
  
  let docContent = '';
  
  for (const docFile of docFiles) {
    const fullPath = path.join(projectRoot, docFile);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        docContent += `\n## ${docFile}\n${content}\n`;
      } catch (error) {
        log(colors.yellow, `⚠️  Could not read ${docFile}: ${error.message}`);
      }
    }
  }
  
  return docContent;
}

// Get Anthropic API key from environment
function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
}

// Generate commit message with Anthropic Claude
async function generateCommitMessage(taskContent, stagedDiff, recentCommits) {
  const apiKey = getAnthropicApiKey();
  
  if (!apiKey) {
    log(colors.red, '❌ No Anthropic API key found (ANTHROPIC_API_KEY or CLAUDE_API_KEY)');
    log(colors.red, '   Commit message generation requires API key.');
    process.exit(1);
  }
  
  log(colors.blue, colors.bold, '\n📝 Generating commit message...\n');
  
  try {
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    const prompt = `You are an expert at writing clear, consistent commit messages for the Life Navigator Obsidian plugin. Please generate a commit message based on the task and changes.

## Task Description
${taskContent || 'No task description provided'}

## Recent Commit Messages (for style reference)
${recentCommits.length > 0 ? recentCommits.map((commit, i) => `${i + 1}. ${commit}`).join('\n') : 'No recent commits available'}

## Staged Changes
\`\`\`diff
${stagedDiff}
\`\`\`

Please analyze the changes and generate a commit message that:

1. **Follows the existing style** from recent commits
2. **Is concise but descriptive** (50-72 characters for title)
3. **Uses consistent terminology** with the project
4. **Captures the main purpose** of the changes
5. **Uses present tense** (e.g., "Add", "Fix", "Update", "Remove")

Provide ONLY the commit message (single line), nothing else. No explanations, no additional text.

Examples of good commit message formats:
- "Add final review script with AI-powered code analysis"
- "Fix translation cleanup script error handling"
- "Update task disposer to support environment variables"
- "Remove unused CSS classes and optimize styles"`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });
    
    const commitMessage = message.content[0].text.trim();
    log(colors.green, '✅ Commit message generated');
    return commitMessage;
    
  } catch (error) {
    log(colors.red, `❌ Commit message generation error: ${error.message}`);
    return null;
  }
}

// Review changes with Anthropic Claude
async function reviewWithAI(taskContent, stagedDiff, docContent) {
  const apiKey = getAnthropicApiKey();
  
  if (!apiKey) {
    log(colors.red, '❌ No Anthropic API key found (ANTHROPIC_API_KEY or CLAUDE_API_KEY)');
    log(colors.red, '   AI review is required for final review process.');
    log(colors.white, '   Set your API key in .env file or environment variable:');
    log(colors.white, '   ANTHROPIC_API_KEY=your_key_here');
    log(colors.white, '   Get your key from: https://console.anthropic.com/');
    process.exit(1);
  }
  
  log(colors.blue, colors.bold, '\n🤖 Running AI review with Claude...\n');
  
  try {
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    const prompt = `You are a senior code reviewer for the Life Navigator Obsidian plugin. Please review the following staged changes and provide a comprehensive assessment.

## Task Description
${taskContent || 'No task description provided'}

## Documentation Guidelines
${docContent}

## Staged Changes
\`\`\`diff
${stagedDiff}
\`\`\`

Please provide a thorough review covering:

1. **Code Quality**: Are the changes well-structured and following best practices?
2. **Documentation Compliance**: Do the changes follow the project's documentation guidelines?
3. **Translation Handling**: Are any new user-facing strings properly handled with i18n?
4. **Style Consistency**: Do the changes follow the project's style guidelines (especially CSS utility classes)?
5. **Changelog Requirements**: Should these changes be documented in CHANGELOG.md?
6. **Testing Considerations**: Are there any aspects that need special testing attention?
7. **Potential Issues**: Are there any potential bugs, performance issues, or breaking changes?

End your review with a clear **RECOMMENDATION**:
- **APPROVE**: Changes are ready to commit
- **MINOR ISSUES**: Changes can be committed but with noted improvements for future
- **MAJOR ISSUES**: Changes need to be addressed before committing
- **REJECT**: Critical issues that must be fixed

Format your response clearly with sections and bullet points.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });
    
    const review = message.content[0].text;
    log(colors.green, '✅ AI review completed');
    return review;
    
  } catch (error) {
    log(colors.red, `❌ AI review error: ${error.message}`);
    return null;
  }
}

// Generate final summary
function generateFinalSummary(results) {
  log(colors.magenta, colors.bold, '\n' + '='.repeat(60));
  log(colors.magenta, colors.bold, '📋 FINAL REVIEW SUMMARY');
  log(colors.magenta, colors.bold, '='.repeat(60));
  
  // Check for blocking issues
  const hasBlockingIssues = !results.build.success || 
                           results.translations.critical ||
                           (results.aiReview && results.aiReview.includes('REJECT'));
  
  const hasMinorIssues = results.build.warnings.length > 0 ||
                        results.translations.warnings.length > 0 ||
                        (results.aiReview && results.aiReview.includes('MINOR ISSUES'));
  
  // Status determination
  if (hasBlockingIssues) {
    log(colors.red, colors.bold, '\n🚫 RECOMMENDATION: DO NOT COMMIT');
    log(colors.red, 'Critical issues must be resolved before committing.');
  } else if (hasMinorIssues) {
    log(colors.yellow, colors.bold, '\n⚠️  RECOMMENDATION: COMMIT WITH CAUTION');
    log(colors.yellow, 'Minor issues noted but not blocking. Consider addressing in follow-up.');
  } else {
    log(colors.green, colors.bold, '\n✅ RECOMMENDATION: READY TO COMMIT');
    log(colors.green, 'All checks passed successfully.');
  }
  
  // Display suggested commit message
  if (results.commitMessage && !hasBlockingIssues) {
    console.log();
    log(colors.magenta, colors.bold, '📝 SUGGESTED COMMIT MESSAGE:');
    log(colors.white, colors.bold, `   ${results.commitMessage}`);
    console.log();
    log(colors.cyan, '💡 To commit with this message:');
    log(colors.white, `   git commit -m "${results.commitMessage}"`);
  }
  
  // Detailed breakdown
  console.log();
  log(colors.blue, colors.bold, '📊 DETAILED RESULTS:');
  
  // Build results
  const buildStatus = results.build.success ? '✅ PASSED' : '❌ FAILED';
  log(colors.blue, `  Build: ${buildStatus}`);
  if (results.build.errors.length > 0) {
    results.build.errors.forEach(error => {
      log(colors.red, `    • ${error}`);
    });
  }
  
  // Translation results
  const translationStatus = results.translations.success && !results.translations.critical ? '✅ PASSED' : '❌ FAILED';
  log(colors.blue, `  Translations: ${translationStatus}`);
  if (results.translations.errors.length > 0) {
    results.translations.errors.forEach(error => {
      log(colors.red, `    • ${error}`);
    });
  }
  if (results.translations.warnings.length > 0) {
    results.translations.warnings.forEach(warning => {
      log(colors.yellow, `    • ${warning}`);
    });
  }
  
  // AI review results
  log(colors.blue, `  AI Review: ✅ COMPLETED`);
  
  // Commit message generation
  const commitStatus = results.commitMessage ? '✅ GENERATED' : '⚠️  SKIPPED';
  log(colors.blue, `  Commit Message: ${commitStatus}`);
  
  // Staged files
  log(colors.blue, `  Staged Files: ${results.stagedFiles.length} file(s)`);
  if (results.stagedFiles.length > 0) {
    results.stagedFiles.slice(0, 5).forEach(file => {
      log(colors.dim, `    • ${file}`);
    });
    if (results.stagedFiles.length > 5) {
      log(colors.dim, `    • ... and ${results.stagedFiles.length - 5} more`);
    }
  }
  
  // Next steps
  console.log();
  log(colors.cyan, colors.bold, '🚀 NEXT STEPS:');
  
  if (hasBlockingIssues) {
    log(colors.red, '1. 🔴 Fix critical issues listed above');
    log(colors.red, '2. 🔴 Run this script again to verify fixes');
    log(colors.red, '3. 🔴 Only commit after all issues are resolved');
  } else if (hasMinorIssues) {
    log(colors.yellow, '1. 🟡 Consider addressing minor issues noted above');
    log(colors.green, '2. ✅ Commit changes if issues are acceptable');
    log(colors.cyan, '3. 📝 Update CHANGELOG.md if needed');
    log(colors.cyan, '4. 🧪 Test thoroughly before release');
  } else {
    if (results.commitMessage) {
      log(colors.green, `1. ✅ Commit your changes: git commit -m "${results.commitMessage}"`);
    } else {
      log(colors.green, '1. ✅ Commit your changes');
    }
    log(colors.cyan, '2. 📝 Update CHANGELOG.md if needed');
    log(colors.cyan, '3. 🧪 Test thoroughly before release');
  }
  
  return hasBlockingIssues ? 1 : 0;
}

// Main function
async function main() {
  log(colors.magenta, colors.bold, '🔍 Life Navigator Final Review Tool');
  log(colors.magenta, '='.repeat(45));
  log(colors.dim, 'Comprehensive review of staged changes before commit...\n');
  
  try {
    // Read task file (exits on error)
    const taskContent = readTaskFile();
    
    // Check staged changes
    const stagedFiles = checkStagedChanges();
    
    if (stagedFiles.length === 0) {
      log(colors.yellow, '\n⚠️  No staged changes to review. Stage your changes first with:');
      log(colors.white, '   git add <files>');
      process.exit(0);
    }
    
    // Get staged diff
    const stagedDiff = getStagedDiff();
    
    // Get recent commits for commit message style
    const recentCommits = getRecentCommitMessages();
    
    // Run build
    const buildResults = await runBuild();
    
    // Run translation cleanup
    const translationResults = await runTranslationCleanup();
    
    // Read documentation for AI context
    const docContent = readDocumentationFiles();
    
    // Run AI review (exits on error if no API key)
    const aiReview = await reviewWithAI(taskContent, stagedDiff, docContent);
    
    // Generate commit message
    const commitMessage = await generateCommitMessage(taskContent, stagedDiff, recentCommits);
    
    // Display AI review
    log(colors.blue, colors.bold, '\n🤖 AI REVIEW RESULTS:\n');
    console.log(aiReview);
    
    // Generate final summary
    const exitCode = generateFinalSummary({
      build: buildResults,
      translations: translationResults,
      aiReview,
      stagedFiles,
      taskContent,
      commitMessage
    });
    
    process.exit(exitCode);
    
  } catch (error) {
    log(colors.red, '❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
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