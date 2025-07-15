function scheduleUpdate(index, date, frequency, thresh, sql /* not working, tmpind */) {
    var Sql = require('rampart-sql');
    var tmpind;
    var interval=-1;
    var tbname;
    var params={};

    function thr(m){
        throw new Error('sql.scheduleUpdate() - ' + m);
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

        var res = rampart.utils.stringToNumber(f,true);
        if(res.min || res.max) return -1;

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

    if(res.TYPE != 'F' && res.TYPE != 'M')
        thr("index '" + index + "' is not a text index");

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
            if(d.offset==0){ //assume localtime if no timezone provided
                d = autoScanDate(date + ' ' + dateFmt('%z'));
            }
            date=Math.floor(d.date.getTime()/1000);
        }
    }

    if(date > -1) {
        interval = freq_to_sec(frequency)
        if(interval < 60)
            thr(sprintf("'%s' is an invalid frequency", frequency));

        if(thresh === undefined)
            thresh=1000;
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

    res = asql.one("select * from SYSTABLES where NAME='SYSUPDATE';");

    if(!res){
        asql.exec("create table SYSUPDATE (ID counter, NAME varchar(16), TBNAME varchar(16), PREVIOUS int, NEXT int, INTV int, THRESH int, STATUS int, PROGRESS double, PARAMS varchar(16));");
        asql.exec("GRANT SELECT on SYSUPDATE to PUBLIC");
    }
    asql.exec("delete from SYSUPDATE where NAME=?", [index]);

    if(date > -1)
        asql.exec("insert into SYSUPDATE values(counter,?,?,-1,?,?,?,0,0.0,?);", [index, tbname, date, interval, thresh, params]);
    //connect again to launch updater;
    asql = Sql.connect(sql.db);
}

function writemsg(msg){
    var d=new Date();
    rampart.utils.fprintf(sql.db+'/update.log', true, '%s - %s\n', rampart.utils.dateFmt('%Y-%m-%d %H:%M:%S',d), msg);
}

function thrmsg(msg) {
    writemsg(msg);
    process.exit(1);
}
    
