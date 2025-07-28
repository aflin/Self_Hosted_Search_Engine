#!/usr/bin/env rampart
rampart.globalize(rampart.utils);

//for use from command line
if(!global.serverConf) serverConf={
        dataRoot:realPath(process.scriptPath+'/../data'),
        serverRoot:realPath(process.scriptPath+'/../')
    }

var urlutil=require('rampart-url');

// in case not using the web_server_conf.js that comes with shse, we need to load psl
if(!global.psl || !global.pslnots) {
    global.psl={};
    global.pslnots={};

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
                continue;
            }
            psl[l]=iswild;        
        }
    }

    function loadlist(){
        var curl=require('rampart-curl');
        var pslList = serverConf.dataRoot + '/public_suffix_list.dat';
        var pslBackup = serverConf.serverRoot + '/public_suffix_list.dat';
        var pstat = stat(pslList);
        var downloadNew=false;
        var now = new Date();
        var maxAge=30; //days

        if(!pstat)
            downloadNew=true;
        else if( (now.getTime()-pstat.mtime.getTime())/86400000 > maxAge)
            downloadNew=true; 

        if(downloadNew) {
            var res = curl.fetch('https://publicsuffix.org/list/public_suffix_list.dat');
            if(res.status!=200) {
                //fall back to saved version, if exists
                if(!pstat) {
                    try {
                        rampart.utils.copyFile(pslBackup, pslList);
                    } catch(e) {
                        fprintf(stderr, "Could not download https://publicsuffix.org/list/public_suffix_list.dat and no backup found\n");
                        return;
                    }
                }
                fprintf(stderr, "Warning: Could not download public suffix list, using older saved version\n");
                readlist(pslList);
            } else
                fprintf(pslList,'%s',res.text);
        }
        readlist(pslList);
    }
    loadlist();
}





