// 选定收支类型后，负号仅代表原账单方向。金额以绝对值入账，不再重复弹窗。
function ledgerAmount(v){
  const raw=String(v??'').normalize('NFKC').replace(/[−–—﹣－]/g,'-').replace(/[¥￥,\s]/g,'').trim();
  if(!raw || !/^[+-]?\d+(?:\.\d+)?$/.test(raw))return 0;
  const n=Math.abs(Number(raw));
  return Number.isFinite(n)?Math.round(n*100)/100:0;
}
function ledgerDate(v){
  const s=String(v??'').trim();
  if(!s)return '';
  const m=s.match(/^(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})日?$/);
  if(!m)return '';
  const y=Number(m[1]),mm=Number(m[2]),dd=Number(m[3]);
  const date=[y,String(mm).padStart(2,'0'),String(dd).padStart(2,'0')].join('-');
  const test=new Date(date+'T00:00:00');
  return test.getFullYear()===y&&test.getMonth()+1===mm&&test.getDate()===dd?date:'';
}
function ledgerTime(v){
  const s=String(v??'').normalize('NFKC').trim().replace('：',':');
  const m=s.match(/^(\d{1,2}):(\d{2})$/);
  return m&&Number(m[1])<24&&Number(m[2])<60?String(Number(m[1])).padStart(2,'0')+':'+m[2]:'';
}
function saveQueue(){
  // 点击时同步表单，防止用户刚编辑完便点击保存时漏掉最后一个字段。
  document.querySelectorAll('#queue [data-q][data-field]').forEach(el=>{
    const r=queue[Number(el.dataset.q)],field=el.dataset.field;
    if(r)r[field]=field==='checked'?el.checked:el.value;
  });
  const chosen=queue.filter(r=>r.checked);
  if(!chosen.length){setNotice('请先勾选至少一笔交易。',true);return}
  const saved=chosen.map(r=>{
    const amount=ledgerAmount(r.amount),date=ledgerDate(r.date);
    const merchant=String(r.merchant||'').trim()||'待补交易名称';
    const kind=r.kind==='income'?'income':'expense';
    return {id:uid(),merchant,amount,kind,date,time:ledgerTime(r.time),category:kind==='income'?'收入':itemCategory(r.category),note:String(r.note||'').trim()};
  });
  const oldLength=state.records.length;
  state.records.push(...saved);
  if(!persist()){state.records.length=oldLength;return}
  queue=queue.filter(r=>!r.checked);
  const missing=saved.filter(r=>!r.date||!r.amount||r.merchant==='待补交易名称').length;
  alertText='已保存 '+saved.length+' 笔交易。'+(missing?'其中 '+missing+' 笔含待补信息，可在明细中修改。':'');
  alertErr=false;
  tab='records';
  render();
  scrollTo(0,0);
}
function saveEdit(){
  const r=state.records.find(x=>x.id===editingId);
  if(!r)return;
  const kind=document.getElementById('edit-kind').value;
  const merchant=document.getElementById('edit-merchant').value.trim()||'待补交易名称';
  Object.assign(r,{
    merchant,
    amount:ledgerAmount(document.getElementById('edit-amount').value),
    kind,
    date:ledgerDate(document.getElementById('edit-date').value),
    time:ledgerTime(document.getElementById('edit-time').value),
    category:kind==='income'?'收入':itemCategory(document.getElementById('edit-category').value),
    note:document.getElementById('edit-note').value.trim()
  });
  if(persist()){editingId=null;render()}
}
function addCategory(){let s=document.getElementById('new-cat').value.trim();if(!s)return;if(s==='收入'||state.categories.includes(s)){alert('该分类已存在');return}if(s.length>12){alert('分类名称最多12个字');return}state.categories.push(s);persist();render()}
function manageCategory(i){let old=state.categories[i];if(!old)return;let s=prompt('修改分类名称（输入空白可尝试删除）',old);if(s===null)return;s=s.trim();if(!s){if(state.records.some(r=>r.category===old)){alert('该分类已有交易，请先修改这些交易的分类，再删除。');return}if(state.categories.length<=1){alert('至少保留一个分类');return}state.categories.splice(i,1)}else{if(s==='收入'||s.length>12||state.categories.some((c,j)=>j!==i&&c===s)){alert('名称重复、过长或不可用');return}state.categories[i]=s;state.records.forEach(r=>{if(r.category===old)r.category=s})}persist();render()}
function download(name,content,type){let url=URL.createObjectURL(new Blob([content],{type}));let a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportJSON(){download(`小账本备份_${localDate()}.json`,JSON.stringify({...state,backupFormat:'mini-ledger-v1',exportedAt:new Date().toISOString()},null,2),'application/json;charset=utf-8')}
function exportCSV(){let headers=['日期','时间','收支类型','金额','分类','具体事项','原始交易名称'];let lines=[headers,...state.records.slice().sort(sortRecords).map(r=>[r.date,r.time,r.kind==='income'?'收入':'支出',r.amount,r.category,r.note,r.merchant])];download(`小账本明细_${localDate()}.csv`,'\ufeff'+lines.map(x=>x.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8')}
async function importJSON(file){if(!file)return;try{let obj=JSON.parse(await file.text());if(!Array.isArray(obj.records)||!Array.isArray(obj.categories)||obj.records.length>50000||obj.categories.length>100){throw Error('文件不是有效的小账本备份')}let cats=obj.categories.filter(x=>typeof x==='string'&&x.length<40),records=obj.records.map(x=>({id:uid(),merchant:String(x.merchant||'').slice(0,200),amount:Number(x.amount),kind:x.kind==='income'?'income':'expense',date:x.date,time:String(x.time||'').slice(0,5),category:x.kind==='income'?'收入':String(x.category||'未分类'),note:String(x.note||'').slice(0,400)}));if(records.some(x=>!iso(x.date)||!Number.isFinite(x.amount)||x.amount<=0))throw Error('备份中包含无效交易');if(!confirm(`将用备份中的 ${records.length} 笔交易覆盖当前 ${state.records.length} 笔记录，确定吗？`))return;state={categories:cats.length?cats:DEFAULT_CATEGORIES.slice(),records};persist();showSettings=false;render();alert('恢复成功')}catch(e){alert('恢复失败：'+e.message)}}
