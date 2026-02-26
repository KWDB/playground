#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
用法:
  sync_atomgit_release.sh --tag <tag> --github-owner <owner> --github-repo <repo> --atomgit-owner <owner> --atomgit-repo <repo>

环境变量:
  ATOMGIT_TOKEN            Atomgit API Token
  ATOMGIT_ACCESS_TOKEN     Atomgit API Token (可选)
  GITCODE_TOKEN            Atomgit API Token (可选)
  ATOMGIT_AUTH_HEADER      认证 Header 名称（可选，例如 Authorization 或 Private-Token）
  ATOMGIT_AUTH_SCHEME      认证 Scheme（可选，例如 token 或 Bearer，仅对 Authorization 生效）
  ATOMGIT_AUTH_MODE        认证方式（可选，header 或 query，默认自动）
参数:
  --atomgit-token          Atomgit API Token
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "缺少依赖: $1" >&2; exit 1; }
}

require_cmd gh
require_cmd jq
require_cmd curl

TAG=""
GITHUB_OWNER=""
GITHUB_REPO=""
ATOMGIT_OWNER=""
ATOMGIT_REPO=""
ATOMGIT_TOKEN_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --github-owner)
      GITHUB_OWNER="${2:-}"
      shift 2
      ;;
    --github-repo)
      GITHUB_REPO="${2:-}"
      shift 2
      ;;
    --atomgit-owner)
      ATOMGIT_OWNER="${2:-}"
      shift 2
      ;;
    --atomgit-repo)
      ATOMGIT_REPO="${2:-}"
      shift 2
      ;;
    --atomgit-token)
      ATOMGIT_TOKEN_ARG="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$TAG" || -z "$GITHUB_OWNER" || -z "$GITHUB_REPO" || -z "$ATOMGIT_OWNER" || -z "$ATOMGIT_REPO" ]]; then
  usage
  exit 1
fi

ATOM_TOKEN="${ATOMGIT_TOKEN_ARG:-${ATOMGIT_TOKEN:-${ATOMGIT_ACCESS_TOKEN:-${GITCODE_TOKEN:-}}}}"
if [[ -z "$ATOM_TOKEN" ]]; then
  echo "必须设置 Atomgit Token（--atomgit-token 或 ATOMGIT_TOKEN/ATOMGIT_ACCESS_TOKEN/GITCODE_TOKEN）" >&2
  exit 1
fi

raw_token="$ATOM_TOKEN"
case "$ATOM_TOKEN" in
  token\ *) raw_token="${ATOM_TOKEN#token }" ;;
  Bearer\ *) raw_token="${ATOM_TOKEN#Bearer }" ;;
esac

auth_headers=()
if [[ -n "${ATOMGIT_AUTH_HEADER:-}" ]]; then
  if [[ "${ATOMGIT_AUTH_HEADER}" == "Authorization" ]]; then
    scheme="${ATOMGIT_AUTH_SCHEME:-Bearer}"
    auth_headers+=("Authorization: ${scheme} ${raw_token}")
  else
    auth_headers+=("${ATOMGIT_AUTH_HEADER}: ${raw_token}")
  fi
else
  auth_headers+=("Private-Token: ${raw_token}")
  auth_headers+=("Authorization: Bearer ${raw_token}")
  auth_headers+=("Authorization: token ${raw_token}")
fi

auth_mode="${ATOMGIT_AUTH_MODE:-auto}"
token_query="access_token=$(printf '%s' "$raw_token" | jq -sRr @uri)"

release_json="$(gh release view "$TAG" -R "${GITHUB_OWNER}/${GITHUB_REPO}" --json tagName,name,body,targetCommitish,assets)"

tag_name="$(jq -r '.tagName' <<<"$release_json")"
release_name="$(jq -r '.name // empty' <<<"$release_json")"
release_body="$(jq -r '.body // empty' <<<"$release_json")"
target_commitish="$(jq -r '.targetCommitish // empty' <<<"$release_json")"

payload="$(jq -n \
  --arg tag_name "$tag_name" \
  --arg name "$release_name" \
  --arg body "$release_body" \
  --arg target_commitish "$target_commitish" \
  '{tag_name:$tag_name,name:$name,body:$body,target_commitish:$target_commitish}')"

create_body=""
create_code=""
auth_header_used=""
query_used=""

