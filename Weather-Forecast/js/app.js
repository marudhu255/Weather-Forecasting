const S={rows:[],data:[],model:null,min:0,max:1,forecast:[],ts:[],charts:{}},$=x=>document.getElementById(x);
function go(x){document.getElementById(x).scrollIntoView({behavior:'smooth'})}
function msg(t,c=''){ $('msg').innerHTML=t?'<div class="notice '+c+'">'+t+'</div>':'' }
function tab(x){$('csvPanel').style.display=x==='csv'?'block':'none';$('manPanel').style.display=x==='man'?'block':'none';$('csvTab').classList.toggle('active',x==='csv');$('manTab').classList.toggle('active',x==='man')}
for(let i=0;i<24;i++)$('manual').insertAdjacentHTML('beforeend','<tr><td>'+(i+1)+'</td><td><input id="mv'+i+'" type="number" step=".01" style="width:100%"></td></tr>');
function norm(s){return String(s??'').replace(/^\uFEFF/,'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')}
function parseCSV(text){
  text=String(text||'').replace(/^\uFEFF/,'').trim();
  if(!text)return [];
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],nx=text[i+1];
    if(ch==='"'){
      if(quoted&&nx==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(cell.trim());cell='';}
    else if((ch==='\\n'||ch==='\\r')&&!quoted){if(ch==='\\r'&&nx==='\\n')i++;row.push(cell.trim());cell='';if(row.some(v=>v!==''))rows.push(row);row=[];}
    else cell+=ch;
  }
  if(cell!==''||row.length){row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);}
  return rows;
}
function detect(h){
  const a=h.map(norm);
  const find=(exact,contains,exclude=[])=>{
    for(const n of exact){const i=a.indexOf(norm(n));if(i>=0)return h[i];}
    for(let i=0;i<a.length;i++){if(exclude.some(x=>a[i].includes(norm(x))))continue;if(contains.some(x=>a[i].includes(norm(x))))return h[i];}
    return null;
  };
  return{
    t:find(['Temperature','Temp','Air Temperature','Temperature C','Temperature F'],['temperature','temp'],['dewpoint','feelslike','windchill','heatindex']),
    h:find(['Relative Humidity','Humidity','RH'],['humidity','relativehumidity']),
    p:find(['Pressure','Air Pressure','Atmospheric Pressure'],['pressure','barometric']),
    w:find(['Wind Speed','WindSpeed','Wind','WS'],['windspeed','wind']),
    d:find(['Datetime','Timestamp','Date Time','Date','Time'],['datetime','timestamp','date','time'])
  };
}
function num(v){const x=parseFloat(String(v??'').replace(/,/g,'').replace(/[^\d.+-eE]/g,''));return Number.isFinite(x)?x:null;}
function csv(text){
  const lines=parseCSV(text);if(lines.length<2)throw Error('CSV is empty or has no data rows.');
  const h=lines[0].map(x=>x.trim()),d=detect(h),ti=d.t?h.indexOf(d.t):-1;
  if(ti<0)throw Error('Temperature column not found. Your column name can contain words such as Temperature, Temp, Air Temperature or temperature_C.');
  const hi=d.h?h.indexOf(d.h):-1,pi=d.p?h.indexOf(d.p):-1,wi=d.w?h.indexOf(d.w):-1,di=d.d?h.indexOf(d.d):-1;let out=[];
  for(let i=1;i<lines.length;i++){const row=lines[i],v=num(row[ti]);if(v!==null){let date=di>=0&&row[di]?new Date(row[di]):null;if(date&&isNaN(date.getTime()))date=null;out.push({temp:v,hum:hi>=0?num(row[hi]):null,press:pi>=0?num(row[pi]):null,wind:wi>=0?num(row[wi]):null,date:date});}}
  if(out.length<25)throw Error('At least 25 valid temperature observations are required. A larger dataset is recommended.');
  const hasDates=out.some(r=>r.date instanceof Date&&!isNaN(r.date.getTime()));if(hasDates)out.sort((a,b)=>(a.date?.getTime()||0)-(b.date?.getTime()||0));
  S.data=out;S.rows=lines;S.ts=out.map((r,i)=>r.date&&!isNaN(r.date.getTime())?r.date:new Date(2000,0,1,i));render();$('train').disabled=false;msg('Dataset loaded successfully. Detected temperature column: <b>'+d.t+'</b>. Train the LSTM to generate predictions.','ok');
}
function render(){let d=S.data;$('mrecords').textContent=d.length;$('mtemp').textContent=d.at(-1).temp.toFixed(2);$('mhum').textContent=Number.isFinite(d.at(-1).hum)?d.at(-1).hum.toFixed(2):'—';$('mpress').textContent=Number.isFinite(d.at(-1).press)?d.at(-1).press.toFixed(2):'—';$('mwind').textContent=Number.isFinite(d.at(-1).wind)?d.at(-1).wind.toFixed(2):'—';let h=S.rows[0];$('info').innerHTML='<b>Records:</b> '+d.length+'<br><b>Target:</b> Temperature<br><b>Date:</b> '+(S.ts[0].toLocaleString())+' → '+S.ts.at(-1).toLocaleString();$('quality').innerHTML='<b>Valid temperature rows:</b> '+d.length+'<br><b>Skipped rows:</b> '+(S.rows.length-1-d.length);let dd=detect(h);$('cols').innerHTML='<b>Temperature:</b> '+(dd.t||'—')+'<br><b>Humidity:</b> '+(dd.h||'—')+'<br><b>Pressure:</b> '+(dd.p||'—')+'<br><b>Wind:</b> '+(dd.w||'—')+'<br><b>Date/Time:</b> '+(dd.d||'—');let hh='<table><tr>'+h.slice(0,10).map(x=>'<th>'+x+'</th>').join('')+'</tr>';S.rows.slice(1,21).forEach(r=>hh+='<tr>'+h.slice(0,10).map((_,i)=>'<td>'+(r[i]??'')+'</td>').join('')+'</tr>');$('preview').innerHTML=hh+'</table>';drawHistory()}
function scaler(a){let min=Math.min(...a),max=Math.max(...a),q=max-min||1;return{min,max,s:x=>(x-min)/q,inv:x=>x*q+min}}
function seq(a,sc){let X=[],Y=[];for(let i=24;i<a.length;i++){X.push(a.slice(i-24,i).map(v=>[sc.s(v)]));Y.push(sc.s(a[i]))}return{X,Y}}
function metrics(a,p){let n=Math.min(a.length,p.length),ma=0,se=0,m=a.slice(0,n).reduce((x,y)=>x+y,0)/n,ss=0;for(let i=0;i<n;i++){ma+=Math.abs(a[i]-p[i]);se+=(a[i]-p[i])**2;ss+=(a[i]-m)**2}return{mae:ma/n,rmse:Math.sqrt(se/n),r2:ss?1-se/ss:null}}
function bar(p,t){$('bar').style.width=p+'%';$('pt').textContent=t}
async function train(){try{$('train').disabled=true;bar(3,'Preparing chronological data...');let a=S.data.map(x=>x.temp),n=a.length,tr=Math.floor(n*.7),va=Math.floor(n*.9);if(tr<30||n-va<1)throw Error('Dataset is too small for a useful train/test split. Upload more historical data.');let sc=scaler(a.slice(0,tr));S.min=sc.min;S.max=sc.max;let A=seq(a.slice(0,tr),sc),all=seq(a,sc),model=tf.sequential();model.add(tf.layers.lstm({units:16,returnSequences:true,inputShape:[24,1]}));model.add(tf.layers.dropout({rate:.2}));model.add(tf.layers.lstm({units:8}));model.add(tf.layers.dropout({rate:.2}));model.add(tf.layers.dense({units:8,activation:'relu'}));model.add(tf.layers.dense({units:1}));model.compile({optimizer:tf.train.adam(.001),loss:'meanSquaredError',metrics:['mae']});S.model=model;bar(8,'Training LSTM in browser...');let xt=tf.tensor3d(A.X),yt=tf.tensor2d(A.Y,[A.Y.length,1]);let vaX=seq(a.slice(tr-24,va),sc),vx=tf.tensor3d(vaX.X),vy=tf.tensor2d(vaX.Y,[vaX.Y.length,1]);let hist=await model.fit(xt,yt,{epochs:Math.max(5,Math.min(100,+$('epochs').value||30)),batchSize:Math.max(4,+$('batch').value||32),shuffle:false,validationData:[vx,vy],callbacks:{onEpochEnd:(e)=>bar(10+e/(Math.max(5,+$('epochs').value||30))*55,'Training epoch '+(e+1))}});xt.dispose();yt.dispose();vx.dispose();vy.dispose();bar(70,'Evaluating test predictions...');let test=seq(a.slice(va-24),sc),pr=model.predict(tf.tensor3d(test.X)),pv=Array.from(await pr.data()).map(sc.inv);pr.dispose();let ac=test.Y.map(sc.inv),m=metrics(ac,pv);$('mae').textContent=m.mae.toFixed(3);$('rmse').textContent=m.rmse.toFixed(3);$('r2').textContent=m.r2===null?'N/A':m.r2.toFixed(4);drawLoss(hist);drawActual(ac,pv);bar(84,'Generating future forecast...');await future(Math.max(1,Math.min(72,+$('horizon').value||24)),sc);bar(100,'Forecast complete');$('status').textContent='● Trained Successfully';$('status').style.color='#159447';msg('LSTM training, evaluation and future forecasting completed from your uploaded dataset.','ok')}catch(e){console.error(e);$('status').textContent='● Training Failed';$('status').style.color='#c62828';msg(e.message,'err')}finally{$('train').disabled=false}}
async function future(h,sc){let v=S.data.slice(-24).map(x=>x.temp),o=[];for(let i=0;i<h;i++){let t=tf.tensor3d([v.slice(-24).map(x=>[sc.s(x)])]),p=S.model.predict(t),z=(await p.data())[0];t.dispose();p.dispose();let real=sc.inv(z);o.push(real);v.push(real)}S.forecast=o;$('mpred').textContent=o[0].toFixed(2);$('next').textContent=o[0].toFixed(2);$('fmin').textContent=Math.min(...o).toFixed(2);$('fmax').textContent=Math.max(...o).toFixed(2);let hh='<table><tr><th>Future Time</th><th>Temperature °C</th></tr>';o.forEach((x,i)=>{let d=new Date(S.ts.at(-1).getTime()+(i+1)*3600000);hh+='<tr><td>'+d.toLocaleString()+'</td><td>'+x.toFixed(2)+'</td></tr>'});$('ftable').innerHTML=hh+'</table>';drawFuture()}
function chart(id,cfg){if(S.charts[id])S.charts[id].destroy();S.charts[id]=new Chart($(id),cfg)}
function drawHistory(){let lab=S.ts.map(x=>x.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit'}));chart('tempChart',{type:'line',data:{labels:lab,datasets:[{label:'Temperature °C',data:S.data.map(x=>x.temp),tension:.2}]},options:{responsive:true}});let ds=[];for(let [k,n] of [['hum','Humidity'],['press','Pressure'],['wind','Wind Speed']])if(S.data.some(x=>Number.isFinite(x[k])))ds.push({label:n,data:S.data.map(x=>x[k])});chart('weatherChart',{type:'line',data:{labels:lab,datasets:ds},options:{responsive:true}})}
function drawLoss(h){chart('loss',{type:'line',data:{labels:h.history.loss.map((_,i)=>i+1),datasets:[{label:'Training Loss',data:h.history.loss},{label:'Validation Loss',data:h.history.val_loss}]},options:{responsive:true}})}
function drawActual(a,p){chart('actual',{type:'line',data:{labels:a.map((_,i)=>i+1),datasets:[{label:'Actual',data:a},{label:'Predicted',data:p}]},options:{responsive:true}})}
function drawFuture(){let l=S.forecast.map((_,i)=>new Date(S.ts.at(-1).getTime()+(i+1)*3600000).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit'}));chart('future',{type:'line',data:{labels:l,datasets:[{label:'Future Temperature °C',data:S.forecast,tension:.25,borderWidth:3}]},options:{responsive:true}})}
function manualLoad(){let a=[];for(let i=0;i<24;i++){let v=parseFloat($('mv'+i).value);if(!Number.isFinite(v))return msg('Enter all 24 temperature values.','err');a.push(v)}S.data=a.map((temp,i)=>({temp,date:new Date(Date.now()-(23-i)*3600000),hum:null,press:null,wind:null}));S.ts=S.data.map(x=>x.date);$('train').disabled=true;msg('Manual mode has 24 observations, which is enough for one input window but not enough for a useful train/test evaluation. Use a larger CSV dataset for training.','err');render()}
function download(){if(!S.forecast.length)return msg('Generate a forecast first.','err');let s='Future Timestamp,Forecast Temperature C\n';S.forecast.forEach((x,i)=>s+=new Date(S.ts.at(-1).getTime()+(i+1)*3600000).toISOString()+','+x+'\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));a.download='weather_future_forecast.csv';a.click()}
$('file').onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{csv(r.result)}catch(x){msg(x.message,'err')}};r.readAsText(f)}
$('drop').ondragover=e=>{e.preventDefault()};$('drop').ondrop=e=>{e.preventDefault();let f=e.dataTransfer.files[0];if(f){let r=new FileReader();r.onload=()=>{try{csv(r.result)}catch(x){msg(x.message,'err')}};r.readAsText(f)}}
