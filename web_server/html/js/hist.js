function dohist(dpicker,server,user,key) {
    var doclick=false;
    var lastheat;
    var resbox=$('#hres');
    var byDate, bySite;

    if(!server) server='';

    function showByDate() {
        var res = byDate.rows
        resbox.empty();
        resbox.append('<p><b>'+byDate.datestr+':</b></p>');
        for(var i=0;i<res.length;i++){
            var r=res[i];
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
            r.Title =r.Title ? r.Title.replace(/\s+/,' ') : r.Url;
            r.edate=new Date(r.Date);
            r.etime=r.edate.getTime();
            if(/^file:\/\//.test(r.Url))
            {
                site="/";
                proto="file:";
            } else {
                try {
                    site=new URL(r.Url);
                    proto=site.protocol;
                    site = site.host;
                } catch(e){}
            }
            if(!site) {
                console.log("can't parse url",r);
                continue;
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
        resbox.empty();
        resbox.append('<p><b>'+bySite.datestr+':</b></p>');
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
                    `<a class="url-a2 tar" target="_blank" href="${s.proto}//${s.host=='filesystem'?'/':s.host}">${s.host}</a>`+
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
    }

    var gb = $('#groupby');
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
        console.log(cache);
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
        if(orderByDate) {
            gb.addClass('bydate');
            gb.text('Group by Site');
            showByDate();
        } else {
            showBySite();
        }
       setCookie('histinfo', {od:orderByDate, ld:lastDate});
    }

    function updatecal(dateText) {
        var dt=new Date();
        var m = String(dt.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        var d = String(dt.getDate()).padStart(2, '0');
        var y = dt.getFullYear();
        var today=`${m}/${d}/${y}`;

        if(!doclick) return;
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
        //send computer localtime for chosen day in ms since epoch
        var s = new Date(`${c[3]}-${c[1]}-${c[2]}T00:00:00`);
        var e = new Date(`${c[3]}-${c[1]}-${c[2]}T23:59:59.999`);
        //console.log(s,e);
        $.post({
            url:server+'/apps/shse/hist.json',
            data:{date:dateText, start:s.getTime(), end:e.getTime(), user:user, key:key},
            success: function(data){
                byDate=data.res;
                var d=new Date(data.start);
                byDate.datestr = s.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                bySite=assembleBySite();//alters res entries
                lastDate=dateText;
                applycal();
                gb.css('visibility','visible');
                //add to cache
                cacheEntries.push(dateText);
                cache[dateText]={byDate:byDate,bySite:bySite}
                //delete item at beginning if list too long
                while(cacheEntries.length>maxCache) {
                    var en=cacheEntries.shift();
                    delete cache[en];
                    //console.log('deleted',en);
                }
                saveEntries()
            }
        }).fail(function(xhr, txt, err) {
            alert("failed to get data from server: "+txt);
        });
        if(lastheat) setTimeout(function(){insertheat(lastheat);},50);            
    };

    gb.click(function(e){
        if(gb.hasClass('bydate')){
            gb.text('Order by Date');
            showBySite();
            gb.removeClass('bydate');
            orderByDate=false;
        } else {
            gb.text('Group by Site');
            showByDate();
            gb.addClass('bydate');
            orderByDate=true;
        }
        setCookie('histinfo', {od:orderByDate, ld:lastDate});
    });

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
                url:server+'/apps/shse/hist.json',
                //data:{startm:, starty:y },
                data:{startm:firstmonth, starty:firstyear,user:user, key:key },
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
}
