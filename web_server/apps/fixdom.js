rampart.globalize(rampart.utils);

var cookie_expiration=86400;

//for testing from command line
if(!global.serverConf) serverConf={dataRoot:'/zfs/home/aaron/src/personal_search_extension/web_server/data'}

var Sql = use.sql;
var crypto = use.crypto;
var urlutil=use.url;

var sql = new Sql.init(`${serverConf.dataRoot}/search/`, true);
var sql2 = new Sql.init(`${serverConf.dataRoot}/search/`, true);


sql.exec("select Hash, Url, Dom from aaron_pages", {maxRows:-1},
    function(row, i) {
        var res, comp = urlutil.components(row.Url);
        if(!comp)
            printf("NO DOM FOR %s\n", row.Url);
        else if(comp.host != row.Dom) {
            printf("%s vs %s for %s\n", comp.host, row.Dom, row.Url);
            if(/^file:\/\//.test(row.Url))
                comp.host="FILE";
            if(comp.host != "")
            {
                res = sql2.exec("update aaron_pages set Dom=? where Hash=?", [comp.host, row.Hash]);
                if(!res.rows) {
                    printf("update aaron_pages set Dom='%s' where Hash='%s'\n", comp.host, hexify(row.Hash)); 
                    printf("FAIL: %s\n", sql2.errMsg);
                    process.exit(1);
                }
            }
        }
    }
);
