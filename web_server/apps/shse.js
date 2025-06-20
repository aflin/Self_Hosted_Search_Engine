rampart.globalize(rampart.utils);

var cookie_expiration=86400;

//for testing from command line
if(!global.serverConf) serverConf={dataRoot:'/usr/local/rampart/web_server/data'}

var Sql = use.sql;
var crypto = use.crypto;
var urlutil=use.url;

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

    /*
    if(!indexExists("accounts_Id_x")) {
        sql.exec(`create index accounts_Id_ux on accounts(Id);`);
        if(!indexExists("accounts_Id_x")) {
            fprintf(stderr, "error creating index 'accounts_Id_ux': %s\n", sql.errMsg);
            return false;
        }
    }
    */

    if(!tableExists("sessions")) {
        sql.exec(`create table sessions 
        ( Acctid varchar(16), Sessid varchar(48), Expires date
        );`);
        if(!tableExists('sessions')) {
            fprintf(stderr, `error creating table 'sessions': %s\n`, sql.errMsg);
            return false;
        }
    }

    return true;
}


function makeUserTables(tbname) {
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

    // turn indexmeter off eventually
    if(!indexExists(`${tbname}_pages_Text_ftx`)) {
        sql.exec(`create fulltext index ${tbname}_pages_Text_ftx on ${tbname}_pages(Text) 
            WITH WORDEXPRESSIONS ` + 
            ```('[\alnum\x80-\xFF]{2,99}', '[\alnum\x80-\xFF$<>%@\-_+]{2,99}')INDEXMETER 'on';```
        );
        if(!indexExists(`${tbname}_pages_Text_ftx`)) {
            fprintf(stderr, `error creating ${tbname}_pages_Text_ftx: %s\n`, sql.errMsg);
            return {error: sprintf(`error creating ${tbname}_pages_Text_ftx: %s`, sql.errMsg)};
        }
    }

    if(!tableExists(`${tbname}_history`)) {
        sql.exec(`create table ${tbname}_history (Hash byte(20), Date date, Day dword, 
                  Url varchar(128), Label varchar(16), Title varchar(64));`);
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

    return true;
}

/* TEMPLATE and other html or scripts*/
var htmlHead=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Self Hosted Search Engine</title>
  <script src="/js/jquery-3.7.1.min.js"></script>
  <script src="/js/jquery-ui-1.13.2.min.js"></script>
  <script src="/js/shse.js"></script>
  <link rel="stylesheet" href="/css/themes/pepper-grinder/jquery-ui.css">
  <link rel="stylesheet" href="/css/shse.css">
  <link rel="stylesheet" href="/css/common.css">
`;

var endHtmlHead="</head>";
var htmlBody="<body>";
var htmlTop=`
  <header>
    <img src="/images/logo.png" alt="Self Hosted Search Engine Logo">
    <div class="title-text">
      <h1>Self Hosted Search Engine</h1>
      <p>Search your web sessions, your way. Privately. Locally.</p>
    </div>
  </header>

  <nav>
    <div>
      <a href="/apps/shse/user.html">Home</a>
      <a href="/apps/shse/history.html">History</a>
      <a href="#">Docs</a>
      <a href="https://github.com/aflin/Self_Hosted_Search_Engine">GitHub</a>
    </div>
    <div>
      <a href="login.html?logout=1">Log out</a>
    </div>
  </nav>
`;
var htmlMain="<main>";
var htmlSearch=`
    <script src="/js/jquery.autocomplete.min.js"></script>
    <div class="search-box">
      <form action="/apps/shse/search.html" method="get">
        <input type="text" autocomplete="off" id="fq" name="q" `;

var endHtmlSearch=`placeholder="Search" required>
        <input type="submit" value="Search">
      </form>
    </div>
`;

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
  </main>
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
    var now;

    if(!req.cookies.sessid) { 
        return false;
    }

    var res;
    try{
        res = sql.one("select * from sessions where Sessid=?", [req.cookies.sessid]);
    } catch(e){}
    if(!res)  {
        return false;
    }

    if(require_admin && res.Acctid!='admin') {
        return false;
    }

    now = parseInt(dateFmt('%s'));

    if(now > res.Expires) {
        sql.one("delete from sessions where Sessid=?", [req.cookies.sessid]);
        return false;
    }

    sql.one("update sessions set Expires=? where Sessid=?", [cookie_expiration + now, req.cookies.sessid]);

    return res.Acctid;
}

function dosearch(q,u,s) {
    s= s ? parseInt(s) :0;

    if(s>90)
        sql.set({likeprows: s+100});
    //  image, url, last, hash, dom, title, abstract 
    var res=sql.exec(`select bintohex(Hash) hash, convert( Last , 'int' ) last, Dom dom, Url url, Image image, Title title,
        Text abstract from ${u}_pages where Text likep ?`,
        [q], {skipRows: s, includeCounts:true }
    );

    for (var i=0; i<res.rows.length; i++) {
        var row=res.rows[i];
        row.abstract = Sql.abstract(row.abstract, {max:230, style:'querybest', query:q, markup:"%mbH"});
    }
    return res;
}

var ricos='<span title="Remove" class="rm rico hm">&#x2718;</span><span title="Remove" class="rm rmcb hm"><input type="checkbox" class="sitem" title="select item"></span>';

function searchpage(req) {
    var user;
    if(! (user=checkcred(req)) )
        return loginredir;
    var res, p=req.params;
    var q = p.q?p.q:'';
    var skip=p.sk?parseInt(p.sk):0;

    req.put(`
${htmlHead}
${endHtmlHead}
${htmlBody}
${htmlTop}
${htmlMain}
${htmlSearch}value="${q}" ${endHtmlSearch}
`);

    if(p.q) {
        res=dosearch(p.q,user,skip);
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
            <span style="cursor: pointer;position: bsolute;left:-30px;top:-11px;">Options</span>
            <span id="showico" style="display:inline-block;cursor:pointer;transform:rotate(270deg) translate(4px,0px);font-size:28px;position:absolute;left:-30px;top:-10px;width:13px;" title="click to hide database editing options">‣</span>
        </span>
        <span style="display:inline-block;height:22px;padding: 2px 0px 0px 5px;">&nbsp;
            <span class="hide">
                <button style="padding: 1px 5px 1px 5px;border:1px solid #b00;position:relative;top:-5px;left:55px;" id="rmselected">Remove Select Items</button>
            </span>
        </span>
        <span style="float:right">Results ${skip+1}-${skip+res.rowCount} of ${res.countInfo.indexCount}</span>
    </div>`);
        for (var i=0;i<res.rows.length;i++) {
			var r=res.rows[i];
			var favico=null, ico=r.image;
			var icl = r.image? " hov" : '';
			var d= new Date(0);
			d.setUTCSeconds(parseInt(r.last));

			if(!r.image) {
			    ico='/images/home_website_start_house.svg'
			    favico=r.url.match(/^https?:\/\/[^/]+/)+'/favicon.ico';
			    //icl = icl + ' cfav';
            }
			req.put('<div data-hash="'+r.hash+'" data-dom="'+r.dom+'" id="r'+i+'" class="resi"><span class="imgwrap">'+ricos+
                '<img class="fimage'+icl+'" src="'+ico+'"'+
                (favico?' data-favico="'+favico+'"':'') + '></span>'+
                '<span class="itemwrap"><span class="abstract nowrap"><a class="url-a tar" ' + 
                /* (browser.t=='f'?'style="width:calc( 100% - 165px )" ':'') + */
                'target="_blank" href="'+r.url+'">'+
                sprintf("%H",r.title.replace(/\s+/g,' '))+'</a><span class="timestamp">('+d.toLocaleString()+
                ')</span></span><br><span class="abstract url-span">'+r.url+
                '</span></span><br><span class="abstract">'+r.abstract+"</span></div>"
			);
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
    
    return {html:`
<p><center>${pag}</center></p>
${endHtmlMain}
${htmlFooter}
${endHtmlBody}`}


}

