var scrollbarWidth;

//https://stackoverflow.com/questions/13382516/getting-scroll-bar-width-using-javascript/13382873#13382873
function getScrollbarWidth() {
  // Creating invisible container
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll'; // forcing scrollbar to appear
  outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
  document.body.appendChild(outer);

  // Creating inner element and placing it in the container
  const inner = document.createElement('div');
  outer.appendChild(inner);
  
  // Calculating difference between container's full width and the child width
  const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);

  // Removing temporary elements from the DOM
  outer.parentNode.removeChild(outer);

  return scrollbarWidth;
    
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

function setCookie(name, value, days) {
  var expires = "";
  if(typeof value == 'object')
      value=JSON.stringify(value);
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 3650));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1, c.length);
    }
    if (c.indexOf(nameEQ) === 0) {
      var ret = c.substring(nameEQ.length, c.length);
      try {
          ret=JSON.parse(ret);
      }catch(e){}
      return ret;
    }
  }
  return null;
}


function loadImage(img) {
    var t=new Image();
    var url = img.attr('src');
    if(url) {
        t.onload=function() {
            img.attr('src',url).addClass('imset');
        }
        t.onerror=function(){
            img.css('display','none').addClass('imset');
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
        }
        t.onerror=function(){
            img.attr('src',"/images/home.ico");
        }
    } else {
        img.attr('src',home.ico).addClass('imset');
    }
    t.src=url;
    setTimeout(function(img,t){
        if(!img.hasClass('imset')) {
            img.attr('src',"/images/home.ico").addClass('imset');
            t.src="";
        }
    },3000,img,t);
        
        
}

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
        t.closest('section').css('z-index','100');
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
            $('#delsel').css('visibility','hidden');
            $('main').css('margin-left','');
        } else {
            $('.hm').show(250);
            t.css('transform','rotate(90deg)');
            t.addClass('isvis');
            t.attr('title','click to hide database editing options');
            $('#delsel').css('visibility','visible');
            $('main').css('margin-left','40px');
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
            req.hash.push( $(this).closest('.entry').attr('data-hash') );
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
        var t=$(this),r=t.closest('.entry'),h=r.attr('data-hash'),d=r.attr('data-dom'), req={};
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

/*
    // prevent <main> from shifting when scrollbar appears
    scrollbarWidth=getScrollbarWidth();
    var obs=new ResizeObserver(function() {
        var hasbar=(document.body.scrollHeight > window.innerHeight);
        //console.log(hasbar);
        var leftmar = parseFloat(window.getComputedStyle(document.getElementsByTagName('main')[0]).getPropertyValue('margin-left'));
        //console.log("leftmar =",leftmar);
        if(hasbar) {
            if(leftmar*2 > scrollbarWidth)
                document.getElementsByTagName('main')[0].style.left=(scrollbarWidth/2)+"px";
            document.getElementsByTagName('main')[0].style.right="-"+(scrollbarWidth/2)+"px";
        } else {
            document.getElementsByTagName('main')[0].style.left="0px";
            document.getElementsByTagName('main')[0].style.right="0px";
        }

    });
    obs.observe(document.body);
*/    
    $('#logout').text("Log out " + username);

    if(fq.length && fq.devbridgeAutocomplete)
    {
        fq.devbridgeAutocomplete({
            serviceUrl: '/apps/shse/autocomp.json',
            dataType: 'json',
            minChars: 3,
            noCache: false
        });
        $('.autocomplete-suggestions').eq(0).addClass('mainAuto');
        $('.mainAuto').click(function(){
            console.log('click');
            fq.closest('form').submit();
        });
    }

    $('body').on('keyup','#fq',function(e){
        /*if (window.safari) { 
            fq.blur();
            safari.application.addEventListener("popover", function(){
                setTimeout(function(){
                    $('.autocomplete-suggestions').hide();
                },250);
             },true);
        }*/

        $('#search').click(function(){
            if (user) dosearch();
            else alert("click on setting icon and set up account access first");
        });

    });

    var ham=$('#hamburger');
    ham.click(function(e) {
        $('.mobile-menu').toggleClass('show');
    });


    // SEARCH PAGE
    if ($('#showico').length) {
        mktitles();
        attachhov();
        $('.hov').each(function(){
            loadImage($(this));
        });
        $('.resico').each(function(){
            loadIco($(this));
        });
    }

	// HISTORY PAGE
    var dpicker = $("#datepicker");
    if(dpicker.length)
        dohist(dpicker);
});

