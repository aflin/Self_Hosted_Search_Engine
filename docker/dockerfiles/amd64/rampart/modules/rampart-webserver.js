"noTranspile";
/* When running from a single-file bundle (process.scriptPath === ':zip:'),
   writable defaults (logs, dataRoot, runtime pid files) cannot live inside
   the zip.  Substitute the directory next to the bundle binary so the user's
   web_server_conf.js doesn't need to know whether it's bundled or not.
   Read-only paths (htmlRoot, appsRoot, wsappsRoot) stay as ':zip:/...'. */
function _writableWd(wd) {
    if (wd !== ':zip:') return wd;
    var argv0 = process.argv0 || '';
    var rp = rampart.utils.realPath(argv0);
    if (!rp) return rampart.utils.getcwd();
    var idx = rp.lastIndexOf('/');
    if (idx < 0) return rampart.utils.getcwd();
    return rp.substring(0, idx);
}

var defaultServerConf = function(wd){
    var ww = _writableWd(wd);
    return {
        ipAddr:       '127.0.0.1',
        ipv6Addr:     '[::1]',
        bindAll:        false,
        ipPort:         8088,
        ipv6Port:       8088,
        port:           -1,
        redirPort:      -1,
        redir:          false,
        htmlRoot:       wd + '/html',
        appsRoot:       wd + '/apps',
        wsappsRoot:     wd + '/wsapps',
        dataRoot:       ww + '/data',
        logRoot:        ww + '/logs',
        accessLog:      ww + '/logs/access.log',
        errorLog:       ww + '/logs/error.log',
        log:            true,
        rotateLogs:     false,
        rotateInterval: 86400,
        rotateStart:    '00:00',
        rotateCount:    30,
        user:           'nobody',
        threads:        -1,
        sslKeyFile:     '',
        sslCertFile:    '',
        secure:         false,
        developerMode:  true,
        letsencrypt:    '',
        rootScripts:    false,
        directoryFunc:  false,
        monitor:        false,
        daemon:         true,
        scriptTimeout:  20,
        connectTimeout: 20,
        quickserver:    false,
        appendProcTitle:false,
        beginFunc:      false,
        beginFuncOnFile:false,
        endFunc:        false,
        irohProxy:      false,
        selfSign:       false,
        defaultCharset: "utf-8",
        serverRoot:     wd
    }
}

var defaultQuickServerConf = function(wd){
    return {
        ipAddr:         '127.0.0.1',
        ipv6Addr:       '[::1]',
        bindAll:        false,
        ipPort:         8088,
        ipv6Port:       8088,
        port:           -1,
        redirPort:      -1,
        redir:          false,
        htmlRoot:       wd + '/',
        appsRoot:       '',
        wsappsRoot:     '',
        dataRoot:       '',
        logRoot:        wd+'/logs',
        accessLog:      "",
        errorLog:       "",
        log:            false,
        rotateLogs:     false,
        rotateInterval: 86400,
        rotateStart:    '00:00',
        rotateCount:    30,
        user:           'nobody',
        threads:        1,
        sslKeyFile:     '',
        sslCertFile:    '',
        secure:         false,
        developerMode:  true,
        letsencrypt:    '',
        rootScripts:    false,
        directoryFunc:  true,
        monitor:        false,
        daemon:         false,
        scriptTimeout:  20,
        connectTimeout: 20,
        quickserver:    true,
        appendProcTitle:false,
        beginFunc:      false,
        beginFuncOnFile:false,
        endFunc:        false,
        irohProxy:      false,
        selfSign:       false,
        defaultCharset: "utf-8",
        serverRoot:     wd
    }
}

var optlist = {
'--ipAddr':         'String. The ipv4 address to bind',
'--ipv6Addr':       'String. The ipv6 address to bind',
'--bindAll':        'Bool.   Set ipAddr and ipv6Addr to \'0.0.0.0\' and \'[::]\' respectively',
'--ipPort':         'Number. Set ipv4 port',
'--ipv6Port':       'Number. Set ipv6 port',
'--port':           'Number. Set both ipv4 and ipv6 port',
'--redirPort':      'Number. Listen on this port and 301-redirect to the https server (in-process)',
'--redir':          'Bool.   Equivalent to --redirPort 80',
'--htmlRoot':       'String. Root directory from which to serve files',
'--appsRoot':       'String. Root directory from which to serve apps',
'--wsappsRoot':     'String. Root directory from which to serve wsapps',
'--dataRoot':       'String. Setting for user scripts',
'--logRoot':        'String. Log directory (created if missing)',
'--accessLog':      'String. Log file name. "" for stdout',
'--errorLog':       'String. error log file name. "" for stderr',
'--irohProxy':      'Bool.   Start the iroh webproxy server for this server',
'--selfSign':       'Bool.   Whether to auto generate a self signed https cert',
'--log':            'Bool.   Whether to log requests and errors',
'--rotateLogs':     'Bool.   Whether to rotate the logs',
'--rotateInterval': 'Number. Interval between log rotations in seconds',
'--rotateStart':    'String. Time to start log rotations',
'--rotateCount':    'Number. Maximum number of old log files to keep (default 30)',
'--user':           'String. If started as root, switch to this user',
'--threads':        'Number. Limit the number of threads used by the server.\n                     Default (-1) is the number of cores on the system',
'--sslKeyFile':     'String. If https, the ssl/tls key file location',
'--sslCertFile':    'String. If https, the ssl/tls cert file location',
'--secure':         'Bool.   Whether to use https.  If true sslKeyFile and sslCertFile must be set',
'--developerMode':  'Bool.   Whether script errors result in 500 and return a stack trace.  Otherwise 404',
'--letsencrypt':    'String. If using letsencrypt, the \'domain.tld\' name for automatic setup of https\n'+
'                     (assumes --secure true and looks for \'/etc/letsencrypt/live/domain.tld/\' directory)\n' +
'                     (if redir is set, also map ./letsencrypt_wd/.well-known/ --> http://mydom.com/.well-known/)\n' +
'                     (if set to "setup", don\'t start https server, but do map ".well-known/" for http)\n' +
'                     (sets port:443 unless set otherwise)',
'--rootScripts':    'Bool.   Whether to treat *.js files in htmlRoot as apps (not secure)',
'--directoryFunc':  'Bool.   Whether to provide a directory listing if no index.html is found',
'--daemon':         'Bool.   whether to detach from terminal',
'--monitor':        'Bool.   whether to launch monitor process to auto restart server if killed or crashes',
'--scriptTimeout':  'Number  Max time to wait for a script module to return a reply in seconds (default 20)',
'--connectTimeout': 'Number  Max time to wait for client send request in seconds (default 20)',
'--defaultCharset': 'String. Charset appended to text/* Content-Type headers (default "utf-8").\n' +
'                     Use "false" to disable.  Applies to static files and dynamic responses.',
'-d':               'alias for \'--daemon true\'',
'--detach':         'alias for \'--daemon true\'',
'--monitor':        'fork and run a monitor as a daemon which restarts server w/in 10 seconds if it dies',
'--stop':           'stop the server.  Also stop the monitor and log rotation, if started'
}

// avoid rampart.globalize(rampart.utils) here
var exit=process.exit, utils=rampart.utils, fprintf=utils.fprintf,
    printf=utils.printf, sprintf=utils.sprintf, kill=utils.kill,
    stat=utils.stat, getType=utils.getType, trim=utils.trim, 
    exec=utils.exec, sleep=utils.sleep, stderr=utils.stderr, 
    dateFmt=utils.dateFmt, shell=utils.shell, realPath=utils.realPath,
    autoScanDate=utils.autoScanDate, mkdir=utils.mkdir, readFile=utils.readFile;

var wd;
var iam = trim(exec('whoami').stdout);
var unprivUser;
/* ports from a `listen' config, empty when the ordinary bind path ran */
var listenPorts = [];

/* ---------------- macOS launchd-mediated daemonization ----------------
 *
 * Classic fork()+setsid() daemons on macOS cannot use launchd XPC
 * services: launchd refuses per-process service lookups (e.g.
 * com.apple.MTLCompilerService) for fork-orphaned processes, which
 * breaks Metal shader compilation -- GPU model loads in a daemonized
 * server fail whenever the OS shader caches can't serve a request.
 * There is no way to repair a forked process's launchd identity short
 * of exec, and launchd is the system's sanctioned daemon parent.
 *
 * So on macOS, daemon:true starts the server THROUGH launchd while
 * keeping the exact unix look and feel: write a throwaway plist,
 * `launchctl bootstrap` it (system domain when root, user domain
 * otherwise), delete the plist, and let launchd exec this same conf
 * script with RAMPART_LAUNCHD_CHILD set.  The child runs the normal
 * foreground path (bind as root, read certs, drop privileges, start
 * threads) with a clean XPC identity.  start/stop/status/restart and
 * the pidfile behave identically to every other platform, nothing
 * persists across reboot, and the user never touches launchctl. */

var isDarwin = trim(exec('uname').stdout) == 'Darwin';

/* Job label: serverRoot slug + port.  Keying on directory+port matches
 * Linux semantics: two confs in the same directory CAN run side by side
 * (discouraged -- they still clobber each other's pidfile, exactly as
 * on Linux), while stop's bootout still targets the right server by
 * port even when the pidfile was overwritten.  Caveat: with
 * monitor:true (KeepAlive), editing the port in a conf and THEN running
 * stop misses the old-port label -- launchd would relaunch the killed
 * server on the old port.  Stop before changing ports. */
function launchdLabel(serverConf) {
    return 'com.rampart.ws.' +
        ('' + serverConf.serverRoot).replace(/[^A-Za-z0-9]+/g, '-')
                                    .replace(/^-+|-+$/g, '') +
        /* with `listen', the wrapper never chose a port: label by the
           first one the config asked for */
        '.p' + (listenPorts.length ? listenPorts[0] : serverConf.ipPort);
}