function updater(sql) {

    function gettimes() {
        var now = Math.floor( (new Date).getTime() / 1000 );

        var ret=[];

        var res = sql.query('select * from SYSUPDATE;',{maxRows:-1}, function(row, i){

            var params;
            try {
                params=JSON.parse(row.PARAMS);
            } catch(e) {
                params={};
            }

            if(row.NEXT == 0) { //if start immediately
                ret.push({ next: now+row.INTV, id:row.ID, when: 0, what: row.NAME, thresh: row.THRESH, where: params.indexTemp});
            } else {
                var when = row.NEXT + 59;
                var next
                while( when < now)
                    when += row.INTV;
                next = row.INTV + when - 59;
                when -= now;
                ret.push({ next: next, id: row.ID, when: when, what: row.NAME, thresh: row.THRESH, where: params.indexTemp});
            }
        });
        if(res==-1)
            thrmsg(res.error);
        if(ret.length > 1)
            ret.sort(function(a,b){ return a.when - b.when});
        return {sched:ret, now:now};
    }


    function monitor(obj){
        var f=obj.fh, id=obj.id, stage=0, laststage=0, per=0, lastper=0;

        while(true) {
            var s = f.getString();
            if(s.indexOf('Final merge') != -1)
                stage=3;
            else if(s.indexOf('Indexing') != -1)
                stage=2;
            else if(s.indexOf('Creating') != -1)
                stage=1;
            if(stage){
                var h = Sql.rex('\\#+\\F[^\\#]*>>=', s);
                if(h.length)
                    per=h[0].length/79;
                else per=0;

                if( stage != laststage || per != lastper) {
                    var res = sql.query('update SYSUPDATE set STATUS=?, PROGRESS=? where ID=?;', [stage, per, id]);
                    laststage=stage;
                    lastper=per;
                }

                if(per==1.0 && stage==3)
                    return;

            }
            var done = rampart.thread.get('done',1000);
            if(done) {
                sql.query('update SYSUPDATE set PROGRESS=1.0 where ID=?;', [id]);
                rampart.thread.del('done');
                return;
            }
        }
    }

    function updateindex(sl,start)
    {
        var fh = fopenBuffer(stdout);
        var thr = new rampart.thread();
        var id=sl.id, index=sl.what, thresh=sl.thresh, tmpdir=sl.where;

        thr.exec(monitor, {fh:fh, id:id});

        try {
            if(getType(tmpdir) == 'String')
            {
                sql.set({addIndexTemp : tmpdir });
            }
            sql.exec('set indexmeter=1');
            var statement = sprintf('ALTER INDEX %s OPTIMIZE HAVING COUNT(NewRows) > %d;', index, thresh);
            var res = sql.query(statement);

            if(getType(tmpdir) == 'String')
                sql.set({delIndexTemp : tmpdir });
                //sql.exec("set delindextmp='" + tmpdir + "';");

        } catch(e) {
            fh.fclose();
            fh.destroy();
            rampart.thread.put('done',true);
            thr.close();
            return ''+e;
        }

        fh.fclose();
        fh.destroy();
        rampart.thread.put('done',true);
        thr.close();

        if(sql.errMsg.length)
        {
            return sql.errMsg;
        }
        var now = Math.floor( (new Date).getTime() / 1000 );
        var res=sql.query('update SYSUPDATE set NEXT=?, PREVIOUS=?, STATUS=0 where ID=?', [sl.next, now, id]);  
        if(res.error)
            return res.error;
        var msg = sprintf('%s update started:%s, completed:%s', index, dateFmt('%c %z', start), dateFmt('%c %z', now) ); 
        writemsg(msg);
        return false; /* no error */
    }

    function do_update(sl,now){
        var err = updateindex(sl,now);
        if(err)
            writemsg('update error: '+err);
    }

    function runloop(){
        var i, res, schline, pid = process.getpid();

        rampart.globalize(rampart.utils);
        var dbp='';
        try{dbp=' ' + realPath(sql.db);}catch(e){}
        process.setProcTitle('rampart indexUpdater'+dbp);
        fprintf( sql.db + '/updater.pid', '%s', pid);
        writemsg('updater started with pid ' + pid);

        while (true) {
            i=0;
            res = gettimes();
            if(res.sched.length==0) {
                writemsg('SYSUPDATE is emtpy - exiting');
                process.exit(0);
            }
            schline=res.sched[i];
            while(schline) {
                if(schline.when < 60) do_update(schline, res.now);
                else break;
                i++;
                schline=res.sched[i];
            }
            sleep(60);
        }
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
    res=sql.one('select * from SYSUPDATE');
    if(!res)
        return false;

    try { 
        epid=parseInt(rampart.utils.readFile(sql.db + '/updater.pid',true));
    } catch(e) {
        epid=-1;
    }

    if(epid>0 && rampart.utils.kill(epid, 0)){
        return false;
    }
    var res=rampart.utils.exec(process.installPathExec, process.modulesPath + '/rampart-sqlUpdate.js', npsql.db);

    if(res.exitStatus) {
        npsql.errMsg=res.stedrr;
        return false;
    }    
    return true;
}



if(module && module.exports)
    module.exports={ launchUpdater: launchUpdater, scheduleUpdate: scheduleUpdate}
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

    var res
    try {
        res=sql.one("select * from SYSUPDATE");
    } catch(e){
        var emsg=sprintf(stderr, "SQL error %s\n", sql.errMsg);
        fprintf(stderr,'%s',emsg);
        thrmsg(emsg);
    }

    if(!res) {
        fprintf(stderr, "SYSUPDATE is empty.  Nothing to do.\n");
        thrmsg("SYSUPDATE is empty.  Nothing to do.");
    }


    var fpid = daemon();

    if(fpid == -1) { //parent - fork fail, exit with message
        thrmsg('failed to fork new index updater process');
    }

    if(fpid) { //parent
        printf("update daemon started\n");
        process.exit(0);
    } else { //child
        updater(sql);
    }
}
