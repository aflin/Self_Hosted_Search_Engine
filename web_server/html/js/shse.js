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
    msg = 'Could not connect to server.'
    alert(msg);
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
            $('#delsel').hide();
        } else {
            $('.hm').show(250);
            t.css('transform','rotate(90deg)');
            t.addClass('isvis');
            t.attr('title','click to hide database editing options');
            $('#delsel').show();
            console.log('show');
        }
    });

    function dodel(popup, req) {
        $.post({
            url: '/apps/shse/delete.json' ,
            data: req,
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
                        location.reload();
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

        dodel(popup, req);
    });
    
    $('.rico').click(function(){
        var t=$(this),r=t.closest('.resi'),h=r.attr('data-hash'),d=r.attr('data-dom'), req={};
        var popup;
        if(d=="null") d=null;
        $('body').append('<div class="popup"><table><tr><td colspan=2><b>Delete Entry?</b><br><span style="font-size:10px;color:#07c">'+r.find('a').attr('href')+'</td></tr>'+
            '<tr><td>Only this entry:</td><td><button class="rmb rme">Delete</button></td></tr>'+
            (d ? '<tr><td>All from '+d+':</td><td><button class="rmb rmd">Delete</button></td>/tr>':"")+
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
        });
    });
}

$(document).ready(function(){
    var enable=$('#enable'),enableafter=false;
    var mobile = /mobile/i.test(navigator.userAgent);
    var fq=$('#fq');

    $('#logout').text("Log out " + username);

    if(fq.length && fq.devbridgeAutocomplete)
    {
        fq.devbridgeAutocomplete({
            serviceUrl: '/apps/shse/autocomp.json',
            dataType: 'json',
            minChars: 3,
            noCache: false
        });  
    }

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
    var doclick=false;
    var lastheat;
 
    function updatecal(dateText) {
        if(!doclick) return;
        var c=dateText.match(/(\d+)\/(\d+)\/(\d+)/);
        //send computer localtime for chosen day in ms since epoch
        var s = new Date(`${c[3]}-${c[1]}-${c[2]}T00:00:00`);
        var e = new Date(`${c[3]}-${c[1]}-${c[2]}T23:59:59.999`);
        console.log(s,e);
        var resbox=$('#hres');
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
        setTimeout(function(){
            // in monthchange, jquery ui returns wrong month when showing
            // multiple months and clicking on arrows where 
            // there is no movement.  Date doesn't change until after event,
            // hence the timeout
            var firstmonth=parseInt($('.ui-datepicker-month').val())+1;
            var firstyear =parseInt($('.ui-datepicker-year').val());
            $.post({
                url:'/apps/shse/hist.json',
                //data:{startm:, starty:y },
                data:{startm:firstmonth, starty:firstyear },
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

    if(dpicker.length) {
        dpicker.datepicker({
            numberOfMonths: nMonths,
            changeMonth: true,
            changeYear: true,
            maxDate: "+0D",
            onChangeMonthYear: monthchange,
            onSelect: updatecal,
            stepMonths: 3
        });

        var firstdate=$('.ui-datepicker-group').eq(0).find('td[data-handler=selectDay]').eq(0);
        firstdate.click();
        doheat();
        doclick=true;
    }
});

