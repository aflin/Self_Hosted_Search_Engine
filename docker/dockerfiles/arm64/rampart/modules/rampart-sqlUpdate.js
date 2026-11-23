"noTranspile";
/* Internal — does the actual scheduling work.  `actionVerb` is
 * 'optimize' or 'rebuild'; it ends up in SYSUPDATE.PARAMS as a JSON
 * field the daemon reads to decide which ALTER INDEX statement to
 * issue.  Exported via scheduleUpdate (action='optimize') and
 * scheduleRebuild (action='rebuild'). */
function _scheduleUpdateImpl(actionVerb, index, date, frequency, thresh, sql) {
    var Sql = require('rampart-sql');
    var tmpind;
    var interval=-1;
    var tbname;
    var params={action: actionVerb};

    function thr(m){
        throw new Error('sql.' + (actionVerb === 'rebuild'
                                  ? 'scheduleRebuild'
                                  : 'scheduleUpdate') + '() - ' + m);
    }

    if(!sql)
        sql=this;

    if(!sql || !sql.db)
        thr('invalid invocation - sql handle missing');

    function freq_to_sec(f) {
        var t = rampart.utils.getType(f);
        var mult=1, inter=0, parts, per, perint;
        if(t=='Number')
            return f;
        else if (t!='String')
            thr('third argument must be a String or Number (frequency)');

        switch ( f.toLowerCase() ){
            case "daily":
                return 86400;
            case "hourly":
                return 3600;
            case "weekly":
                return 604800;
        }

        f=Sql.sandr( ['every','each','first','second','third','fourth','fifth','sixth','seventh','eighth','nineth','tenth','eleventh','twelfth','teenth','ieth'],
                    ['','','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','teen','y'],
                    f);

        var res, m = /^\s*(\d+(?:\.\d+)?)\s*(.*)$/.exec(f);
        if(m)
            res = {value: parseFloat(m[1]), rem: m[2]};
        else
            res = rampart.utils.stringToNumber(f,true);
        if(res && (res.min || res.max)) return -1;

        if(!res || !res.rem) {res={rem:f,value:1};}
        if (res.rem.indexOf('minute') != -1)
            perint=60;
        else if (res.rem.indexOf('hour') != -1)
            perint=3600;
        else if (res.rem.indexOf('day') != -1)
            perint=86400;
        else if (res.rem.indexOf('week') != -1)
            perint=604800;
        else
            return -1;
        
        return res.value * perint;
    }

    if(rampart.utils.getType(index) != 'String') thr('first arguement must be a string (index name)');
    var res=sql.one('select * from SYSINDEX where NAME=?', [index]);
    if(!res)
        thr("no such index '" + index + "'");

    tbname=res.TBNAME;

    /* SYSINDEX.TYPE codes: 'F'/'M' = fulltext/metamorph, 'N' = vec
     * (INDEX_VEC, dbstruct.h:205).  These are single-char column
     * values, not the C-level mnemonic. */
    if(res.TYPE != 'F' && res.TYPE != 'M' && res.TYPE != 'N')
        thr("index '" + index + "' is not a text or vector index");

    /* Map SYSINDEX.TYPE to the SYSUPDATE.KIND label that texisapi
     * itself writes (alterIndex.c sysupdate_kind_label).  For vec we
     * inspect SYSINDEX.PARAMS to distinguish backend — same string
     * match as the C side ("backend=ivfpq"). */
    var kindLabel = 'fulltext';
    if (res.TYPE == 'N') {
        kindLabel = (res.PARAMS && res.PARAMS.indexOf('backend=ivfpq') !== -1)
                    ? 'vec-ivfpq' : 'vec-hnsw';
    }

    if(rampart.utils.getType(date) == 'Date') {
        date = Math.floor(date.getTime()/1000);
    } else {
        if(rampart.utils.getType(date)=='String' && date.toLowerCase() == 'now')
            date=0;
        else if(rampart.utils.getType(date)=='String' && 
            ( date.toLowerCase() == 'never' || date.toLowerCase() == 'delete') )
            date=-1;
        else if(rampart.utils.getType(date)!='Number') {
            var d = rampart.utils.autoScanDate(date);
            if(!d)
                thr("could not parse date ('"+date+"')");
            var ms = d.date.getTime();
            /* no zone in the string: local time, at that date's UTC offset */
            if(!/%[zZ]/.test(d.matchedFormat || ''))
                ms += new Date(ms).getTimezoneOffset() * 60000;
            date=Math.floor(ms/1000);
        }
    }

    if(date > -1) {
        interval = freq_to_sec(frequency)
        if(interval < 60)
            thr(sprintf("'%s' is an invalid frequency", frequency));

        if(thresh === undefined) {
            /* Defaults differ by index kind.  Fulltext OPTIMIZE merges
             * the delta into a freshly-rebuilt index file, so the
             * cost scales with delta size — 1000 newrows is a typical
             * sweet spot for fulltext.  Vec OPTIMIZE byte-copies the
             * sealed `_I.idxpq` (~independent of delta size for
             * IVFPQ; HNSW reloads the whole graph).  The fixed cost
             * dominates, so a higher threshold makes sense to
             * amortize.  These are starting points — users can pass
             * an explicit number to override. */
            thresh = (res.TYPE == 'N') ? 10000 : 1000;
        }
        else if(rampart.utils.getType(thresh) != 'Number')
            thr('fourth argument, if defined, must be a Number (nRows)');

        if(thresh <1)
            thr('fourth argument, if defined, must be a Number greater than 0 (nRows)');

        if(tmpind !== undefined && rampart.utils.getType(tmpind)!='String')
            thr('fifth argument, if defined, must be a string (indexTmpPath)');
        if(tmpind){
            var st;
            if(!(st=rampart.utils.stat(tmpind)))
                thr('cannot use temp directory "' + tmpind +'" - does not exist or insufficient permissions');
            if(!st.isDirectory)
                thr('cannot use "' + tmpind +'" - not a directory');
            try { rampart.utils.touch(tmpind+'/._rp_index_test');}
            catch(e){ thr('cannot use temp directory "' + tmpind +'" - insufficient permissions'); }
            rampart.utils.rmFile(tmpind+'/._rp_index_test');
            if(tmpind.charAt(0) != '/') tmpind=rampart.utils.realPath(tmpind);/* don't get realpath if absolute (might have soft links in path) */
            params.indexTemp=tmpind;
        }
    }

    var asql = Sql.connect({path:sql.db, user:'_SYSTEM', noUpdater:true});

    /* SYSUPDATE is now auto-created and lifecycle-managed by texisapi
     * itself (see extern/texis/texisapi/sysupdate.c).  We just need
     * to ensure a row exists for this index and update the schedule
     * columns.  If texisapi hasn't yet inserted a row (e.g. user is
     * scheduling before any CREATE/ALTER has touched this index in
     * this session), we INSERT a row with run-state idle and
     * schedule columns populated.  If a row exists (texisapi created
     * it, or scheduleUpdate has been called before), we UPDATE only
     * the schedule columns — leaving texisapi-managed columns alone.
     *
     * Schedule semantics: NEXT/INTV/THRESH all = -1 means unscheduled.
     * The daemon's gettimes() filter ignores rows with NEXT < 0.
     */
    /* texisapi only creates SYSUPDATE on the next CREATE/ALTER INDEX; if it
       was dropped by hand we would fail here, so create it ourselves with
       the same 16-column schema (sysupdate.c: fixed forever). */
    if(!asql.one("select NAME from SYSTABLES where NAME='SYSUPDATE'")) {
        asql.exec("create table SYSUPDATE (ID counter, NAME varchar(16),"+
            " TBNAME varchar(16), KIND varchar(16), PREVIOUS int, NEXT int,"+
            " INTV int, THRESH int, ACTION varchar(16), STAGE int, NSTAGES int,"+
            " STAGENAME varchar(64), PROGRESS double, STARTED int,"+
            " COMMENTS varchar(255), PARAMS varchar(64))");
        asql.exec("grant select on SYSUPDATE to PUBLIC");
    }

    var paramsStr = JSON.stringify(params);
    var oldRow = asql.one("select ID from SYSUPDATE where NAME=?", [index]);

    if(date > -1) {
        if(oldRow) {
            asql.exec(
                "update SYSUPDATE set TBNAME=?, KIND=?, NEXT=?, INTV=?,"+
                " THRESH=?, PARAMS=? where ID=?",
                [tbname, kindLabel, date, interval, thresh, paramsStr, oldRow.ID]);
        } else {
            asql.exec(
                "insert into SYSUPDATE (NAME, TBNAME, KIND, PREVIOUS, NEXT,"+
                " INTV, THRESH, ACTION, STAGE, NSTAGES, STAGENAME, PROGRESS,"+
                " STARTED, COMMENTS, PARAMS) values"+
                " (?, ?, ?, -1, ?, ?, ?, '', 0, 0, '', 0.0, 0, '', ?)",
                [index, tbname, kindLabel, date, interval, thresh, paramsStr]);
        }
    } else {
        /* Unschedule: clear schedule columns but keep the texisapi
         * tracking row so progress/COMMENTS history is preserved.
         * Use NAME=? predicate (no ID needed) — works whether or not
         * a row exists. */
        asql.exec("update SYSUPDATE set NEXT=-1, INTV=-1, THRESH=-1,"+
                  " PARAMS='' where NAME=?", [index]);
    }

    //connect again to launch updater;
    asql = Sql.connect(sql.db);
}