/* Candidate launchd domains, in order.  root -> the system domain.
 * Otherwise the per-user gui domain (present whenever the user has a
 * login session, the common case on a Mac) with the background user
 * domain as fallback. */
function launchdDomains() {
    if (iam == 'root') return ['system'];
    var uid = trim(exec('id', '-u').stdout);
    return ['gui/' + uid, 'user/' + uid];
}

function plistEscape(s) {
    return ('' + s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Deregister this conf's launchd job, if any (this also terminates the
 * job's process).  Returns true if a job was actually removed.  Best
 * effort: harmless when the label isn't loaded (or on a fresh boot). */
function launchdBootout(serverConf) {
    var doms = launchdDomains(), i, removed = false;
    for (i = 0; i < doms.length; i++) {
        var b = exec('launchctl', 'bootout', doms[i] + '/' + launchdLabel(serverConf));
        if (b.exitStatus == 0) removed = true;
    }
    return removed;
}

/* Why launchd gave up on the job, or '' if it hasn't (yet).  A job that
 * never ran (launchd could not even start it) leaves its reason only in
 * the system log, e.g. "posix_spawn(...) error 0xd - Permission denied",
 * so fetch launchd's own message for this label since `since'. */
function launchdJobFailure(domain, label, since) {
    var p = exec('launchctl', 'print', domain + '/' + label);
    if (p.exitStatus != 0) return '';
    var out = '' + (p.stdout || '');
    var state = /\n\s*state = ([^\n]*)/.exec(out);
    var code  = /\n\s*last exit code = ([^\n]*)/.exec(out);
    if (!state || trim(state[1]) != 'not running' || !code) return '';
    var n = parseInt(code[1], 10);
    if (isNaN(n) || n == 0) return '';                  /* "(never exited)" */

    var why = 'launchd job is not running (last exit code ' + trim(code[1]) + ')';
    var lg = exec('log', 'show', '--start', since, '--style', 'compact', '--predicate',
                  'process == "launchd" AND eventMessage CONTAINS "' + label + '"');
    var lines = ('' + (lg.stdout || '')).split('\n').filter(function(l) {
        return /could not initialize|Permission denied|error/i.test(l);
    });
    if (lines.length) {
        var pick = lines.filter(function(l) { return /could not initialize/i.test(l); });
        var l = pick.length ? pick[pick.length - 1] : lines[lines.length - 1];
        var m = /\]:\] (.*)$/.exec(l);
        why += ':\n  launchd: ' + trim(m ? m[1] : l);
    }
    return why;
}

function launchdStart(serverConf) {
    var label  = launchdLabel(serverConf);
    var doms   = launchdDomains();
    var domain = doms[0];
    var isZip  = (process.scriptPath == ':zip:');
    var progArgs = isZip ? [ realPath(process.argv0), 'start' ]
                         : [ process.installPathExec, process.script, 'start' ];
    var lelog  = (serverConf.logRoot ? serverConf.logRoot : wd) + '/launchd.log';

    /* launchd opens launchd.log as the user the job runs as, before it
     * starts the server.  If it can't (e.g. root-owned, left by an
     * earlier start with sudo), the server never runs -- so check now. */
    if (domain != 'system') {
        try {
            utils.fclose(utils.fopen(lelog, 'a'));
        } catch(e) {
            return serr('launchd start: cannot write ' + lelog + ' as ' + iam +
                        ' (' + e.message + '), so launchd cannot start the server.' +
                        '  If it was left by a start with sudo, remove it or start with sudo again.');
        }
    }

    /* launchd provides a minimal environment (system domain: root's).
     * The conf and the model store resolve through $HOME, so pin HOME
     * to the identity the server will RUN as after the privilege drop. */
    var homeUser = (iam == 'root' && serverConf.user) ? serverConf.user : iam;
    homeUser = ('' + homeUser).replace(/[^A-Za-z0-9_.-]/g, '');
    var home = trim(exec('sh', '-c', 'echo ~' + homeUser).stdout);

    var i, plist =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
        '<plist version="1.0">\n<dict>\n' +
        '    <key>Label</key><string>' + plistEscape(label) + '</string>\n' +
        '    <key>ProgramArguments</key>\n    <array>\n';
    for (i = 0; i < progArgs.length; i++)
        plist += '        <string>' + plistEscape(progArgs[i]) + '</string>\n';
    plist +=
        '    </array>\n' +
        '    <key>WorkingDirectory</key><string>' + plistEscape(wd) + '</string>\n' +
        '    <key>EnvironmentVariables</key>\n    <dict>\n' +
        '        <key>RAMPART_LAUNCHD_CHILD</key><string>1</string>\n' +
        '        <key>HOME</key><string>' + plistEscape(home) + '</string>\n' +
        '        <key>PATH</key><string>' + plistEscape(utils.getenv('PATH') || '/usr/local/bin:/usr/bin:/bin') + '</string>\n' +
        '    </dict>\n' +
        /* monitor:true folds into launchd: KeepAlive relaunches the
         * server if it dies.  The JS monitor daemon still runs for log
         * rotation and the http health check, but on macOS it only
         * KILLS a dead/hung server -- launchd does the relaunching
         * (a fork-daemonized monitor cannot call launchctl: broken
         * XPC).  Without monitor, death is final, as on Linux. */
        '    <key>RunAtLoad</key><true/>\n' +
        '    <key>KeepAlive</key>' + (serverConf.monitor ? '<true/>' : '<false/>') + '\n' +
        '    <key>StandardOutPath</key><string>' + plistEscape(lelog) + '</string>\n' +
        '    <key>StandardErrorPath</key><string>' + plistEscape(lelog) + '</string>\n' +
        '</dict>\n</plist>\n';

    /* the system domain requires a root-owned plist in a root-owned
     * directory; the user domain accepts a user-owned file. */
    var plistPath = (domain == 'system')
        ? '/Library/LaunchDaemons/' + label + '.plist'
        : wd + '/.' + label + '.plist';
    try {
        fprintf(plistPath, '%s', plist);
        utils.chmod(plistPath, '0644');
    } catch(e) {
        return serr('launchd start: could not write ' + plistPath + ' - ' + e.message);
    }

    launchdBootout(serverConf);            /* clear any stale job */
    exec('rm', '-f', wd + '/server.pid');  /* don't confuse the poll below
                                              with a stale pidfile */
    /* failure reports use only this attempt's log lines */
    var since = dateFmt('%Y-%m-%d %H:%M:%S', new Date());
    var logStart = 0;
    try { logStart = stat(lelog).size || 0; } catch(e) {}
    var b, di;
    for (di = 0; di < doms.length; di++) {
        domain = doms[di];
        b = exec('launchctl', 'bootstrap', domain, plistPath);
        if (b.exitStatus == 0) break;
    }
    exec('rm', '-f', plistPath);           /* job def now lives in launchd */
    if (b.exitStatus != 0)
        return serr('launchd bootstrap failed: ' + trim(b.stderr || b.stdout || ('exit ' + b.exitStatus)));

    /* Wait for the child to write the pidfile and come up.  Model
     * warm-up in preThreadFunc can take a while, so be patient. */
    var pid = 0, failed = '';
    for (i = 0; i < 240; i++) {            /* up to 60s */
        sleep(0.25);
        pid = getPid('server', true);
        if (pid && kill(pid, 0)) break;
        pid = 0;
        /* about once a second: has launchd already given up on it? */
        if (i % 4 == 3 && (failed = launchdJobFailure(domain, label, since)))
            break;
    }
    if (!pid) {
        if (!failed) failed = launchdJobFailure(domain, label, since) ||
                              'no server pid after 60 seconds';
        launchdBootout(serverConf);
        var tail = '';
        try {
            tail = readFile(lelog, {returnString:true}).slice(logStart).slice(-600);
        } catch(e) {}
        return serr('Server failed to start under launchd: ' + failed +
                    (tail ? '\n--- launchd log (this attempt) ---\n' + tail : ''));
    }
    var ret = smsg('Server has been started.');
    ret.pid = pid;
    return ret;
}
/* -------------- end macOS launchd-mediated daemonization -------------- */

function writePid(name, pid) {
    var pidfile = wd + '/' + name + '.pid';
    try{
        fprintf(pidfile, '%s', pid);
    } catch(e){
        return {error:sprintf('Error: could not write pid to %s - %s\n', pidfile, e.message)};
    }
    if(iam == 'root') {
        try {
            utils.chown({user:unprivUser, path:pidfile});
        } catch(e) {
            fprintf(stderr,'warn: could chown pidfile %s to user "%s" - %s\n', pidfile, unprivUser, e.message);
        }
    }
    return {};
}

var validpids={}

function getPid(name,nolog) {
    var pidfile = wd + '/' + name + '.pid';
    var ret=false;
    try {
        ret = parseInt(readFile(pidfile,{returnString:true}));
    } catch(e) {}
    if(typeof ret != 'number' || Number.isNaN(ret) ) {
        if(validpids[pidfile] && !nolog)
            fprintf(stderr, '%s - Cannot get %s pid from \'%s\'.\n', dateFmt('%Y-%m-%d-%H-%M-%S'), name, pidfile);
        validpids[pidfile]=false;
        return false;
    }
    validpids[pidfile]=true;
    return ret;
}

/* pid from server.pid if that process is alive and is rampart.  Uses ps,
   not kill(pid,0), which fails for a root-owned server when not root. */
