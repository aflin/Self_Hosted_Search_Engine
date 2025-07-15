#!/bin/bash

set -euo pipefail

# === CONFIGURATION ===
IMAGE_NAME="rampartfts/shse"
TAG="latest"
DOCKERFILE_DIR="./dockerfiles"
LOCAL_TAG_AMD="${IMAGE_NAME}:amd64"
LOCAL_TAG_ARM="${IMAGE_NAME}:arm64"
FINAL_TAG="${IMAGE_NAME}:${TAG}"

DOCKERFILE_AMD="$DOCKERFILE_DIR/Dockerfile.amd64"
DOCKERFILE_ARM="$DOCKERFILE_DIR/Dockerfile.arm64"
ENTRYPOINT_SCRIPT="$DOCKERFILE_DIR/entrypoint.sh"

# === Check all required files exist ===
for f in "$DOCKERFILE_AMD" "$DOCKERFILE_ARM" "$ENTRYPOINT_SCRIPT" "$DOCKERFILE_DIR/amd64" "$DOCKERFILE_DIR/arm64"; do
  [ -e "$f" ] || { echo "❌ Missing required file: $f"; exit 1; }
done

# === Ensure buildx is ready ===
if ! docker buildx inspect multiarch-builder >/dev/null 2>&1; then
  echo "🔧 Creating buildx builder..."
  docker buildx create --name multiarch-builder --use
else
  docker buildx use multiarch-builder
fi

# === Build each architecture separately ===
echo "🏗️  Building amd64 image..."
docker buildx build \
  --platform linux/amd64 \
  --file "$DOCKERFILE_AMD" \
  --tag "$LOCAL_TAG_AMD" \
  --load \
  "$DOCKERFILE_DIR"

echo "🏗️  Building arm64 image..."
docker buildx build \
  --platform linux/arm64 \
  --file "$DOCKERFILE_ARM" \
  --tag "$LOCAL_TAG_ARM" \
  --load \
  "$DOCKERFILE_DIR"

# === Push individual images to registry ===
echo "📤 Pushing amd64 image..."
docker push "$LOCAL_TAG_AMD"

echo "📤 Pushing arm64 image..."
docker push "$LOCAL_TAG_ARM"

# === Create and push the multi-arch manifest ===
echo "🔗 Creating and pushing multi-architecture manifest..."
docker buildx imagetools create \
  --tag "$FINAL_TAG" \
  "$LOCAL_TAG_AMD" \
  "$LOCAL_TAG_ARM"

# === Verify manifest ===
echo "🔍 Verifying multi-arch manifest:"
docker buildx imagetools inspect "$FINAL_TAG"

echo "✅ Multi-arch image published as: $FINAL_TAG"
