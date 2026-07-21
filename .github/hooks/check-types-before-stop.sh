#!/usr/bin/env bash

set -euo pipefail

if ! pnpm_path="$(bash .github/hooks/project-tools.sh resolve tsc)"; then
	jq -n '{decision:"allow"}'
	exit
fi

if check_output="$("$pnpm_path" run check-types 2>&1)"; then
	jq -n '{decision:"allow"}'
else
	jq -n --arg reason "$check_output" '{decision:"block", reason: $reason}'
fi
