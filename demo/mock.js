/* Demo: brauzer ichidagi soxta server. Haqiqiy server.js o'rniga core.js'ni bevosita chaqiradi. */
(function(){
'use strict';
const C=window.ZemCore,KEY='zemstark-demo-v2';
let st=null;try{st=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
const db=(st&&st.db)||C.emptyDb();let uid=(st&&st.uid)||null;const blobs={};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({db,uid}))}catch(e){}};
const rnd=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,'0')).join('');
const PWCH='abcdefghjkmnpqrstuvwxyz23456789';
const tempPw=()=>[...crypto.getRandomValues(new Uint8Array(8))].map(b=>PWCH[b%PWCH.length]).join('');
const core=C.createCore(db,{id:()=>rnd(5),now:Date.now,save,fileOk:(f,u)=>!!db.files[f]&&(!u||db.files[f].uid===u),hash:p=>p,check:(p,h)=>p===h,tempPw,dropSessions:(id,keep)=>{if(!keep&&id===uid){}}});
window.ZEM_FILE_URL=fid=>blobs[fid]||'';
const pub=u=>core.self(u);
// O'qituvchi birinchi marta kirganda tayyor vazifa (window.ZEM_SEED) uning sinfiga joylanadi
function seed(u){
  const S=window.ZEM_SEED;if(!S||!u||u.role!=='teacher')return;
  db.seeded=db.seeded||{};const key=u.id+':'+(S.source||'seed');if(db.seeded[key])return;
  try{let c=db.classes.find(x=>x.owner===u.id);
    if(!c){const ci=core.route('POST','/classes',u,{name:'IELTS Listening',sec:'',level:'IELTS'});c=db.classes.find(x=>x.id===ci.id)}
    core.route('POST',`/classes/${c.id}/import`,u,S);db.seeded[key]=1;save()}catch(e){console.error(e)}
}
const E=(c,m)=>{throw new C.HttpErr(c,m)};
function auth(m,p,b,u){
  if(p==='/config')return{teacherCode:false,google:false,demo:true,ai:'sample',fetchAudio:false,telegram:false};
  if(p==='/me')return{user:u?pub(u):null};
  if(p==='/register'&&m==='POST'){const name=C.str(b.name,60),email=C.str(b.email,120).toLowerCase(),pw=String(b.password||'');
    if(!name)E(400,'Ism-familiyangizni kiriting');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))E(400,'Email manzil noto‘g‘ri');if(pw.length<6)E(400,'Parol kamida 6 belgidan iborat bo‘lsin');
    if(core.taken(email))E(409,'Bu email bilan hisob allaqachon bor');
    const x={id:rnd(5),name,email,role:b.role==='teacher'?'teacher':'student',pw,created:Date.now()};db.users.push(x);uid=x.id;save();seed(x);return pub(x)}
  if(p==='/login'&&m==='POST'){const x=core.findUser(C.str(b.email,120));if(!x||x.pw!==String(b.password||''))E(401,'Email/login yoki parol noto‘g‘ri');uid=x.id;save();seed(x);return pub(x)}
  if(p==='/logout'){uid=null;save();return{ok:1}}
  if(p==='/import/gform')E(400,'Demo rejimida havola orqali yuklab bo‘lmaydi — pastdagi “sahifa kodini joylang” usulidan foydalaning');
  if(p.startsWith('/telegram/'))E(400,'Demo rejimida Telegram ulanishi mavjud emas');
  if(p.startsWith('/google/'))E(400,'Demo rejimida Google ulanishi mavjud emas');
  if(p==='/fetch-audio'||p.startsWith('/ai/'))E(400,'Demo rejimida bu imkoniyat server orqali ishlamaydi');
  if(!u)E(401,'Tizimga kiring');
}
const real=window.fetch?window.fetch.bind(window):null;
window.fetch=async(url,o={})=>{
  url=String(url);if(!url.startsWith('/api/'))return real(url,o);
  const [path,qs]=url.slice(4).split('?'),q=new URLSearchParams(qs||''),m=(o.method||'GET').toUpperCase();let code=200,data;
  try{const u=db.users.find(x=>x.id===uid)||null;
    if(path==='/upload'){if(!u)E(401,'Tizimga kiring');const f=o.body;if(f.size>60*1024*1024)E(413,'Fayl hajmi 60 MB dan oshmasin');
      const type=String((o.headers||{})['Content-Type']||f.type||'').split(';')[0],fid=rnd(10);
      try{blobs[fid]=URL.createObjectURL(f)}catch(e){blobs[fid]=''}
      db.files[fid]={uid:u.id,name:q.get('name')||'fayl',type,size:f.size,at:Date.now()};save();data={fid,name:db.files[fid].name,type}}
    else{const b=o.body?JSON.parse(o.body):{};const a=auth(m,path,b,u);data=a!==undefined?a:core.route(m,path,u,b,q)}
  }catch(e){code=e.c||500;data={error:e.c?e.message:'Xato: '+e.message};if(!e.c)console.error(e)}
  return new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json'}});
};
})();
