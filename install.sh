#!/bin/bash
# KWDB Playground Installation Script
# https://github.com/KWDB/playground

set -e

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo " ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ "
echo " ◆                                       ◆ "
echo " ◆   ██╗  ██╗██╗    ██╗██████╗ ██████╗   ◆ "
echo " ◆   ██║ ██╔╝██║    ██║██╔══██╗██╔══██╗  ◆ "
echo " ◆   █████╔╝ ██║ █╗ ██║██║  ██║██████╔╝  ◆ "
echo " ◆   ██╔═██╗ ██║███╗██║██║  ██║██╔══██╗  ◆ "
echo " ◆   ██║  ██╗╚███╔███╔╝██████╔╝██████╔╝  ◆ "
echo " ◆   ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝ ╚═════╝   ◆ "
echo " ◆                                       ◆ "
echo " ◆        P l a y g r o u n d  🎮        ◆ "
echo " ◆                                       ◆ "
echo " ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ "
echo -e "${NC}"

echo -e "${BLUE}Installing KWDB Playground...${NC}"

# Detect OS and Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
    x86_64|amd64)
        ARCH="amd64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo -e "${RED}Unsupported architecture: $ARCH${NC}"
        exit 1
        ;;
esac

EXT=""
case "$OS" in
    linux)
        OS_NAME="linux"
        ;;
    darwin)
        OS_NAME="darwin"
        ;;
    mingw*|msys*|cygwin*)
        OS_NAME="windows"
        EXT=".exe"
        ;;
    *)
        echo -e "${RED}Unsupported OS: $OS${NC}"
        exit 1
        ;;
esac

BINARY_NAME="kwdb-playground-${OS_NAME}-${ARCH}${EXT}"
REPO="KWDB/playground"

echo -e "Detected platform: ${GREEN}${OS_NAME}-${ARCH}${NC}"

# Fetch latest version - try GitHub first, then AtomGit
echo -e "Fetching latest release version..."

ATOMGIT_REPO="KWDB/playground"
GITHUB_REPO="KWDB/playground"

# Try GitHub first
LATEST_RELEASE=""
if [ -z "${FORCE_ATOMGIT:-}" ]; then
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || echo "")
else
    echo -e "${YELLOW}Skipping GitHub check (FORCE_ATOMGIT is set)...${NC}"
fi

SOURCE="github"
if [ -z "$LATEST_RELEASE" ]; then
    echo -e "${YELLOW}GitHub API failed, trying AtomGit...${NC}"
    # AtomGit API v5 endpoint requires Private-Token header, but for public repos we can try to parse the release page or use a public API if available.
    # However, AtomGit API v5 strictly requires authentication (Private-Token).
    # Since we can't expect users to provide a token for installation, we fallback to scraping the releases page for the latest tag.
    # Alternatively, we can try to download from a fixed 'latest' URL if AtomGit supports it, but AtomGit releases are usually under /releases/download/<tag>/...
    
    # Try to get latest tag from AtomGit using their internal API which seems to be public for public repos
    # The frontend uses this API: https://api.atomgit.com/api/v5/repos/KWDB/playground/releases
    # But it returns 404/401 without token.
    # However, the page is rendered client-side (SPA), so curl won't see the tags in HTML.
    # We must find another way.
    
    # Let's try to use the 'raw' file access to check if we can get a version file, but we don't have one in the repo root that is reliable (package.json version might be dev).
    # A better approach for AtomGit without token might be to try a few common versions or ask the user.
    
    # Wait, we can try to use the 'Gitee' API as a fallback if AtomGit fails? No, it's AtomGit.
    
    # Since we cannot reliable fetch the version from AtomGit without a token (due to SPA and API auth),
    # we will try to fetch the 'latest' release from GitHub again with a different method (e.g. mirror) or fail gracefully.
    
    # As a last resort workaround for AtomGit:
    # We can assume the user knows the version or we default to 'latest' if the download URL supports it.
    # But AtomGit download URLs include the tag: https://atomgit.com/KWDB/playground/releases/download/v0.6.0/...
    
    # Let's try one more public API endpoint that might work:
    # https://atomgit.com/KWDB/playground/tags
    # This is also an SPA.
    
    # Strategy: If GitHub fails, and we can't get version from AtomGit, prompt the user or exit.
    # But wait, maybe we can try to guess or use a fixed version? No.
    
    # Actually, we can try to fetch the tags from the git repository using git ls-remote if git is installed!
    if command -v git >/dev/null 2>&1; then
        echo -e "${YELLOW}Attempting to fetch latest tag via git ls-remote...${NC}"
        LATEST_RELEASE=$(git ls-remote --tags --refs --sort='-v:refname' "https://atomgit.com/${ATOMGIT_REPO}.git" | head -n 1 | awk -F/ '{print $NF}')
    fi
    
    if [ -z "$LATEST_RELEASE" ]; then
        echo -e "${RED}Failed to fetch the latest release version from both GitHub and AtomGit. Please check your internet connection and try again.${NC}"
        exit 1
    fi
    SOURCE="atomgit"
