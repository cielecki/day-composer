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

// Extract translation keys used in t() calls
function extractUsedKeys() {
  log(colors.blue, colors.bold, '\n🔍 Extracting used translation keys from source code...\n');
  
  const sourceFiles = findSourceFiles();
  const usedKeys = new Set();
  const tCallsWithoutKeys = [];
  const keyUsageMap = new Map(); // Track where each key is used
  
  sourceFiles.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(projectRoot, filePath);
      
      // Skip files that are obviously not using translations
      if (!content.includes('from \'../i18n\'') && 
          !content.includes('from \'./i18n\'') && 
          !content.includes('from \'../../i18n\'') && 
          !content.includes('from \'../../../i18n\'') && 
          !content.includes('from \'../../../../i18n\'') &&
          !content.includes('import { t }')) {
        return;
      }
      
      // Enhanced regex to match t() calls with string literals
      const tCallRegex = /\bt\s*\(\s*(['"`])([^'"`\n]+?)\1[^)]*\)/g;
      let match;
      
      while ((match = tCallRegex.exec(content)) !== null) {
        const key = match[2];
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        if (isValidTranslationKey(key)) {
          usedKeys.add(key);
          if (!keyUsageMap.has(key)) {
            keyUsageMap.set(key, []);
          }
          keyUsageMap.get(key).push({
            file: relativePath,
            line: lineNumber,
            call: match[0].trim()
          });
        } else {
          // Only report suspicious calls that might be translations
          if (key.includes('.') && key.length > 3 && !/^(import|export|from|const|let|var|function|class)/.test(key)) {
            tCallsWithoutKeys.push({
              file: relativePath,
              line: lineNumber,
              call: match[0].trim(),
              key: key
            });
          }
        }
      }
      
      // Additional pattern: Look for nested t() calls within other function calls
      // This handles cases like: t('outer.key', { error: t('inner.key') })
      const nestedTCallRegex = /\bt\s*\(\s*[^)]*?\bt\s*\(\s*(['"`])([^'"`\n]+?)\1[^)]*\)[^)]*\)/g;
      while ((match = nestedTCallRegex.exec(content)) !== null) {
        const key = match[2];
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        if (isValidTranslationKey(key)) {
          usedKeys.add(key);
          if (!keyUsageMap.has(key)) {
            keyUsageMap.set(key, []);
          }
          keyUsageMap.get(key).push({
            file: relativePath,
            line: lineNumber,
            call: `nested t() call: ${match[0].trim()}`
          });
        }
      }
      
      // Enhanced pattern: Find all t() calls in a line (to catch multiple nested calls)
      const lines = content.split('\n');
      lines.forEach((line, lineIndex) => {
        if (line.includes('t(')) {
          const simpleCallRegex = /\bt\s*\(\s*(['"`])([^'"`\n]+?)\1/g;
          let simpleMatch;
          
          while ((simpleMatch = simpleCallRegex.exec(line)) !== null) {
            const key = simpleMatch[2];
            
            if (isValidTranslationKey(key)) {
              usedKeys.add(key);
              if (!keyUsageMap.has(key)) {
                keyUsageMap.set(key, []);
              }
              
              // Check if this key is already tracked for this line
              const existingEntry = keyUsageMap.get(key).find(entry => 
                entry.file === relativePath && entry.line === lineIndex + 1
              );
              
              if (!existingEntry) {
                keyUsageMap.get(key).push({
                  file: relativePath,
                  line: lineIndex + 1,
                  call: `t('${key}')`
                });
              }
            }
          }
        }
      });
      
      // Also check for template literals that might contain translation keys
      const templateLiteralRegex = /\bt\s*\(\s*`([^`\n]+?)`[^)]*\)/g;
      while ((match = templateLiteralRegex.exec(content)) !== null) {
        const key = match[1];
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        // For template literals, we need to be more careful about dynamic parts
        // If it contains ${...}, we should look for the base key pattern
        let baseKey = key;
        if (key.includes('${')) {
          // Extract the base key before any interpolation
          baseKey = key.split('${')[0];
        }
        
        if (isValidTranslationKey(baseKey)) {
          usedKeys.add(baseKey);
          if (!keyUsageMap.has(baseKey)) {
            keyUsageMap.set(baseKey, []);
          }
          keyUsageMap.get(baseKey).push({
            file: relativePath,
            line: lineNumber,
            call: match[0].trim()
          });
        }
      }
      
      // Additional pattern: look for dynamic translation key construction
      // Like: t(keyBase + ".suffix") or t(`${prefix}.key`)
      const dynamicKeyRegex = /\bt\s*\(\s*[^)]*\+[^)]*\)/g;
      while ((match = dynamicKeyRegex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        // Extract potential key parts from the dynamic call
        const callContent = match[0];
        const keyParts = callContent.match(/(['"`])([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\1/g);
        
        if (keyParts) {
          keyParts.forEach(part => {
            const key = part.slice(1, -1); // Remove quotes
            if (isValidTranslationKey(key)) {
              usedKeys.add(key);
              if (!keyUsageMap.has(key)) {
                keyUsageMap.set(key, []);
              }
              keyUsageMap.get(key).push({
                file: relativePath,
                line: lineNumber,
                call: match[0].trim()
              });
            }
          });
        }
      }
      
    } catch (error) {
      log(colors.red, `❌ Error reading file ${filePath}:`, error.message);
    }
  });
  
  return { usedKeys: Array.from(usedKeys), tCallsWithoutKeys, keyUsageMap };
}

// Find unused translation keys
function findUnusedKeys(allKeys, usedKeys, enValues) {
  log(colors.blue, colors.bold, '\n🔍 Checking for unused translation keys...\n');
  
  const usedKeysSet = new Set(usedKeys);
  const unusedKeys = allKeys.filter(key => !usedKeysSet.has(key));
  
  if (unusedKeys.length > 0) {
    log(colors.yellow, colors.bold, '⚠️  POTENTIALLY UNUSED TRANSLATION KEYS:');
    console.log();
    
    unusedKeys.forEach((key, index) => {
      const value = enValues.get(key);
      log(colors.yellow, `${index + 1}. Key: "${key}"`);
      log(colors.dim, `   Value: "${value}"`);
      log(colors.cyan, `   💡 Suggestions:`);
      log(colors.white, `   • Search codebase for dynamic usage: grep -r "${key}" src/`);
      log(colors.white, `   • If truly unused, remove from both en.json and pl.json`);
      log(colors.white, `   • Check if this key should be used in similar contexts`);
      console.log();
    });
    
    log(colors.cyan, `📊 Found ${unusedKeys.length} potentially unused keys out of ${allKeys.length} total keys`);
  } else {
    log(colors.green, '✅ All translation keys are being used');
  }
  
  return unusedKeys;
}

// Find translation keys that might be missing
function findMissingKeys(allKeys, usedKeys, keyUsageMap) {
  log(colors.blue, colors.bold, '\n🔍 Checking for missing translation keys...\n');
  
  const allKeysSet = new Set(allKeys);
  const missingKeys = usedKeys.filter(key => !allKeysSet.has(key));
  
  if (missingKeys.length > 0) {
    log(colors.red, colors.bold, '❌ TRANSLATION KEYS USED IN CODE BUT MISSING FROM TRANSLATION FILES:');
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
      
      log(colors.cyan, `   💡 Add to both en.json and pl.json:`);
      log(colors.white, `   "${key}": "[ADD TRANSLATION]"`);
      console.log();
    });
  } else {
    log(colors.green, '✅ All used translation keys exist in translation files');
  }
  
  return missingKeys;
}

// Analyze suspicious t() calls
function analyzeSuspiciousCalls(tCallsWithoutKeys) {
  if (tCallsWithoutKeys.length === 0) return;
  
  log(colors.yellow, colors.bold, '\n⚠️  SUSPICIOUS T() CALLS THAT NEED REVIEW:');
  console.log();
  
  tCallsWithoutKeys.slice(0, 20).forEach((call, index) => {
    log(colors.yellow, `${index + 1}. ${call.file}:${call.line}`);
    log(colors.dim, `   Call: ${call.call}`);
    log(colors.dim, `   Key: "${call.key}"`);
    
    // Provide specific suggestions based on the key pattern
    log(colors.cyan, `   💡 Suggestions:`);
    
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
    log(colors.yellow, `... and ${tCallsWithoutKeys.length - 20} more suspicious calls`);
    console.log();
  }
}

// Generate summary report
function generateSummary(results) {
  log(colors.blue, colors.bold, '\n📋 SUMMARY REPORT\n');
  
  const issues = [];
  
  if (results.missingInPl.length > 0) {
    issues.push(`${results.missingInPl.length} keys missing in Polish translation`);
  }
  
  if (results.missingInEn.length > 0) {
    issues.push(`${results.missingInEn.length} keys missing in English translation`);
  }
  
  if (results.unusedKeys.length > 0) {
    issues.push(`${results.unusedKeys.length} potentially unused keys`);
  }
  
  if (results.missingKeys.length > 0) {
    issues.push(`${results.missingKeys.length} missing translation keys`);
  }
  
  if (results.tCallsWithoutKeys.length > 0) {
    issues.push(`${results.tCallsWithoutKeys.length} suspicious t() calls`);
  }
  
  // Show modifications if they were applied
  if (results.modificationsApplied && (results.addedEntries?.length > 0 || results.removedEntries?.length > 0)) {
    log(colors.green, colors.bold, '🎉 TRANSLATION ISSUES AUTOMATICALLY FIXED!');
    
    const operationsPerformed = [];
    
    if (results.addedEntries?.length > 0) {
      operationsPerformed.push(`Added ${results.addedEntries.length} translation entries`);
      
      const addedByLang = results.addedEntries.reduce((acc, entry) => {
        if (entry.lang === 'both') {
          acc.en = (acc.en || 0) + 1;
          acc.pl = (acc.pl || 0) + 1;
        } else {
          acc[entry.lang] = (acc[entry.lang] || 0) + 1;
        }
        return acc;
      }, {});
      
      if (addedByLang.en) operationsPerformed.push(`  • ${addedByLang.en} English translations`);
      if (addedByLang.pl) operationsPerformed.push(`  • ${addedByLang.pl} Polish translations`);
    }
    
    if (results.removedEntries?.length > 0) {
      operationsPerformed.push(`Removed ${results.removedEntries.length} unused translation keys`);
    }
    
    operationsPerformed.push('Sorted all translation keys alphabetically');
    
    operationsPerformed.forEach(op => log(colors.green, op));
    
    console.log();
    log(colors.cyan, colors.bold, '📝 NEXT STEPS:');
    if (results.addedEntries?.length > 0) {
      log(colors.cyan, '1. Review the added translations and replace [TRANSLATE] and [TODO] placeholders');
      log(colors.cyan, '2. Test the application to ensure translations work correctly');
      log(colors.cyan, '3. Run this script again to verify all issues are resolved');
    } else {
      log(colors.cyan, '1. Test the application to ensure translations work correctly');
      log(colors.cyan, '2. The translation files are now organized and optimized');
    }
  } else if (results.modificationsApplied) {
    log(colors.green, colors.bold, '🎉 TRANSLATION FILES ORGANIZED!');
    log(colors.green, 'Translation keys have been sorted alphabetically for better organization.');
  } else if (issues.length === 0) {
    log(colors.green, colors.bold, '🎉 ALL TRANSLATION CHECKS PASSED!');
    log(colors.green, 'No issues found. Your translation files are in excellent shape!');
  } else {
    log(colors.red, colors.bold, `❌ FOUND ${issues.length} TYPE(S) OF ISSUES:`);
    issues.forEach(issue => log(colors.red, '  •', issue));
    
    console.log();
    log(colors.cyan, colors.bold, '🚀 NEXT STEPS:');
    log(colors.cyan, '1. Review each error above and apply the suggested fixes');
    log(colors.cyan, '2. Run this script again to verify all issues are resolved');
    log(colors.cyan, '3. Test the application to ensure translations work correctly');
    log(colors.cyan, '4. Consider adding this script to your CI/CD pipeline');
  }
  
  console.log();
  log(colors.blue, colors.bold, '📊 STATISTICS:');
  log(colors.blue, `  • Total English keys: ${results.allEnKeys.length}`);
  log(colors.blue, `  • Total Polish keys: ${results.allPlKeys.length}`);
  log(colors.blue, `  • Total used keys found: ${results.usedKeys.length}`);
  log(colors.blue, `  • Files scanned: ${findSourceFiles().length}`);
  log(colors.blue, `  • Translation coverage: ${Math.round((results.usedKeys.length / results.allEnKeys.length) * 100)}%`);
  
  if (results.modificationsApplied) {
    if (results.addedEntries?.length > 0) {
      log(colors.green, `  • Translation entries added: ${results.addedEntries.length}`);
    }
    if (results.removedEntries?.length > 0) {
      log(colors.green, `  • Translation entries removed: ${results.removedEntries.length}`);
    }
    log(colors.green, `  • Translation files sorted and organized`);
  }
}

// Set nested value in object using dot notation
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

// Add missing translation keys to both files
function addMissingTranslations(missingInPl, missingInEn, enValues, plValues, en, pl) {
  if (missingInPl.length === 0 && missingInEn.length === 0) {
    return { en, pl, added: [] };
  }
  
  log(colors.blue, colors.bold, '\n🔧 Adding missing translation keys...\n');
  
  const newEn = JSON.parse(JSON.stringify(en));
  const newPl = JSON.parse(JSON.stringify(pl));
  const added = [];
  
  // Add keys missing in Polish
  missingInPl.forEach(key => {
    const enValue = enValues.get(key);
    if (enValue) {
      const plValue = `[TRANSLATE] ${enValue}`;
      setNestedValue(newPl, key, plValue);
      added.push({ key, lang: 'pl', value: plValue });
      log(colors.green, `✓ Added to PL: ${key} = "${plValue}"`);
    }
  });
  
  // Add keys missing in English
  missingInEn.forEach(key => {
    const plValue = plValues.get(key);
    if (plValue) {
      const enValue = `[TRANSLATE] ${plValue}`;
      setNestedValue(newEn, key, enValue);
      added.push({ key, lang: 'en', value: enValue });
      log(colors.green, `✓ Added to EN: ${key} = "${enValue}"`);
    }
  });
  
  return { en: newEn, pl: newPl, added };
}

// Add missing keys that are used in code but don't exist in translation files
function addMissingUsedKeys(missingKeys, keyUsageMap, en, pl) {
  if (missingKeys.length === 0) {
    return { en, pl, added: [] };
  }
  
  log(colors.blue, colors.bold, '\n🔧 Adding missing translation keys used in code...\n');
  
  const newEn = JSON.parse(JSON.stringify(en));
  const newPl = JSON.parse(JSON.stringify(pl));
  const added = [];
  
  missingKeys.forEach(key => {
    // Generate a placeholder translation based on the key
    const keyParts = key.split('.');
    const lastPart = keyParts[keyParts.length - 1];
    
    // Convert camelCase to human readable
    const humanReadable = lastPart
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    
    const enValue = `[TODO] ${humanReadable}`;
    const plValue = `[TRANSLATE] ${humanReadable}`;
    
    setNestedValue(newEn, key, enValue);
    setNestedValue(newPl, key, plValue);
    
    added.push({ key, lang: 'both', enValue, plValue });
    
    const usages = keyUsageMap.get(key) || [];
    log(colors.green, `✓ Added missing key: ${key}`);
    log(colors.dim, `  EN: "${enValue}"`);
    log(colors.dim, `  PL: "${plValue}"`);
    log(colors.dim, `  Used in ${usages.length} location(s)`);
  });
  
  return { en: newEn, pl: newPl, added };
}

// Remove unused keys from translation files
function removeUnusedKeys(unusedKeys, enPath, plPath, en, pl) {
  if (unusedKeys.length === 0) {
    return { en, pl, removed: [] };
  }
  
  log(colors.blue, colors.bold, '\n🧹 Removing unused translation keys...\n');
  
  const newEn = JSON.parse(JSON.stringify(en));
  const newPl = JSON.parse(JSON.stringify(pl));
  const removed = [];
  
  unusedKeys.forEach(key => {
    const keyParts = key.split('.');
    
    // Remove from English
    let currentEn = newEn;
    let currentPl = newPl;
    
    // Navigate to parent object
    for (let i = 0; i < keyParts.length - 1; i++) {
      if (currentEn[keyParts[i]]) {
        currentEn = currentEn[keyParts[i]];
      }
      if (currentPl[keyParts[i]]) {
        currentPl = currentPl[keyParts[i]];
      }
    }
    
    // Remove the final key
    const finalKey = keyParts[keyParts.length - 1];
    if (currentEn && currentEn[finalKey] !== undefined) {
      delete currentEn[finalKey];
      removed.push(key);
      log(colors.green, `✓ Removed from EN: ${key}`);
    }
    if (currentPl && currentPl[finalKey] !== undefined) {
      delete currentPl[finalKey];
      log(colors.green, `✓ Removed from PL: ${key}`);
    }
  });
  
  // Clean up empty parent objects
  function cleanEmptyObjects(obj) {
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        cleanEmptyObjects(obj[key]);
        if (Object.keys(obj[key]).length === 0) {
          delete obj[key];
          log(colors.dim, `  Cleaned empty section: ${key}`);
        }
      }
    });
  }
  
  cleanEmptyObjects(newEn);
  cleanEmptyObjects(newPl);
  
  return { en: newEn, pl: newPl, removed };
}

