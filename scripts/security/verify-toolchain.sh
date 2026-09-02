#!/usr/bin/env bash
# Fetch, verify and run the digest-pinned Console security toolchain.
#
# Every binary is verified against tools/security/toolchain.lock before it
# runs. Verification failure fails the gate; nothing runs unverified.
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
lock_file="${repository_root}/tools/security/toolchain.lock"
# .local is excluded from the authority walk, so a downloaded tool can never
# be mistaken for a tracked repository file.
cache_directory="${repository_root}/tools/security/.local"

read_lock() {
  python3 -c "
import json, sys
with open('${lock_file}', encoding='utf-8') as handle:
    lock = json.load(handle)
node = lock
for key in sys.argv[1:]:
    node = node[key]
print(node)
" "$@"
}

detect_platform() {
  local system machine
  system="$(uname -s)"
  machine="$(uname -m)"
  case "${system}:${machine}" in
    Darwin:arm64) echo "darwin-arm64" ;;
    Linux:x86_64) echo "linux-x64" ;;
    *)
      echo "unsupported platform for the pinned toolchain: ${system}:${machine}" >&2
      exit 1
      ;;
  esac
}

# A missing tool must say which tool and why, not exit 127 from a subshell.
# CI once failed this way because uv happened to be installed on the machine
# where the gate was written and absent on the runner.
require_command() {
  local name="$1" reason="$2"
  if ! command -v "${name}" >/dev/null 2>&1; then
    echo "required tool '${name}' is not installed: ${reason}" >&2
    exit 1
  fi
}

verify_sha256() {
  local file="$1" expected="$2" actual
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${file}" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "${file}" | awk '{print $1}')"
  fi
  if [ "${actual}" != "${expected}" ]; then
    echo "digest mismatch for ${file}: expected ${expected}, got ${actual}" >&2
    exit 1
  fi
}

ensure_gitleaks() {
  local platform version tag asset expected binary archive
  platform="$(detect_platform)"
  version="$(read_lock tools gitleaks version)"
  tag="$(read_lock tools gitleaks releaseTag)"
  asset="$(read_lock tools gitleaks assets "${platform}" name)"
  expected="$(read_lock tools gitleaks assets "${platform}" sha256)"
  binary="${cache_directory}/gitleaks-${version}-${platform}/gitleaks"

  if [ ! -x "${binary}" ]; then
    mkdir -p "$(dirname "${binary}")"
    archive="${cache_directory}/${asset}"
    curl -sSfL -o "${archive}" \
      "https://github.com/$(read_lock tools gitleaks repository)/releases/download/${tag}/${asset}"
    verify_sha256 "${archive}" "${expected}"
    tar -xzf "${archive}" -C "$(dirname "${binary}")" gitleaks
    rm -f "${archive}"
  fi

  echo "${binary}"
}

command="${1:-verify}"

case "${command}" in
  verify)
    require_command curl "the pinned Gitleaks release is fetched over HTTPS"
    require_command uv "Semgrep is resolved from tools/security/uv.lock"
    binary="$(ensure_gitleaks)"
    "${binary}" version
    uv run --frozen --project "${repository_root}/tools/security" semgrep --version
    echo "security toolchain verified against tools/security/toolchain.lock"
    ;;
  semgrep-scan)
    require_command uv "Semgrep is resolved from tools/security/uv.lock"
    uv run --frozen --project "${repository_root}/tools/security" semgrep scan \
      --config "${repository_root}/tools/security/semgrep.yml" \
      --error \
      --quiet \
      "${repository_root}/src" "${repository_root}/tests" "${repository_root}/tools"
    ;;
  gitleaks-scan)
    require_command curl "the pinned Gitleaks release is fetched over HTTPS"
    binary="$(ensure_gitleaks)"
    "${binary}" git "${repository_root}" --redact --no-banner --exit-code 1
    ;;
  *)
    echo "usage: verify-toolchain.sh [verify|semgrep-scan|gitleaks-scan]" >&2
    exit 2
    ;;
esac
