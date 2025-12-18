#!/bin/bash
# Reset Hector Studio app state for development/testing
# Usage: ./scripts/reset-app-state.sh [--full]

set -e

APP_NAME="Hector Studio"
APP_SUPPORT_DIR="$HOME/Library/Application Support/$APP_NAME"
DEFAULT_WORKSPACE="$HOME/Documents/Hector"

echo "🧹 Hector Studio - Reset App State"
echo "=================================="

if [[ "$1" == "--full" ]]; then
    echo "Mode: FULL RESET (including hector binary)"
    echo ""
    echo "Deleting: $APP_SUPPORT_DIR"
    rm -rf "$APP_SUPPORT_DIR"
    echo "Deleting: $DEFAULT_WORKSPACE"
    rm -rf "$DEFAULT_WORKSPACE"
    echo ""
    echo "✅ Full reset complete. Next launch will:"
    echo "   - Prompt to download hector binary"
    echo "   - Create default workspace"
else
    echo "Mode: STATE RESET (keeping hector binary)"
    echo ""
    
    # Delete server configuration
    if [[ -f "$APP_SUPPORT_DIR/servers.json" ]]; then
        echo "Deleting: servers.json"
        rm -f "$APP_SUPPORT_DIR/servers.json"
    fi
    
    # Delete auth tokens
    if [[ -d "$APP_SUPPORT_DIR/auth" ]]; then
        echo "Deleting: auth/"
        rm -rf "$APP_SUPPORT_DIR/auth"
    fi
    
    # Delete Electron localStorage/sessionStorage
    if [[ -d "$APP_SUPPORT_DIR/Local Storage" ]]; then
        echo "Deleting: Local Storage/"
        rm -rf "$APP_SUPPORT_DIR/Local Storage"
    fi
    
    if [[ -d "$APP_SUPPORT_DIR/Session Storage" ]]; then
        echo "Deleting: Session Storage/"
        rm -rf "$APP_SUPPORT_DIR/Session Storage"
    fi
    
    # Delete default workspace
    if [[ -d "$DEFAULT_WORKSPACE" ]]; then
        echo "Deleting: $DEFAULT_WORKSPACE"
        rm -rf "$DEFAULT_WORKSPACE"
    fi
    
    echo ""
    echo "✅ State reset complete. Next launch will:"
    echo "   - Create default workspace"
    echo "   - Start with fresh UI state"
fi

echo ""
echo "Hector binary location: $APP_SUPPORT_DIR/hector/"
