var hardcode={
"--portals":{"google.com":2,"yahoo.com":2,"bing.com":2,"duckduckgo.com":2,"chatgpt.com":2,"dogpile.com":2,"baidu.com":2,"ask.com":2,"aol.com":2,"wolframalpha.com":2,"yandex.ru":2},
"--usbanks" : {"chase.com":2,"bankofamerica.com":2,"wellsfargo.com":2,"citi.com":2,"usbank.com":2,"pnc.com":2,"td.com":2,"capitalone.com":2,"bnymellon.com":2,"statestreetbank.com":2,"bbt.com":2,"schwabbank.com":2,"suntrust.com":2,"hsbc.com":2,"marcus.com":2,"ally.com":2,"53.com":2,"morganstanley.com":2,"key.com":2,"northerntrust.com":2,"citizensbank.com":2,"unionbank.com":2,"regions.com":2,"mtb.com":2,"americanexpress.com":2,"bmoharris.com":2,"huntington.com":2,"discover.com":2,"firstrepublic.com":2,"navyfederal.org":2,"bankofthewest.com":2,"bbvacompass.com":2,"synchronybank.com":2,"usaa.com":2,"santanderbank.com":2,"comerica.com":2,"morganstanley.com":2,"zionsbank.com":2,"svb.com":2,"ubs.com":2,"cnb.com":2,"mynycb.com":2,"signatureny.com":2,"peoples.com":2,"db.com":2,"bankoncit.com":2,"firsttennessee.com":2,"ncsecu.org":2,"eastwestbank.com":2,"firstcitizens.com":2,"tiaabank.com":2,"bankofoklahoma.com":2,"associatedbank.com":2,"banking.barclaysus.com":2,"fnb-online.com":2,"synovus.com":2,"snb.com":2,"bankunited.com":2,"frostbank.com":2,"valley.com":2,"iberiabank.com":2,"hancockwhitney.com":2,"texascapitalbank.com":2,"websteronline.com":2,"umpquabank.com":2,"cibc.com":2,"myinvestorsbank.com":2,"pacificwesternbank.com":2,"commercebank.com":2,"salliemae.com":2,"pnfp.com":2,"penfed.org":2,"tcfbank.com":2,"raymondjamesbank.com":2,"prosperitybankusa.com":2,"ozk.com":2,"westernalliancebank.com":2,"fhb.com":2,"umb.com":2,"chemicalbank.com":2,"fnbo.com":2,"mbfinancial.com":2,"bankwithunited.com":2,"arvest.com":2,"becu.org":2,"efirstbank.com":2,"flagstar.com":2,"oldnational.com":2,"bancorpsouth.com":2,"boh.com":2,"statefarm.com":2,"cathaybank.com":2,"simmonsbank.com":2,"stifelbank.com":2,"washingtonfederal.com":2,"midfirst.com":2,"schoolsfirstfcu.org":2,"my100bank.com":2,"bankofhope.com":2,"firstmidwest.com":2,"stockplanconnect.com":2,"morganstanleyclientserv.com":2,"ameritrade.com":2,"etrade.com":2,"schwab.com":2,"fidelity.com":2}
};
var settings={}
var server, sstore, sdelete, scheck;

if(window.safari) {
    window.browser={storage:{local:{}}}
    
    window.browser.storage.local.set=function(ob) {
        safari.self.tab.dispatchMessage("setstor", ob);
    }
    
    window.browser.storage.local.get=function() {
        function listen(fn){

            var listener=function (mess) {
                if (mess.name=='storres') {
                    fn(mess.message);
                    safari.self.removeEventListener("message",listener,false);
                }
            }
            
            safari.self.addEventListener("message",listener,false);

            safari.self.tab.dispatchMessage("getstor");
        }
        
        return {then:function(fn) {listen(fn);} };
    }
}

/* 
   convert an image to base64 dataURL and execute callback with
   the dataURL
*/ 
function imgtob64(u,maxw,maxh,cb) {
    var canvas=document.createElement('canvas');
    var ctx=canvas.getContext("2d");
    //console.log("imgtob64:",u);
    var img = new Image;
    img.onload = function() {
        var iw=img.width;
        var ih=img.height;
        var scale=Math.min((maxw/iw),(maxh/ih));
        var ws=iw*scale;
        var hs=ih*scale;
        canvas.width=ws;
        canvas.height=hs;
        ctx.drawImage(img,0,0,ws,hs);
        var imgurl = canvas.toDataURL('image/jpeg', 0.7);
        //console.log("image url: " + imgurl);
        if(typeof cb =='function')
            cb(imgurl);
    }
    img.onerror = function() {
        console.log("Error loading " + this.src);
    };
    img.crossOrigin = "Anonymous";
    img.src = u;
}


function start(f){
    browser.storage.local.get().then(
        function (s) {
            settings=s; //settings is global
            if(!settings.exclude) {
                /* 1 excludes just the domain, 2 excludes subdomains as well */
                settings.exclude= {
                    '--usbanks':2,
                    '--portals':2
                };
                browser.storage.local.set({exclude:settings.exclude});
            }
            if(settings.server) {
                server = `https://${settings.server}/apps/shse`;
                sstore = `${server}/store.json`;
                sdelete= `${server}/delete.json`;
                scheck = `${server}/check.json`;
                f();// web scraping function entry point
            } //else silent exit ??
        }
        ,
        /*error function */
        function(error) { console.log('Error: ' + error); }
    );
}

function checkexclude (exclude,doms) {
    var site=doms[doms.length-1];
    if (exclude[site])
        return true;

    for (var k in doms) {
        site=doms[k];        
        if ( exclude[site]==2  ) {
            return true;
            break;
        }
    }
    return false;
}

function postdata (surl, obj, msgs, callback){
    //obj.label=settings.label?settings.label:'';
    obj.key=settings.key;
    obj.user=settings.user;

    if(typeof msgs != 'object') 
        msgs={
            success:"ajax operation successful",
            fail:"ajax operation failed"
        };

    //console.log("posting to " + surl, obj);
    $.post(surl,obj, function(data) {
        if(data.status=='ok') {
            update_status({color:'green',blink:false, msg:msgs.success});
            if(callback) callback(true, data);
        } else if(data.error) {
            update_status({color:'red', blink:false, msg:data.error});
            if(callback) callback(false, data);
        } else {
            // mostly for search/check.json
            update_status({color:'green',blink:false, msg:msgs.success});
            if(callback) callback(true, data);
        }
    }).fail(function(){
        update_status({color:'red',blink:false, msg:msgs.fail});
        if(callback) callback(false, {});
    });
}

