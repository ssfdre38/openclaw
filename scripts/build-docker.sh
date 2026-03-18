#!/usr/bin/env bash
set -euo pipefail

# Build and push OpenClaw CE Docker image

PUSH=false
TAG="latest"
DOCKER_HUB_USER="ssfdre38"
IMAGE_NAME="openclawce"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH=true
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --user)
            DOCKER_HUB_USER="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Read version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "════════════════════════════════════════════════════"
echo "  Building OpenClaw CE Docker Image"
echo "════════════════════════════════════════════════════"
echo ""
echo "Version: $VERSION"
echo "Tag: $TAG"
echo ""

# Build the image
echo "▶ Building Docker image..."
docker build \
    -t "$DOCKER_HUB_USER/$IMAGE_NAME:$VERSION" \
    -t "$DOCKER_HUB_USER/$IMAGE_NAME:$TAG" \
    .

echo "✓ Build successful"
echo ""

# List images
docker images "$DOCKER_HUB_USER/$IMAGE_NAME"

if [ "$PUSH" = true ]; then
    echo ""
    echo "▶ Pushing to Docker Hub..."
    
    # Push version tag
    docker push "$DOCKER_HUB_USER/$IMAGE_NAME:$VERSION"
    
    # Push custom tag (e.g., latest)
    docker push "$DOCKER_HUB_USER/$IMAGE_NAME:$TAG"
    
    echo "✓ Pushed to Docker Hub"
    echo ""
    echo "Images available at:"
    echo "  docker pull $DOCKER_HUB_USER/$IMAGE_NAME:$VERSION"
    echo "  docker pull $DOCKER_HUB_USER/$IMAGE_NAME:$TAG"
else
    echo ""
    echo "To push to Docker Hub, run:"
    echo "  bash scripts/build-docker.sh --push"
fi

echo ""
echo "To test locally:"
echo "  docker run -d -p 18789:18789 $DOCKER_HUB_USER/$IMAGE_NAME:$TAG"
echo ""
