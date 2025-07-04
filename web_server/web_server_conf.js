#!/usr/bin/env rampart

// to run behind a proxy such as nginx, set httpOnly=true, and set httpOnlyPort
var httpOnly=false;
var httpOnlyPort=8070

/*
the server can be started by running:
  rampart web_server_config.js
         or
  rampart web_server_config.js start

Help:
  ./web_server_conf.js help
  usage:
    rampart web_server_conf.js [start|stop|restart|letssetup|status|dump|newcert|help]
        start     -- start the http(s) server
        stop      -- stop the http(s) server
        restart   -- stop and restart the http(s) server
        letssetup -- start http only to allow letsencrypt verification
        status    -- show status of server processes
        dump      -- dump the config object used for server.start()
        help      -- show this message
*/

//set working directory to the location of this script
var working_directory = process.scriptPath;

/* ****************************************************** *
 *  UNCOMMENT AND CHANGE DEFAULTS BELOW TO CONFIG SERVER  *
 * ****************************************************** */

var serverConf = {
    //the defaults for full server

    /* ipAddr              String. The ipv4 address to bind   */
    //ipAddr:              '127.0.0.1',

    /* ipv6Addr            String. The ipv6 address to bind   */
    //ipv6Addr:            '[::1]',

    /* bindAll             Bool.   Set ipAddr and ipv6Addr to 0.0.0.0 and [::] respectively   */
    bindAll:               true,

    /* ipPort              Number. Set ipv4 port   */
    //ipPort:              8088,

    /* ipv6Port            Number. Set ipv6 port   */
    //ipv6Port:            8088,

    /* port                Number. Set both ipv4 and ipv6 port if > -1   */
    port:                  443,

    /* htmlRoot            String. Root directory from which to serve files   */
    //htmlRoot:            working_directory + '/html',

    /* appsRoot            String. Root directory from which to serve apps   */
    //appsRoot:            working_directory + '/apps',

    /* wsappsRoot          String. Root directory from which to serve websocket apps   */
    //wsappsRoot:          working_directory + '/wsapps',

    /* dataRoot            String. Setting for user scripts   */
    //dataRoot:            working_directory + '/data',

    /* logRoot             String. Log directory   */
    //logRoot:             working_directory + '/logs',

    /* redirPort           Number. Launch http->https redirect server and set port if < -1  */
    //redirPort:           -1,

    /* redir               Bool.   Launch http->https redirect server and set to port 80   */
    redir:                 true,

    /* redirTemp           Bool. If true, and if redir is true or redirPort is set, send a
                                 302 Moved Temporarily instead of a 301 Moved Permanently   */
    redirTemp:             true, 

    /* accessLog           String. Log file name or null for stdout  */
    //accessLog:           working_directory + '/logs/access.log',

    /* errorLog            String. error log file name or null for stderr*/
    //errorLog:            working_directory + '/logs/error.log',

    /* log                 Bool.   Whether to log requests and errors   */
    log:                   true,

    /* rotateLogs          Bool.   Whether to rotate the logs   */
    //rotateLogs:          false,

    /* rotateStart         String. Time to start log rotations   */
    //rotateStart:         '00:00',

    /* rotateInterval      Number. Interval between log rotations in seconds or
                           String. One of "hourly", "daily" or "weekly"        */
    //rotateInterval:      86400,

    /* user                String. If started as root, switch to this user
                                   It is necessary to start as root if using ports < 1024   */
    //user:                'nobody',

    /* threads             Number. Limit the number of threads used by the server.
                                   Default (-1) is the number of cores on the system   */
    //threads:             -1,

    /* secure              Bool.   Whether to use https.  If true sslKeyFile and sslCertFile must be set   */
    secure:                true,

    /* sslKeyFile          String. If https, the ssl/tls key file location   */
    sslKeyFile:            working_directory + '/certs/shse-key.pem',

    /* sslCertFile         String. If https, the ssl/tls cert file location   */
    sslCertFile:           working_directory + '/certs/shse-cert.pem',

    /* developerMode       Bool.   Whether JavaScript errors result in 500 and return a stack trace.
                                   Otherwise errors return 404 Not Found                             */
    //developerMode:       true,

    /* letsencrypt         String. If using letsencrypt, the 'domain.tld' name for automatic setup of https
                                   ( sets secure true and looks for '/etc/letsencrypt/live/domain.tld/' directory
                                     to set sslKeyFile and sslCertFile ).
                                   ( also sets "port" to 443 ).                                                      */
    //letsencrypt:         "",     //empty string - don't configure using letsencrypt

    /* rootScripts         Bool.   Whether to treat *.js files in htmlRoot as apps
                                   (not secure; don't use on a public facing server)      */
    //rootScripts:         false,

    /* directoryFunc       Bool.   Whether to provide a directory listing if no index.html is found   */
    //directoryFunc:       false,

    /* daemon              Bool.   whether to detach from terminal and run as a daemon  */
    //daemon:              true,

    /* monitor':           Bool.   whether to launch monitor process to auto restart server if
                                   killed or unrecoverable error */
    monitor:               true,

    /* scriptTimeout       Number. Max time to wait for a script module to return a reply in
                           seconds (default 20). Script callbacks normally should be crafted
                           to return in a reasonable period of time.  Timeout and reconstruction
                           of environment is expensive, so this should be a last resort fallback.   */
    //scriptTimeout:       20,

    /* connectTimeout      Number. Max time to wait for client send request in seconds (default 20)   */
    //connectTimeout:      20,

    /* quickserver         Bool.   whether to load the alternate quickserver setting which serves
                                   files from serverRoot only and no apps or wsapps unless
                                   explicity set                                                    */
    //quickserver:         false,

    /* serverRoot          String.  base path for logs, htmlRoot, appsRoot and wsappsRoot.
    //serverRoot:          rampart.utils.realPath('.'),  Note: here ere serverRoot is defined below

    /* map                 Object.  Define filesystem and script mappings, set from htmlRoot,
                           appsRoot and wsappsRoot above.                                         */
    /*map:                 {
                               "/":                working_directory + '/html',
                               "/apps/":           {modulePath: working_directory + '/apps'},
                               "ws://wsapps/":     {modulePath: working_directory + '/wsapps'}
                           }
                           // note: if this is changed, serverConf.htmlRoot defaults et al will not be used or correct.
    */

    /* appendMap           Object.  Append the default map above with more mappings
                           e.g - {"/images": working_directory + '/images'}
                           or  - {"myfunc.html" : function(req) { ...} }
                           or  - {
                                     "/images": working_directory + '/images',
                                     myfunc.html: {module: working_directory + '/myfuncmod.js'}
                                 }                                                                 */
    //appendMap:           undefined,

    /* appendProcTitle     Bool.  Whether to append ip:port to process name as seen in ps */
    //appendProcTitle:     false,

    /* beginFunc           Bool/Obj/Function.  A function to run at the beginning of each JavaScript
                           function or on file load
                           e.g. -
       beginFunc:          {module: working_directory+'/apps/beginfunc.js'}, //where beginfunc.js is "modules.exports=function(req) {...}"
       or
       beginFunc:          myglobalbeginfunc,
       or
       beginFunc:          function(req) { ... }
       or
       beginFunc:          undefined|false|null  // begin function disabled

                           The function, like all server callback function takes
                           req, which if altered will be reflected in the call
                           of the normal callback for the requested page.
                           Returning false will skip the normal callback and
                           send a 404 Not Found page.  Returning an object (ie
                           {html:myhtml}) will skip the normal callback and send
                           that content.

                           For "file" `req.fsPath` will be set to the file being
                           retrieved.  If `req.fsPath` is set to a new path and
                           the function returns true, the updated file will be
                           sent instead.

                           For websocket connections, it is run only befor the
                           first connect (when req.count == 0)                    */
    //beginFunc:           false,

    /* beginFuncOnFile     Whether to run the begin function before serving a
                           file (-i.e. files from the web_server/html/ directory)  */
    //beginFuncOnFile:     false,

    /* endFunc             Bool/Obj/Function.  A function to run after each JavaScript function

                           Value (i.e. {module: mymod}) is the same as beginFunc above.

                           It will also receive the `req` object.  In addition,
                           `req.reply` will be set to the return value of the
                           normal server callback function and req.reply can be
                           modified before it is sent.

                           For websocket connections, it is run after websockets
                           disconnects and after the req.wsOnDisconnect
                           callback, if any.  `req.reply` is an empty object,
                           modifying it has no effect and return value from
                           endFunc has not effect.

                           End function is never run on file requests.                     */
    //endfunc:             false,

    /* logFunc             Function - a function to replace normal logging, if log:true set above
                           See two examples below.
                           -e.g.
                           logFunc: myloggingfunc,                                                 */
    //logFunc:             false,

    /* defaultRangeMBytes  Number (range 0.01 to 1000) default range size for a "range: x-"
                           open ended request in megabytes (often used to seek into and chunk videos) */
    //defaultRangeMbytes:  8,
    serverRoot:            working_directory,
}