/* Public surface — schedule periodic OPTIMIZE for a fulltext or vec
 * index.  Daemon issues `ALTER INDEX <name> OPTIMIZE HAVING COUNT(NewRows) > <thresh>`
 * at every poll cycle whose `when < 60` seconds.  `this` (the sql
 * connection) is forwarded so `_scheduleUpdateImpl`'s `sql=this`
 * fallback works when called as `sql.scheduleUpdate(...)`. */
function scheduleUpdate(index, date, frequency, thresh, sql) {
    return _scheduleUpdateImpl.call(this, 'optimize', index, date,
                                    frequency, thresh, sql);
}

/* Public surface — schedule periodic REBUILD for a vec index (fulltext
 * works too but is rarely needed; OPTIMIZE is usually enough).
 * REBUILD re-trains the index from scratch — for IVFPQ this refreshes
 * the codebooks against the current data distribution.  Daemon issues
 * `ALTER INDEX <name> REBUILD HAVING COUNT(NewRows) > <thresh>`. */
function scheduleRebuild(index, date, frequency, thresh, sql) {
    return _scheduleUpdateImpl.call(this, 'rebuild', index, date,
                                    frequency, thresh, sql);
}

/* Module-level log directory.  Set by the standalone bootstrap before
 * any writemsg() call; in module mode (scheduleUpdate / launchUpdater)
 * writemsg is unreachable so this stays null. */
