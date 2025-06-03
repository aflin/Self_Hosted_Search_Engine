rampart.globalize(rampart.utils);

var urlutil=use.url;

var u="https://www.example.com:443/path/page.html#hashpos"

var comp = urlutil.components(u);

var nctlds = ['.com', '.net', '.org', '.edu', '.co', '.gov', '.ai', '.io', '.dev', 
              '.info', '.site', '.me', '.gg', '.ca', '.mil', '.us', 
printf("%3J\n", comp);
/*
{
   "scheme": "https",
   "username": "",
   "password": "",
   "origin": "https://www.example.com",
   "host": "www.example.com",
   "authority": "//www.example.com",
   "path": "/path/",
   "fullPath": "/path/page.html",
   "queryString": {},
   "hash": "#hashpos",
   "url": "https://www.example.com/path/page.html",
   "href": "https://www.example.com/path/page.html#hashpos",
   "port": 443,
   "file": "page.html"
}

*/