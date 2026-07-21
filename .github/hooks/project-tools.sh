#!/usr/bin/env bash

set -euo pipefail

state_directory="${TARDIGRADE_HOOK_STATE_DIR:-$HOME/.local/state/tardigrade}"
ready_marker="$state_directory/project-tools-ready"
install_prefix="${TARDIGRADE_HOOK_INSTALL_PREFIX:-$HOME/.local}"
installed_pnpm_path="$install_prefix/bin/pnpm"
cloud_agent="${TARDIGRADE_CLOUD_HOOKS:-${GITHUB_COPILOT_API_TOKEN:+true}}"

find_pnpm_path() {
	local pnpm_path

	pnpm_path="$(command -v pnpm || true)"
	if [[ -n "$pnpm_path" ]]; then
		printf '%s\n' "$pnpm_path"
		return
	fi

	if [[ "$cloud_agent" == "true" && -x "$installed_pnpm_path" ]]; then
		printf '%s\n' "$installed_pnpm_path"
		return
	fi

	return 1
}

install_pnpm() {
	local architecture
	local package_manager="$1"
	local pnpm_version="${package_manager#pnpm@}"

	if npm install --global --prefix "$install_prefix" --fetch-retries=0 --fetch-timeout=15000 -- "$package_manager" &&
		[[ -x "$installed_pnpm_path" ]]; then
		return
	fi

	case "$(uname -m)" in
		x86_64)
			architecture="x64"
			;;
		aarch64 | arm64)
			architecture="arm64"
			;;
		*)
			return 1
			;;
	esac

	# Cloud hooks can reach immutable GitHub release assets even when npm is blocked.
	mkdir -p "$install_prefix/bin"
	curl --fail --location --silent --show-error --connect-timeout 10 --max-time 120 \
		"https://github.com/pnpm/pnpm/releases/download/v${pnpm_version}/pnpm-linux-${architecture}.tar.gz" |
		tar -xz -C "$install_prefix/bin" pnpm
	chmod +x "$installed_pnpm_path"
}

setup_project_tools() {
	local package_manager
	local pnpm_path

	if [[ "$cloud_agent" != "true" ]]; then
		return
	fi

	rm -f -- "$ready_marker"

	if ! pnpm_path="$(find_pnpm_path)"; then
		package_manager="$(jq -r '.packageManager' package.json)"
		if [[ ! "$package_manager" =~ ^pnpm@[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
			return 1
		fi

		install_pnpm "$package_manager"
		pnpm_path="$installed_pnpm_path"
	fi

	if [[ ! -x node_modules/.bin/biome || ! -x node_modules/.bin/tsc ]]; then
		"$pnpm_path" install --frozen-lockfile
	fi

	if [[ ! -x node_modules/.bin/biome || ! -x node_modules/.bin/tsc ]]; then
		return 1
	fi

	mkdir -p "$state_directory"
	touch "$ready_marker"
}

resolve_project_pnpm() {
	local pnpm_path
	local required_tool="$1"

	if ! pnpm_path="$(find_pnpm_path)"; then
		return 1
	fi

	if [[ ! -x "node_modules/.bin/$required_tool" ]]; then
		return 1
	fi

	if [[ "$cloud_agent" == "true" && ! -f "$ready_marker" ]]; then
		return 1
	fi

	printf '%s\n' "$pnpm_path"
}

case "${1:-}" in
	resolve)
		resolve_project_pnpm "$2"
		;;
	setup)
		setup_project_tools
		;;
	*)
		echo "Usage: $0 {resolve <tool>|setup}" >&2
		exit 2
		;;
esac