var _logDb = null;
function writemsg(msg){
    if(!_logDb) return;
    var d=new Date();
    rampart.utils.fprintf(_logDb+'/update.log', true, '%s - %s\n', rampart.utils.dateFmt('%Y-%m-%d %H:%M:%S',d), msg);
}

function thrmsg(msg) {
    writemsg(msg);
    process.exit(1);
}

/* any live process with this pid, whoever owns it (kill(pid,0) is false on EPERM) */
function pidAlive(pid) {
    if (!(pid > 0)) return false;
    try {
        return rampart.utils.exec('ps', '-o', 'pid=', '-p', String(pid)).stdout.trim() !== '';
    } catch (e) { return true; }
}

/* Remove temp index files left by a crashed fulltext OPTIMIZE.  texis
   names them T<pid><letter><ext>.  Builds that texis tracks (REBUILD,
   vec) have a T<pid><letter>.PID file and an INDEX_TEMP row, and texis
   reaps those itself (it refuses to if the .PID file is gone, so leave
   them alone).  A Unix fulltext OPTIMIZE registers neither, so its
   leftovers are ours.  Only known temp extensions, only dead pids. */
var TEMP_EXTS = /^(|\.btr|\.dat|\.tok|_[DTXZC]\.btr|_P\.tbl|\.vec|\.vec\.new|_[HI]\.idxpq|_del\.btr|\.train\.tmp)$/;
function sweepStaleTemps(db) {
    var names, alive = {}, tracked = {};
    try { names = rampart.utils.readDir(db); } catch (e) { return; }
    for (var i = 0; i < names.length; i++) {
        var p = /^(T\d+[a-z])\.PID$/.exec(names[i]);
        if (p) tracked[p[1]] = true;
    }
    for (var i = 0; i < names.length; i++) {
        var m = /^(T(\d+)[a-z])(.*)$/.exec(names[i]);
        if (!m || !TEMP_EXTS.test(m[3]) || tracked[m[1]]) continue;
        if (alive[m[2]] === undefined) alive[m[2]] = pidAlive(parseInt(m[2]));
        if (alive[m[2]]) continue;
        try {
            rampart.utils.rmFile(db + '/' + names[i]);
            writemsg('removed stale temp file ' + names[i]);
        } catch (e) {}
    }
}