function userpage(req){
    if(!checkcred(req))
        return loginredir;

    return {html:`
${htmlHead}
${endHtmlHead}
${htmlBody}
${htmlTop}
${htmlMain}
${htmlSearch}${endHtmlSearch}

${htmlAbout}

${endHtmlMain}
${htmlFooter}
${endHtmlBody}

`};
}

var nMonths=3;

function getheatstats(user) {
    var d, res = sql.one("select min(Date) d from ${user}_history");
    if(!res) return {}
    d = dateFmt("%Y-%m-%d 00:00:00", res.d);
    res = sql.one("select * from ${user}_heatstats where Date=?", [d]);
    if(!res) makeheatstats(user);



//    "select dayseq(Date) d, Date, count(d) from aaron_history group by dayseq(Date) order by dayseq(Date)"
}

function heatdata(req,p,user) {
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

    //how many days should we have?
    var expected=(enddate - startdate);

    //get them from heatstat table
    rows=[];
    res = sql.exec(`select Day, Cnt from ${user}_heatstats where Day >= ? and Day <= ?`,
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
                res=sql.one(`select count(Day) cnt from ${user}_history where Day = ?`,[curday]);
                if(res && res.cnt) res=res.cnt;
                else res=0;
                if(curday!=today) //this one can still change, don't insert
                    sql.one(`insert into ${user}_heatstats values (?,?)`,[curday,res]);
                rows[i]=res;
                if(res>max)max=res;
            }
        }
    }
    return {json: {rows:rows,max:max}};
}

