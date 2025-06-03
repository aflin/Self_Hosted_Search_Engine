rampart.globalize(rampart.utils);
var ev = rampart.event;


function getuser(req){
    /* Here is where you can look at headers, cookies or whatever 
       to find user name. */
    return req.cookies.username;
}

/* This function is run for every incoming websocket message.
 * The first run will have an empty body.
 * The req object is reused with req.body updated for each incoming message.
 * Sending data back is done with req.wsSend.
 * Any data printed or put using req.printf/req.put will also be sent when
 *   req.wsSend() is called.
 * req.count == number of times function has been called since connection was made.
 * req.wsOnDisconnect is a function that is run when you disconnect or you are disconnected by the client.
 * req.wsEnd forces a disconnect (but runs callback first);
 * req.websocketId is a unique number to identify the current connection.
 * req.wsIsBin is true if the client send binary data.
 */
module.exports = function (req)
{
    /* first run, req.body is empty */
    if (!req.count) {
        /* check for username */
        req.user_name=getuser(req);
        if(!req.user_name){
            req.wsSend({from: "System", id:req.websocketId, msg: "No user name provided, disconnecting"});
            setTimeout(function(){
                req.wsEnd();
            },5);
            return;
        }

        /* what to do if we are sent a message from another user.  rampart.event.on
           registers a function to be executed.  The function takes a parameter from "on"
           and a parameter from "trigger".  The function is registered with the event name
           "msgev" and the function name "userfunc_x"                                       */
        ev.on("msgev", "userfunc_"+req.websocketId, function(req, data) {
            if(data.id != req.websocketId) {//don't echo our own message
                // don't delete data.id, because it is needed by other callbacks
                // but don't send it either
                // msg -> to single client listening
                if (data.file)
                {
                    req.wsSend({
                        from: data.from, 
                        file: {name:data.file.name, type: data.file.type}
                    });
                    req.wsSend(data.file.content);
                }
                else
                {
                    req.wsSend({
                        from: data.from, 
                        msg: data.msg
                    });
                }
            }
        }, req);

        // function for when you are disconnected (or you disconnect using req.wsEnd())
        req.wsOnDisconnect(function(){ 
            // msg -> everyone listening
            ev.trigger("msgev", {from:'System', id:req.websocketId, msg: req.user_name+" has left the conversation"});
            // remove our function from the event
            ev.off("msgev", "userfunc_"+req.websocketId);//remove function, but not event
        });

        /* send a notification to all listening that we've joined the conversation */
        // msg -> everyone listening
        ev.trigger("msgev", {from:'System', id:req.websocketId, msg: req.user_name+" has joined the conversation"});
        /* req.wsSend and return from this function perform the same operation */
        return {from: "System", msg: `Welcome ${req.user_name}`};
    }

    /* second and subsequent run.  Client has sent a message
       and we need to process and forward it to others who are
       listening via rampart.event.on above                      */

    /* we are sent a file from the client in two parts: 1) JSON meta info, 2) binary data */
    var fileInfo;
    if(!req.wsIsBin && req.body.length)
    {
        /* messages are just plain text, but
           if it is a file, first we get the file info in JSON format */
        try{
            fileInfo=JSON.parse(req.body);
        } catch(e) {
            /* it is not binary, or json, so it must be a message */
            fileInfo = false;
        }
    }

    /* if it is binary data, we assume it is a file
       and the file info was already sent            */
    var file;
    if(req.wsIsBin)
    {
        if(req.files && req.files.length)
        {
            //get the first entry of file meta info
            file = req.files.shift();
            // add the body buffer to it
            file.content = req.body;
            // tell everyone who it's from
            file.from=req.user_name;
        }
        else
            file = {from:req.user_name, name:"", type:"application/octet-stream", content:req.body};
    }
    else
        req.body = sprintf("%s",req.body);//It's not binary, convert body to a string

    if(fileInfo && fileInfo.file)
    {
        if(!req.files)
            req.files = [];
        /* store file meta info in req where we will retrieve it next time */
        req.files.push(fileInfo.file);
        // return undefined (or null) and get the actual file in the next message
    }
    else if (file)
    {
        /* we received a file, reassembled its meta info.  Send it to all that are listening */
        ev.trigger("msgev", {from:req.user_name, id:req.websocketId, file: file});
    }
    else if(req.body.length)
    {
        //send the message to whoever is listening
        ev.trigger("msgev", {from:req.user_name, id:req.websocketId, msg:req.body});
    }
    /* no data is sent back to the client.  But it is sent to others from the rampart.event.on
       function which they registered in their own connections.                                */
    return null;
}
