const fs = require('fs');
const path = require('path');

// Function to fix component imports
function fixComponentImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix specific component imports
  const importReplacements = [
    // Fix ContentBlock import
    { from: "from '@/components/ContentBlock'", to: "from '@/components/ContentBlock'" },
    { from: "from '@/components/ContentBlock';", to: "from '@/components/ContentBlock';" },
    
    // Fix ContactForm import
    { from: "from '@/components/ContactForm'", to: "from '@/components/ContactForm'" },
    { from: "from '@/components/ContactForm';", to: "from '@/components/ContactForm';" },
    
    // Fix Header import
    { from: "from '@/components/Header'", to: "from '@/components/Header'" },
    { from: "from '@/components/Header';", to: "from '@/components/Header';" },
    
    // Fix Footer import
    { from: "from '@/components/Footer'", to: "from '@/components/Footer'" },
    { from: "from '@/components/Footer';", to: "from '@/components/Footer';" },
    
    // Fix Container import
    { from: "from '@/common/Container'", to: "from '@/common/Container'" },
    { from: "from '@/common/Container';", to: "from '@/common/Container';" },
  ];

  for (const replacement of importReplacements) {
    if (content.includes(replacement.from)) {
      content = content.replace(new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement.to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed component imports in: ${filePath}`);
  }
}

// Find all TypeScript/TSX files
function findTsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const appDir = path.join(__dirname, 'app');
if (fs.existsSync(appDir)) {
  const tsFiles = findTsFiles(appDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  for (const file of tsFiles) {
    fixComponentImports(file);
  }
  
  console.log('Component import fixes completed!');
} else {
  console.log('App directory not found');
} 