/* true if pid is alive AND is an index updater (guards against pid reuse) */
function isUpdaterPid(pid) {
    if (!(pid > 0) || !rampart.utils.kill(pid, 0)) return false;
    try {
        var r = rampart.utils.exec('ps', '-o', 'args=', '-p', String(pid));
        return r.stdout.indexOf('rampart indexUpdater') !== -1;
    } catch (e) { return true; } /* can't tell: be conservative */
}

/* Atomically claim the updater slot for a database.  POSIX link(2) is
 * atomic: it succeeds only when the target name doesn't exist.  We
 * write our PID to a private tmp path, then link() it to updater.pid;
 * exactly one concurrent claimant wins.  Losers see an existing
 * updater.pid; if its PID is still alive we exit cleanly, otherwise
 * we treat the lock as stale, remove it, and retry a few times.
 *
 * Returns true if we hold the slot, false if another live updater
 * already holds it (or we couldn't claim it after retries). */
function claimUpdaterSlot(db, mypid) {
    var pidPath = db + '/updater.pid';
    var tmpPath = db + '/updater.pid.tmp.' + mypid;
    var attempts = 3;

    while (attempts > 0) {
        try {
            rampart.utils.fprintf(tmpPath, '%d', mypid);
        } catch (e) {
            return false;
        }

        var linked = false;
        try {
            rampart.utils.link(tmpPath, pidPath);
            linked = true;
        } catch (e) {
            /* link() failed — most likely EEXIST.  Fall through. */
        }
        try { rampart.utils.rmFile(tmpPath); } catch (e) {}

        if (linked) return true;

        var existingPid = -1;
        try {
            existingPid = parseInt(rampart.utils.readFile(pidPath, true));
        } catch (e) {
            /* Lock file disappeared between link() and readFile().
             * Retry the link. */
            attempts--;
            continue;
        }

        if (existingPid > 0 && existingPid !== mypid &&
            isUpdaterPid(existingPid)) {
            /* Another live updater holds the slot. */
            return false;
        }

        /* Stale lock pointing to a dead PID (or to ourselves from a
         * prior failed attempt).  Clear it and retry. */
        try { rampart.utils.rmFile(pidPath); } catch (e) {}
        attempts--;
    }

    return false;
}

