#!/usr/bin/env bash
# Build standalone executables for OpenClaw CE using pkg

set -e

SKIP_BUILD=false
OUTPUT_DIR="binaries"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔨 Building OpenClaw CE Standalone Binaries${NC}"
echo ""

# Get repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Step 1: Build the project (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}📦 Building OpenClaw CE...${NC}"
    pnpm build
    echo -e "${GREEN}✅ Build complete${NC}"
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping build (--skip-build specified)${NC}"
    echo ""
fi

# Step 2: Get version from package.json
echo -e "${YELLOW}📋 Reading version...${NC}"
VERSION=$(node -p "require('./package.json').version")
echo -e "   ${CYAN}Version: $VERSION${NC}"
echo ""

# Step 3: Create output directory
OUTPUT_PATH="$REPO_ROOT/$OUTPUT_DIR"
if [ -d "$OUTPUT_PATH" ]; then
    echo -e "${YELLOW}🗑️  Cleaning old binaries...${NC}"
    rm -rf "$OUTPUT_PATH"
fi
mkdir -p "$OUTPUT_PATH"
echo -e "${CYAN}📁 Output directory: $OUTPUT_PATH${NC}"
echo ""

# Step 4: Build executables using pkg
echo -e "${YELLOW}🚀 Building standalone executables...${NC}"
echo ""

declare -a targets=(
    "windows-x64:node22-win-x64:.exe"
    "linux-x64:node22-linux-x64:"
    "macos-x64:node22-macos-x64:"
)

for target_info in "${targets[@]}"; do
    IFS=':' read -r name target ext <<< "$target_info"
    
    echo -e "   ${CYAN}🔨 Building $name...${NC}"
    
    OUTPUT_FILE="$OUTPUT_PATH/openclaw-$VERSION-$name$ext"
    
    if pnpm exec pkg openclaw.mjs \
        --target "$target" \
        --output "$OUTPUT_FILE" \
        --compress GZip \
        --options no-warnings; then
        
        FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
        echo -e "      ${GREEN}✅ Built: $OUTPUT_FILE ($FILE_SIZE)${NC}"
    else
        echo -e "      ${RED}❌ Failed to build $name${NC}"
    fi
    echo ""
done

# Step 5: Create ZIP archives for distribution
echo -e "${YELLOW}📦 Creating distribution archives...${NC}"
echo ""

for target_info in "${targets[@]}"; do
    IFS=':' read -r name target ext <<< "$target_info"
    
    BINARY_NAME="openclaw-$VERSION-$name$ext"
    BINARY_PATH="$OUTPUT_PATH/$BINARY_NAME"
    
    if [ -f "$BINARY_PATH" ]; then
        ARCHIVE_NAME="openclaw-$VERSION-$name.zip"
        ARCHIVE_PATH="$OUTPUT_PATH/$ARCHIVE_NAME"
        
        # Create a temporary directory for the archive contents
        TEMP_DIR=$(mktemp -d)
        
        # Copy binary
        TARGET_BINARY_NAME="openclaw$ext"
        cp "$BINARY_PATH" "$TEMP_DIR/$TARGET_BINARY_NAME"
        chmod +x "$TEMP_DIR/$TARGET_BINARY_NAME"
        
        # Copy README, LICENSE, and .env.example
        [ -f "README.md" ] && cp "README.md" "$TEMP_DIR/"
        [ -f "LICENSE" ] && cp "LICENSE" "$TEMP_DIR/"
        [ -f ".env.example" ] && cp ".env.example" "$TEMP_DIR/"
        
        # Create installation instructions
        cat > "$TEMP_DIR/README.txt" << 'EOF'
# OpenClaw CE - Standalone Binary

## Quick Start

1. Extract this archive
2. Run: `./openclaw onboard` (or `openclaw.exe onboard` on Windows)
3. Configure your AI models and channels
4. Run: `./openclaw gateway` (or `openclaw.exe gateway` on Windows)

## Notes

- This is a standalone executable with Node.js bundled
- No need to install Node.js separately
- Configuration is stored in ~/.openclaw by default

## Documentation

Visit https://openclawce.com for full documentation.

## Support

- GitHub: https://github.com/ssfdre38/openclaw-community-edition
- Issues: https://github.com/ssfdre38/openclaw-community-edition/issues
EOF
        
        # Create ZIP archive
        (cd "$TEMP_DIR" && zip -r "$ARCHIVE_PATH" .)
        
        # Clean up temp directory
        rm -rf "$TEMP_DIR"
        
        ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
        echo -e "   ${GREEN}✅ Created: $ARCHIVE_NAME ($ARCHIVE_SIZE)${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 All binaries built successfully!${NC}"
echo ""
echo -e "${CYAN}📦 Output directory: $OUTPUT_PATH${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  ${GRAY}1. Test the binaries on their respective platforms${NC}"
echo -e "  ${GRAY}2. Upload to GitHub Releases${NC}"
echo -e "  ${GRAY}3. Update website download links${NC}"
echo ""
