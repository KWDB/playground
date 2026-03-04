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

MIN_SUPPORTED_VERSION="v0.6.0"
REQUESTED_VERSION="${INSTALL_VERSION:-}"
SOURCE_PREFERENCE="auto"

normalize_version() {
    local version="$1"
    if [ -z "$version" ]; then
        echo ""
        return
    fi
    if [[ "$version" != v* ]]; then
        version="v${version}"
    fi
    echo "$version"
}

version_gte() {
    local left="${1#v}"
    local right="${2#v}"
    [ "$(printf '%s\n%s\n' "$right" "$left" | sort -V | tail -n 1)" = "$left" ]
}

print_usage() {
    echo "Usage: bash install.sh [--version <version>] [--source <auto|github|atomgit>]"
    echo "       bash install.sh <version>"
    echo "       curl -fsSL https://kwdb.tech/playground.sh | bash -s -- [--version <version>] [--source <auto|github|atomgit>]"
    echo ""
    echo "Examples:"
    echo "  bash install.sh --version v0.6.0"
    echo "  bash install.sh 0.6.1"
    echo "  bash install.sh --version v0.6.0 --source atomgit"
    echo "  curl -fsSL https://kwdb.tech/playground.sh | bash -s -- --version v0.6.0 --source atomgit"
    echo ""
    echo "Environment:"
    echo "  INSTALL_VERSION   Specify version to install"
}

while [ $# -gt 0 ]; do
    case "$1" in
        -v|--version)
            if [ -z "${2:-}" ]; then
                echo -e "${RED}Missing version after $1${NC}"
                print_usage
                exit 1
            fi
            REQUESTED_VERSION="$2"
            shift 2
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        --source)
            if [ -z "${2:-}" ]; then
                echo -e "${RED}Missing source after $1${NC}"
                print_usage
                exit 1
            fi
            case "$2" in
                auto|github|atomgit)
                    SOURCE_PREFERENCE="$2"
                    ;;
                *)
                    echo -e "${RED}Unsupported source: $2${NC}"
                    print_usage
                    exit 1
                    ;;
            esac
            shift 2
            ;;
        --atomgit)
            SOURCE_PREFERENCE="atomgit"
            shift
            ;;
        *)
            if [ -z "$REQUESTED_VERSION" ]; then
                REQUESTED_VERSION="$1"
                shift
            else
                echo -e "${RED}Unknown argument: $1${NC}"
                print_usage
                exit 1
            fi
            ;;
    esac
done

REQUESTED_VERSION="$(normalize_version "$REQUESTED_VERSION")"
if [ -n "$REQUESTED_VERSION" ] && ! version_gte "$REQUESTED_VERSION" "$MIN_SUPPORTED_VERSION"; then
    echo -e "${RED}Specified version ${REQUESTED_VERSION} is not supported. Please use ${MIN_SUPPORTED_VERSION} or above.${NC}"
    exit 1
fi

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
echo -e "Resolving release version..."

ATOMGIT_REPO="KWDB/playground"
GITHUB_REPO="KWDB/playground"

SOURCE="github"
LATEST_RELEASE=""
if [ -n "$REQUESTED_VERSION" ]; then
    LATEST_RELEASE="$REQUESTED_VERSION"
    echo -e "Using specified release: ${GREEN}${LATEST_RELEASE}${NC}"
else
    if [ "$SOURCE_PREFERENCE" != "atomgit" ]; then
        LATEST_RELEASE=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || echo "")
    fi

    if [ -z "$LATEST_RELEASE" ]; then
        if [ "$SOURCE_PREFERENCE" = "github" ]; then
            echo -e "${RED}Failed to fetch the latest release version from GitHub.${NC}"
            exit 1
        fi

        if [ "$SOURCE_PREFERENCE" = "atomgit" ]; then
            echo -e "${YELLOW}Using AtomGit source by parameter...${NC}"
        else
            echo -e "${YELLOW}GitHub API failed, trying AtomGit...${NC}"
        fi
        if command -v git >/dev/null 2>&1; then
            echo -e "${YELLOW}Attempting to fetch latest tag via git ls-remote...${NC}"
            LATEST_RELEASE=$(git ls-remote --tags --refs --sort='-v:refname' "https://atomgit.com/${ATOMGIT_REPO}.git" | head -n 1 | awk -F/ '{print $NF}')
        fi

        if [ -z "$LATEST_RELEASE" ]; then
            echo -e "${RED}Failed to fetch the latest release version from AtomGit. Please check your internet connection and try again.${NC}"
            exit 1
        fi
        SOURCE="atomgit"
    fi
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
    if [ "$SOURCE" = "github" ] && [ "$SOURCE_PREFERENCE" != "github" ]; then
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
