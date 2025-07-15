/* usage:
    var urlutils = require('rampart-url');

To run tests:

    rampart rampart-url.js

    or

    node rampart-url.js

    For node test, we need to make a copy, so you should have write permissions
    in the directory containint "rampart-url.js".

    // we've got a relative link from http://example.com/dir/mypage.html and want the full url
    var fullurl = urlutils.absUrl("http://example.com/dir/mypage.html", "../images/myjpeg.jpg");
    // fullurl: "http://example.com/images/myjpeg.jpg"
    // returns undefined if it cannot parse either argument.

    // The second argument can be an array of strings (i.e.
    //    urlutils.absUrl("http://example.com/dir/mypage.html", ["/myfile.hml", "../images/myjpeg.jpg"])
    //    and you will get an array of strings back.

    // true can be given as a third argument, and it will return components (or array of components)
    //   like urlutils.components() below.

    //say we want to normalize a url and get its components
    var urlinfo = urlutils.components("http://me:mypass@example.com:8088/dir/mypage.html?dir=%2fusr%2flocal%2f#my-spot-on-page")
    /* urlinfo =
        {
           "scheme": "http",
           "username": "me",
           "password": "mypass",
           "origin": "http://me:mypass@example.com:8088",
           "host": "example.com",
           "authority": "//me:mypass@example.com:8088",
           "path": "/dir/",
           "fullPath": "/dir/mypage.html",
           "queryString": {
              "raw": "dir=%2fusr%2flocal%2f",
              "components": {
                 "dir": "/usr/local/"
              }
           },
           "hash": "#my-spot-on-page",
           "url": "http://me:mypass@example.com:8088/dir/mypage.html?dir=%2fusr%2flocal%2f",
           "href": "http://me:mypass@example.com:8088/dir/mypage.html?dir=%2fusr%2flocal%2f#my-spot-on-page",
           "portText": "8088",
           "port": 8088,
           "file": "mypage.html"
        }

    // urlutils.components returns undefined if it could not parse.
    // if just parsing a path, do urlutils.components("/this/is/my/nonexistent/../path.html", true)
    // where true means process just the path portion.

*/

function _qToO(qs) {
    var pairs = qs.split('&');
    var comp={};
    var j=0;

    if(global.rampart && rampart.utils && rampart.utils.queryToObject) {
        comp = rampart.utils.queryToObject(qs);
        // rampart version doesn't handle "?this&that" without equal signs
        // and will skip those. We'll do that manually here:
        if(Object.keys(comp).length != pairs.length)
        {
            for (var i=0;i<pairs.length;i++) {
                var pair = pairs[i];
                var pos = pair.indexOf('=');
                if(pos == -1 )
                    comp[j++]=decodeURIComponent(pair);
            }
        }
        return comp;
    }

    // pure JS version.  Doesn't include array expanding as in
    // "?key2=1&key2=2&key2=3" -> {key2:["1","2","3"]}
    // or JSON parsing as in
    // "?key2=%5b1%2c2%2c3%5d" -> {key2:[1,2,3]}
    for (var i=0;i<pairs.length;i++) {
        var pair = pairs[i];
        var pos = pair.indexOf('=');
        if(pos > 0 ) {
            var val=pair.substring(pos+1).replace('+','%20');
            var key = decodeURIComponent(pair.substring(0,pos));
 
            val=decodeURIComponent(val);

            if(comp[key]){
                if( typeof comp[key] == 'object' ) {
                    comp[key].push(val);
                } else {
                    comp[key] = [ comp[key], val];
                }
            }
            else
                comp[key] = val;
        } else {
            comp[decodeURIComponent(pair)]=true;
        }
    }

    return comp;
}

function querystringToObject(qs){
    var ret = {raw:qs}

    ret.components = _qToO(qs);

    return ret;
}

// takes path without query string
function normalizePath(path) {
    var parts;
    var outparts = [];

    parts = path.split(/\/+/);

    for (var i=0; i<parts.length; i++) {
        var part = parts[i];
        if(part == '..') {
            if(outparts.length>1) //first entry is an empty string ["", ...]
                outparts.pop();
            //else servers or browsers tend to make this act like './'
            // so we will skip
        } else if (part != '.') {
            outparts.push(part);
        }
        // else skip './'
    }
    return outparts.join('/');
}