// Save translation files
function saveTranslationFiles(enPath, plPath, en, pl) {
  try {
    fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
    fs.writeFileSync(plPath, JSON.stringify(pl, null, 2) + '\n', 'utf8');
    log(colors.green, `✅ Translation files updated successfully`);
    log(colors.dim, `  • ${path.relative(projectRoot, enPath)}`);
    log(colors.dim, `  • ${path.relative(projectRoot, plPath)}`);
    return true;
  } catch (error) {
    log(colors.red, `❌ Error saving translation files: ${error.message}`);
    return false;
  }
}

// Sort translation keys alphabetically (recursive)
function sortTranslationKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj;
  }
  
  const sorted = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = sortTranslationKeys(obj[key]);
  }
  
  return sorted;
}

// Interactive cleanup prompt
async function promptForModifications(missingInPl, missingInEn, missingKeys, unusedKeys) {
  log(colors.yellow, colors.bold, '\n🤔 AUTO-MODIFICATION DECISION\n');
  
  const modifications = [];
  
  if (missingInPl.length > 0) {
    modifications.push(`Add ${missingInPl.length} missing keys to Polish translation with [TRANSLATE] prefix`);
  }
  
  if (missingInEn.length > 0) {
    modifications.push(`Add ${missingInEn.length} missing keys to English translation with [TRANSLATE] prefix`);
  }
  
  if (missingKeys.length > 0) {
    modifications.push(`Add ${missingKeys.length} missing keys used in code to both translation files`);
  }
  
  if (unusedKeys.length > 0) {
    modifications.push(`Remove ${unusedKeys.length} unused translation keys from both files`);
  }
  
  modifications.push('Sort all translation keys alphabetically');
  
  if (modifications.length > 1) { // More than just sorting
    log(colors.cyan, 'The script will automatically:');
    modifications.forEach(mod => log(colors.cyan, `  • ${mod}`));
    log(colors.dim, '\nThis helps maintain translation consistency, prevents runtime errors, and keeps files organized.');
    return true;
  }
  
  // If only sorting is needed
  if (modifications.length === 1) {
    log(colors.cyan, 'The script will automatically sort all translation keys alphabetically.');
    log(colors.dim, 'This keeps translation files organized and easier to maintain.');
    return true;
  }
  
  return false;
}

