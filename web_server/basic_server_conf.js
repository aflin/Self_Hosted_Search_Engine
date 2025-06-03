#!/usr/bin/env rampart

/* *** A basic server using only rampart-server.so ***

the server can be started by running:
  rampart basic_server_conf.js
*/

//set working directory to the location of this script
var working_directory = process.scriptPath;

/* ****************************************************** *
 *  UNCOMMENT AND CHANGE DEFAULTS BELOW TO CONFIG SERVER  *
 * ****************************************************** */

var serverConf = {
    //the defaults for full server

    /* ipAddr              String. The ipv4 address to bind. use '0.0.0.0' to bind all  */
    //ipAddr:              '127.0.0.1',

    /* ipv6Addr            String. The ipv6 address to bind. use '[::]' to bind all   */
    //ipv6Addr:            '[::1]',

    /* ipPort              Number. Set ipv4 port   */
    //ipPort:              8088,

    /* ipv6Port            Number. Set ipv6 port   */
    //ipv6Port:            8088,

    /* htmlRoot            String. Root directory from which to serve files   */
    htmlRoot:              working_directory + '/html',

    /* appsRoot            String. Root directory from which to serve apps   */
    appsRoot:              working_directory + '/apps',

    /* wsappsRoot          String. Root directory from which to serve websocket apps   */
    wsappsRoot:            working_directory + '/wsapps',

    /* dataRoot            String. Setting for user scripts   */
    dataRoot:              working_directory + '/data',

    /* logRoot             String. Log directory   */
    logRoot:               working_directory + '/logs',

    /* log                 Bool.   Whether to log requests and errors   */
    log:                   true,

    /* accessLog           String. Log file name or null for stdout  */
    accessLog:             working_directory + '/logs/access.log',

    /* errorLog            String. error log file name or null for stderr*/
    errorLog:              working_directory + '/logs/error.log',

    /* user                String. If started as root, switch to this user
                                   It is necessary to start as root if using ports < 1024   */
    user:                'nobody',

    /* threads             Number. Limit the number of threads used by the server.
                                   Default (-1) is the number of cores on the system   */
    //threads:             -1,

    /* secure              Bool.   Whether to use https.  If true sslKeyFile and sslCertFile must be set   */
    //secure:              false,

    /* sslKeyFile          String. If https, the ssl/tls key file location   */
    //sslKeyFile:          '',

    /* sslCertFile         String. If https, the ssl/tls cert file location   */
    //sslCertFile:         '',

    /* developerMode       Bool.   Whether JavaScript errors result in 500 and return a stack trace.
                                   Otherwise errors return 404 Not Found                             */
    developerMode:       true,

    /* directoryFunc       Bool/Func.   Whether to provide a directory listing if no index.html is found   */
    //directoryFunc:       false,

    /* daemon              Bool.   whether to detach from terminal and run as a daemon  */
    //daemon:              false,

    /* scriptTimeout       Number. Max time to wait for a script module to return a reply in
                           seconds (default 20). Script callbacks normally should be crafted
                           to return in a reasonable period of time.  Timeout and reconstruction
                           of environment is expensive, so this should be a last resort fallback.   */
    scriptTimeout:       20,

    /* connectTimeout      Number. Max time to wait for client send request in seconds (default 20)   */
    connectTimeout:      20,

    /* serverRoot          String.  base path for logs, htmlRoot, appsRoot and wsappsRoot.
    //serverRoot:          rampart.utils.realPath('.'),  Note: here ere serverRoot is defined below

    /* map                 Object.  Define filesystem and script mappings, set below from htmlRoot,
                           appsRoot and wsappsRoot above.                                         */
    /*map:                 {
                               "/":                working_directory + '/html',
                               "/apps/":           {modulePath: working_directory + '/apps'},
                               "ws://wsapps/":     {modulePath: working_directory + '/wsapps'}
                           }
                           // note: if this is changed, serverConf.htmlRoot defaults et al will not be used or correct.
    */

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

                           Like beginFunc, it will also receive the `req` object.  In 
                           addition, `req.reply` will be set to the return value of the
                           normal server callback function and req.reply can be
                           modified before it is sent to the client.

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

    serverRoot:            working_directory
}

/* set map from options above */
serverConf.map={
   "/":                serverConf.htmlRoot,
   "/apps/":           {modulePath: serverConf.appsRoot},
   "ws://wsapps/":     {modulePath: serverConf.wsappsRoot}
};

/* set bind from options above */
var bind = [];

if(serverConf.ipAddr && serverConf.ipPort)
    bind.push(`${serverConf.ipAddr}:${serverConf.ipPort}`);

if(serverConf.ipv6Addr && serverConf.ipv6Port)
    bind.push(`${serverConf.ipv6Addr}:${serverConf.ipv6Port}`);

if(!bind.length)
    throw(new Error("No ip addr/port specified"));

serverConf.bind=bind;


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


/* **************************************************** *
 *                  start the server                    *
 * **************************************************** */
var server=require("rampart-server");

var iam = rampart.utils.exec('whoami').stdout.trim();

/* serverConf is a global variable and available in all server scripts */
var pid = server.start(serverConf);

rampart.utils.fprintf(working_directory + "/server.pid", "%d", pid);

if(iam == 'root')
    rampart.utils.chown({user:serverConf.user, path:working_directory + "/server.pid"});

if(serverConf.daemon) {
    rampart.utils.sleep(0.5);
    if(!rampart.utils.kill(pid, 0)) {
        printf("Failed to start webserver\n");
        process.exit(1);
    }
    rampart.utils.printf(`Server has been started.
Server pid is ${pid}.  To stop server use kill as such:
  kill ${pid}
`);

} else {
    rampart.utils.printf("Server has been started.\n");
}