function runningServerPid() {
    var pid = getPid('server', true);
    if (!pid) return 0;
    var cmd = trim(exec('ps', '-p', '' + pid, '-o', 'command=').stdout || '');
    var me = ('' + process.argv0).replace(/.*\//, '');
    if (!cmd || (cmd.indexOf('rampart') == -1 && cmd.indexOf(me) == -1))
        return 0;
    return pid;
}

function killPid(name, sig) {
    var ret={};
    ret.pidfile = wd + '/' + name + '.pid';
    ret.pid;
    if(!sig) sig='SIGTERM';
    try {
        ret.pid = parseInt(readFile(ret.pidfile,{returnString:true}));
    } catch(e) {
        ret.error='could not read from ' + ret.pidfile;
        ret.success=false;
        return ret;
    }
    if(typeof ret.pid != 'number' || Number.isNaN(ret.pid) ) {
        ret.success=false;
        ret.error='bad pid in ' + pidfile;
        return ret;
    }
    try {
        ret.success=kill(ret.pid, sig, true);

        /* Wait for the process to actually exit before returning.  The
           daemon is double-forked, so its parent is init — kill()'s
           internal waitpid() loop is a no-op on a non-child PID, which
           means a freshly-stopped daemon can still hold its listening
           socket when the caller (e.g. restart) immediately turns around
           and tries to bind.  Poll kill(pid, 0) (signal 0 = existence
           check) instead.  If the process is still alive after the soft
           timeout, escalate to SIGKILL and poll a little longer. */
        if (ret.success && sig !== 0 && sig !== 'SIGKILL' && sig !== 9) {
            var SOFT_TIMEOUT_MS = 5000;
            var HARD_TIMEOUT_MS = 2000;
            var STEP_MS = 50;
            var waited = 0;
            while (waited < SOFT_TIMEOUT_MS) {
                if (!kill(ret.pid, 0)) break;
                sleep(STEP_MS / 1000);
                waited += STEP_MS;
            }
            if (kill(ret.pid, 0)) {
                /* Still alive — escalate. */
                try { kill(ret.pid, 'SIGKILL'); } catch(_) {}
                waited = 0;
                while (waited < HARD_TIMEOUT_MS) {
                    if (!kill(ret.pid, 0)) break;
                    sleep(STEP_MS / 1000);
                    waited += STEP_MS;
                }
            }
        }

        utils.rmFile(ret.pidfile);
    } catch (e) {
        ret.success=false;
        ret.error=sprintf('%s',e.message);
    }

    return ret;
}

function serr(msg){
    return {error:msg};
}

function smsg(msg){
    return {message:msg};
}

function firstChecks(serverConf)
{
    if(serverConf.redirPort == -1 && serverConf.redir)
        serverConf.redirPort = 80;
    
    if (serverConf.port > 0 ){
        serverConf.ipPort=serverConf.ipv6Port=serverConf.port;
    }

    if(getType(serverConf.accessLog) == 'String'  && serverConf.accessLog.length==0)
        serverConf.accessLog=null;

    if(getType(serverConf.errorLog) == 'String'  && serverConf.errorLog.length==0)
        serverConf.errorLog=null;

         //__don't__ skip letsencrypt check if manually launching redir-server or monitor
         //we need the port set if it changes to 443
    if ( //!serverConf.launchRedir && !serverConf.launchMonitor
         //&&
        getType(serverConf.letsencrypt)=='String' && serverConf.letsencrypt.length)
    {
        if( serverConf.letsencrypt != "setup")
        {
            serverConf.sslKeyFile='/etc/letsencrypt/live/'+serverConf.letsencrypt+'/privkey.pem';
            serverConf.sslCertFile='/etc/letsencrypt/live/'+serverConf.letsencrypt+'/fullchain.pem';
            if(!stat(serverConf.sslKeyFile))
                return serr(sprintf("could not find file '%s'", serverConf.sslKeyFile)); 
            if(!stat(serverConf.sslCertFile))
                return serr(sprintf("could not find file '%s'", serverConf.sslCertFile)); 
            serverConf.secure=true;

            // if no explicit port set, and letsencrypt set, assume 443
            if(serverConf.port < 1 && serverConf.ipPort==8088 && serverConf.ipv6Port==8088)
            serverConf.port=serverConf.ipPort=serverConf.ipv6Port=443;
        }
        else if (serverConf.redirPort == -1)
        {
            return serr( "redir or redirPort must be set when letsencrypt==\"setup\"" );
        }
    }

    if(serverConf.selfSign) {
        if(!serverConf.secure)
            return serr( "selfSigned requires secure: true" );
        if(serverConf.letsencrypt)
            return serr( "selfSigned and letsencrypt cannot both be set true" );
        if( serverConf.sslKeyFile || serverConf.sslCertFile )
            return serr( "when selfSigned is true, sslKeyFile and sslCertFile must be unset" );

        // Generated cert lives under serverConf.serverRoot — process.scriptPath
        // would point at ':zip:' inside a single-file bundle, which is read-only.
        // _writableWd() resolves ':zip:' to the directory next to the bundle binary
        // so a bare-default config still works; for any user-supplied serverRoot
        // it returns the path unchanged.
        var certDir = _writableWd(serverConf.serverRoot || process.scriptPath);
        var cert = certDir+'/selfSign-cert.pem';
        var key = certDir+'/selfSign-key.pem';

        if(
            !(stat(cert) &&
              stat(key) )
        )
        {
            var crypto = require("rampart-crypto");
            var r = crypto.gen_cert({
                country: "US",
                state: "Deleware",
                city: "Wilmington",
                organization: "Sample Co",
                organizationUnit: "Sample Department",
                email: "sample@sample.none",
                name: "sample.none",
                bits: 4096,
                days: 365,
                subjectAltName: ["localhost", "*.localhost"]
            });
            fprintf(key, '%s', r.key);
            fprintf(cert, '%s', r.cert);
        }

        serverConf.sslKeyFile=key;
        serverConf.sslCertFile=cert;
    }

    /* MULTI-LISTENER, PASSED STRAIGHT THROUGH.
     *
     * `listen' is rampart-server's own array-of-listeners shape: several
     * ports in one process, each with its own map and its own optional
     * TLS -- http on localhost beside https on the world, say.  It and
     * `bind' are mutually exclusive there, so when a config supplies it
     * this wrapper stops deciding where to bind and checks only what it
     * still owns: the privileged-port rule below, and the port a macOS
     * launchd label is built from.  A config without `listen' takes
     * exactly the path it always did. */
    listenPorts = [];
    if(serverConf.listen !== undefined) {
        if(getType(serverConf.listen) != 'Array' || !serverConf.listen.length)
            return serr('listen must be a non-empty Array of listener objects');
        if(serverConf.bind !== undefined)
            return serr('bind and listen cannot both be set');
        /* these rewrite the single bind from ipAddr/ipPort, which `listen'
           replaces; they have no meaning here.  letsencrypt:'<domain>' is
           fine -- it only resolves the cert paths, which blocks inherit --
           but "setup" rebinds the server to serve /.well-known alone. */
        if(serverConf.letsencrypt == "setup")
            return serr('letsencrypt:"setup" cannot be used with listen - run the issuance step with a single bind');
        if(serverConf.irohProxy)
            return serr('irohProxy cannot be used with listen');
        if(serverConf.redirPort > 0)
            return serr('redirPort cannot be used with listen - use httpRedirect or a plain http listen block');
        for (var li=0; li<serverConf.listen.length; li++) {
            var lblock = serverConf.listen[li];
            if(getType(lblock) != 'Object')
                return serr('listen['+li+'] must be an Object');
            var lbind = lblock.bind;
            if(getType(lbind) == 'String') lbind=[lbind];
            if(getType(lbind) != 'Array' || !lbind.length)
                return serr('listen['+li+'] requires bind');
            for (var lj=0; lj<lbind.length; lj++) {
                var lport = /:(\d+)$/.exec(''+lbind[lj]);
                if(!lport)
                    return serr('listen['+li+'].bind "'+lbind[lj]+'" has no port');
                listenPorts.push(Number(lport[1]));
            }
        }
    } else {
        var bind = [];

        if(serverConf.bindAll) {
            if(!serverConf.ipPort || !serverConf.ipv6Port)
                return serr('no ip or ipv6 port specified');
            bind = ['0.0.0.0:'+serverConf.ipPort, '[::]:'+serverConf.ipv6Port];
        } else {
            if(serverConf.ipAddr && serverConf.ipPort)
                bind.push(serverConf.ipAddr + ':' + serverConf.ipPort);
            if(serverConf.ipv6Addr && serverConf.ipv6Port)
                bind.push(serverConf.ipv6Addr + ':' + serverConf.ipv6Port);
        }

        if(!bind.length)
            return serr('No ip addr/port specified');

        serverConf.bind=bind;
    }

    unprivUser=serverConf.user;
    if(!serverConf.serverRoot)
        serverConf.serverRoot=wd;

    if(!serverConf.quickserver)
        serverConf.fullServer=1;
    else
        serverConf.fullServer=0;

    if(getType(serverConf.rotateInterval) == 'String')
    {
        switch(serverConf.rotateInterval.toLowerCase()) {
            case "hourly": serverConf.rotateInterval=3600;break;
            case "daily":  serverConf.rotateInterval=86400;break;
            case "weekly": serverConf.rotateInterval=604800;break;
            default:
                return serr('rotateInterval must be a Number (seconds) or ["weekly"|"daily"|"hourly"]');
        }
    }

    if(iam == 'root') {
        var st = stat(wd);
        if(!st)
            return serr(`could not stat server root "${wd}"`);
        if((st.mode & 7) != 7) { //if not world read/write/exec
            if(st.owner != unprivUser)
                return serr(`server root "${wd}" is owned by '${st.owner}', but the server drops privileges to user '${unprivUser}'.\n` +
                            `       Either set  user: '${st.owner}'  in the config, or change ownership of "${wd}" (and its contents) to '${unprivUser}'.`);
        }
    }

    return serverConf;
}

/* 
   argv - array for command line opts
        - object for script invocation
*/
function parseOptions (argv){
    var arg, fullServer=1, printdefaults=0;

    wd = utils.getcwd();

    // if no argv - use process.argv for command line processing
    if(!argv)
        argv=process.argv;
    // if an object, argv should be settings to override the defaults
    else if (getType(argv)=='Object'){
        var def;
        // first set up accessLog and errorLog if logRoot is set.
        if( argv.logRoot ){
            if(!argv.accessLog) argv.accessLog = argv.logRoot + '/access.log';
            if(!argv.errorLog)  argv.errorLog  = argv.logRoot + '/error.log';
        }

        if(!argv.serverRoot)
            argv.serverRoot=realPath('.');
        else
            wd = _writableWd(argv.serverRoot);  /* writable runtime dir; differs from serverRoot when bundled */

        if(argv.quickserver)
            def=Object.assign({}, defaultQuickServerConf(argv.serverRoot));
        else
            def=Object.assign({}, defaultServerConf(argv.serverRoot));

        var ret=Object.assign(def, argv);
        return firstChecks(ret);
    }

    /* parsing command line options */
    for (var i=0; i<argv.length; i++)
    {
        arg =  argv[i]
        if(arg == '--server' || arg == '--quickserver') {
            if(arg == '--quickserver')
                fullServer=0;
            argv[i]='--skip';
        }
        else if(arg == "--")
            argv[i]='--skip';

        var st = (arg.charAt(0)=='-'?false:stat(arg));
        if(st){
            if(st.isDirectory) {
                wd=realPath(arg);
                argv[i]='--skip';
            } else if(arg==process.scriptName){
                argv[i]='--skip';
            }
        }
        if (arg == '--lsopts') {
            var optsmsg = '';
            for(var key in optlist) 
                optsmsg=sprintf('%s%-20s %s\n',optsmsg,key,optlist[key]);
            return smsg(optsmsg);
        }
        if (arg == '--help' || arg == '-h' || arg == '--?' || arg == '-?')
        {
            return smsg( 
                sprintf('rampart built-in server help:\n'+
    '\nUsage: rampart --[quick]server [options] [root_dir]\n' +
    '    --server              - run as a full server\n' +
    '    --quickserver         - run as a test server\n' +
    '    --help, -h, -?, --?   - this help message\n' +
    '    --lsopts              - print details on all options\n' +
    '    --showdefaults        - print the list of default settings for --server or --quickserver\n' +
    '    --OPTION [val]        - where OPTION is one of options listed from \'--lsopts\'\n' +
    /*'    OPTION=val      - alternative format for '--OPTION val'\n'  + */
    '\nIf root_dir is not specified, the current directory will be used\n'
                )
            );
        }
        if(arg == '--showdefaults')
            printdefaults=1;
    }

    //for when starting from `rampart --server` shortcut
    if(!process.scriptPath) process.scriptPath = wd;

    var serverConf;
    if(fullServer==1) {
        serverConf = defaultServerConf(wd);
        serverConf.fullServer=1;
    } else {
        serverConf = defaultQuickServerConf(wd);
        serverConf.fullServer=0;
    }

    if(printdefaults) {
        return smsg(sprintf('Defaults for %s:\n%3J\n', fullServer==1 ? '--server' : '--quickserver', serverConf));
    }

    var val;
    serverConf.shutdown=false;
    for (i=0; i<argv.length; i++) {
        var earg = arg = argv[i];

        if(arg=='-d' || arg=='--detach')
                arg='--daemon';
        if(arg=='--skip')
            continue;
        if (arg=='--stop')
        {
            serverConf.shutdown=true;
            continue;
        }
        if(arg.charAt(0)=='-' && arg.charAt(1)=='-') {
            arg = arg.substring(2);
            if(getType(serverConf[arg]) == 'Boolean') {
                if(argv[i+1] == 'true' || argv[i+1] == 'false')
                    val=argv[++i];
                else
                    val=true;
            } else if(i+1 >= argv.length) {
                return serr(sprintf('option \'--%s\' must be followed by a value', arg));
            } else {
                i++;
                val=argv[i];
            }
        } else {
            var argval = arg.split('=');
            if(argval.length>1)
            {
                arg=argval[0];
                if(argval.length>2) {
                    argval.shift();
                    val=argval.join('=');
                } else
                    val=argval[1];
            }
        }
        if(val=='true')
            val=true;
        else if (val=='false')
            val=false;
        else {
            var nval=parseInt(val);
            if(!isNaN(nval) && sprintf('%s',nval)==val)
                val=nval;
        }

        if(serverConf[arg]===undefined)
        {
            if(earg.charAt(0) == '-')
                return serr(sprintf('\'%s\' is an invalid option', earg));
            else
                return serr(sprintf('\'%s\' is an invalid option, a non-existant root directory or a duplicate root directory.', earg));
        }
        if((arg != "rotateInterval" || getType(val) != 'String') &&
           (arg != "defaultCharset" || getType(val) != 'Boolean'))
        {
            if(getType(serverConf[arg]) != getType(val))
                return serr(sprintf('Error: \'%s\' expects a %s but got \'%s\'', earg, getType(serverConf[arg]), val) );
        }
        serverConf[arg]=val;
    }

    serverConf=firstChecks(serverConf);
    return serverConf;
}

function status(serverConf){
    if(!serverConf)
        serverConf=defaultServerConf(utils.realPath('.'));

    if(!unprivUser)
        unprivUser=serverConf.user;

    wd = _writableWd(serverConf.serverRoot);
    if(!wd)
        serverConf.serverRoot=wd=utils.realPath('.');

    var ret={};
    var pret=getPid('server', true);
    ret.serverPid=pret;
    var pret=getPid('monitor', true);
    ret.monitorPid=pret;
    var iret=getPid('iroh-server', true);
    ret.irohPid=iret;
    return ret;    
}

function start(serverConf, dump) {
    var server=require('rampart-server');

    /* launchd child (macOS daemon:true): launchd already daemonized us
     * by exec -- run the normal foreground path. */
    if (utils.getenv('RAMPART_LAUNCHD_CHILD'))
        serverConf.daemon = false;

    wd = _writableWd(serverConf.serverRoot);
    if(!wd)
        serverConf.serverRoot=wd=utils.realPath('.');

    if(!serverConf)
        serverConf=defaultServerConf(utils.realPath('.'));

    serverConf.launchServer = true;
    serverConf.launchMonitor = (serverConf.log && serverConf.rotateLogs) || serverConf.monitor;
    serverConf.launchRedir = serverConf.redirPort > 0 ;

    /* Setup mode: initial letsencrypt issuance, no https yet.
       Override serverConf so the regular start_server flow runs as
       a single minimal HTTP listener serving /.well-known/ only.
       No monitor, no iroh, no second daemon. Skip the rewrite when
       we're being called to stop/shutdown — those paths only need
       killPid('server') and shouldn't touch serverConf. */
    if (serverConf.letsencrypt == "setup"
        && !serverConf.stop && !serverConf.shutdown) {
        var le_wd = serverConf.serverRoot + '/letsencrypt_wd/.well-known';
        var le_st = stat(le_wd);
        if (!le_st) {
            try { mkdir(le_wd); } catch(e) {
                return serr('letsencrypt setup: could not create ' + le_wd + ': ' + e.message);
            }
            if (iam == 'root') {
                try {
                    utils.chown({user: serverConf.user, path: serverConf.serverRoot + '/letsencrypt_wd'});
                    utils.chown({user: serverConf.user, path: le_wd});
                } catch(e) {
                    fprintf(stderr, 'warn: could not chown %s to "%s" - %s\n', le_wd, serverConf.user, e.message);
                }
            }
        } else if (!le_st.isDirectory) {
            return serr('letsencrypt setup: ' + le_wd + ' exists but is not a directory');
        }
        serverConf.secure       = false;
        serverConf.sslKeyFile   = '';
        serverConf.sslCertFile  = '';
        serverConf.ipPort       = serverConf.redirPort;
        serverConf.ipv6Port     = serverConf.redirPort;
        /* parseOptions has already built serverConf.bind from the
           pre-override ipPort/ipv6Port — rebuild it on the redir port. */
        var setup_bind = [];
        if (serverConf.bindAll) {
            setup_bind = ['0.0.0.0:'+serverConf.redirPort, '[::]:'+serverConf.redirPort];
        } else {
            if (serverConf.ipAddr)   setup_bind.push(serverConf.ipAddr   + ':' + serverConf.redirPort);
            if (serverConf.ipv6Addr) setup_bind.push(serverConf.ipv6Addr + ':' + serverConf.redirPort);
        }
        serverConf.bind         = setup_bind;
        serverConf.map          = { '/.well-known/': le_wd + '/' };
        serverConf.launchServer = true;
        serverConf.launchRedir  = false;
        serverConf.launchMonitor = false;
        serverConf.redirPort    = -1;
        delete serverConf.httpRedirect;
    }

    /* When redirPort is set AND we're running https, use the in-process
       C-level httpRedirect option on the main server instead of forking
       a second process. The letsencrypt case adds a /.well-known/
       passthrough so ACME HTTP-01 challenges still serve over plain
       HTTP for renewals; everything else 301's to https.
       If the user has already set serverConf.httpRedirect (number,
       string, or object), respect it — they want full control. */
    if (serverConf.launchRedir
        && serverConf.secure
        && serverConf.letsencrypt != "setup")
    {
        if (!serverConf.httpRedirect) {
            var hr = { port: serverConf.redirPort };
            if (getType(serverConf.letsencrypt) == 'String' && serverConf.letsencrypt.length) {
                var le_wd = serverConf.serverRoot + '/letsencrypt_wd/.well-known';
                var le_st = stat(le_wd);
                if (!le_st) {
                    try { mkdir(le_wd); } catch(e) {
                        console.log("Error making directory for letsencrypt challenge updates:", e.message);
                    }
                    if (iam == 'root') {
                        try {
                            utils.chown({user:serverConf.user, path:serverConf.serverRoot + '/letsencrypt_wd'});
                            utils.chown({user:serverConf.user, path:le_wd});
                        } catch(e) {
                            fprintf(stderr, 'warn: could not chown dir %s to user "%s" - %s\n', le_wd, serverConf.user, e.message);
                        }
                    }
                } else if (!le_st.isDirectory) {
                    console.log("Error: " + le_wd + " is not a directory");
                }
                hr.passthrough = { "/.well-known/": le_wd + '/' };
            }
            serverConf.httpRedirect = hr;
        }
        serverConf.launchRedir = false;
    }

    if(!unprivUser)
        unprivUser=serverConf.user;

    if(serverConf.shutdown || serverConf.stop) {
        /* macOS: bootout FIRST -- with monitor/KeepAlive, killing the
         * pid would just make launchd relaunch it.  bootout removes the
         * job and terminates its process; killPid below then mops up
         * and keeps the pidfile bookkeeping identical to other
         * platforms. */
        var launchdRemoved = isDarwin ? launchdBootout(serverConf) : false;

        var res = killPid('server');
        var msg = 'Server has been stopped';
        if(!res.success && !launchdRemoved)
            msg = 'Server is not running or pid file is invalid';

        res=killPid('monitor');
        if(res.success)
            msg += '\nMonitor process has been stopped';

        /* http->https redirect is now handled in-process by the
           server (httpRedirect), so there is no separate redirect
           server to track or kill. */

        res=killPid('iroh-server');
        if(res.success)
            msg += '\nIroh Server has been stopped';

        return {message:msg};
    }

    /* macOS 10.14+ does not restrict ports <1024 to root, and rampart
     * supports macOS 11+, so the pre-flight root check only applies
     * elsewhere.  (A non-root macOS start on port 443 must still be
     * able to read its TLS key/cert files, e.g. letsencrypt keys are
     * root-owned by default -- that failure surfaces on its own with a
     * clear message.)  rampart-server.c has no port gate of its own:
     * bind() simply reports the OS's answer. */
    if(iam != 'root' && !isDarwin) {
        if(listenPorts.length) {
            /* the wrapper's own ipPort/ipv6Port were never used here */
            for (var lp=0; lp<listenPorts.length; lp++)
                if(listenPorts[lp] < 1024)
                    return serr('Error: script must be started as root to bind to port ' + listenPorts[lp]);
        }
        else {
            if(serverConf.ipPort < 1024)
                return serr('Error: script must be started as root to bind to IPv4 port ' + serverConf.ipPort);
            if(serverConf.ipv6Port < 1024)
                return serr('Error: script must be started as root to bind to IPv6 port ' + serverConf.ipv6Port);
        }
        if(serverConf.redirPort < 1024 && serverConf.redirPort > 0)
            return serr('Error: script must be started as root to bind the redirect server to port ' + serverConf.redirPort);
    }

    /* with logging on, make sure each log file's directory exists */
    if(serverConf.log) {
        var logfiles = [serverConf.accessLog, serverConf.errorLog];
        for (var lfi=0; lfi<logfiles.length; lfi++) {
            var lf = logfiles[lfi];
            if(getType(lf) != 'String' || !lf.length)
                continue;               /* stdout/stderr */
            var lslash = lf.lastIndexOf('/');
            if(lslash < 1)
                continue;               /* current dir, or filesystem root */
            var ldir = lf.substring(0, lslash);
            var lst = stat(ldir);
            if(lst) {
                if(!lst.isDirectory)
                    return serr(sprintf("log directory '%s' exists but is not a directory", ldir));
                continue;
            }
            try {
                mkdir(ldir);
            } catch(e) {
                return serr(sprintf("cannot create log directory '%s': %s", ldir,
                    e.message.replace(/^.*: /, '')));
            }
        }
    }

    var serverpid;

    if(!serverConf.notFoundFunc) {
        global._server_notFoundImg='';
        if(stat(serverConf.htmlRoot+'/images/not-found.jpg'))
            global._server_notFoundImg='<p><img style="width:65%" src="/images/not-found.jpg"></p>'
        if(stat(serverConf.htmlRoot+'/images/not-found.gif'))
            global._server_notFoundImg='<p><img style="width:65%" src="/images/not-found.gif"></p>'
        if(stat(serverConf.htmlRoot+'/images/not-found.png'))
            global._server_notFoundImg='<p><img style="width:65%" src="/images/not-found.png"></p>'

        serverConf.notFoundFunc = function (req){
            return {
                status:404,
                html: '<html><head><title>404 Not Found</title></head><body><center><h1>Not Found</h1>'+
                    '<p>The requested URL ' + rampart.utils.sprintf('%H',req.path.path) + 
                    ' was not found on this server.</p>' +
                    global._server_notFoundImg +
                    '</center></body></html>'
            }
        }
    }

    if(!serverConf.scriptTimeout)
        serverConf.scriptTimeout=20;
    if(!serverConf.connectTimeout)
        serverConf.connectTimeout=20;
    if(!serverConf.mimeMap)
        serverConf.mimeMap={ 'mp3': 'audio/mp3' };

    var map;
    if(serverConf.map && getType(serverConf.map)=='Object')
        map=serverConf.map;
    else {
        map={};

        if(serverConf.htmlRoot && serverConf.htmlRoot.length)
            map['/']=serverConf.htmlRoot;

        if(serverConf.appsRoot && serverConf.appsRoot.length)
            map['/apps/'] = {modulePath: serverConf.appsRoot};

        if(serverConf.wsappsRoot && serverConf.appsRoot.length)
            map['ws://wsapps/'] = {modulePath: serverConf.wsappsRoot};
    }

    if(serverConf.appendMap && getType(serverConf.appendMap)=='Object')
        Object.assign(map, serverConf.appendMap);

    if(serverConf.rootScripts && serverConf.htmlRoot && serverConf.htmlRoot.length) {
        var scripts = utils.readDir(serverConf.htmlRoot).filter(function(f){return /\.js$/.test(f);});
        scripts.forEach (function(sn) {
            var p = '/' + sn.replace(/\.js$/,'') + '/';
            map[p]={module: serverConf.htmlRoot+'/'+sn};
        });
    }

    if(listenPorts.length) {
        /* rampart-server refuses a top-level map beside `listen', where
         * each listener carries its own routing table.  The map built
         * above (htmlRoot, /apps/, ws://wsapps/, appendMap, rootScripts)
         * becomes the default for any block that brought none, so a
         * config only has to name the extra port. */
        for (var lmi=0; lmi<serverConf.listen.length; lmi++) {
            var lmb = serverConf.listen[lmi];
            if(!lmb.map || getType(lmb.map)!='Object')
                lmb.map = Object.assign({}, map);
        }
        delete serverConf.map;
    } else
        serverConf.map=map;

    /************ START THE SERVER ***************/
    function start_server(restart){

        if(!serverConf.launchServer)
            return {};

        /* macOS daemon:true: daemonize through launchd (see the
         * launchd block above) instead of fork+setsid, so the server
         * keeps a working XPC identity (Metal/GPU compiles).  The
         * launchd child re-enters with RAMPART_LAUNCHD_CHILD set and
         * daemon forced false, so it takes the normal path below. */
        if (isDarwin && serverConf.daemon && !utils.getenv('RAMPART_LAUNCHD_CHILD'))
            return launchdStart(serverConf);

        //set global serverConf for app/*.js and wsapp/*.js scripts
        global.serverConf=serverConf;
        serverpid=server.start(serverConf);

        if(serverConf.daemon) { 
            sleep(0.5); //give time for server to exit if error
            if(!kill(serverpid, 0)) {
                return serr(sprintf('Failed to start webserver'));
            }
        }

        var wpres = writePid('server', serverpid);

        if( serverConf.daemon && wpres.error) {
            kill(serverpid);
            var p = getPid('monitor');
            if(p) kill(p);
            return wpres;
        }

        /* if authMod is enabled and we started as root, chown/chmod the
           auth data directory so the unprivileged user can read/write it */
        if (serverConf.authMod && serverConf.authModConf && iam == 'root' && unprivUser) {
            try {
                var authConf = require(serverConf.authModConf);
                var authDbPath = authConf.dbPath || 'data/auth';
                if (authDbPath.charAt(0) !== '/')
                    authDbPath = wd + '/' + authDbPath;
                if (stat(authDbPath)) {
                    utils.chown({user: unprivUser, path: authDbPath});
                    var authFiles = utils.readDir(authDbPath);
                    for (var afi = 0; afi < authFiles.length; afi++) {
                        var afp = authDbPath + '/' + authFiles[afi];
                        utils.chmod(afp, '0600');
                        utils.chown({user: unprivUser, path: afp});
                    }
                }
            } catch(e) {
                fprintf(stderr, 'warn: could not fix auth data permissions: %s\n', e.message);
            }
        }

        var ret = smsg(sprintf('Server has been started.'));
        ret.pid=serverpid;
        return ret;
    }

    /* http->https redirect is handled in-process via the C-level
       httpRedirect option (server.start()). No second daemon or JS
       redirect callback is needed. */
    if (serverConf.httpRedirect && !serverConf.secure) {
        return serr('options --redir[Port] requires --secure');
    }

    /* start_redir() and the doredir/redircode/redirHtmlFmt JS handlers
       used to live here. They spawned a second daemon to do http->https
       redirects (and serve /.well-known/ for letsencrypt). Both jobs
       are now done in-process via server.start({httpRedirect: ...}) —
       see the promotion block above. Setup-mode (letsencrypt=="setup")
       was overridden at the top of start() to become a plain HTTP
       server with /.well-known/ as its only map. */

    /* ****************** START THE IROH SERVER ************************ */

    function start_iroh() {
        var addr = '127.0.0.1', tls='', irohbin;

        if(!serverConf.irohProxy)
            return {};

        if(serverConf.secure)
            tls = '--tls --insecure';

        if(serverConf.ipAddr != "0.0.0.0" && ! serverConf.bindAll)
            addr = serverConf.ipAddr;

        irohbin = rampart.utils.shell('which iroh-webproxy');

        if(irohbin.exitStatus == 0)
            irohbin=irohbin.stdout.trim();
        else
            return serr('Server is configured with irohProxy:true but iroh-webproxy executable not found');

        var cmd = sprintf(
            '%s server %s --key-file "%s/iroh-webserver-secret.txt" --target %s:%s --daemon --pidfile %s/iroh-server.pid',
            irohbin, tls, serverConf.serverRoot, addr, serverConf.ipPort, serverConf.serverRoot
        );

        var reti = rampart.utils.shell(cmd);
        if(reti.exitStatus != 0)
            return serr(`iroh start failed: ${reti.stderr}`);

        rampart.utils.fprintf(`${serverConf.serverRoot}/iroh-nodeId.txt`,'%s', reti.stdout);

        var ret = smsg(sprintf('Iroh Server has been started.'));
        ret.pid = rampart.utils.readFile(`${serverConf.serverRoot}/iroh-server.pid`);

        return ret;
    }

    /************ START THE MONITOR PROCESS ***************/
    function checkMonitor()
    {
        if(!serverConf.launchMonitor)
            return true; // no monitor requested, continue and run server

        if(serverConf.fullServer!=1)
            return serr('options --rotateLogs or --monitor not available with --quickserver');

        if(!serverConf.daemon)
            return serr('options --rotateLogs and --monitor require --daemon');

        var gzip = trim ( exec('which','gzip').stdout );

        var pid = utils.daemon(); //fork as daemon

        if(pid==-1) //fork failed
            return serr('could not fork a new monitor process');

        if(pid) //parent
            return true;//run server in parent

        //child daemon below

        var wpres = writePid('monitor', process.getpid());
        if(wpres.error) {
            fprintf(stderr, "%s Monitor exiting.\n", wpres.error);
            exit(1);
        }

        process.setProcTitle('rampart serverMonitor ' + wd);
        sleep(1);

        /**************** LOG ROTATION **********************/
        if(serverConf.log && serverConf.rotateLogs) {
            var tdelay, mdelay, startTime, now;
            if (typeof serverConf.rotateInterval != 'number')
            {
                fprintf(stderr, 'serverConf.rotateInterval == %J is invalid\n', serverConf.rotateInterval);
                exit(1);
            }
            if( serverConf.rotateInterval < 300 ) {
                fprintf(stderr, 'serverConf.rotateInterval is set to less than 5 minutes, is that what your really want?\n');
            }

            if(typeof serverConf.rotateCount != 'number') {
                serverConf.rotateCount = -1;
                fprintf(serverConf.logRoot + '/rotation-error.log', true,
                    '%s - rotateCount is not a number, skipping deletion of old logs\n', dateFmt('%Y-%m-%d %H:%M:%S'));
            }

            serverConf.isLocal=false;
            function getStartTime() {
                var mdelay = serverConf.rotateInterval * 1000;
                var now = new Date();
                var StartTime;
                try {
                    if(serverConf.rotateStart=='now')
                    {
                        startTime=now;
                        serverConf.isLocal=true;
                    }
                    else
                    {
                        var dres = autoScanDate(serverConf.rotateStart);
                        if(!dres)
                        {
                            fprintf(stderr, 'Error parsing log rotation start time "%s": Monitor Exiting\n', serverConf.rotateStart);
                            exit(1);
                        }
                        if(dres.offset==0){
                            //assume localtime if no timezone provided
                            dres = autoScanDate(serverConf.rotateStart + " " + dateFmt('%z'));
                            serverConf.isLocal=true;
                        }
                        startTime = dres.date;
                    }
                    var origStart = startTime;
                    while( startTime < now )
                        startTime = new Date(startTime.getTime() + serverConf.rotateInterval*1000);

                } catch(e) {
                    fprintf(stderr, 'Error parsing log rotation start time (%s): %s - Monitor Exiting\n', serverConf.rotateStart,e.message);
                    exit(1);
                }
                if(serverConf.isLocal && ! (serverConf.rotateInterval % 86400) )
                    serverConf.rotateStart = dateFmt("%Y-%m-%d %z", (startTime.getTime() + mdelay)/1000).substring(0,11) + dateFmt("%H:%M:%S %z", origStart);
                else
                    serverConf.rotateStart = dateFmt("%Y-%m-%d %H:%M:%S", (startTime.getTime() + mdelay)/1000);

                return {now:now, mdelay:mdelay, startTime: startTime}
            }

            var dres = getStartTime();
            now = dres.now;
            startTime=dres.startTime;
            mdelay=dres.mdelay;

            tdelay = startTime.getTime() - now.getTime();

            var prevAbackup=false, prevEbackup=false;

            var rotErrLog = serverConf.logRoot + '/rotation-error.log';

            function rotErr(msg) {
                fprintf(rotErrLog, true, '%s - %s\n', dateFmt('%Y-%m-%d %H:%M:%S'), msg);
            }

            function rotateLogs() {
                serverpid=getPid('server');
                if(!serverpid || !kill(serverpid,0)) {
                    if(serverConf.monitor)
                        return;//monitor might restart?
                    else
                        exit(0);
                }
                var doArotate=false, doErotate=false;
                var ds = dateFmt('%Y-%m-%d-%H-%M-%S');
                var abackup = sprintf('%s-%s', serverConf.accessLog, ds);
                var ebackup = sprintf('%s-%s', serverConf.errorLog,  ds);

                var logstat = stat(serverConf.accessLog);
                if( logstat && logstat.size ){
                    doArotate=true;
                    try {
                        utils.rename( serverConf.accessLog, abackup);
                    } catch(e) {
                        rotErr('Cannot rename accessLog: ' + e.message);
                        doArotate=false;
                    }
                }

                logstat = stat(serverConf.errorLog);
                if( logstat && logstat.size ){
                    doErotate=true;
                    try {
                        utils.rename( serverConf.errorLog, ebackup);
                    } catch(e) {
                        rotErr('Cannot rename errorLog: ' + e.message);
                        doErotate=false;
                    }
                }

                if(doArotate||doErotate)
                    kill(serverpid, 'SIGUSR1');// close and reopen logs
                else
                    return;

                if(gzip && (prevAbackup || prevEbackup) )
                    shell(gzip + ' -q ' + (prevAbackup ? prevAbackup:'')+ ' ' + (prevEbackup?prevEbackup:''), {background:true} );

                if(doArotate) prevAbackup=abackup;

                if(doErotate) prevEbackup=ebackup;

                // delete old rotated logs beyond rotateCount
                if(serverConf.rotateCount > 0) {
                    try {
                        var logdir = serverConf.logRoot;
                        var files = utils.readDir(logdir);
                        function cleanOld(baselog) {
                            var base = baselog.substring(baselog.lastIndexOf('/') + 1);
                            var old = files.filter(function(f) {
                                return f.indexOf(base + '-') === 0;
                            }).sort();
                            while(old.length > serverConf.rotateCount) {
                                try {
                                    utils.rmFile(logdir + '/' + old.shift());
                                } catch(e) {
                                    rotErr('Cannot delete old log: ' + e.message);
                                }
                            }
                        }
                        if(doArotate) cleanOld(serverConf.accessLog);
                        if(doErotate) cleanOld(serverConf.errorLog);
                    } catch(e) {
                        rotErr('Error cleaning old logs: ' + e.message);
                    }
                }
            }

            if(!serverConf.isLocal) {
                setTimeout( function(){
                    rotateLogs();
                    var iv=setMetronome(rotateLogs, mdelay);
                }, tdelay);
            } else {
                // for a local time, need to re-evaluate hour in case of daylight savings change.
                function dorotate(){
                    rotateLogs();
                    var dres = getStartTime();
                    tdelay = dres.startTime.getTime() - dres.now.getTime();
                    setTimeout(dorotate, tdelay);
                }

                setTimeout(dorotate,tdelay);
            }
        }

        /**************** PROCESS MONITOR **********************/
        if(serverConf.monitor)
        {
            var iv2 = setMetronome(function(){
                serverpid=getPid('server');
                if(!serverpid)
                    return;
                if(!kill(serverpid,0))
                {
                    /* macOS: the server runs as a launchd job with
                       KeepAlive -- launchd relaunches it; this forked
                       monitor cannot (launchctl needs a working XPC
                       identity, which fork-daemons lack). */
                    if(isDarwin) {
                        fprintf(serverConf.errorLog, true, '%s - monitor: server died; launchd will relaunch it\n', dateFmt('%Y-%m-%d-%H-%M-%S'));
                        return;
                    }
                    fprintf(serverConf.errorLog, true, '%s - monitor: restarting server\n', dateFmt('%Y-%m-%d-%H-%M-%S'));
                    var res=start_server(true);
                    if(res.error) {
                        fprintf(serverConf.errorLog, true, '%s - monitor: restarting server failed -%s. Monitor exiting\n', dateFmt('%Y-%m-%d-%H-%M-%S'), res.error);
                        process.exit(1);
                    }
                }
                /* redirect server is no longer tracked separately —
                   http->https redirect lives in the main server via
                   httpRedirect, so it dies/restarts with the main pid. */
            }, 10000);
            // check that servers return something via http(s).
            var curl = require("rampart-curl");
            var thisurl = serverConf.secure ? "https://" : "http://";

            if(listenPorts.length)
            {
                /* with `listen', check the first listener's first socket */
                var lb = serverConf.listen[0].bind;
                thisurl = (serverConf.listen[0].secure === undefined ?
                              serverConf.secure : serverConf.listen[0].secure)
                          ? "https://" : "http://";
                thisurl += (getType(lb)=='Array' ? lb[0] : lb) + '/';
            }
            else if(serverConf.bindAll)
            {
                thisurl += "127.0.0.1:" + serverConf.ipPort + '/';
            } else {
                thisurl += serverConf.bind[0] + '/';
            }
            var iv3 = setMetronome(function(){
                var res = curl.fetch({insecure:true, "max-time": 10}, thisurl);
                if(res.status==0) {
                    fprintf(serverConf.errorLog, true, '%s - monitor: failed to fetch %s - %s\n',
                        dateFmt('%Y-%m-%d %H:%M:%S %z'), thisurl, res.errMsg);
                    serverpid=getPid('server');
                    if(serverpid)
                        kill(serverpid,9);  //don't be nice
                    //let the function above restart
                }
            },60000);

        }
        return false; //In monitor fork, do not run server
    }

    if(dump)
        return serverConf;

    /* refuse to start over a running server.  Not in the launchd child:
       its parent already cleared the pidfile, and refusing there would
       make KeepAlive relaunch it in a loop. */
    if (!utils.getenv('RAMPART_LAUNCHD_CHILD')) {
        var runpid = runningServerPid();
        if (runpid)
            return serr(sprintf('Server is already running (pid %d).', runpid));
    }

    // start iroh (order doesn't matter)
    var reti = start_iroh();
    if(reti.error)
        return reti;

    // start the main server
    var ret=start_server();

    if(ret.error) {
        if(reti.pid)
            try { kill(reti.pid); } catch(e){}
        return ret;
    }

    if(serverConf.letsencrypt=="setup") {
        printf(
`Server started in letsencrypt setup mode.
Now run letsencrypt to generate the certificate.
Example:
    certbot certonly --webroot \\
    --webroot-path %s/letsencrypt_wd \\
    -d %s\n`, serverConf.serverRoot, serverConf.letsencryptHost);
    }

    var status = checkMonitor();

    // status is true, we are the parent, or we never forked
    if(status)
        return ret;

    // status is false, we are the forked monitor
    return {isMonitor:true};

}

function dumpConfig(serverConf) {
    var conf = start(serverConf, true);
    var ret={};
    var props = ["bind","listen","scriptTimeout","connectTimeout","log",'logRoot', 'dataRoot',"accessLog","errorLog","daemon","useThreads","threads","maxRead","maxWrite","secure","sslKeyFile","sslCertFile","sslMinVersion","notFoundFunc","developerMode","directoryFunc","user","cacheControl","defaultCharset","compressFiles","compressScripts","compressLevel","compressMinSize","mimeMap","map","appendProcTitle"];
    for (var i=0; i<props.length; i++)
        ret[props[i]]=conf[props[i]];
    return ret;
}

function stop(serverConf){
    if(getType(serverConf)=='Object')
        serverConf=Object.assign({},serverConf,{stop:true});
    else
        serverConf={stop:true};
    return start(serverConf);    
}

function cmdLine(nslice) {
    var args = process.argv.slice(nslice);

    function printmsg(o, exitOnMsg) {
        if(o.error)
        {
            fprintf(stderr,"Error: %s\n", o.error);
            exit(1);
        } else if (o.message) {
            printf("%s\n", o.message);
            if(exitOnMsg)
                exit(0);
        }
    }

    var conf=parseOptions(args);
    printmsg(conf,true);
    var ret=start(conf);
    printmsg(ret);
}

function web_server_conf(conf) {
    var res, printf=rampart.utils.printf, argv=process.argv, kill=rampart.utils.kill;


    if (argv[2] == '--letssetup' || argv[2]=='letssetup') {
        conf.letsencryptHost = conf.letsencrypt;
        conf.letsencrypt="setup"; //flag we are doing letsencrypt, but don't start https
        argv[2]="start";
    }

    /* Preserve the user's original conf (just serverRoot is needed)
       so stop/restart can find the pid files even if parseOptions
       errored — e.g., letsencrypt cert files unreadable as a non-root
       user trying to stop a server running as root. */
    var originalServerRoot = conf && conf.serverRoot;

    // fill in the missing pieces and do some checks
    conf = parseOptions(conf);
    if (conf && !conf.serverRoot && originalServerRoot)
        conf.serverRoot = originalServerRoot;

    if (conf.dumpObj)
        return start(conf, /* dump = */ true);

    function check_conf_err() {
        if(conf.error)
        {
            printf("%s\n", conf.error);
            process.exit(1);
        }
    }

    //try to stop even if conf errors returned from parseOptions
    if(argv[2] == '--stop' || argv[2]=='stop') {

        /* STOP */
        res=stop(conf);
        if(res.error)
            printf("Server is not running or pid file is invalid\n");
        else if (res.message)
            printf("%s\n", res.message);
        process.exit(0);

    } else if(argv[2] == '--restart' || argv[2]=='restart') {

        /* RESTART */
        check_conf_err();
        res=stop(conf);
        if(res.error)
            printf("Server is not running or pid file is invalid\n");
        else if (res.message)
            printf("%s\n", res.message);

        res=start(conf);

        if(res.message)
            console.log(res.message);

        if(res.error) {
            console.log(res.error);
            process.exit(1);
        }

    } else if(argv[2] == '--status' || argv[2]=='status') {

        /* STATUS */
        res=status(conf);

        if( res.serverPid && kill(res.serverPid,0) )
            printf("server is running. pid: %s\n", res.serverPid);
        else
            printf("server is not running\n");

        if( res.monitorPid && kill(res.monitorPid,0) )
            printf("monitor process is running. pid: %s\n", res.monitorPid);
        else
            printf("monitor process is not running\n");

        if( res.irohPid && kill(res.irohPid,0) )
            printf("iroh-webproxy process is running. pid: %s\n", res.irohPid);

    } else if (argv[2] == '--dump' || argv[2]=='dump') {

        /* DUMP */
        check_conf_err();
        res=dumpConfig(conf);
        printf("%3J\n", res);
        process.exit(0);

    } else if (argv[2] == '--start' || argv[2]=='start' || !argv[2]) { //if no arg, run start

        /* START */
        conf.start=true;
        check_conf_err();

        res=start(conf);

        if(res.message)
            console.log(res.message);

        if(res.error) {
            console.log(res.error);
            process.exit(1);
        }
        // if (res.isMonitor) -- we are the monitor and should do nothing else but finish the script
        //                       so event loop can start and monitor can run its setTimeouts
        // else               -- we just exit.

    } else { 

        /* HELP */
        if (argv[2] != '-h' && argv[2] != '--help' && argv[2] != 'help')
        printf("unknown command '%s'\n\n", argv[2]);
        printf("usage:\n  %s %s [start|stop|restart|letssetup|status|dump|help]\n",argv[0], argv[1]);
        printf("      start     -- start the http(s) server\n");
        printf("      stop      -- stop the http(s) server\n");
        printf("      restart   -- stop and restart the http(s) server\n");
        printf("      letssetup -- start http only to allow letsencrypt verification\n");
        printf("      status    -- show status of server processes\n");
        printf("      dump      -- dump the config object used for server.start()\n");
        printf("      help      -- show this message\n");

    }
}

/* -------------------- single-file bundles --------------------
 * bundleSetup(serverConf) is called by web_server_conf.js before starting.
 * It does nothing unless the server runs from a bundle (an appended zip).
 *
 * Bundles built by the Mini IDE carry bundle.json at the zip root:
 *   {name, dataDir, logsDir, seedPolicy ("first"|"missing"), built, defaults}
 * Command line options (--host, --port, --tls, ...) are removed from
 * process.argv and applied to serverConf.  Options given to start or
 * restart update the saved set, so later commands and the macOS launchd
 * child (which is started with no options) use the same ones.
 * ------------------------------------------------------------- */

/* option -> takes a value */
var bundleFlags = {
    '--host': 1, '--port': 1, '--cert': 1, '--key': 1, '--letsencrypt': 1,
    '--redirect-port': 1, '--user': 1, '--data': 1, '--logs': 1,
    '--tls': 0, '--self-sign': 0, '--foreground': 0, '--defaults': 0,
    '--background': 0, '--no-tls': 0
};

/* options that turn others off when saved */
var bundleUnsets = {
    'background': ['foreground'],
    'no-tls': ['tls', 'self-sign', 'cert', 'key', 'letsencrypt', 'redirect-port']
};

function bundleDie(msg) {
    fprintf(stderr, "%s\n", msg);
    process.exit(1);
}

function bundleHome() {
    var home = process.env.HOME;
    if (!home || !stat(home)) home = '/tmp';
    return home;
}

function bundleExpand(p) {
    return String(p).replace(/^~(?=\/|$)/, bundleHome());
}

function bundleDirname(p) {
    return p.replace(/\/+$/, '').replace(/\/[^\/]*$/, '') || '/';
}

function bundleHelp(info) {
    var me = (process.argv0 || 'bundle').replace(/.*\//, ''), d = info.defaults || {};
    printf(
"%s - Rampart web server bundle\n\n" +
"Usage:\n" +
"  %s [options] [start|stop|restart|status|letssetup]\n" +
"\nOptions given to start or restart are remembered, each until it is given\n" +
"again, so later commands need none of them:\n" +
"  --host ADDR          all (0.0.0.0 and [::]), localhost, or one IPv4/IPv6 address\n" +
"  --port N             port to listen on\n" +
"  --tls                serve https (with --cert/--key, --self-sign or --letsencrypt)\n" +
"  --no-tls             serve http again (forgets --tls, --cert, --key, --self-sign,\n" +
"                       --letsencrypt and --redirect-port)\n" +
"  --cert FILE          TLS certificate file\n" +
"  --key FILE           TLS private key file\n" +
"  --self-sign          generate and use a self-signed certificate\n" +
"  --letsencrypt HOST   use the Let's Encrypt certificate for HOST (port 443)\n" +
"  --redirect-port N    also redirect http on port N to https\n" +
"  --user NAME          user to run as when started as root\n" +
"  --data DIR           data directory (default %s)\n" +
"  --logs DIR           logs directory (default %s)\n" +
"  --foreground         do not detach from the terminal\n" +
"  --background         detach from the terminal again (the default)\n" +
"  --defaults           forget all remembered options and use the built-in\n" +
"                       defaults, plus any options given with it\n" +
"  -h, --help           this message\n\n" +
"Built-in defaults: host %s, port %s%s.\n",
        me, me,
        info.dataDir, info.logsDir,
        d.bindAll ? 'all' : (d.ipAddr || 'localhost'), d.port, d.secure ? ', https' : '');
}

/* Copy the entries under `prefix/` of the zip to dest.
   policy "first":   only when dest does not exist yet
          "missing": also add files dest does not have; never replace any */
function bundleSeed(prefix, dest, policy) {
    var fresh = !stat(dest);
    if (!fresh && policy == 'first') return 0;
    var tmp = bundleDirname(dest) + '/.bundle-unpack-' + process.getpid();
    var n = 0;
    mkdir(tmp);
    try {
        utils.payloadExtract(tmp, [prefix]);
        var src = tmp + '/' + prefix;
        if (!stat(src)) return 0;
        if (fresh) {
            mkdir(bundleDirname(dest));
            utils.rename(src, dest);
            return 1;
        }
        (function walk(rel) {
            var names = utils.readDir(src + rel, true);
            for (var i = 0; i < names.length; i++) {
                if (names[i] == '.' || names[i] == '..') continue;
                var r = rel + '/' + names[i], from = src + r, to = dest + r;
                if (/(^|\/)\.\.?(\/|$)/.test(r)) continue;       /* never leave src/dest */
                var st = utils.lstat(from), have = utils.lstat(to);
                if (st.isDirectory && !st.isSymbolicLink) {
                    if (!have) mkdir(to);
                    walk(r);
                } else if (!have) {
                    utils.rename(from, to);
                    n++;
                }
            }
        })('');
    } finally {
        shell("rm -rf '" + tmp.replace(/'/g, "'\\''") + "'");
    }
    return n;
}

function bundleApplyOptions(serverConf, o) {
    if (o.host) {
        var h = String(o.host).replace(/^\[|\]$/g, '');
        if (h == 'all' || h == '*' || h == '0.0.0.0' || h == '::') {
            serverConf.bindAll = true;
        } else if (h == 'localhost') {
            serverConf.bindAll = false;
            serverConf.ipAddr = '127.0.0.1';
            serverConf.ipv6Addr = '[::1]';
        } else if (h.indexOf(':') != -1) {
            serverConf.bindAll = false;
            serverConf.ipAddr = '';
            serverConf.ipv6Addr = '[' + h + ']';
        } else {
            serverConf.bindAll = false;
            serverConf.ipAddr = h;
            serverConf.ipv6Addr = '';
        }
    }
    if (o.port !== undefined) {
        var p = parseInt(o.port);
        if (isNaN(p) || p < 1 || p > 65535) bundleDie("--port: invalid port '" + o.port + "'");
        serverConf.port = serverConf.ipPort = serverConf.ipv6Port = p;
    }
    if (o.tls) serverConf.secure = true;
    if (o.cert) { serverConf.sslCertFile = realPath(bundleExpand(o.cert)) || o.cert; serverConf.secure = true; }
    if (o.key)  { serverConf.sslKeyFile  = realPath(bundleExpand(o.key))  || o.key;  serverConf.secure = true; }
    if (o['self-sign']) { serverConf.selfSign = true; serverConf.secure = true; }
    if (o.letsencrypt) serverConf.letsencrypt = String(o.letsencrypt);
    if (o['redirect-port'] !== undefined) serverConf.redirPort = parseInt(o['redirect-port']);
    if (o.user) serverConf.user = String(o.user);
    if (o.foreground) serverConf.daemon = false;
}

function bundleSetup(serverConf) {
    var info = null;

    if (!utils.payloadGet) return serverConf;
    try {
        info = JSON.parse(utils.bufferToString(utils.payloadGet('bundle.json')));
    } catch (e) {
        info = null;
    }

    if (!info) {
        /* a bundle not made by the Mini IDE: writable data and logs in
           ~/.rampart/web_server_<addr:port>, as before                   */
        var addrPort = serverConf.bindAll ? "bindAll" : (serverConf.ipAddr || serverConf.ipv6Addr || '127.0.0.1');
        addrPort += ':' + (serverConf.port || serverConf.ipPort || serverConf.ipv6Port || '8088');
        var rpdir = (iam == 'root' ? '/tmp' : bundleHome()) + '/.rampart/web_server_' + addrPort;
        mkdir(rpdir + '/data');
        mkdir(rpdir + '/logs');
        serverConf.dataRoot = rpdir + '/data';
        serverConf.logRoot  = rpdir + '/logs';
        if (iam == 'root') {
            try {
                utils.chown({user: serverConf.user || 'nobody', path: serverConf.dataRoot});
                utils.chown({user: serverConf.user || 'nobody', path: serverConf.logRoot});
            } catch (e) { bundleDie(e.message); }
        }
        return serverConf;
    }

    /* split our options from the command (start, stop, ...) */
    var argv = process.argv, given = {}, cmdArgs = [], any = false;
    for (var i = 2; i < argv.length; i++) {
        var a = argv[i], m = /^(--[a-z-]+)=(.*)$/.exec(a), name = m ? m[1] : a, val = m ? m[2] : undefined;
        if (a == '-h' || a == '--help') { bundleHelp(info); process.exit(0); }
        if (bundleFlags.hasOwnProperty(name)) {
            if (bundleFlags[name]) {
                if (val === undefined) val = argv[++i];
                if (val === undefined) bundleDie(name + " needs a value");
            } else {
                val = true;
            }
            given[name.substring(2)] = val;
            any = true;
        } else {
            cmdArgs.push(a);
        }
    }

    /* saved options live in a fixed place per bundle name */
    var stateDir = bundleHome() + '/.rampart/' + info.name;
    var stateFile = stateDir + '/bundle-options.json';
    var cmd = cmdArgs[0] || 'start';
    /* given options update the remembered ones (all of them with --defaults) */
    var opts = {};
    if (given.defaults) {
        try { utils.rmFile(stateFile); } catch (e) {}
    } else {
        try { opts = JSON.parse(readFile(stateFile, {returnString: true})); } catch (e) { opts = {}; }
    }
    delete given.defaults;
    for (var g in given) {
        if (bundleUnsets[g]) {
            bundleUnsets[g].forEach(function (k) { delete opts[k]; });
            continue;
        }
        opts[g] = given[g];
    }
    if (any && /start|restart|letssetup/.test(cmd)) {
        mkdir(stateDir);
        fprintf(stateFile, '%3J\n', opts);
    }

    var dataDir = bundleExpand(opts.data || info.dataDir);
    var logsDir = bundleExpand(opts.logs || info.logsDir);

    /* process.argv keeps only the command for web_server_conf() */
    argv.length = 2;
    for (i = 0; i < cmdArgs.length; i++) argv.push(cmdArgs[i]);

    bundleApplyOptions(serverConf, opts);

    /* site files come from the zip; pid files, certificates, data and logs
       go in writable directories                                        */
    var zroot = serverConf.serverRoot || ':zip:';
    if (!serverConf.htmlRoot)   serverConf.htmlRoot   = zroot + '/html';
    if (!serverConf.appsRoot)   serverConf.appsRoot   = zroot + '/apps';
    if (!serverConf.wsappsRoot) serverConf.wsappsRoot = zroot + '/wsapps';
    mkdir(stateDir);
    serverConf.serverRoot = stateDir;

    if (cmd == 'start' || cmd == 'restart' || cmd == 'letssetup') {
        var fresh = !stat(dataDir);
        var n = bundleSeed('data', dataDir, info.seedPolicy == 'missing' ? 'missing' : 'first');
        if (fresh)
            printf("Data directory: %s\n", dataDir);
        else if (n)
            printf("Added %d new file%s to %s\n", n, n == 1 ? '' : 's', dataDir);
        mkdir(dataDir);
        mkdir(logsDir);
    }
    serverConf.dataRoot = dataDir;
    serverConf.logRoot  = logsDir;
    if (iam == 'root' && serverConf.user) {
        try {
            utils.chown({user: serverConf.user, path: stateDir});
            shell("chown -R '" + serverConf.user + "' '" + dataDir + "' '" + logsDir + "'");
        } catch (e) { bundleDie(e.message); }
    }
    return serverConf;
}

if(module && module.exports){

    module.exports= {
        bundleSetup: bundleSetup,
        parseOptions: parseOptions,
        start: start,
        stop:  stop,
        status:status,
        dumpConfig: dumpConfig,
        cmdLine: cmdLine,
        web_server_conf: web_server_conf
    }

} else {
    //skip first two (["rampart", "scriptname"])
    cmdLine(2);
}
