# Tiny DNS-only dnsmasq appliance for the plant LAN.
#
# Resolves the platform's friendly hostname (QC_DOMAIN) to whatever IP DHCP
# currently assigns the RPi's LAN interface — no hardcoded address. Must run
# with `network_mode: host` so it can read the host interface's live address
# and bind :53 on the LAN (a bridged container would only see its useless
# internal 172.x address).
FROM alpine:3.20

# iproute2 gives a full `ip` for default-route interface auto-detection.
RUN apk add --no-cache dnsmasq iproute2

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# dnsmasq binds :53 as root, then drops privileges to the unprivileged dnsmasq
# user on its own (default behaviour).
ENTRYPOINT ["/entrypoint.sh"]
