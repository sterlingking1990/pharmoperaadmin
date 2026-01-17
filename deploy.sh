#!/bin/bash

echo "🚀 Deploying PharmOpera Admin Dashboard"

# Start Flask app
echo "Starting Flask application..."
python app.py &
FLASK_PID=$!

# Wait for app to start
sleep 5

# Start Cloudflare tunnel (you'll need to configure this first)
echo "Starting Cloudflare tunnel..."
# cloudflared tunnel run pharmopera-admin

echo "✅ Dashboard should be available at: https://admin.pharmopera.com"
echo "Flask PID: $FLASK_PID"
echo "To stop: kill $FLASK_PID"
