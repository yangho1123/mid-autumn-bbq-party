const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
// On cloud hosts, point DATA_DIR to persistent storage (e.g. Render /var/data).
// Locally it falls back to the project directory.
const DATA_DIR = process.env.DATA_DIR || ROOT;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUBLIC = path.join(ROOT, 'public');

const DEFAULT_ITEMS = [
  { category: '器具', name: '烤肉架', quantity: 1 },
  { category: '器具', name: '烤網', quantity: 1 },
  { category: '器具', name: '木炭', quantity: 2, unit: '袋' },
  { category: '器具', name: '生火用品', quantity: 1 },
  { category: '器具', name: '夾子', quantity: 2 },
  { category: '器具', name: '烤肉刷', quantity: 1 },
  { category: '器具', name: '鋁箔紙', quantity: 1, unit: '卷' },
  { category: '器具', name: '免洗餐具', quantity: 1, unit: '包' },
  { category: '器具', name: '垃圾袋', quantity: 1, unit: '捲' },
  { category: '器具', name: '濕紙巾／衛生紙', quantity: 2, unit: '包' },
  { category: '食材', name: '牛肉', quantity: 1, unit: '份' },
  { category: '食材', name: '豬肉', quantity: 1, unit: '份' },
  { category: '食材', name: '雞肉', quantity: 1, unit: '份' },
  { category: '食材', name: '香腸', quantity: 1, unit: '包' },
  { category: '食材', name: '培根', quantity: 1, unit: '包' },
  { category: '食材', name: '玉米', quantity: 1, unit: '包' },
  { category: '食材', name: '甜不辣／豆干', quantity: 1, unit: '份' },
  { category: '食材', name: '菇類', quantity: 1, unit: '份' },
  { category: '食材', name: '青椒／彩椒', quantity: 1, unit: '份' },
  { category: '食材', name: '吐司／麵包', quantity: 1, unit: '份' },
  { category: '食材', name: '烤肉醬', quantity: 1, unit: '瓶' },
  { category: '食材', name: '鹽／胡椒／調味料', quantity: 1, unit: '組' },
  { category: '飲料', name: '礦泉水', quantity: 1, unit: '箱' },
  { category: '飲料', name: '汽水／茶飲', quantity: 1, unit: '箱' },
  { category: '其他', name: '冰塊', quantity: 1, unit: '袋' },
  { category: '其他', name: '保冷袋／冰桶', quantity: 1 },
];

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ parties: [] }, null, 2));
}
function readData() {
  ensureData();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { parties: [] }; }
}
function writeData(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function id() { return crypto.randomUUID(); }
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw='';
    req.on('data', c => { raw += c; if (raw.length > 1000000) { req.destroy(); reject(new Error('too large')); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}
function cleanText(v, max=200) { return String(v ?? '').trim().slice(0,max); }
function cleanQty(v) { const n=Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 999) : 1; }

function createParty(input) {
  const name = cleanText(input.name, 80);
  const date = cleanText(input.date, 20);
  const time = cleanText(input.time, 20);
  const location = cleanText(input.location, 120);
  if (!name || !date || !time || !location) throw new Error('name/date/time/location 必填');
  const now = new Date().toISOString();
  return {
    id: id(), name, date, time, location, createdAt: now,
    items: DEFAULT_ITEMS.map(x => ({ id:id(), category:x.category, name:x.name, quantity:x.quantity, unit:x.unit||'', checked:false, checkedBy:'' })),
  };
}

function findParty(data, pid) { return data.parties.find(p => p.id === pid); }

async function api(req, res, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  try {
    const data = readData();
    if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, time: new Date().toISOString() });
    if (req.method === 'GET' && pathname === '/api/parties') return json(res, 200, data.parties.map(p => ({ id:p.id,name:p.name,date:p.date,time:p.time,location:p.location,progress: p.items.length ? Math.round(p.items.filter(i=>i.checked).length/p.items.length*100) : 0, itemCount:p.items.length })));
    if (req.method === 'POST' && pathname === '/api/parties') {
      const p = createParty(await body(req)); data.parties.unshift(p); writeData(data); return json(res,201,p);
    }
    if (parts[0] === 'api' && parts[1] === 'parties' && parts[2]) {
      const p=findParty(data,parts[2]); if(!p) return json(res,404,{error:'找不到烤肉會'});
      if (req.method === 'GET') return json(res,200,p);
      if (req.method === 'PATCH' && parts[3] === 'items' && parts[4]) {
        const item=p.items.find(i=>i.id===parts[4]); if(!item) return json(res,404,{error:'找不到項目'});
        const input=await body(req);
        if (typeof input.checked === 'boolean') item.checked=input.checked;
        if (input.checkedBy !== undefined) item.checkedBy=cleanText(input.checkedBy,40);
        writeData(data); return json(res,200,item);
      }
      if (req.method === 'POST' && parts[3] === 'items') {
        const input=await body(req); const name=cleanText(input.name,80); if(!name) return json(res,400,{error:'項目名稱必填'});
        const item={id:id(),category: ['器具','食材','飲料','其他'].includes(input.category)?input.category:'其他',name,quantity:cleanQty(input.quantity),unit:cleanText(input.unit,20),checked:false,checkedBy:''};
        p.items.push(item); writeData(data); return json(res,201,item);
      }
      if (req.method === 'DELETE' && parts[3] === 'items' && parts[4]) {
        const idx=p.items.findIndex(i=>i.id===parts[4]); if(idx<0) return json(res,404,{error:'找不到項目'});
        p.items.splice(idx,1); writeData(data); return json(res,204,{});
      }
      if (req.method === 'DELETE' && parts.length===3) {
        data.parties=data.parties.filter(x=>x.id!==p.id); writeData(data); return json(res,204,{});
      }
    }
    return json(res,404,{error:'Not found'});
  } catch(e) { return json(res,400,{error:e.message || 'Bad request'}); }
}

const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if(u.pathname.startsWith('/api/')) return api(req,res,u.pathname);
  let pathname=decodeURIComponent(u.pathname); if(pathname==='/') pathname='/index.html';
  const file=path.normalize(path.join(PUBLIC,pathname));
  if(!file.startsWith(PUBLIC)) return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{ if(err) return res.writeHead(404).end('Not found'); res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'}); res.end(data); });
});
ensureData();
server.listen(PORT,HOST,()=>console.log(`BBQ Party app listening on ${HOST}:${PORT}`));
