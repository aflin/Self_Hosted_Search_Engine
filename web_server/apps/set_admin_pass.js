rampart.globalize(rampart.utils);

var cookie_expiration=86400;

//for testing from command line
if(!global.serverConf) serverConf={dataRoot:'/zfs/home/aaron/src/personal_search_extension/web_server/data'}

var Sql = use.sql;
var crypto = use.crypto;

var sql = new Sql.init(`${serverConf.dataRoot}/search/`, true);

var needpass=true;

while (needpass) {
    printf("Enter new password for admin: ");
    fflush(stdout);
    var data = fgets(stdin,256, {echo:false});
    printf("\n")
    var pass = trim(data);

    printf("Re-enter new password for admin: ");
    fflush(stdout);
    data = fgets(stdin,256,{echo:false});
    printf("\n")
    var pass2 = trim(data);

    if(pass!=pass2)
        printf("Passwords don't match\n");
    else
        needpass=false;
}

var resp, email='', admin_info=false;
function getresp(def, len) {
    var l = (len)? len: 1;
    var ret = stdin.getchar(l);
    if(ret == '\n')
        return def;
    printf("\n");
    return ret.toLowerCase();
}

res=sql.one("select * from accounts where Acctid='admin'");

if (res) {
    try {
        admin_info=JSON.parse(res.Acctinfo);
    } catch(e) {
        printf("The account info for 'admin' is corrupt, recreate record? (y/N): ");
        resp=getresp('n');
        if(resp=='n') {
            printf("Leaving record untouched and exiting\n");
            process.exit(1);
        }
        admin_info=false; //not necessary
    }
    if(admin_info) {
        printf("change the admin email (%s) too? (y/N): ", admin_info.email);
        resp=getresp('n');
    } else {
        resp='y';
        admin_info={};
    }
} else {
    resp='y';
    admin_info={};
}


if(resp =='y') {
    while(email=='') {
        printf("Enter new email for admin: ");
        data = fgets(stdin,256);
        email=trim(data);
    }
}


var salt = sprintf('%0B',crypto.rand(16));
admin_info.passsalt=salt;
admin_info.passhash=crypto.hmac(salt, pass)
if(email) admin_info.email=email;

if(res) {
    res=sql.one("update accounts set Acctinfo=? where Acctid='admin'",[admin_info]);
    if(!res)
        printf("failed to update accounts table. %s\n", sql.errMsg);
    else
        printf("successfully changed password.\n");
}

//printf("pass is %s, email is %s\n", pass, email);


//sql.exec("select Hash, Url, Dom from aaron_pages", {maxRows:-1},
