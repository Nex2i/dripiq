#!/bin/bash

set -e

echo "Fetching latest from origin..."
git fetch --prune

echo "Checking out main..."
git checkout main
git pull

# Define protected branches
protected_branches=("main" "master" "develop")

# Get merged local branches
echo "Finding merged local branches..."
merged_local=$(git branch --merged main | grep -vE '^\*' | awk '{$1=$1};1')

echo "Deleting merged local branches..."
for branch in $merged_local; do
  should_delete=true
  for protected in "${protected_branches[@]}"; do
    if [[ "$branch" == "$protected" ]]; then
      should_delete=false
      break
    fi
  done

  if $should_delete; then
    echo "Deleting local branch: $branch"
    git branch -d "$branch"
  fi
done

# Get merged remote branches
echo "Finding merged remote branches..."
merged_remote=$(git branch -r --merged origin/main | grep -vE 'HEAD|origin/(main|master|develop)' | awk '{$1=$1};1')

echo "Deleting merged remote branches..."
for remote_branch in $merged_remote; do
  branch_name="${remote_branch#origin/}"
  should_delete=true
  for protected in "${protected_branches[@]}"; do
    if [[ "$branch_name" == "$protected" ]]; then
      should_delete=false
      break
    fi
  done

  if $should_delete; then
    echo "Deleting remote branch: $branch_name"
    git push origin --delete "$branch_name"
  fi
done

echo "Cleanup complete."
