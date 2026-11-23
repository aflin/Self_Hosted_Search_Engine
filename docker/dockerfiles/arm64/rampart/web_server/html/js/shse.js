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


function postfail() {
    alert('Could not connect to server.');
}

/* =====================================================================
   SEARCH RESULTS PAGE

   The results are drawn by the server (searchpage() in apps/shse.js) with
   the same markup and stylesheet (/css/results.css) as the browser plugin's
   popup.  This is the behaviour: the Options toggle, select all, removing
   entries, and the larger view of a thumbnail.
   ===================================================================== */

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

function sr_delete(req) {
    $.post({
        url: '/apps/shse/delete.json',
        data: req,
        success: function(data){
            if (data.status=='ok')
                // draw the same page again, now without what was removed
                sr_toast("Deleted "+data.deleted+" items", 'ok', 1000, function(){ location.reload(); });
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
    if(dom)
        choice('All from '+dom+':', 'sr-do-dom');
    dlg.append(rows);
    dlg.append($('<p class="sr-dialog-foot"><button type="button" class="sr-do-cancel">Cancel</button></p>'));

    var o=sr_overlay(dlg);
    o.on('click', 'button', function(){
        var b=$(this), req={};
        if(b.hasClass('sr-do-cancel')) { o.remove(); return; }
        if(b.hasClass('sr-do-entry')) req.hash=[hash];
        else req.dom=dom;
        o.remove();
        sr_delete(req);
    });
    dlg.find('.sr-do-cancel').focus();
}

/* open or close the editing column */
function sr_setediting(on) {
    $('.sr').toggleClass('is-editing', on);
    $('#showopt').attr('aria-expanded', on ? 'true' : 'false')
                 .attr('title', on ? 'click to hide database editing options' : 'click to show database editing options');
    // nothing stays ticked out of sight
    if(!on) $('#sall, .sr .sitem').prop('checked', false);
}

function sr_bind() {
    var sr=$('.sr');

    sr.on('click', '#showopt', function(){
        sr_setediting(!sr.hasClass('is-editing'));
    });

    sr.on('change', '#sall', function(){
        sr.find('.sitem').prop('checked', this.checked);
    });

    // keep the select-all box truthful when boxes are ticked one at a time
    sr.on('change', '.sitem', function(){
        var all=sr.find('.sitem');
        $('#sall').prop('checked', all.length>0 && all.filter(':checked').length==all.length);
    });

    sr.on('click', '#rmselected', function(){
        var req={hash:[]};
        sr.find('.sitem:checked').each(function(){
            req.hash.push($(this).closest('.sr-item').attr('data-hash'));
        });
        if(!req.hash.length)
            sr_toast('Nothing selected', 'err', 800);
        else
            sr_delete(req);
    });

    sr.on('click', '.sr-del', function(){
        sr_askdelete($(this).closest('.sr-item'));
    });

    // a larger view of the thumbnail while the pointer is on it
    sr.on('mouseenter', '.sr-thumb', function(){
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
    sr.on('mouseleave', '.sr-thumb', function(){
        $('.sr-preview').remove();
    });

    // A site with no favicon gets the house; a thumbnail that will not load is
    // dropped.  The page may have finished loading some images already, so
    // those that have failed by now are dealt with here as well.
    function nofav(){ if(this.getAttribute('src')!='/images/home.ico') this.setAttribute('src','/images/home.ico'); }
    function nothumb(){ $(this).remove(); }
    sr.find('.sr-fav').on('error', nofav).each(function(){
        if(this.complete && !this.naturalWidth) nofav.call(this);
    });
    sr.find('.sr-thumb').on('error', nothumb).each(function(){
        if(this.complete && !this.naturalWidth) nothumb.call(this);
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
    if ($('.sr').length)
        sr_bind();

	// HISTORY PAGE
    var dpicker = $("#datepicker");
    if(dpicker.length)
        dohist(dpicker);
});

