#!/bin/bash

# Script to start Chrome with remote debugging enabled
# Run this on your LOCAL machine (MacBook)

echo "Starting Chrome with remote debugging..."

# Kill any existing Chrome instances
pkill -f "Google Chrome"

# Start Chrome with remote debugging on port 9222
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --remote-debugging-port=9222 \
    --user-data-dir=/tmp/chrome-debug \
    --disable-web-security \
    --disable-features=VizDisplayCompositor \
    --window-size=1280,800 \
    --window-position=100,100 &

echo "Chrome started with remote debugging on port 9222"
echo "You can now connect from your server to control this Chrome instance"
echo ""
echo "To stop Chrome debugging, run: pkill -f 'Google Chrome'"
