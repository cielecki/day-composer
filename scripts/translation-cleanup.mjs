#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

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

// Load translation files
function loadTranslations() {
  try {
    const enPath = path.join(projectRoot, 'src/locales/en.json');
    const plPath = path.join(projectRoot, 'src/locales/pl.json');
    
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
    
    return { en, pl, enPath, plPath };
  } catch (error) {
    log(colors.red, '❌ Error loading translation files:', error.message);
    process.exit(1);
  }
}

// Flatten nested object to dot notation keys with value references
function flattenObject(obj, prefix = '', values = new Map()) {
  const keys = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenObject(value, fullKey, values));
    } else {
      keys.push(fullKey);
      values.set(fullKey, value);
    }
  }
  
  return keys;
}

// Get nested value from object using dot notation
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Extract parameters from translation string
function extractTranslationParameters(translationString) {
  if (!translationString || typeof translationString !== 'string') {
    return [];
  }
  
  const parameterRegex = /\{\{([^}]+)\}\}/g;
  const parameters = [];
  let match;
  
  while ((match = parameterRegex.exec(translationString)) !== null) {
    parameters.push(match[1].trim());
  }
  
  return parameters;
}

// Compare translation key consistency
function compareTranslationKeys(en, pl, enPath, plPath) {
  log(colors.blue, colors.bold, '\n🔍 Checking translation key consistency...\n');
  
  const enValues = new Map();
  const plValues = new Map();
  
  const enKeys = flattenObject(en, '', enValues).sort();
  const plKeys = flattenObject(pl, '', plValues).sort();
  
  const enSet = new Set(enKeys);
  const plSet = new Set(plKeys);
  
  // Keys missing in Polish
  const missingInPl = enKeys.filter(key => !plSet.has(key));
  // Keys missing in English
  const missingInEn = plKeys.filter(key => !enSet.has(key));
  
  let hasIssues = false;
  
  if (missingInPl.length > 0) {
    hasIssues = true;
    log(colors.red, colors.bold, '❌ MISSING KEYS IN POLISH TRANSLATION:');
    console.log();
    
    missingInPl.forEach((key, index) => {
      const value = enValues.get(key);
      log(colors.red, `${index + 1}. Key: "${key}"`);
      log(colors.dim, `   English value: "${value}"`);
      log(colors.cyan, `   💡 Add to ${path.relative(projectRoot, plPath)}:`);
      log(colors.white, `   "${key}": "[TRANSLATE] ${value}"`);
      console.log();
    });
  }
  
  if (missingInEn.length > 0) {
    hasIssues = true;
    log(colors.red, colors.bold, '❌ MISSING KEYS IN ENGLISH TRANSLATION:');
    console.log();
    
    missingInEn.forEach((key, index) => {
      const value = plValues.get(key);
      log(colors.red, `${index + 1}. Key: "${key}"`);
      log(colors.dim, `   Polish value: "${value}"`);
      log(colors.cyan, `   💡 Add to ${path.relative(projectRoot, enPath)}:`);
      log(colors.white, `   "${key}": "[TRANSLATE] ${value}"`);
      console.log();
    });
  }
  
  if (!hasIssues) {
    log(colors.green, '✅ Translation keys are consistent between EN and PL');
  }
  
  return {
    missingInPl,
    missingInEn,
    allEnKeys: enKeys,
    allPlKeys: plKeys,
    enValues,
    plValues
  };
}

// Find all TypeScript/TypeScript React files
function findSourceFiles() {
  const sourceFiles = [];
  
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        sourceFiles.push(fullPath);
      }
    }
  }
  
  scanDirectory(path.join(projectRoot, 'src'));
  return sourceFiles;
}

