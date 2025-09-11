# GitHub Pull Request & Merge Practice Tutorial
## Logosophe Project - plowden & baudouinalbert

This tutorial is specifically designed for your Logosophe project using your two GitHub accounts. You'll practice real collaboration workflows that mirror actual development scenarios.

---

## 🎯 Project Setup

**Repository:** `plowden/logosophe.git`  
**Primary Account:** `plowden` (maintainer)  
**Contributing Account:** `baudouinalbert` (contributor)  
**Devices:** Separate devices with separate Cursor installations

---

## 🛠️ Part 1: Environment Setup

### Device 1: Primary Account (plowden)

**Setup your main development environment:**

```bash
# Clone your main repository
git clone git@github.com:plowden/logosophe.git logosophe-main
cd logosophe-main

# Verify your setup
git remote -v
# Should show:
# origin  git@github.com:plowden/logosophe.git (fetch)
# origin  git@github.com:plowden/logosophe.git (push)

# Check your current user
git config user.name
git config user.email
# Should show your plowden account details
```

**Configure Git for this device:**
```bash
git config --global user.name "plowden"
git config --global user.email "your-plowden-email@example.com"
```

### Device 2: Contributing Account (baudouinalbert)

**Setup the contributor environment:**

```bash
# Clone the repository (you'll fork it first)
git clone git@github.com:baudouinalbert/logosophe.git logosophe-contributor
cd logosophe-contributor

# Add the original repository as upstream
git remote add upstream git@github.com:plowden/logosophe.git
git remote -v
# Should show:
# origin    git@github.com:baudouinalbert/logosophe.git (fetch)
# origin    git@github.com:baudouinalbert/logosophe.git (push)
# upstream  git@github.com:plowden/logosophe.git (fetch)
# upstream  git@github.com:plowden/logosophe.git (push)

# Configure Git for this device
git config --global user.name "baudouinalbert"
git config --global user.email "your-baudouinalbert-email@example.com"
```

### SSH Key Configuration

**On Device 1 (plowden):**
```bash
# Generate SSH key for plowden account
ssh-keygen -t ed25519 -C "plowden@example.com" -f ~/.ssh/id_ed25519_plowden

# Add to SSH agent
ssh-add ~/.ssh/id_ed25519_plowden

# Copy public key
cat ~/.ssh/id_ed25519_plowden.pub
```

**On Device 2 (baudouinalbert):**
```bash
# Generate SSH key for baudouinalbert account
ssh-keygen -t ed25519 -C "baudouinalbert@example.com" -f ~/.ssh/id_ed25519_baudouinalbert

# Add to SSH agent
ssh-add ~/.ssh/id_ed25519_baudouinalbert

# Copy public key
cat ~/.ssh/id_ed25519_baudouinalbert.pub
```

**Add SSH keys to respective GitHub accounts:**
1. Go to GitHub.com → Settings → SSH and GPG keys
2. Add the public keys to the correct accounts
3. Test the connection:
   ```bash
   # On Device 1
   ssh -T git@github.com
   # Should show: Hi plowden! You've successfully authenticated...
   
   # On Device 2
   ssh -T git@github.com
   # Should show: Hi baudouinalbert! You've successfully authenticated...
   ```

---

## 🍴 Part 2: Fork-Based Workflow Practice

### Step 1: Fork the Repository (baudouinalbert account)

**On Device 2 (baudouinalbert):**

1. **Fork the repository:**
   - Go to `https://github.com/plowden/logosophe`
   - Click "Fork" in the top-right corner
   - This creates `https://github.com/baudouinalbert/logosophe`

2. **Clone your fork:**
   ```bash
   git clone git@github.com:baudouinalbert/logosophe.git logosophe-contributor
   cd logosophe-contributor
   
   # Add upstream remote
   git remote add upstream git@github.com:plowden/logosophe.git
   git remote -v
   ```

### Step 2: Create a Feature Branch