function infobox(excluded) {
    var box,a,bdivstyle='cursor:pointer;display:inline-block;';
    
    if(!$('#iboxs').length)
        $('head').append('<style id="iboxs">.FF-hidden{display:none !important;}.FF-hidden2{display:none !important;}'+
            '#FF, #FF div {align-content:normal;align-items:normal;align-self:auto;alignment-baseline:auto;all:;animation-delay:0s;animation-direction:normal;animation-duration:0s;animation-fill-mode:none;animation-iteration-count:1;animation-name:none;animation-play-state:running;animation-timing-function:ease;backface-visibility:visible;background-attachment:scroll;background-blend-mode:normal;background-clip:border-box;background-color:rgba(0, 0, 0, 0);background-image:none;background-origin:padding-box;background-position-x:0%;background-position-y:0%;background-repeat-x:;background-repeat-y:;background-size:auto;baseline-shift:initial;block-size:initial;border-bottom-color:rgb(0, 0, 0);border-bottom-left-radius:initial;border-bottom-right-radius:initial;border-bottom-style:none;border-bottom-width:initial;border-collapse:separate;border-image-outset:initial;border-image-repeat:stretch;border-image-slice:100%;border-image-source:none;border-image-width:1;border-left-color:rgb(0, 0, 0);border-left-style:none;border-left-width:initial;border-right-color:rgb(0, 0, 0);border-right-style:none;border-right-width:initial;border-top-color:rgb(0, 0, 0);border-top-left-radius:initial;border-top-right-radius:initial;border-top-style:none;border-top-width:initial;bottom:auto;box-shadow:none;box-sizing:content-box;break-after:auto;break-before:auto;break-inside:auto;buffered-rendering:auto;caption-side:top;caret-color:rgb(0, 0, 0);clear:none;clip:auto;clip-path:none;clip-rule:nonzero;color:rgb(0, 0, 0);color-interpolation:sRGB;color-interpolation-filters:linearRGB;color-rendering:auto;column-count:auto;column-fill:balance;column-gap:normal;column-rule-color:rgb(0, 0, 0);column-rule-style:none;column-rule-width:initial;column-span:none;column-width:auto;contain:none;content:normal;counter-increment:none;counter-reset:none;cursor:auto;cx:initial;cy:initial;d:none;direction:ltr;display:block;dominant-baseline:auto;empty-cells:show;fill:rgb(0, 0, 0);fill-opacity:1;fill-rule:nonzero;filter:none;flex-basis:auto;flex-direction:row;flex-grow:0;flex-shrink:1;flex-wrap:nowrap;float:none;flood-color:rgb(0, 0, 0);flood-opacity:1;font-family:"Times New Roman";font-feature-settings:normal;font-kerning:auto;font-size:initial;font-stretch:100%;font-style:normal;font-variant-caps:normal;font-variant-east-asian:normal;font-variant-ligatures:normal;font-variant-numeric:normal;font-variation-settings:normal;font-weight:400;grid-auto-columns:auto;grid-auto-flow:row;grid-auto-rows:auto;grid-column-end:auto;grid-column-start:auto;grid-row-end:auto;grid-row-start:auto;grid-template-areas:none;grid-template-columns:none;grid-template-rows:none;height:initial;hyphens:manual;image-rendering:auto;inline-size:initial;isolation:auto;justify-content:normal;justify-items:normal;justify-self:auto;left:initial;letter-spacing:normal;lighting-color:rgb(255, 255, 255);line-break:auto;line-height:normal;list-style-image:none;list-style-position:outside;list-style-type:disc;margin-bottom:initial;margin-left:initial;margin-right:initial;margin-top:initial;marker-end:none;marker-mid:none;marker-start:none;mask:none;mask-type:luminance;max-block-size:none;max-height:none;max-inline-size:none;max-width:none;min-block-size:initial;min-height:initial;min-inline-size:initial;min-width:initial;mix-blend-mode:normal;object-fit:fill;object-position:50% 50%;offset-distance:initial;offset-path:none;offset-rotate:auto 0deg;opacity:1;order:0;orphans:2;outline-color:rgb(0, 0, 0);outline-offset:initial;outline-style:none;outline-width:initial;overflow-anchor:auto;overflow-wrap:normal;overflow-x:visible;overflow-y:visible;overscroll-behavior-x:auto;overscroll-behavior-y:auto;padding-bottom:initial;padding-left:initial;padding-right:initial;padding-top:initial;page:;paint-order:fill stroke markers;perspective:none;perspective-origin:initial;pointer-events:auto;position:static;quotes:;r:initial;resize:none;right:auto;row-gap:normal;rx:auto;ry:auto;scroll-behavior:auto;shape-image-threshold:0;shape-margin:initial;shape-outside:none;shape-rendering:auto;size:;speak:normal;stop-color:rgb(0, 0, 0);stop-opacity:1;stroke:none;stroke-dasharray:none;stroke-dashoffset:initial;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-width:initial;tab-size:8;table-layout:auto;text-align:start;text-align-last:auto;text-anchor:start;text-combine-upright:none;text-decoration-color:rgb(0, 0, 0);text-decoration-line:none;text-decoration-skip-ink:auto;text-decoration-style:solid;text-indent:initial;text-orientation:mixed;text-overflow:clip;text-rendering:auto;text-shadow:none;text-size-adjust:auto;text-transform:none;text-underline-position:auto;top:initial;touch-action:auto;transform:none;transform-box:view-box;transform-origin:initial;transform-style:flat;transition-delay:0s;transition-duration:0s;transition-property:all;transition-timing-function:ease;unicode-bidi:normal;user-select:auto;vector-effect:none;vertical-align:baseline;visibility:visible;white-space:normal;widows:2;width:initial;will-change:auto;word-break:normal;word-spacing:initial;word-wrap:normal;writing-mode:horizontal-tb;x:initial;y:initial;z-index:auto;zoom:1;}'+
            "#FF .FF-ico {width:32px;height:32px;background-image: url('data:image/png;base64,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////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AC/pjZQAAA3XSURBVHja7J17cB1VHce/u03aJk2a0uTuvVCg0PQxOKOIU0pLhU7HoRYp6j+8tFNlWsEOjz6gooU6YgcUyiswo44UKVhgFB3QaX1UHZUZ7VCLimI7mb6oUrq7SZo0aULaNHf9I3eTu7vn7J6z50Tvtr/zz7179uz5fT97nr9z99w1XGQ7mCAAAiAAAiAAhVDlf8lLXuiEjguS19uhY0vyepeqEAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQgGww6LlRAiAAAiAAAiAAAiAAAiCAsxagKubcyJYCJ1XeI1sK7FTXj2wpcFM4NOENEU5q9ekYwhsiXCkA9nYOJ7V6WQb2dg5XuA3kxQpFUr/4LhVLIppRAnE6nfTyhQshbjeNK1ACsfc5r6ZfpBAsuZOmpMS8kn4BAkvytCkrMK8osKCkP5rAlK4iecUqUlDSH0liyvczeSX9sYmEdsNZfADBfjKvpD8mmeBuPuuMncwJD1R5xYGqoFQAwYRmCv2cpBLbQQtK+gNJyR+oHACpDcV5pRrETCy1odiiKlR5AJJb0vNKNYiRXHJLukVViAAIgAAIgADOLADJtc9Icsm1z0hyyYdOXKpClQfgKNUgyTpkx1QKqRpEVaiSABylGiRVh+z4aiFRgwIl4CjplyCwE2UJ6z/D2oCjVADCRWCL3FnBAgiVgKOkX5DAFpQmlsiELIGTUpxQEldWf6QNOEr6BQhsKXnJCUxJgY6iQFtWYNJpU06io1hFbOkqknSS+Ut9Pr18APxFLtGBwpJgMyWECg90tuJA50pEn6EPe4QZsvi4DU2nCYAACIAACIAACIAACIAAzh6AvGJGBcXrLeUSyCsiFBQRLEu5CmUSIfTkbvYQIg9/Zw2BsX8gWwisbjRTCOxxIEMIvIEsMwj8kTgjCHFTiUwgxM+FMoCQNJlTRsAoIyTPRhURCqOMIDKdrmgEMX+gghFEHZqKRRD3yCoUQcalrEgEOZ+4AhFknfqKQ5BflagwhDTLKhWFkG5dqIIQzug/xuAHR82oraraVQOoIPlpACpKvjxAhcmXBag4+XIAFShfBqAi5YsDVKh8UYCKlS8GUMHyRQAqWn4ygKJ8Zf2Jj/RVZVt+PEAG5McBZEI+HyAj8nkAmZHPBsiQfBZApuRHATImPwyQOflBgAzKLwfIpHzaP0AABEAABEAABEAABEAABHA2AzBWJfIc7yYP8f9etyXiw8HieDfseM5/r+chHM/SyXrWjxfP0snaDsGJ5/33el40nqmToZQXz9TJUMqLp0ZMAARAAARAAARAAARAAARAAARAAARAAARAAARAAARAAARAAARAAARAAARAAARAACoATuAjOT4c7MBHcnw4uIGP5HjOOzgYOh0h/SWJtng8U6krHE/7BwiAAAiAAAiAAAiAAAiAAM5egCr/gfSoq1LguFAWOC5HIIxOrqWkgZfL8p6r5z0vz3sOnqVfd65A5L8WDSPs9SJswmZZSrhb+VHJdSQp8w3RvL0NhbickvQrZmVxNkKw/2tRm1ldGVlW5Fz8Dg5NhrXpj55N2kOjxbRe/UlRpnbjGpuSSALDDRl0OAZtTn5urH6Ho9/myHNZwt24vspwddoM5eVw7r/Nub1ufNdqsVKaABzeW895bzN3xfpPNf1xI4KLQAmEDDucimtz6qXL1q+QDbsImAXgN+LyQshzCqHAKQR2I+MtA9vJNzWxLTPfU88hAIcALII8R3+Bo9+K1++WJ+SlNTXeMs36IVTXTJbRPIegwL9BweqjqVdIrKehgUyRQPsIJlTy5ig0PO3tNy6xyTad55gucHKzyi5xOAVgcwrAFVeb/BuZhps3qvc/c069m0hr8CZjDqcp2pymaKS8zpWZirq0LvR/r0PZLgE36wAWzoI2kLYTch2OS2xzJhSu2ITCknTqs1BpsrQqYSUn5qwLpZjPqMyjdLWBCluZE1raMvVNiPU5RHHRMe9i4r3eh/fensjKsWYC2fdSavVoNdQiwSVTU6d+HSsbsl2rqbXhOZwKaXMqpMuvkKJEQ/6AvhVBXWtzIQt8g6Ze/cGGoNoriEypDVfr4nSkLqZcrY/cIu7KVtmvlCoGdRNE9HL7vMpflXBDqVyhdSEV46OzruKKzIUqZ2WOccNLJRG3Mqft1mksAzfw1Y39r0WNZtWzYj1tz1zENh2OUZtj1BWquuq5iq44Do8DFfi4jSVCQfsHCIAACIAAzm4Asdc63lfoaMSxSV8AAK/48jGg4V6tMtIbEBrIFu2/EtiMzj4T8Ix89a3eezj8rkb9CgZEAK50e4ElH/v4h0uzlIl3bQNmdf9Vm34VAyJtoKkWwC48Vjr84Qrk5s1rveCasiTFkwtmLpjZPD8dgIqBaAncYJrwXhozEnFr/1gAhnlq69DxmvdrAAAnfjKcpGfFVbsAGH1z70mWq9dAtBFPGW/gi2tbRiLqJg+h/mvV0HH1+QBgeJM2rfOTPDDl5oMA0HhE4H7rNRAtgQc9YIzxwEjEt7z6Hm/kl2x4Brx69MBYP5ykpbu+B0B9d8OqWO07AANNJuAVO7wh+55RPcEwPAPwhjV5Q8a8E6cMDwAMNMIsAjBR7PCwiAOw+L0mx5tregB2zTGKpU7AHTMbALB79ki7KQ597h60AOCid/00gLEzP/Xt837BVP/6l3U1+kfPvSYKcO3e8VWdk5EDALQHmlj4+osPlb60R1O5gDdw7h8ZVjc/oLHffeaGcC/U0TpwfFbzOTNErmbp98OYybNm9RZvjJ74gU79uOuX4RK4aGKb0JUBwn28VNfOCVeXbSs0TyHsIMCqrh06c7+u56HpLFdYY/j5nEA3OlAteN0SAAdcY/ZfrL1LtnFTTV9zdLQncSeC48DgQcHrDlzYj/Obpx9ausfqndXewUuFMf9jALGQ8/oLLd0XlI4Of/CZuvHtnKReemlP5mrmA3jDe39N3CQuBUDug/GzXkaDfzgVrfN663uQ07k088S0uaVvVwO3/OnwWkF/wGvem9QujVMnN4Z72Z2w16xfqk//pnxglMX8+ZM679Hh0AAwLl1ew4guvHLbB9r0/2hBJOpTOP8mLS6l1XdrDfvM9+tnWnr0v7iAFbvgRZESMP4M8H+IyqGtv3ECL4u3ptbw21iKoSnirtmFmF7Cr0IdlstfsG3DOWOfLjs+UvXi56aMHB6+zKwOXroaavpDBuxCYhXqW9BXV1c3oSzUDR/X1U2YcPLvI1PBZQPrXq1pHFjaORz1t/7u2kD45ljpceDVOAOvRdP3yTj1ZWGuWz2uDYDlNp4+tXKd8HV/GMc5cRqoAga9q2IN7Oz1pwoDfhW6JhXAhdV9ueFZ3yW5Tq0zqFQGSgDr1n/DiI6gU4AjwD965/oNYPbxE4GJUY/ln+l58DwAOJoDPgs8u2FiyM6zG2JlPHddgoHffX4jAKCUzcYNLTcFGrH70vGhL28CVwxfPxQ30P2r0vH1xy7bF5h119n3PzT0baXZDrwJXA7sAYq1R6YEFcbrR22SgcFgDhuGJ1slgO9tKdWxLuDX4RmE0Vz61l0bzB5Gu9+Ltaweuuw3Q3du2aNSFeehhUkGFj28nj2AhUbibQyXLPd2yf25/+j48PSzuffJoRlX484ZCjV/UrKBhviBbPW+vVwnq+pyf6wY1zYjcH4brrvfvxNG084yV23hsw/KAOSTDZwXuqQoMZXwe7Dj0bnzwacu9udd+xVKoJhsoD/9XGi4njPm+M2en8HuogJAf7KBhQqTuRjn5MCw6zs36PkoODQcAxzhAgBtg/y0e7HZHyE7FWRWJxvYwfEDRPyBU35n3RjxgZe0+hmcbmxLDzA+2UBd+iqU21X6MvGjq8K8B059u/TtzXL9TVvkANxkA53pASZ9pDTOP/F8wzPhEh5oLHnigZH3GckSOJZsQAEA+/0urMd7MnRq4dTSl8XTVJrq15IN3JseoKvD99QmG6ut3MiJedY5NZv87i7gADzVKkmwPcnAbxV84kk4enfp68rHT7WNGNg5Dc/5Y1wrlMLyJANLlZz61mF37/na2tN+eTTV7t7jx9dsV+zvfxZvYLvKsso+YO8Kv7t/C3s2XlJ1Hx4ZxNcvGU7yiQsPB9aVmmd9SRLg9ppFcQaWK64Lme1z/L4UH3rlyPap3lXXl82uLu/eozzkLrNjDCQ79UmTiUNdXylz1G6b2HB7WfZXdHVrmDRs4RvYqrywZbg1/36Md/KK/9RGZjApFne/+gLvzFZWF2pIAbhw6+7m3ObOdk0zt/sKv2dF7yjcq2NpEQefu/MdVvx3X6pTmQUFwi0/jca9vgwiS4sCXsFb4x7v6wr7y3c7dYdcIKcJ4Y47/OUJv/tcnnSJMEDbdiA32PzOwxtHlgaer6nuLK096grL8Vhh7NUAgDcG3hdYOJP6gQNj6u48efPY+kdOo2pd7+ZDDVWj8NSp5INI/m9kQoUAYMYBoO+uIsZ44+745zFYbAJv86cxyiG0Ol3dZondzBbmRD4ULO+NxaMNkA/2QtMv1VkZ3LVbm0NRm3QDdA0PUUOfN+6ZuTM3XaAzKj9oYrsP042a74TXRl9bqRkg9Es9MO0kGgFMV8x3P9BRnDgv6lK+vFar/i2LwwCYWazJKf9RCCy4g/3NLPdDK8ELn0QEAOu7i0o/UAOA4RlGVQv73I+LqzXJb7mpfJqGbAd69JgACIAACEAp/HcAV2du9LEwew0AAAAASUVORK5CYII=');background-repeat:no-repeat;background-size:96px 192px;}"+
            '#FF .FF-square{background-position-y:0px}#FF .FF-circle{background-position-y:-32px}#FF .FF-play{background-position-y:-64px}#FF .FF-pause{background-position-y:-96px}'+
            '#FF .FF-gray{background-position-x:0px;}#FF .FF-green{background-position-x:-32px}#FF .FF-red{background-position-x:-64px}#FF .FF-white{background-position-x:-100px}'+
            '#FF .FF-green-cam{width:48px;background-position-x:-48px;background-position-y:-160px;}#FF .FF-black-cam{width:48px;background-position-x:0px;background-position-y:-160px;}'+
            '#FF .FF-oc{background-position-y:-128px;width:12px;}#FF .FF-close-gray{background-position-x:0}#FF .FF-close-green{background-position-x:-12px}#FF .FF-close-red{background-position-x:-24px}#FF .FF-open-gray{background-position-x:-36px}#FF .FF-open-green{background-position-x:-48px}#FF .FF-open-red{background-position-x:-60px}'+
            '#FF .FF-del{width:48px;background-position-x:-72px;background-position-y:-128px;}'
        +'</style>');

    if(!$('#FF').length)
        $('body').prepend('<div id="FF" style="border-top-left-radius:16px;border-bottom-left-radius:16px;border:1px solid #DDD;transform-origin: right top 0px;position:fixed; right:6px; top:0px;width:200px; height:32px; color:black; font-family: Arial, Helvetica, sans-serif;background-color:rgba(255,255,255,0.8); z-index:1000000000;">'+
            '<div class="FF-action FF-ico FF-circle" id="FF_record" title="page not saved" style="margin-right:32px;margin-left:4px;'+bdivstyle+'"></div>'+
            '<div class="FF-action FF-ico FF-black-cam" title="click to manually index text currently on this page" id="FF_snapshot" style="'+bdivstyle+'"></div>'+
            '<div class="FF-action FF-ico FF-pause FF-gray" id="FF_pause" title="click to pause auto recording in all tabs" style="'+bdivstyle+'"></div>'+
            '<div class="FF-action FF-ico FF-del  FF-hidden2" id="FF_delete" title="click to delete this page from your database" style="'+bdivstyle+'"></div>'+
            '<div id="FF_collapse" class="FF-ico FF-oc FF-close-green" title="expand/collapse this infobox" style="cursor:pointer;position:absolute;right:0px;top:0px;"></div>'+
        '</div>');

    
    var box=$('#FF'),
        a=$('#FF_collapse'),
        buttons=$('.FF-action'),
        rec= $('#FF_record'),
        pause= $('#FF_pause'),
        snap=$('#FF_snapshot'),
        del=$('#FF_delete');

    settings.zoom=0.75;
    if(settings.zoom || settings.zoom != 1 )
        box.css('transform','scale('+settings.zoom+')');

    snap.click(function(){
        rec.removeClass('FF-green FF-white').addClass('FF-red')
        savepage(function(success){
            if(success)
                del.removeClass('FF-hidden2');
        });
    });

    del.click(function(){
      var url=document.location.href;
      postdata(sdelete, 
          {furl:url},
          {
              success: "Page successfully deleted",
              fail:    "Failed to delete page from server"
          },
          function(success, data) {
              if (success && data.deleted)
                  del.hide();
              else
                update_status({
                    color:'red',
                    blink:true, 
                    msg: 'Failed to delete page'
                });   
              
          }
      );
    });

    var ccol='green';
    if (settings.manualOnly) {
        //pause.html('&#x23f5');
        pause.addClass('paused FF-play').removeClass('FF-pause');
        //rec.html('&#x23f9'); 
        update_status({
            color:'red',
            blink:false, 
            msg: 'Auto recording paused.  To add this page, click camera icon, or click play icon and reload page',
            shape: 'square'
        });   
        pause.attr('title','click to enable auto-recording in all tabs');
        ccol='gray';
        a.removeClass('FF-close-green').addClass('FF-close-gray');
    }
    
    pause.click(function(){
        if (pause.hasClass('paused')){
            pause.removeClass('paused FF-play').addClass('FF-pause');;
            //pause.html('&#x23f8;');
            browser.storage.local.set({manualOnly:false});
            settings.manualOnly=false;
            //rec.html('&#x23fa;');
            rec.removeClass('FF-square').addClass('FF-circle');
            if (rec.hasClass('FF-green'))
                rec.attr('title','page saved');
            else
                rec.attr('title','page text not saved, click camera icon or reload page to save');

            pause.attr('title','click to pause auto recording in all tabs');
            ccol='green';
        } else {
            pause.addClass('paused FF-play').removeClass('FF-pause');
            //pause.html('&#x23f5;');
            browser.storage.local.set({manualOnly:true});
            settings.manualOnly=true;
            //rec.html('&#x25cc');
            //rec.html('&#x23f9;')
            rec.addClass('FF-square FF-red').removeClass('FF-circle');
            if (!rec.hasClass('FF-green'))
                rec.attr('title','Auto recording paused.  To add this page, click camera icon, or click play icon and reload page');
            else
                rec.attr('title','Auto recording paused.  Page text has already been saved.');

            rec.removeClass('FF-red FF-white');
            pause.attr('title','click to enable auto recording in all tabs');
            ccol='gray';
        }
        a.removeClass('FF-close-gray FF-close-green').addClass('FF-close-'+ccol);
    });
    
    function setCollapse(state,save) {
        a.removeClass('FF-open-gray FF-open-red FF-open-green FF-close-gray FF-close-red FF-close-green');
        if (!state) {
            //a.html('&#x2771;');
            a.addClass('FF-close-'+ccol);
            box.css('width','200px');
            box.removeClass('FF_collapsed');
            if(save) browser.storage.local.set({ibcollapsed:false});
            buttons.removeClass('FF-hidden');            
        } else {
            //a.html('&#x2770;');    
            a.addClass('FF-open-'+ccol);
            box.css('width','16px');
            box.addClass('FF_collapsed');
            if(save) browser.storage.local.set({ibcollapsed:true});
            buttons.addClass('FF-hidden');
        }
    }
    
    
    setCollapse(settings.ibcollapsed);

    a.click(function() {
        if (box.hasClass('FF_collapsed') )
            setCollapse(false,true);
        else
            setCollapse(true,true);
    });

    if(!excluded && !settings.manualOnly) {
        update_status({
            color:'green',
            blink:true,
            message:"saving to server"
        });
    }

    if(excluded) {
        //rec.html('&#x26D2;');
        pause.hide();
        rec.addClass('FF-square').removeClass('FF-circle');
        rec.attr('title','Page excluded from auto recording based on your settings');
        ccol='gray';
        if (box.hasClass('FF_collapsed') )
            setCollapse(true);
        else
            setCollapse(false);
    }
}
/*
{
        title:p.title,
        user:settings.user,
        furl:p.url,
        label:label,
        dom:'facebook.com',
        img: image,
        text:p.title + ' ' + p.txt
}
*/

