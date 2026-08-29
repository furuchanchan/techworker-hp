(function(){
  var copy=document.getElementById('copyLink');
  if(!copy)return;
  function reset(label){
    copy.textContent=label;
    setTimeout(function(){copy.textContent='Link';},1600);
  }
  function legacyCopy(){
    var field=document.createElement('textarea');
    field.value=location.href;
    field.setAttribute('readonly','');
    field.style.position='fixed';
    field.style.opacity='0';
    document.body.appendChild(field);
    field.select();
    try{
      reset(document.execCommand('copy')?'Copied':'Copy failed');
    }catch(error){
      reset('Copy failed');
    }
    field.remove();
  }
  copy.addEventListener('click',function(){
    if(!navigator.clipboard||!navigator.clipboard.writeText){
      legacyCopy();
      return;
    }
    navigator.clipboard.writeText(location.href).then(function(){
      reset('Copied');
    }).catch(legacyCopy);
  });
})();
