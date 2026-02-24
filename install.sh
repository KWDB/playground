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
echo "  _  ___      ______  ____    ____  _                                             _ "
echo " | |/ \ \    / |  _ \|  _ \  |  _ \| |                                           | |"
echo " | ' / \ \  / /| | | | |_) | | |_) | | __ _ _   _  __ _ _ __ ___  _   _ _ __   __| |"
echo " |  <   \ \/ / | | | |  _ <  |  __/| |/ _\` | | | |/ _\` | '__/ _ \| | | | '_ \ / _\` |"
echo " | . \   \  /  | |/ /| |_) | | |   | | (_| | |_| | (_| | | | (_) | |_| | | | | (_| |"
echo " |_|\_\   \/   |___/ |____/  |_|   |_|\__,_|\__, |\__, |_|  \___/ \__,_|_| |_|\__,_|"
echo "                                             __/ | __/ |                            "
echo "                                            |___/ |___/                             "
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

# Fetch latest version
echo -e "Fetching latest release version..."
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_RELEASE" ]; then
    echo -e "${RED}Failed to fetch the latest release version. Please check your internet connection and try again.${NC}"
    exit 1
fi

echo -e "Latest release: ${GREEN}${LATEST_RELEASE}${NC}"

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_RELEASE}/${BINARY_NAME}"
TMP_DIR=$(mktemp -d)
TMP_FILE="${TMP_DIR}/kwdb-playground${EXT}"

echo -e "Downloading ${DOWNLOAD_URL}..."
if ! curl -# -f -L -o "$TMP_FILE" "$DOWNLOAD_URL"; then
    echo -e "${RED}Failed to download the binary. Please check if the release exists for your platform.${NC}"
    rm -rf "$TMP_DIR"
    exit 1
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
echo -e "  ${GREEN}kwdb-playground server${NC}"
echo ""
