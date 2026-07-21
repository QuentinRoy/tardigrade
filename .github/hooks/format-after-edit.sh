#!/usr/bin/env bash

set -euo pipefail

pnpm_path="$(bash .github/hooks/project-tools.sh resolve biome)" || exit 0
file_path="$(jq -r '.tool_input.file_path // .tool_input.path // .tool_input.target_file // empty')"

if [[ -z "$file_path" ]]; then
	"$pnpm_path" run check --fix
	exit
fi

case "$file_path" in
	*.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.jsonc)
		"$pnpm_path" run check --write -- "$file_path"
		;;
esac
