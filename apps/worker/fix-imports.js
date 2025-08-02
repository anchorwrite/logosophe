const fs = require('fs');
const path = require('path');

// Function to recursively find all TypeScript/TSX files
function findTsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to fix import paths
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix relative imports to use @/ alias
  const importPatterns = [
    // Fix Toast imports
    { from: /from ['"]\.\.\/\.\.\/components\/Toast['"]/g, to: "from '@/components/Toast'" },
    { from: /from ['"]\.\.\/components\/Toast['"]/g, to: "from '@/components/Toast'" },
    { from: /from ['"]\.\.\/\.\.\/\.\.\/components\/Toast['"]/g, to: "from '@/components/Toast'" },
    
    // Fix SvgIcon imports
    { from: /from ['"]\.\.\/\.\.\/common\/SvgIcon['"]/g, to: "from '@/common/SvgIcon'" },
    { from: /from ['"]\.\.\/common\/SvgIcon['"]/g, to: "from '@/common/SvgIcon'" },
    { from: /from ['"]\.\.\/\.\.\/\.\.\/common\/SvgIcon['"]/g, to: "from '@/common/SvgIcon'" },
    
    // Fix useForm imports
    { from: /from ['"]\.\.\/\.\.\/common\/utils\/useForm['"]/g, to: "from '@/common/utils/useForm'" },
    { from: /from ['"]\.\.\/common\/utils\/useForm['"]/g, to: "from '@/common/utils/useForm'" },
    { from: /from ['"]\.\.\/\.\.\/\.\.\/common\/utils\/useForm['"]/g, to: "from '@/common/utils/useForm'" },
    
    // Fix translation imports
    { from: /from ['"]\.\.\/\.\.\/translation['"]/g, to: "from '@/translation'" },
    { from: /from ['"]\.\.\/translation['"]/g, to: "from '@/translation'" },
    { from: /from ['"]\.\.\/\.\.\/\.\.\/translation['"]/g, to: "from '@/translation'" },
    
    // Fix lib imports
    { from: /from ['"]\.\.\/\.\.\/lib\/theme-context['"]/g, to: "from '@/lib/theme-context'" },
    { from: /from ['"]\.\.\/lib\/theme-context['"]/g, to: "from '@/lib/theme-context'" },
    { from: /from ['"]\.\.\/\.\.\/\.\.\/lib\/theme-context['"]/g, to: "from '@/lib/theme-context'" },
    
    { from: /from ['"]\.\.\/\.\.\/lib\/languages['"]/g, to: "from '@/lib/languages'" },
    { from: /from ['"]\.\.\/lib\/languages['"]/g, to: "from '@/lib/languages'" },
    { from: /from ['"]\.\.\/\.\.\/\.\.\/lib\/languages['"]/g, to: "from '@/lib/languages'" },
  ];
  
  for (const pattern of importPatterns) {
    if (pattern.from.test(content)) {
      content = content.replace(pattern.from, pattern.to);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed imports in: ${filePath}`);
  }
}

// Main execution
const componentsDir = path.join(__dirname, 'components');
const appComponentsDir = path.join(__dirname, 'app', 'components');

console.log('Fixing import paths in components directory...');

// Fix files in root components directory
if (fs.existsSync(componentsDir)) {
  const files = findTsFiles(componentsDir);
  for (const file of files) {
    fixImports(file);
  }
}

// Fix files in app/components directory
if (fs.existsSync(appComponentsDir)) {
  const files = findTsFiles(appComponentsDir);
  for (const file of files) {
    fixImports(file);
  }
}

console.log('Import path fixes completed!'); 