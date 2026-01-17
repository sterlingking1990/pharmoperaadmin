#!/bin/bash

# Dashboard Template Switcher
# Usage: ./switch_template.sh [original|modular]

if [ "$1" = "original" ]; then
    echo "Switching to original dashboard template..."
    sed -i "s/dashboard_modular.html/dashboard.html/g" app.py
    echo "✅ Switched to original template (dashboard.html)"
elif [ "$1" = "modular" ]; then
    echo "Switching to modular dashboard template..."
    sed -i "s/dashboard.html/dashboard_modular.html/g" app.py
    echo "✅ Switched to modular template (dashboard_modular.html)"
else
    echo "Usage: $0 [original|modular]"
    echo ""
    echo "Current template in use:"
    grep -n "render_template.*dashboard" app.py
fi
