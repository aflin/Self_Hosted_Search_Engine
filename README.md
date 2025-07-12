# Self_Hosted_Search_Engine
Browser extension and server saves visited pages to a personal search engine

# Extension
We have not yet published to chrome, safari or firefox stores.
A self signed firefox extension is available in this directory.  To install, download the raw file and drag and drop it onto any open firefox page.
For Chrome, you will need to enable developer tools and use the *extension/* directory in this repo to load the extension.

# Server
The server requires [rampart](https://rampart.dev/) to be installed.  Clone this repo and run the *shse-server.sh* command to start the server.
More configuration can be found in the *web_server/web_server_conf.js* file.

A docker is also available.  You will likely want your data to persist, so here is a suggested use:
```
mkdir ~/.shse-data
docker run -d -p 4443:443 -v ~/.shse-data:/data rampartfts/shse
```
The server must run as a secure server.  When the docker starts, it will create its own self signed certificate.
This will require you to go to ``https://localhost:4443/`` and "accept the risks" to allow it to be used.
There is a certificate management page should you wish to upload valid certificates.

If you plan to run it behind, e.g., nginx reverse proxy (with its own valid certificates), you can start the server in httpOnly mode:
```
docker run -d -p 8080:80 -v ~/.shse-data:/data rampartfts/shse httpOnly
```

Enjoy!