portmap = {
    http:  80,
    https: 443,
    ftp:   21,
    ssh:   22,
    smpt:  25,
    ws:    80,
    wws:   443,
    tftp:  69,
    gopher:70,
    sftp:  115,
    imap:  143,
    imaps: 933,
    pop3:  110,
    pop3s: 995,
    ftps:  990,
    telnets: 992
}

function components(url, pathOnly) {
    var ret = {
        scheme:"",
        username:"",
        password:"",
        origin:"",
        host:"",
        authority:"",
        path:"",
        fullPath:"",
        queryString: {},
        hash:"",
        url:"",
        href:""
    };
    var tmp=url, mtmp, pos;

    if(typeof url != 'string')
        return;

    if(!pathOnly)
    {
        var schemeNSlashes=0;
        var schemeSlashes="";
        var userPass=""

        // SCHEME
        pos = tmp.indexOf(':');
        if( pos > 0 ) {
            ret.scheme = url.substring(0,pos).toLowerCase();
            // https://www.rfc-editor.org/rfc/rfc3986.txt
            // scheme      = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
            if( ! /^[a-z][a-z0-9\+\-\.]+/.test(ret.scheme) )
                return;
            tmp = url.substring(pos+1);
        } else
            return;

        if(ret.scheme=='javascript') {
            ret.path = ret.fullPath = tmp;
            ret.url = ret.scheme + ':' + ret.fullPath;
            return ret;
        }
        if(tmp.charAt(0) == '/') {
            if(tmp.charAt(1) == '/') {
                schemeNSlashes=2;
                schemeSlashes="//";
            } else {
                schemeNSlashes=1;
                schemeSlashes="/";
            }
        }

        if(schemeNSlashes)
            tmp = tmp.substring(schemeNSlashes);

        //USER/PASS
        mtmp = tmp.match(/^[^\/\?@]+@/);
        if(mtmp && mtmp.length) {
            userPass = mtmp[0];
            pos = userPass.indexOf(':');
            if(pos > -1)
            {
                ret.username = userPass.substring(0,pos);
                ret.password = userPass.substring(pos+1, userPass.length -1);
            }
            tmp = tmp.substring(userPass.length);
        }

        //AUTHORITY less the port and HOST
        //FIXME? not catching host ending in '-', which is illegal
        mtmp = tmp.match(/^[a-zA-Z0-9\-\.\_]*/); // added '_' 2025-05-24

        if(mtmp && mtmp.length && mtmp[0].length) { // added mtmp[0].length 2025-05-24
            ret.host = mtmp[0].toLowerCase();
        } else {
            //ipv6 address
            mtmp = tmp.match(/^\[[0-9A-Fa-f:\/]+\]/);
            if(mtmp && mtmp.length)
                ret.host = mtmp[0].toLowerCase();
        }
        ret.authority = schemeSlashes + userPass + ret.host;
        tmp = tmp.substring(ret.host.length);

        //PORT
        if(tmp.charAt(0) == ':') {
            tmp = tmp.substring(1);
            mtmp = tmp.match(/^\d+/);

            if(mtmp && mtmp.length) {
                ret.port = parseInt(mtmp[0]);
                if (ret.port != portmap[ret.scheme])
                    ret.portText = mtmp[0];
            } else
                return;
            tmp = tmp.substring(mtmp[0].length);
            ret.origin = ret.scheme + ':' +ret.authority + (ret.portText ? ':' + ret.portText  : '');
            //AUTHORITY with port
            ret.authority = ret.authority + (ret.portText? ':' + ret.portText  : '');
        } else {
            ret.port = portmap[ret.scheme];
            ret.origin = ret.scheme + ':' +ret.authority;
        }
    }
    else //start at path
        tmp=url;

    //HASH
    pos = tmp.indexOf('#');
    if(pos > -1) {
        ret.hash = tmp.substring(pos);
        tmp = tmp.substring(0,pos);
    }

    var fchar = tmp.charAt(0);
    if(fchar != '/' && fchar != '' && fchar != '?')
        return;

    if(fchar == ''){
        ret.file = '';
        ret.path = '/';
    } else if(fchar =='?') {
        ret.path = '/';
        ret.file = '';
        ret.queryString = querystringToObject( tmp.substring(1) );
    }

    //QUERYSTRING
    pos = tmp.indexOf('?')
    if(pos != -1) {
        ret.queryString = querystringToObject( tmp.substring(pos+1) );
        tmp=tmp.substring(0,pos);
    } else ret.queryString = {};

    //PATHS & Filename
    pos = tmp.lastIndexOf('/');
    ret.path = tmp.substring(0,pos+1);
    ret.file = tmp.substring(pos+1);

    if(ret.path == '') ret.path='/';
    if (fchar =='/'){
        ret.path = normalizePath(ret.path);
    }

    ret.fullPath = ret.path + ret.file;

    if(pathOnly)
        return ret;
    ret.url = ret.scheme + ':' + ret.authority + ret.fullPath +
              (ret.queryString.raw ? '?' + ret.queryString.raw : '');

    ret.href = ret.url + ret.hash;
    return ret;
}