/*  Example logging functions :
    logdata: an object of various individual logging datum
    logline: the line which would have been written but for logFunc being set

// example logging func - log output abbreviated if not 200
function myloggingfunc (logdata, logline) {
    if(logdata.code != 200)
        rampart.utils.fprintf(rampart.utils.accessLog,
            '%s %s "%s %s%s%s %d"\n',
            logdata.addr, logdata.dateStr, logdata.method,
            logdata.path, logdata.query?"?":"", logdata.query,
            logdata.code );
    else
        rampart.utils.fprintf(rampart.utils.accessLog,
            "%s\n", logline);
}

// example logging func - skip logging for connections from localhost
function myloggingfunc_alt (logdata, logline) {
    if(logdata.addr=="127.0.0.1" || logdata.addr=="::1")
        return;
    rampart.utils.fprintf(rampart.utils.accessLog,
        "%s\n", logline);
}
*/

/* Extras for shse */
if(httpOnly) {
   serverConf.secure=false;
   serverConf.redir=false; 
   serverConf.port=httpOnlyPort;
   serverConf.httpOnly=true;
}



/* A helper to restart with a new certificate */
if(process.argv[2] == "newcert") {
    rampart.globalize(rampart.utils);

    load.curl;
    load.server;

    var testport=22375;

    var cf=process.argv[3];
    var kf=process.argv[4];
    if(!cf || !kf) {
        printf("newcert requires the names (without path) of the cert file and the key file (in that order)\n  e.g. rampart web_server_conf.js newcert mycert.pem privkey.pem\n");
        process.exit(1);
    }
    var cstat = stat(working_directory + '/certs/' + cf);
    if(!cstat) {
        printf("newcert: '%s' not found in the './certs' directory\n", cf);
        process.exit(1);
    }
    var kstat = stat(working_directory + '/certs/' + kf);
    if(!kstat) {
        printf("newcert: '%s' not found in the './certs' directory\n", kf);
        process.exit(1);
    }

    //check modulus matches
    var cmod = shell('openssl x509 -noout -modulus -in ' + working_directory +'/certs/'+cf);
    var kmod = shell('openssl rsa -noout -modulus -in ' + working_directory + '/certs/'+kf);
    if (kmod.stderr) {
        fprintf(stderr,"%s openssl error: %s\n", kf, kmod.stderr);
        process.exit(1);
    }
    if (cmod.stderr) {
        fprintf(stderr,"%s openssl error: %s\n", cf, cmod.stderr);
        process.exit(1);
    }

    if (cmod.stdout != kmod.stdout) {
        fprintf(stderr, "key and cert do not match (different modulus)\n");
        process.exit(1);
    }

    // check permissions
    var iam = shell('whoami').stdout.trim();
    var servuser=iam;
    var cwrperm = cstat.permissions.charAt(7);

    if(servuser=='root')
        servuser = serverConf.user?serverConf.user:'nobody';

    if(cstat.owner != servuser) {
        if(iam=='root') {
            shell(`chown ${servuser} ${working_directory}/certs/*`);
            shell(`chmod 644 ${working_directory}/certs/${cf}`);
        } else {
            if(cwrperm != 'r') {
                fprintf(stderr,"newcert: '%s' is not ownend by %s and is not world readable\n", cf, cstat.owner);
                process.exit(1);
            }
        }
    }

    if(kstat.owner != servuser) {
        if(iam=='root') {
            shell(`chown ${servuser} ${working_directory}/certs/*`);
            shell(`chmod 600 ${working_directory}/certs/${kf}`);
        } else {
            fprintf(stderr,"newcert: '%s' is not ownend by %s\n", kf, kstat.owner);
            process.exit(1);
        }
    }
    if(kstat.permissions != "-rw-------") {
        fprintf(stderr,"newcert: '%s' has permissions %s, should be '-rw-------'\n", kf, kstat.owner);
        process.exit(1);
    }

    var lcert=serverConf.sslCertFile, lkey=serverConf.sslKeyFile;
    if(stat(lcert))
        rename(lcert, lcert+'.old');
    if(stat(lkey))
        rename(lkey, lkey+'.old');

    symlink(cf,lcert);
    symlink(kf,lkey);

    //make a test server to see if certs are working
    var pid = server.start({
        bind: [ "127.0.0.1:"+testport ],
        daemon:true,
        secure:true,
        sslKeyFile: lkey,
        sslCertFile: lcert,
        user: servuser,
        log:  true,
        errorLog: "/dev/null",
        accessLog: "/dev/null",
        map :
        {
            "/":   function(req){ return{txt:"ok"}; }
        }
    });
    var startfail=false;

    sleep(1);

    if(!kill(pid,0)) {
        startfail=true;
        fprintf(stderr,"Server failed to start with new certificate and key\n");
    } else {
        var res=curl.fetch('https://127.0.0.1:'+testport,{insecure:true});
        if(res.text != 'ok') {
            fprintf(stderr, "Server failed to respond: %s\n", res.statusText);
            startfail=true;
        }
    }

    kill(pid,15);

    if(startfail) {
        rmFile(lcert);
        rmFile(lkey);
        rename(lcert+'.old', lcert);
        rename(lkey+'.old', kcert);
        process.exit(1);
    }

    rmFile(lcert + '.old');
    rmFile(lkey + '.old');

    var spid = parseInt(readFile( working_directory + '/server.pid', true));

    if(serverConf.monitor) {

        var pid=daemon();
        if(pid>0) {
            printf("Server should restart in about 15 seconds\n");
        } else if (pid==0) {
            sleep(2); //give server time to relay message above
            kill(spid,15);
            sleep(1);
            kill(spid,9);
        } else {
            fprintf(stderr,"Error forking to restart server: %d\n",pid);
            process.exit(1);
        }

    } else {
        printf("Please manually restart the server\n");
    }
    process.exit(0);
}

