var user,gset,nMonths=3;

var EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

if(window.safari) {
    window.browser={storage:{local:{}}}
    window.browser.storage.local.set=function(ob) {
        for (k in ob) {
            var storev={},jstorv;
            storev.val=ob[k];
            jstorv=JSON.stringify(storev);
            localStorage.setItem(k,jstorv);
        }
    }
    window.browser.storage.local.get=function() {
        var ob={};
        for (var i = 0; i < localStorage.length; i++) {
            var k=localStorage.key(i);
            var v=JSON.parse(localStorage.getItem(k));
            ob[k]=v.val;
        }
        return {then:function(fn) {fn(ob);} };
    }
    window.browser.t="s";
}


function escapeHtml(text) {
    var div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

function dosave(all){
    var save={};
    save.lastq = $('#fq').val();
    if(lastcaldate) save.lastcaldate=lastcaldate;
    if(all) {
        save.lastr=$('#res').html();
        //console.log(save.lastr);
    }
    browser.storage.local.set(save);
}


var imtot=0, ictot=0, imcnt=0, iccnt=0;

function checkdone() {
    if(imcnt==imtot && iccnt==ictot) {
        dosave(true);
        console.log('saved');
    }
}

function loadImage(img) {
    var t=new Image();
    var url = img.attr('src');
    if(url) {
        t.onload=function() {
            img.attr('src',url).addClass('imset');
            imcnt++;
            checkdone();
        }
        t.onerror=function(){
            img.css('display','none').addClass('imset');
            imcnt++;
            checkdone();
        }
    } else {
        img.css('display','none').addClass('imset');
    }
    t.src=url;
    setTimeout(function(img,t){
        if(!img.hasClass('imset')) {
            img.css('display','none').addClass('imset');
            t.src="";
        }
    },6000,img,t);
}

function loadIco(img) {
    var t=new Image();
    var url = img.attr('src');
    if(url) {
        t.onload=function() {
            img.attr('src',url).addClass('imset');
            iccnt++;
            checkdone();
        }
        t.onerror=function(){
            img.attr('src',"images/home.ico");
            iccnt++;
            checkdone();
        }
    } else {
        img.attr('src',home.ico).addClass('imset');
    }
    t.src=url;
    setTimeout(function(img,t){
        if(!img.hasClass('imset')) {
            img.attr('src',"images/home.ico").addClass('imset');
            t.src="";
        }
    },3000,img,t);
}

// for history calendar
var lastcaldate;

function attachhov(){
    $('.hov').hover(function(){
        var t=$(this),h,top,bh=window.innerHeight+window.scrollY,bottom=25;
        var im= new Image();
        var isinline = t.hasClass('hov-inline');
        var clearance=250;
        if(isinline) {
            bottom=140;
            clearance=180;
        }
        t.closest('section').css('z-index','100000');
        $('.ishov2').remove();
        im.onload = function() {
            h=t.parent().find('.hov');
            top=h.offset().top - $(window).scrollTop();
            if (top<280) bottom=top-clearance;
            t.after('<img class="ishov2" style="bottom:'+bottom+'px;" src="'+t.attr('src')+'">');
        }
        $(im).addClass('hov');
        im.src=t.attr('src');
    },function(){
        $('.ishov2').remove();
        $(this).closest('section').css('z-index','');
    });
}

function postfail() {
    msg = `Could not connect to server at https://${gset.server}.
Make sure server is running by clicking "OK" below.
If the server is running but is using a self signed certificate,
and you trust the server, you will need to add an exception to the browser.

Open server page in a new window?`;
    if(window.confirm(msg)){
        window.open(`https://${gset.server}/`);
    }
}

function mktitles(){
    $('#sall').click(function(){
        var t=$(this);
        if(t.is(':checked'))
            $('.sitem').prop('checked',true);
        else
            $('.sitem').prop('checked',false);
    });

    $('#showico,#showopt').click(function(e){
        e.stopImmediatePropagation();
        var t=$('#showico');
        if (t.hasClass('isvis')) {
            $('.hm').hide(250);
            t.css('transform','rotate(270deg) translate(4px,0px)');
            t.removeClass('isvis');
            t.attr('title','click to show database editing options');
            $('#delsel').css('visibility','hidden');
        } else {
            $('.hm').show(250);
            t.css('transform','rotate(90deg)');
            t.addClass('isvis');
            t.attr('title','click to hide database editing options');
            $('#delsel').css('visibility','visible');
        }
    });

    function dodel(popup, req) {
        req.user= gset.user;
        req.key = gset.key;
        $.post({
            url: `https://${gset.server}/apps/shse/delete.json` ,
            data: req, 

            success: function(data){
                var msg,color,delay=1000;

                if (data.status=='ok') {
                    msg="Deleted "+data.deleted+" items";
                    color="yellow";
                } else {
                    msg=data.status;
                    color="red";
                    delay=2500;
                }

                popup.html('<table><tr><td><span style="white-space:nowrap;background-color:'+color+'">'+msg+'</span></td></tr></table>');

                setTimeout(function(){
                    popup.find('table').hide(250,function(){
                        popup.remove();
                        if (data.status=='ok') dosearch();
                    });
                },delay);
            },

            error: function(x,s,s2) {
                popup.html('<table><tr><td><span style="white-space:nowrap;background-color:red">Error:'+s+' ' +s2+'</span></td></tr></table>');
                setTimeout(function(){
                    popup.find('table').hide(250,function(){popup.remove();});
                },2500);
            }
        }).fail(postfail);
    }

    $('#rmselected').click(function(){
        var popup, req={hash:[]};

        $('body').append('<div class="popup"></div>');
        popup=$('.popup');

        $('.sitem:checked').each(function(i){
            req.hash.push( $(this).closest('.resi').attr('data-hash') );
        });

        if( req.hash.length==0) {
            popup.html('<table><tr><td><span style="white-space:nowrap;background-color:red">Nothing selected</span></td></tr></table>');

            setTimeout(function(){
                popup.find('table').hide(250,function(){
                    popup.remove();
                    if (data.status=='ok') dosearch();
                });
            },500);
        }
        else
            dodel(popup, req);
    });
    
    $('.rico').click(function(){
        var t=$(this),r=t.closest('.resi'),h=r.attr('data-hash'),d=r.attr('data-dom'), req={};
        var popup;
        if(d=="null") d=null;
        $('body').append('<div class="popup"><table><tr><td colspan=2><b>Delete Entry?</b><br><span style="font-size:10px;color:#07c">'+r.find('a').attr('href')+'</td></tr>'+
            '<tr><td>Only this entry:</td><td><button class="rmb rme">Delete</button></td></tr>'+
            (d?
                '<tr><td>All from '+d+':</td><td><button class="rmb rmd">Delete</button></td>/tr>'+
                '<tr><td>All from '+d+' and blacklist<br>(do not index) future visits to '+d+':</td><td><button class="rmb rmd rmbl">Delete</button></td></tr>'
             :""
             )+
            '<tr><td colspan=2"><button style="float:right" class="rmb" id="cancel">Cancel</button></td></tr>'+
        '</table></div>');
        popup=$('.popup');
        $('.rmb').click(function(){ 
            var b=$(this);
            if (b.is('#cancel')) {
                popup.remove();
                return;
            }
            if (b.is('.rme')) 
                req.hash=[h];
            else if (b.is('.rmd'))
                req.dom=d;
            
            dodel(popup,req);
            
            if (b.is('.rmbl')) {
                gset.exclude[d]=2;
                console.log(gset);
                browser.storage.local.set({exclude:gset.exclude});    
            }
            
        
        });
    });
}

function fmtdate(date) {
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Add 1 as months are 0-indexed
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

function dosearch(skip,q) {
    var res=$('#res');
    var ricos='<span title="Remove" class="rm rico hm">&#x2718;</span><span title="Remove" class="rm rmcb hm"><input type="checkbox" class="sitem" title="select item"></span>';

    $('#histbox').remove();
    $('#res').show();
    $('#setbox').remove();

    if (!q) q=$('#fq').val();
    else $('#fq').val(q);
    res.empty();
    if (!skip) skip=0;
    else skip=parseInt(skip);
    if (q != '')
     $.post( `https://${gset.server}/apps/shse/results.json` ,
       {q:q, sk:skip, user:gset.user, key: gset.key},
       function(data){
        if (!data.rowCount)
            res.append('no results for '+ $('#fq').val() );
        else {
          var l=data.rowCount;
          var rescnt = "" + (skip+1) + '-' + (skip+l) + ' of ' + data.countInfo.indexCount;
          res.append('<div title="click to show database editing options" id="showrm"><label class="hide ib sall"><input style="vertical-align:middle" type="checkbox" id="sall" class="hide ib" title="Select All">Select All</label>'+
          '<span id="showopt" style="position:relative;">'+
              '<span style="cursor: pointer;position: bsolute;left:-30px;top:-11px;">Options</span>' +
              '<span id="showico" style="display:inline-block;cursor:pointer;transform:rotate(270deg) translate(4px,0px);font-size:28px;position:absolute;left:-30px;top:-10px;width:13px;" title="click to hide database editing options">&#8227;</span>'+
          '</span>'+
//          '<span id="showico" style="display:inline-block;cursor:pointer;transform:rotate(270deg);font-size:28px; position: absolute;left:-30px;top:-10px;width:13px;">&#8227;</span>'+
          '<span style="display:inline-block;height:22px;padding: 2px 0px 0px 5px;">&nbsp;<span id="delsel" class="hide"><button style="padding: 2px 5px 0px 5px;border:1px solid #b00; border-radius:7px;;position:relative;top:0px;left:13px;" id="rmselected">Remove Select Items</button></span></span>'+
          '<span style="float:right">Results '+rescnt+'</span></div>');

          for (var i=0;i<l;i++) {
              var r=data.rows[i];
              var ico= r.image ? r.image : ''+r.url.match(/^https?:\/\/[^/]+/)+'/favicon.ico' ;
              var icl = r.image? " hov" : '';
              var d= new Date(0);
              d.setUTCSeconds(parseInt(r.last));
              var favico=r.url.match(/^https?:\/\/[^/]+/)+'/favicon.ico';        
              res.append(`
<section class="entry resi" data-hash="${r.hash}" data-dom="${r.dom}" id="r${i}">
  ${ricos}
  <div class="info">
    <div class="link">
      <a target="_blank" href="${r.url}">${escapeHtml(r.title.replace(/\s+/g,' '))}</a>
    </div>
    <div class="subtext">
      <img src="${favico}" class="resico" />
      <span class="url-text">&gt; ${r.url}<br>
      </span>
    </div>
    <div class="description">
        ${r.image ? '<img src="' + r.image + '" class="hov hov-inline">':''}
        ${r.abstract}
    </div>
  </div>
  <div class="thumb">
      <span class="tstamp">(${fmtdate(d)})</span><br>`
      + ( r.image ? `<img src=${r.image} class="hov">` : '' ) +
  `</div>
</section>`);
          }

          imcnt=0;
          iccnt=0;
          
          imtot=$('.hov').each(function(){
              loadImage($(this));
          }).length;
          var cnt=0;
          ictot=$('.resico').each(function(){
              loadIco($(this));
          }).length;

          if (skip > 9) 
              res.append('<span class="abstract" style="color:blue; float:left;margin:10px;"><a data-q="'+q+'" data-skip="'+(skip-10)+'" class="np" id="prev">Previous</a></span>');

          if(data.countInfo.indexCount>skip+10)
              res.append('<span style="color:blue; float:right;margin:10px;" class="abstract"><a data-q="'+q+'" data-skip="'+(skip+10)+'" class="np" id="next">Next</a></span>');

        }
        mktitles();
        attachhov();
        dosave(true);
       }
     ).fail(postfail);
}

// for hist.js cookie, use local storage in popup instead.
function getCookie(name){
    return gset[name];
}

function setCookie(name,val){
    gset[name]=val;
    var save={};
    save[name]=val;
    browser.storage.local.set(save);
}

$(document).ready(function(){
    var enable=$('#enable'),enableafter=false;
    var mobile = /mobile/i.test(navigator.userAgent);
    if(/chrome\//i.test(navigator.userAgent)) {
            $('body').css('width','600px');
            window.browser.t='c';
        } else if(/firefox\//i.test(navigator.userAgent)  && ! mobile ) {
                $('body').css('width','764px');
                window.browser.t='f';
        }

    $('body').on('click', function(e){
        var t=$(e.target);
        if (t.hasClass('np')) {
            var skip=t.attr('data-skip');
            var q=t.attr('data-q');
            dosearch(skip,q);
            $('html,body').scrollTop(0);
        }
        else if (t.hasClass('autocomplete-selected')) dosearch();
        if (window.safari && t.is('a.tar')) {
                safari.application.activeBrowserWindow.openTab().url = t.attr('href');
                safari.self.hide();
        }
    })

    browser.storage.local.get().then (function(settings){
        gset=settings;
        user=settings.user;
        var fq=$('#fq');
        

        fq.devbridgeAutocomplete({
            serviceUrl: `https://${gset.server}/apps/shse/autocomp.json`,
            //serviceUrl: 'https://squush.com/showme.html?ac=1&u='+encodeURIComponent(user),
            params: {user:gset.user, key:gset.key},
            dataType: 'json',
            minChars: 3,
            noCache: false
        });  

        if (settings.disabled || !user) {
            enable.removeClass('onsw-on');
            enable.html("Off");
        }
        
        $('body').on('keyup','#fq',function(e){
            setTimeout (dosave,50);
            if (e.which == 13) {
                if (user) dosearch();
                else alert("click on setting icon and enter email first");
            }
        });
        if (window.safari) { 
            fq.blur();
            safari.application.addEventListener("popover", function(){
                setTimeout(function(){
                    $('.autocomplete-suggestions').hide();
                },250);
            },true);
        }

        $('#search').click(function(){
            if (user) dosearch();
            else alert("click on setting icon and enter email first");
        });

        $('#fq').val(settings.lastq);
        $('#res').html(settings.lastr);
        mktitles();
        attachhov();
    });

    enable.click(function(){
        var dis;
        if (!user) {
            $('#settings').click();
            enableafter=true;
            return;
        }
        if (enable.hasClass('onsw-on')) {
            enable.removeClass('onsw-on');
            dis=true;
            enable.html("Off");
            if(browser.browserAction && browser.browserAction.setIcon)
                    browser.browserAction.setIcon({path:{19:'images/ricon19.png',20:'images/ricon20.png',38:'images/ricon19.png'}});
        } else {
            enable.addClass('onsw-on');
            dis=false;
            enable.html("On");
            if(browser.browserAction && browser.browserAction.setIcon)
                    browser.browserAction.setIcon({path:{19:'images/icon19.png',20:'images/icon20.png',38:'images/icon19.png'}});
        }    
        browser.storage.local.set({disabled:dis});
    });

    $('#settings').click(function(){
       if ($('#setbox').length) {
           $('#setbox').remove();
           $('#res').show();
       } else
        browser.storage.local.get().then (function(settings){
            var lb,key,keyrow,pass,passrow,em,ex,serv,servval,mwidth="width",mextra='';
            gset=settings;
            //if (mobile){
            //    mwidth='width';
            //    mextra='</tr><tr style="white-space:nowrap">'
            //}
            $('#res').hide();
            $('#histbox').remove();
            $('body').append(
            `<div id="setbox" class="shbox">
                <table style="margin:auto">
                    <tr>
                        <td><b>User Name:</b></td>
                        <td><input type="text" id="em" placeholder="Name" style="box-sizing:border-box;${mwidth}:230px;height:30px;font:normal 18px arial,sans-serif;padding: 1px 3px;border: 2px solid #ccc;"></td>
                    </tr>
                    <tr>
                        <td><b>Server Address:</b></td>
                        <td>
                            <span style="font:normal 18px arial,sans-serif;display: inline-block;position: absolute;top: 5px;left: 4px;">https://</span>
                            <input type="text" id="serverAddr" placeholder="myserv.example.com" style="box-sizing:border-box;${mwidth}:230px;height:30px;font:normal 18px arial,sans-serif;padding: 1px 0px 3px 57px;border: 2px solid #ccc;">
                        </td>
                    </tr>
                    <tr id="keyrow">
                        <td><b>Server Key</b>:</td>
                        <td id="keycell">
                            <input type="text" id="key" placeholder="server key" style="box-sizing:border-box;${mwidth}:150px;height:30px;font:normal 18px arial,sans-serif;padding: 1px 3px;border: 2px solid #ccc;">
                            <button id="usepass" style="float:right;margin-right:5px;background-color:white;padding:3px">Load from server</button>
                        </td>
                    <tr>
                    <tr id="passrow" style="display:none">
                        <td><b>Password</b>:</td>
                        <td id="passcell">
                            <input type="password" id="pass" placeholder="password" style="box-sizing:border-box;${mwidth}:150px;height:30px;font:normal 18px arial,sans-serif;padding: 1px 3px;border: 2px solid #ccc;">
                            <button id="retrieve" style="float:right;margin-right:5px;background-color:white;padding:3px">Retrieve Key</button>
                        </td>
                    <tr>
                    <tr style="display:none">
                        <td><b>Label for this computer</b><br>(optional):</td>
                        <td><input type="text" id="lb" placeholder="label" style="box-sizing:border-box;${mwidth}:150px;height:30px;font:normal 18px arial,sans-serif;padding: 1px 3px;border: 2px solid #ccc;"></td>
                    <tr>
                        <td><b>Blacklist Domains:</b></td>
                        <td>
                            <table style="border: 1px dotted gray;" id="exc">
                                <tr>
                                    <td><button id="exadd">Add</button></td>
                                    <td></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td><b>Extras:</b></td>
                        <td>
                            <table style="border: 1px dotted gray; width:100%" id="exc">
                                <tr><td colspan=2>
                                    <i>These features are experimental and may break<br>when the following sites change their functionality.<i>
                                </td></tr>
                                <tr>
                                    <td><label for="smedia">Index individual facebook and bsky posts</label></td>
                                    <td><input style="float:right" id="smedia" type="checkbox"${gset.smedia?' checked':''}></td>
                                </tr>
                                <tr>
                                    <td><label for="ytube">Index youtube captions/subtext</label></td>
                                    <td><input style="float:right" id="ytube" type="checkbox"${gset.ytube?' checked':''}></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td><button id="save">Save</button></td>
                        <td><button style="float:right" id="cancel">Cancel</button></td>
                    </tr>
                </table>
            </div>`);
            key=$('#key');
            keyrow=$('#keyrow');
            pass=$('#pass');
            passrow=$('#passrow');
            lb=$('#lb');
            em=$('#em');
            serv=$('#serverAddr');
            ex=$('#exc');
            if (settings.user) em.val(settings.user);
            //if (settings.label) lb.val(settings.label);
            if (settings.server) {
                serv.val(settings.server);
                servval=settings.server.replace(/\/.*/,'');
            }

            if (settings.key) key.val(settings.key)
            else {
                keyrow.hide();
                passrow.show();
            }

            if (!settings.exclude) {
                settings.exclude= {
                    '--usbanks': 2,
                    '--portals':2,
                };
                browser.storage.local.set({exclude:settings.exclude});
            }

            em.focusout(function(){
                settings.user=em.val();
            });

            function addrow(e,k,c) {
                ex.find('tr:last').before(
                    '<tr><td><span class="remex" style="color:red;cursor:pointer;font:normal 22px arial,sans-serif;margin:4px">&#x2718;</span><input type="text" value="'+(k?k:'')+'" class="exentry" style="box-sizing:border-box;' + mwidth + ':150px;height:30px;font:normal 18px arial,sans-serif;padding: 1px 3px;border: 2px solid #ccc;"></td>'+
                    mextra + '<td><label>Include Subdomains<input class="subd" type="checkbox"'+(c==2?' checked':'')+'></label>'+
                    '</td></tr>'
                );
            }

            serv.focusout(function(){
                settings.server=servval=serv.val().replace(/\/.*/,'');
console.log(servval);
                if(!settings.noAddShseServer){ //do this only once
                    addrow(null, settings.server, 1);
                    settings.noAddShseServer=true;
                }
                    
            });


            $("#usepass").click(function(e){
                keyrow.hide();
                passrow.show();
            });

            $("#retrieve").click(function(e){
                if(!servval)
                    alert("No Server Specified");
                else {
                    let u=em.val(), p=pass.val();
                    $.post('https://' + servval + '/apps/shse/cred.json',
                        {user: u, pass: p},
                        function(data) {
                            passrow.hide();
                            keyrow.show();
                            if(data.key)
                                $('#key').val(data.key);
                            else
                                alert("error retrieving key");
                        }
                    ).fail(postfail);
                }
            });

            

            for (var k in settings.exclude) {
                addrow(null,k,settings.exclude[k]);
            }

            ex.on('click','.remex',function(){
                $(this).closest('tr').remove();
            });
            
            $('#exadd').click(addrow);
            
            $('#cancel').click(function(){
                $('#setbox').remove();
                $('#res').show();
            });
            
            $('#save').click(function(){
                var u=em.val();
                    //label=lb.val(), 
                //if (/^\s+$/.test(label) || !label ) label='';
                
                //if( EMAIL_REGEX.test(u) ) {
                    //verify user here!!!
                    settings.user=u;
                    settings.smedia=$('#smedia').is(':checked');
                    settings.ytube=$('#ytube').is(':checked');
                    //settings.label=label;
                    settings.server=servval;
                    settings.key=key.val();
                    var saveex={};
                    $('.exentry').each(function(){
                        var t=$(this),v=t.closest('tr').find('.subd');
                        if(t.val().length)
                            saveex[t.val()]=(v.is(':checked')?2:1);
                    });
                    settings.exclude=saveex;
                    //console.log(settings);
                    browser.storage.local.set(settings);
                    user=u;
                    if(enableafter)enable.click();
                    enableafter=false;
                //} else {
                //    alert("without an email, this extension will not function");
                //}
                $('#setbox').remove();
                $('#res').show();

            });
        });
    });

    // History
    var nMonths=3,doclick=false,lastheat;
    function updatecal(dateText) {
        if(!doclick) return;
        lastcaldate=dateText;
        dosave();
        var c=dateText.match(/(\d+)\/(\d+)\/(\d+)/);
        //send computer localtime for chosen day in ms since epoch
        var s = new Date(`${c[3]}-${c[1]}-${c[2]}T00:00:00`);
        var e = new Date(`${c[3]}-${c[1]}-${c[2]}T23:59:59.999`);
        console.log(s,e);
        var resbox=$('#hres');
        $.post({
            url:`https://${gset.server}/apps/shse/hist.json`,
            data:{
                date:dateText, 
                start:s.getTime(), 
                end:e.getTime(),
                user:gset.user,
                key: gset.key
            },
            success: function(data){
                resbox.empty();
                var res=data.res.rows;
                var d=new Date(data.start);
                var datestr = s.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                resbox.append('<p><b>'+datestr+':</b></p>');
                for(var i=0;i<res.length;i++){
                    var r=res[i];
                    var t =r.Title ? r.Title.replace(/\s+/,' ') : r.Url;
                    var edate=new Date(r.Date);
                    resbox.append(
`<div data-hash="${r.Hash}" class="resi">
    <span class="itemwrap">
        <a class="url-a tar" href="${r.Url}" '" target="_blank">${t}</a>
        <span class="timestamp">${edate.toLocaleTimeString()}</span>
        <br>
        <span class="abstract url-span">${r.Url}</span>
    </span>
</div>`);
                }
            }
        }).fail(function(xhr, txt, err) {
            alert("failed to get data from server: "+txt);
        });
        if(lastheat) setTimeout(function(){insertheat(lastheat);},50);            
    };

    function insertheat(data) {
        var max=parseInt(data.max),i=0;
        var rows=data.rows;
        $('td[data-handler=selectDay]').each(function(){
            var t=$(this).find('a');
            var v = parseInt(rows[i])/max ;
            v *= 100.0;
            t.css('background',`rgb(101 124 194 / ${v}%)`);
            i++;
        });

    }
    function doheat(m,y){
        setTimeout(function(){
            // in monthchange, jquery ui returns wrong month when showing
            // multiple months and clicking on arrows where 
            // there is no movement.  Date doesn't change until after event,
            // hence the timeout
            var firstmonth=parseInt($('.ui-datepicker-month').val())+1;
            var firstyear =parseInt($('.ui-datepicker-year').val());
            $.post({
                url:`https://${gset.server}/apps/shse/hist.json`,
                data:{
                    startm:firstmonth,
                    starty:firstyear,
                    nMonths:nMonths,
                    user: gset.user,
                    key: gset.key
                },
                success: function(data){
                    insertheat(data);
                    lastheat=data;
                }
            }).fail(function(xhr, txt, err) {
                alert("failed to get data from server: "+txt);
            });
        },2);
    }
 
    function monthchange(year,month) {
        // year, month ignored.  See above.
        doheat();
    }

    $('#history').click(function(){
        if ($('#histbox').length) {
            $('#histbox').remove();
            $('#res').show();
        } else {
            $('#res').hide();
            $('#setbox').remove();

            $('body').append(
             `<div id="histbox" class="shbox">
                <div id="datepicker"></div>
                <div class="sopts">
                    <span class="grpby">
                        <span class="by" id="bysitel" for="bysite">By Site</span>
                        <span class="by" id="bydatel" for="bydate">By Date</span>
                    </span>
                    <span class="swrap2">
                      <input type="text" spellcheck="false" autocomplete="off" id="dq" name="dq" placeholder="Domain Search">
                      <input id="dsearch" type="submit" value="Search">
                    </span>
                </div>
                <div id="hres"></div>
              </div>`);

            dohist($('#datepicker'), 'https://'+gset.server,gset.user,gset.key);
        }
    });

});

