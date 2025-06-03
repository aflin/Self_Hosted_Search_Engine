rampart.globalize(rampart.utils);

var cookie_expiration=86400;

//for testing from command line
if(!global.serverConf) serverConf={dataRoot:'/usr/local/rampart/web_server/data'}

var Sql = use.sql;
var crypto = use.crypto;
var urlutil=use.url;

var sql = new Sql.init(`${serverConf.dataRoot}/search/`, true);

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

    // do we need indexes on this?  How large will it get?
    // might be better to use lmdb.

    return true;
}


function makeUserTables(tbname) {
    if(!tableExists(`${tbname}_pages`)) {
        sql.exec(`create table ${tbname}_pages
        ( Hash byte(20), Last date, Numvisits int, 
          Dom varchar(32), Url varchar(128), Image varchar(128), 
          Title varchar(64), Meta varchar(16), Text varchar(1024)
        );`);

        if(!tableExists(`${tbname}_pages`)) {
            fprintf(stderr, `error creating ${tbname}_pages: %s\n`, sql.errMsg);
            return false;
        }
    }

    if(!indexExists(`${tbname}_pages_Dom_x`)) {
        sql.exec(`create index ${tbname}_pages_Dom_x on ${tbname}_pages(Dom);`);
        if(!indexExists(`${tbname}_pages_Dom_x`)) {
            fprintf(stderr, `error creating ${tbname}_pages_Dom_x: %s\n`, sql.errMsg);
            return false;
        }
    }

    if(!indexExists(`${tbname}_pages_Hash_ux`)) {
        sql.exec(`create unique index ${tbname}_pages_Hash_ux on ${tbname}_pages(Hash);`);
        if(!indexExists(`${tbname}_pages_Hash_ux`)) {
            fprintf(stderr, `error creating ${tbname}_pages_Hash_ux: %s\n`, sql.errMsg);
            return false;
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
            return false;
        }
    }

    if(!tableExists(`${tbname}_history`)) {
        sql.exec(`create table ${tbname}_history (
            Hash byte(20), Date date, Url varchar(128), 
            Label varchar(16), Title varchar(64)
            );`);
        if(!tableExists(`${tbname}_history`)) {
            fprintf(stderr, `error creating ${tbname}_history: %s\n`, sql.errMsg);
            return false;
        }
    }

    if(!indexExists(`${tbname}_history_Hash_x`)) {   
        sql.exec(`create index ${tbname}_history_Hash_x on ${tbname}_history(Hash);`);
        if(!indexExists(`${tbname}_history_Hash_x`)) {
            fprintf(stderr, `error creating ${tbname}_history_Hash_x: %s\n`, sql.errMsg);
            return false;
        }
    }

    if(!indexExists(`${tbname}_history_Date_x`)) {   
        sql.exec(`create index ${tbname}_history_Date_x on ${tbname}_history(Date);`);
        if(!indexExists(`${tbname}_history_Date_x`)) {
            fprintf(stderr, `error creating ${tbname}_history_Date_x: %s\n`, sql.errMsg);
            return false;
        }
    }

    return true;
}



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

    var res 
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


function userpage(req){
    if(!checkcred(req))
        return loginredir;

    return "THE USER PAGE (with a search form) GOES HERE"
}

function getusers(req) {
    var res = sql.exec("select Acctid, Acctinfo.$.email, Acctinfo.$.passhash from accounts",{returnType:'array'});   
    return {json:res.rows};
}

function make_acctinfo(email,pass) {
    var salt = sprintf('%0B',crypto.rand(16));
    return {
        passsalt: salt,
        passhash: crypto.hmac(salt, pass),
        email: email
    }
}

function adduser(req) {
    var user = req.params.user;
    var pass = req.params.pass;
    var email= req.params.email;

    if(sql.one("select * from accounts where Acctid=?",[user]))
        return {json:{error: "Account exists"}};

    var acctinfo = make_acctinfo(email,pass);
    sql.exec("insert into accounts values (COUNTER, ?, 'u', ?)", [user, acctinfo]);
    makeUserTables(user);

    if( ! sql.one("select * from accounts where Acctid=?",[user]))
        return {json:{error: sql.errMsg}};

    return {json:{key:acctinfo.passhash}}
}