function histdata(req) {
    var p=req.params;
    var user;
    var sres = checkeither(req);
    if(sres.status)
        return makeReply( {json: sres} );
    else
        user=sres.user;

    if(p.startm && p.starty)
        return heatdata(req,p,user);

    var d=autoScanDate(p.date + ' ' + p.off);
    var start = dateFmt('%Y-%m-%d', d.date);
    var end = start + ' 23:59:59';
    
    start+=' 00:00:00';

//    return {txt: `select * from ${user}_history where Date >= ? and Date < ? order by Date; ${parseInt(p.start)/1000} ${(parseInt(p.end)+1)/1000}`}

    var res=sql.exec(`select * from ${user}_history where Date >= ? and Date < ? order by Date;`,
              {maxRows: -1},[parseInt(p.start)/1000, (parseInt(p.end)+1)/1000]); 

    return({json:{res:res, start:dateFmt('%Y-%m-%dT%H:%M:%S.000Z',start), end:dateFmt('%Y-%m-%dT%H:%M:%S.000Z',end)}});
}

function historypage(req) {
    var user;
    if(! (user=checkcred(req)) )
        return loginredir;
    var res, p=req.params;
    var q = p.q?p.q:'';

    req.put(`
${htmlHead}
<script>
    var nMonths=${nMonths};
</script>
${endHtmlHead}
${htmlBody}
${htmlTop}
${htmlMain}

${htmlSearch}value="${q}" ${endHtmlSearch}
<div id="datepicker"></div>
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

function getusers(req) {
    var res = sql.exec("select Acctid, Acctinfo.$.email, Acctinfo.$.passhash from accounts",{returnType:'array'});   
    return {json:res.rows};
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
    if(getType(user)!='String' || user.length==0)
        return false;
    sql.one("delete from accounts where Acctid=?",[user]);
    sql.one(`drop table ${user}_pages`);
    sql.one(`drop table ${user}_history`);
    
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
        if(users[i]!='admin') {
            deluser(users[i]);
            j++;
        }
    }
    return {json:{ndels:j}}
}

function updateuser(req) {
    var patch, u=req.params.user, p=req.params.pass, e=req.params.email, i=0, err="", updates={};

    for (;i<u.length;i++){
        var acctinfo, res=sql.one("select * from accounts where Acctid=?", [u[i]]);

        if(!res) {
            err+=`Account '${u[i]}' not found<br>`;
            continue;
        }

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
    if(!checkcred(req, true)) {
        return loginredir;
    }

    // ajax json requests
    switch (req.params.action) {
        case 'get':
            return getusers(req);
        case 'add':
            return adduser(req);
        case 'del':
            return delusers(req);
        case 'update':
            return updateuser(req);
    }

    // direct html request
    var jsonpage = req.path.path.replace(/html$/,'json');

    var adminscr = 
`\$(document).ready(function(){
    var hrow=\$('#hrow');
    var utable=\$('#userlist');

    function dialogmsg(msg) {
        if(!\$("#dialog-msg").length)
            \$('body').append(\`
<div id="dialog-msg" title="Alert Message">
  <p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span><span id="dialog-msg-span">\${msg}</span></p>
</div>\`);
        else 
            \$("#dialog-msg-span").html(msg);
        \$("#dialog-msg").dialog({
            resizable: false, 
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "OK": function() {
                    \$(this).dialog("close");
                }
            }
        });
    }

    function makerow(user,email, key) {
        var chbox = '<input type="checkbox" class="usersel">';
        //if(user=='admin') chbox='';
        return \`<tr>
            <td class="chkbx">\${chbox}</td>
            <td class="username usernamecl"><center class="usernamecl">\${user}</center></td>
            <td><input class="useremail" value="\${email}" data-origval="\${email}" type=text size=20></td>
            <td><input class="userpass" placeholder="enter new pass to reset" type=text size=20></td>
            <td class="userkey">\${key}</td>
        </tr>\`;
    }

    \$.getJSON('${jsonpage}?action=get', function(data){

        if(!Array.isArray(data))
            dialogmsg("bad json from server");
        else {
            let i=0, rowhtml="";
            for (;i<data.length;i++) {
                row=data[i];
                rowhtml += makerow(row[0],row[1],row[2]);
            }
            hrow.after(rowhtml);
        }
    });

    \$('#userup').click(function(event){
        let fail=false, u=[], p=[], e=[], selected=\$('.usersel:checked').closest('tr');

        if(!selected.length) {
            dialogmsg(\`No user accounts selected\`);
            return;
        }

        selected.each(function(i){
            let origE=\$(this).find('.useremail').attr('data-origval');

            u[i]=\$(this).find('.username').text();
            p[i]=\$(this).find('.userpass').val();
            e[i]=\$(this).find('.useremail').val();

            if(p[i]!="" && p[i].length<7) {
                dialogmsg(\`Password for user "\${u[i]}" is too short\`);
                fail=true;
                return;
            }

            if(p[i]=="" && e[i] == origE) {
                dialogmsg(\`Checked user "\${u[i]}" has no changes to email or password.\`);
                fail=true;
                return;
            }
        });

        if(fail)
            return;
console.log(u[0]);
        \$.post('${jsonpage}', {action:"update", user:u, pass:p, email:e}, function(data) {
            let msg='', total=0;

            if(!data || !data.updates || data.error) {
                msg = (data.error? data.error : "Error updating user account(s)<br>");
            }
            
            if(data && data.updates && typeof data.updates == 'object') {
                selected.each(function(i){
                    let curuser=\$(this).find('.username').text(), userdata;

                    if(!data.updates || !data.updates[curuser])
                        return; //continue

                    userdata=data.updates[curuser];

                    \$(this).find('.userpass' ).val('');

                    if(userdata.email && userdata.email.length) {
                        \$(this).find('.useremail').val( userdata.email );
                        \$(this).find('.useremail').attr('data-origval', userdata.email );
                    }

                    if(userdata.key && userdata.key.length)
                        \$(this).find('.userkey'  ).text( userdata.key );

                    total++;
                });
            }
            if(!data || ( !data.updates && !data.error))
                msg='Unknown Error while updating<br>';

            dialogmsg(\`\${msg}updated \${total} user account(s)\`);
        });
    });

    \$('#userdel').click(function(event){

        let fail=false, selected=\$('.usersel:checked').closest('tr');
        
        if(!selected.length) {
            dialogmsg("no users selected");
            return;
        }

        selected.each(function(){
            if( \$(this).find('.username').text()=='admin' ){
                dialogmsg("The 'admin' account cannot be deleted. Use update to change its email or password.");
                fail=true;
                return;
            }
        });
        if(fail) return;

        if(!\$("#dialog-delete-confirm").length)
            \$('body').append(\`
<div id="dialog-delete-confirm" title="Delete selected Users?">
  <p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>The selected users will be permanently deleted along with all data and cannot be recovered. Are you sure?</p>
</div>\`);

        \$("#dialog-delete-confirm").dialog({
            resizable: false, 
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Delete Selected Users": function() {
                    let u=[];
                    selected.each(function(i){
                        u[i]=\$(this).find('.username').text();
                    });
                    \$.post('${jsonpage}', {action:"del", user:u}, function(data) {
                        if(!data || !data.ndels || data.error) {
                            dialogmsg("error deleting user account(s)");
                            return;
                        }
                        selected.remove();
                        dialogmsg(\`deleted \${data.ndels} user account(s)\`);
                    });
                    \$(this).dialog("close");
                },
                Cancel: function() {
                    \$(this).dialog("close");
                }
          }
        });

    });

    \$('#useradd').click(function(event){
        let u=\$('#username').val(), p=\$('#userpass').val(), e=\$('#useremail').val();
        if(u.length < 5) {
            dialogmsg("user name too short");
            return;
        }

        if(p.length < 7) {
            dialogmsg("password too short");
            return;
        }

        \$.post('${jsonpage}', {action:"add", user:u, pass:p, email: e}, function(data) {
            if(!data || !data.key || data.error) {
                dialogmsg(\`error adding user: \${data.error}\`);
                return;
            }
            utable.append(makerow(u,e,data.key));
            \$('#username').val('');
            \$('#userpass').val('');
            \$('#useremail').val('');
        });
    });
    
});
`
   ;

    req.put(`
${htmlHead}
<script>
    ${adminscr}
</script>
${endHtmlHead}
${htmlBody}
${htmlTop}
${htmlMain}

    <h2>Admin Page</h2>
    <h3>Users</h3>
    <table id="userlist">
        <tr id="hrow">
            <th style="text-align:left" class="chkbx"><label>All<input type="checkbox" id="userselall"></label></th>
            <th class="username">Name</th>
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
    var cred = sql.one("select Acctinfo.$.passhash passhash, Acctinfo.$.passsalt passsalt from accounts where Acctid=?", [name]);
    var ainfo, calchash;

    if(cred && cred.passhash) {
        calchash = gethash(cred.passsalt, pass);
        if(calchash == cred.passhash)
            return cred.passhash;
    }
    return false;
}

function loginRedirect(name, sessid) {
    //save a cookie with credential hash here.
    var newurl="user.html";
    if(name=='admin')
        newurl="admin.html";

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
    var pass=req.params.pass, pass2=req.params.pass2, acctinfo={};

    if(pass && pass2 && pass==pass2) {
        if(!makeSystemTables())
            return {txt: `error creating account table: ${sql.errMsg}`};

        acctinfo=make_acctinfo(req.params.email, pass); //email not strictly required
        
        sql.exec("insert into accounts values (COUNTER, 'admin', 'a', ?)", [acctinfo]);
        if(sql.errMsg.length)
            return {txt: `error inserting into accounts table: ${sql.errMsg}`};

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
    Name: <input type="text" id="name" name="name" value="admin"><br>
    Pass: <input type="password" id="pass" name="pass"><br>
    <input type=submit><br>
    </form>
</body>
</html>`});
 
    }

    var msg = "Initialize Personal Search DB"; 
    
    if(pass && pass2)
        msg="Passwords don't match, try again";

    return({html:
`<!DOCTYPE html>
<html>
<head>
    <title>Log in page</title>
</head>
<body>
    <h2>${msg}</h2>
    First thing you must do is create an "admin" password
    <form method="POST">
    Enter new pass: <input type="password" id="pass" name="pass"><br>
    Confirm pass: <input type="password" id="pass2" name="pass2"><br>
    Contact email: <input type=text id=email name=email><br>
    <input type=submit><br>
    </form>
</body>
</html>`
    });
}

function make_session(name, expires) {
    // clean up old sessions
    sql.one("delete from sessions where Expires < 'now'");

    var sessid = sprintf('%0B', crypto.rand(32));
    if(sql.one("insert into sessions values(?,?,?)", [name, sessid, expires]))
        return sessid;
    else return false;
}


function login(req) {
    var name=req.params.name, pass=req.params.pass, credhash, logout=req.params.logout
        msg="Log into personal search";

    if(!tableExists("accounts"))
        return firstlogin(req);

    if(name && pass) {
        credhash = checkpass(name,pass);
        msg="Incorrect name or pass, try again:";
        if(credhash) {
            var cookie;
            var expires=cookie_expiration + parseInt(dateFmt('%s'));
            var cookie = make_session(name, expires);

            if(!cookie)
                msg="Unrecoverable error.  Admin account does not exist or other error"
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
    var user;
    if(! checkkey( p.user, p.key) ) {
        if(req.cookies.sessid) {
            user=checkcred(req);
            if(!user)
                return {status:'bad session'};
        }
        
        if(!user)
            return {status:'bad key'};
    } else {
        user=p.user;
    }
    return {user:user};
}

function store (req) {
    var p=req.params;
    if(! checkkey( p.user, p.key) )
        return makeReply( {json: {status:'bad key'}} );

    if(! (p.furl && p.text) )
        return makeReply( {json: {status:'Missing parameter'}} );

    var comp = urlutil.components(p.furl);
    if(!comp)
        return makeReply( {json: {status:'bad url'}} );
    if(/^file:\/\//.test(p.furl))
        comp.host="FILE";

    p.furl = comp.url;
    p.dom  = comp.host;
    if(!p.img) p.img="";
    if(!p.title) p.title=p.dom;
    p.text = p.title + "\n" + p.furl + "\n" + p.text; 

    var hash=crypto.sha1(p.furl, true);

    var res = sql.exec(`insert into ${p.user}_pages values (?,?,?,?, ?,?,?, ?,?,?);`,
        [hash, 'now', 'now', 1, p.dom, p.furl, p.img, p.title, '', p.text]  );

    if(res.rowCount == 0) {
        if( sql.errMsg.indexOf('insert duplicate value') > -1 ) {
            res = sql.exec(`update ${p.user}_pages set Last='now', LastV='now', Numvisits = Numvisits + 1,
                            Title=?, Text=? where Hash=?`,
                            [p.title, p.text, hash]
                          );
            if(res.rowCount == 0)
                return makeReply( {json: {status:`error updating: ${sql.errMsg}`}} );
        }
        else
            return makeReply( {json: {status:`error inserting: ${sql.errMsg}`}} );
    }

    return makeReply( {json: {status:'ok'}} );
}


function results(req) {
    var p=req.params;
    var user;
    var sres = checkeither(req);
    if(sres.status)
        return makeReply( {json: sres} );
    else
        user=sres.user;

    var res=dosearch(p.q, user, p.sk);
    return makeReply( {json: res} );
}

function getcred(req) {
    //console.log(req.params.user, req.params.pass);
    var key = checkpass(req.params.user, req.params.pass);
    //console.log(req.params.user, req.params.pass, key);
    return makeReply( {json: {key: key}} );
}

function delentry(req){
    var p=req.params, total=0;;
    if(! checkkey( p.user, p.key) )
        return makeReply( {json: {status:'bad key'}} );


    if(p.furl) {
        var comp = urlutil.components(p.furl);
        if(!comp)
            return makeReply( {json: {status:'bad url'}} );
        p.furl = comp.url;
        p.hash=[crypto.sha1(p.furl)];
    }

    if(p.dom) {
        res=sql.exec(`delete from ${p.user}_pages where Dom=?`, [p.dom]);
        total+=res.rowCount;
    }

    if(p.hash) {
        var res, i=0, hashes=p.hash;
        for(;i<hashes.length;i++) {
            res=sql.exec(`delete from ${p.user}_pages where Hash=?`, [dehexify(hashes[i])]);
            total+=res.rowCount;
        }            
    }
    
    return makeReply( {json: {deleted:total, status:'ok'}} );
}

function checkentry(req) {
    var p=req.params;
    if(! checkkey( p.user, p.key) )
        return makeReply( {json: {status:'bad key'}} );

    p.furl = Sql.sandr('>>#=.*', '', p.furl);
    p.hash=crypto.sha1(p.furl, true);

    //insert into history
    //        Hash byte(20), Date date, Url varchar(128), 
    //        Label varchar(16), Title varchar(64)
    var herrorMsg = false, herror=false;

    if(p.skip != "true") {
        herror = !sql.one(`insert into ${p.user}_history values( ?hash, 'now', dayseq( convert('now','date')), ?furl, '', ?title )`,p);
        if(herror) herrorMsg = sql.errMsg;
    }

    //check if already saved
    var res = sql.one(`select convert( Last , 'int' ) last from ${p.user}_pages where Hash=?`, [p.hash]);

    if(!res)
        res = {saved:false};
    else {
        sql.one(`update ${p.user}_pages set LastV='now', Numvisits=Numvisits+1 where Hash=?`, [p.hash]);
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
    var user = sres.user;
    var q = req.query.query;
    var cwords, word;

    if(!q || q.length < suggestion_word_min_length ) 
        return {"suggestions":[]};

    var space = q.lastIndexOf(" ");

    if(space == -1)
    {
        word=q;
        res=sql.exec(
            `select Word value from ${user}_pages_Text_ftx where Word matches ? order by Count DESC`,
            [word.toLowerCase()+'%']
        );
        cwords=res.rows;
    }
    else 
    {
        // get suggestions for the partial word after the last space
        var pref = q.substring(0,space);

        word = q.substring(space+1);

        if(word.length < suggestion_word_min_length)
            return makeReply({json: { "suggestions":  [q] } });

        res=sql.exec(
            `select Word value from ${user}_pages_Text_ftx where Word matches ? order by Count DESC`,
            [word.toLowerCase()+'%']
        );
        cwords = res.rows;

        for( var i=0; i<cwords.length; i++)
        {
            var o=cwords[i];
            o.value = pref + " " + o.value;
        }
    }

    return makeReply( {json: {suggestions: cwords}});
}

module.exports = {
    //ajax endpoints
    "store.json":   store,
    "results.json": results,
    "delete.json":  delentry,
    "check.json":   checkentry,
    "autocomp.json":autocomp,
    "cred.json":    getcred,
    "admin.json":   adminpage,
    "hist.json":    histdata,
    //web pages
    "history.html": historypage,
    "search.html":  searchpage,
    "login.html":   login,
    "user.html":    userpage,
    "admin.html":   adminpage
}
