#!/bin/bash
# ─────────────────────────────────────────────────────
# cPanel Node.js Application Setup Script
# Run this ONCE on your cPanel server to set up the app
# ─────────────────────────────────────────────────────

set -e

echo "🚀 Setting up Node.js application on cPanel..."

# Create required directories
mkdir -p tmp

# Install production dependencies
npm ci --omit=dev

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Restart application
touch tmp/restart.txt

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. In cPanel → Setup Node.js App, create an app pointing to this directory"
echo "  2. Set the application startup file to: dist/main.js"
echo "  3. Set the Node.js version to 20+"
echo "  4. Add your environment variables in cPanel"
echo "  5. Click 'Run JS script' → start"
