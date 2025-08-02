const fs = require('fs');
const path = require('path');

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace any relative import (../ or ../../ etc) with @/ (except ./)
  // Handles both single and double quotes
  content = content.replace(/(['"])(\.\.\/)+(?!\.\/)([\w\-\/]+)/g, (match, quote, rel, target) => {
    modified = true;
    return `${quote}@/${target}`;
  });

  // Replace bare imports of shared dirs (e.g. components/Foo) with @/components/Foo
  const dirs = ['components', 'common', 'lib', 'types', 'styles', 'locales'];
  dirs.forEach(dir => {
    const bareRegex = new RegExp(`(['"])${dir}/`, 'g');
    if (bareRegex.test(content)) {
      content = content.replace(bareRegex, `$1@/${dir}/`);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed imports in: ${filePath}`);
  }
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const appDir = path.join(__dirname, 'app');
const files = walk(appDir);
files.forEach(fixImportsInFile);
console.log('All imports have been fixed to use @/ paths where appropriate.');