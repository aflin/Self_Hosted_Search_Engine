#!/bin/bash
#
# Refresh what the docker images are built from:
#
#   1. the trimmed rampart runtime under dockerfiles/{amd64,arm64}/rampart,
#      taken from the official release tarballs on rampart.dev
#   2. the shse server itself (web_server/ and shse-server.sh), copied from
#      this repository
#
# Run this, look at `git status`, then run ./build-multiarch-glibc.sh.
#
#   ./update-vendored.sh                 # rampart $RAMPART_VERSION and the web files
#   ./update-vendored.sh --web-only      # just re-copy web_server/ and shse-server.sh
#   RAMPART_VERSION=0.7.6 ./update-vendored.sh
#
# Tarballs are kept in docker/.cache (git-ignored) so a second run is offline.

set -euo pipefail

RAMPART_VERSION=${RAMPART_VERSION:-0.7.5}
# The glibc flavour of the release build.  2_28 matches the libstdc++ that
# is shipped alongside in dockerfiles/<arch>/.
GLIBC=${GLIBC:-2_28}
BASE_URL=${RAMPART_BASE_URL:-https://rampart.dev/downloads/rampart-${RAMPART_VERSION}}

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(dirname "$HERE")
CACHE="$HERE/.cache"
WEB_ONLY=0
[ "${1:-}" = "--web-only" ] && WEB_ONLY=1

die() { echo "error: $*" >&2; exit 1; }

# docker arch name -> rampart release arch name
relarch() { case "$1" in amd64) echo x86_64 ;; arm64) echo arm64 ;; esac; }

# What shse needs from a full rampart install.  Everything else (python,
# the ide, langtools, node shims ...) stays out of the image.
BINS="rampart texislockd tsql kdbfchk addtable metamorph rex"
MODS="rampart-crypto.so rampart-curl.so rampart-server.so rampart-sql.so
      rampart-sqlUpdate.js rampart-webserver.js"
# licenses for what is actually in the trimmed runtime
LICS="astronomy_c-mit-license.txt cmark-license.txt curl-license.txt
      cvs-parser-in-c-license.txt date-holidays-license-isc.txt
      derivations-license.txt duktape-AUTHORS.rst duktape-license.txt
      entities.c-license.txt libevent-license.txt libevhtp_ws-license.txt
      linenoise-license.txt lmdb-license.txt mpaland-printf-license.txt
      nghttp2-license.txt openssl-license.txt python-license.txt
      robotstxt-license.txt setproctitle-license.txt
      texis-abseil-license.txt texis-cre2-license.txt
      texis-jansson-license.txt texis-re2-license.txt
      texis-usearch-license.txt tidy-html5-license.txt upa-license.txt
      utf8proc-license.md whereami-license-mit.txt
      whereami-license-wtfplv2.txt"

fetch_rampart() {
    local arch=$1 rel tb url want got
    rel=$(relarch "$arch")
    tb="rampart-${RAMPART_VERSION}-linux-${GLIBC}-${rel}.tar.gz"
    url="$BASE_URL/$tb"
    mkdir -p "$CACHE"
    if [ ! -s "$CACHE/$tb" ]; then
        echo "downloading $url"
        curl -fSL --proto =https -o "$CACHE/$tb.part" "$url" || die "download failed: $url"
        mv "$CACHE/$tb.part" "$CACHE/$tb"
    fi
    curl -fsSL --proto =https -o "$CACHE/$tb.sha1" "$url.sha1" 2>/dev/null \
        || [ -s "$CACHE/$tb.sha1" ] || die "cannot get $url.sha1"
    want=$(awk '{print $1}' "$CACHE/$tb.sha1")
    got=$(sha1sum "$CACHE/$tb" | awk '{print $1}')
    [ "$want" = "$got" ] || die "sha1 mismatch for $tb (delete $CACHE/$tb and retry)"
    echo "verified   $tb"

    local dest="$HERE/dockerfiles/$arch/rampart" tmp
    tmp=$(mktemp -d)
    # extract only what is wanted
    local want_paths=() f
    for f in $BINS; do want_paths+=("rampart/bin/$f"); done
    for f in $MODS; do want_paths+=("rampart/modules/$f"); done
    for f in $LICS; do want_paths+=("rampart/licenses/$f"); done
    want_paths+=("rampart/LICENSE" "rampart/LICENSE-tsal.txt" "rampart/derivations/en/en-deriv")
    tar xzf "$CACHE/$tb" -C "$tmp" "${want_paths[@]}" || die "$tb does not hold everything expected"

    rm -rf "$dest/bin" "$dest/modules" "$dest/licenses" "$dest/derivations" "$dest/LICENSE" "$dest/LICENSE-tsal.txt"
    mkdir -p "$dest"
    cp -a "$tmp/rampart/." "$dest/"
    rm -rf "$tmp"
    echo "$RAMPART_VERSION linux-${GLIBC}-${rel}" > "$dest/RAMPART_VERSION"
    echo "installed  rampart $RAMPART_VERSION ($rel) -> dockerfiles/$arch/rampart"
}

# Copy the server from the repo.  Only named, known files: the working
# tree's web_server/ also holds certificates, keys, logs, databases and
# editor backups, none of which may end up in an image.
sync_web() {
    local arch=$1 dest="$HERE/dockerfiles/$arch/rampart" f
    rm -rf "$dest/web_server"
    mkdir -p "$dest/web_server/apps" "$dest/web_server/lib" "$dest/web_server/logs"

    cp "$REPO/web_server/apps/shse.js"            "$dest/web_server/apps/"
    cp "$REPO"/web_server/lib/*.js                "$dest/web_server/lib/"
    cp "$REPO/web_server/public_suffix_list.dat"  "$dest/web_server/"
    cp "$REPO/web_server/logs/.gitignore"         "$dest/web_server/logs/"
    # inside a container, httpOnly mode listens on 80
    sed 's/^var httpOnlyPort=.*/var httpOnlyPort=80;/' \
        "$REPO/web_server/web_server_conf.js" > "$dest/web_server/web_server_conf.js"
    grep -q '^var httpOnlyPort=80;' "$dest/web_server/web_server_conf.js" \
        || die "could not set httpOnlyPort in web_server_conf.js"

    # html: the files git tracks, and new ones not yet added, minus editor
    # backups and jquery-ui themes that are not in use
    (cd "$REPO" && git ls-files -z --cached --others --exclude-standard web_server/html) | while IFS= read -r -d '' f; do
        case "$f" in
            web_server/html/css/themes/pepper-grinder/*) continue ;;
            *~|*.bak|*.orig|*/DEADJOE) continue ;;
        esac
        [ -e "$REPO/$f" ] || continue   # tracked but deleted in the working tree
        mkdir -p "$dest/$(dirname "$f")"
        cp -P "$REPO/$f" "$dest/$f"
    done

    cp "$REPO/shse-server.sh" "$dest/shse-server.sh"
    chmod +x "$dest/shse-server.sh" "$dest/web_server/apps/shse.js" "$dest/web_server/web_server_conf.js"
    echo "copied     web_server -> dockerfiles/$arch/rampart"
}

for arch in amd64 arm64; do
    [ $WEB_ONLY -eq 1 ] || fetch_rampart "$arch"
    sync_web "$arch"
done

echo
echo "Done.  Review with: git status --short docker/"
