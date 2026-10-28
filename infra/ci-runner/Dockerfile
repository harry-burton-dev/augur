# AUGUR's CI runner: GitHub's runner with its own Docker daemon, and what our jobs expect
# of GitHub's hosted Ubuntu 24.04 image that this one lacks. See docs/ci-runner.md.
FROM myoung34/github-runner:2.338.2-ubuntu-noble

# Chromium's system libraries, for the contract tests' Playwright (which skips --with-deps,
# as the hosted image has them), and the fonts its pages render with.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64 \
    libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 \
    libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
    libfontconfig1 libfreetype6 fonts-liberation fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

# Jobs run as `runner`, without sudo: nothing in our workflows needs it. Its volumes' mount
# points are made here so Docker gives new volumes runner's ownership.
RUN deluser runner sudo \
  && mkdir -p /home/runner/work /home/runner/.cache /runner-config \
  && chown runner /home/runner/work /home/runner/.cache /runner-config

COPY --chmod=755 job-started.sh /opt/ci/job-started.sh
ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/ci/job-started.sh
