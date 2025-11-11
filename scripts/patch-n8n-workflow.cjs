#!/usr/bin/env node

/**
 * Patch n8n-workflow ESM imports to include .js extensions
 * This fixes Node.js ESM resolution issues on Windows
 */

const fs = require('fs');
const path = require('path');

const esmDir = path.join(__dirname, '..', 'node_modules', 'n8n-workflow', 'dist', 'esm');

if (!fs.existsSync(esmDir)) {
  console.log('n8n-workflow not found, skipping patch');
  process.exit(0);
}

console.log('Patching n8n-workflow ESM imports...');

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Add .js extension to all relative imports
  content = content.replace(/from\s+['"](\.\/.+?)['"];/g, (match, importPath) => {
    // Don't add .js if it already has an extension
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, `${importPath}.js`);
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function patchDirectory(dir) {
  const files = fs.readdirSync(dir);
  let patchedCount = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      patchedCount += patchDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      if (patchFile(fullPath)) {
        patchedCount++;
      }
    }
  }

  return patchedCount;
}

const patchedCount = patchDirectory(esmDir);
console.log(`Successfully patched ${patchedCount} files in n8n-workflow ESM directory`);