/* update the circle/square color, flashing, title text an shape
   in the infobox 
   flashing = in progress
   green    = ok
   red      = error
   gray     = inactive
   white    = blank spot for flashing

   obj = {
       color: [red|green|gray|white]
       blink: [true|false]
       msg:   <title text string>
       shape: 
           undefined = no change
           'circle'  = circle
           'square'  = square
   }
*/
var ivl=null;
var blinking=false;

function update_status (obj) {
    var rec=$('#FF_record'), infobox=$('#FF');
    var colorclass = "FF-" + obj.color;
    var opencloseclass = settings.manualOnly ? "FF-close-gray":"FF-close-"+obj.color;
    var ib_openclose = $('#FF_collapse');

    if(obj.shape == 'circle')
        rec.removeClass('FF-square').addClass('FF-circle');
    else if(obj.shape === 'square')
        rec.removeClass('FF-circle').addClass('FF-square');

    if(!obj.color)
        return;

    if(ivl) {
        clearInterval(ivl);
        ivl=null;
    }

    if(obj.msg)
        rec.attr("title", obj.msg);

    if(infobox.hasClass('FF_collapsed'))
        opencloseclass = "FF-open-" + obj.color;

    ib_openclose.removeClass('FF-open-gray FF-open-red FF-open-green FF-close-gray FF-close-red FF-close-green')
        .addClass(opencloseclass);

    rec.removeClass('FF-white FF-green FF-gray FF-red');
    rec.addClass(colorclass);

    if(!obj.blink || colorclass=='FF-white') {
        blinking=false;
        return;
    }

    //make circle/square icon blink on/off
    blinking=true;

    ivl =setInterval(function(){
            //exit blinking if update_status called again with blink!=true.
            if( !blinking ) {
                clearInterval(ivl);
                ivl=null;
                return;
            }
            // toggle classes to make icons blink on/off
            rec.toggleClass(colorclass + ' FF-white');
            ib_openclose.toggleClass(opencloseclass + ' FF-white');
        },500
    );
}

