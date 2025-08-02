const fs = require('fs');
const path = require('path');

// Common patterns of incorrect root imports that should be in subdirectories
const importFixes = [
  // Components
  { from: '@/PreferencesButton', to: '@/components/PreferencesButton' },
  { from: '@/NotificationIndicator', to: '@/components/NotificationIndicator' },
  { from: '@/Toast', to: '@/components/Toast' },
  { from: '@/ThemeWrapper', to: '@/components/ThemeWrapper' },
  { from: '@/ContentBlock', to: '@/components/ContentBlock' },
  { from: '@/ContactForm', to: '@/components/ContactForm' },
  { from: '@/Header', to: '@/components/Header' },
  { from: '@/Footer', to: '@/components/Footer' },
  { from: '@/Container', to: '@/common/Container' },
  { from: '@/Button', to: '@/common/Button' },
  { from: '@/SvgIcon', to: '@/common/SvgIcon' },
  { from: '@/TextArea', to: '@/common/TextArea' },
  { from: '@/useForm', to: '@/common/utils/useForm' },
  { from: '@/workflow-client', to: '@/lib/workflow-client' },
  { from: '@/confirmation-dialog', to: '@/components/confirmation-dialog' },
  { from: '@/MediaFileSelector', to: '@/components/MediaFileSelector' },
  { from: '@/SubscriberOptOut', to: '@/components/SubscriberOptOut' },
  { from: '@/translation', to: '@/translation' },
  { from: '@/theme-context', to: '@/lib/theme-context' },
  { from: '@/locales', to: '@/locales' },
  { from: '@/styles', to: '@/styles' },
  { from: '@/types', to: '@/types' },
  { from: '@/lib', to: '@/lib' },
  { from: '@/common', to: '@/common' },
  { from: '@/components', to: '@/components' }
];

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    importFixes.forEach(fix => {
      const regex = new RegExp(`from\\s+['"]${fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, `from '${fix.to}'`);
        modified = true;
        console.log(`  Fixed: ${fix.from} -> ${fix.to}`);
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function scanAndFixFiles() {
  const appDir = path.join(__dirname, 'app');
  let fixedCount = 0;
  
  function processDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        if (fixImportsInFile(fullPath)) {
          fixedCount++;
        }
      }
    }
  }
  
  console.log('Scanning for incorrect root-level imports...');
  processDirectory(appDir);
  
  if (fixedCount > 0) {
    console.log(`\nFixed ${fixedCount} files with incorrect root-level imports.`);
  } else {
    console.log('\nNo incorrect root-level imports found.');
  }
}

scanAndFixFiles(); 