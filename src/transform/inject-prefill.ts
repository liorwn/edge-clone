import * as cheerio from 'cheerio'

const PREFILL_SCRIPT = `
<script>
(function(){
  var p=new URLSearchParams(window.location.search);
  var m={
    email:['input[type="email"]','[name="email"]','#email','[data-testid*="email"]'],
    fname:['input[placeholder*="First"]','[name="firstName"]','[name="fname"]','#firstName','#fname'],
    lname:['input[placeholder*="Last"]','[name="lastName"]','[name="lname"]','#lastName','#lname'],
    firstName:['input[placeholder*="First"]','[name="firstName"]','#firstName'],
    lastName:['input[placeholder*="Last"]','[name="lastName"]','#lastName'],
    phone:['input[type="tel"]','[name="phone"]','#phone']
  };
  Object.keys(m).forEach(function(k){
    var v=p.get(k);if(!v)return;
    m[k].forEach(function(s){
      try{document.querySelectorAll(s).forEach(function(el){
        if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){
          el.value=v;
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
      })}catch(e){}
    });
  });
})();
</script>`

export function injectPrefill(html: string): string {
  const $ = cheerio.load(html, { decodeEntities: false } as any)
  if ($('body').length) {
    $('body').append(PREFILL_SCRIPT)
  } else {
    // Frameset or other non-body HTML — append to html root
    $('html').append(PREFILL_SCRIPT)
  }
  return $.html()
}
