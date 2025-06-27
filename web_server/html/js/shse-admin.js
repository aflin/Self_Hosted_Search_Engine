var jsonpage;

function dialogmsg(msg) {
    if(!$("#dialog-msg").length)
        $('body').append(
            '<div id="dialog-msg" title="Alert Message">' +
                `<p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span><span id="dialog-msg-span">${msg}</span></p>`+
            '</div>');
    else
        $("#dialog-msg-span").html(msg);
    $("#dialog-msg").dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        buttons: {
            "OK": function() {
                $(this).dialog("close");
            }
        }
    });
}

function do_certs() {
    //action buttons
    var act=$('#activate');
    var upl=$('#upload');
    var del=$('#delete');

    $('input[name="cfile"]').on('change',function(e) {
        if($(this).hasClass('actv')) {
            act.addClass('bdisabled')[0].disabled=true;
            del.addClass('bdisabled')[0].disabled=true;
        } else {
            act.removeClass('bdisabled')[0].disabled=false;
            del.removeClass('bdisabled')[0].disabled=false;
        }
    });

    function countdownRefresh(secs) {
        if(!$("#dialog-msg").length)
            $('body').append(
                '<div id="countdown" title="Server Restart" style="display: none;">'+
                    '<p>Refreshing page in <span id="countdown-display"></span> seconds.</p>'+
                '</div>');

    $("#countdown").dialog({
        modal: true,
        width: 400,
        height: 200,
        open: function(event, ui) {
            let timeLeft = secs; // Initial countdown time in seconds
            $("#countdown-display").text(timeLeft);

            const countdownInterval = setInterval(function() {
                timeLeft--;
                $("#countdown-display").text(timeLeft);

                if (timeLeft <= 0) {
                    clearInterval(countdownInterval);
                    $("#countdown-display").text("0");
                    setTimeout(function() {
                        $("#countdown").dialog("close");
                        location.reload(true);
                    }, 500);
                }
            }, 1000);
        }
    });

    }

    act.click(function(e){
        var cfile = $('input[name="cfile"]:checked').attr('id');
        var kfile = $('input[name="cfile"]:checked').attr('data-key');

        if(!cfile || !kfile) {
            dialogmsg("no certificate selected");
            return;
        }

        if(!$("#dialog-activate-confirm").length)
            $('body').append(
                '<div id="dialog-activate-confirm" title="Activate selected certificate?">'+
                    '<p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>The selected certificate will be made active and the server will restart. Proceed?</p>'+
                '</div>');

        $("#dialog-activate-confirm").dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Update and Restart": function() {
                    $.post(jsonpage, {action:"activate", cfile:cfile, kfile:kfile}, function(data) {
                        if(data && data.response && !data.response.error)
                            countdownRefresh(15);
                        else
                            dialogmsg(`<h3>Server Restart Error</h3><p>${data.response.msg}</p>`);
                    }).fail(function(){
                        dialogmsg(`<h3>Server Restart Error</h3><p>Error Communicating with server</p>`);
                    });
                    $(this).dialog("close");
                },
                Cancel: function() {
                    $(this).dialog("close");
                }
          }
        });
    });

    del.click(function(event){
        var cfile = $('input[name="cfile"]:checked').attr('id');
        var kfile = $('input[name="cfile"]:checked').attr('data-key');

        if(!cfile || !kfile) {
            dialogmsg("no certificate selected");
            return;
        }

        if(!$("#dialog-delete-confirm").length)
            $('body').append(
                '<div id="dialog-delete-confirm" title="Delete selected Users?">'+
                    '<p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>The selected certificate will be permanently deleted. Are you sure?</p>'+
                '</div>');

        $("#dialog-delete-confirm").dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Delete Selected Cert": function() {
                    $.post(jsonpage, {action:"del", cfile:cfile, kfile:kfile}, function(data) {
                        if(!data || data.error) {
                            dialogmsg("error deleting Certificate");
                            return;
                        }
                        $('input[name="cfile"]:checked').closest('tr').remove();
                        dialogmsg(`Certificate Deleted`);
                    });
                    $(this).dialog("close");
                },
                Cancel: function() {
                    $(this).dialog("close");
                }
          }
        });

    });

    upl.click(function(e){
        $('body').append(
            '<div id="dialog-upload" title="Load Certificate and Key">' +
                '<table class="tclear"><tr>'+
                    '<td>Certificate:</td><td><input accept=".pem" type="file" id="cfile" class="ufile" title="Choose Cert"/></td><td id="cfile-msg"></td>'+
                '</tr><tr>'+
                    '<td>Private Key:</td><td><input accept=".pem" type="file" id="kfile" class="ufile" title="Choose Key"/></td><td id="kfile-msg"></td>'+
                '</tr></table>'+
            '</div>');
        var cancelcb=function() {
            $(this).dialog("close");
            $("#dialog-upload").remove();
        }

        var files={};

        var uploadb=function(){
             $.post(jsonpage, {action:"upload", files:files}, function(data) {
                 if(!data || !data.response) {
                     alert("error uploading files to server");
                 } else if(data.response.error) {
                     alert(data.response.msg);
                 } else {
                     location.reload(true);
                 }
             });
        }

        $("#dialog-upload").dialog({
            resizable: false,
            height: 400,
            width: 600,
            modal: true,
            buttons: {Cancel: cancelcb }
        });

        var mods={};
        $('.ufile').on('change',function(e){

            var file=e.target.files[0];
            var type=$(this).attr('id');
            if(!file)
                return;
            var reader = new FileReader();
            reader.onload = function(e) {
                var cont=e.target.result;
                files[type]=cont;
                $.post(jsonpage, {action:"check", type:type, file:cont}, function(data) {
                    if(!data.response.error) {
                        mods[type]=data.response.modulus;
                        if( mods.cfile && mods.kfile)
                        {
                            if(mods.cfile == mods.kfile) {
                                $(".mismatch").remove();
                                $("#dialog-upload").dialog('option','buttons',{ Upload: uploadb, Cancel: cancelcb });
                            } else {
                                alert("Certificate and Private Key do not match (different modulus)");
                                data.response.msg += '<span class="mismatch"> (mismatch)</span>';
                            }
                        }
                    }
                    $(`#${type}-msg`).html(data.response.msg);
                });
            }
            reader.onerror = function(e) {
                alert(e.target.error);
            }
            reader.readAsText(file);
        });
    });
}