//get subtitles url from background.js
var ytsubs;
var ytv;

function get_youtube_captions(cb) {
    if(ytsubs) {
        try {
            fetch(ytsubs).then(function(resp){
                return resp.json();
            }).then(function(data) {
                let d="", events=data.events;
                //console.log("THE DATA FROM YTSUBS:", data);
                for (var evn in events) {
                    const ev=events[evn];
                    for (var segn in ev.segs) {
                        const seg=ev.segs[segn];
                        let txt=seg.utf8;
                        //console.log(txt);
                        d+=txt + " ";
                    }
                }
                d=d.replace(/\S+/,' ');
                cb(d);
            }).catch(function(e){
                cb(false,e);
            });
        } catch(e) {
            //console.log("failed to grab youtube captions",e);
            cb(false,e);
        }
        return;
    }
    //console.log("no subtitles loaded");
    cb(false, new Error("No captions loaded")); // ytsubs undefined
}

if(window.location.hostname=='www.youtube.com') {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        //console.log("UNFILTERED MESSAGE:", message);
        if( window.location.pathname=='/watch') {
            let params = new URLSearchParams(window.location.search);
            ytv = params.get('v');
            if (ytv && message.type === "yt-subs" && message.v==ytv ) {
                //console.log("Intercepted AJAX URL:", message);
                ytsubs=message.req?.url;
                //console.log("YTSUBS URL:",ytsubs);
            }
        }
    });
}


