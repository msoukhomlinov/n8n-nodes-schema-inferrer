#!/usr/bin/env node

/**
 * Patch n8n-workflow ESM imports to include .js extensions
 * This fixes Node.js ESM resolution issues on Windows
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'node_modules', 'n8n-workflow', 'dist', 'esm', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.log('n8n-workflow not found, skipping patch');
  process.exit(0);
}

console.log('Patching n8n-workflow ESM imports...');

let content = fs.readFileSync(indexPath, 'utf8');

// Add .js extension to all relative imports
content = content.replace(/from\s+['"](\.\/.+?)['"];/g, (match, importPath) => {
  // Don't add .js if it already has an extension
  if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
    return match;
  }
  return match.replace(importPath, `${importPath}.js`);
});

fs.writeFileSync(indexPath, content, 'utf8');

console.log('Successfully patched n8n-workflow ESM imports');

