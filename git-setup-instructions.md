# Git Setup Instructions for NexusMCP

To set up Git for this project and push it to GitHub, follow these commands in your local terminal:

```bash
# Initialize Git repository (if not already done)
git init

# Configure Git user information
git config --local user.name "Your Name"
git config --local user.email "your.email@example.com"

# Add all files to staging
git add .

# Make the initial commit
git commit -m "Initial commit - version 0.0.1"

# Add the remote repository
git remote add origin https://github.com/veerababumanyam/NexusMCP.git

# Push to GitHub (you'll need to authenticate)
git push -u origin main
```

## Using GitHub Personal Access Token

If you're using a Personal Access Token instead of traditional username/password:

1. Create or use an existing token with the `repo` scope at https://github.com/settings/tokens

2. When pushing, use this format:
```bash
git remote add origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/veerababumanyam/NexusMCP.git
```

3. Or enter your token when prompted for a password.

## Important Files Created for Git

1. `.gitignore` - Prevents sensitive files and directories from being committed
2. `README.md` - Project documentation
3. `VERSION.md` - Version tracking for the project

Your repository will be available at: https://github.com/veerababumanyam/NexusMCP

## Downloading Code from Replit

To download the code from Replit for local Git setup:

1. Click on the three-dot menu at the top-right of Replit
2. Select "Download as zip"
3. Extract the zip file locally
4. Follow the Git setup instructions above