function deluser(req){
    var users = req.params.user, j=0;
    for (var i=0;i<users.length;i++) {
        if(users[i]!='admin') {
            sql.one("delete from accounts where Acctid=?",[users[i]]);
            sql.one(`drop table  ${users[i]}_pages`);
            sql.one(`drop table  ${users[i]}_history`);
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
    if(!checkcred(req, true)) { req.printf("FAIL 1\n");
        return loginredir;}

    // ajax json requests
    switch (req.params.action) {
        case 'get':
            return getusers(req);
        case 'add':
            return adduser(req);
        case 'del':
            return deluser(req);
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
            <td style="width:7ch">\${chbox}</td>
            <td><center class="username">\${user}</center></td>
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
<!DOCTYPE html>
<html>
<head>
    <title>Log in page</title>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    <script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js" integrity="sha256-lSjKY0/srUM9BE3dPm+c4fBo1dky2v27Gdjm2uoZaL0=" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/pepper-grinder/jquery-ui.css">
    <script>
        ${adminscr}
    </script>
</head>
<body>
    <span style="float:right"><a href="login.html?logout=1">Log out</a></span>
    <h2>Admin Page</h2>
    <h3>Users</h3>
    <table id="userlist">
        <tr id="hrow">
            <th style="width:7ch; text-align:left"><label><input type="checkbox" id="userselall">All</label></th>
            <th style="width:20ch">Name</th>
            <th>Email</th>
            <th>Password</th>
            <th style="width:32ch">Key</th>
        </tr>
    </table>
    <button id="userdel">Delete User(s)</button>
    <button id="userup">Update User(s)</button>
    
`);

    req.put(`<hr><br>
        <table id="newuser">
        <tr>
            <td style="width:7ch">Add:</td>
            <td style="width:20ch"><input placeholder="name" id="username" type=text size=15></td>
            <td><input placeholder="email" id="useremail" type=text size=20></td>
            <td><input placeholder="password" id="userpass" type=text size=20></td>
            <td><div style="float:right">
                <button id="useradd">Add New</button>
            </div></td>
        </tr>
        </table>
    </form>
</body>
</html>
`);


    return {html:null};
}

function checkpass(name,pass) {
    var cred = sql.one("select Acctinfo.$.passhash passhash, Acctinfo.$.passsalt passsalt from accounts where Acctid=?", [name]);
    var ainfo, calchash;

    if(cred && cred.passhash) {
        calchash = crypto.hmac(cred.passsalt, pass);
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

var keycache={};

function checkkey(name,key) {
    if(!name) return false;

    // how many users before we need to use something more sophisticated, or skip all together?
    if(keycache[name] == key)
        return true;

    var cred = sql.one("select Acctinfo.$.passhash passhash from accounts where Acctid=?", [name]);

    if(cred && cred.passhash == key) {
        keycache[name]=key;
        return true;
    }
    return false;
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

    var res = sql.exec(`insert into ${p.user}_pages values (?,?,?, ?,?,?, ?,?,?);`,
        [hash, 'now', 1, p.dom, p.furl, p.img, p.title, '', p.text]  );

    if(res.rowCount == 0) {
        if( sql.errMsg.indexOf('insert duplicate value') > -1 ) {
            res = sql.exec(`update ${p.user}_pages set Last='now', Numvisits = Numvisits + 1, Title=?, Text=? where Hash=?`,
                [p.title, p.text, hash]    );
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
    if(! checkkey( p.user, p.key) )
        return makeReply( {json: {status:'bad key'}} );

    p.sk= p.sk ? parseInt(p.sk) :0;

//    image, url, last, hash, dom, title, abstract 
    var res=sql.exec(`select bintohex(Hash) hash, convert( Last , 'int' ) last, Dom dom, Url url, Image image, Title title,
        Text abstract from ${p.user}_pages where Text likep ?q`,
        p, {skipRows: p.sk, includeCounts:true }
    );

    for (var i=0; i<res.rows.length; i++) {
        var row=res.rows[i];
        row.abstract = Sql.abstract(row.abstract, {max:230, style:'querybest', query:p.q, markup:"%mbH"});
    }
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
    var hash=crypto.sha1(p.furl, true);

    var res=sql.one(`select convert( Last , 'int' ) last from ${p.user}_pages where Hash=?`, [hash]);

    if(res) {
        res.saved=true;
        return makeReply( {json: res} );
    }
    return makeReply( {json: {saved:false}} );
}

var suggestion_word_min_length=3;

function autocomp(req){
    var res;
    var p=req.params;

    if(! checkkey( p.user, p.key) )
        return makeReply( {json: {status:'bad key'}} );

    var q = req.query.query;
    var cwords, word;

    if(!q || q.length < suggestion_word_min_length ) 
        return {"suggestions":[]};

    var space = q.lastIndexOf(" ");

    if(space == -1)
    {
        word=q;
        res=sql.exec(
            `select Word value from ${p.user}_pages_Text_ftx where Word matches ? order by Count DESC`,
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
            `select Word value from ${p.user}_pages_Text_ftx where Word matches ? order by Count DESC`,
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
    "admin.json":   adminpage,
    "cred.json":    getcred,
    //web pages
    "login.html":   login,
    "user.html":    userpage,
    "admin.html":   adminpage
}
