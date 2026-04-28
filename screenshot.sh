#!/bin/bash
# Headless HTML screenshot — fixed device width/height.
# Usage: PATH_URL=<url|path> DEVICE_WIDTH=390 DEVICE_HEIGHT=844 OUTPUT=out.png ./screenshot.sh
set -e

WIDTH="${DEVICE_WIDTH:-390}"
HEIGHT="${DEVICE_HEIGHT:-844}"
URL="${PATH_URL:?PATH_URL required}"
OUT="${OUTPUT:-screenshot.png}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# If local file path, serve via python3
if [[ "$URL" == /* ]]; then
  DIR=$(dirname "$URL")
  FILE=$(basename "$URL")
  PORT=9876
  python3 -m http.server "$PORT" --directory "$DIR" &
  SERVER_PID=$!
  sleep 1
  URL="http://localhost:$PORT/$FILE"
  trap "kill $SERVER_PID 2>/dev/null" EXIT
fi

echo "$WIDTH x $HEIGHT → $OUT"
"$CHROME" --headless --disable-gpu \
  --screenshot="$OUT" \
  --window-size="$WIDTH","$HEIGHT" \
  "$URL" 2>/dev/null

sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null
echo "Done: $OUT"