// Check if a string is a valid translation key
function isValidTranslationKey(key) {
  if (!key || typeof key !== 'string') return false;
  
  // Filter out obvious non-translation keys
  const invalidPatterns = [
    /^[^a-zA-Z]/, // Starts with non-letter
    /^[A-Z_]+$/, // All caps (likely constants)
    /^[\d\s\-\./\\:;,|]+$/, // Only numbers, whitespace, and punctuation
    /\n/, // Contains newlines
    /\$\{/, // Contains template literals
    /^(true|false|null|undefined)$/, // Boolean/null values
    /^https?:\/\//, // URLs
    /\.js$|\.json$|\.css$|\.html$|\.md$/, // File extensions
    /^\d{4}-\d{2}-\d{2}/, // Date patterns
    /^[A-Z]{2,}$/, // All caps abbreviations
    /^[@#]/, // Starts with @ or #
    /^(import|export|from|const|let|var|function|class)/, // JS keywords
  ];
  
  // Check against invalid patterns
  if (invalidPatterns.some(pattern => pattern.test(key))) {
    return false;
  }
  
  // Must contain at least one letter and period (dot notation)
  if (!/[a-zA-Z]/.test(key) || !/\./.test(key)) {
    return false;
  }
  
  // Should follow translation key pattern (e.g., "section.subsection.key")
  if (!/^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(key)) {
    return false;
  }
  
  return true;
}

// Extract translation keys used in t() calls and detect parameter mismatches
function extractUsedKeysAndDetectMismatches(enValues, plValues) {
  log(colors.blue, colors.bold, '\n🔍 Extracting used translation keys and detecting parameter mismatches...\n');
  
  const sourceFiles = findSourceFiles();
  const usedKeys = new Set();
  const tCallsWithoutKeys = [];
  const problematicTCalls = [];
  const parameterMismatches = []; // NEW: Track parameter mismatches
  const keyUsageMap = new Map();
  
  sourceFiles.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(projectRoot, filePath);
      
      // Skip files that are obviously not using translations
      const hasI18nImport = content.includes('from \'../i18n\'') || 
                           content.includes('from \'./i18n\'') || 
                           content.includes('from \'../../i18n\'') || 
                           content.includes('from \'../../../i18n\'') || 
                           content.includes('from \'../../../../i18n\'') ||
                           content.includes('from "../i18n"') || 
                           content.includes('from "./i18n"') || 
                           content.includes('from "../../i18n"') || 
                           content.includes('from "../../../i18n"') || 
                           content.includes('from "../../../../i18n"') ||
                           content.includes('import { t }') ||
                           content.includes('t(');
      
      if (!hasI18nImport) {
        return;
      }
      
      // Skip i18n files themselves
      const isI18nFile = relativePath.includes('i18n.ts') || relativePath.includes('i18n.js') || 
                        relativePath.endsWith('/i18n.ts') || relativePath.endsWith('/i18n.js');
      
      // Find ALL t() calls with comprehensive parameter parsing
      const tCallRegex = /\bt\s*\(\s*(['"`])([^'"`\n]+?)\1\s*(?:,\s*\{([^}]+)\})?\s*\)/g;
      let match;
      
      while ((match = tCallRegex.exec(content)) !== null) {
        const fullCall = match[0];
        const key = match[2];
        const parametersString = match[3];
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        if (isValidTranslationKey(key)) {
          usedKeys.add(key);
          if (!keyUsageMap.has(key)) {
            keyUsageMap.set(key, []);
          }
          keyUsageMap.get(key).push({
            file: relativePath,
            line: lineNumber,
            call: fullCall.trim()
          });
          
          // NEW: Check for parameter mismatches
          if (parametersString) {
            const usedParameters = [];
            
            // FIXED: Extract parameter names from the parameters object
            // Handle both explicit syntax (key: value) and ES6 shorthand (key)
            const explicitParamRegex = /(\w+)\s*:/g;
            // Fixed: Only match valid JavaScript identifiers (start with letter/underscore/dollar)
            const shorthandParamRegex = /(?:^|[,\s])([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*[,}]|$)/g;
            
            let paramMatch;
            
            // Extract explicit parameters (key: value)
            while ((paramMatch = explicitParamRegex.exec(parametersString)) !== null) {
              usedParameters.push(paramMatch[1]);
            }
            
            // Extract shorthand parameters ({ key } which means { key: key })
            const paramStringCopy = parametersString.replace(/\w+\s*:/g, ''); // Remove explicit params
            while ((paramMatch = shorthandParamRegex.exec(paramStringCopy)) !== null) {
              const paramName = paramMatch[1];
              // Avoid JavaScript keywords and common non-parameter words
              if (!['const', 'let', 'var', 'true', 'false', 'null', 'undefined', 'this'].includes(paramName)) {
                usedParameters.push(paramName);
              }
            }
            
            // Get expected parameters from translation strings
            const enTranslation = enValues.get(key);
            const plTranslation = plValues.get(key);
            
            const expectedEnParams = extractTranslationParameters(enTranslation);
            const expectedPlParams = extractTranslationParameters(plTranslation);
            
            // Check for mismatches
            const allExpectedParams = new Set([...expectedEnParams, ...expectedPlParams]);
            const allUsedParams = new Set(usedParameters);
            
            const missingParams = [...allExpectedParams].filter(p => !allUsedParams.has(p));
            const extraParams = [...allUsedParams].filter(p => !allExpectedParams.has(p));
            
            if (missingParams.length > 0 || extraParams.length > 0) {
              parameterMismatches.push({
                file: relativePath,
                line: lineNumber,
                call: fullCall.trim(),
                key,
                expectedParams: [...allExpectedParams],
                usedParams: usedParameters,
                missingParams,
                extraParams,
                enTranslation,
                plTranslation
              });
            }
          }
        } else if (!isI18nFile) {
          // Handle suspicious calls as before
          if (key.includes('.') && key.length > 3 && !/^(import|export|from|const|let|var|function|class)/.test(key)) {
            tCallsWithoutKeys.push({
              file: relativePath,
              line: lineNumber,
              call: fullCall.trim(),
              key: key
            });
          }
        }
      }
      
      // Find problematic t() calls (non-static patterns)
      const allTCallsRegex = /\bt\s*\([^)]*\)/g;
      let allMatch;
      
      while ((allMatch = allTCallsRegex.exec(content)) !== null) {
        const fullCall = allMatch[0];
        const lineNumber = content.substring(0, allMatch.index).split('\n').length;
        
        // Check if this follows static pattern
        const staticKeyMatch = fullCall.match(/\bt\s*\(\s*(['"`])([^'"`\n]+?)\1[^)]*\)/);
        
        if (!staticKeyMatch && !isI18nFile) {
          problematicTCalls.push({
            file: relativePath,
            line: lineNumber,
            call: fullCall.trim(),
            reason: 'Non-static translation key usage'
          });
        }
      }
      
    } catch (error) {
      log(colors.red, `❌ Error reading file ${filePath}:`, error.message);
    }
  });
  
  return { 
    usedKeys: Array.from(usedKeys), 
    tCallsWithoutKeys, 
    problematicTCalls, 
    parameterMismatches, // NEW: Return parameter mismatches
    keyUsageMap 
  };
}

// NEW: Analyze parameter mismatches
function analyzeParameterMismatches(parameterMismatches) {
  if (parameterMismatches.length === 0) {
    log(colors.green, '✅ No parameter mismatches found in translation calls');
    return;
  }
  
  log(colors.red, colors.bold, '\n🚨 CRITICAL: TRANSLATION PARAMETER MISMATCHES DETECTED!');
  log(colors.red, colors.bold, 'These translation calls have parameter mismatches:');
  console.log();
  
  parameterMismatches.forEach((mismatch, index) => {
    log(colors.red, `${index + 1}. ${mismatch.file}:${mismatch.line}`);
    log(colors.dim, `   Call: ${mismatch.call}`);
    log(colors.dim, `   Key: "${mismatch.key}"`);
    log(colors.dim, `   EN Translation: "${mismatch.enTranslation}"`);
    log(colors.dim, `   PL Translation: "${mismatch.plTranslation}"`);
    
    if (mismatch.expectedParams.length > 0) {
      log(colors.yellow, `   Expected parameters: ${mismatch.expectedParams.join(', ')}`);
    }
    if (mismatch.usedParams.length > 0) {
      log(colors.cyan, `   Used parameters: ${mismatch.usedParams.join(', ')}`);
    }
    
    if (mismatch.missingParams.length > 0) {
      log(colors.red, `   ❌ Missing parameters: ${mismatch.missingParams.join(', ')}`);
      log(colors.white, `   💡 Add these parameters to the t() call: { ${mismatch.missingParams.map(p => `${p}: value`).join(', ')} }`);
    }
    
    if (mismatch.extraParams.length > 0) {
      log(colors.yellow, `   ⚠️  Extra parameters: ${mismatch.extraParams.join(', ')}`);
      log(colors.white, `   💡 These parameters are not used in the translation strings`);
    }
    
    log(colors.cyan, `   🔧 FIX REQUIRED:`);
    if (mismatch.missingParams.length > 0) {
      log(colors.white, `   • Change parameter names in code to match translation: ${mismatch.missingParams.join(', ')}`);
    }
    if (mismatch.extraParams.length > 0) {
      log(colors.white, `   • OR update translation strings to use these parameters: ${mismatch.extraParams.join(', ')}`);
    }
    
    console.log();
  });
  
  log(colors.red, colors.bold, '💥 WHY THIS IS CRITICAL:');
  log(colors.red, '• Parameter mismatches cause {{placeholders}} to not be replaced');
  log(colors.red, '• Users see raw template syntax like "{{name}}" instead of actual values');
  log(colors.red, '• This breaks the user experience and looks unprofessional');
  log(colors.red, '• These are easy to fix but critical for proper functionality');
  
  console.log();
}

// Report unused keys (but don't delete them)
function reportUnusedKeys(allKeys, usedKeys, enValues) {
  log(colors.blue, colors.bold, '\n🔍 Checking for unused translation keys...\n');
  
  const usedKeysSet = new Set(usedKeys);
  const unusedKeys = allKeys.filter(key => !usedKeysSet.has(key));
  
  if (unusedKeys.length > 0) {
    log(colors.yellow, colors.bold, '⚠️  POTENTIALLY UNUSED TRANSLATION KEYS:');
    log(colors.yellow, colors.bold, '(These are flagged for manual review - NOT automatically deleted)');
    console.log();
    
    unusedKeys.forEach((key, index) => {
      const value = enValues.get(key);
      log(colors.yellow, `${index + 1}. Key: "${key}"`);
      log(colors.dim, `   Value: "${value}"`);
      log(colors.cyan, `   💡 Manual review needed:`);
      log(colors.white, `   • Search codebase for dynamic usage: grep -r "${key}" src/`);
      log(colors.white, `   • If truly unused, manually remove from both en.json and pl.json`);
      log(colors.white, `   • Check if this key should be used in similar contexts`);
      console.log();
    });
    
    log(colors.cyan, `📊 Found ${unusedKeys.length} potentially unused keys out of ${allKeys.length} total keys`);
    log(colors.yellow, '⚠️  These keys are NOT automatically deleted - manual review required');
  } else {
    log(colors.green, '✅ All translation keys are being used');
  }
  
  return unusedKeys;
}

// Find missing keys (but don't add them automatically)
function reportMissingKeys(allKeys, usedKeys, keyUsageMap) {
  log(colors.blue, colors.bold, '\n🔍 Checking for missing translation keys...\n');
  
  const allKeysSet = new Set(allKeys);
  const missingKeys = usedKeys.filter(key => !allKeysSet.has(key));
  
  if (missingKeys.length > 0) {
    log(colors.red, colors.bold, '❌ TRANSLATION KEYS USED IN CODE BUT MISSING FROM TRANSLATION FILES:');
    log(colors.red, colors.bold, '(These need to be manually added - NOT automatically added)');
    console.log();
    
    missingKeys.forEach((key, index) => {
      const usages = keyUsageMap.get(key) || [];
      log(colors.red, `${index + 1}. Key: "${key}"`);
      log(colors.dim, `   Used in ${usages.length} location(s):`);
      
      usages.slice(0, 3).forEach(usage => {
        log(colors.dim, `   • ${usage.file}:${usage.line} - ${usage.call}`);
      });
      
      if (usages.length > 3) {
        log(colors.dim, `   • ... and ${usages.length - 3} more locations`);
      }
      
      log(colors.cyan, `   💡 Manually add to both en.json and pl.json:`);
      log(colors.white, `   "${key}": "[ADD TRANSLATION]"`);
      console.log();
    });
    
    log(colors.red, '⚠️  These keys are NOT automatically added - manual addition required');
  } else {
    log(colors.green, '✅ All used translation keys exist in translation files');
  }
  
  return missingKeys;
}

// Analyze suspicious t() calls
function analyzeSuspiciousCalls(tCallsWithoutKeys) {
  if (tCallsWithoutKeys.length === 0) return;
  
  log(colors.red, colors.bold, '\n❌ SUSPICIOUS T() CALLS THAT NEED MANUAL REVIEW:');
  console.log();
  
  tCallsWithoutKeys.slice(0, 20).forEach((call, index) => {
    log(colors.red, `${index + 1}. ${call.file}:${call.line}`);
    log(colors.dim, `   Call: ${call.call}`);
    log(colors.dim, `   Key: "${call.key}"`);
    
    log(colors.cyan, `   💡 Manual review suggestions:`);
    
    if (call.key.includes('${')) {
      log(colors.white, `   • This appears to be a dynamic translation key`);
      log(colors.white, `   • Ensure all possible values exist in translation files`);
      log(colors.white, `   • Consider using interpolation instead: t('base.key', { param })`);
    } else if (call.key.length < 4) {
      log(colors.white, `   • Key too short - likely not a valid translation key`);
      log(colors.white, `   • Check if this should be a different function call`);
    } else if (!call.key.includes('.')) {
      log(colors.white, `   • Translation keys should use dot notation (e.g., 'section.key')`);
      log(colors.white, `   • Add proper namespace to this key`);
    } else {
      log(colors.white, `   • Review if this is a valid translation key`);
      log(colors.white, `   • If valid, add to translation files`);
      log(colors.white, `   • If invalid, fix the function call`);
    }
    console.log();
  });
  
  if (tCallsWithoutKeys.length > 20) {
    log(colors.red, `... and ${tCallsWithoutKeys.length - 20} more suspicious calls`);
    console.log();
  }
}

// Analyze problematic t() calls
function analyzeProblematicTCalls(problematicTCalls) {
  if (problematicTCalls.length === 0) return;
  
  log(colors.red, colors.bold, '\n🚨 CRITICAL: DYNAMIC TRANSLATION KEYS DETECTED!');
  log(colors.red, colors.bold, 'These calls use dynamic keys and MUST be manually refactored:');
  console.log();
  
  problematicTCalls.slice(0, 20).forEach((call, index) => {
    log(colors.red, `${index + 1}. ${call.file}:${call.line}`);
    log(colors.dim, `   Call: ${call.call}`);
    log(colors.dim, `   Issue: ${call.reason}`);
    
    log(colors.yellow, colors.bold, `   ⚠️  MANUAL ACTION REQUIRED:`);
    log(colors.white, `   • Refactor to use static translation keys: t('static.key')`);
    log(colors.white, `   • Avoid dynamic key construction like: t(variable), t(key + '.suffix'), t(\`template\`)`);
    log(colors.white, `   • If you need dynamic content, use interpolation: t('static.key', { param })`);
    log(colors.white, `   • If this is a variable assignment, replace with the actual key value`);
    
    if (call.call.includes('`')) {
      log(colors.red, `   🔴 Template literals in t() break static analysis!`);
    } else if (call.call.includes('+')) {
      log(colors.red, `   🔴 String concatenation in t() breaks static analysis!`);
    } else if (!call.call.includes('"') && !call.call.includes("'")) {
      log(colors.red, `   🔴 Variable usage in t() breaks static analysis!`);
    }
    
    console.log();
  });
  
  if (problematicTCalls.length > 20) {
    log(colors.red, `... and ${problematicTCalls.length - 20} more problematic calls`);
    console.log();
  }
  
  log(colors.red, colors.bold, '💥 WHY THIS IS CRITICAL:');
  log(colors.red, '• Dynamic keys make translation management impossible');
  log(colors.red, '• Static analysis tools cannot detect missing translations');
  log(colors.red, '• Translation completeness cannot be verified');
  log(colors.red, '• Runtime errors will occur if translations are missing');
  log(colors.red, '• Code becomes unmaintainable and error-prone');
  
  console.log();
}

// Generate enhanced summary report
function generateSummary(results) {
  log(colors.blue, colors.bold, '\n📋 ENHANCED SUMMARY REPORT\n');
  
  const issues = [];
  
  if (results.missingInPl.length > 0) {
    issues.push(`${results.missingInPl.length} keys missing in Polish translation`);
  }
  
  if (results.missingInEn.length > 0) {
    issues.push(`${results.missingInEn.length} keys missing in English translation`);
  }
  
  if (results.unusedKeys.length > 0) {
    issues.push(`${results.unusedKeys.length} potentially unused keys (manual review needed)`);
  }
  
  if (results.missingKeys.length > 0) {
    issues.push(`${results.missingKeys.length} missing translation keys (manual addition needed)`);
  }
  
  if (results.tCallsWithoutKeys.length > 0) {
    issues.push(`${results.tCallsWithoutKeys.length} suspicious t() calls (manual review needed)`);
  }
  
  if (results.problematicTCalls && results.problematicTCalls.length > 0) {
    issues.push(`${results.problematicTCalls.length} problematic t() calls (manual refactoring needed)`);
  }
  
  // NEW: Parameter mismatch reporting
  if (results.parameterMismatches && results.parameterMismatches.length > 0) {
    issues.push(`${results.parameterMismatches.length} parameter mismatches (manual fixing needed)`);
  }
  
  if (issues.length === 0) {
    log(colors.green, colors.bold, '🎉 ALL TRANSLATION CHECKS PASSED!');
    log(colors.green, 'No issues found. Your translation files are in excellent shape!');
  } else {
    log(colors.red, colors.bold, `❌ FOUND ${issues.length} TYPE(S) OF ISSUES REQUIRING MANUAL REVIEW:`);
    issues.forEach(issue => log(colors.red, '  •', issue));
    
    console.log();
    
    // Prioritize parameter mismatches and dynamic keys
    const criticalIssues = [];
    if (results.parameterMismatches && results.parameterMismatches.length > 0) {
      criticalIssues.push(`🔴 CRITICAL: Fix ${results.parameterMismatches.length} parameter mismatches first!`);
    }
    if (results.problematicTCalls && results.problematicTCalls.length > 0) {
      criticalIssues.push(`🔴 CRITICAL: Fix ${results.problematicTCalls.length} dynamic translation calls!`);
    }
    
    if (criticalIssues.length > 0) {
      log(colors.red, colors.bold, '🚨 STOP: Critical issues must be fixed first!');
      criticalIssues.forEach(issue => log(colors.red, '  •', issue));
      log(colors.red, colors.bold, '⚠️  DO NOT DEPLOY until critical issues are resolved!');
      console.log();
    }
    
    log(colors.cyan, colors.bold, '🚀 MANUAL ACTIONS REQUIRED (DO THESE IN ORDER):');
    let stepNumber = 1;
    
    if (results.parameterMismatches && results.parameterMismatches.length > 0) {
      log(colors.red, `${stepNumber++}. 🔴 CRITICAL: Fix all ${results.parameterMismatches.length} parameter mismatches (see details above)`);
    }
    
    if (results.problematicTCalls && results.problematicTCalls.length > 0) {
      log(colors.red, `${stepNumber++}. 🔴 CRITICAL: Fix all ${results.problematicTCalls.length} dynamic translation calls (see details above)`);
    }
    
    if (results.missingInPl.length > 0 || results.missingInEn.length > 0) {
      log(colors.cyan, `${stepNumber++}. Manually add missing translation keys between EN/PL files`);
    }
    
    if (results.missingKeys.length > 0) {
      log(colors.cyan, `${stepNumber++}. Manually add ${results.missingKeys.length} missing translation keys used in code`);
    }
    
    if (results.unusedKeys.length > 0) {
      log(colors.cyan, `${stepNumber++}. Manually review and remove ${results.unusedKeys.length} potentially unused translation keys`);
    }
    
    if (results.tCallsWithoutKeys.length > 0) {
      log(colors.cyan, `${stepNumber++}. Manually review ${results.tCallsWithoutKeys.length} suspicious t() calls`);
    }
    
    log(colors.cyan, `${stepNumber++}. Run this script again to verify ALL issues are resolved`);
    log(colors.cyan, `${stepNumber++}. Test the application thoroughly to ensure translations work`);
    log(colors.cyan, `${stepNumber++}. Commit changes only after all issues are fixed`);
    
    if (criticalIssues.length > 0) {
      console.log();
      log(colors.red, colors.bold, '⚠️  Remember: Parameter mismatches and dynamic keys are critical errors!');
      log(colors.red, 'The application will not work correctly until these are fixed.');
    }
  }
  
  console.log();
  log(colors.blue, colors.bold, '📊 STATISTICS:');
  log(colors.blue, `  • Total English keys: ${results.allEnKeys.length}`);
  log(colors.blue, `  • Total Polish keys: ${results.allPlKeys.length}`);
  log(colors.blue, `  • Total used keys found: ${results.usedKeys.length}`);
  log(colors.blue, `  • Files scanned: ${findSourceFiles().length}`);
  log(colors.blue, `  • Translation coverage: ${Math.round((results.usedKeys.length / results.allEnKeys.length) * 100)}%`);
  
  // NEW: Parameter mismatch statistics
  if (results.parameterMismatches && results.parameterMismatches.length > 0) {
    log(colors.red, `  • Parameter mismatches found: ${results.parameterMismatches.length}`);
  }
  
  log(colors.yellow, colors.bold, '\n🔒 SAFETY NOTICE:');
  log(colors.yellow, 'This script NO LONGER automatically modifies files.');
  log(colors.yellow, 'All issues require manual review and fixing for safety.');
  log(colors.yellow, 'This prevents accidental deletion of important translations.');
}

// Main function (ENHANCED - no automatic modifications)
async function main() {
  log(colors.magenta, colors.bold, '🌍 Life Navigator Translation Analysis & Issue Detection Tool');
  log(colors.magenta, '='.repeat(65));
  log(colors.dim, 'Analyzing translation files and detecting issues (READ-ONLY MODE)...\n');
  
  try {
    // Load translations
    const { en, pl, enPath, plPath } = loadTranslations();
    
    // Compare keys
    const keyComparison = compareTranslationKeys(en, pl, enPath, plPath);
    
    // Extract used keys and detect parameter mismatches
    const { usedKeys, tCallsWithoutKeys, problematicTCalls, parameterMismatches, keyUsageMap } = 
      extractUsedKeysAndDetectMismatches(keyComparison.enValues, keyComparison.plValues);
    
    // NEW: Analyze parameter mismatches first (most critical)
    analyzeParameterMismatches(parameterMismatches);
    
    // Report unused keys (but don't delete them)
    const unusedKeys = reportUnusedKeys(keyComparison.allEnKeys, usedKeys, keyComparison.enValues);
    
    // Report missing keys (but don't add them)
    const missingKeys = reportMissingKeys(keyComparison.allEnKeys, usedKeys, keyUsageMap);
    
    // Analyze suspicious calls
    analyzeSuspiciousCalls(tCallsWithoutKeys);
    
    // Analyze problematic t() calls
    analyzeProblematicTCalls(problematicTCalls);
    
    // Generate enhanced summary
    generateSummary({
      ...keyComparison,
      unusedKeys,
      missingKeys,
      usedKeys,
      tCallsWithoutKeys,
      problematicTCalls,
      parameterMismatches // NEW: Include parameter mismatches in summary
    });
    
  } catch (error) {
    log(colors.red, '❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main(); 