#!/usr/bin/env bash
set -e

AUTH_FILE="$HOME/.deepseek-helmsman/agent/auth.json"
AUTH_BACKUP="$HOME/.deepseek-helmsman/agent/auth.json.bak"

# Restore auth.json on exit (success or failure)
cleanup() {
    if [[ -f "$AUTH_BACKUP" ]]; then
        mv "$AUTH_BACKUP" "$AUTH_FILE"
        echo "Restored auth.json"
    fi
}
trap cleanup EXIT

# Move auth.json out of the way
if [[ -f "$AUTH_FILE" ]]; then
    mv "$AUTH_FILE" "$AUTH_BACKUP"
    echo "Moved auth.json to backup"
fi

# Skip local LLM tests (if any are enabled in local branches)
export DEEPSEEK_HELMSMAN_NO_LOCAL_LLM=1

# Unset DeepSeek credentials so e2e tests do not run accidentally.
unset DEEPSEEK_API_KEY

echo "Running tests without API keys..."
npm test