var psl={};
var pslnots={};

function readlist(list) {
    var x=0, l, lr = rampart.utils.readLine(list);

    var iswild;

    while( (l=lr.next()) ){
        iswild='n';
        if(l=='\n'||l.substring(0,2)=='//')
            continue;
        l=l.trim();
        if(l.charAt(0) == '*') {
            iswild='y';
            l=l.substring(2);
        } else if (l.charAt(0)=='!') {
            pslnots[l.substring(1)]=true;
        }
        psl[l]=iswild;        
    }
}

// load public suffix list
function loadlist() {
    var fprintf=rampart.utils.fprintf;
    var curl=require('rampart-curl');
    var pslList = working_directory + '/public_suffix_list.dat';
    var text, res = curl.fetch('https://publicsuffix.org/list/public_suffix_list.dat');
    if(res.status!=200) {
        //fall back to saved version, if exists
        if(!stat(pslList)) {
            fprintf(stderr, "Could not download https://publicsuffix.org/list/public_suffix_list.dat\n");
            process.exit(1); 
        }
        fprintf(stderr, "Warning: Could not download public suffix list, using saved version\n");
    } else {
        fprintf(pslList,'%s',res.text);
    }
    readlist(pslList);
}

loadlist();

/* **************************************************** *
 *  process command line options and start/stop server  *
 * **************************************************** */
require("rampart-webserver").web_server_conf(serverConf);