fi

echo -e "Latest release: ${GREEN}${LATEST_RELEASE}${NC} (from ${SOURCE})"

# Set download URL based on source
if [ "$SOURCE" = "atomgit" ]; then
    DOWNLOAD_URL="https://atomgit.com/${REPO}/releases/download/${LATEST_RELEASE}/${BINARY_NAME}"
else
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_RELEASE}/${BINARY_NAME}"
fi

TMP_DIR=$(mktemp -d)
TMP_FILE="${TMP_DIR}/kwdb-playground${EXT}"

echo -e "Downloading ${DOWNLOAD_URL}..."
if ! curl -# -f -L -o "$TMP_FILE" "$DOWNLOAD_URL"; then
    # If GitHub download failed, try AtomGit as fallback
    if [ "$SOURCE" = "github" ]; then
        echo -e "${YELLOW}GitHub download failed, trying AtomGit...${NC}"
        DOWNLOAD_URL="https://atomgit.com/${REPO}/releases/download/${LATEST_RELEASE}/${BINARY_NAME}"
        if ! curl -# -f -L -o "$TMP_FILE" "$DOWNLOAD_URL"; then
            echo -e "${RED}Failed to download the binary from both GitHub and AtomGit. Please check if the release exists for your platform.${NC}"
            rm -rf "$TMP_DIR"
            exit 1
        fi
    else
        echo -e "${RED}Failed to download the binary. Please check if the release exists for your platform.${NC}"
        rm -rf "$TMP_DIR"
        exit 1
    fi
fi

chmod +x "$TMP_FILE"

# Determine installation path
if [ "$OS_NAME" = "windows" ]; then
    # On Windows (Git Bash/MSYS), install to ~/bin or ~/.local/bin
    if [ -d "$HOME/bin" ]; then
        INSTALL_DIR="$HOME/bin"
    else
        INSTALL_DIR="$HOME/.local/bin"
    fi
    TARGET_FILE="${INSTALL_DIR}/kwdb-playground${EXT}"
    mkdir -p "$INSTALL_DIR"
    mv "$TMP_FILE" "$TARGET_FILE"
    echo -e "${YELLOW}Installed to ${INSTALL_DIR}.${NC}"
    
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo -e "${YELLOW}Note: ${INSTALL_DIR} is not in your PATH.${NC}"
        echo -e "Please add it to your PATH by adding this line to your ~/.bash_profile or ~/.bashrc:"
        echo -e "  export PATH=\"\$PATH:${INSTALL_DIR}\""
    fi
else
    INSTALL_DIR="/usr/local/bin"
    TARGET_FILE="${INSTALL_DIR}/kwdb-playground"

    # Check if we can write to /usr/local/bin
    if [ -w "$INSTALL_DIR" ]; then
        mv "$TMP_FILE" "$TARGET_FILE"
    else
        echo -e "${YELLOW}Administrator privileges are required to install to ${INSTALL_DIR}${NC}"
        if command -v sudo >/dev/null 2>&1; then
            sudo mv "$TMP_FILE" "$TARGET_FILE"
        else
            INSTALL_DIR="$HOME/.local/bin"
            TARGET_FILE="${INSTALL_DIR}/kwdb-playground"
            mkdir -p "$INSTALL_DIR"
            mv "$TMP_FILE" "$TARGET_FILE"
            echo -e "${YELLOW}Installed to ${INSTALL_DIR} instead since sudo is not available.${NC}"
            
            # Check if ~/.local/bin is in PATH
            if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
                echo -e "${YELLOW}Note: ${INSTALL_DIR} is not in your PATH.${NC}"
                echo -e "Please add it to your PATH by adding this line to your ~/.bashrc or ~/.zshrc:"
                echo -e "  export PATH=\"\$PATH:${INSTALL_DIR}\""
            fi
        fi
    fi
fi

rm -rf "$TMP_DIR"

echo ""
echo -e "${GREEN}✅ KWDB Playground was successfully installed to ${TARGET_FILE}!${NC}"

# Check for Docker
if ! command -v docker >/dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}⚠️  Warning: Docker is not installed or not in PATH.${NC}"
    echo -e "${YELLOW}   KWDB Playground requires Docker to run course environments.${NC}"
    echo -e "   Please install Docker Desktop: https://docs.docker.com/get-docker/"
else
    # Check if docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        echo ""
        echo -e "${YELLOW}⚠️  Warning: Docker is installed but the daemon doesn't seem to be running.${NC}"
        echo -e "${YELLOW}   Please start Docker Desktop before running KWDB Playground.${NC}"
    fi
fi

echo ""
echo -e "${BLUE}To get started, simply run:${NC}"
echo -e "  ${GREEN}kwdb-playground start${NC}"
echo ""