function rewriteUrl(srcComp, path, includeComponents) {
    var tbase=srcComp.base;
    var qspos;
    var qs="";
    var urlComp;

    if(/^javascript:/i.test(path)){
            return "javascript:" + path.substring(11);
    }

    // returns null if not absolute (has at min 'scheme://host')
    urlComp = components(path);

    if (urlComp) {
        if(includeComponents)
            return urlComp;
        return urlComp.url;
    }

    if(path.charAt(0) != '/')
        path = srcComp.path + path;

    urlComp = components(path, true); //true == process as a path without scheme:authority

    var ret = srcComp.origin + urlComp.fullPath +
           (urlComp.queryString.raw ? '?' + urlComp.queryString.raw: '');

    if(includeComponents)
        return components(ret);

    return ret;
}

function rewriteUrls(src, urls, includeComponents) {
    var srcComp = components(src);
    var i;

    if (!srcComp)
        return;

    if(Array.isArray(urls)) {
        var ret=[];
        for (i=0; i<urls.length; i++) {
            var newurl= rewriteUrl(srcComp, urls[i], includeComponents);
            ret.push(newurl);
        }
        return ret;
    } else if (typeof urls == "string") {
        return rewriteUrl(srcComp, urls, includeComponents);
    } else
        return;

}

var ismod = false;

if(global.rampart) {
    if(module && module.exports)
        ismod=true;
} else {
    ismod = ( require.main !== module );
}