// function to extract a proper domain, removing any subdomains
// but respecting public suffix list.  suffix list is loaded in web_server_conf.js
// returns urlutil.components with added 'domain' property, if properly extracted.
function getDomain(url){
    var i=0, t, c
    
    if(/^file:\/\/\//.test(url))
        return {domain:'<filesystem>'}

    c=urlutil.components(url);
    if(!c || !c.host)
        return;

    var d=c.host;

    //ipv4 addr
    var m=d.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if(m && m.length==5){
        for(i=1;i<m.length;i++) {
            t=parseInt(m[i]);
            if(t>255 || t<0)
                break;
        }
        if(i==5) {
            c.domain=d;
            return c;
        }
    }

    //ipv6 address
    m=d.match(/^\[(?:[0-9a-fA-F]{1,4}:+){2,7}:?[0-9a-fA-F]{1,4}\]$/);
    if(m && m.length) {
        c.domain=d;
        return c;
    }

    if(pslnots[d])
        return d;

    var res, tdom, comp = d.split('.');

    // localhost and the like
    if(comp.length==1) {
        c.domain=d;
        return c;
    }

    var longest, level;

    for (i=comp.length-1; i>-1; i--){
        tdom = tdom ? `${comp[i]}.${tdom}`: comp[i];
        res=psl[tdom];
        if(res){
            if(res=='y' && i) {
                longest=comp[i-1] + '.' + tdom;
                level=i-1;
            } else {
                longest=tdom;
                level=i;
            }
        }
    }

    if(level)
        c.domain=comp[level-1] + '.' + longest;
    return c;
}

var cookie_expiration=86400;


var Sql     = use.sql;
var crypto  = use.crypto;
var urlutil = use.url;

var sql = Sql.connect(`${serverConf.dataRoot}/shse/`, true);

// for type ahead suggestions
sql.set({"indexaccess":true});

function indexExists(idxname) {
    return !!sql.one(`select * from SYSINDEX where NAME='${idxname}'`);
}

function tableExists(tbname) {
    return !!sql.one(`select * from SYSTABLES where NAME='${tbname}'`);
}

function makeSystemTables() {
    if(!tableExists("accounts")) {
        sql.exec(`create table accounts
        ( Id COUNTER, Acctid varchar(16), Type char(1), Acctinfo varchar(64)
        );`);
        if(!tableExists('accounts')) {
            fprintf(stderr, `error creating table 'accounts': %s\n`, sql.errMsg);
            return false;
        }
    }

    if(!indexExists("accounts_Acctid_ux")) {
        sql.exec(`create unique index accounts_Acctid_ux on accounts(Acctid);`);
        if(!indexExists("accounts_Acctid_ux")) {
            fprintf(stderr, "error creating index 'accounts_Acctid_ux': %s\n", sql.errMsg);
            return false;
        }
    }

    if(!tableExists("sessions")) {
        sql.exec(`create table sessions
        ( Acctid varchar(16), Type char(1), Sessid varchar(48), Expires date
        );`);
        if(!tableExists('sessions')) {
            fprintf(stderr, `error creating table 'sessions': %s\n`, sql.errMsg);
            return false;
        }
    }

    return true;
}

function sanitize_name(name) {
    var sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');

    if(name.length > 19 || sanitized != name) {
        //add hash to substr
        sanitized = sanitized.substr(0,8) + '_' + hash(name).substr(0,10);
    }
    if(sanitized.charAt(0)=='_')
        sanitized = "x"+sanitized.substring(1);
    return sanitized;
}

function makeUserTables(name) {
    var tbname = sanitize_name(name);
    if(!tableExists(`${tbname}_pages`)) {
        sql.exec(`create table ${tbname}_pages
        ( Hash byte(20), Last date, LastV date, Numvisits int,
          Dom varchar(32), Url varchar(128), Image varchar(128),
          Title varchar(64), Meta varchar(16), Text varchar(1024)
        );`);

        if(!tableExists(`${tbname}_pages`)) {
            fprintf(stderr, `error creating ${tbname}_pages: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_pages: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_pages_Dom_x`)) {
        sql.exec(`create index ${tbname}_pages_Dom_x on ${tbname}_pages(Dom);`);
        if(!indexExists(`${tbname}_pages_Dom_x`)) {
            fprintf(stderr, `error creating ${tbname}_pages_Dom_x: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_pages_Dom_x: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_pages_Hash_ux`)) {
        sql.exec(`create unique index ${tbname}_pages_Hash_ux on ${tbname}_pages(Hash);`);
        if(!indexExists(`${tbname}_pages_Hash_ux`)) {
            fprintf(stderr, `error creating ${tbname}_pages_Hash_ux: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_pages_Hash_ux: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_pages_Text_ftx`)) {
        sql.exec(`create fulltext index ${tbname}_pages_Text_ftx on ${tbname}_pages(Text)
            WITH WORDEXPRESSIONS ` +
            ```('[\alnum\x80-\xFF]{2,99}', '[\alnum\x80-\xFF$<>%@\-_+]{2,99}');```
        );
        if(!indexExists(`${tbname}_pages_Text_ftx`)) {
            fprintf(stderr, `error creating ${tbname}_pages_Text_ftx: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_pages_Text_ftx: %s`, sql.errMsg)};
        }
    }

    if(!tableExists(`${tbname}_history`)) {
        sql.exec(`create table ${tbname}_history (Hash byte(20), Date date, Day dword,
                  Url varchar(128), Dom varchar (32), Label varchar(16), Title varchar(64));`);
        if(!tableExists(`${tbname}_history`)) {
            fprintf(stderr, `error creating ${tbname}_history: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_history: %s`, sql.errMsg)};
        }
    }


    if(!indexExists(`${tbname}_history_Hash_x`)) {
        sql.exec(`create index ${tbname}_history_Hash_x on ${tbname}_history(Hash);`);
        if(!indexExists(`${tbname}_history_Hash_x`)) {
            fprintf(stderr, `error creating ${tbname}_history_Hash_x: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_history_Hash_x: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_history_Day_x`)) {
        sql.exec(`create index ${tbname}_history_Day_x on ${tbname}_history(Day);`);
        if(!indexExists(`${tbname}_history_Day_x`)) {
            fprintf(stderr, `error creating ${tbname}_history_Day_x: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_history_Day_x: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_history_Date_x`)) {
        sql.exec(`create index ${tbname}_history_Date_x on ${tbname}_history(Date);`);
        if(!indexExists(`${tbname}_history_Date_x`)) {
            fprintf(stderr, `error creating ${tbname}_history_Date_x: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_history_Date_x: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_history_Dom_x`)) {
        sql.exec(`create index ${tbname}_history_Dom_x on ${tbname}_history(Dom);`);
        if(!indexExists(`${tbname}_history_Dom_x`)) {
            fprintf(stderr, `error creating ${tbname}_history_Dom_x: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_history_Dom_x: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_history_Dom_ftx`)) {
        sql.exec(`create fulltext index ${tbname}_history_Dom_ftx on ${tbname}_history(Dom) WITH WORDEXPRESSIONS ('[\\alnum\\x80-\\xFF\\.]{2,99}');`);
        if(!indexExists(`${tbname}_history_Dom_ftx`)) {
            fprintf(stderr, `error creating ${tbname}_history_Dom_ftx: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_history_Dom_ftx: %s`, sql.errMsg)};
        }
    }

    if(!tableExists(`${tbname}_heatstats`)) {
        sql.exec(`create table ${tbname}_heatstats (Day dword, Cnt dword)`);
        if(!tableExists(`${tbname}_heatstats`)) {
            fprintf(stderr, `error creating ${tbname}_heatstats: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_heatstats: %s`, sql.errMsg)};
        }
    }

    if(!indexExists(`${tbname}_heatstats_Day_x`)) {
        sql.exec(`create index ${tbname}_heatstats_Day_x on ${tbname}_heatstats(Day);`);
        if(!indexExists(`${tbname}_heatstats_Day_x`)) {
            fprintf(stderr, `error creating ${tbname}_heatstats_Day_x: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_history_Day_x: %s`, sql.errMsg)};
        }
    }

    // set updater to run at 2 am
    try {
        var n=new Date();
        var schtime = dateFmt('%Y-%m-%d 02:00:00 %z', 86400 + n.getTime()/1000);
        sql.scheduleUpdate(`${tbname}_history_Dom_ftx`, schtime, 'daily', 300);
        sql.scheduleUpdate(`${tbname}_pages_Text_ftx`, schtime, 'daily', 300);
    } catch(e) {
        fprintf(stderr, 'error setting schedule: %s\n', e.message);
        return {error: sprintf(stderr, 'error setting schedule: %s\n', e.message)};
    } 
    return true;
}

/* TEMPLATE and other html or scripts*/
var htmlHeadfmt=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Self Hosted Search Engine</title>
  <script src="/js/jquery-3.7.1.min.js"></script>
  <script src="/js/jquery-ui-1.13.2.min.js"></script>
  <script src="/js/shse.js"></script>
  <link rel="stylesheet" href="/css/themes/current/jquery-ui.css">
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/shse.css">
  <script>var username="%s";</script>
`;

var endHtmlHead="</head>";
var htmlBody="<body>";

var htmlTop=`
  <header>
    <img src="/images/logo.png" alt="Self Hosted Search Engine Logo">
      <nav>
        <div class="nav-left">
          <a href="/apps/shse/user.html">Home</a>
          <a href="/apps/shse/history.html">History</a>
          <a href="https://github.com/aflin/Self_Hosted_Search_Engine">GitHub</a>
        </div>
        <div class="nav-right">
          <a id="logout" href="login.html?logout=1">Log out</a>
        </div>
      </nav>
`;

// If the certs dir is missing (i.e. this script has been integrated into another rampart-server env)
// then don't dislay certs link.
var hidecerts=serverConf.httpOnly;
if(!hidecerts)
    hidecerts = !stat(serverConf.serverRoot+'/certs');

var adminHtmlTop=`
  <header>
    <img src="/images/logo.png" alt="Self Hosted Search Engine Logo">
      <nav>
        <div class="nav-left">
          <a href="/apps/shse/user.html">Home</a>
          <a href="/apps/shse/history.html">History</a>
          <a href="https://github.com/aflin/Self_Hosted_Search_Engine">GitHub</a>
        </div>
        <div class="nav-right">
          <a href="/apps/shse/admin.html">Users</a>
          ${hidecerts?'':'<a href="/apps/shse/certs.html">Certificates</a>'}
          <a id="logout" href="login.html?logout=1">Log out</a>
        </div>
      </nav>
`;

var hamHtml = `
<div class="mobile-menu" id="mobileMenu">
  <a href="/apps/shse/user.html">Home</a>
  <a href="/apps/shse/history.html">History</a>
  <a href="https://github.com/aflin/Self_Hosted_Search_Engine">GitHub</a>
  <a href="/apps/shse/admin.html">Users</a>
  <a id="logout" href="login.html?logout=1">Log out aaron</a>
</div>
`;

var htmlSearch=`
    <script src="/js/jquery.autocomplete.min.js"></script>
    <div class="search-box">
      <form action="/apps/shse/search.html" method="get">
        <div class="swrap">
          <input type="text" autocomplete="off" id="fq" name="q" `;

var endHtmlSearch=`placeholder="Search" required>
          <input type="submit" value="Search">
        </div>
      </form>
    </div>
    <button class="hamburger" id="hamburger">&#9776;</button>
`;

var htmlTopend=`
  <div class="divider"><div>
  </header>
`;

var htmlMain="<main>";

var htmlAbout=`
    <section>
      <h2>About</h2>
      <p>
        Self Hosted Search Engine is a lightweight, privacy-respecting search platform
        that you can run on your own hardware. Designed for developers, archivists, and anyone
        who wants full control over their indexed data.
      </p>
    </section>

    <section>
      <h2>Key Features</h2>
      <ul>
        <li>Full-text search across visited websites</li>
        <li>Choose between automatic indexing or manual mode</li>
        <li>Individual processing of Facebook and BlueSky posts</li>
        <li>Automatic indexing of Youtube captions.</li>
        <li>Easy server deployment on Linux and macOS</li>
      </ul>
    </section>
`;

var endHtmlMain="</main>";
var htmlFooter = `
  <footer>
    &copy; 2025 <a href="https://rampart.dev">Moat Crossing Systems, LLC</a>. Released under <a href="https://opensource.org/license/mit">MIT License.</a>
  </footer>
`;
var endHtmlBody=`
</body>
</html>
`;

/* END TEMPLATE and other html or scripts*/


var loginredir = {
    html:
        "<html><body><h1>302 Moved Temporarily</h1>"+
        '<p>Document moved <a href="login.html">here</a></p></body></html>',
    status:302,
    headers: { "location": "login.html"}
}


function checkcred(req, require_admin) {
    if(!req.cookies.sessid) {
        return false;
    }

    var res, now;

    try{
        res = sql.one("select Type type, Acctid name from sessions where Sessid=?", [req.cookies.sessid]);
    } catch(e){}
    if(!res)  {
        return false;
    }

    if(require_admin && res.type.toLowerCase() != 'a') {
        return false;
    }

    now = parseInt(dateFmt('%s'));

    sql.one("update sessions set Expires=? where Sessid=?", [cookie_expiration + now, req.cookies.sessid]);

    res.tbname = sanitize_name(res.name);

    return res;
}

function dosearch(q,u,s) {
    s= s ? parseInt(s) :0;

    sql.set({
        alEquivs: true,  //allow searches with '~myterm' for thesaurus lookup
        minwordlen: 6,
        // the full suffix list (https://rampart.dev/docs/sql-set.html#suffixlist) is a bit
        // much for a small corpus, especially when doing one word searches.  Here is a slightly
        // more sane list.  This might change in the future.
        suffixList: ["'",  "ies",  "s", 'ing', 'tion', 'sion', "able", "ible", 'ic', 'ed']
    })
    if(s>90)
        sql.set({likeprows: s+100});
    //  image, url, last, hash, dom, title, abstract
    var res={rows:[]};
    res.rowCount=sql.exec(`select bintohex(Hash) hash, convert( Last , 'int' ) last, Dom dom, Url url, Image image, Title title,
        abstract(Text,0,'querymultiple',?q) abstract
        from ${u}_pages where Text likep ?q`,
        {q:q}, {skipRows: s, includeCounts:true },
        function(r,i,c,counts) {
            if(!res.countInfo)
                res.countInfo=counts;
            r.abstract = Sql.stringFormat('%mbH',q, r.abstract);
            res.rows.push(r);
        }
    );

    return res;
}

var ricos='<span title="Remove" class="rm rico hm">&#x2718;</span><span title="Remove" class="rm rmcb hm"><input type="checkbox" class="sitem" title="select item"></span>';

function searchpage(req) {
    var top, user, tbname, cred=checkcred(req);

    if(!cred)
        return loginredir;
    user=cred.name;
    tbname=cred.tbname;
    if(!user || !tbname)
        return loginredir;

    var res, p=req.params;
    var q = p.q?p.q:'';
    var skip=p.sk?parseInt(p.sk):0;

    if(cred.type.toLowerCase()=='a')
        top=adminHtmlTop;
    else
        top=htmlTop;
    var head=sprintf(htmlHeadfmt, user);
    req.put(`
${head}
${endHtmlHead}
${htmlBody}
${top}
${hamHtml}
${htmlSearch}value="${%H:q}" ${endHtmlSearch}
${htmlTopend}
${htmlMain}
`);
    if(p.q) {
        res=dosearch(p.q,tbname,skip);
        var total = res.countInfo.indexCount;
        var cntinfo = res.rowCount ?
                      `Results ${skip+1}-${skip+res.rowCount} of ${total}` :
                      `no ${total?'more ':''}results for ${q}`;
//req.printf("<pre>%H</pre>", sprintf("\n%3J\n", res) );
        req.put(`
<div id="res">
    <div title="click to show database editing options" id="showrm">
        <label class="hide ib sall">
            <input style="vertical-align:middle" type="checkbox" id="sall" class="hide ib" title="Select All">Select All
        </label>
        <span id="showopt" style="position:relative;">
            <span id="showlabel">Options</span>
            <span id="showico" title="click to hide database editing options">‣</span>
        </span>
        <span style="display:inline-block;height:22px;padding: 2px 0px 0px 5px;">&nbsp;
            <span id="delsel" class="hide">
                <button style="padding: 2px 5px 0px 5px;border:1px solid #b00; border-radius:7px; position:relative;top:0px;left:45px;" id="rmselected">Remove Select Items</button>
            </span>
        </span>
        <span style="${res.rowCount?'float:right':'width:100%;text-align:center;display: inline-block;font-size: 16px;'}">${cntinfo}</span>
    </div>`);
        for (var i=0;i<res.rows.length;i++) {
			var r=res.rows[i];
			var favico, ico=r.image;
			var icl = r.image? " hov" : '';
			var d= new Date(0);
			d.setUTCSeconds(parseInt(r.last));

			favico=r.url.match(/^https?:\/\/[^/]+/)+'/favicon.ico';

			/*
			if(!r.image) {
			    ico='/images/home_website_start_house.svg'
			    //icl = icl + ' cfav';
            }
			req.put('<div data-hash="'+r.hash+'" data-dom="'+r.dom+'" id="r'+i+'" class="resi"><span class="imgwrap">'+ricos+
                '<img class="fimage'+icl+'" src="'+ico+'"'+
                (favico?' data-favico="'+favico+'"':'') + '></span>'+
                '<span class="itemwrap"><span class="abstract nowrap"><a class="url-a tar" ' +
                'target="_blank" href="'+r.url+'">'+
                sprintf("%H",r.title.replace(/\s+/g,' '))+'</a><span class="timestamp">('+d.toLocaleString()+
                ')</span></span><br><span class="abstract url-span">'+r.url+
                '</span></span><br><span class="abstract">'+r.abstract+"</span></div>"
			);
			*/
			req.put(`
<section class="entry" data-hash="${r.hash}" data-dom="${r.dom}">
  ${ricos}
  <div class="info">
    <div class="link">
      <a target="_blank" href="${r.url}">${sprintf("%H",r.title.replace(/\s+/g,' '))}</a>
    </div>
    <div class="subtext">
      <img src="${favico}" class="resico" />
      <span class="url-text">&gt; ${r.url}<br>
      </span>
    </div>
    <div class="description">
        ${r.image ? '<img src="' + r.image + '" class="hov hov-inline">':''}
        ${r.abstract}
    </div>
  </div>
  <div class="thumb">
      <span class="tstamp">(${dateFmt('%m/%d/%Y %H:%M',d)})</span><br>`
      + ( r.image ? `<img src=${r.image} class="hov">` : '' ) +
  `</div>
</section>`);
        }
        req.put('</div>');
    }

    // number pages like        1  2  3  4  5  6  7  8  9 10 Next    or
    //                   Prev   1 ..  6  7  8  9 10 11 12 13 Next
    skip = Math.floor(skip/10) * 10;
    var i=0, pag='', surl=`/apps/shse/search.html?q=${%U:q}`;
    var curpage = skip/10 + 1;
    var npages = 1 + Math.floor(total/10);
    var ppages;
    if(total>0) {
        if(skip < 55) {
            if(curpage>1)
                pag=`<span class="ppag"><a href="${surl}&sk=${skip-10}">Prev</a></span>`;
            if(npages > 10) ppages=10;
            else ppages=npages;
        } else {
            pag=`<span class="ppag"><a href="${surl}&sk=${skip-10}">Prev</a></span>`+
                `<span class="pag"><a href="${surl}">1</a></span>` +
                '<span class="pag">..</span>';
            ppages=curpage+3;
            if(ppages>npages)ppages=npages;
            i=curpage-5;
        }

        for (;i<ppages;i++) {
            if(i==curpage-1)
                pag+=`<span class="pag">${i+1}</span>`;
            else if(!i)
                pag+=`<span class="pag"><a href="${surl}">1</a></span>`
            else
                pag+=`<span class="pag"><a href="${surl}&sk=${i*10}">${i+1}</a></span>`
        }
        skip+=10;
        if(skip<total)
            pag+=`<span class="npag"><a href="${surl}&sk=${skip}">Next</a></span>`;
    }
    return {html:`
<p><center>${pag}</center></p>
${endHtmlMain}
${htmlFooter}
${endHtmlBody}`}


}

function userpage(req){
    var cred = checkcred(req);
    if(!cred)
        return loginredir;

    var top;
    if(cred.type.toLowerCase()=='a')
        top=adminHtmlTop;
    else
        top=htmlTop;

    var head=sprintf(htmlHeadfmt, cred.name);
    return {html:`
${head}
${endHtmlHead}
${htmlBody}

${top}
${hamHtml}
${htmlSearch}${endHtmlSearch}
${htmlTopend}
${htmlMain}

${htmlAbout}

${endHtmlMain}
${htmlFooter}
${endHtmlBody}

`};
}

var nMonths=3;

function heatdata(req,p,tbname) {
    var nm = p.nMonths ? p.nMonths : nMonths;
    var sm=parseInt(p.startm), sy=parseInt(p.starty);
    var em=sm+nm; ey=sy;
    if(em>12) {em-=12;ey++;}

    var startdate= `${sy}-${sm}-01`;
    var enddate  = `${ey}-${em}-01`;
    var today, max=0, res, rows, i;

    res = sql.one("select dayseq(convert(?,'date')) d", [startdate]);
    startdate=res.d;

    res = sql.one("select dayseq(convert(?,'date')) d", [enddate]);
    enddate=res.d-1;

    res = sql.one("select dayseq(convert(?,'date')) d", [dateFmt('%Y-%m-%d')]);
    today=res.d;

    if(enddate > today) enddate=today;
    rows=[];

    //how many days should we have?
    var expected=(enddate - startdate) + 1;

    // no caching in heatstats if dom
    if(p.dom) {
        rows[expected-1]=0;
        sql.exec(`select Day Day, count(Day) Cnt from ${tbname}_history 
                    where Day >= ? and Day <= ? and Dom=? group by Day order by Day`,
            [startdate,enddate,p.dom],
            function(row,i) {
                rows[row.Day-startdate]=row.Cnt;
            },
            {maxRows:-1}
        );
        for (i=0;i<expected;i++) {
            if(!rows[i])
                rows[i]=0;
            else if(rows[i]>max)
                max=rows[i]
        }
        return {json: {rows:rows,max:max}};
    }

    //get them from heatstat table
    res = sql.exec(`select Day, Cnt from ${tbname}_heatstats where Day >= ? and Day <= ?`,
        [startdate, enddate], {maxRows:-1},
        function(row) {
            if(row.Cnt>max)max=row.Cnt;
            rows[row.Day-startdate]=row.Cnt;
        }
    );

    if(res != expected) {
        for (i=0;i<expected;i++)
        {
            if(rows[i]===undefined || i==today) {
                var curday=i+startdate;
                res=sql.one(`select count(Day) cnt from ${tbname}_history where Day = ?`,[curday]);
                if(res && res.cnt) res=res.cnt;
                else res=0;
                if(curday!=today) //this one can still change, don't insert
                    sql.one(`insert into ${tbname}_heatstats values (?,?)`,[curday,res]);
                rows[i]=res;
                if(res>max)max=res;
            }
        }
    }
    return {json: {rows:rows,max:max}};
}

function bydom(req, p, tbname) {

    var startdate=parseInt(p.start)/1000, enddate=(parseInt(p.end)+1)/1000;
    var res=sql.one(`select count(Dom) cnt from ${tbname}_history
                        where Date >= ? and Date < ? and Dom=?`,
                        [startdate, enddate, p.dom]);
    var cnt=res.cnt;

    if(cnt > 2000) {
        return {json:{res:[], nrows: cnt, displayLazy:true}}
    }
    var res=sql.exec(`select bintohex(Hash) Hash, Date, Dom, Day, Url, Title from ${tbname}_history
                        where Date >= ? and Date < ? and Dom=? order by Date DESC;`,
              {maxRows: -1},[parseInt(p.start)/1000, (parseInt(p.end)+1)/1000, p.dom]);

    return({json:{res:res, nrows: cnt}});
    
}

function histdata(req) {
    var p=req.params;
    var user,tbname;
    var sres = checkeither(req);
    if(sres.status)
        return makeReply( {json: sres} );
    else {
        user=sres.user;
        tbname=sres.tbname;
    }
    if(p.getFirst && p.dom) {
        var res = sql.one(`select Date from ${tbname}_history where Dom=?dom order by Day`,p);
        if(res)
            return{json:{start:dateFmt('%Y-%m-%dT%H:%M:%S.000Z',res.Date)}};
        else
            return{json:{}};
    }

    if(p.getLast && p.dom) {
        var res = sql.one(`select Date from ${tbname}_history where Dom=?dom order by Day DESC`,p);
        if(res)
            return{json:{end:dateFmt('%Y-%m-%dT%H:%M:%S.000Z',res.Date)}};
        else
            return{json:{}};
    }

    if(p.startm && p.starty)
        return heatdata(req,p,tbname);

    if(!p.start || !p.end)
        return { json: {} }

    if(p.dom)
        return bydom(req,p,tbname);

    if(!p.date)
        return { json: {} }

    var d=autoScanDate(p.date);
    var start = dateFmt('%Y-%m-%d', d.date);
    var end = start + ' 23:59:59';

    start+=' 00:00:00';

    //    return {txt: `select * from ${tbname}_history where Date >= ? and Date < ? order by Date; ${parseInt(p.start)/1000} ${(parseInt(p.end)+1)/1000}`}

    var res=sql.exec(`select bintohex(Hash) Hash, Date, Dom, Day, Url, Title from ${tbname}_history where Date >= ? and Date < ? order by Date DESC;`,
              {maxRows: -1},[parseInt(p.start)/1000, (parseInt(p.end)+1)/1000]);

    return({json:{res:res, start:dateFmt('%Y-%m-%dT%H:%M:%S.000Z',start), end:dateFmt('%Y-%m-%dT%H:%M:%S.999Z',end)}});
}

function historypage(req) {
    var top, user, cred=checkcred(req);

    if(!cred)
        return loginredir;
    user=cred.name;
    if(!user)
        return loginredir;

    var res, p=req.params;
    var q = p.q?p.q:'';

    if(cred.type.toLowerCase()=='a')
        top=adminHtmlTop;
    else
        top=htmlTop;
    var head=sprintf(htmlHeadfmt, user);
    req.put(`
${head}
<script>
    var nMonths=${nMonths};
</script>
<script src="/js/hist.js"></script>
${endHtmlHead}
${htmlBody}

${top}
${hamHtml}
${htmlSearch}${endHtmlSearch}
${htmlTopend}
${htmlMain}

<div id="datepicker"></div>
<div class="sopts">
    <!--button class="groupby" style="visibility: hidden;" id="groupby">Order by Date</button-->
    <span class="grpby">
        <span class="by" id="bysitel" for="bysite">By Site</span>
        <span class="by" id="bydatel" for="bydate">By Date</span>
    </span>
    <span class="swrap2">
      <input type="text" spellcheck="false" autocomplete="off" id="dq" name="dq" placeholder="By Domain (Search)">
      <input id="dsearch" type="submit" value="Search">
    </span>
</div>
<div id="hres"></div>
`);

    return {html:`
${endHtmlMain}
${htmlFooter}
${endHtmlBody}`}

}

function gethash(salt, pass) {
    //PBKDF2 from passToKeyIV, discard unneeded IV
    var res = crypto.passToKeyIv({pass:pass,salt:salt});
    return res.key;
}

function findcerts(cdir) {
    var certs={}, mods={}, activecert, activekey;
    readDir(cdir).forEach(function(f) {
        var ls=lstat(cdir+'/'+f);
        if(f=='shse-cert.pem')
            activecert=ls.link
        else if(f=='shse-key.pem')
            activekey=ls.link;
        else if (/-cert.pem/.test(f)) {
            var cinfo = shell('openssl x509 -noout -subject -issuer -dates -modulus -in ' + serverConf.serverRoot+'/certs/'+f);
            if(cinfo.stderr != "") {
                certs[f]={invalid:true,msg:cinfo.stderr,file:serverConf.serverRoot+'/certs/'+f }
            } else {
                var tmp, tmp1, out='\n'+cinfo.stdout;
                var subject = out.match(/\nsubject=([^\n]+)/);
                if(subject && subject.length>1) {
                    tmp=subject[1];
                    subject={};
                    tmp1=tmp.match(/O\s*=\s*([^,]+)/);
                    if(tmp1 && tmp1.length>1)
                        subject.org=tmp1[1];
                    tmp1=tmp.match(/CN\s*=\s*([^,]+)/);
                    if(tmp1 && tmp1.length>1)
                        subject.cn=tmp1[1];
                } else
                    subject=null;

                var issuer = out.match(/\nissuer=([^\n]+)/);
                console.log(issuer);
                if(issuer && issuer.length>1) {
                    tmp=issuer[1];
                    issuer={};
                    tmp1=tmp.match(/O\s*=\s*([^,]+)/);
                    if(tmp1 && tmp1.length>1)
                        issuer.org=tmp1[1];
                    tmp1=tmp.match(/CN\s*=\s*([^,]+)/);
                    if(tmp1 && tmp1.length>1)
                        issuer.cn=tmp1[1];
                } else
                    issuer=null;

                var start=out.match(/\nnotBefore=([^\n]+)/);
                if(start && start.length>1) {
                    start=autoScanDate(start[1]);
                    if(start.date)
                        start=start.date;
                    else
                        start=null;
                } else
                    start=null;

                var end=out.match(/\nnotAfter=([^\n]+)/);
                if(end && end.length > 1) {
                    end=autoScanDate(end[1]);
                    if(end.date)
                        end=end.date;
                    else
                        end=null;
                } else
                    end=null;

                var mod=out.match(/\nModulus=([^\n]+)/);
                if(mod && mod.length > 1) {
                    mod=mod[1];
                } else
                    mod=null;

                certs[f]={subject:subject, issuer:issuer, start:start, end:end, mod: mod, cinfo:cinfo, file:f}
                if(mods[mod])
                    certs[f]=Object.assign(certs[f],mods[mod]);
                mods[mod]=certs[f];
            }
        } else if (/-key.pem/.test(f)) {
            var kinfo = shell('openssl rsa -noout -modulus -in ' + serverConf.serverRoot+'/certs/'+f);
            if(kinfo.stderr=='') {
                out = '\n' + kinfo.stdout;
                mod=out.match(/\nModulus=([^\n]+)/);
                if(mod && mod.length > 1) {
                    mod=mod[1];
                    if(!mods[mod]) mods[mod]={};
                    mods[mod].key=f;
                }
            }
        }

    });

    if(certs[activecert])
        certs[activecert].active=true;

//    certs.activecert=activecert;
//    certs.activekey=activekey;
    return certs;
}


function activatecert(req) {
    var p=req.params;

    var res = shell(`${process.installPathExec} ${serverConf.serverRoot}/web_server_conf.js newcert ${p.cfile} ${p.kfile}`);
    if(res.stderr.length)
        return {json:{response:{msg:res.stderr, error:true}}}
    else
        return {json:{response:{msg:res.stdout}}}
}


function checkcert(req) {
    var p=req.params;
    var mod, subject, res, error=false, msg;

    if(p.type=='cfile') {
        res= shell('openssl x509 -noout -subject -modulus', {stdin: p.file});

        var tmp, tmp1, out='\n'+res.stdout;
        var subject = out.match(/\nsubject=([^\n]+)/);
        if(subject && subject.length>1) {
            tmp=subject[1];
            subject={};
            tmp1=tmp.match(/O\s*=\s*([^,]+)/);
            if(tmp1 && tmp1.length>1)
                subject.org=tmp1[1];
            tmp1=tmp.match(/CN\s*=\s*([^,]+)/);
            if(tmp1 && tmp1.length>1)
                subject.cn=tmp1[1];
        } else {
            subject=undefined;
            error=true;
        }
        if(!error) {
            mod=out.match(/\nModulus=([^\n]+)/);
            if(mod && mod.length > 1) {
                mod=mod[1];
                msg="Certificate Valid";
                if(subject.cn)
                    msg+=` (${subject.cn})`;
            } else {
                error=true;
                mod=undefined;
                msg="Invalid Certificate";
            }
        }
        else
            msg="Invalid Certificate";

    } else if (p.type=='kfile') {
        res=shell('openssl rsa -noout -modulus', {stdin: p.file});
        var out='\n'+res.stdout;
        if(!error) {
            mod=out.match(/\nModulus=([^\n]+)/);
            if(mod && mod.length > 1) {
                mod=mod[1];
                msg="Private Key Valid";
            } else {
                error=true;
                mod=undefined;
                msg="Invalid Private Key";
            }
        }
        else
            msg="Invalid Private Key";
    }
    return {json: {response: {error:error, msg:msg, modulus:mod, subject:subject}}};
}

function uploadcert(req){
    var msg, error=false, f=req.params.files;

    if(!f || !f.cfile || !f.kfile)
        return {json: {response: {error:true,msg:"missing files parameters"}}};

    var cname = serverConf.serverRoot + '/certs/' + dateFmt('%Y-%m-%d_%H:%M:%S_shse-cert.pem');
    var kname = serverConf.serverRoot + '/certs/' + dateFmt('%Y-%m-%d_%H:%M:%S_shse-key.pem');

    try {
        fprintf(cname,'%s',f.cfile);
        fprintf(kname,'%s',f.kfile);
        chmod(kname, 0600);
        msg="ok";
    } catch(e) {
        error=true;
        msg=e.message
    }
    return {json: {response: {error:error, msg:msg}}};
}

function delcert(req) {
    var p =req.params, error=false, msg='ok';
    if(p.kfile && p.cfile) {
        try {
            rmFile(serverConf.serverRoot + '/certs/' + p.kfile);
            rmFile(serverConf.serverRoot + '/certs/' + p.cfile); 
        } catch(e) {
            error=true;
            msg=e.message;
        }
    } else {
        error=true;
        msg="no files provided";
    }
    return {json: {response: {error:error, msg:msg}}};
}

function certpage(req){
    var cred=checkcred(req, true);
    if(!cred) {
        return loginredir;
    }

    var head=sprintf(htmlHeadfmt, cred.name);

    var cdir = serverConf.serverRoot+'/certs';
    if(!stat(cdir))
        return {html:`${head}<script src="/js/shse-admin.js"></script>
            ${endHtmlHead}
            ${htmlBody}
            ${adminHtmlTop}   
            ${htmlSearch}${endHtmlSearch}
            ${htmlTopend}
            ${htmlMain}
            CERTS DIRECTORY IS MISSING
            ${endHtmlMain}\n${htmlFooter}\n${endHtmlBody}
            `
        };

    // ajax json requests
    switch (req.params.action) {
        case 'check':
            return checkcert(req);
        case 'upload':
            return uploadcert(req);
        case 'del':
            return delcert(req);
        case 'activate':
            return activatecert(req);
    }

    var certs=findcerts(cdir);

    var keys = Object.keys(certs);

    var o = '<table class="ctb"><tr><th></th><th>Issuer</th><th>Cname</th><th>Valid Dates</th><th>Filename</th><th>Status</th></tr>';

    for (var i=0;i<keys.length;i++) {
        var acert=certs[keys[i]];
        if (acert.active)
            o+=`<tr style="font-weight:bold;"><td><input class="actv" type=radio id="${acert.file}" data-key="${acert.key}" name="cfile"></td><td>${acert.issuer.org}</td><td>${acert.subject.cn}</td><td>`+
                dateFmt("%b %d %Y -",acert.start) + dateFmt(" %b %d %Y",acert.end) + `</td><td>${acert.file}</td><td>Active</td></tr>`
    }
    for (var i=0;i<keys.length;i++) {
        var acert=certs[keys[i]];
        if (!acert.active)
            o+=`<tr><td><input type=radio id="${acert.file}" data-key="${acert.key}" name="cfile"></td><td>${acert.issuer.org}</td><td>${acert.subject.cn}</td><td>`+
                dateFmt("%b %d %Y -",acert.start) + dateFmt(" %b %d %Y",acert.end) + `</td><td>${acert.file}</td><td>Inactive</td></tr>`
    }

    o+='</table><br><button class="cbut" id="activate">Activate</button>'+
       '<button class="cbut" id="delete">Delete</button>'+
       '<button class="cbut" id="upload">Upload New</button><br>';
    req.put(`
${head}
<script src="/js/shse-admin.js"></script>
${endHtmlHead}
${htmlBody}
${adminHtmlTop}
${htmlSearch}${endHtmlSearch}
${htmlTopend}
${htmlMain}

    <h2>Manage Certificates</h2>
    ${o}
`);


    return {html:`${endHtmlMain}\n${htmlFooter}\n${endHtmlBody}\n`};
}

function getusers(req, accttype) {
    var res = sql.exec("select Acctid, Type, Acctinfo.$.email, Acctinfo.$.passhash from accounts",{returnType:'array'});
    if(accttype=='A')
        return {json:{rows:res.rows, owner:true}};
    return {json: {rows:res.rows, accttype:accttype}};
}

function make_acctinfo(email,pass) {
    var salt = hexify(crypto.rand(16));
    return {
        passsalt: salt,
        passhash: gethash(salt, pass),
        email: email
    }
}

function deluser(user) {
    var tbname = sanitize_name(user);
    if(getType(user)!='String' || user.length==0)
        return false;

    var res = sql.one("select * from accounts where Acctid=?",[user]);
    if(!res || res.Type=='A')
        return false;

    sql.one("delete from accounts where Acctid=?",[user]);
    sql.one("delete from sessions where Acctid=?",[user]);
    sql.one(`drop table ${tbname}_pages`);
    sql.one(`drop table ${tbname}_history`);
    sql.one(`drop table ${tbname}_heatstats`);

    return true;
}


function adduser(req) {
    var user = req.params.user;
    var pass = req.params.pass;
    var email= req.params.email;

    if(sql.one("select * from accounts where Acctid=?",[user]))
        return {json:{error: "Account exists"}};

    var acctinfo = make_acctinfo(email,pass);
    sql.exec("insert into accounts values (COUNTER, ?, 'u', ?)", [user, acctinfo]);
    var ret=makeUserTables(user);
    if(ret.error) {
        deluser(user);
        return {json:{error: ret.error}};
    }

    if( ! sql.one("select * from accounts where Acctid=?",[user]))
        return {json:{error: sql.errMsg}};

    return {json:{key:acctinfo.passhash}}
}

function delusers(req){
    var users = req.params.user, j=0;
    for (var i=0;i<users.length;i++) {
        deluser(users[i]);
        j++;
    }
    return {json:{ndels:j}}
}

function updateuser(req,accttype) {
    var patch, t=req.params.type, u=req.params.user, p=req.params.pass, e=req.params.email, i=0, err="", updates={};
    var isowner = (accttype=='A');

    for (;i<u.length;i++){
        var acctinfo, res=sql.one("select * from accounts where Acctid=?", [u[i]]);

        if(!res) {
            err+=`Account '${u[i]}' not found<br>`;
            continue;
        }

        // don't let admins change the owner account
        if(res.Type=='A' && !isowner)
            continue;

        try {
            acctinfo=JSON.parse(res.Acctinfo);
        } catch(e) {}

        if(!acctinfo) {
            if(p[i].length) {
                err+=`Account '${u[i]}' metadata was corrupt. A new key has been created.  Please check other info.<br>`;
                acctinfo = make_acctinfo(e[i],p[i]);
            } else {
                err+=`Account '${u[i]}' metadata was corrupt. Update with new password to correct.<br>`
                continue;
            }
        }

        if(! p[i].length) {
            //no password update
            //acctinfo.email=e[i];
            patch={email:e[i]};
        } else {
            // copy over in case we have more members in the future
            //Object.assign(acctinfo,make_acctinfo(e[i],p[i]));
            patch=make_acctinfo(e[i],p[i]);
        }

        // see: https://rampart.dev/docs/sql-server-funcs.html#json-merge-patch
        if(isowner && t[i]=="admin") //only owner can change account types
            res=sql.exec("update accounts set Type='a', Acctinfo=json_merge_patch(Acctinfo,?) where Acctid=?", [patch, u[i]]);
        else if(isowner && t[i]=="user")  //only owner can change account types
            res=sql.exec("update accounts set Type='u', Acctinfo=json_merge_patch(Acctinfo,?) where Acctid=?", [patch, u[i]]);
        else  //admins and owner can change password and email (but see above where admins can't change owner acct)
            res=sql.exec("update accounts set Acctinfo=json_merge_patch(Acctinfo,?) where Acctid=?", [patch, u[i]]);

        if(!res.rowCount)
            err+=`Failed to update account '${u[i]}'<br>`;
        else {
            updates[u[i]]= {
                email: e[i],
                key:   patch.passhash? patch.passhash:''
            }
        }
    }
    var ret={};
    if(err.length)
        ret.error=err;
    ret.updates=updates;
    return {json:ret};
}

function adminpage(req){
    var cred = checkcred(req, true);
    if(!cred) {
        return loginredir;
    }

    // ajax json requests
    switch (req.params.action) {
        case 'get':
            return getusers(req, cred.type);
        case 'add':
            return adduser(req);
        case 'del':
            return delusers(req);
        case 'update':
            return updateuser(req, cred.type);
    }
    var head=sprintf(htmlHeadfmt, cred.name);
    req.put(`
${head}
<script src="/js/shse-admin.js"></script>
${endHtmlHead}
${htmlBody}
${adminHtmlTop}
${htmlSearch}${endHtmlSearch}
${htmlTopend}
${htmlMain}

    <h2>User Accounts</h2>
    <h3>Users</h3>
    <table id="userlist" class="ctb">
        <tr id="hrow">
            <th style="text-align:left" class="chkbx"></th>
            <th class="username">Name</th>
            <th>Type</th>
            <th>Email</th>
            <th>Password</th>
            <th>Key</th>
        </tr>
    </table>
    <button id="userdel">Delete User(s)</button>
    <button id="userup">Update User(s)</button>

`);

    req.put(`<hr><br>
<table id="newuser">
<tr>
    <td class="chkbx">Add:</td>
    <td style="width:20ch"><input placeholder="name" id="username" type=text size=15></td>
    <td><input placeholder="email" id="useremail" type=text size=20></td>
    <td><input placeholder="password" id="userpass" type=text size=20></td>
    <td><div style="float:right">
        <button id="useradd">Add New</button>
    </div></td>
</tr>
</table>
${endHtmlMain}
${htmlFooter}
${endHtmlBody}
`);


    return {html:null};
}

function checkpass(name,pass) {
    var cred = sql.one("select Type type, Acctinfo.$.passhash passhash, Acctinfo.$.passsalt passsalt from accounts where Acctid=?", [name]);
    var ainfo, calchash;

    if(cred && cred.passhash) {
        calchash = gethash(cred.passsalt, pass);
        if(calchash == cred.passhash)
            return cred;
    }
    return false;
}

function loginRedirect(name, sessid) {
    //save a cookie with credential hash here.
    var newurl="user.html";

    return {
        html: sprintf(
            "<html><body><h1>302 Moved Temporarily</h1>"+
            '<p>Document moved <a href="%s">here</a></p></body></html>',
            newurl
        ),
        status:302,
        headers: {
            "location":   newurl,
            "Set-Cookie": `sessid=${%U:sessid}`
        }
    }
}


function firstlogin(req) {
    var pass=req.params.pass, pass2=req.params.pass2, name=req.params.name, acctinfo={};
    var msg = "Initialize Personal Search DB";

    if(!name) name='';

    if(pass && pass2 && pass==pass2) {
        if(!name || name.length < 2)
            msg="Name too short"
        
        else if(pass!=pass2)
            msg="Passwords don't match, try again";

        else if(pass.length < 5)
            msg="Password is too short";

        else {
            if(!makeSystemTables())
                return {txt: `error creating account table: ${sql.errMsg}`};

            acctinfo=make_acctinfo(req.params.email, pass); //email not strictly required

            sql.exec("insert into accounts values (COUNTER, ?, 'A', ?)", [name, acctinfo]);
            if(sql.errMsg.length)
                return {txt: `error inserting into accounts table: ${sql.errMsg}`};

            var ret=makeUserTables(name);
            if(ret.error) {
                deluser(user);
                return {txt: `error inserting into accounts table: ${ret.error}`};
            }

            return({html:
`<!DOCTYPE html>
<html>
<head>
    <title>Log in page</title>
</head>
<body>
    <h2>Admin account created.</h2>
    <h3>Log into admin account</h3>
    <form method="POST">
    Name: <input type="text" id="name" name="name"><br>
    Pass: <input type="password" id="pass" name="pass"><br>
    <input type=submit><br>
    </form>
</body>
</html>`});
        }
    }



    return({html:
`<!DOCTYPE html>
<html>
<head>
    <title>Log in page</title>
</head>
<body>
    <h2>${msg}</h2>
    First thing you must do is create an account. This account will be an admin account
    which can be used to create more accounts, as desired.
    <form method="POST">
    Name: <input type="text" id="name" name="name" value="${name}"><br>
    Enter new pass: <input type="password" id="pass" name="pass"><br>
    Confirm pass: <input type="password" id="pass2" name="pass2"><br>
    Contact email: <input type=text id=email name=email> (currently unused; may be blank)<br>
    <input type=submit><br>
    </form>
</body>
</html>`
    });
}

function make_session(name, expires, type) {
    // clean up old sessions
    sql.one("delete from sessions where Expires < 'now'");

    var sessid = sprintf('%0B', crypto.rand(32));
    if(sql.one("insert into sessions values(?,?,?,?)", [name, type, sessid, expires]))
        return sessid;
    else return false;
}


function loginpage(req) {
    var name=req.params.name, pass=req.params.pass, cred, credhash, logout=req.params.logout
        msg="Log into personal search";

    if(!tableExists("accounts"))
        return firstlogin(req);

    if(name && pass) {
        cred = checkpass(name,pass);
        if(cred)
            credhash=cred.passhash;
        msg="Incorrect name or pass, try again:";
        if(credhash) {
            var cookie;
            var expires=cookie_expiration + parseInt(dateFmt('%s'));
            var cookie = make_session(name, expires, cred.type);

            if(!cookie)
                msg="Unrecoverable error. Could not create session."
            else
                return loginRedirect(name,cookie);
        }
    }

    var html = `<!DOCTYPE html>
<html>
<head>
    <title>Log in page</title>
</head>
<body>
    <h2>${msg}</h2>
    <form method="POST">
    Name: <input type="text" id="name" name="name"><br>
    Pass: <input type="password" id="pass" name="pass"><br>
    <input type=submit><br>
    </form>
</body>
</html>`

    if(logout) {
        if(req.cookies.sessid)
            sql.one("delete from sessions where Sessid=?", [req.cookies.sessid]);
        return {html:html, headers: {"Set-Cookie": "sessid="} };
    }

    return {html: html};
}

// PLUGIN BACK END:

function makeReply(rep) {
    return Object.assign({ headers: {"Access-Control-Allow-Origin": '*'} }, rep);
}

function checkkey(name,key) {
    if(!name) return false;

    var cred = sql.one("select Acctinfo.$.passhash passhash from accounts where Acctid=?", [name]);

    if(cred && cred.passhash == key) {
        return true;
    }
    return false;
}

function checkeither(req) {
    var p=req.params;
    var user, tbname, type='u';
    if(p.user || p.key) {
        if(checkkey( p.user, p.key) ) {
            user=p.user;
            tbname=sanitize_name(user);
        } else
            return {status:'bad key'};
    }
    else if (req.cookies.sessid) {
        var user, cred=checkcred(req);

        if(!cred)
            return {status:'bad session'};
        user=cred.name;
        tbname=cred.tbname;
        if(!user)
            return {status:'bad session'};;
        type=cred.type;
    } else {
        return {status:'not logged in or failed to provide user/key'}
    }
    return {user:user, type:type, tbname: tbname};
}

function store (req) {
    var p=req.params, tbname;
    if(! checkkey( p.user, p.key) )
        return makeReply( {json: {status:'bad key'}} );

    if(! (p.furl && p.text) )
        return makeReply( {json: {status:'Missing parameter'}} );

    var comp = urlutil.components(p.furl);
    if(!comp)
        return makeReply( {json: {status:'bad url'}} );
    if(/^file:\/\//.test(p.furl))
        comp.host="FILE";

    tbname = sanitize_name(p.user);
    p.furl = comp.url;
    p.dom  = comp.host;
    if(!p.img) p.img="";
    if(!p.title) p.title=p.dom;
    p.text = p.title + "\n" + p.furl + "\n" + p.text;

    var hash=crypto.sha1(p.furl, true);
    var res = sql.exec(`insert into ${tbname}_pages values (?,?,?,?, ?,?,?, ?,?,?);`,
        [hash, 'now', 'now', 1, p.dom, p.furl, p.img, p.title, '', p.text]  );

    if(res.rowCount == 0) {
        if( sql.errMsg.indexOf('insert duplicate value') > -1 ) {
            res = sql.exec(`update ${tbname}_pages set Last='now', LastV='now', Numvisits = Numvisits + 1,
                            Image=?, Title=?, Text=? where Hash=?`,
                            [p.img, p.title, p.text, hash]
                          );
            if(res.rowCount == 0)
                return makeReply( {json: {status:`error updating: ${sql.errMsg}`}} );
        }
        else
            return makeReply( {json: {status:`error inserting: ${sql.errMsg}`}} );
    }

    if(p.history) {
        var comp = getDomain(p.furl);
        if(comp)
            p.dom=comp.domain? comp.domain:comp.host;
        p.hash=hash;
        sql.one(`insert into ${tbname}_history values( ?hash, 'now', dayseq( convert('now','date')), ?furl, ?dom, '', ?title )`,p);
    }
    return makeReply( {json: {status:'ok'}} );
}


function results(req) {
    var p=req.params;
    var user, tbname;
    var sres = checkeither(req);
    if(sres.status)
        return makeReply( {json: sres} );
    else {
        user=sres.user;
        tbname=sres.tbname;
    }

    var res=dosearch(p.q, tbname, p.sk);
    return makeReply( {json: res} );
}

function getcred(req) {
    //console.log(req.params.user, req.params.pass);
    var cred = checkpass(req.params.user, req.params.pass);
    //console.log(req.params.user, req.params.pass, key);
    return makeReply( {json: {key: cred.passhash}} );
}

function delentry(req){
    var p=req.params, total=0;;
    var sres = checkeither(req);

    if(sres.status)
        return makeReply( {json: sres} );

    var user=sres.user, tbname=sres.tbname;

    if(p.furl) {
        var comp = urlutil.components(p.furl);
        if(!comp)
            return makeReply( {json: {status:'bad url'}} );
        p.furl = comp.url;
        p.hash=[crypto.sha1(p.furl)];
    }

    if(p.dom) {
        res=sql.exec(`delete from ${tbname}_pages where Dom=?`, [p.dom]);
        total+=res.rowCount;
    }

    if(p.hash) {
        var res, i=0, hashes=p.hash;
        for(;i<hashes.length;i++) {
            res=sql.exec(`delete from ${tbname}_pages where Hash=?`, [dehexify(hashes[i])]);
            total+=res.rowCount;
        }
    }

    return makeReply( {json: {deleted:total, status:'ok'}} );
}

function checkentry(req) {
    var p=req.params, tbname;

    if(! checkkey( p.user, p.key) )
        return makeReply( {json: {status:'bad key'}} );

    p.furl = Sql.sandr('>>#=.*', '', p.furl);
    p.hash=crypto.sha1(p.furl, true);

    //insert into history
    //        Hash byte(20), Date date, Url varchar(128),
    //        Label varchar(16), Title varchar(64)
    var herrorMsg = false, herror=false;

    tbname=sanitize_name(p.user);
    if(p.skip != "true") {
        var comp = getDomain(p.furl);
        if(comp)
            p.dom=comp.domain? comp.domain:comp.host;
        herror = !sql.one(`insert into ${tbname}_history values( ?hash, 'now', dayseq( convert('now','date')), ?furl, ?dom, '', ?title )`,p);
        if(herror) herrorMsg = sql.errMsg;
    }

    //check if already saved
    var res = sql.one(`select convert( Last , 'int' ) last from ${tbname}_pages where Hash=?`, [p.hash]);

    if(!res)
        res = {saved:false};
    else {
        sql.one(`update ${tbname}_pages set LastV='now', Numvisits=Numvisits+1 where Hash=?`, [p.hash]);
        res.saved = true;
    }
    res.herror=herror;
    if(herror) res.errMsg = herrorMsg;

    return makeReply( {json: res} );
}

var suggestion_word_min_length=3;

function autocomp(req){
    var res;
    var p=req.params;
    var sres = checkeither(req);

    if(sres.status)
        return makeReply( {json: sres} );
    var user = sres.user, tbname=sres.tbname;
    var q = req.query.query;
    var cwords, word;

    if(!q || q.length < suggestion_word_min_length )
        return {"suggestions":[]};

    var space = q.lastIndexOf(" ");

    if(space == -1)
    {
        word=q;
        sql.set({"indexaccess":true});
        if(p.dom)
            res=sql.exec(
            `select Word value from ${tbname}_history_Dom_ftx where Word matches ? order by Count DESC`,
            [word.toLowerCase()+'%']);
        else
            res=sql.exec(
            `select Word value from ${tbname}_pages_Text_ftx where Word matches ? order by Count DESC`,
            [word.toLowerCase()+'%']);
        cwords=res.rows;
    }
    else
    {
        // get suggestions for the partial word after the last space
        var pref = q.substring(0,space);

        word = q.substring(space+1);

        if(word.length < suggestion_word_min_length)
            return makeReply({json: { "suggestions":  [q] } });

        if(p.dom)
            res=sql.exec(
                `select Word value from ${tbname}_history_Dom_ftx where Word matches ? order by Count DESC`,
                [word.toLowerCase()+'%']);
        else
            res=sql.exec(
                `select Word value from ${tbname}_pages_Text_ftx where Word matches ? order by Count DESC`,
                [word.toLowerCase()+'%']);
        cwords = res.rows;

        for( var i=0; i<cwords.length; i++)
        {
            var o=cwords[i];
            o.value = pref + " " + o.value;
        }
    }

    return makeReply( {json: {suggestions: cwords}});
}

if(!module || !module.exports) {
    function die(msg) {
        fprintf('%s\n',msg);
        process.exit(1);
    }

    var args = process.argv
    if(args[2] == 'updateUser' && args[3] && args[4] ) {
        var user=args[3];
        var pass=args[4];
        var res = sql.one("select Acctinfo.$.email email from accounts where Acctid=?", [user]);
        if(!user)
            die(`${user} does not exist`);
        if(pass.length < 5)
            die('password too short');
        res=make_acctinfo(res.email,pass);
        res=sql.exec("update accounts set Acctinfo=json_merge_patch(Acctinfo,?) where Acctid=?", [res, user]);
        if(sql.errMsg)
            die(sql.errMsg);
        printf("account updated\n");
    } else if (args[2] == 'listUsers') {
        res=sql.exec("select Acctid, Acctinfo.$.email email, Acctinfo.$.passhash passhash, Type type from accounts");
        var rows=res.rows, row, type, emax=5, amax=5;
        for (var i=0;i<rows.length;i++) {
            row=rows[i];
            if(row.email.length > emax) emax = row.email.length;
            if(row.Acctid.length > emax) amax = row.Acctid.length;
        }
        printf('%-*s    %-*s    Type     Key\n', amax, "Name", emax, "Email")
        for (var i=0;i<rows.length;i++) {
            var row=rows[i];
            switch(row.type) {
                case 'a': type="Admin";break;
                case 'A': type="Owner";break;
                case 'u': type="User ";break;
                default:  type="Unkwn";break;
            }
            printf('%-*s    %-*s    %s    %s\n', amax, row.Acctid, emax, row.email, type, row.passhash);
        }
    } else if (args[2] == 'makeUserdb') {
        var user=args[3];
        if(!user) 
            die("missing user name after makeUserdb\n");
        var res = sql.one("select Acctinfo.$.email email from accounts where Acctid=?", [user]);
        if(!res)
            sql.one("insert into accounts values (COUNTER, ?, 'u', ?)", [user, {}]);
        makeUserTables(user);
    } else{
        printf("This is the main script used by the server.\nOptions for command line use:\n"+
                "    %s %s updateUser <existingUsername> <newPassword>\n" +
                "    %s %s listUsers\n" +
                "    %s %s makeUserdb <username>\n", args[0], args[1], args[0], args[1], args[0], args[1]);
        //console.log(serverConf);
    }
} else {
    module.exports = {
        //ajax endpoints
        "store.json":   store,
        "results.json": results,
        "delete.json":  delentry,
        "check.json":   checkentry,
        "autocomp.json":autocomp,
        "cred.json":    getcred,
        "admin.json":   adminpage,
        "certs.json":   certpage,
        "hist.json":    histdata,
        //web pages
        "history.html": historypage,
        "search.html":  searchpage,
        "login.html":   loginpage,
        "user.html":    userpage,
        "certs.html":   certpage,
        "admin.html":   adminpage
    }
}
