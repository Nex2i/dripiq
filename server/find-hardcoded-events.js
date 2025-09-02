#!/usr/bin/env node

/**
 * Script to find remaining hardcoded event type strings in the codebase
 * This helps identify places where constants should be used instead of strings
 */

const fs = require('fs');
const path = require('path');

// Event types to look for
const eventTypes = [
  'opened', 'open', 'clicked', 'click', 
  'delivered', 'bounce', 'dropped', 'deferred',
  'no_open', 'no_click', 'spam_report', 'unsubscribe'
];

// Files to exclude from search
const excludeFiles = [
  'find-hardcoded-events.js',
  'campaign-events.ts', // Our constants file
  'node_modules',
  '.git',
  'dist',
  'build'
];

function searchInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];

    lines.forEach((line, index) => {
      eventTypes.forEach(eventType => {
        // Look for quoted strings containing event types
        const patterns = [
          new RegExp(`['"]${eventType}['"]`, 'g'),
          new RegExp(`on:\\s*['"]${eventType}['"]`, 'g'),
          new RegExp(`eventType:\\s*['"]${eventType}['"]`, 'g'),
          new RegExp(`type:\\s*['"]${eventType}['"]`, 'g'),
        ];

        patterns.forEach(pattern => {
          if (pattern.test(line)) {
            matches.push({
              line: index + 1,
              content: line.trim(),
              eventType
            });
          }
        });
      });
    });

    return matches;
  } catch (error) {
    return [];
  }
}

function searchDirectory(dir, results = {}) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      if (excludeFiles.some(exclude => file.includes(exclude))) {
        return;
      }

      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDirectory(fullPath, results);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const matches = searchInFile(fullPath);
        if (matches.length > 0) {
          results[fullPath] = matches;
        }
      }
    });
  } catch (error) {
    // Skip directories we can't read
  }

  return results;
}

// Search the src directory
const srcDir = path.join(__dirname, 'src');
const results = searchDirectory(srcDir);

// Output results
console.log('🔍 Hardcoded Event Type Strings Found:\n');

if (Object.keys(results).length === 0) {
  console.log('✅ No hardcoded event type strings found!');
} else {
  Object.entries(results).forEach(([file, matches]) => {
    console.log(`📁 ${file.replace(__dirname, '.')}`);
    matches.forEach(match => {
      console.log(`   Line ${match.line}: ${match.content}`);
    });
    console.log('');
  });

  console.log(`\n📊 Summary: Found ${Object.keys(results).length} files with hardcoded event strings`);
  console.log('\n💡 Consider replacing these with constants from @/constants/campaign-events');
}