if(ismod) {
    exports.absUrl=rewriteUrls;
    exports.components=components;
} else {


    var selfmod, removemod, fs;

    if(global.rampart)
        selfmod = process.script;
    else {
        fs = require('fs');
        // node won't load itself as a module
        selfmod = process.mainModule.filename;
        removemod= process.mainModule.filename.replace("rampart-url.js", "tmp-url.js");
        try {
            fs.copyFileSync(selfmod,removemod);
        } catch(e) {
            console.log("Error copying to temp file: ", e);
        }
        selfmod=removemod;
    }
    var testFeature;
    var url = require(selfmod);

    if(global.rampart)
    {
        rampart.globalize(rampart.utils);
        testFeature = function(name,test)
        {
            var error=false;
            printf("testing url %-56s - ", name);
            fflush(stdout);
            if (typeof test =='function'){
                try {
                    test=test();
                } catch(e) {
                    error=e;
                    test=false;
                }
            }
            if(test)
                printf("passed\n")
            else
            {
                printf(">>>>> FAILED <<<<<\n");
                if(error) console.log(error);
                process.exit(1);
            }
            if(error) console.log(error);
        }
    }
    else
    {
        testFeature = function(name,test)
        {
            var error=false;
            var preout=`testing ${name}`;
            var spaces = Buffer.alloc( 50 - preout.length, ' ').toString();
            process.stdout.write(preout+spaces+" - ");

            if (typeof test =='function'){
                try {
                    test=test();
                } catch(e) {
                    error=e;
                    test=false;
                }
            }
            if(test)
                console.log("passed")
            else
            {
                console.log(">>>>> FAILED <<<<<");
                if(error) console.log(error);
                process.exit(1);
            }
            if(error) console.log(error);
        }
    }


    var tests = [
        //"desc", src, url, expected_result
        [ "Root Relative", "http://dogpile.com/search/somewhere.html?hello", "/file.html?dir=/my/dir", "http://dogpile.com/file.html?dir=/my/dir" ],
        [ "Current Dir Relative", "http://dogpile.com/search/somewhere.html?hello/there", "./file.html", "http://dogpile.com/search/file.html" ],
        [ "No Slash in Src", "http://dogpile.com?hello", "/file.html", "http://dogpile.com/file.html" ],
        [ "Caps in origin and '..'", "HTTP://Rampart.dev/a/deep/dir/leading/nowhere", "../../dir/going/somewhere", "http://rampart.dev/a/deep/dir/going/somewhere"],
        [ "Different Domain", "http://example.com/search/somewhere.html?hello", "http://google.com//dir/../././file.html", "http://google.com/file.html" ],
        [ "Different Domain, no Slash", "http://example.com/", "http://google.com?file.html", "http://google.com/?file.html" ],
        [ "Too many '..'", "HTTP://Rampart.dev/a/dir/", "../../../dir/going/somewhere", "http://rampart.dev/dir/going/somewhere" ],
        [ "Too many '/'", "HTTP://Rampart.dev", "////dir//going/////somewhere", "http://rampart.dev/dir/going/somewhere" ],
        [ "With Port", "HTTPS://Rampart.dev:8088", "./dir/going/somewhere", "https://rampart.dev:8088/dir/going/somewhere" ],
        [ "With beginning .. and no Slash in Src", "HTTP://Rampart.dev", "../dir/going/somewhere", "http://rampart.dev/dir/going/somewhere" ],
        [ "Ftp and ..", "FTP://Rampart.dev:8088", "../dir/going/somewhere", "ftp://rampart.dev:8088/dir/going/somewhere"],
        [ "Javascript link", "HTTP://Rampart.dev:8088", "JavaScript:myfunc()", "javascript:myfunc()" ]
    ]

    for (var i=0; i<tests.length; i++) {
        var test = tests[i];
        var res = url.absUrl(test[1],test[2]);
        if( res !== test[3] )
            console.log(`Got "${res}"`);
        testFeature(test[0], res == test[3]);
    }
    var testarr  = ["/different/dir", "./page.html", '../new/dir/'];
    var expected = ["http://rampart.dev/different/dir","http://rampart.dev/a/dir/page.html","http://rampart.dev/a/new/dir/"];
    var base = "http://rampart.dev/a/dir/";
    var res = url.absUrl(base, testarr);

    var ret = true;
    for (i=0;i< testarr.length; i++) {
        var e=expected[i], r=res[i];
        ret = ret && (e==r)
        if(e!==r)
            console.log(`Got "${r}"`);
    }
    testFeature("Passing array", ret);

    expected = [
        {
           "scheme": "https",
           "username": "",
           "password": "",
           "origin": "https://rampart.dev:8088",
           "host": "rampart.dev",
           "authority": "//rampart.dev:8088",
           "path": "/this/",
           "fullPath": "/this/THAT.html",
           "queryString": {
              "raw": "dir=/my/dir",
              "components": {
                 "dir": "/my/dir"
              }
           },
           "hash": "",
           "url": "https://rampart.dev:8088/this/THAT.html?dir=/my/dir",
           "href": "https://rampart.dev:8088/this/THAT.html?dir=/my/dir",
           "portText": "8088",
           "port": 8088,
           "file": "THAT.html"
        },
        {
           "scheme": "https",
           "username": "",
           "password": "",
           "origin": "https://rampart.dev:8088",
           "host": "rampart.dev",
           "authority": "//rampart.dev:8088",
           "path": "/this/",
           "fullPath": "/this/that.html",
           "queryString": {
              "raw": "/my/dir",
              "components": {
                 "/my/dir": true
              }
           },
           "hash": "",
           "url": "https://rampart.dev:8088/this/that.html?/my/dir",
           "href": "https://rampart.dev:8088/this/that.html?/my/dir",
           "portText": "8088",
           "port": 8088,
           "file": "that.html"
        },
        {
           "scheme": "https",
           "username": "",
           "password": "",
           "origin": "https://rampart.dev:8088",
           "host": "rampart.dev",
           "authority": "//rampart.dev:8088",
           "path": "/this/",
           "fullPath": "/this/that.html",
           "queryString": {
              "raw": "%2fmy/dir&x=%2fyour/dir/",
              "components": {
                 "/my/dir" : true,
                 "x": "/your/dir/"
              }
           },
           "hash": "",
           "url": "https://rampart.dev:8088/this/that.html?%2fmy/dir&x=%2fyour/dir/",
           "href": "https://rampart.dev:8088/this/that.html?%2fmy/dir&x=%2fyour/dir/",
           "portText": "8088",
           "port": 8088,
           "file": "that.html"
        },
        {
           "scheme": "https",
           "username": "",
           "password": "",
           "origin": "https://rampart.dev",
           "host": "rampart.dev",
           "authority": "//rampart.dev",
           "path": "/",
           "fullPath": "/",
           "queryString": {
              "raw": "dir=/my/dir",
              "components": {
                 "dir": "/my/dir"
              }
           },
           "hash": "#placemarker",
           "url": "https://rampart.dev/?dir=/my/dir",
           "href": "https://rampart.dev/?dir=/my/dir#placemarker",
           "port": 443,
           "file": ""
        },
        {
           "scheme": "ftp",
           "username": "username",
           "password": "password",
           "origin": "ftp://username:password@rampart.dev",
           "host": "rampart.dev",
           "authority": "//username:password@rampart.dev",
           "path": "/path/to/my/",
           "fullPath": "/path/to/my/stuff.tar.gz",
           "queryString": {},
           "hash": "",
           "url": "ftp://username:password@rampart.dev/path/to/my/stuff.tar.gz",
           "href": "ftp://username:password@rampart.dev/path/to/my/stuff.tar.gz",
           "port": 21,
           "file": "stuff.tar.gz"
        },
        {
           "scheme": "file",
           "username": "",
           "password": "",
           "origin": "file://",
           "host": "",
           "authority": "//",
           "path": "/usr/local/",
           "fullPath": "/usr/local/myfile.txt",
           "queryString": {},
           "hash": "",
           "url": "file:///usr/local/myfile.txt",
           "href": "file:///usr/local/myfile.txt",
           "file": "myfile.txt"
        },
        {
           "scheme": "javascript",
           "username": "",
           "password": "",
           "origin": "",
           "host": "",
           "authority": "",
           "path": "myfunc()",
           "fullPath": "myfunc()",
           "queryString": {},
           "hash": "",
           "url": "javascript:myfunc()",
           "href": ""
        },
        {
           "scheme": "http",
           "username": "me",
           "password": "mypass",
           "origin": "http://me:mypass@example.com:8088",
           "host": "example.com",
           "authority": "//me:mypass@example.com:8088",
           "path": "/dir/",
           "fullPath": "/dir/mypage.html",
           "queryString": {
              "raw": "dir=%2fusr%2flocal%2f",
              "components": {
                 "dir": "/usr/local/"
              }
           },
           "hash": "#my-spot-on-page",
           "url": "http://me:mypass@example.com:8088/dir/mypage.html?dir=%2fusr%2flocal%2f",
           "href": "http://me:mypass@example.com:8088/dir/mypage.html?dir=%2fusr%2flocal%2f#my-spot-on-page",
           "portText": "8088",
           "port": 8088,
           "file": "mypage.html"
        }
    ];
    testkeys = [ "scheme", "username", "password", "origin", "host", "authority", "path",
                 "fullPath", "hash", "url", "href", "portText", "port", "file"            ];

    test = [
        "https://rampart.dev:8088/this/THAT.html?dir=/my/dir",
        "https://rampart.dev:8088/this/that.html?/my/dir",
        "https://rampart.dev:8088/this/that.html?%2fmy/dir&x=%2fyour/dir/",
        "https://rampart.dev?dir=/my/dir#placemarker",
        "ftp://username:password@rampart.dev/path/to/my/stuff.tar.gz",
        "file:///usr/local/src/../myfile.txt",
        "javascript:myfunc()",
        "http://me:mypass@example.com:8088/dir/mypage.html?dir=%2fusr%2flocal%2f#my-spot-on-page"
    ];
    for (i=0;i<test.length; i++) {
        var u = test[i];
        var e = expected[i];
        testFeature("Components #"+(i+1), function() {
            var r = url.components(u);
            var ret = true;
            for (var j = 0; j<testkeys.length;j++) {
                var key = testkeys[j];
                if( e[key] != r[key] )
                {
                    console.log(`Expecting "${e[key]}", got "${r[key]}"`)
                    //printf("%3J\n", r);
                }
                ret = ret &&  e[key] == r[key];
            }
            if(e.queryString.components) {
                var ecomp = e.queryString.components;
                var rcomp = r.queryString.components
                var qkeys = Object.keys(ecomp);
                ret = ret && e.queryString.raw && r.queryString.raw;
                for (var k=0;k<qkeys.length;k++) {
                    var qkey = qkeys[k];
                    if (ecomp[qkey] != rcomp[qkey])
                    {
                        console.log(`expecting "${ecomp[qkey]}", got "${rcomp[qkey]}"`);
                        printf("%3J\n", r);
                    }
                    ret = ret &&  ecomp[qkey] == rcomp[qkey];
                }
            }
            return ret;
        });
    }

    if(removemod) {
        try {
            fs.unlinkSync(removemod);
        } catch(e) {
            console.log("Error removing temp file", e);
        }
    }
}