function savecb(sobj,callback){
 
    if (!sobj.img) sobj.img='';
 
    postdata(sstore, sobj,
        {
            success: "Page successfully saved just now",
            fail:    "Failed to save page to server"
        },
        function(success, data) {
            if(data.status!='ok')
                update_status({
                    color:'red',
                    flash: true, 
                    msg: data.status
                });
            if(callback) callback(success, data);
        }
    );
}


/* save a generic page text to server */
function savepage (callback){
    //var label=settings.label?settings.label:'';
    var url=document.location.href;
    var metatext;
    var htmlEls = document.getElementsByTagName('html');
    var mainHtml, i, maxlen=-1;
    var sobj={};

    sobj.furl=url;

    // if more than one <html> block, get longest.
    for (i=0;i<htmlEls.length;i++) {
        let el=htmlEls[i], len=el.innerText.length;
        if(len>maxlen) {
            maxlen=len;
            mainHtml=$(el);
        }
    }

    sobj.title=mainHtml.find('head').find('title').eq(0).text();
    sobj.text=mainHtml[0].innerText;
    // Get iframe contents as well
    $('iframe').each(function(){
        //console.log($(this).contents());
        let cont=$(this).contents().find('body');
        if (cont.length && cont[0].innerText)
            sobj.text=sobj.text+' '+cont[0].innerText;
    });

    mainHtml.find('head').find('meta').each(function(){
        var t=$(this),n=t.attr('name'),c=t.attr('content'),p=t.attr('property');
        if (c) {
           if (!metatext && /description/.test(n))
               metatext=c;

           if (!sobj.img && ( /image/.test(n) || /image/.test(p) ) && /^http/.test(c)) 
               sobj.img=c;
        }
        if (metatext && sobj.img) return false;
    });
    
    if (metatext) sobj.text= metatext + ' ' + sobj.text;

    // youtube thumb
    if (/^https:\/\/www.youtube.com\/watch\?.*v=/.test(url) ) {

            //if(!sobj.img) {
                let id=url.match(/\?.*v=([^&]+)/);
                if (id.length>1) sobj.img='https://i.ytimg.com/vi/' + id[1] + '/hqdefault.jpg';
            //}

            // toggle the subtitles button if not on.  Triggers loading of subtitles.
            var stb=$('.ytp-subtitles-button');
            if(stb.attr('aria-pressed')=='false') {
                stb.click();
                stb.click();
                // wait 2 secs for message from background.js, then try to get subtitles.
                setTimeout(() => {
                    get_youtube_captions(function(ctxt,err){
                        if(ctxt)
                            sobj.text = sobj.text + ' ' + ctxt;

                        if(err)
                            console.log("Failed to get youtube captions", err);

                        savecb(sobj);
                    });
                }, 2000);
            } else {
                get_youtube_captions(function(ctxt,err){
                    if(ctxt)
                        sobj.text = sobj.text + ' ' + ctxt;

                    if(err)
                        console.log("Failed to get youtube captions", err);

                    savecb(sobj,callback);
                });
            }
            return;
    } 


    //for amazon
    if (/^https:\/\/www.amazon.com\//.test(url) ){
        var i=$('#main-image-container').find('img').attr('src');
        if (i && i!='')
            sobj.img=i;
    }

    savecb(sobj,callback);

}

