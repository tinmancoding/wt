#!/bin/bash

set -euo pipefail

# Configuration
REPO="tinmancoding/wt"
INSTALL_PATH="${WT_INSTALL_PATH:-$HOME/.local/bin}"
VERSION="${WT_INSTALL_VERSION:-latest}"
BINARY_NAME="wt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Detect platform and architecture
detect_platform() {
    local os arch
    
    case "$(uname -s)" in
        Linux*)
            os="linux"
            ;;
        Darwin*)
            os="darwin"
            ;;
        *)
            error "Unsupported operating system: $(uname -s)"
            exit 1
            ;;
    esac
    
    case "$(uname -m)" in
        x86_64|amd64)
            arch="x64"
            ;;
        arm64|aarch64)
            arch="arm64"
            ;;
        *)
            error "Unsupported architecture: $(uname -m)"
            exit 1
            ;;
    esac
    
    echo "${os}-${arch}"
}

# Get latest release version from GitHub API
get_latest_version() {
    local api_url="https://api.github.com/repos/${REPO}/releases/latest"
    
    if command -v curl >/dev/null 2>&1; then
        curl -s "$api_url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$api_url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
    else
        error "Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
}

# Download file with progress
download_file() {
    local url="$1"
    local output="$2"
    
    log "Downloading from: $url"
    
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --progress-bar "$url" -o "$output"
    elif command -v wget >/dev/null 2>&1; then
        wget --progress=bar:force:noscroll -q --show-progress "$url" -O "$output"
    else
        error "Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
}

# Verify checksum
verify_checksum() {
    local file="$1"
    local expected_checksum="$2"
    
    if command -v sha256sum >/dev/null 2>&1; then
        local actual_checksum
        actual_checksum=$(sha256sum "$file" | cut -d' ' -f1)
    elif command -v shasum >/dev/null 2>&1; then
        local actual_checksum
        actual_checksum=$(shasum -a 256 "$file" | cut -d' ' -f1)
    else
        warn "No checksum utility found. Skipping verification."
        return 0
    fi
    
    if [ "$actual_checksum" = "$expected_checksum" ]; then
        success "Checksum verification passed"
        return 0
    else
        error "Checksum verification failed!"
        error "Expected: $expected_checksum"
        error "Actual:   $actual_checksum"
        return 1
    fi
}

# Main installation function
install_wt() {
    log "Installing wt (Git Worktree Manager)..."
    
    # Detect platform
    local platform
    platform=$(detect_platform)
    log "Detected platform: $platform"
    
    # Get version
    local install_version="$VERSION"
    if [ "$install_version" = "latest" ]; then
        log "Fetching latest version..."
        install_version=$(get_latest_version)
        if [ -z "$install_version" ]; then
            error "Failed to fetch latest version"
            exit 1
        fi
    fi
    log "Installing version: $install_version"
    
    # Determine binary name and archive format
    local binary_name="wt-${platform}"
    local archive_name
    local extract_cmd
    
    if [[ "$platform" == *"darwin"* ]]; then
        archive_name="${binary_name}.zip"
        extract_cmd="unzip -q"
    else
        archive_name="${binary_name}.tar.gz"
        extract_cmd="tar -xzf"
    fi
    
    # Create temporary directory
    local temp_dir
    temp_dir=$(mktemp -d)
    trap "rm -rf '$temp_dir'" EXIT
    
    # Download URLs
    local base_url="https://github.com/${REPO}/releases/download/${install_version}"
    local archive_url="${base_url}/${archive_name}"
    local checksums_url="${base_url}/checksums.txt"
    
    # Download archive
    log "Downloading $archive_name..."
    download_file "$archive_url" "$temp_dir/$archive_name"
    
    # Download and verify checksum
    log "Downloading checksums..."
    download_file "$checksums_url" "$temp_dir/checksums.txt"
    
    local expected_checksum
    expected_checksum=$(grep "$binary_name" "$temp_dir/checksums.txt" | cut -d' ' -f1)
    
    if [ -n "$expected_checksum" ]; then
        log "Verifying checksum..."
        if [[ "$platform" == *"darwin"* ]]; then
            # For zip files, we need to extract first then verify the binary
            cd "$temp_dir"
            $extract_cmd "$archive_name"
            verify_checksum "$binary_name" "$expected_checksum"
        else
            # For tar.gz, extract and verify
            cd "$temp_dir"
            $extract_cmd "$archive_name"
            verify_checksum "$binary_name" "$expected_checksum"
        fi
    else
        warn "Checksum not found for $binary_name, skipping verification"
        cd "$temp_dir"
        $extract_cmd "$archive_name"
    fi
    
    # Create install directory
    log "Creating install directory: $INSTALL_PATH"
    mkdir -p "$INSTALL_PATH"
    
    # Install binary
    log "Installing binary to $INSTALL_PATH/$BINARY_NAME"
    cp "$temp_dir/$binary_name" "$INSTALL_PATH/$BINARY_NAME"
    chmod +x "$INSTALL_PATH/$BINARY_NAME"
    
    success "wt installed successfully!"
    
    # Check if install path is in PATH
    if [[ ":$PATH:" != *":$INSTALL_PATH:"* ]]; then
        warn "Install directory $INSTALL_PATH is not in your PATH"
        warn "Add the following line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo "export PATH=\"$INSTALL_PATH:\$PATH\""
        echo ""
        warn "Or run the binary directly: $INSTALL_PATH/$BINARY_NAME"
    else
        success "You can now run: $BINARY_NAME --help"
    fi
    
    # Show version
    log "Installed version:"
    "$INSTALL_PATH/$BINARY_NAME" --version || true
}

# Show usage
show_usage() {
    cat << EOF
wt Installation Script

Usage: $0 [options]

Environment Variables:
  WT_INSTALL_PATH     Installation directory (default: ~/.local/bin)
  WT_INSTALL_VERSION  Version to install (default: latest)

Examples:
  # Install latest version to default location
  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sh

  # Install to custom path
  WT_INSTALL_PATH=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sh

  # Install specific version
  WT_INSTALL_VERSION=v1.2.3 curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sh

Uninstall:
  rm $INSTALL_PATH/$BINARY_NAME

EOF
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    *)
        install_wt
        ;;
esac