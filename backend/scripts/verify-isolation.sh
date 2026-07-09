#!/usr/bin/env bash
#
# Prove that user A cannot read or mutate user B's data.
#
# Run against Strapi DIRECTLY, never through the Next.js proxy — the proxy is not
# the boundary. Assumes `node scripts/seed-dev.js --reset` has run and Strapi is
# listening.
#
# Usage:
#   STRAPI=http://localhost:1337 ./scripts/verify-isolation.sh
#
# Every curl uses -g (--globoff). curl otherwise treats `[` and `]` in a URL as
# glob metacharacters and fails with exit 3 before sending anything, which looks
# exactly like an empty response.
#
# Exits non-zero on the first failure.

set -uo pipefail

STRAPI="${STRAPI:-http://localhost:1337}"
PASSWORD="${SEED_PASSWORD:-seedpassword123}"
TYPES=(todos projects practice-logs system-settings)

pass=0
fail=0

ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=$((fail+1)); }

jqp() { python3 -c "import sys,json
try: d=json.load(sys.stdin)
except Exception: print(''); raise SystemExit
$1" 2>/dev/null; }

login() {
  curl -sg -X POST "$STRAPI/api/auth/local" -H 'Content-Type: application/json' \
    -d "{\"identifier\":\"$1\",\"password\":\"$PASSWORD\"}" | jqp 'print(d.get("jwt",""))'
}

# $1 token, $2 path
status() { curl -sg -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $1" "$STRAPI$2"; }

count_rows() {
  curl -sg -H "Authorization: Bearer $1" "$STRAPI/api/$2?pagination[pageSize]=100" \
    | jqp 'print(len(d.get("data") or []))'
}

first_doc() {
  curl -sg -H "Authorization: Bearer $1" "$STRAPI/api/$2?pagination[pageSize]=1" \
    | jqp 'r=d.get("data") or []
print(r[0]["documentId"] if r else "")'
}

echo
echo "Strapi: $STRAPI"
echo

# --- 0. Login still works. An unguarded document-service middleware breaks this,
#        because the users-permissions plugin itself calls the document service.
A=$(login seed_alice)
B=$(login seed_bob)
[ -n "$A" ] && ok "login as seed_alice (users-permissions routes through the document service)" \
            || { bad "login as seed_alice FAILED — the middleware likely broke login"; exit 1; }
[ -n "$B" ] && ok "login as seed_bob" || { bad "login as seed_bob"; exit 1; }
BID=$(curl -sg -H "Authorization: Bearer $B" "$STRAPI/api/users/me" | jqp 'print(d.get("id",""))')
echo

echo "Reads are scoped:"
for t in "${TYPES[@]}"; do
  na=$(count_rows "$A" "$t"); nb=$(count_rows "$B" "$t")
  if [ -n "$na" ] && [ -n "$nb" ] && [ "$na" -gt 0 ] && [ "$nb" -gt 0 ]; then
    ok "$t — alice sees $na, bob sees $nb (neither sees the other's)"
  else
    bad "$t — alice='$na' bob='$nb' (expected both > 0; zero means over-filtering)"
  fi
done
echo

echo "findOne is scoped:"
for t in "${TYPES[@]}"; do
  bdoc=$(first_doc "$B" "$t")
  [ -z "$bdoc" ] && { bad "$t — could not resolve one of bob's documentIds"; continue; }
  code=$(status "$A" "/api/$t/$bdoc")
  [ "$code" = "404" ] && ok "$t — alice GET bob's row → $code" \
                      || bad "$t — alice GET bob's row → $code (expected 404)"
done
echo

# `update` and `clone` do NOT accept `filters` (see their Params types), so a
# filter-only middleware would silently allow these. They are authorized by lookup.
echo "Writes are scoped (update ignores filters — must be checked by lookup):"
for t in "${TYPES[@]}"; do
  bdoc=$(first_doc "$B" "$t")
  [ -z "$bdoc" ] && continue
  code=$(curl -sg -o /dev/null -w '%{http_code}' -X PUT "$STRAPI/api/$t/$bdoc" \
    -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"data":{}}')
  [ "$code" = "404" ] && ok "$t — alice PUT bob's row → $code" \
                      || bad "$t — alice PUT bob's row → $code (expected 404)"
done
echo

echo "Deletes are scoped:"
for t in "${TYPES[@]}"; do
  bdoc=$(first_doc "$B" "$t")
  [ -z "$bdoc" ] && continue
  code=$(curl -sg -o /dev/null -w '%{http_code}' -X DELETE "$STRAPI/api/$t/$bdoc" -H "Authorization: Bearer $A")
  [ "$code" = "404" ] && ok "$t — alice DELETE bob's row → $code" \
                      || bad "$t — alice DELETE bob's row → $code (expected 404)"
done
echo

# The middleware $and-merges rather than spreading, so a caller cannot override
# the owner predicate with their own.
echo "A client-supplied owner filter cannot widen the scope:"
n=$(curl -sg -H "Authorization: Bearer $A" "$STRAPI/api/todos?filters[owner][id][\$eq]=$BID" \
    | jqp 'print(len(d.get("data") or []))')
[ "$n" = "0" ] && ok "alice filtering for bob's owner id → 0 rows" \
               || bad "alice filtering for bob's owner id → '$n' rows (expected 0)"
echo

echo "Unauthenticated access fails closed:"
for t in "${TYPES[@]}"; do
  code=$(curl -sg -o /dev/null -w '%{http_code}' "$STRAPI/api/$t")
  case "$code" in
    401|403) ok "$t — anonymous → $code" ;;
    *)       bad "$t — anonymous → $code (expected 401/403)" ;;
  esac
done
echo

echo "Create is owned by the caller:"
# `owner` is private, so the content API rejects it in a request body before the
# middleware is even consulted. Belt and braces.
code=$(curl -sg -o /dev/null -w '%{http_code}' -X POST "$STRAPI/api/todos" \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d "{\"data\":{\"title\":\"probe\",\"completed\":false,\"recurrenceType\":\"none\",\"owner\":$BID}}")
[ "$code" = "400" ] && ok "alice naming bob as owner → $code (private field rejected)" \
                    || bad "alice naming bob as owner → $code (expected 400)"

newdoc=$(curl -sg -X POST "$STRAPI/api/todos" \
  -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"data":{"title":"[seed] ownership probe","completed":false,"recurrenceType":"none"}}' \
  | jqp 'print((d.get("data") or {}).get("documentId",""))')
if [ -n "$newdoc" ]; then
  a=$(status "$A" "/api/todos/$newdoc"); b=$(status "$B" "/api/todos/$newdoc")
  [ "$a" = "200" ] && [ "$b" = "404" ] \
    && ok "alice's new todo is hers alone (alice:$a bob:$b)" \
    || bad "new todo visibility wrong (alice:$a bob:$b)"
  curl -sg -o /dev/null -X DELETE "$STRAPI/api/todos/$newdoc" -H "Authorization: Bearer $A"
else
  bad "could not create a probe todo as alice"
fi

echo
echo "─────────────────────────────"
printf '  passed: %d   failed: %d\n\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
