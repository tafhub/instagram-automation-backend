#!/bin/bash

# Script to set up frontend as separate repository for Vercel deployment

echo "Setting up frontend as separate repository..."

# Create a new directory for the frontend repository
FRONTEND_DIR="../instagram-automation-frontend"

if [ -d "$FRONTEND_DIR" ]; then
    echo "Frontend directory already exists. Removing it..."
    rm -rf "$FRONTEND_DIR"
fi

# Copy frontend folder to new location
echo "Copying frontend files..."
cp -r frontend "$FRONTEND_DIR"

# Navigate to the new frontend directory
cd "$FRONTEND_DIR"

# Initialize git repository
echo "Initializing git repository..."
git init
git add .
git commit -m "Initial frontend commit for Vercel deployment"

# Create GitHub repository (you'll need to do this manually)
echo ""
echo "Frontend repository created at: $(pwd)"
echo ""
echo "Next steps:"
echo "1. Create a new repository on GitHub called 'instagram-automation-frontend'"
echo "2. Run these commands:"
echo "   cd $FRONTEND_DIR"
echo "   git remote add origin https://github.com/YOUR_USERNAME/instagram-automation-frontend.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Then connect the GitHub repository to Vercel"
echo ""
echo "4. Remove the frontend folder from the backend repository:"
echo "   cd ../instagram-automation-backend"
echo "   rm -rf frontend"
echo "   git add ."
echo "   git commit -m \"Remove frontend folder - now in separate repository\""
echo "   git push origin main"
