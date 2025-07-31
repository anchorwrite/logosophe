#!/bin/bash

case "$1" in
  "start")
    echo "Starting Cloudflare tunnel..."
    cloudflared tunnel run local-dev
    ;;
  "stop")
    echo "Stopping Cloudflare tunnel..."
    pkill -f "cloudflared tunnel run local-dev"
    ;;
  "status")
    echo "Checking tunnel status..."
    cloudflared tunnel list
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    echo "  start  - Start the Cloudflare tunnel"
    echo "  stop   - Stop the Cloudflare tunnel"
    echo "  status - Show tunnel status"
    exit 1
    ;;
esac 