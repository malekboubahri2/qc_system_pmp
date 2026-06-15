#!/bin/sh
# Generate dnsmasq config from env, then run it in the foreground.
#
# The key directive is `interface-name=<domain>,<iface>`: dnsmasq answers
# queries for <domain> with the *current* primary IP of <iface>. So the config
# never hardcodes an address and the name follows the RPi's DHCP lease. Paired
# with `bind-dynamic`, dnsmasq also keeps listening as that address changes.
set -eu

# QC_DOMAIN may be a space-separated list (e.g. "inspection.pmp.com andon.pmp.com").
# Every name resolves to the same RPi interface IP.
DOMAINS="${QC_DOMAIN:-inspection.pmp.com andon.pmp.com}"
UPSTREAM="${UPSTREAM_DNS:-1.1.1.1}"

# Pin the LAN interface with LAN_IFACE, else auto-detect the one carrying the
# default route (eth0 wired / wlan0 Wi-Fi).
if [ -z "${LAN_IFACE:-}" ]; then
    LAN_IFACE="$(ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* dev \([^ ]*\).*/\1/p' | head -n1)"
fi
LAN_IFACE="${LAN_IFACE:-eth0}"

cat > /etc/dnsmasq.conf <<EOF
# Generated at container start from env — edit QC_DOMAIN / LAN_IFACE /
# UPSTREAM_DNS on the service instead of this file.
port=53
no-resolv
no-hosts
server=${UPSTREAM}
interface=${LAN_IFACE}
bind-dynamic
EOF

# One interface-name line per domain — each follows the live DHCP IP.
for d in $DOMAINS; do
    echo "interface-name=${d},${LAN_IFACE}/4" >> /etc/dnsmasq.conf
done

echo "dnsmasq: [${DOMAINS}] -> live IP of ${LAN_IFACE} (follows DHCP); upstream ${UPSTREAM}"
exec dnsmasq --keep-in-foreground --log-facility=- --conf-file=/etc/dnsmasq.conf