function get_page_info(){
    var user=settings.user;
    var url=document.location.href;
    var skip=false;
    var site=window.location.hostname;
    var exclude=settings.exclude;
    var hcexclude={};
    var doms=[];
    var x=0;
    var ssite=site;

    if (!user || settings.disabled || document.contentType != 'text/html') return;

    /* get each subdomain (www.xyz.com, xyz.com, com) and check against excludes */ 
    while (x>-1) {
        var last='';
        x=ssite.lastIndexOf('.');
        if (doms.length) last='.' + doms[doms.length-1];
        doms.push(ssite.substring(x+1)+last);
        ssite=ssite.substring(0,x);
    } 


    for (var k in exclude) {
        if (/^--/.test(k)) {
            hcexclude[k]=hardcode[k];
            delete exclude[k];
        }
    }

    /* for file:// */
    if (/^file:\/\//.test(url)) {
        for (var k in exclude) {
            if (url.indexOf(k)==0) {
                skip=true;
                site=k;
                break;
            }
        }
    }

    if (!skip) 
        skip=checkexclude(exclude,doms)

    if (!skip) {
      for (var k in hcexclude) {
        var ex=hcexclude[k];
        if (typeof ex == 'object')
            skip=checkexclude(ex,doms);
        
        if (skip) break;
      }
    }

    if(!settings.hideInfobox) {
        infobox(skip);
    }

    // an object for facebook stuff
    settings.fb={};
    // the action "..." icon on each post
    settings.fb.action_selector='div[aria-label="Actions for this post"]';
    // how far up to go to get to whole post
    settings.fb.nparents_action_to_post = 5;    
    // a link to individual post page selector
    settings.fb.postpage_link_selector = 'a[target=_blank]';    
    // image server substring
    settings.fb.mainImage_regex = /https:\/\/scontent.*fbcdn.net/;
    // when we find the main content div, which elements contain text, and not junk.
    settings.fb.content_selector = '[dir="auto"]';

    var fb_focus_event = new Event("focusin", {bubbles:true } );    
    var fb_pointer_event = new Event("pointerover", {bubbles:true } );    
    var fb_pointerOut_event = new Event("pointerout", {bubbles:true } );    

    function getfb(ret) {
        var actions = $(settings.fb.action_selector);
        actions.each(function(){
            var t=$(this),
                post=t, i=0, atag, url, img;
            
            //if already processed, skip.
            if(t.hasClass("indexed"))
                return;
            
            t.addClass("indexed");

            // in case of ad blocker
            if(!t.is(':visible'))
                return;

            // traverse parents until we get all the text in the post.
            for (i=0;i<settings.fb.nparents_action_to_post;i++)
                post=post.parent();

            // the atag element that will contain post url after triggered with focusin
            // trigger to do the facebook magic.
            atag = post.find(settings.fb.postpage_link_selector);

            // if not a post, skip
            if(!atag.length)
                return;

            // trigger the focusin event and facebook callbacks that will populate the href of atag
            atag[0].dispatchEvent(fb_focus_event);
            atag[0].dispatchEvent(fb_pointer_event);
            // wait a time before trying to collect it.
            (function(a,p){
                setTimeout(function(){
                    var image, images = p.find('img');
                    var poster = p.find('strong').eq(0).text();
                    var contentd = p.children().eq(2), content;
                    // get the id of element containing date description
                    var id=a.parent().attr('aria-describedby');
                    // get the date
                    var datetxt=$('#'+id).text();
                    // if no date, probably not a post.
                    if(datetxt=='')
                        return;
                    // turn off
                    a[0].dispatchEvent(fb_pointerOut_event);

                    // find the content text, skip the junk.
                    contentd.find(settings.fb.content_selector).each(function(){
                        var t=$(this);
                        if(t.css('white-space')=='pre-wrap') {
                            if(!content) content=t.text();
                            else content = content + " " + t.text();
                        }
                    });
                    // find an appropriate image.
                    images.each(function(){
                        var im = $(this);
                        var src = im.attr('src');
                        //grab the first image that comes from user fb image servers
                        if (src && settings.fb.mainImage_regex.test(src)) {
                            image=im;
                            return false;
                        }
                    });

                    if(image) {
                        //console.log("Got image");
                        imgtob64(image.attr('src'),150,150, function (imgurl) {
                            postdata(sstore, {
                                    history: true,
                                    title:"facebook: " + poster+ " on " + datetxt,
                                    //user:settings.user,
                                    furl:a.eq(0).attr('href'),
                                    //dom: 'facebook.com',
                                    img: imgurl,
                                    text: "facebook: " + poster+ " on " + datetxt + " " + content
                                },
                                {
                                    success: "Page successfully saved",
                                    fail:    "Failed to save page to server"
                                }
                            );
                        });
                    } else {
                        postdata(sstore, {
                                history: true,
                                title:"facebook: " + poster+ " on " + datetxt,
                                //user:settings.user,
                                furl:a.eq(0).attr('href'),
                                //dom: 'facebook.com',
                                text: "facebook: " + poster+ " on " + datetxt + " " + content
                            },
                            {
                                success: "Page successfully saved",
                                fail:    "Failed to save page to server"
                            }
                        );
                    }
                    
                },750);
            })(atag,post);

        });

    }
    /*
    function gettw(){
        var posts = $('div[data-testid="cellInnerDiv"]');
        posts.each(function(i){
            var post=$(this);

            if(post.hasClass('indexed'))
                return;
            post.addClass('indexed');

            (function(t){
                var timediv = t.find('time');
                var time=new Date(timediv.attr('datetime')).toLocaleString(navigator.languages[0], { weekday:"long", year:"numeric", month:"short", day:"numeric" , hour:"numeric", minute:"numeric"});
                var alink = timediv.closest('a');
                var turl = alink.attr('href');
                var text = t[0].innerText;
                var namediv=t.find('div[data-testid="User-Names"]').children().eq(0);
                var name=namediv.text();
                var img='', images=t.find('img');
                if(!turl || turl=='') {
                    console.log("error getting post url for "+name+" on "+ time);
                    return;
                }
                turl = "https://twitter.com"+turl;

                images.each(function(j){
                    var im=images.eq(j);
                    if(/twimg.com\/media/i.test(im.attr('src'))) {
                        img=im.attr('src');
                        return false;
                    }
                });

                console.log("Twitter: " + name + " on " + time, turl, img, text);
                if(img !='') {
                    console.log("Got image");
                    imgtob64(img,150,150, function (imgurl) {
                        postdata(sstore, {
                                title: "twitter: " + name + " on " + time,
                                user:settings.user,
                                furl:turl,
                                dom: 'twitter.com',
                                img: imgurl,
                                text: "twitter: " + name + " on " + time + " " + text
                            },
                            {
                                success: "Page successfully saved",
                                fail:    "Failed to save page to server"
                            }
                        );
                    });
                } else {
                    postdata(sstore, {
                            title: "twitter: " + name + " on " + time,
                            user:settings.user,
                            furl:turl,
                            dom: 'twitter.com',
                            text: "twitter: " + name + " on " + time + " " + text
                        },
                        {
                            success: "Page successfully saved",
                            fail:    "Failed to save page to server"
                        }
                    );
                }
            })(post);
        });

        console.log(posts);
    }
    */

    // an object for bluesky stuff
    settings.bs={};
    // the action "..." icon on each post
    settings.bs.first_selector='div[data-testid="followingFeedPage-feed-flatlist"]';
    // image server substring
    settings.bs.mainImage_selector = 'div[data-expoimage="true"]';

    function getbs(ret) {
        var posts = $(settings.bs.first_selector)
                    .children('div').children('div').children('div')
                    .filter(function(){return $(this).children().length});
        posts.each(function(){
            var t=$(this),
                post, pdate=(new Date).toString(), poster="Bluesky Post", url, img;
            
            //if already processed, skip.
            if(t.hasClass("indexed"))
                return;
            
            t.addClass("indexed");

            // in case of ad blocker
            if(!t.is(':visible'))
                return;

            post = t[0].innerText;

            t.find('a').each(function(){
                if(/\/post\//.test(this.href)) {
                    url=this.href;
                    return false;
                }
            });

            pdate=t.find('a[data-tooltip]').eq(0).attr('data-tooltip');

            t.find('a').each(function(){
                if(/\/profile\//.test(this.href)) {
                    poster=this.text;
                    return false;
                }
            });

            img=t.find('div[data-expoimage="true"]').find('img').eq(0).attr('src');
            var title = "bluesky: " + poster+" on "+pdate;
            var sobj = {
                history: true,
                furl:  url, 
                title: title,
                text:  title + "\n" + post,
                img:   img
            }

            if(url && post && post.length)
                savecb(sobj);
            else
                console.log("Failed to collect bluesky post data",sobj);
        });

    }


    var grabpage=true; //set false if we are getting individual posts from facebook or wherever

    if ( /^https:\/\/www.facebook.com\//i.test(url)) {
        var posts={},iiv;
        setInterval(getfb,5000);
        grabpage=false;
    /*} else if (/^https:\/\/twitter.com\//i.test(url)) {
        console.log("Got twitter");
        grabpage=false;
        setTimeout(gettw,5000);*/
    } else if (/^https:\/\/bsky.app\/$/i.test(url)) {
        grabpage=false;
        setInterval(getbs,5000);
    }

    if(grabpage) {

        //FIXME: redundant in savepage()
        var htmlEls = document.getElementsByTagName('html');
        var mainHtml,title, i, maxlen=-1;
        var sobj={};
        for (i=0;i<htmlEls.length;i++) {
            let el=htmlEls[i], len=el.innerText.length;
            if(len>maxlen) {
                maxlen=len;
                mainHtml=$(el);
            }
        }
        title=mainHtml.find('head').find('title').eq(0).text();

        postdata(
            scheck, 
            {furl:url, title:title, skip:skip},
            {
                success: "Page status updated",
                fail:    "Failed to get page status from server"
            },
            function(success, data) {
                if (!data.saved) {
                    if (!skip)
                        setTimeout( function() {
                            if (!settings.manualOnly)
                                savepage(function(){
                                });
                        } ,5000);
                    else console.log("skipping content from "+ site);
                } else {
                    let d= new Date(0);
        			d.setUTCSeconds(parseInt(data.last));

                    update_status({
                        color:'green',
                        flash: false, 
                        msg:'page text was saved on ' + d.toLocaleString() + '. To update, click camera icon. To delete from your database, click the ✘ icon',
                        shape:'circle'
                    });
                    $('#FF_delete').removeClass('FF-hidden2');
                }
            }
      );
/*
        $.post(scheck,{
                user:user,
                furl:url,
            }, function(data) {
                if(data.error) {
                    update_status({
                        color:'red',
                        flash:false,
                        msg: "error getting data from server: " + data.error
                    });
                } else if (!data.saved) {
                    if (!skip)
                        setTimeout( function() {
                            if (!settings.manualOnly)
                                savepage();
                        } ,5000);
                    else console.log("skipping content from "+ site);
                } else {
                    update_status({
                        color:'green',
                        flash: false, 
                        msg:'page text was saved on '+ data.date+'. To update, click camera icon. To delete from your database, click the ✘ icon',
                        shape:'circle'
                    });
                    $('#FF_delete').removeClass('FF-hidden2');
                }
            }
        );
*/
    }
}


$(document).ready(function() {
   let lastUrl = location.href;

   if (window.safari && window.top != window) {
       return;
   } 
   
   start(get_page_info);

   setInterval(() => {
       if (location.href !== lastUrl) {
           lastUrl = location.href;
           get_page_info();
      }
    }, 1000);


});

