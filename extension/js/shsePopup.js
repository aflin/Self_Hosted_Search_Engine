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

// for history calendar
var lastcaldate;

/* =====================================================================
   SEARCH RESULTS

   Markup and styling (css/results.css):

     div.sr                          one per result page; .is-editing when "Options" is open
       header.sr-head                [select all] [Options] [Remove selected] ... [Results 1-10 of N]
       ol.sr-list
         li.sr-item                  one result
           div.sr-ctl                the remove mark and the select box
           article.sr-body           title, url, snippet
           aside.sr-side             date and thumbnail
       div.sr-pager                  Previous, page numbers, Next

   .sr-head and .sr-item are the SAME three column grid, so the select-all
   box is above the per-result boxes because it is in the same column, not
   because anything was positioned by hand.  The first column is 0 wide
   until Options is opened.

   What is kept between openings of the popup is the result DATA, not the
   html: the page is drawn again from it, so a new layout is never fighting
   html saved by an old one.
   ===================================================================== */

var RESULTS_LAYOUT = 2;   // bump if the shape of the saved data changes
var sr_last = null;       // {q, skip, data} of what is on screen

function dosave(all){
    var save={};
    save.lastq = $('#fq').val();
    if(lastcaldate) save.lastcaldate=lastcaldate;
    if(all && sr_last)
        save.lastres={layout:RESULTS_LAYOUT, q:sr_last.q, skip:sr_last.skip, data:sr_last.data};
    browser.storage.local.set(save);
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

function fmtdate(date) {
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Add 1 as months are 0-indexed
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

/* only ordinary web and file urls become links */
function sr_safeurl(u) {
    return /^(https?|file|ftp):/i.test(u||'') ? u : '#';
}

function sr_favicon(u) {
    var m=/^https?:\/\/[^\/]+/i.exec(u||'');
    return m ? m[0]+'/favicon.ico' : 'images/home.ico';
}

/* ---------- messages and dialogs ---------- */

function sr_overlay(node) {
    $('.sr-overlay').remove();
    var o=$('<div class="sr-overlay"></div>').append(node);
    $('body').append(o);
    return o;
}

function sr_toast(msg, kind, ms, then) {
    var o=sr_overlay($('<div class="sr-toast" role="status"></div>').addClass('sr-toast-'+kind).text(msg));
    setTimeout(function(){
        o.fadeOut(250, function(){ o.remove(); if(then) then(); });
    }, ms);
}

/* ---------- deleting ---------- */

function sr_delete(req) {
    req.user=gset.user;
    req.key =gset.key;
    $.post({
        url: `https://${gset.server}/apps/shse/delete.json`,
        data: req,
        success: function(data){
            if (data.status=='ok')
                // show the page they were on again, now without what was removed
                sr_toast("Deleted "+data.deleted+" items", 'ok', 1000, function(){
                    if(sr_last) dosearch(sr_last.skip, sr_last.q);
                });
            else
                sr_toast(data.status, 'err', 2500);
        },
        error: function(x,s,s2) {
            sr_toast('Error: '+s+' '+s2, 'err', 2500);
        }
    }).fail(postfail);
}

/* the "Delete Entry?" dialog for one result */
function sr_askdelete(item) {
    var hash=item.attr('data-hash'), dom=item.attr('data-dom'), url=item.find('.sr-title a').attr('href');
    if(!dom || dom=="null") dom=null;

    var dlg=$('<div class="sr-dialog" role="dialog" aria-modal="true" aria-labelledby="sr-dialog-title"></div>');
    dlg.append($('<h2 id="sr-dialog-title">Delete Entry?</h2>'));
    dlg.append($('<p class="sr-dialog-url"></p>').text(url));

    var rows=$('<dl class="sr-dialog-choices"></dl>');
    function choice(label, cls) {
        rows.append($('<dt></dt>').text(label));
        rows.append($('<dd></dd>').append($('<button type="button">Delete</button>').addClass(cls)));
    }
    choice('Only this entry:', 'sr-do-entry');
    if(dom) {
        choice('All from '+dom+':', 'sr-do-dom');
        choice('All from '+dom+' and blacklist (do not index) future visits to '+dom+':', 'sr-do-dom sr-do-blacklist');
    }
    dlg.append(rows);
    dlg.append($('<p class="sr-dialog-foot"><button type="button" class="sr-do-cancel">Cancel</button></p>'));

    var o=sr_overlay(dlg);
    o.on('click', 'button', function(){
        var b=$(this), req={};
        if(b.hasClass('sr-do-cancel')) { o.remove(); return; }
        if(b.hasClass('sr-do-entry')) req.hash=[hash];
        else req.dom=dom;
        if(b.hasClass('sr-do-blacklist')) {
            if(!gset.exclude) gset.exclude={};
            gset.exclude[dom]=2;
            browser.storage.local.set({exclude:gset.exclude});
        }
        o.remove();
        sr_delete(req);
    });
    dlg.find('.sr-do-cancel').focus();
}

/* ---------- drawing ---------- */

function sr_item(r) {
    var d=new Date(0);
    d.setUTCSeconds(parseInt(r.last));

    var li=$('<li class="sr-item"></li>').attr('data-hash', r.hash).attr('data-dom', r.dom);

    li.append(
        $('<div class="sr-ctl"></div>')
            .append('<button type="button" class="sr-del" title="Remove" aria-label="Remove this result">&#x2718;</button>')
            .append('<input type="checkbox" class="sitem" title="Select" aria-label="Select this result">')
    );

    var title=String(r.title||'').replace(/\s+/g,' ').trim() || r.url;
    var body=$('<article class="sr-body"></article>');
    body.append($('<h3 class="sr-title"></h3>').append(
        $('<a target="_blank" rel="noopener"></a>').attr('href', sr_safeurl(r.url)).attr('title', title).text(title)
    ));
    body.append($('<div class="sr-url"></div>')
        .append($('<img class="sr-fav" alt="" width="15" height="15">').attr('src', sr_favicon(r.url)))
        .append($('<span></span>').text('> '+r.url))
    );
    // the snippet is html made by the server: escaped text with <b> around the matched words
    body.append($('<p class="sr-snippet"></p>').html(r.abstract||''));
    li.append(body);

    var side=$('<aside class="sr-side"></aside>');
    side.append($('<time class="sr-date"></time>').attr('datetime', d.toISOString()).text('('+fmtdate(d)+')'));
    if(r.image)
        side.append($('<img class="sr-thumb" alt="">').attr('src', r.image));
    li.append(side);

    return li;
}

var SR_PER_PAGE = 10;    // results per page, as the server returns them
var SR_PAGE_WINDOW = 11; // page links shown around the current page

/* The numbers to show in the pager, 0 standing for a gap ("...").
   Always the first and last page, and SR_PAGE_WINDOW pages centred on the
   current one -- slid along, not cut short, when the current page is near
   either end.  e.g. page 20 of 416:  1 0 15 16 17 18 19 20 21 22 23 24 25 0 416 */
function sr_pagelist(cur, pages) {
    var out=[], i, half=Math.floor(SR_PAGE_WINDOW/2);
    if(pages <= SR_PAGE_WINDOW + 2) {
        for(i=1;i<=pages;i++) out.push(i);
        return out;
    }
    var start=cur-half, end=cur+half;
    if(start < 2)        { start=2;        end=start+SR_PAGE_WINDOW-1; }
    if(end > pages-1)    { end=pages-1;    start=end-SR_PAGE_WINDOW+1; }
    // a gap that would hide a single page shows that page instead
    if(start == 3) start=2;
    if(end == pages-2) end=pages-1;
    out.push(1);
    if(start > 2) out.push(0);
    for(i=start;i<=end;i++) out.push(i);
    if(end < pages-1) out.push(0);
    out.push(pages);
    return out;
}

/* Previous, the page numbers, Next.  Previous and Next are always there,
   greyed out when there is nowhere to go. */
function sr_pager(q, skip, total) {
    var cur=Math.floor(skip/SR_PER_PAGE)+1, pages=Math.max(1, Math.ceil(total/SR_PER_PAGE));
    var nav=$('<div class="sr-pager" role="navigation" aria-label="Result pages"></div>');

    // a button that goes to a page; the click is handled by the "np" handler on <body>
    function go(label, page, cls) {
        var b=$('<button type="button"></button>').addClass(cls).text(label);
        if(page < 1 || page > pages)
            b.prop('disabled', true);
        else
            b.addClass('np').attr('data-q', q).attr('data-skip', (page-1)*SR_PER_PAGE);
        return b;
    }

    nav.append(go('Previous', cur-1, 'sr-prev').attr('id','prev'));

    var nums=$('<span class="sr-pages"></span>');
    sr_pagelist(cur, pages).forEach(function(n){
        if(n==0)
            nums.append('<span class="sr-gap" aria-hidden="true">&hellip;</span>');
        else if(n==cur)
            nums.append($('<span class="sr-page sr-current" aria-current="page"></span>').text(n));
        else {
            var b=go(n, n, 'sr-page').attr('aria-label', 'Page '+n);
            // on a narrow screen only the nearest pages (and first and last) are kept
            if(Math.abs(n-cur) > 2 && n!=1 && n!=pages) b.addClass('sr-far');
            nums.append(b);
        }
    });
    nav.append(nums);

    nav.append(go('Next', cur+1, 'sr-next').attr('id','next'));
    return nav;
}

function sr_render(q, skip, data) {
    var res=$('#res');
    res.empty();
    $('.sr-preview').remove();
    sr_last=null;

    if(!data || !data.rowCount) {
        res.append($('<p class="sr-empty"></p>').text('no results for '+q));
        return;
    }
    sr_last={q:q, skip:skip, data:data};

    var n=data.rowCount, total=data.countInfo ? data.countInfo.indexCount : n;
    var sr=$('<div class="sr"></div>');

    sr.append(
        '<header class="sr-head">'+
          '<div class="sr-ctl"><input type="checkbox" id="sall" title="Select all" aria-label="Select all results"></div>'+
          '<div class="sr-headmain">'+
            '<button type="button" class="sr-toggle" id="showopt" aria-expanded="false" title="click to show database editing options">'+
              '<span class="sr-caret" aria-hidden="true"></span>Options'+
            '</button>'+
            '<button type="button" class="sr-remove" id="rmselected">Remove Selected Items</button>'+
            '<span class="sr-count"></span>'+
          '</div>'+
        '</header>'
    );
    sr.find('.sr-count').text('Results '+(skip+1)+'-'+(skip+n)+' of '+total);

    var list=$('<ol class="sr-list"></ol>');
    for (var i=0;i<data.rows.length;i++)
        list.append(sr_item(data.rows[i]));
    sr.append(list);

    sr.append(sr_pager(q, skip, total));

    res.append(sr);

    // a site with no favicon gets the house; a thumbnail that will not load is dropped
    sr.find('.sr-fav').on('error', function(){
        if(this.getAttribute('src')!='images/home.ico') this.setAttribute('src','images/home.ico');
    });
    sr.find('.sr-thumb').on('error', function(){ $(this).remove(); });
}

/* open or close the editing column */
function sr_setediting(on) {
    $('#res .sr').toggleClass('is-editing', on);
    $('#showopt').attr('aria-expanded', on ? 'true' : 'false')
                 .attr('title', on ? 'click to hide database editing options' : 'click to show database editing options');
    // nothing stays ticked out of sight
    if(!on) $('#sall, #res .sitem').prop('checked', false);
}

/* Handlers for everything in the results.  Bound once, on #res, so they
   keep working however many times the results are redrawn. */
function sr_bind() {
    var res=$('#res');

    res.on('click', '#showopt', function(){
        sr_setediting(!$('#res .sr').hasClass('is-editing'));
    });

    res.on('change', '#sall', function(){
        $('#res .sitem').prop('checked', this.checked);
    });

    // keep the select-all box truthful when boxes are ticked one at a time
    res.on('change', '.sitem', function(){
        var all=$('#res .sitem');
        $('#sall').prop('checked', all.length>0 && all.filter(':checked').length==all.length);
    });

    res.on('click', '#rmselected', function(){
        var req={hash:[]};
        $('#res .sitem:checked').each(function(){
            req.hash.push($(this).closest('.sr-item').attr('data-hash'));
        });
        if(!req.hash.length)
            sr_toast('Nothing selected', 'err', 800);
        else
            sr_delete(req);
    });

    res.on('click', '.sr-del', function(){
        sr_askdelete($(this).closest('.sr-item'));
    });

    // a larger view of the thumbnail while the pointer is on it
    res.on('mouseenter', '.sr-thumb', function(){
        var r=this.getBoundingClientRect();
        var p=$('<img class="sr-preview" alt="">').attr('src', this.getAttribute('src'));
        $('.sr-preview').remove();
        $('body').append(p);
        p.on('load', function(){
            var h=this.offsetHeight, top=r.top + r.height/2 - h/2;
            top=Math.max(8, Math.min(top, window.innerHeight - h - 8));
            p.css({top: top+'px', right: (window.innerWidth - r.left + 10)+'px', visibility:'visible'});
        });
    });
    res.on('mouseleave', '.sr-thumb', function(){
        $('.sr-preview').remove();
    });
}

function dosearch(skip,q) {
    $('#histbox').remove();
    $('#res').show();
    $('#setbox').remove();

    if (!q) q=$('#fq').val();
    else $('#fq').val(q);
    if (!skip) skip=0;
    else skip=parseInt(skip);

    if (q == '') {
        $('#res').empty();
        return;
    }

    $.post( `https://${gset.server}/apps/shse/results.json`,
        {q:q, sk:skip, user:gset.user, key:gset.key},
        function(data){
            sr_render(q, skip, data);
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
        sr_bind();
        // draw the last results again from their saved data
        var lr=settings.lastres;
        if(lr && lr.layout==RESULTS_LAYOUT && lr.data)
            sr_render(lr.q, lr.skip, lr.data);
        // older versions saved the results as html; that is no longer used
        if(settings.lastr!==undefined && browser.storage.local.remove)
            browser.storage.local.remove('lastr');
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

