#!/usr/bin/env bash
# ============================================================
# SSL Certificate Setup
# Option 1: Let's Encrypt (production — requires real domain)
# Option 2: Self-signed (development/staging)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/nginx/certs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Pizza Box System — SSL Certificate Setup       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo

mkdir -p "$CERTS_DIR"

# Check if certs already exist
if [ -f "$CERTS_DIR/fullchain.pem" ] && [ -f "$CERTS_DIR/privkey.pem" ]; then
  echo -e "${YELLOW}⚠  SSL certificates already exist in:${NC} $CERTS_DIR"
  read -p "   Overwrite? (y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo -e "${RED}✗  Aborted.${NC}"
    exit 0
  fi
  echo
fi

echo "Choose SSL setup method:"
echo
echo "  1) Let's Encrypt (production — free, auto-renewing)"
echo "     Requires: real domain pointed at this server, port 80 open"
echo
echo "  2) Self-signed certificate (development/staging)"
echo "     Works immediately but browsers will show a security warning"
echo
read -p "Enter choice [1/2]: " choice

case "$choice" in
  1)
    # ─── Let's Encrypt ──────────────────────────────────
    echo
    read -p "Enter your domain (e.g. app.pizzaboxco.com): " DOMAIN

    if [ -z "$DOMAIN" ]; then
      echo -e "${RED}✗  Domain is required for Let's Encrypt.${NC}"
      exit 1
    fi

    read -p "Enter email for renewal notifications: " EMAIL

    if [ -z "$EMAIL" ]; then
      echo -e "${RED}✗  Email is required for Let's Encrypt.${NC}"
      exit 1
    fi

    echo
    echo -e "${CYAN}Requesting certificate for ${DOMAIN}...${NC}"
    echo -e "${YELLOW}Note: Port 80 must be accessible from the internet.${NC}"
    echo

    # Use certbot in standalone mode (stops nginx temporarily)
    if command -v certbot &> /dev/null; then
      sudo certbot certonly \
        --standalone \
        --preferred-challenges http \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive

      # Copy certs to nginx/certs directory
      sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERTS_DIR/fullchain.pem"
      sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERTS_DIR/privkey.pem"
      sudo chown "$(whoami)" "$CERTS_DIR"/*.pem
      chmod 600 "$CERTS_DIR"/*.pem

      echo
      echo -e "${GREEN}✓  Let's Encrypt certificate installed!${NC}"
      echo
      echo -e "${CYAN}Auto-renewal:${NC}"
      echo -e "  Certbot auto-renews via systemd timer or cron."
      echo -e "  After renewal, copy updated certs and reload nginx:"
      echo
      echo -e "  ${YELLOW}sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERTS_DIR/${NC}"
      echo -e "  ${YELLOW}sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $CERTS_DIR/${NC}"
      echo -e "  ${YELLOW}docker compose -f docker-compose.prod.yml exec nginx nginx -s reload${NC}"
      echo

      # Create a renewal hook script
      cat > "$PROJECT_ROOT/scripts/renew-ssl.sh" << RENEW_EOF
#!/usr/bin/env bash
# Run this after certbot renews: certbot renew --deploy-hook ./scripts/renew-ssl.sh
set -euo pipefail
CERTS_DIR="$CERTS_DIR"
sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "\$CERTS_DIR/fullchain.pem"
sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "\$CERTS_DIR/privkey.pem"
docker compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec nginx nginx -s reload
echo "SSL certificates renewed and nginx reloaded."
RENEW_EOF
      chmod +x "$PROJECT_ROOT/scripts/renew-ssl.sh"
      echo -e "${GREEN}✓  Created renew-ssl.sh for automated renewal.${NC}"

    else
      echo -e "${RED}✗  certbot not found. Install it first:${NC}"
      echo -e "   ${YELLOW}sudo apt install certbot${NC}  (Debian/Ubuntu)"
      echo -e "   ${YELLOW}sudo yum install certbot${NC}  (RHEL/CentOS)"
      echo -e "   ${YELLOW}brew install certbot${NC}      (macOS)"
      exit 1
    fi
    ;;

  2)
    # ─── Self-signed ────────────────────────────────────
    echo
    echo -e "${CYAN}Generating self-signed certificate (valid for 365 days)...${NC}"
    echo

    openssl req -x509 -nodes \
      -days 365 \
      -newkey rsa:2048 \
      -keyout "$CERTS_DIR/privkey.pem" \
      -out "$CERTS_DIR/fullchain.pem" \
      -subj "/C=US/ST=Local/L=Local/O=PizzaBoxCo/CN=localhost" \
      2>/dev/null

    chmod 600 "$CERTS_DIR"/*.pem

    echo -e "${GREEN}✓  Self-signed certificate generated!${NC}"
    echo
    echo -e "${YELLOW}⚠  Browsers will show a security warning — this is expected.${NC}"
    echo -e "${YELLOW}   Click 'Advanced' → 'Proceed' to access the site.${NC}"
    echo -e "${YELLOW}   For production, use option 1 (Let's Encrypt) instead.${NC}"
    ;;

  *)
    echo -e "${RED}✗  Invalid choice. Run the script again.${NC}"
    exit 1
    ;;
esac

echo
echo -e "${CYAN}Certificate files:${NC}"
echo -e "  ${GREEN}$CERTS_DIR/fullchain.pem${NC}"
echo -e "  ${GREEN}$CERTS_DIR/privkey.pem${NC}"
echo
echo -e "${CYAN}Next step:${NC}"
echo -e "  ${YELLOW}docker compose -f docker-compose.prod.yml up --build -d${NC}"
echo
