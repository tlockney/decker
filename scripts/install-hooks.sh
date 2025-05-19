#!/bin/sh
# Script to install Git hooks

# Create git hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create symbolic link to pre-commit hook
ln -sf ../../.husky/pre-commit .git/hooks/pre-commit

echo "Git hooks installed successfully!"