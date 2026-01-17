# Cloudflare Tunnel Setup

## 1. Install cloudflared
# Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

## 2. Login to Cloudflare
cloudflared tunnel login

## 3. Create tunnel
cloudflared tunnel create pharmopera-admin

## 4. Configure tunnel
# Create config.yml with:
tunnel: <tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: admin.pharmopera.com
    service: http://localhost:5000
  - service: http_status:404

## 5. Route DNS
cloudflared tunnel route dns pharmopera-admin admin.pharmopera.com

## 6. Run tunnel
cloudflared tunnel run pharmopera-admin