**On Device 2 (baudouinalbert):**

```bash
# Sync with upstream first
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/add-italian-translation
```

### Step 3: Make Changes

Let's add Italian language support to your Logosophe project:

**Create Italian translation file:**
```bash
# Create directory
mkdir -p apps/worker/app/locales/it

# Copy English as template
cp apps/worker/app/locales/en/translation.json apps/worker/app/locales/it/translation.json
```

**Edit `apps/worker/app/locales/it/translation.json`:**
```json
{
  "common": {
    "loading": "Caricamento...",
    "save": "Salva",
    "cancel": "Annulla",
    "delete": "Elimina",
    "edit": "Modifica",
    "close": "Chiudi",
    "back": "Indietro",
    "next": "Avanti",
    "previous": "Precedente"
  },
  "auth": {
    "signIn": "Accedi",
    "signOut": "Esci",
    "signUp": "Registrati",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Conferma Password"
  },
  "navigation": {
    "home": "Home",
    "about": "Chi Siamo",
    "contact": "Contatto",
    "dashboard": "Dashboard"
  }
}
```

**Update language constants:**
Edit `packages/common/constants/languages.ts`:
```typescript
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' } // Add this line
] as const;
```

### Step 4: Commit and Push

**On Device 2 (baudouinalbert):**

```bash
git add .
git commit -m "feat: add Italian language support

- Add Italian translation file (it/translation.json)
- Update SUPPORTED_LANGUAGES constant to include Italian
- Provides basic Italian translations for common UI elements
- Supports Italian language in the internationalization system"

git push origin feature/add-italian-translation
```

### Step 5: Create Pull Request

**On Device 2 (baudouinalbert):**

1. Go to `https://github.com/baudouinalbert/logosophe`
2. You'll see a banner suggesting to create a PR
3. Click "Compare & pull request"
4. Fill out the PR:

**Title:** `feat: Add Italian language support`

**Description:**
```markdown
## 🎯 What this PR does
Adds Italian language support to the Logosophe platform, enabling Italian users to use the interface in their native language.

## 📝 Changes Made
- [x] Added Italian translation file (`apps/worker/app/locales/it/translation.json`)
- [x] Updated `SUPPORTED_LANGUAGES` constant to include Italian
- [x] Added basic Italian translations for common UI elements
- [x] Follows existing translation structure and patterns

## 🧪 Testing
- [x] Verified Italian appears in language selector
- [x] Tested basic UI elements display in Italian
- [x] Confirmed translation keys follow existing patterns
- [ ] Need to test full application flow in Italian

## 📸 Screenshots
<!-- Add screenshots showing Italian language in action -->

## 🔗 Related Issues
<!-- Link to any related issues or feature requests -->

## ✅ Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] No console.log statements left in code
- [x] Translation keys follow existing naming conventions
- [x] Added to SUPPORTED_LANGUAGES constant
```

5. Click "Create pull request"

### Step 6: Review and Merge (plowden account)

**On Device 1 (plowden):**

1. **Review the Pull Request:**
   - Go to `https://github.com/plowden/logosophe`
   - Click "Pull requests" tab
   - Find the PR from baudouinalbert
   - Review the changes, code quality, and description

2. **Add review comments:**
   - Click on specific lines to add comments
   - Use GitHub's suggestion feature to propose changes
   - Add general comments about the approach

3. **Test the changes locally:**
   ```bash
   # On Device 1
   cd logosophe-main
   git fetch origin
   git checkout -b review/italian-translation origin/feature/add-italian-translation
   
   # Test the changes
   yarn dev
   # Check if Italian appears in language selector
   ```

