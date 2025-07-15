#!/bin/sh

cd /usr/local/bin

for i in `ls /usr/local/rampart/bin/` ; do
    if [ ! -e /usr/local/bin/$i ] ; then 
        ln -s /usr/local/rampart/bin/$i /usr/local/bin/$i
    fi
done

cd /usr/local/rampart/

chown -R nobody /usr/local/rampart/web_server

if [ ! -e /usr/local/rampart/web_server/data ]; then 
    ln -s /data /usr/local/rampart/web_server/data
    mkdir /data/certs
    ln -s /data/certs /usr/local/rampart/web_server/certs
    chown -R nobody /data
fi

/usr/local/rampart/shse-server.sh "$@"

if [ -t 0 ]; then
  echo "🖥️ TTY detected: launching shell."
  exec /bin/bash
else
  echo "⏳ Non-interactive mode: keeping container alive."
  # Block forever so container stays alive
  tail -f /dev/null
fi
