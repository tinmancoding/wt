#!/bin/bash

set -euo pipefail

echo "Building cross-platform binaries..."

# Create dist directory if it doesn't exist
mkdir -p dist

# Build for all target platforms
echo "Building Linux x64..."
bun build --compile --minify --target=bun-linux-x64 src/index.ts --outfile dist/wt-linux-x64

echo "Building Linux ARM64..."
bun build --compile --minify --target=bun-linux-arm64 src/index.ts --outfile dist/wt-linux-arm64

echo "Building macOS x64 (Intel)..."
bun build --compile --minify --target=bun-darwin-x64 src/index.ts --outfile dist/wt-darwin-x64

echo "Building macOS ARM64 (Apple Silicon)..."
bun build --compile --minify --target=bun-darwin-arm64 src/index.ts --outfile dist/wt-darwin-arm64

echo "Build completed successfully!"
echo "Binaries created:"
ls -la dist/wt-*