4. **Approve and merge:**
   - Click "Approve" when satisfied
   - Choose merge strategy (we'll cover this in Part 4)
   - Click "Merge pull request"

---

## 🌿 Part 3: Branch-Based Collaboration Workflow

This simulates team members working on the same repository with different branches.

### Scenario: Bug Fix and Feature Enhancement

**As plowden (Device 1) - Bug Fix:**

```bash
# On Device 1
cd logosophe-main
git checkout main
git pull origin main
git checkout -b fix/authentication-redirect-issue
```

**Fix authentication redirect issue:**
Edit `apps/worker/app/auth.ts`:
```typescript
export const authConfig = {
  // ... existing config
  pages: {
    signIn: '/[lang]/signin',
    error: '/[lang]/auth/error',
  },
  callbacks: {
    redirect: ({ url, baseUrl }) => {
      // Ensure redirect URL is safe and within the application domain
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl;
    },
  },
};
```

```bash
git add .
git commit -m "fix: improve authentication redirect security

- Add URL validation in redirect callback
- Prevent open redirect vulnerabilities
- Ensure all redirects stay within the application domain
- Fixes potential security issue with external redirects"

git push origin fix/authentication-redirect-issue
```

**As baudouinalbert (Device 2) - Feature Enhancement:**

```bash
# On Device 2
cd logosophe-contributor
git fetch upstream
git checkout main
git merge upstream/main
git checkout -b feature/improve-error-handling
```

**Improve error handling:**
Create `apps/worker/app/lib/error-handler.ts`:
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleApiError = (error: unknown) => {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  console.error('Unexpected error:', error);
  return {
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
};
```

Update `apps/worker/app/api/messaging/send/route.ts`:
```typescript
import { handleApiError } from '@/lib/error-handler';

export async function POST(request: Request) {
  try {
    // ... existing logic
  } catch (error) {
    const errorResponse = handleApiError(error);
    return Response.json(errorResponse, { 
      status: errorResponse.statusCode 
    });
  }
}
```

```bash
git add .
git commit -m "feat: improve error handling in messaging API

- Add AppError class for structured error handling
- Implement handleApiError utility function
- Update messaging API to use new error handling
- Provide better error responses to clients
- Improve debugging and user experience"

git push origin feature/improve-error-handling
```

### Create Pull Requests for Both Branches

**plowden creates PR for bug fix:**
1. Go to `https://github.com/plowden/logosophe`
2. Create PR: `fix/authentication-redirect-issue` → `main`
3. Title: `fix: improve authentication redirect security`
4. Mark as "Ready for review"

**baudouinalbert creates PR for feature:**
1. Go to `https://github.com/baudouinalbert/logosophe`
2. Create PR: `feature/improve-error-handling` → `main`
3. Title: `feat: improve error handling in messaging API`
4. Mark as "Draft" initially, then "Ready for review"

### Handling Conflicts

If both PRs modify the same files, you might encounter conflicts:

1. **Merge the first PR** (bug fix) as plowden
2. **Update the second branch** to resolve conflicts as baudouinalbert:
   ```bash
   # On Device 2
   git fetch upstream
   git checkout feature/improve-error-handling
   git merge upstream/main
   # Resolve any conflicts
   git add .
   git commit -m "resolve: merge conflicts with authentication fix"
   git push origin feature/improve-error-handling
   ```

---

## 📝 Part 4: Specific PR Examples for Logosophe

Here are realistic PR examples you can practice with, based on your actual Logosophe codebase:

### Example 1: Database Migration PR

**Branch:** `feature/add-content-versioning`  
**Author:** baudouinalbert  
**Reviewer:** plowden

**Changes:**
```sql
-- Create new migration file: packages/database/migrations/0035_content_versioning.sql
CREATE TABLE ContentVersions (
  id TEXT PRIMARY KEY,
  contentId TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  status TEXT DEFAULT 'draft',
  createdBy TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  publishedAt DATETIME,
  FOREIGN KEY (contentId) REFERENCES Content(id),
  FOREIGN KEY (createdBy) REFERENCES Users(id)
);

CREATE INDEX idx_content_versions_content_id ON ContentVersions(contentId);
CREATE INDEX idx_content_versions_status ON ContentVersions(status);
```

**PR Description:**
```markdown
## What this PR does
Implements content versioning system to track changes and enable rollbacks for the Logosophe content management system.

## Changes Made
- [x] Add ContentVersions table with version tracking
- [x] Include proper foreign key relationships to Content and Users
- [x] Add database indexes for performance optimization
- [x] Support draft/published status tracking
- [x] Follow existing database naming conventions

## 🧪 Testing
- [x] Migration runs successfully on local D1 database
- [x] Verified foreign key constraints work correctly
- [x] Tested with sample data
- [ ] Need to test with production data volume

## 🔗 Related Issues
Closes #123 (Content versioning feature request)

## ✅ Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] No console.log statements left in code
- [x] Database schema follows existing patterns
- [x] Proper indexes added for performance
```

### Example 2: UI Component Enhancement PR

**Branch:** `feature/improve-message-composer`  
**Author:** plowden  
**Reviewer:** baudouinalbert

**Changes:**
```typescript
// apps/worker/app/components/MessageComposer.tsx
import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { TextArea } from '@/common/TextArea';

export function MessageComposer({ onSubmit, isLoading }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [charCount, setCharCount] = useState(0);
  const maxLength = 2000;

  const handleSubmit = () => {
    if (message.trim() && charCount <= maxLength) {
      onSubmit(message);
      setMessage('');
      setCharCount(0);
    }
  };

  return (
    <div className="message-composer">
      <TextArea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setCharCount(e.target.value.length);
        }}
        placeholder="Type your message..."
        maxLength={maxLength}
      />
      <div className="composer-footer">
        <span className={`char-count ${charCount > maxLength ? 'error' : ''}`}>
          {charCount}/{maxLength}
        </span>
        <Button 
          onClick={handleSubmit}
          disabled={!message.trim() || charCount > maxLength || isLoading}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
```

**PR Description:**
```markdown
## What this PR does
Enhances the message composer with character counting and better UX for the Logosophe messaging system.

## Changes Made
- [x] Add real-time character counting
- [x] Implement character limit (2000 chars)
- [x] Add visual feedback for limit exceeded
- [x] Disable send button when invalid
- [x] Clear composer after successful send
- [x] Use existing Radix UI components

## 🧪 Testing
- [x] Character count updates in real-time
- [x] Send button disabled when over limit
- [x] Composer clears after sending
- [x] Loading state works correctly
- [x] Tested with various message lengths

## 📸 Screenshots
<!-- Add before/after screenshots showing the character counter -->

## 🔗 Related Issues
Closes #145 (Message composer UX improvements)
```

### Example 3: API Enhancement PR

**Branch:** `feature/add-message-search`  
**Author:** baudouinalbert  
**Reviewer:** plowden

**Changes:**
```typescript
// apps/worker/app/api/messaging/search/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!query || query.length < 2) {
      return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    // Search messages using FTS (Full Text Search)
    const messages = await db.prepare(`
      SELECT m.*, u.name as senderName
      FROM Messages m
      JOIN Users u ON m.senderId = u.id
      WHERE m.recipientId = ? 
        AND m.content MATCH ?
      ORDER BY m.createdAt DESC
      LIMIT ? OFFSET ?
    `).bind(session.user.id, query, limit, offset).all();

    return Response.json({
      messages: messages.results,
      total: messages.results.length,
      hasMore: messages.results.length === limit
    });

  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

**PR Description:**
```markdown
## What this PR does
Adds full-text search functionality to the Logosophe messaging system, allowing users to search through their message history.

## Changes Made
- [x] Create new search API endpoint at `/api/messaging/search`
- [x] Implement FTS (Full Text Search) using SQLite
- [x] Add pagination support (limit/offset)
- [x] Include sender information in results
- [x] Add proper error handling and validation
- [x] Follow existing API patterns and authentication

## 🧪 Testing
- [x] Search returns relevant results
- [x] Pagination works correctly
- [x] Handles empty queries gracefully
- [x] Respects user permissions
- [x] Performance tested with large datasets
- [x] Tested with various search queries

## 🔗 Related Issues
Closes #145 (Message search feature request)

## ✅ Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] No console.log statements left in code
- [x] API follows existing patterns
- [x] Proper error handling implemented
```

### Example 4: Configuration Update PR

**Branch:** `chore/update-dependencies`  
**Author:** plowden  
**Reviewer:** baudouinalbert

**Changes:**
```json
// apps/worker/package.json
{
  "dependencies": {
    "next": "15.3.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@radix-ui/themes": "^2.0.3",
    "next-auth": "^5.0.0-beta.29"
  },
  "devDependencies": {
    "@types/node": "24.1.0",
    "@types/react": "^18.3.12",
    "typescript": "^5.8.3",
    "wrangler": "^4.24.0"
  }
}
```

**PR Description:**
```markdown
## What this PR does
Updates Logosophe project dependencies to latest stable versions for security and performance improvements.

## Changes Made
- [x] Update Next.js to 15.3.5
- [x] Update React to 18.3.1
- [x] Update Radix UI to 2.0.3
- [x] Update TypeScript to 5.8.3
- [x] Update Wrangler to 4.24.0
- [x] Maintain compatibility with existing code

## 🧪 Testing
- [x] All tests pass with new versions
- [x] Build process works correctly
- [x] No breaking changes detected
- [x] Local development server starts successfully
- [x] Production build successful

## ⚠️ Breaking Changes
None detected - all updates are backward compatible.

## 🔗 Related Issues
Closes #156 (Dependency update request)

## ✅ Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] No console.log statements left in code
- [x] All dependencies updated consistently
- [x] Build process verified
```

---

## 🔀 Part 5: Merge Strategies Practice

### Understanding Merge Strategies

**1. Create a Merge Commit (Default)**
- Preserves complete branch history
- Shows exactly when features were merged
- Best for: Major features, database migrations, API changes

**2. Squash and Merge**
- Combines all commits into one clean commit
- Creates linear history
- Best for: Bug fixes, small features, documentation updates

**3. Rebase and Merge**
- Replays commits onto target branch
- Creates linear history without merge commits
- Best for: Hotfixes, small focused changes

### Practice Exercise: Try All Three Strategies

**Step 1: Create a simple feature branch (baudouinalbert)**

```bash
# On Device 2
cd logosophe-contributor
git checkout main
git pull upstream main
git checkout -b practice/merge-strategies

# Make a simple change
echo "# Merge Strategy Practice" > MERGE_PRACTICE.md
echo "This file demonstrates different merge strategies." >> MERGE_PRACTICE.md

git add MERGE_PRACTICE.md
git commit -m "docs: add merge strategy practice file"
git push origin practice/merge-strategies
```

**Step 2: Create PR and try each merge strategy**

1. **Create PR:** `practice/merge-strategies` → `main`
2. **Try "Create a merge commit" first:**
   - Click "Merge pull request"
   - Choose "Create a merge commit"
   - Observe the merge commit in git log

3. **Reset and try "Squash and merge":**
   ```bash
   # On Device 1 (plowden)
   cd logosophe-main
   git reset --hard HEAD~1  # Reset to before the merge
   git push origin main --force  # Force push to reset remote
   ```
   - Go back to the PR
   - Click "Merge pull request"
   - Choose "Squash and merge"
   - Edit the commit message if needed
   - Observe the single commit in git log

4. **Reset and try "Rebase and merge":**
   ```bash
   # On Device 1 (plowden)
   git reset --hard HEAD~1
   git push origin main --force
   ```
   - Go back to the PR
   - Click "Merge pull request"
   - Choose "Rebase and merge"
   - Observe the linear history in git log

### Merge Strategy Decision Tree for Logosophe

```
Is this a major feature with many commits?
├─ Yes → Create a merge commit (preserves history)
│   └─ Examples: Italian translation, content versioning, message search
└─ No → Is the feature branch up-to-date with main?
    ├─ Yes → Rebase and merge (clean linear history)
    │   └─ Examples: Small bug fixes, hotfixes
    └─ No → Squash and merge (single clean commit)
        └─ Examples: Documentation updates, dependency updates
```

### Best Practices for Your Logosophe Project

**Use Create a merge commit for:**
- Major features (like the Italian translation example)
- Database migrations (like ContentVersions table)
- API changes (like message search endpoint)
- UI overhauls (like message composer improvements)

**Use Squash and merge for:**
- Bug fixes (like authentication redirect fix)
- Small enhancements
- Documentation updates
- Dependency updates

**Use Rebase and merge for:**
- Hotfixes
- Small, focused changes
- When you want to maintain a clean linear history

---

## 🎯 Part 6: Advanced PR Practices

### Code Review Best Practices

**As plowden (Reviewer):**
1. **Check the PR description** - Is it clear what changes were made?
2. **Review the code** - Look for:
   - Code quality and style
   - Potential bugs
   - Security issues
   - Performance implications
3. **Test the changes** - If possible, test locally
4. **Provide constructive feedback** - Be specific and helpful

**As baudouinalbert (Contributor):**
1. **Write clear PR descriptions** - Explain what, why, and how
2. **Keep PRs focused** - One feature/fix per PR
3. **Add tests** - Include tests for new functionality
4. **Update documentation** - Keep docs in sync with code changes

### PR Templates

Create `.github/pull_request_template.md` in your repository:

```markdown
## What this PR does
<!-- Brief description of the changes -->

## Changes Made
- [ ] <!-- List specific changes -->
- [ ] <!-- Use checkboxes for tracking -->

## Testing
- [ ] <!-- How was this tested? -->
- [ ] <!-- What test cases were covered? -->

## Screenshots
<!-- Add screenshots if UI changes -->

## Related Issues
<!-- Link to related issues: Closes #123, Fixes #456 -->

## Checklist
- [ ] Code follows project style guidelines
- [x] Self-review completed
- [x] No console.log statements left in code
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated (if applicable)
```

### Branch Protection Rules

Set up branch protection for your `main` branch:

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (1)
   - ✅ Dismiss stale PR approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

---

## 🚀 Getting Started Checklist

Here's your step-by-step action plan:

### Week 1: Setup and Basic PRs
- [ ] Set up both devices with SSH keys
- [ ] Fork repository as baudouinalbert
- [ ] Practice fork-based workflow with Italian translation example
- [ ] Create your first PR and merge it

### Week 2: Advanced Workflows
- [ ] Practice branch-based collaboration
- [ ] Try all three merge strategies
- [ ] Practice resolving conflicts
- [ ] Set up branch protection rules

### Week 3: Real Project Integration
- [ ] Create PRs for actual improvements to your project
- [ ] Practice code reviews
- [ ] Set up PR templates
- [ ] Integrate with your CI/CD pipeline

### Week 4: Advanced Scenarios
- [ ] Practice hotfix workflows
- [ ] Handle large feature rollouts
- [ ] Practice with multiple contributors
- [ ] Optimize your workflow

---

## 📚 Additional Resources

- [GitHub's Official PR Documentation](https://docs.github.com/en/pull-requests)
- [Atlassian's Git Tutorial](https://www.atlassian.com/git/tutorials)
- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages

---

This tutorial provides you with a comprehensive foundation for practicing pull requests and merges with your Logosophe project using your specific GitHub accounts. Start with the basic scenarios and gradually work your way up to more complex workflows. The key is to practice regularly and experiment with different approaches to find what works best for your development style.

Remember: The goal is not just to learn the mechanics, but to understand the collaboration patterns and best practices that make teams more effective. Happy coding! 🎉