try_create_release() {
  local url="$1"
  local header="${2:-}"
  if [[ -n "$header" ]]; then
    create_resp="$(curl -sS -w "\n%{http_code}" -X POST \
      "$url" \
      -H "Accept: application/json" \
      -H "$header" \
      -H "Content-Type: application/json" \
      -d "$payload")"
  else
    create_resp="$(curl -sS -w "\n%{http_code}" -X POST \
      "$url" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json" \
      -d "$payload")"
  fi
  create_body="${create_resp%$'\n'*}"
  create_code="${create_resp##*$'\n'}"
}

api_base="https://api.atomgit.com/api/v5/repos/${ATOMGIT_OWNER}/${ATOMGIT_REPO}"
if [[ "$auth_mode" == "query" || "$auth_mode" == "auto" ]]; then
  try_create_release "${api_base}/releases?${token_query}"
  if [[ "$create_code" == "200" || "$create_code" == "201" || "$create_code" == "409" || "$create_code" == "422" || ("$create_code" == "400" && "$create_body" == *"Release already exists"*) ]]; then
    query_used="$token_query"
    if [[ "$create_code" == "400" ]]; then
      echo "Release 已存在，继续上传附件..."
    fi
  elif [[ "$create_code" != "404" || "$create_body" != *"token not found"* ]]; then
    echo "创建 Atomgit Release 失败: ${create_code} ${create_body}" >&2
    exit 1
  fi
fi

if [[ -z "$query_used" ]]; then
  for header in "${auth_headers[@]}"; do
    try_create_release "${api_base}/releases" "$header"
    if [[ "$create_code" == "200" || "$create_code" == "201" || "$create_code" == "409" || "$create_code" == "422" || ("$create_code" == "400" && "$create_body" == *"Release already exists"*) ]]; then
      auth_header_used="$header"
      if [[ "$create_code" == "400" ]]; then
        echo "Release 已存在，继续上传附件..."
      fi
      break
    fi
    if [[ "$create_code" == "404" && "$create_body" == *"token not found"* ]]; then
      continue
    fi
    echo "创建 Atomgit Release 失败: ${create_code} ${create_body}" >&2
    exit 1
  done
fi

if [[ -z "$auth_header_used" && -z "$query_used" ]]; then
  echo "创建 Atomgit Release 失败: 404 token not found" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

gh release download "$TAG" -R "${GITHUB_OWNER}/${GITHUB_REPO}" -D "$tmp_dir" --pattern "*"

shopt -s nullglob
for file in "$tmp_dir"/*; do
  [[ -f "$file" ]] || continue
  filename="$(basename "$file")"
  encoded_name="$(printf '%s' "$filename" | jq -sRr @uri)"
  upload_url_path="${api_base}/releases/${tag_name}/upload_url?file_name=${encoded_name}"
  if [[ -n "$query_used" ]]; then
    upload_url_path="${upload_url_path}&${query_used}"
  fi
  if [[ -n "$auth_header_used" ]]; then
    upload_meta_resp="$(curl -sS -w "\n%{http_code}" -X GET \
      "${upload_url_path}" \
      -H "Accept: application/json" \
      -H "${auth_header_used}")"
  else
    upload_meta_resp="$(curl -sS -w "\n%{http_code}" -X GET \
      "${upload_url_path}" \
      -H "Accept: application/json")"
  fi
  upload_meta_body="${upload_meta_resp%$'\n'*}"
  upload_meta_code="${upload_meta_resp##*$'\n'}"

  if [[ "$upload_meta_code" != "200" && "$upload_meta_code" != "201" ]]; then
    echo "获取上传地址失败: ${filename} ${upload_meta_code} ${upload_meta_body}" >&2
    exit 1
  fi

  upload_url="$(jq -r '.url' <<<"$upload_meta_body")"
  if [[ -z "$upload_url" || "$upload_url" == "null" ]]; then
    echo "上传地址为空: ${filename}" >&2
    exit 1
  fi

  curl_args=()
  while IFS= read -r header; do
    [[ -n "$header" ]] && curl_args+=(-H "$header")
  done < <(jq -r '.headers | to_entries[] | "\(.key): \(.value)"' <<<"$upload_meta_body")

  if [[ "${#curl_args[@]}" -eq 0 ]]; then
    echo "上传头为空: ${filename}" >&2
    exit 1
  fi

  upload_code="$(curl -sS -o /dev/null -w "%{http_code}" -X PUT "$upload_url" \
    "${curl_args[@]}" \
    --data-binary "@${file}")"

  if [[ "$upload_code" != "200" && "$upload_code" != "204" ]]; then
    echo "上传失败: ${filename} ${upload_code}" >&2
    exit 1
  fi
done

echo "同步完成: ${tag_name}"
