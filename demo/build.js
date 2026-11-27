// Demo sahifasini yig'adi: index.html + core.js + mock.js -> bitta fayl
const fs=require('fs'),path=require('path'),R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=R('public/index.html'),core=R('core.js'),kit=R('public/htmlkit.js'),qim=R('public/qimport.js'),i18n=R('public/i18n.js'),mock=R('demo/mock.js');
let seed='null';try{seed=JSON.stringify(JSON.parse(R('demo/seed.zemstark.json'))).replace(/</g,'\\u003c')}catch(e){}
const cut=(a,b)=>html.split(a)[1].split(b)[0];
const out=cut('<!--HEAD-->','<!--/HEAD-->').replace(/<!--PWA-->[\s\S]*?<!--\/PWA-->/,'').trim()+'\n'+cut('<!--BODY-->','<!--/BODY-->').replace(/<!--I18N-->[\s\S]*?<!--\/I18N-->/,()=>`<script>\n${i18n}\n</script>`).replace(/<!--CORE-->[\s\S]*?<!--\/CORE-->/,()=>`<script>\n${core}\n</script>\n<script>\n${kit}\n</script>\n<script>\n${qim}\n</script>\n<script>window.ZEM_SEED=${seed};</script>\n<script>\n${mock}\n</script>`).trim()+'\n';
fs.writeFileSync(process.argv[2]||path.join(__dirname,'zemstark-demo.html'),out);console.log('demo built',out.length);
