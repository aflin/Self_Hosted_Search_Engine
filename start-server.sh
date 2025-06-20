#!/bin/bash

die(){
    echo -e "$1";
    exit 1;
}


SSOURCE==$(readlink -- "${BASH_SOURCE[0]}")
SDIR=$(dirname "${SSOURCE}")
WDIR="${SDIR}/web_server"
CERT="${WDIR}/self-cert.pem"
KEY="${WDIR}/self-key.pem"
CONF="${WDIR}/self-cert.conf"

if [ "`whoami`" != "root" ] ; then
    echo "this tool must be run with sudo or as root"
    exit 1;
fi

if [ -e "${SDIR}/rampart/bin/rampart" ] ; then
    RAMPART="${SDIR}/rampart/bin/rampart"
fi

if [ "$RAMPART" != "" ]; then
    if [ ! -e $RAMPART ] ; then 
        die "$RAMPART does not exist";
    fi
else
    RAMPART=`which rampart`;
    if [ "$RAMPART" == "" ]; then
        die "Cannot find rampart executable\nYou can provide it by running with:\n  RAMPART='path/to/rampart' start-server.sh";
    fi
fi

RAMPARTDIR=$(dirname "${RAMPART}")

if [ ! -e ${CERT} ] ; then
    echo "Creating self signed certificate request"
    cat > ${CONF} <<ENDOFFILE
[CA_default]
copy_extensions = copy

[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = req_distinguished_name
x509_extensions = v3_ca

[req_distinguished_name]
C = US
ST = California
L = San Francisco
O = SHSE
OU = SHSE
emailAddress = shse@shse.none
CN = shse.none

[v3_ca]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
subjectAltName = @alternate_names

[alternate_names]
DNS.1 = localhost
DNS.2 = *.localhost
ENDOFFILE

    echo "Creating self signed certificate and server key"

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ${KEY} -out ${CERT} -config ${CONF} || die "openssl error"
fi

id nobody &>/dev/null || {
    echo "User nobody does not exist on this machine"
    echo "Please add the user nobody or edit web_server/web_server_conf.js and provide another unprivileged user."
    echo "If providing another user, change file permissions to that user with \"chown -R uname .\"."
    die "Server Start Failed"
}

chown -R nobody . || {
    echo "could not change ownership of the current directory to \"nobody\"."
    die "Server Start Failed"
}

echo "Starting web server"
#make sure texislockd is running (can fail if not in path)
$RAMPARTDIR/texislockd
$RAMPART web_server/web_server_conf.js || {
    die "Server Start Failed"
}