// Main function
async function main() {
  log(colors.magenta, colors.bold, '🌍 Life Navigator Translation Cleanup & Repair Tool');
  log(colors.magenta, '='.repeat(55));
  log(colors.dim, 'Analyzing and fixing translation files and codebase inconsistencies...\n');
  
  try {
    // Load translations
    const { en, pl, enPath, plPath } = loadTranslations();
    
    // Compare keys
    const keyComparison = compareTranslationKeys(en, pl, enPath, plPath);
    
    // Extract used keys
    const { usedKeys, tCallsWithoutKeys, keyUsageMap } = extractUsedKeys();
    
    // Find unused keys (using English as reference)
    const unusedKeys = findUnusedKeys(keyComparison.allEnKeys, usedKeys, keyComparison.enValues);
    
    // Find missing keys
    const missingKeys = findMissingKeys(keyComparison.allEnKeys, usedKeys, keyUsageMap);
    
    // Analyze suspicious calls
    analyzeSuspiciousCalls(tCallsWithoutKeys);
    
    // Prompt for modifications
    const shouldModify = await promptForModifications(
      keyComparison.missingInPl, 
      keyComparison.missingInEn, 
      missingKeys, 
      unusedKeys
    );
    
    let modificationResults = { en, pl, added: [], removed: [] };
    let filesModified = false;
    
    if (shouldModify) {
      // Add missing translations between EN and PL
      if (keyComparison.missingInPl.length > 0 || keyComparison.missingInEn.length > 0) {
        const translationResults = addMissingTranslations(
          keyComparison.missingInPl,
          keyComparison.missingInEn,
          keyComparison.enValues,
          keyComparison.plValues,
          modificationResults.en,
          modificationResults.pl
        );
        modificationResults.en = translationResults.en;
        modificationResults.pl = translationResults.pl;
        modificationResults.added.push(...translationResults.added);
        filesModified = true;
      }
      
      // Add missing keys used in code
      if (missingKeys.length > 0) {
        const usedKeyResults = addMissingUsedKeys(
          missingKeys,
          keyUsageMap,
          modificationResults.en,
          modificationResults.pl
        );
        modificationResults.en = usedKeyResults.en;
        modificationResults.pl = usedKeyResults.pl;
        modificationResults.added.push(...usedKeyResults.added);
        filesModified = true;
      }
      
      // Remove unused keys
      if (unusedKeys.length > 0) {
        const cleanupResults = removeUnusedKeys(
          unusedKeys, 
          enPath, 
          plPath, 
          modificationResults.en, 
          modificationResults.pl
        );
        modificationResults.en = cleanupResults.en;
        modificationResults.pl = cleanupResults.pl;
        modificationResults.removed = cleanupResults.removed;
        filesModified = true;
      }
      
      // Sort translation keys alphabetically
      log(colors.blue, colors.bold, '\n🔤 Sorting translation keys alphabetically...\n');
      modificationResults.en = sortTranslationKeys(modificationResults.en);
      modificationResults.pl = sortTranslationKeys(modificationResults.pl);
      log(colors.green, '✓ Translation keys sorted alphabetically');
      filesModified = true;
      
      // Save modified files
      if (filesModified) {
        const saved = saveTranslationFiles(enPath, plPath, modificationResults.en, modificationResults.pl);
        if (saved) {
          log(colors.green, colors.bold, '\n✅ Translation files have been updated!');
          if (modificationResults.added.length > 0) {
            log(colors.cyan, `Added ${modificationResults.added.length} translation entries`);
          }
          if (modificationResults.removed.length > 0) {
            log(colors.cyan, `Removed ${modificationResults.removed.length} unused translation keys`);
          }
          log(colors.cyan, 'Translation keys sorted alphabetically');
        }
      }
    }
    
    // Generate summary
    generateSummary({
      ...keyComparison,
      unusedKeys: shouldModify ? [] : unusedKeys, // Show as resolved if modified
      missingKeys: shouldModify ? [] : missingKeys, // Show as resolved if modified
      usedKeys,
      tCallsWithoutKeys,
      modificationsApplied: shouldModify && filesModified,
      addedEntries: modificationResults.added,
      removedEntries: modificationResults.removed,
      missingInPl: shouldModify ? [] : keyComparison.missingInPl,
      missingInEn: shouldModify ? [] : keyComparison.missingInEn
    });
    
  } catch (error) {
    log(colors.red, '❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main(); 