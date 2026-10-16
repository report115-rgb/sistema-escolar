const millis=v=>v?.toMillis?v.toMillis():new Date(v).getTime();
export function isMaintenanceActive(window,now=Date.now()){return !!window&&window.enabled===true&&millis(window.startAt)<=now&&(window.endAt==null||millis(window.endAt)>now);}
export function publicMaintenance(data,id,now=Date.now()){if(id==='own')return null;const window=[data?.global,data?.institutions?.[id]].find(w=>isMaintenanceActive(w,now));return window?{message:window.message,endAt:window.endAt==null?null:new Date(millis(window.endAt)).toISOString()}:null;}
