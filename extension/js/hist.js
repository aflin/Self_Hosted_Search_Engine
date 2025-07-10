function dohist(dpicker,server,user,key) {
    var doclick=false;
    var lastheat;
    var resbox=$('#hres');
    var byDate, bySite;
    var dq=$('#dq');
    var byd=$("#bydatel");
    var bys=$("#bysitel");
    var gb=$('.grpby');
    if(!server) server='';

    function assembleByDom(res){
        var r, d, lastd, ret=[], o={entries:[]}, rows;
        if(!res || !res.rows)
            return ret;
        rows=res.rows;
        for (var i=0; i < rows.length; i++) {
            r=rows[i];
            d= new Date(r.Date).toLocaleDateString();
            if(lastd && d != lastd) {
                o.day=lastd;
                ret.push(o);
                o={entries:[]};
            }
            r=rows[i];
            lastd=d;
            o.entries.push(r);
        }
        if(o.entries.length) {
            o.day=lastd;
            ret.push(o);
        }
        return ret;
    }

    function lazydoms(dom, data) {
        console.log(data);
        var res=data.rows;
        var startd = $('.ui-datepicker-group').eq(0).find('td[data-handler=selectDay]').eq(0);
        var m = parseInt(startd.attr('data-month'));
        var y = parseInt(startd.attr('data-year'));
        var d = parseInt(startd.find('a').attr('data-date'));
        var cd = new Date(`${y}-${m<9?'0':''}${(m+1)}-${d<10?'0':''}${d}T00:00:00.0`);

        for(var i=0;i<res.length;i++){
            var n=res[i];
            if(n) {
                var day=cd.toLocaleDateString();
                html=`<div class="sitediv" data-day="${day}">`+
                        '<span class="sitelink" title="show entries">'+
                            '<span title="show entries">&rarr;</span>'+
                            `<span class="timestamp2">${day}` + '</span>'+
                        '</span>'+
                        ` (${n})`;
                html+='</div>';
                resbox.append(html);
            }
            cd.setDate(cd.getDate()+1);
        }
        $('.sitelink').click(function(e){
            e.stopImmediatePropagation();
            var day=$(this).closest('.sitediv').attr('data-day');
            updatecal(day, null, function(data){
                console.log("done");
                var tar=$(`.sitediv[data-site="${dom}"]`);
                tar.find('.sitelink').click()
                tar[0].scrollIntoView();
            });
        });
    }

    function showByDom(dom, res, cnt, lazy, start, end) {
        var s, r, html;
        resbox.empty();
        resbox.addClass('bydom').removeClass('bydate bysite');
        dq.css("background-color",'white').removeClass('inactive');
        if(window.innerWidth < 480) dq.blur();// close keyboard on phone
        bys.add(byd).removeClass('bysel');
        dq.val(dom);
//        resbox.append(`<p style="color:gray">From ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</p>`);
        if(lazy) {
            resbox.append(`<p id="domp" data-dom="${dom}"><b>${dom} (${cnt})</b> 
            <i><small style="color:gray">From ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</small></i></p>
            <p><i style="color:gray">Too many results for one page.<br>Click on Date below to open result page for that date with ${dom} displayed.</i></p>`);
            return doheat(dom,lazydoms);
        }
        resbox.append(`<p id="domp" data-dom="${dom}"><b>${dom} (${cnt}):</b>
        <i><small style="color:gray">From ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</small></i></p>`)
        if(!res.length) {
            html=`<div>no results for ${dom} during time period above</div>`;
            resbox.append(html);
            return;
        }
        for(var i=0;i<res.length;i++){
            var s=res[i];
            html=`<div class="sitediv" data-day="${s.day}">`+
                    '<span class="sitelink" title="show entries">'+
                        '<span class="showrow" style="" title="show entries">‣</span>'+
                        `<span class="timestamp2">${s.day}` + '</span>'+
                    '</span>'+
                    ` (${s.entries.length})`;
            for (var j=0;j<s.entries.length;j++) {
                var r=s.entries[j];
                //fixme:
                if(r.Title=="null") delete r.Title;
                if(! (r.edate instanceof Date) )
                    r.edate=new Date(r.etime); 
                r.Title =r.Title ? r.Title.replace(/\s+/,' ') : r.Url;
                html+=`<div data-hash="${r.Hash}" class="resi reslm">`+
                    `<span class="timestamp2">${new Date(r.Date).toLocaleTimeString()}</span>`+
                    '<span class="itemwrap2">'+
                        `<a class="url-a a100" href="${r.Url}" '" target="_blank">${r.Title}</a>`+
                        '<br>'+
                        `<span class="abstract url-span">${r.Url}</span>`+
                    '</span>'+
                '</div>'
            }
            html+='</div>'; 
            resbox.append(html);
        }

        $('.sitelink').click(function(e){
            e.stopImmediatePropagation();
            var t=$(this).find('.showrow'), wrap=$(this).closest('.sitediv');
            var sd=$(this);
            if (t.hasClass('isvis')) {
                t.css('transform','rotate(270deg) translate(4px,2px)');
                t.removeClass('isvis');
                t.attr('title','show entries');
                sd.attr('title','show entries');
                wrap.css('height','');
            } else {
                t.css('transform','rotate(90deg) translate(0px, -2px)');
                t.addClass('isvis');
                t.attr('title','hide entries');
                sd.attr('title','hide entries');
                wrap.css('height','auto');
            }
        });
        doheat(dom);
    }

    function domSearch(dom, noresCb) {
        if(!dom)
            return;
        var startd = $('.ui-datepicker-group').eq(0).find('td[data-handler=selectDay]').eq(0);
        var m = parseInt(startd.attr('data-month'));
        var y = parseInt(startd.attr('data-year'));
        var d = parseInt(startd.find('a').attr('data-date'));
        var s = new Date(`${y}-${m<9?'0':''}${(m+1)}-${d<10?'0':''}${d}T00:00:00.0`);
        var endd   = $('.ui-datepicker-group').last().find('td[data-handler=selectDay]').last();

        gb.css('visibility','visible');

        m = parseInt(endd.attr('data-month'));
        y = parseInt(endd.attr('data-year'));
        d = parseInt(endd.find('a').attr('data-date'));
        var e = new Date(`${y}-${m<9?'0':''}${(m+1)}-${d<10?'0':''}${d}T23:59:59.9999`);
        $.post({
            url:server+'/apps/shse/hist.json',
            data:{dom:dom, par:`${s.toString()} ${e.toString()}`,start:s.getTime(), end:e.getTime(), user:user, key:key},
            success: function(data){
                if(!data) {
                    alert("empty reply from server");
                    return;
                }
                // a callback for when there are no results.  Do it instead of showByDom
                if (noresCb) {
                    if (data.res && data.res.rowCount==0) {
                        noresCb(dom);
                        return;
                    }
                }
                var byDom=assembleByDom(data.res);
                showByDom(dom, byDom, data.nrows, data.displayLazy,s,e);
            }
        }).fail(function(xhr, txt, err) {
            alert("failed to get data from server: "+txt);
        });
    }

    function showByDate() {
        var res = byDate.rows
        dq.css("background-color",'lightgray').addClass('inactive');
        orderByDate=true;

        bys.removeClass('bysel');
        byd.addClass('bysel');
        orderByDate=true;
        setCookie('histinfo', {od:orderByDate, ld:lastDate});

        resbox.empty();
        resbox.addClass('bydate').removeClass('bydom bysite');
        resbox.append('<p><b>'+byDate.datestr+' (by date):</b></p>');
        for(var i=0;i<res.length;i++){
            var r=res[i];
            //fixme:
            if(r.Title=="null") delete r.Title;
            r.Title =r.Title ? r.Title.replace(/\s+/,' ') : r.Url;
            if(! (r.edate instanceof Date) )
                r.edate=new Date(r.etime); 
            resbox.append(
                `<div data-hash="${r.Hash}" class="resi">`+
                    '<span class="itemwrap">'+
                    `<a class="url-a tar" href="${r.Url}" '" target="_blank">${r.Title}</a>`+
                    `<span class="timestamp">${r.edate.toLocaleTimeString()}</span>`+
                    '<br>'+
                    `<span class="abstract url-span">${r.Url}</span>`+
                    '</span>'+
                '</div>'
            );
        }
    }

    function assembleBySite() {
        var res = byDate.rows
        var ret = { datestr: byDate.datestr, res:[], entriesBySite:{} }
        var r,proto,site;
        for(var i=0;i<res.length;i++){
            r=res[i];
            site=null;
            //fixme:
            if(r.Title=="null") delete r.Title;
            r.Title =r.Title ? r.Title.replace(/\s+/,' ') : r.Url;
            r.edate=new Date(r.Date);
            r.etime=r.edate.getTime();
            if(/^file:\/\//.test(r.Url))
            {
                site="/";
                proto="file:";
            } else {
                try {
                    /*site=new URL(r.Url);
                    proto=site.protocol;
                    site = site.host;*/
                    site=r.Dom;
                } catch(e){}
            }
            if(!site) {
                site="unknown";
                //console.log("can't parse url",r);
                //continue;
            }
            var entry = ret.entriesBySite[site];
            if(!entry) {
                entry =
                {
                    first:   r.etime,
                    last:    r.etime,
                    host:    site=='/'?'filesystem':site,
                    proto:   proto,
                    entries: [r]
                }
                ret.res.push(entry);
                ret.entriesBySite[site]=entry;
            } else {
                if(r.etime < entry.first)
                    entry.first=r.etime;
                else if (r.etime > entry.last)
                    entry.last=r.etime;
                entry.entries.push(r);
            }
            //console.log(site,entry);
        }
        ret.res.sort(function(a,b) {
            return b.last - a.last;
        });
        for(var i=0;i<ret.res.length;i++){
            var r=ret.res[i].entries;
            r.sort(function(a,b){
                return b.date - a.date;
            });
        }
        //console.log(ret);
        return ret;
    }

    function showBySite() {
        var s, r, html, res=bySite.res
        dq.css("background-color",'lightgray').addClass('inactive');
        orderByDate=false;

        byd.removeClass('bysel');
        bys.addClass('bysel');
        orderByDate=false;
        setCookie('histinfo', {od:orderByDate, ld:lastDate});

        resbox.empty();
        resbox.addClass('bysite').removeClass('bydom bydate');
        resbox.append('<p><b>'+bySite.datestr+' (by site):</b></p>');
        for(var i=0;i<res.length;i++){
            var s=res[i];
            var first = new Date(s.first), last=new Date(s.last);
            html=`<div class="sitediv" data-site="${s.host}">`+
                    '<span class="sitelink" title="show entries">'+
                        '<span class="showrow" style="" title="show entries">‣</span>'+
                        `<span class="timestamp2">${first.toLocaleTimeString()}`+
                            '<span style="width:4px;margin:0px;float:right;" class="timestamp2">-</span>'+
                        '</span>'+
                        `<span class="timestamp2" style="margin-left:16px">${last.toLocaleTimeString()}</span>`+
                    '</span>'+
                    `<a class="url-a2 tar showdom" data-site="${s.host}" href="#">${s.host}</a>`+
                    ` (${s.entries.length})`;
            for (var j=0;j<s.entries.length;j++) {
                var r=s.entries[j];
                if(! (r.edate instanceof Date) )
                    r.edate=new Date(r.etime); 
                html+=`<div data-hash="${r.Hash}" class="resi reslm">`+
                    `<span class="timestamp2">${r.edate.toLocaleTimeString()}</span>`+
                    '<span class="itemwrap2">'+
                        `<a class="url-a a100" href="${r.Url}" '" target="_blank">${r.Title}</a>`+
                        '<br>'+
                        `<span class="abstract url-span">${r.Url}</span>`+
                    '</span>'+
                '</div>'
            }
            html+='</div>'; 
            resbox.append(html);
        }

        $('.sitelink').click(function(e){
            e.stopImmediatePropagation();
            var t=$(this).find('.showrow'), wrap=$(this).closest('.sitediv');
            var sd=$(this);
            if (t.hasClass('isvis')) {
                t.css('transform','rotate(270deg) translate(4px,2px)');
                t.removeClass('isvis');
                t.attr('title','show entries');
                sd.attr('title','show entries');
                wrap.css('height','');
            } else {
                t.css('transform','rotate(90deg) translate(0px, -2px)');
                t.addClass('isvis');
                t.attr('title','hide entries');
                sd.attr('title','hide entries');
                wrap.css('height','auto');
            }
        });
        $('.showdom').click(function(e){
            e.stopImmediatePropagation();
            var t=$(this);
            var dom = t.attr('data-site');
            domSearch(dom);
            return false;
        });
    }



    var orderByDate=false;
    var lastDate;

    var cache={};
    var cacheEntries=[];
    var maxCache=100;

    // for popup, store in browser
    if(window.gset) {
        if(!gset.histdata)
            gset.histdata={cache:{},cacheEntries:[]}
        cache=gset.histdata.cache;
        cacheEntries=gset.histdata.cacheEntries;
    }

    function saveEntries() {
        if(window.gset) {
            browser.storage.local.set({ histdata: {cache:cache,cacheEntries:cacheEntries} });
        }
    }


    function delCacheEntry(entry) {
        var i = cacheEntries.indexOf(entry);
        if(i != -1)
           cacheEntries.splice(i,1); 
    }


    function applycal() {
        gb.css('visibility','visible');
        if(orderByDate) {
            showByDate();
        } else {
            showBySite();
        }
        console.log(orderByDate);
        setCookie('histinfo', {od:orderByDate, ld:lastDate});
    }

    function updatecal(dateText, ignore, cb) {
        if(!doclick) return;
        var dt=new Date();
        var m = String(dt.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        var d = String(dt.getDate()).padStart(2, '0');
        var y = dt.getFullYear();
        var today=`${m}/${d}/${y}`;

        if(today!=dateText && cache[dateText]) {
            byDate = cache[dateText].byDate;
            bySite = cache[dateText].bySite;
            applycal();
            //move to end of cache array;
            delCacheEntry(dateText);
            cacheEntries.push(dateText);
            saveEntries();
            if(lastheat) setTimeout(function(){insertheat(lastheat);},50);            
            return;
        }
        var c=dateText.match(/(\d+)\/(\d+)\/(\d+)/);
        d=c[2].length==1 ? '0'+c[2] : c[2];
        m=c[1].length==1 ? '0'+c[1] : c[1];
        var s = new Date(`${c[3]}-${m}-${d}T00:00:00`);
        var e = new Date(`${c[3]}-${m}-${d}T23:59:59.999`);
 
        $.post({
            url:server+'/apps/shse/hist.json',
            data:{date:dateText, start:s.getTime(), end:e.getTime(), user:user, key:key},
            success: function(data){
                if(!data || !data.res || !data.start){
                    alert("server sent empty response");
                    return;
                }
                byDate=data.res;
                var d=new Date(data.start);
                byDate.datestr = s.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                bySite=assembleBySite();//alters res entries
                lastDate=dateText;
                applycal();
                //add to cache
                cacheEntries.push(dateText);
                cache[dateText]={byDate:byDate,bySite:bySite}
                //delete item at beginning if list too long
                while(cacheEntries.length>maxCache) {
                    var en=cacheEntries.shift();
                    delete cache[en];
                    //console.log('deleted',en);
                }
                saveEntries();
                if(cb) cb(data);
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
            var v=0, t=$(this).find('a');
            if(rows[i]!==undefined) {
                v = parseInt(rows[i])/max ;
                v *= 100.0;
            }
            t.css('background',`rgb(64 128 255 / ${v}%)`);
            i++;
        });

    }
    function doheat(dom, cb){
        setTimeout(function(){
            // in monthchange, jquery ui returns wrong month when showing
            // multiple months and clicking on arrows where 
            // there is no movement.  Date doesn't change until after event,
            // hence the timeout
            var firstmonth=parseInt($('.ui-datepicker-month').val())+1;
            var firstyear =parseInt($('.ui-datepicker-year').val());
            $.post({
                url:server+'/apps/shse/hist.json',
                //data:{startm:, starty:y },
                data:{dom:dom, startm:firstmonth, starty:firstyear,user:user, key:key },
                success: function(data){
                    insertheat(data);
                    if(cb)
                        cb(dom,data);
                    if(!dom)
                        lastheat=data;
                }
            }).fail(function(xhr, txt, err) {
                alert("failed to get data from server: "+txt);
            });
        },2);
    }

    var skipheat=false;
    function monthchange(year,month) {
        // year, month ignored.  See above.
        if($('.bydom').length)
        {
            var dom=$('#domp').attr('data-dom');
            //cal is not updated at this point
            setTimeout(function(){
                domSearch(dom);
            },20);
        }
        else if (!skipheat)
            doheat();
        skipheat=false;
    }

    if(window.innerWidth<480)
        nMonths=2;

    dpicker.datepicker({
        numberOfMonths: nMonths,
        changeMonth: true,
        changeYear: true,
        maxDate: "+0D",
        onChangeMonthYear: monthchange,
        onSelect: updatecal,
        stepMonths: nMonths
    });

    var hcookie=getCookie('histinfo');
    //console.log(hcookie);
    if(hcookie && hcookie.ld) {
        dpicker.datepicker('setDate',hcookie.ld);
        orderByDate=hcookie.od;
        doclick=true;
        updatecal(hcookie.ld);
    } else {
        var firstdate=$('.ui-datepicker-group').eq(0).find('td[data-handler=selectDay]').eq(0);
        firstdate.click();
    }
    doheat();
    doclick=true;

    if(dq.length && dq.devbridgeAutocomplete) {
        dq.devbridgeAutocomplete({
            serviceUrl: server+'/apps/shse/autocomp.json?dom=1',
            dataType: 'json',
            minChars: 3,
            noCache: false
        });  
        $('.autocomplete-suggestions').eq(1).addClass('domAuto');
        $('.domAuto').click(function(){
            domSearch(dq.val(), nores);
        });
    }

    $('body').on('keydown','#dq',function(e,ui){
        if(e.originalEvent.key==' ') {
            e.stopImmediatePropagation();
            return false;
        }
    });

    function nores(dom) {
        $.post({
            url:server+'/apps/shse/hist.json',
            data:{dom:dom, getLast:true, user:user, key:key},
            success: function(data){
                if(data && data.end) {
                    var d=new Date(data.end);
                    d.setDate(1);
                    d.setMonth(d.getMonth()-2);
                    dpicker.datepicker("setDate", d);
                    domSearch(dom);
                } else {
                    resbox.empty();
                    resbox.append(`<div>no results for ${dom} during time period above</div>`);
                }
            }
        }).fail(function(xhr, txt, err) {
            alert("failed to get data from server: "+txt);
        });
    }

    dq.focus(function(){
        dq.css('background-color','');
    });
    
    dq.blur(function(){
        if(dq.hasClass('inactive'))
            dq.removeClass('inactive').css('background-color','lightgray');
    });

    $('body').on('keyup','#dq',function(e,ui){
        if(e.originalEvent.key=='Enter') {
            skipheat=true;
            domSearch(dq.val(), nores);
        }
    });

    $('#dsearch').click(function(){
        skipheat=true;
        domSearch(dq.val(),nores)
    });

    if(orderByDate)
        byd.addClass('bysel');
    else
        bys.addClass('bysel');
    bys.click(function(){
        if(!bys.hasClass('bysel'))
            showBySite();
        byd.removeClass('bysel');
        bys.addClass('bysel');
        orderByDate=false;
        setCookie('histinfo', {od:orderByDate, ld:lastDate});
    });
    byd.click(function(){
        if(!byd.hasClass('bysel'))
            showByDate();
    });

    $('.by').mousedown(function(){
        $(this).addClass('bydown');
    });
    $('.by').mouseup(function(){
        $(this).removeClass('bydown');
    });

    window.addEventListener('resize', function() {
        if(nMonths==2 && window.innerWidth > 480) {
            dpicker.datepicker( "option", "numberOfMonths", 3);
            nMonths=3;
        } else if (nMonths==3 && window.innerWidth<= 480) {
            dpicker.datepicker( "option", "numberOfMonths", 2);
            nMonths=2;
        }
  });

}
