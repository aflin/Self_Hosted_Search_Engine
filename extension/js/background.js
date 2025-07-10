chrome.webRequest.onBeforeRequest.addListener(
    function(o) {
        let message = null;
        const pu=new URL(o.url);
        //youtube subtitles
        if(pu.hostname=='www.youtube.com' && pu.pathname=="/api/timedtext") {
                const pa=new URLSearchParams(pu.search);
                let vidid=pa.get('v');
                if(vidid)
                    message = { type: "yt-subs", req:o, v:vidid };
        }
        // else if, future needs go here

        if(message) {
            // Send to all tabs
            chrome.tabs.query({}, (tabs) => {
                for (const tab of tabs) {
                    if (tab.id >= 0) {
                        chrome.tabs.sendMessage(tab.id, message, () => {
                            // Ignore errors for tabs without the content script
                            if (chrome.runtime.lastError) {
                                // Optional: console.log("Error sending to tab", tab.id);
                            } 
                        });
                    }
                }
            });
        }
    },
    { urls: ["<all_urls>"] }
);