function do_main() {
    var hrow=$('#hrow');
    var utable=$('#userlist');


    function makerow(user,email, key) {
        var chbox = '<input type="checkbox" class="usersel">';
        //if(user=='admin') chbox='';
        return `<tr>
            <td class="chkbx">${chbox}</td>
            <td class="username usernamecl"><center class="usernamecl">${user}</center></td>
            <td><input class="useremail" value="${email}" data-origval="${email}" type=text size=20></td>
            <td><input class="userpass" placeholder="enter new pass to reset" type=text size=20></td>
            <td class="userkey">${key}</td>
        </tr>`;
    }

    $.getJSON(`${jsonpage}?action=get`, function(data){

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

    $('#userup').click(function(event){
        let fail=false, u=[], p=[], e=[], selected=$('.usersel:checked').closest('tr');

        if(!selected.length) {
            dialogmsg(`No user accounts selected`);
            return;
        }

        selected.each(function(i){
            let origE=$(this).find('.useremail').attr('data-origval');

            u[i]=$(this).find('.username').text();
            p[i]=$(this).find('.userpass').val();
            e[i]=$(this).find('.useremail').val();

            if(p[i]!="" && p[i].length<7) {
                dialogmsg(`Password for user "${u[i]}" is too short`);
                fail=true;
                return;
            }

            if(p[i]=="" && e[i] == origE) {
                dialogmsg(`Checked user "${u[i]}" has no changes to email or password.`);
                fail=true;
                return;
            }
        });

        if(fail)
            return;
        $.post(jsonpage, {action:"update", user:u, pass:p, email:e}, function(data) {
            let msg='', total=0;

            if(!data || !data.updates || data.error) {
                msg = (data.error? data.error : "Error updating user account(s)<br>");
            }

            if(data && data.updates && typeof data.updates == 'object') {
                selected.each(function(i){
                    let curuser=$(this).find('.username').text(), userdata;

                    if(!data.updates || !data.updates[curuser])
                        return; //continue

                    userdata=data.updates[curuser];

                    $(this).find('.userpass' ).val('');

                    if(userdata.email && userdata.email.length) {
                        $(this).find('.useremail').val( userdata.email );
                        $(this).find('.useremail').attr('data-origval', userdata.email );
                    }

                    if(userdata.key && userdata.key.length)
                        $(this).find('.userkey'  ).text( userdata.key );

                    total++;
                });
            }
            if(!data || ( !data.updates && !data.error))
                msg='Unknown Error while updating<br>';

            dialogmsg(`${msg}updated ${total} user account(s)`);
        });
    });

    $('#userdel').click(function(event){

        let fail=false, selected=$('.usersel:checked').closest('tr');

        if(!selected.length) {
            dialogmsg("no users selected");
            return;
        }

        selected.each(function(){
            if( $(this).find('.username').text()=='admin' ){
                dialogmsg("The 'admin' account cannot be deleted. Use update to change its email or password.");
                fail=true;
                return;
            }
        });
        if(fail) return;

        if(!$("#dialog-delete-confirm").length)
            $('body').append(
                '<div id="dialog-delete-confirm" title="Delete selected Users?">'+
                    '<p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>The selected users will be permanently deleted along with all data and cannot be recovered. Are you sure?</p>'+
                '</div>');

        $("#dialog-delete-confirm").dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Delete Selected Users": function() {
                    let u=[];
                    selected.each(function(i){
                        u[i]=$(this).find('.username').text();
                    });
                    $.post(jsonpage, {action:"del", user:u}, function(data) {
                        if(!data || !data.ndels || data.error) {
                            dialogmsg("error deleting user account(s)");
                            return;
                        }
                        selected.remove();
                        dialogmsg(`deleted ${data.ndels} user account(s)`);
                    });
                    $(this).dialog("close");
                },
                Cancel: function() {
                    $(this).dialog("close");
                }
          }
        });

    });

    $('#useradd').click(function(event){
        let u=$('#username').val(), p=$('#userpass').val(), e=$('#useremail').val();
        if(u.length < 5) {
            dialogmsg("user name too short");
            return;
        }

        if(p.length < 7) {
            dialogmsg("password too short");
            return;
        }

        $.post(jsonpage, {action:"add", user:u, pass:p, email: e}, function(data) {
            if(!data || !data.key || data.error) {
                dialogmsg(`error adding user: ${data.error}`);
                return;
            }
            utable.append(makerow(u,e,data.key));
            $('#username').val('');
            $('#userpass').val('');
            $('#useremail').val('');
        });
    });

}


$(document).ready(function(){
    var page = location.pathname.match(/[^\/]+$/)

    jsonpage=location.pathname.replace(/html$/,'json');

    if (page && page.length) {
        page=page[0];
        switch(page) {
            case 'admin.html':
                do_main();
                break;
            case 'certs.html':
                do_certs();
                break;
        }                
    }
});
