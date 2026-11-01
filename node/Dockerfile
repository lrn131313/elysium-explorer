# The explorer's own Elysium (99901) archive node: Arbitrum Nitro with the Elysium chain config baked in.
# Same recipe as Elysium/custom RPC (entrypoint.sh, chainInfo.json and parent-proxy are byte-identical copies),
# with a newer Nitro and the debug API on, because the explorer traces every transaction for internal transfers.
# Pinned by digest (multi-arch index pulled 2026-10-31); bump tag and digest together.
ARG NITRO_IMAGE=offchainlabs/nitro-node:v3.12.2-5f02f3f@sha256:87548501c3ee41cff84e6764cc86f65eb7f0a14e2e50a0d3219d462e5793680d
FROM ${NITRO_IMAGE}

COPY --chown=user:user config/chainInfo.json /config/chainInfo.json
COPY --chown=user:user entrypoint.sh /usr/local/bin/elysium-entrypoint
# --chmod needs BuildKit; this Docker has no buildx, so set the exec bit in a plain step
USER root
RUN chmod 755 /usr/local/bin/elysium-entrypoint

USER user
WORKDIR /home/user

EXPOSE 8547 8546 6070

ENTRYPOINT ["/usr/local/bin/elysium-entrypoint"]