function updater(sql) {

    function gettimes() {
        var now = Math.floor( (new Date).getTime() / 1000 );

        var ret=[];

        /* Skip rows with NEXT < 0 — those are texisapi-managed
         * tracking rows for unscheduled indexes (e.g. just CREATEd
         * but not yet given a schedule).  Only schedule-bearing rows
         * concern the daemon's run loop. */
        var res = sql.query('select * from SYSUPDATE where NEXT >= 0;',
                            {maxRows:-1}, function(row, i){

            var params;
            try {
                params=JSON.parse(row.PARAMS);
            } catch(e) {
                params={};
            }

            /* `action` defaults to 'optimize' for backward-compat with
             * any pre-v3 schedule rows whose PARAMS doesn't include it. */
            var action = (params && params.action) || 'optimize';

            if(row.NEXT == 0) { //if start immediately
                ret.push({ next: now+row.INTV, id:row.ID, when: 0,
                           what: row.NAME, thresh: row.THRESH,
                           where: params.indexTemp, action: action});
            } else {
                // +59: treat anything due within the current minute as not yet past
                var when = row.NEXT + 59;
                var next;
                while( when < now)
                    when += row.INTV;
                next = row.INTV + when - 59;
                when -= now;
                ret.push({ next: next, id: row.ID, when: when,
                           what: row.NAME, thresh: row.THRESH,
                           where: params.indexTemp, action: action});
            }
        });
        if(res===null)
            thrmsg(sql.errMsg);
        if(ret.length > 1)
            ret.sort(function(a,b){ return a.when - b.when});
        return {sched:ret, now:now};
    }


    /* The screen-scraping monitor() thread that previously parsed
     * the indexmeter output to populate SYSUPDATE.STATUS / PROGRESS
     * is gone — texisapi now writes those columns directly during
     * CREATE/ALTER INDEX, so the daemon's per-cycle work is just to
     * issue ALTER INDEX synchronously and let the engine update
     * SYSUPDATE.  See extern/texis/texisapi/sysupdate.c. */

    function updateindex(sl,start)
    {
        var id=sl.id, index=sl.what, thresh=sl.thresh, tmpdir=sl.where;
        /* `sl.action` is 'optimize' (default for scheduleUpdate) or
         * 'rebuild' (scheduleRebuild).  Anything else falls back to
         * OPTIMIZE so a malformed PARAMS doesn't kill the daemon. */
        var actionVerb = (sl.action === 'rebuild') ? 'REBUILD' : 'OPTIMIZE';

        /* texisapi writes STAGE/STAGENAME/PROGRESS into SYSUPDATE
         * during the operation (see extern/texis/texisapi/sysupdate.c)
         * and clears them on completion.  No screen-scraping needed. */
        try {
            if(getType(tmpdir) == 'String')
            {
                sql.set({addIndexTemp : tmpdir });
            }
            /* String interpolation here is safe.  `index` came from
             * SYSUPDATE.NAME, which scheduleUpdate() above
             * cross-checked against SYSINDEX (line 58), and texis's
             * CREATE INDEX path itself rejects names that aren't
             * standard identifiers (verified empirically: a quoted
             * `CREATE INDEX "weird name" ON ...` fails downstream
             * even though the grammar tokenizes QSTRING).  `thresh`
             * is a Number validated at scheduleUpdate. */
            var statement = sprintf(
                'ALTER INDEX %s %s HAVING COUNT(NewRows) > %d;',
                index, actionVerb, thresh);
            var res = sql.query(statement);

            if(getType(tmpdir) == 'String')
                sql.set({delIndexTemp : tmpdir });

        } catch(e) {
            return ''+e;
        }

        /* texis message codes: 000-099 error, 100-199 warning, 200+ info
           (e.g. "200 INDEX_VEC ... absorbed N rows").  A prepare/exec
           failure does not throw here, so look at the codes. */
        if(sql.errMsg && sql.errMsg.length)
        {
            if(/^[01]\d\d /m.test(sql.errMsg))
                return sql.errMsg;
            writemsg(index + ' messages: ' + sql.errMsg.replace(/\n/g, ' | '));
        }
        /* texisapi has already written PREVIOUS=now and reset run-state
         * to idle in its End hook.  We just update NEXT to the next
         * scheduled run timestamp.  STATUS column no longer exists in
         * the v2 schema. */
        var now = Math.floor( (new Date).getTime() / 1000 );
        var res=sql.query('update SYSUPDATE set NEXT=? where ID=?',
                          [sl.next, id]);
        if(!res || res.error)
            return res ? res.error : (sql.errMsg || 'update SYSUPDATE failed');
        var msg = sprintf('%s update started:%s, completed:%s', index, dateFmt('%c %z', start), dateFmt('%c %z', now) );
        writemsg(msg);
        return false; /* no error */
    }

    function do_update(sl,now){
        try {
            var err = updateindex(sl,now);
            if(err)
                writemsg('update error: '+err);
        } catch(e) {
            /* updateindex currently returns errors as strings, but if
             * it ever throws we don't want the whole daemon to die. */
            writemsg('update error (uncaught): ' + (e && e.message ? e.message : e));
        }
    }

    function cycle(){
        var res = gettimes();
        if(res.sched.length==0) {
            writemsg('SYSUPDATE is empty - exiting');
            process.exit(0);
        }
        var i = 0;
        var schline = res.sched[i];
        if(schline && schline.when < 60)
            sweepStaleTemps(sql.db);
        while(schline) {
            if(schline.when < 60) do_update(schline, res.now);
            else break;
            i++;
            schline = res.sched[i];
        }
    }

    function runloop(){
        var pid = process.getpid();

        rampart.globalize(rampart.utils);
        var dbp='';
        try{dbp=' ' + realPath(sql.db);}catch(e){}
        process.setProcTitle('rampart indexUpdater'+dbp);
        /* updater.pid was written atomically by claimUpdaterSlot() at
         * startup; no need to overwrite here. */
        writemsg('updater started with pid ' + pid);

        /* Run an initial cycle now (don't wait 60s for the first
         * scheduled work).  setMetronome anchors subsequent cycles to
         * wall clock — if a cycle takes 5 minutes, the next fires once
         * on schedule rather than queueing 5 missed cycles. */
        cycle();
        setMetronome(cycle, 60000);
    }
    runloop();
}

