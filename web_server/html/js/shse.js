function escapeHtml(text) {
    var div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

function loadImage(img) {
    var t=new Image();
    var url = img.attr('data-favico');
    if(url) {
        t.onload=function() {
            img.attr('src',url);
        }
    } else {
        url=img.attr('src');
        t.onerror=function(){
            img.attr('src','/images/home_website_start_house.svg');
            img.removeClass('hov');
        }
    }
    console.log("checking: ", url);
    t.src=url;
}

function attachhov(){
    $('.hov').hover(function(){
        var t=$(this),h,ho,bh=window.innerHeight+window.scrollY,top=0;
        var im= new Image();
        im.onload = function() {
            var ht = (im.height<250)?im.height:250;
            ho=t.offset();
            h=t.parent().find('.hov');
            ho=h.offset();
            ho.bottom=ho.top+ht;
            if (ho.top<20) top = -ho.top + 20;
            if (ho.bottom > bh) top = bh-ho.bottom;
            t.after('<img class="ishov" style="top:'+top+'px;" src="'+t.attr('src')+'">');
        }
        $(im).addClass('hov');
        im.src=t.attr('src');
    },function(){
        $('.ishov').remove();
    });
}

function postfail() {
    msg = `Could not connect to server at https://${gset.server}.
Make sure server is running by refreshing this page or clicking "OK" below.
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
        } else {
            $('.hm').show(250);
            t.css('transform','rotate(90deg)');
            t.addClass('isvis');
            t.attr('title','click to hide database editing options');
        }
    });

    function dodel(popup, req) {
        $.post({
            url: `https://${gset.server}/apps/search/delete.json` ,

            success: function(data){
                var msg,color,delay=1000;

                if (data.status=='ok') {
                    msg="Success: deleted "+data.deleted+" items";
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
                        // replace this with a page refresh or something
                        // if (data.status=='ok') dosearch();
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
            req.hash.push( t.closest('.resi').attr('data-hash') );
        });

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
/*
function dosearch(skip,q) {
    var res=$('#res');
    var ricos='<span title="Remove" class="rm rico hm">&#x2718;</span><span title="Remove" class="rm rmcb hm"><input type="checkbox" class="sitem" title="select item"></span>';
    if (!q) q=$('#fq').val();
    else $('#fq').val(q);
    res.empty();
    if (!skip) skip=0;
    else skip=parseInt(skip);
    if (q != '')
     $.post( `https://${gset.server}/apps/search/results.json` ,
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
          '<span style="display:inline-block;height:22px;padding: 2px 0px 0px 5px;">&nbsp;<span class="hide"><button style="padding: 1px 5px 1px 5px;border:1px solid #b00;position:relative;top:-5px;left:55px;" id="rmselected">Remove Select Items</button></span></span>'+
          '<span style="float:right">Results '+rescnt+'</span></div>');

          for (var i=0;i<l;i++) {
            var r=data.rows[i];
            var ico= r.image ? r.image : ''+r.url.match(/^https?:\/\/[^/]+/)+'/favicon.ico' ;
            var icl = r.image? " hov" : '';
            var d= new Date(0);
            d.setUTCSeconds(parseInt(r.last));
        
            res.append('<div data-hash="'+r.hash+'" data-dom="'+r.dom+'" id="r'+i+'" class="resi"><span class="imgwrap">'+ricos+'<img class="fimage'+icl+'" src="home_website_start_house.svg"></span>'+
            '<span class="itemwrap"><span class="abstract nowrap"><a class="url-a tar" ' + (browser.t=='f'?'style="width:calc( 100% - 165px )" ':'') + 'target="_blank" href="'+r.url+'">'+
                escapeHtml(r.title.replace(/\s+/g,' '))+'</a><span class="timestamp">('+d.toLocaleString()+')</span></span><br><span class="abstract url-span">'+r.url+
                '</span></span><br><span class="abstract">'+r.abstract+"</span></div>");
            
            loadImage(ico,$('#r'+i).find('img'),(i==l-1));
          }
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
*/

$(document).ready(function(){
    var enable=$('#enable'),enableafter=false;
    var mobile = /mobile/i.test(navigator.userAgent);
    /*
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
    */
    var fq=$('#fq');

    fq.devbridgeAutocomplete({
        serviceUrl: '/apps/shse/autocomp.json',
        dataType: 'json',
        minChars: 3,
        noCache: false
    });  

    $('body').on('keyup','#fq',function(e){
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
            else alert("click on setting icon and set up account access first");
        });

    });
    mktitles();
    attachhov();
    $('.fimage').each(function(){
        loadImage($(this));
    });

	// HISTORY
    var dpicker = $("#datepicker");
    if (dpicker.length) {
        var doclick=false;
        var lastheat;
 
        function updatecal(dateText) {
            if(!doclick) return;
            var c=dateText.match(/(\d+)\/(\d+)\/(\d+)/);
            //send computer localtime for chosen day in ms since epoch
            var s = new Date(`${c[3]}-${c[1]}-${c[2]}T00:00:00`);
            var e = new Date(`${c[3]}-${c[1]}-${c[2]}T23:59:59.999`);
            console.log(s,e);
            var resbox=$('#res');
            $.post({
                url:'/apps/shse/hist.json',
                data:{date:dateText, start:s.getTime(), end:e.getTime()},
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
            $.post({
                url:'/apps/shse/hist.json',
                data:{startm:m, starty:y },
                success: function(data){
                    console.log(data);
                    insertheat(data);
                    lastheat=data;
                }
            }).fail(function(xhr, txt, err) {
                alert("failed to get data from server: "+txt);
            });
            
            
        }
 
        function monthchange(year,month) {
            doheat(month,year);
        }

        dpicker.datepicker({
            numberOfMonths: nMonths,
            changeMonth: true,
            changeYear: true,
            maxDate: "+0D",
            onChangeMonthYear: monthchange,
            onSelect: updatecal
        });
        var firstdate=$('.ui-datepicker-group').eq(0).find('td[data-handler=selectDay]').eq(0);
        firstdate.click();
        var firstmonth=parseInt($('.ui-datepicker-month').val())+1;
        var firstyear =parseInt($('.ui-datepicker-year').val());
        doheat(firstmonth,firstyear);
        doclick=true;
    };
});

