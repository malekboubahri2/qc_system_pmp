# Devcontainer image: Python 3.11 + Node 20 + GCC + dev tooling.
# Based on the official devcontainer Python image for batteries-included DX.

FROM mcr.microsoft.com/devcontainers/python:1-3.11-bookworm

ARG NODE_VERSION=20
ARG PNPM_VERSION=9

# System deps: C build toolchain for host firmware tests + general tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        make \
        cmake \
        pkg-config \
        jq \
        ripgrep \
        fd-find \
        curl \
        git \
        openssh-client \
        mosquitto-clients \
        sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Node.js via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@${PNPM_VERSION}

# uv — installed for the vscode user so it lands in ~/.local/bin
USER vscode
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/vscode/.local/bin:${PATH}"

# Persist bash history across container rebuilds
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    && echo "$SNIPPET" >> /home/vscode/.bashrc \
    && sudo mkdir /commandhistory \
    && sudo touch /commandhistory/.bash_history \
    && sudo chown -R vscode /commandhistory

WORKDIR /workspace
