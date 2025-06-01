import { ObsidianTool } from "../obsidian-tools";
import { LNMode } from './mode/LNMode';

/**
 * Simple wildcard pattern matching
 * Supports:
 * - "*" matches any sequence of characters
 * - Exact string matching
 * - Prefix patterns (e.g., "todo*")
 * - Suffix patterns (e.g., "*document")
 * - Contains patterns (e.g., "*todo*")
 */
function matchesPattern(text: string, pattern: string): boolean {
  // Handle exact match
  if (pattern === text) {
    return true;
  }

  // Handle wildcard "*" - matches everything
  if (pattern === "*") {
    return true;
  }

  // Handle patterns with wildcards
  if (pattern.includes("*")) {
    // Escape special regex characters except *
    const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    // Replace * with regex equivalent
    const regexPattern = "^" + escapedPattern.replace(/\*/g, ".*") + "$";
    const regex = new RegExp(regexPattern);
    return regex.test(text);
  }

  // Exact match for patterns without wildcards
  return pattern === text;
}

/**
 * Check if a tool is allowed based on allowed and disallowed patterns
 * Disallowed patterns take precedence over allowed patterns
 */
function isToolAllowed(
  toolName: string,
  allowedPatterns: string[],
  disallowedPatterns: string[]
): boolean {
  // Check if tool is explicitly disallowed
  for (const disallowedPattern of disallowedPatterns) {
    if (matchesPattern(toolName, disallowedPattern)) {
      return false;
    }
  }

  // Check if tool is allowed
  for (const allowedPattern of allowedPatterns) {
    if (matchesPattern(toolName, allowedPattern)) {
      return true;
    }
  }

  // If no allowed patterns match, tool is not allowed
  return false;
}

/**
 * Filter tools based on mode configuration
 * @param tools Array of all available tools
 * @param mode Mode configuration with tool filtering rules
 * @returns Filtered array of tools
 */
export function filterToolsByMode(
  tools: ObsidianTool<any>[],
  mode: LNMode
): ObsidianTool<any>[] {
  // Get patterns from mode, fallback to defaults
  const allowedPatterns = mode.ln_tools_allowed || ["*"];
  const disallowedPatterns = mode.ln_tools_disallowed || [];

  // If no filtering is needed (default state), return all tools
  if (
    allowedPatterns.length === 1 &&
    allowedPatterns[0] === "*" &&
    disallowedPatterns.length === 0
  ) {
    return tools;
  }

  // Filter tools based on patterns
  return tools.filter((tool) =>
    isToolAllowed(
      tool.specification.name,
      allowedPatterns,
      disallowedPatterns
    )
  );
}

/**
 * Get a human-readable description of tool filtering configuration
 */
export function getToolFilteringDescription(mode: LNMode): string {
  const allowedPatterns = mode.ln_tools_allowed || ["*"];
  const disallowedPatterns = mode.ln_tools_disallowed || [];

  if (
    allowedPatterns.length === 1 &&
    allowedPatterns[0] === "*" &&
    disallowedPatterns.length === 0
  ) {
    return "All tools allowed";
  }

  const parts: string[] = [];

  if (allowedPatterns.length > 0 && !(allowedPatterns.length === 1 && allowedPatterns[0] === "*")) {
    parts.push(`Allowed: ${allowedPatterns.join(", ")}`);
  }

  if (disallowedPatterns.length > 0) {
    parts.push(`Disallowed: ${disallowedPatterns.join(", ")}`);
  }

  return parts.join("; ") || "All tools allowed";
} 