'use strict';
const STORE='mini_ledger_data_v1';
const PALETTE=['#7866E8','#F1A66E','#57B5A5','#73A6E9','#E18DAE','#B79BE6','#A9BE77','#C79B6E'];
const ICONS=['🏠','🚕','🛍️','👶','👨‍👩‍👧','💼','🎁','📁'];
const DEFAULT_CATEGORIES=['生活','个人通勤','个人其他','孩子','家庭其他','医疗','人情往来','未分类'];
const demo=[{merchant:'滴滴出行',amount:9.2,kind:'expense',date:'2026-11-02',time:'09:07',category:'个人通勤',note:'',checked:true},{merchant:'手机充值-中国移动',amount:100,kind:'expense',date:'2026-11-01',time:'17:38',category:'生活',note:'',checked:true},{merchant:'转账收入',amount:110,kind:'income',date:'2026-11-01',time:'12:16',category:'收入',note:'',checked:true}];
let state=loadState(); let tab='home', period='month', selMonth=localMonth(), ocrMode='wechat', filterKind='all', filterCat='全部', queue=[], imageUrl='', rawOCR='', ocrBusy=false, progressText='', alertText='', alertErr=false, editingId=null, showSettings=false;
function loadState(){try{let x=JSON.parse(localStorage.getItem(STORE)||'null');if(x&&Array.isArray(x.records)&&Array.isArray(x.categories))return x;}catch(e){}return{records:[],categories:DEFAULT_CATEGORIES.slice()}}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(state));return true}catch(e){alert('保存失败：浏览器存储可能已满或不可用，请先导出备份。');return false}}
function localMonth(){let d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function localDate(){let d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function uid(){return (crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2))}
function h(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(n){return Number(n||0).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function iso(date){return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&& !Number.isNaN(new Date(date+'T00:00:00').getTime())}
function money(r){return (r.kind==='income'?'+':'−')+'¥'+fmt(r.amount)}
function sym(cat){let i=state.categories.indexOf(cat);return ICONS[i%ICONS.length]||'📁'}
function col(cat){let i=state.categories.indexOf(cat);return PALETTE[i%PALETTE.length]||PALETTE[0]}
function catOptions(selected,income=false){let cats=income?['收入']:state.categories;return cats.map(x=>`<option value="${h(x)}" ${selected===x?'selected':''}>${h(x)}</option>`).join('')}
function itemCategory(v){return state.categories.includes(v)?v:'未分类'}
function setNotice(t,err=false){alertText=t;alertErr=err;render()}
function chooseTab(v){tab=v;showSettings=false;render();scrollTo(0,0)}
function template(content){return `<div class="top"><div class="brand">小账本 <small>让每一笔，都清清楚楚</small></div><button class="circle-button" id="settings-btn" aria-label="分类和备份设置">⚙</button></div><main class="main">${content}</main><nav class="bottom"><button class="tab ${tab==='home'?'on':''}" data-tab="home"><span class="ico">◉</span>总览</button><button class="tab ${tab==='capture'?'on':''}" data-tab="capture"><span class="ico">⊕</span>记一笔</button><button class="tab ${tab==='records'?'on':''}" data-tab="records"><span class="ico">▤</span>明细</button></nav>${showSettings?settingsModal():''}${editingId?editModal():''}`}
function inRange(r){if(period==='all')return true;if(period==='year')return r.date.startsWith(selMonth.slice(0,4));return r.date.startsWith(selMonth)}
function home(){let all=state.records.filter(inRange),expenses=all.filter(r=>r.kind==='expense'), incomes=all.filter(r=>r.kind==='income'),sum=expenses.reduce((s,r)=>s+Number(r.amount),0),rev=incomes.reduce((s,r)=>s+Number(r.amount),0);
let by={};expenses.forEach(r=>by[r.category]=(by[r.category]||0)+Number(r.amount));let rows=Object.entries(by).sort((a,b)=>b[1]-a[1]);let pos=0;let stops=rows.map(([name,v])=>{let start=pos;pos+=sum?100*v/sum:0;return `${col(name)} ${start.toFixed(3)}% ${pos.toFixed(3)}%`});let donut=rows.length?`conic-gradient(${stops.join(',')})`:'#f0eef5';
return `<div class="row"><h1 class="heading">消费总览</h1><input class="monthbox" type="month" id="month" value="${h(selMonth)}"></div><div class="pills"><button class="pill ${period==='month'?'on':''}" data-period="month">本月</button><button class="pill ${period==='year'?'on':''}" data-period="year">本年</button><button class="pill ${period==='all'?'on':''}" data-period="all">全部</button></div>
<div class="card summary"><div class="dim">${period==='month'?h(selMonth)+' 月度':period==='year'?h(selMonth.slice(0,4))+' 年度':'全部'}支出</div><div class="big">¥${fmt(sum)}</div><div class="bar"></div><div class="cols"><div><div class="dim">总收入</div><strong>¥${fmt(rev)}</strong></div><div><div class="dim">记账笔数</div><strong>${all.length} 笔</strong></div></div></div>
<div class="card"><div class="row"><div class="title">支出分类占比</div><div class="sub">按支出金额计算</div></div><div class="donut-wrap"><div class="donut" style="background:${donut}"><div class="hole"><span class="sub">总支出</span><strong>¥${fmt(sum)}</strong></div></div></div>${rows.length?`<div class="legend">${rows.map(([name,amt])=>`<div class="legend-line"><div class="legend-name"><span class="dot" style="background:${col(name)}"></span><span>${h(name)}</span></div><span class="legend-money">¥${fmt(amt)}</span><span class="legend-percent">${(amt/sum*100).toFixed(1)}%</span></div>`).join('')}</div>`:'<div class="empty">还没有支出记录，先记一笔吧 ✨</div>'}</div><div class="card"><div class="row"><span class="title">最近账单</span><button class="btn small soft" data-tab="records">查看全部</button></div>${all.length?displayRecords(all.slice().sort(sortRecords).slice(0,4)):'<div class="empty">上传微信或支付宝账单截图即可开始</div>'}</div><div class="footer-note">数据保存在当前设备的浏览器中 · 请定期导出备份</div>`}
