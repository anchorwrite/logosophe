const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodeModulesDir = path.join(__dirname, '../node_modules');

// Find all instances of the primitive package
const findCommand = `find ${nodeModulesDir}/@radix-ui -type f -name "*.mjs" | xargs grep -l "ReactDOM" 2>/dev/null`;
const files = execSync(findCommand).toString().trim().split('\n');

files.forEach(file => {
  if (file) {
    try {
      // Read the file
      const content = fs.readFileSync(file, 'utf8');
      
      // Apply the patch - replace ReactDOM import and usage
      const patchedContent = content
        .replace(/import \* as ReactDOM from "react-dom";/g, 'import { flushSync } from "react";')
        .replace(/ReactDOM\.flushSync/g, 'flushSync');
      
      // Write the patched content back
      fs.writeFileSync(file, patchedContent);
      console.log(`Patched ${file}`);
    } catch (error) {
      console.error(`Error patching ${file}:`, error.message);
    }
  }
}); 