function launchUpdater(npsql) {
    var Sql;

    try {
        Sql=require('rampart-sql');
        sql = Sql.connect({path: npsql.db, user: '_SYSTEM', noUpdater:true });
    } catch(e) {
        npsql.errMsg=e.message;
        return false;
    }

    var res, epid;

    res=sql.one("select * from SYSTABLES where NAME='SYSUPDATE'");
    if(!res)
        return false;
    /* Only launch the daemon if there's at least one scheduled row.
     * texisapi auto-inserts SYSUPDATE rows for every CREATE/ALTER
     * INDEX (with NEXT=-1 for tracking only); those don't warrant
     * daemon spawn.  A schedule has NEXT >= 0. */
    res=sql.one('select * from SYSUPDATE where NEXT >= 0');
    if(!res)
        return false;

    try { 
        epid=parseInt(rampart.utils.readFile(sql.db + '/updater.pid',true));
    } catch(e) {
        epid=-1;
    }

    if(epid>0 && isUpdaterPid(epid)){
        return false;
    }
    /* Pick the script the daemon subprocess will run.  When a zip payload is
       attached, prefer ":zip:/rampart-sqlUpdate.js" so the daemon runs the
       copy that ships with the bundle (avoids version skew with a separately
       installed rampart, and works on systems with no rampart install).
       Fall back to the on-disk modulesPath copy if the bundle doesn't carry
       this script.  payloadGet() takes a bare entry name (no ":zip:/" prefix)
       and throws on miss; treat the throw as "not in bundle". */
    var updaterScript = null;
    if (rampart.utils.payloadGet) {
        try {
            rampart.utils.payloadGet('rampart-sqlUpdate.js');
            updaterScript = ':zip:/rampart-sqlUpdate.js';
        } catch(e) { /* not in bundle */ }
    }
    if (!updaterScript) {
        updaterScript = process.modulesPath + '/rampart-sqlUpdate.js';
    }
    var res=rampart.utils.exec(process.installPathExec, updaterScript, npsql.db);

    if(res.exitStatus) {
        npsql.errMsg=res.stderr;
        return false;
    }    
    return true;
}



if(module && module.exports)
    module.exports={
        launchUpdater: launchUpdater,
        scheduleUpdate: scheduleUpdate,
        scheduleRebuild: scheduleRebuild
    }
else {
    rampart.globalize(rampart.utils);
    var db = process.argv[2];
    if(!db) {
        fprintf(stderr, "Error: This file is designed to be used as a module.\n");
        process.exit(1);
    }

    var Sql, sql;

    try {
        Sql=require('rampart-sql');
        sql = Sql.connect({path: db, user: '_SYSTEM', noUpdater:true });
    } catch(e) {
        fprintf(stderr,'%s\n',e.message);
        process.exit(1);
    }

    global.sql=sql;
    _logDb = db;

    /* Same scheduled-rows check launchUpdater does — we only want
     * to keep running if there's actual scheduled work to do. */
    var res
    try {
        res=sql.one("select * from SYSUPDATE where NEXT >= 0");
    } catch(e){
        var emsg=sprintf(stderr, "SQL error %s\n", sql.errMsg);
        fprintf(stderr,'%s',emsg);
        thrmsg(emsg);
    }

    if(!res) {
        fprintf(stderr, "no scheduled SYSUPDATE rows.  Nothing to do.\n");
        thrmsg("no scheduled SYSUPDATE rows.  Nothing to do.");
    }


    var fpid = daemon();

    if(fpid == -1) { //parent - fork fail, exit with message
        thrmsg('failed to fork new index updater process');
    }

    if(fpid) { //parent
        printf("update daemon started\n");
        process.exit(0);
    } else { //child
        /* Authoritative race resolver: when multiple Sql.connect()
         * calls (e.g. from concurrent threads of the same rampart
         * server) all spawn a daemon, only one wins this atomic
         * claim.  Losers exit silently. */
        if (!claimUpdaterSlot(db, process.getpid())) {
            process.exit(0);
        }
        sweepStaleTemps(db);
        updater(sql);
    }
}
