import { supabase } from '../lib/supabase';
import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";

const C = {
  orange:"#FF6B2B", orangeLight:"#FFF0EA", orangeMid:"#FF8C55",
  navy:"#1A2B4A", navyMid:"#2D4270",
  gray:"#F5F6F8", grayMid:"#E8EAED", grayText:"#6B7280", grayDark:"#374151",
  white:"#FFFFFF", border:"#E2E5EA",
  green:"#16A34A", greenLight:"#DCFCE7",
  red:"#DC2626", redLight:"#FEE2E2",
};

const MONTHS = ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Nov","Dec"];
const CTR_BY_POS = {1:0.32,2:0.18,3:0.11,4:0.07,5:0.05,6:0.04,7:0.03,8:0.025,9:0.02,10:0.016};
function getCTR(pos) {
  if (pos<=0) return 0;
  if (pos<=10) return CTR_BY_POS[Math.round(pos)]||0.016;
  if (pos<=20) return 0.008;
  if (pos<=50) return 0.003;
  return 0.001;
}
function fmtN(n){return n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":Math.round(n).toString();}
function fmtRON(n){return fmtN(n)+" RON";}

const USERS=[{username:"Daniela",password:"Parolaseotool13122012."}];

const wordForms={
  "bec":["bec","becuri","becul","becurile"],"becuri":["bec","becuri","becul","becurile"],
  "led":["led"],"pantof":["pantof","pantofi","pantoful","pantofii"],"pantofi":["pantof","pantofi","pantoful","pantofii"],
  "telefon":["telefon","telefoane","telefonul","telefoanele"],"telefoane":["telefon","telefoane","telefonul","telefoanele"],
  "laptop":["laptop","laptopuri","laptopul","laptopurile"],"laptopuri":["laptop","laptopuri","laptopul","laptopurile"],
  "tricou":["tricou","tricouri","tricoul","tricourile"],"tricouri":["tricou","tricouri","tricoul","tricourile"],
  "ceas":["ceas","ceasuri","ceasul","ceasurile"],"ceasuri":["ceas","ceasuri","ceasul","ceasurile"],
  "rochie":["rochie","rochii","rochia","rochiile"],"rochii":["rochie","rochii","rochia","rochiile"],
  "geaca":["geaca","geci"],"geci":["geaca","geci"],
  "sport":"sport","samsung":"samsung","ieftin":"ieftine","ieftine":"ieftin","online":"online",
};
function getAllForms(w){const f=wordForms[w.toLowerCase()];if(!f)return[w];return typeof f==="string"?[w]:[...new Set(f)];}
function getWordVariants(words){const variants=words.map(w=>getAllForms(w));const combos=new Set();const combine=(i,cur)=>{if(i===variants.length){combos.add(cur.join(" "));return;}for(const v of variants[i])combine(i+1,[...cur,v]);};combine(0,[]);return[...combos];}
function mockVolume(kw,base){const w=kw.trim().split(" ").length;const p=w===1?1:w===2?0.85:w===3?0.5:0.25;return Math.max(100,Math.round(base*p*(0.7+Math.random()*0.6)));}
const predefinedData={"bec led":{base:18000,longTail:["e27","e14","12v","100w","spot","banda","rgb","inteligent","wifi","dimabil","exterior","ieftin","osram","philips"]},"becuri led":{base:18000,longTail:["e27","e14","12v","100w","spot","banda","rgb","inteligent","wifi","dimabil","exterior","ieftine","osram","philips"]},"pantofi sport":{base:22000,longTail:["barbati","dama","copii","nike","adidas","puma","albi","negri","ieftini","sala","alergare","tenis"]},"telefon samsung":{base:31000,longTail:["galaxy","s24","a55","a35","pret","ieftin","second hand","ultra","nou"]},"telefoane samsung":{base:31000,longTail:["galaxy","s24","a55","a35","pret","ieftine","second hand","ultra","noi"]}};
function findPredefined(q){for(const k of Object.keys(predefinedData))if(q===k||q.includes(k)||k.includes(q))return{...predefinedData[k]};return null;}
async function generateKeywords(query) {
  try {
    const response = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: [query] }),
    });
    const data = await response.json();
    const items = data?.tasks?.[0]?.result || [];
    if (!items.length) return [];
    return items.map(item => ({
      keyword: item.keyword,
      volume: item.search_volume || 0,
      trend: item.monthly_searches
        ? item.monthly_searches.slice(-12).map(m => m.search_volume || 0)
        : Array(12).fill(0),
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}
const blogTopicsDB={"asigurare auto":{direct:[{topic:"asigurare auto ieftina",volume:14200},{topic:"asigurare auto online",volume:11800},{topic:"asigurare auto RCA",volume:9400},{topic:"asigurare auto CASCO",volume:8100},{topic:"asigurare auto calculator",volume:6700}],related:[{topic:"parcare laterala",volume:22400},{topic:"amenzi rutiere 2024",volume:18900},{topic:"cum sa eviti accidentele",volume:15600},{topic:"revizie auto cat costa",volume:13200},{topic:"ITP auto",volume:12800},{topic:"anvelope iarna cand se pun",volume:8200}]},"credit ipotecar":{direct:[{topic:"credit ipotecar dobanda",volume:12400},{topic:"credit ipotecar calculator",volume:10800},{topic:"credit ipotecar prima casa",volume:9200}],related:[{topic:"cum cumperi un apartament",volume:19400},{topic:"notar taxe cumparare apartament",volume:14200},{topic:"renovare apartament costuri",volume:10400},{topic:"asigurare locuinta obligatorie",volume:7800}]},"panouri solare":{direct:[{topic:"panouri solare pret",volume:18200},{topic:"panouri solare acasa",volume:14600},{topic:"panouri solare montaj",volume:11200}],related:[{topic:"factura curent electric reduci",volume:22400},{topic:"casa verde program 2024",volume:19800},{topic:"baterie stocare energie solar",volume:16400},{topic:"pompa de caldura avantaje",volume:10200}]}};
function generateBlogTopics(query){const q=query.toLowerCase().trim();for(const key of Object.keys(blogTopicsDB)){if(q.includes(key)||key.includes(q)){const d=blogTopicsDB[key];return[...d.direct.map(t=>({...t,type:"direct"})),...d.related.map(t=>({...t,type:"related"}))].sort((a,b)=>b.volume-a.volume);}}const direct=[`${q} ghid complet`,`${q} avantaje dezavantaje`,`${q} costuri`,`${q} online`,`${q} recenzii`].map((topic,i)=>({topic,volume:Math.max(500,12000-i*1800+Math.floor(Math.random()*1000)),type:"direct"}));const related=[`sfaturi despre ${q}`,`greseli comune ${q}`,`ghid incepatori ${q}`,`tendinte ${q} 2025`,`beneficii ${q}`].map((topic,i)=>({topic,volume:Math.max(300,20000-i*2200+Math.floor(Math.random()*1500)),type:"related"}));return[...direct,...related].sort((a,b)=>b.volume-a.volume);}

async function loadProjects(userId) {
  if (!supabase) { console.log('[loadProjects] supabase client null — env vars lipsă'); return []; }
  if (!userId) { console.log('[loadProjects] userId undefined — user nelogat'); return []; }
  console.log('[loadProjects] start, userId:', userId);
  try {
    // 1. Încarcă proiectele userului
    const { data: projectsData, error: projError } = await supabase
      .from('projects')
      .select('id, name, url, user_id, auto_check')
      .eq('user_id', userId);
    if (projError) {
      console.log('Supabase error details:', JSON.stringify(projError));
      throw projError;
    }
    console.log('[loadProjects] projects loaded:', projectsData?.length ?? 0);

    const projects = projectsData || [];

    // 2. Pentru fiecare proiect, încarcă keywords + history
    const result = await Promise.all(projects.map(async project => {
      const { data: kwData, error: kwError } = await supabase
        .from('keywords')
        .select('id, keyword, position, position_desktop, position_mobile, url, volume')
        .eq('project_id', project.id);
      if (kwError) {
        console.log('Supabase error details:', JSON.stringify(kwError));
        console.error('[loadProjects] keywords error pentru project', project.id);
        return { ...project, keywords: [] };
      }
      console.log('[loadProjects] keywords loaded pentru', project.id, ':', kwData?.length ?? 0);

      const keywords = await Promise.all((kwData || []).map(async kw => {
        const { data: histData, error: histError } = await supabase
          .from('keyword_history')
          .select('position, date')
          .eq('keyword_id', kw.id)
          .order('date', { ascending: true });
        if (histError) {
          console.log('Supabase error details:', JSON.stringify(histError));
          console.error('[loadProjects] history error pentru keyword', kw.id);
        }
        return { ...kw, history: histData || [] };
      }));

      return { ...project, auto_check: project.auto_check !== false, keywords };
    }));

    console.log('[loadProjects] done, proiecte cu keywords:', result.length);
    return result;
  } catch (e) {
    console.log('Supabase error details:', JSON.stringify(e));
    console.error('[loadProjects] eroare generală:', e);
    return [];
  }
}

async function saveProject(project, userId) {
  if (!supabase) { console.log('[saveProject] supabase client null'); return null; }
  if (!userId) { console.log('[saveProject] userId undefined'); return null; }
  try {
    const { error } = await supabase
      .from('projects')
      .upsert({ id: String(project.id), name: project.name, url: project.url, user_id: userId, auto_check: project.auto_check !== false });
    if (error) {
      console.log('Supabase error details:', JSON.stringify(error));
      throw error;
    }
    return project;
  } catch (e) {
    console.log('Supabase error details:', JSON.stringify(e));
    console.error('[saveProject] eroare:', e);
    return null;
  }
}

async function saveProjects(projects, userId) {
  if (!supabase) { console.log('[saveProjects] supabase client null'); return; }
  if (!userId) { console.log('[saveProjects] userId undefined'); return; }
  console.log('[saveProjects] start, proiecte:', projects?.length ?? 0, 'userId:', userId);
  try {
    for (const project of projects || []) {
      // 1. Upsert project
      const projRow = { id: String(project.id), name: project.name, url: project.url || '', user_id: userId, auto_check: project.auto_check !== false };
      console.log('[saveProjects] upsert project:', JSON.stringify(projRow));
      const { error: projError } = await supabase
        .from('projects')
        .upsert(projRow, { onConflict: 'id' });
      if (projError) {
        console.log('Supabase error details:', JSON.stringify(projError));
        console.error('[saveProjects] eroare project', project.id, projError.message);
        continue;
      }
      console.log('[saveProjects] project salvat:', project.id);

      // 2. Upsert keywords
      for (const kw of project.keywords || []) {
        const kwRow = {
          id: String(kw.id),
          project_id: String(project.id),
          keyword: kw.keyword,
          position: kw.position ?? 0,
          position_desktop: kw.position_desktop ?? null,
          position_mobile: kw.position_mobile ?? null,
          url: kw.url || '',
          volume: kw.volume || 0,
        };
        console.log('[saveProjects] upsert keyword:', kw.keyword, 'id:', kwRow.id);
        const { error: kwError } = await supabase
          .from('keywords')
          .upsert(kwRow, { onConflict: 'id' });
        if (kwError) {
          console.log('Supabase error details:', JSON.stringify(kwError));
          console.error('[saveProjects] eroare keyword', kw.id, kw.keyword, kwError.message);
          continue;
        }
        console.log('[saveProjects] keyword salvat:', kw.keyword);

        // 3. Salvează keyword_history: DELETE + INSERT
        const historyRows = (kw.history || [])
          .filter(h => h.date != null && h.position != null)
          .map(h => ({
            keyword_id: String(kw.id),
            date: String(h.date),
            position: parseInt(h.position, 10),
          }));
        const { error: delHistError } = await supabase
          .from('keyword_history')
          .delete()
          .eq('keyword_id', String(kw.id));
        if (delHistError) {
          console.log('Supabase error details:', JSON.stringify(delHistError));
          console.error('[saveProjects] eroare delete history kw', kw.id, delHistError.message);
        }
        if (historyRows.length > 0) {
          console.log('[saveProjects] insert history', historyRows.length, 'rows pentru', kw.keyword);
          const { error: histError } = await supabase
            .from('keyword_history')
            .insert(historyRows);
          if (histError) {
            console.log('Supabase error details:', JSON.stringify(histError));
            console.error('[saveProjects] eroare insert history kw', kw.id, histError.message);
          }
        }
      }
    }
    console.log('[saveProjects] done');
  } catch (e) {
    console.log('Supabase error details:', JSON.stringify(e));
    console.error('[saveProjects] eroare generală:', e.message, e);
  }
}

function mockPosition(){return Math.floor(Math.random()*50)+1;}
function mockHistory(){let pos=Math.floor(Math.random()*30)+5;return Array.from({length:30},(_,i)=>{pos=Math.max(1,Math.min(100,pos+Math.floor(Math.random()*7)-3));return{date:new Date(Date.now()-(29-i)*24*3600000).toLocaleDateString("ro-RO",{day:"2-digit",month:"short"}),position:pos};});}
function parseHistoryDate(str){if(!str)return null;const[day,mon]=str.split(" ");const months={ian:0,feb:1,mar:2,apr:3,mai:4,iun:5,iul:6,aug:7,sep:8,oct:9,nov:10,dec:11};const m=months[mon?.toLowerCase()];if(m===undefined)return null;return new Date(new Date().getFullYear(),m,parseInt(day));}
function fmtDate(d){return d?d.toISOString().slice(0,10):"";}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}

// ── Logo SVG ──────────────────────────────────────────────────────────────────
function Logo({variant="dark", width=170}){
  const isLight = variant==="light";
  return(
    <svg width={width} height={Math.round(width*44/240)} viewBox="0 0 240 44" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="22" width="6" height="16" rx="1.5" fill="#FF6B2B" opacity="0.5"/>
      <rect x="9" y="15" width="6" height="23" rx="1.5" fill="#FF6B2B" opacity="0.75"/>
      <rect x="18" y="8" width="6" height="30" rx="1.5" fill="#FF6B2B"/>
      <polygon points="21,8 27,3 27,13" fill={isLight?"#111111":"#ffffff"}/>
      <line x1="38" y1="6" x2="38" y2="38" stroke={isLight?"#E2E5EA":"rgba(255,255,255,0.15)"} strokeWidth="1.5"/>
      <text x="48" y="27" fontFamily="Inter,sans-serif" fontSize="17" fontWeight="800" fill={isLight?"#111111":"#ffffff"} letterSpacing="-0.5">SEO Tool</text>
      <circle cx="138" cy="22" r="3" fill="#FF6B2B"/>
      <text x="146" y="27" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="500" fill={isLight?"#6B7280":"rgba(255,255,255,0.5)"} letterSpacing="0.2">by AdSem</text>
      <rect x="48" y="34" width="56" height="2.5" rx="1.5" fill="#FF6B2B"/>
    </svg>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function EmptyState({icon,title,subtitle}){return <div style={{textAlign:"center",padding:"80px 0",color:C.grayText}}><div style={{fontSize:48,marginBottom:16}}>{icon}</div><p style={{fontSize:16,fontWeight:500,color:C.grayDark}}>{title}</p>{subtitle&&<p style={{fontSize:13,marginTop:6}}>{subtitle}</p>}</div>;}
function VolumeBar({volume,max,color}){const pct=Math.round((volume/max)*100);const col=color||(pct>66?C.orange:pct>33?C.navyMid:C.grayText);return <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:80,height:8,background:C.grayMid,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:4}}/></div><span style={{fontSize:13,color:C.grayText,minWidth:48}}>{volume>=1000?(volume/1000).toFixed(1)+"K":volume}</span></div>;}
function PositionBadge({pos}){const color=pos<=3?C.orange:pos<=10?C.navy:pos<=20?C.navyMid:C.grayText;const bg=pos<=3?C.orangeLight:pos<=10?"#EEF1F8":pos<=20?"#F0F2F8":C.gray;return <span style={{fontWeight:700,fontSize:15,color,background:bg,padding:"4px 10px",borderRadius:8,minWidth:36,textAlign:"center",display:"inline-block"}}>#{pos}</span>;}
function MiniTrend({data}){const[tooltip,setTooltip]=useState(null);const W=80,H=32,max=Math.max(...data),min=Math.min(...data);const pts=data.map((v,i)=>({x:(i/(data.length-1))*W,y:H-((v-min)/(max-min||1))*H,v,i}));const poly=pts.map(p=>`${p.x},${p.y}`).join(" ");return <div style={{position:"relative",display:"inline-block"}}><svg width={W} height={H} onMouseLeave={()=>setTooltip(null)} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();const mx=e.clientX-r.left;setTooltip(pts.reduce((a,b)=>Math.abs(b.x-mx)<Math.abs(a.x-mx)?b:a));}}><polyline points={poly} fill="none" stroke={C.orange} strokeWidth="2" strokeLinejoin="round"/>{tooltip&&<><line x1={tooltip.x} y1={0} x2={tooltip.x} y2={H} stroke={C.orange} strokeWidth="1" strokeDasharray="3,2"/><circle cx={tooltip.x} cy={tooltip.y} r={3} fill={C.orange}/></>}</svg>{tooltip&&<div style={{position:"absolute",bottom:"calc(100% + 6px)",left:tooltip.x>50?"auto":tooltip.x-28,right:tooltip.x>50?0:"auto",background:C.navy,color:C.white,fontSize:11,padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",pointerEvents:"none",zIndex:10}}>{MONTHS[tooltip.i]}: {tooltip.v>=1000?(tooltip.v/1000).toFixed(1)+"K":tooltip.v}</div>}</div>;}
function PositionChart({history}){const[tip,setTip]=useState(null);const[range,setRange]=useState("14");if(!history||history.length<2)return null;const filtered=range==="all"?history:history.slice(-parseInt(range));const W=200,H=50,pad=4;const positions=filtered.map(e=>e.position);const maxP=Math.max(...positions),minP=Math.min(...positions);const pts=filtered.map((e,i)=>({x:pad+(i/Math.max(filtered.length-1,1))*(W-pad*2),y:pad+((e.position-minP)/((maxP-minP)||1))*(H-pad*2),pos:e.position,date:e.date}));const poly=pts.map(p=>`${p.x},${p.y}`).join(" ");return <div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{display:"flex",gap:4}}>{[["7","7z"],["14","14z"],["30","30z"],["all","Tot"]].map(([val,label])=><button key={val} onClick={()=>setRange(val)} style={{padding:"2px 7px",fontSize:10,borderRadius:5,border:"1.5px solid",cursor:"pointer",fontWeight:500,borderColor:range===val?C.orange:C.border,background:range===val?C.orangeLight:C.white,color:range===val?C.orange:C.grayText}}>{label}</button>)}</div><div style={{position:"relative",display:"inline-block"}}><svg width={W} height={H} onMouseLeave={()=>setTip(null)} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();const mx=e.clientX-r.left;setTip(pts.reduce((a,b)=>Math.abs(b.x-mx)<Math.abs(a.x-mx)?b:a));}}><polyline points={poly} fill="none" stroke={C.navy} strokeWidth="2" strokeLinejoin="round"/>{tip&&<><line x1={tip.x} y1={0} x2={tip.x} y2={H} stroke={C.navy} strokeWidth="1" strokeDasharray="3,2"/><circle cx={tip.x} cy={tip.y} r={3} fill={C.navy}/></>}</svg>{tip&&<div style={{position:"absolute",bottom:"calc(100% + 4px)",left:tip.x>140?"auto":tip.x-20,right:tip.x>140?0:"auto",background:C.navy,color:C.white,fontSize:11,padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",pointerEvents:"none",zIndex:10}}>{tip.date}: #{tip.pos}</div>}</div></div>;}
function exportCSV(data,query){const blob=new Blob(["Keyword,Volum lunar\n"+data.map(r=>`"${r.keyword}",${r.volume}`).join("\n")],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`keywords_${query.replace(/\s+/g,"_")}.csv`;a.click();URL.revokeObjectURL(url);}

function CalendarPicker({label,value,onChange,minDate,maxDate}){const[open,setOpen]=useState(false);const[view,setView]=useState(()=>value?new Date(value+"T00:00:00"):new Date());const year=view.getFullYear(),month=view.getMonth();const firstDay=new Date(year,month,1).getDay();const daysInMonth=new Date(year,month+1,0).getDate();const DAYS=["Lu","Ma","Mi","Jo","Vi","Sâ","Du"];const MONS=["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Nov","Dec"];const cells=[];const startOffset=(firstDay+6)%7;for(let i=0;i<startOffset;i++)cells.push(null);for(let d=1;d<=daysInMonth;d++)cells.push(new Date(year,month,d));const selDate=value?new Date(value+"T00:00:00"):null;const isDisabled=d=>{if(!d)return true;if(minDate&&d<new Date(minDate+"T00:00:00"))return true;if(maxDate&&d>new Date(maxDate+"T00:00:00"))return true;return false;};return <div style={{position:"relative",display:"inline-block"}}><div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:`1.5px solid ${open?C.orange:C.border}`,borderRadius:8,cursor:"pointer",background:C.white,fontSize:13,color:value?C.navy:C.grayText,minWidth:130,userSelect:"none"}}><span>📅</span><span>{value||label}</span></div>{open&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200,background:C.white,border:`1.5px solid ${C.border}`,borderRadius:12,boxShadow:"0 8px 30px rgba(0,0,0,0.12)",padding:14,width:240}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><button onClick={()=>setView(new Date(year,month-1,1))} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:C.navy,padding:"2px 6px"}}>‹</button><span style={{fontWeight:600,fontSize:13,color:C.navy}}>{MONS[month]} {year}</span><button onClick={()=>setView(new Date(year,month+1,1))} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:C.navy,padding:"2px 6px"}}>›</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:C.grayText,padding:"2px 0"}}>{d}</div>)}</div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{cells.map((d,i)=>{if(!d)return <div key={i}/>;const sel=selDate&&d.toDateString()===selDate.toDateString();const dis=isDisabled(d);return <div key={i} onClick={()=>{if(!dis){onChange(fmtDate(d));setOpen(false);}}} style={{textAlign:"center",padding:"5px 2px",borderRadius:6,fontSize:12,cursor:dis?"default":"pointer",fontWeight:sel?700:400,background:sel?C.orange:"transparent",color:dis?C.grayMid:sel?C.white:C.navy,opacity:dis?0.4:1}} onMouseEnter={e=>{if(!dis&&!sel)e.currentTarget.style.background=C.orangeLight;}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.background="transparent";}}>{d.getDate()}</div>;})}</div></div>}</div>;}

function ProjectChart({keywords,activeDevice}){const today=new Date();const[mode,setMode]=useState("preset");const[preset,setPreset]=useState("14");const[p1Start,setP1Start]=useState(fmtDate(addDays(today,-13)));const[p1End,setP1End]=useState(fmtDate(today));const[p2Start,setP2Start]=useState(fmtDate(addDays(today,-27)));const[p2End,setP2End]=useState(fmtDate(addDays(today,-14)));const[tip,setTip]=useState(null);if(!keywords||keywords.length===0)return null;const kws=keywords;const allDates=[...new Set(kws.flatMap(k=>(k.history||[]).map(h=>h.date)))].map(d=>({str:d,ts:parseHistoryDate(d)})).filter(d=>d.ts).sort((a,b)=>a.ts-b.ts);const avgForDates=dates=>dates.map(({str,ts})=>{const pos=kws.map(k=>{const h=(k.history||[]).find(e=>e.date===str);return h?h.position:null;}).filter(Boolean);return{str,ts,avg:pos.length?Math.round(pos.reduce((a,b)=>a+b,0)/pos.length):null};}).filter(e=>e.avg!==null);let series1=[],series2=[],compareMode=false;if(mode==="preset"){const n=preset==="all"?allDates.length:parseInt(preset);series1=avgForDates(allDates.slice(-n));}else if(mode==="custom"){const s=new Date(p1Start+"T00:00:00"),e=new Date(p1End+"T23:59:59");series1=avgForDates(allDates.filter(d=>d.ts>=s&&d.ts<=e));}else if(mode==="compare"){compareMode=true;const s1=new Date(p1Start+"T00:00:00"),e1=new Date(p1End+"T23:59:59"),s2=new Date(p2Start+"T00:00:00"),e2=new Date(p2End+"T23:59:59");series1=avgForDates(allDates.filter(d=>d.ts>=s1&&d.ts<=e1));series2=avgForDates(allDates.filter(d=>d.ts>=s2&&d.ts<=e2));}const curPos=kws.map(k=>activeDevice==='mobile'?k.position_mobile:k.position_desktop).filter(p=>p!=null&&p>0);const curAvg=curPos.length?Math.round(curPos.reduce((a,b)=>a+b,0)/curPos.length):0;const curTop3=curPos.filter(p=>p<=3).length,curTop10=curPos.filter(p=>p<=10).length;const svgW=560,H=140,pad={t:12,r:16,b:28,l:36};const allForScale=compareMode?[...series1,...series2]:series1;const allAvgs=allForScale.map(e=>e.avg);const scaleMax=Math.max(...allAvgs,1),scaleMin=Math.min(...allAvgs,1);const toPt=series=>series.map((e,i)=>({x:pad.l+(i/Math.max(series.length-1,1))*(svgW-pad.l-pad.r),y:pad.t+((e.avg-scaleMin)/((scaleMax-scaleMin)||1))*(H-pad.t-pad.b),avg:e.avg,str:e.str}));const pts1=toPt(series1),pts2=compareMode?toPt(series2):[];const toLine=pts=>pts.map(p=>`${p.x},${p.y}`).join(" ");const yTicks=[scaleMin,Math.round((scaleMin+scaleMax)/2),scaleMax].filter((v,i,a)=>a.indexOf(v)===i);const avg1=series1.length?Math.round(series1.reduce((s,e)=>s+e.avg,0)/series1.length):null;const avg2=series2.length?Math.round(series2.reduce((s,e)=>s+e.avg,0)/series2.length):null;const diff=avg1!==null&&avg2!==null?avg2-avg1:null;
return(<div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}><div><div style={{fontWeight:600,fontSize:15,marginBottom:2}}>Raportare pozitii</div><div style={{fontSize:12,color:C.grayText}}>{kws.length} keywords · {activeDevice==='mobile'?'📱 Mobil':'🖥 Desktop'}</div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>{[{label:"Pozitie medie curenta",value:curPos.length?`#${curAvg}`:"—",color:C.navy,bg:"#EEF1F8"},{label:"Keywords Top 3",value:curTop3,color:C.orange,bg:C.orangeLight},{label:"Keywords Top 10",value:curTop10,color:C.navy,bg:"#EEF1F8"}].map((s,i)=><div key={i} style={{background:s.bg,borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:11,color:C.grayText,marginBottom:3}}>{s.label}</div><div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div></div>)}</div><div style={{display:"flex",gap:6,marginBottom:14}}>{[["preset","Preset"],["custom","Perioadă custom"],["compare","Compară perioade"]].map(([val,label])=><button key={val} onClick={()=>setMode(val)} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid",fontSize:12,cursor:"pointer",fontWeight:500,borderColor:mode===val?C.orange:C.border,background:mode===val?C.orangeLight:C.white,color:mode===val?C.orange:C.grayText}}>{label}</button>)}</div>{mode==="preset"&&<div style={{display:"flex",gap:6,marginBottom:14}}>{[["7","7 zile"],["14","14 zile"],["30","30 zile"],["all","Tot"]].map(([val,label])=><button key={val} onClick={()=>setPreset(val)} style={{padding:"5px 12px",fontSize:12,borderRadius:7,border:"1.5px solid",cursor:"pointer",fontWeight:500,borderColor:preset===val?C.navy:C.border,background:preset===val?"#EEF1F8":C.white,color:preset===val?C.navy:C.grayText}}>{label}</button>)}</div>}{mode==="custom"&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}><span style={{fontSize:12,color:C.grayText,fontWeight:500}}>De la</span><CalendarPicker label="Data start" value={p1Start} onChange={setP1Start} maxDate={p1End}/><span style={{fontSize:12,color:C.grayText,fontWeight:500}}>până la</span><CalendarPicker label="Data end" value={p1End} onChange={setP1End} minDate={p1Start} maxDate={fmtDate(today)}/></div>}{mode==="compare"&&<div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:8,background:"#EEF1F8",padding:"8px 12px",borderRadius:10}}><div style={{width:10,height:10,borderRadius:"50%",background:C.navy,flexShrink:0}}/><span style={{fontSize:12,fontWeight:500,color:C.navy,marginRight:4}}>P1</span><CalendarPicker label="Start" value={p1Start} onChange={setP1Start} maxDate={p1End}/><span style={{fontSize:11,color:C.grayText}}>→</span><CalendarPicker label="End" value={p1End} onChange={setP1End} minDate={p1Start} maxDate={fmtDate(today)}/></div><div style={{display:"flex",alignItems:"center",gap:8,background:C.orangeLight,padding:"8px 12px",borderRadius:10}}><div style={{width:10,height:10,borderRadius:"50%",background:C.orange,flexShrink:0}}/><span style={{fontSize:12,fontWeight:500,color:C.orange,marginRight:4}}>P2</span><CalendarPicker label="Start" value={p2Start} onChange={setP2Start} maxDate={p2End}/><span style={{fontSize:11,color:C.grayText}}>→</span><CalendarPicker label="End" value={p2End} onChange={setP2End} minDate={p2Start} maxDate={fmtDate(today)}/></div></div>}{compareMode&&avg1!==null&&avg2!==null&&<div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}><div style={{background:"#EEF1F8",borderRadius:8,padding:"8px 16px",fontSize:13}}><span style={{color:C.grayText}}>P1 medie: </span><strong style={{color:C.navy}}>#{avg1}</strong></div><div style={{background:C.orangeLight,borderRadius:8,padding:"8px 16px",fontSize:13}}><span style={{color:C.grayText}}>P2 medie: </span><strong style={{color:C.orange}}>#{avg2}</strong></div><div style={{background:diff<0?"#E8F5E9":diff>0?"#FFF0F0":C.gray,borderRadius:8,padding:"8px 16px",fontSize:13}}><span style={{color:C.grayText}}>Diferenta: </span><strong style={{color:diff<0?"#2E7D32":diff>0?"#C62828":C.grayText}}>{diff===0?"—":diff<0?`▲ ${Math.abs(diff)} pozitii mai sus`:`▼ ${diff} pozitii mai jos`}</strong></div></div>}{series1.length<2?<div style={{textAlign:"center",padding:"30px 0",color:C.grayText,fontSize:13}}>Nu există suficiente date pentru perioada selectată.</div>:<div style={{position:"relative"}}><svg viewBox={`0 0 ${svgW} ${H}`} style={{width:"100%",height:H}} onMouseLeave={()=>setTip(null)} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();const mx=(e.clientX-r.left)/r.width*svgW;const near1=pts1.length?pts1.reduce((a,b)=>Math.abs(b.x-mx)<Math.abs(a.x-mx)?b:a):null;const near2=pts2.length?pts2.reduce((a,b)=>Math.abs(b.x-mx)<Math.abs(a.x-mx)?b:a):null;setTip({x:near1?near1.x:near2?.x,p1:near1,p2:near2});}}>{yTicks.map((v,i)=>{const yy=pad.t+((v-scaleMin)/((scaleMax-scaleMin)||1))*(H-pad.t-pad.b);return<g key={i}><line x1={pad.l} y1={yy} x2={svgW-pad.r} y2={yy} stroke={C.grayMid} strokeWidth="1" strokeDasharray="4,3"/><text x={pad.l-4} y={yy+4} fontSize="9" fill={C.grayText} textAnchor="end">#{v}</text></g>})}{pts1.filter((_,i)=>i%Math.max(1,Math.floor(pts1.length/6))===0).map((p,i)=><text key={i} x={p.x} y={H-4} fontSize="9" fill={C.grayText} textAnchor="middle">{p.str}</text>)}{pts1.length>1&&<polyline points={toLine(pts1)} fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round"/>}{pts2.length>1&&<polyline points={toLine(pts2)} fill="none" stroke={C.orange} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="6,3"/>}{tip&&<line x1={tip.x} y1={pad.t} x2={tip.x} y2={H-pad.b} stroke={C.grayMid} strokeWidth="1" strokeDasharray="3,2"/>}{tip?.p1&&<circle cx={tip.p1.x} cy={tip.p1.y} r={4} fill={C.navy}/>}{tip?.p2&&<circle cx={tip.p2.x} cy={tip.p2.y} r={4} fill={C.orange}/>}</svg>{tip&&(tip.p1||tip.p2)&&<div style={{position:"absolute",top:8,left:tip.x/svgW*100>65?"auto":`calc(${tip.x/svgW*100}% + 10px)`,right:tip.x/svgW*100>65?`calc(${(1-tip.x/svgW)*100}% + 10px)`:"auto",background:C.navy,color:C.white,fontSize:11,padding:"6px 10px",borderRadius:8,pointerEvents:"none",whiteSpace:"nowrap",lineHeight:1.8}}>{tip.p1&&<div><span style={{color:"#aac4ff"}}>P1 {tip.p1.str}:</span> <strong>#{tip.p1.avg}</strong></div>}{tip.p2&&<div><span style={{color:"#ffb899"}}>P2 {tip.p2.str}:</span> <strong>#{tip.p2.avg}</strong></div>}</div>}</div>}<div style={{display:"flex",gap:16,marginTop:8}}><div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.grayText}}><div style={{width:20,height:2.5,background:C.navy,borderRadius:2}}/>{compareMode?"Perioada 1":"Medie pozitii"}</div>{compareMode&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.grayText}}><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={C.orange} strokeWidth="2.5" strokeDasharray="5,3"/></svg>Perioada 2</div>}</div></div>);}

// ── Projects Home ─────────────────────────────────────────────────────────────
function ProjectsHome({ projects, onSelectProject, onNewProject }) {
  const getProjectStats = p => {
    const pos = p.keywords.map(k => k.position);
    const avg = pos.length ? Math.round(pos.reduce((a,b)=>a+b,0)/pos.length) : null;
    const top3 = pos.filter(p=>p<=3).length;
    const top10 = pos.filter(p=>p<=10).length;
    return { avg, top3, top10 };
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,color:C.navy,marginBottom:6}}>Proiectele tale</h1>
          <p style={{color:C.grayText,fontSize:14}}>Selectează un proiect pentru a vedea Rank Tracker-ul.</p>
        </div>
        <button onClick={onNewProject} style={{padding:"11px 22px",background:C.orange,color:C.white,border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          + Proiect nou
        </button>
      </div>

      {projects.length === 0 ? (
        <div style={{textAlign:"center",padding:"80px 0"}}>
          <div style={{fontSize:56,marginBottom:20}}>📂</div>
          <p style={{fontSize:18,fontWeight:600,color:C.grayDark,marginBottom:8}}>Niciun proiect încă</p>
          <p style={{fontSize:14,color:C.grayText,marginBottom:28}}>Creează primul tău proiect pentru a începe să monitorizezi poziții.</p>
          <button onClick={onNewProject} style={{padding:"12px 28px",background:C.orange,color:C.white,border:"none",borderRadius:10,fontWeight:700,fontSize:15,cursor:"pointer"}}>+ Creează primul proiect</button>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>
          {projects.map(p => {
            const stats = getProjectStats(p);
            return (
              <div key={p.id} onClick={()=>onSelectProject(p.id)}
                style={{background:C.white,border:`1.5px solid ${C.border}`,borderRadius:14,padding:24,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.orange;e.currentTarget.style.boxShadow="0 4px 20px rgba(255,107,43,0.12)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="none";}}>
                {/* header */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:16,color:C.navy,marginBottom:4}}>{p.name}</div>
                    {p.url && <div style={{fontSize:12,color:C.orange}}>{p.url}</div>}
                  </div>
                  <div style={{width:36,height:36,background:C.orangeLight,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:18}}>📈</span>
                  </div>
                </div>
                {/* stats */}
                {p.keywords.length > 0 ? (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                    {[
                      {label:"Poz. medie",value:stats.avg?`#${stats.avg}`:"—",color:C.navy},
                      {label:"Top 3",value:stats.top3,color:C.orange},
                      {label:"Top 10",value:stats.top10,color:C.navyMid},
                    ].map((s,i)=>(
                      <div key={i} style={{background:C.gray,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:C.grayText,marginBottom:3}}>{s.label}</div>
                        <div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{background:C.gray,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.grayText}}>Niciun keyword adăugat încă</div>
                )}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:C.grayText}}>{p.keywords.length} keyword{p.keywords.length!==1?"s":""}</span>
                  <span style={{fontSize:12,fontWeight:600,color:C.orange}}>Deschide →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){const[username,setUsername]=useState("");const[password,setPassword]=useState("");const[error,setError]=useState("");const[showPass,setShowPass]=useState(false);const handleLogin=()=>{const match=USERS.find(u=>u.username===username.trim()&&u.password===password);if(match){onLogin(match.username);}else{setError("User sau parolă incorectă.");}};return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.navy,fontFamily:"Inter,'Segoe UI',sans-serif"}}><div style={{background:C.white,borderRadius:20,padding:"40px 36px",width:360,boxShadow:"0 24px 80px rgba(0,0,0,0.25)"}}><div style={{marginBottom:32}}><Logo variant="light" width={200}/></div><div style={{marginBottom:16}}><label style={{fontSize:12,fontWeight:600,color:C.grayDark,display:"block",marginBottom:6}}>Utilizator</label><input value={username} onChange={e=>{setUsername(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="Nume utilizator" autoComplete="username" style={{width:"100%",padding:"11px 14px",border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:14,outline:"none",boxSizing:"border-box",color:C.navy}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/></div><div style={{marginBottom:8}}><label style={{fontSize:12,fontWeight:600,color:C.grayDark,display:"block",marginBottom:6}}>Parolă</label><div style={{position:"relative"}}><input value={password} onChange={e=>{setPassword(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} type={showPass?"text":"password"} placeholder="••••••••" autoComplete="current-password" style={{width:"100%",padding:"11px 40px 11px 14px",border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:14,outline:"none",boxSizing:"border-box",color:C.navy}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/><span onClick={()=>setShowPass(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:16,userSelect:"none"}}>{showPass?"🙈":"👁️"}</span></div></div>{error&&<div style={{fontSize:12,color:C.red,marginBottom:12,padding:"8px 12px",background:C.redLight,borderRadius:7}}>⚠️ {error}</div>}<button onClick={handleLogin} style={{width:"100%",padding:"12px",background:C.orange,color:C.white,border:"none",borderRadius:9,fontWeight:700,fontSize:15,cursor:"pointer",marginTop:8}}>Intră în cont</button><div style={{textAlign:"center",marginTop:16}}><span onClick={()=>{setError("Contacteaza administratorul - Daniela D - pentru a afla parola!");fetch('/api/send-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}).catch(()=>{});}} style={{fontSize:12,color:C.grayText,cursor:"pointer",textDecoration:"underline"}}>Am uitat parola</span></div></div></div>);}

// ── Keyword Research ──────────────────────────────────────────────────────────
function KeywordResearch({onAddToTracker}){const[query,setQuery]=useState("");const[results,setResults]=useState(null);const[loading,setLoading]=useState(false);const[searched,setSearched]=useState("");const[sortDir,setSortDir]=useState("desc");const[includeWord,setIncludeWord]=useState("");const[excludeWord,setExcludeWord]=useState("");const[selected,setSelected]=useState(new Set());const[added,setAdded]=useState(false);const handleSearch= async ()=>{if(!query.trim())return;setLoading(true);setResults(null);setSelected(new Set());generateKeywords(query).then(res=>{setResults(res);setSearched(query);setSortDir("desc");setLoading(false);});};const sorted=results?[...results].filter(r=>r.volume>0).filter(r=>includeWord.trim()===""||r.keyword.toLowerCase().includes(includeWord.toLowerCase())).filter(r=>excludeWord.trim()===""||!r.keyword.toLowerCase().includes(excludeWord.toLowerCase())).sort((a,b)=>sortDir==="desc"?b.volume-a.volume:a.volume-b.volume):[];const maxVol=results?Math.max(...results.map(r=>r.volume)):1;const toggleSelect=kw=>{const s=new Set(selected);s.has(kw)?s.delete(kw):s.add(kw);setSelected(s);};const toggleAll=e=>{if(e.target.checked)setSelected(new Set(sorted.map(r=>r.keyword)));else setSelected(new Set());};const handleAddToTracker=()=>{if(selected.size===0)return;onAddToTracker([...selected]);setAdded(true);setTimeout(()=>setAdded(false),2000);};return <div><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Keyword Research</h1><p style={{color:C.grayText,fontSize:14,marginBottom:24}}>Descopera volume de cautare si variatii de keywords pentru Romania.</p><div style={{display:"flex",gap:10,marginBottom:28}}><div style={{flex:1,position:"relative"}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.grayText}}>🔍</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} placeholder="Ex: bec led, pantofi sport..." style={{width:"100%",padding:"12px 14px 12px 40px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,outline:"none",background:C.white,boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/></div><button onClick={handleSearch} style={{padding:"12px 28px",background:C.orange,color:C.white,border:"none",borderRadius:10,fontWeight:600,fontSize:15,cursor:"pointer"}}>Cauta</button></div>{loading&&<EmptyState icon="⏳" title="Se incarca rezultatele..."/>}{results&&!loading&&<div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:14,color:C.grayText}}><strong style={{color:C.navy}}>{results.length}</strong> keyword-uri pentru <strong style={{color:C.orange}}>"{searched}"</strong></span><span style={{fontSize:12,background:"#E8F5E9",color:"#2E7D32",padding:"3px 10px",borderRadius:12,fontWeight:500}}>🇷🇴 Romania</span></div><div style={{display:"flex",gap:8}}>{selected.size>0&&<button onClick={handleAddToTracker} style={{padding:"8px 16px",background:added?"#E8F5E9":C.orangeLight,border:`1.5px solid ${added?"#2E7D32":C.orange}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",color:added?"#2E7D32":C.orange}}>{added?"Adaugate!":`Adauga in Rank Tracker (${selected.size})`}</button>}<button onClick={()=>exportCSV(sorted,searched)} style={{padding:"8px 16px",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",color:C.grayDark}}>Export CSV</button></div></div><div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}><div style={{flex:1,position:"relative",minWidth:180}}><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>✅</span><input value={includeWord} onChange={e=>setIncludeWord(e.target.value)} placeholder="Include doar keywords cu..." style={{width:"100%",padding:"9px 12px 9px 32px",border:`1.5px solid ${C.green}`,borderRadius:8,fontSize:13,outline:"none",background:"#f0fdf4",boxSizing:"border-box",color:C.navy}}/></div><div style={{flex:1,position:"relative",minWidth:180}}><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>🚫</span><input value={excludeWord} onChange={e=>setExcludeWord(e.target.value)} placeholder="Exclude keywords cu..." style={{width:"100%",padding:"9px 12px 9px 32px",border:`1.5px solid ${C.red}`,borderRadius:8,fontSize:13,outline:"none",background:"#fef2f2",boxSizing:"border-box",color:C.navy}}/></div></div><div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.gray,borderBottom:`1px solid ${C.border}`}}><th style={{padding:"12px 16px",width:40}}><input type="checkbox" onChange={toggleAll}/></th><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em"}}># Keyword</th><th onClick={()=>setSortDir(d=>d==="desc"?"asc":"desc")} style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.orange,textTransform:"uppercase",letterSpacing:"0.05em",cursor:"pointer",width:180}}>Volum {sortDir==="desc"?"▼":"▲"}</th><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em",width:120}}>Trend 12 luni</th></tr></thead><tbody>{sorted.map((row,i)=><tr key={i} style={{borderBottom:`1px solid ${C.grayMid}`,background:selected.has(row.keyword)?C.orangeLight:"transparent"}} onMouseEnter={e=>{if(!selected.has(row.keyword))e.currentTarget.style.background=C.gray;}} onMouseLeave={e=>{e.currentTarget.style.background=selected.has(row.keyword)?C.orangeLight:"transparent";}}><td style={{padding:"13px 16px",textAlign:"center"}}><input type="checkbox" checked={selected.has(row.keyword)} onChange={()=>toggleSelect(row.keyword)}/></td><td style={{padding:"13px 16px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:11,color:C.grayMid,minWidth:20}}>{i+1}</span><span style={{fontWeight:500,fontSize:14,color:C.navy}}>{row.keyword}</span></div></td><td style={{padding:"13px 16px"}}><VolumeBar volume={row.volume} max={maxVol}/></td><td style={{padding:"13px 16px"}}><MiniTrend data={row.trend}/></td></tr>)}</tbody></table></div><p style={{marginTop:14,fontSize:12,color:C.grayText,textAlign:"center"}}>* Date simulate</p></div>}{!results&&!loading&&<EmptyState icon="🔎" title="Introdu un cuvant cheie pentru a incepe" subtitle='Ex: "bec led", "pantofi sport", "telefon samsung"'/>}</div>;}

// ── Blog Topics ───────────────────────────────────────────────────────────────
function BlogTopics(){const[query,setQuery]=useState("");const[results,setResults]=useState(null);const[loading,setLoading]=useState(false);const[searched,setSearched]=useState("");const[filter,setFilter]=useState("all");const[includeWord,setIncludeWord]=useState("");const[excludeWord,setExcludeWord]=useState("");const handleSearch=async()=>{if(!query.trim())return;setLoading(true);setResults(null);try{const res=await fetch('/api/blogtopics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});const data=await res.json();setResults(data.topics||[]);setSearched(query);setFilter("all");}catch(e){console.error(e);setResults([]);}finally{setLoading(false);}};const filtered=results?results.filter(r=>r.volume>0).filter(r=>filter==="all"||r.type===filter).filter(r=>includeWord.trim()===""||r.topic.toLowerCase().includes(includeWord.toLowerCase())).filter(r=>excludeWord.trim()===""||!r.topic.toLowerCase().includes(excludeWord.toLowerCase())):[];const maxVol=filtered.length?Math.max(...filtered.map(r=>r.volume)):1;return <div><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Blog Topic Finder</h1><p style={{color:C.grayText,fontSize:14,marginBottom:24}}>Descopera idei de articole de blog cu volum mare de cautari.</p><div style={{display:"flex",gap:10,marginBottom:28}}><div style={{flex:1,position:"relative"}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.grayText}}>✍️</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} placeholder="Ex: asigurare auto, credit ipotecar..." style={{width:"100%",padding:"12px 14px 12px 42px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,outline:"none",background:C.white,boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/></div><button onClick={handleSearch} style={{padding:"12px 28px",background:C.orange,color:C.white,border:"none",borderRadius:10,fontWeight:600,fontSize:15,cursor:"pointer"}}>Cauta</button></div>{loading&&<EmptyState icon="⏳" title="Se incarca rezultatele..."/>}{results&&!loading&&<div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}><span style={{fontSize:14,color:C.grayText}}><strong style={{color:C.navy}}>{filtered.length}</strong> subiecte pentru <strong style={{color:C.orange}}>"{searched}"</strong></span><div style={{display:"flex",gap:6}}>{[["all","Toate"],["direct","Direct legate"],["related","Conexe"]].map(([val,label])=><button key={val} onClick={()=>setFilter(val)} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid",fontSize:13,cursor:"pointer",fontWeight:500,borderColor:filter===val?C.orange:C.border,background:filter===val?C.orangeLight:C.white,color:filter===val?C.orange:C.grayText}}>{label}</button>)}</div></div><div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}><div style={{flex:1,position:"relative",minWidth:180}}><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>✅</span><input value={includeWord} onChange={e=>setIncludeWord(e.target.value)} placeholder="Include doar subiecte cu..." style={{width:"100%",padding:"9px 12px 9px 32px",border:`1.5px solid ${C.green}`,borderRadius:8,fontSize:13,outline:"none",background:"#f0fdf4",boxSizing:"border-box",color:C.navy}}/></div><div style={{flex:1,position:"relative",minWidth:180}}><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>🚫</span><input value={excludeWord} onChange={e=>setExcludeWord(e.target.value)} placeholder="Exclude subiecte cu..." style={{width:"100%",padding:"9px 12px 9px 32px",border:`1.5px solid ${C.red}`,borderRadius:8,fontSize:13,outline:"none",background:"#fef2f2",boxSizing:"border-box",color:C.navy}}/></div></div><div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:C.gray,borderBottom:`1px solid ${C.border}`}}><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em",width:40}}>#</th><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em"}}>Subiect</th><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em",width:120}}>Tip</th><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em",width:160}}>Volum lunar</th></tr></thead><tbody>{filtered.map((row,i)=>{const isDirect=row.type==="direct";return <tr key={i} style={{borderBottom:`1px solid ${C.grayMid}`}} onMouseEnter={e=>e.currentTarget.style.background=C.gray} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><td style={{padding:"13px 16px",fontSize:12,color:C.grayMid}}>{i+1}</td><td style={{padding:"13px 16px",fontWeight:500,fontSize:14,color:C.navy}}>{row.topic}</td><td style={{padding:"13px 16px"}}><span style={{fontSize:11,padding:"3px 10px",borderRadius:12,fontWeight:500,background:isDirect?C.orangeLight:"#EEF1F8",color:isDirect?C.orange:C.navy}}>{isDirect?"Direct":"Conex"}</span></td><td style={{padding:"13px 16px"}}><VolumeBar volume={row.volume} max={maxVol} color={isDirect?C.orange:C.navy}/></td></tr>;})}</tbody></table></div></div>}{!results&&!loading&&<EmptyState icon="✍️" title="Introdu un subiect pentru a descoperi idei de blog"/>}</div>;}
// ── Rank Tracker ──────────────────────────────────────────────────────────────
function RankTracker({pendingKeywords,onPendingConsumed,onProjectsLoaded,initialProjectId,userId}){
  const[isMobile,setIsMobile]=useState(false);
  useEffect(()=>{setIsMobile(window.innerWidth<768);const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  const[projects,setProjects]=useState(null);const[loading,setLoading]=useState(true);const[activeProject,setActiveProject]=useState(initialProjectId||null);const[showNewProject,setShowNewProject]=useState(false);const[newProjectName,setNewProjectName]=useState("");const[newProjectUrl,setNewProjectUrl]=useState("");const[newKw,setNewKw]=useState("");const[newDevice,setNewDevice]=useState("desktop");const[activeDevice,setActiveDevice]=useState("desktop");const[showAddKw,setShowAddKw]=useState(false);const[showBulkAdd,setShowBulkAdd]=useState(false);const[bulkText,setBulkText]=useState("");const[sortKw,setSortKw]=useState("volume_desc");const[checking,setChecking]=useState(false);const[checkProgress,setCheckProgress]=useState({done:0,total:0});const[checkingKwIds,setCheckingKwIds]=useState(new Set());const[updatingVolumes,setUpdatingVolumes]=useState(false);const[showDeleteConfirm,setShowDeleteConfirm]=useState(false);const[deleting,setDeleting]=useState(false);
  useEffect(()=>{loadProjects(userId).then(p=>{const ps=p||[];setProjects(ps);if(initialProjectId)setActiveProject(initialProjectId);else if(ps.length>0)setActiveProject(ps[0].id);setLoading(false);onProjectsLoaded&&onProjectsLoaded(ps);}).catch(()=>{setProjects([]);setLoading(false);});},[userId]);
  useEffect(()=>{if(initialProjectId)setActiveProject(initialProjectId);},[initialProjectId]);
  useEffect(()=>{if(pendingKeywords&&pendingKeywords.length>0&&projects&&projects.length>0){addKeywordsToProject(activeProject||projects[0].id,pendingKeywords);onPendingConsumed();}},[pendingKeywords,projects]);
  const saveAndUpdate=updated=>{setProjects(updated);saveProjects(updated,userId);onProjectsLoaded&&onProjectsLoaded(updated);};
  const addProject=()=>{if(!newProjectName.trim())return;const proj={id:Date.now(),name:newProjectName.trim(),url:newProjectUrl.trim(),keywords:[]};const updated=[...(projects||[]),proj];saveAndUpdate(updated);setActiveProject(proj.id);setShowNewProject(false);setNewProjectName("");setNewProjectUrl("");};
  const fetchAndSaveVolumes=async(projId,kwList)=>{
    if(!kwList?.length)return;
    try{
      const res=await fetch('/api/keyword-volumes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keywords:kwList.map(k=>k.keyword)})});
      const{volumes}=await res.json();
      let savedUpdated=null;
      setProjects(prev=>{
        const updated=(prev||[]).map(p=>{
          if(p.id!==projId)return p;
          const newKws=p.keywords.map(k=>{
            const vol=volumes[k.keyword.toLowerCase()];
            return vol!=null?{...k,volume:vol}:k;
          });
          return{...p,keywords:newKws};
        });
        savedUpdated=updated;
        return updated;
      });
      setTimeout(()=>{
        if(savedUpdated){saveProjects(savedUpdated,userId);onProjectsLoaded&&onProjectsLoaded(savedUpdated);}
      },0);
      if(supabase){
        for(const kw of kwList){
          const vol=volumes[kw.keyword.toLowerCase()];
          if(vol!=null)await supabase.from('keywords').update({volume:vol}).eq('id',String(kw.id));
        }
      }
    }catch(e){console.error('[fetchAndSaveVolumes]',e.message);}
  };
  const addKeywordsToProject=(projId,keywords,onDone)=>{
    const newKwObjects=[];
    const updated=(projects||[]).map(p=>{
      if(p.id!==projId)return p;
      const existingLower=new Set(p.keywords.map(k=>k.keyword.toLowerCase()));
      const newOnes=keywords.filter(kw=>!existingLower.has(kw.toLowerCase())).map(kw=>{
        const obj={id:Date.now()+Math.random(),keyword:kw,position:0,position_desktop:null,position_mobile:null,url:"",history:[]};
        newKwObjects.push(obj);return obj;
      });
      const dupes=keywords.length-newOnes.length;
      if(onDone)onDone(newOnes.length,dupes);
      return{...p,keywords:[...p.keywords,...newOnes]};
    });
    saveAndUpdate(updated);
    if(newKwObjects.length)setTimeout(()=>fetchAndSaveVolumes(projId,newKwObjects),300);
  };
  const addSingleKeyword=projId=>{if(!newKw.trim())return;addKeywordsToProject(projId,[newKw.trim()],(added,dupes)=>{if(dupes>0)alert(`Keyword deja există în proiect.`);});setNewKw("");setShowAddKw(false);};
  const addBulkKeywords=projId=>{const kws=bulkText.split('\n').map(k=>k.trim()).filter(Boolean);if(!kws.length)return;addKeywordsToProject(projId,kws,(added,dupes)=>{const msg=dupes>0?`${added} keywords adăugate, ${dupes} duplicate ignorate.`:`${added} keywords adăugate.`;alert(msg);});setBulkText("");setShowBulkAdd(false);};
  const removeKeyword=async(projId,kwId)=>{
    if(supabase){
      const{error}=await supabase.from('keywords').delete().eq('id',String(kwId));
      if(error)console.log('Supabase error details:',JSON.stringify(error));
    }
    saveAndUpdate((projects||[]).map(p=>p.id!==projId?p:{...p,keywords:p.keywords.filter(k=>k.id!==kwId)}));
  };
  const updateUrl=(projId,kwId,url)=>saveAndUpdate((projects||[]).map(p=>p.id!==projId?p:{...p,keywords:p.keywords.map(k=>k.id!==kwId?k:{...k,url})}));
  const deleteProject=async projId=>{
    if(supabase&&userId){
      const proj=(projects||[]).find(p=>p.id===projId);
      if(proj){
        for(const kw of proj.keywords||[]){
          const{error:hErr}=await supabase.from('keyword_history').delete().eq('keyword_id',String(kw.id));
          if(hErr)console.log('Supabase error details:',JSON.stringify(hErr));
        }
        const{error:kErr}=await supabase.from('keywords').delete().eq('project_id',String(projId));
        if(kErr)console.log('Supabase error details:',JSON.stringify(kErr));
      }
      const{error:pErr}=await supabase.from('projects').delete().eq('id',String(projId));
      if(pErr){console.log('Supabase error details:',JSON.stringify(pErr));return;}
    }
    const updated=(projects||[]).filter(p=>p.id!==projId);
    setProjects(updated);
    onProjectsLoaded&&onProjectsLoaded(updated);
    setActiveProject(updated.length>0?updated[0].id:null);
  };
  const updateAllVolumes=async()=>{
    const proj=(projects||[]).find(p=>p.id===activeProject);
    if(!proj?.keywords?.length)return;
    setUpdatingVolumes(true);
    await fetchAndSaveVolumes(proj.id,proj.keywords);
    setUpdatingVolumes(false);
  };
  const checkNow=async()=>{
    const proj=(projects||[]).find(p=>p.id===activeProject);
    if(!proj)return;
    setChecking(true);
    const total=(proj.keywords||[]).length;
    flushSync(()=>setCheckProgress({done:0,total}));
    const today=new Date().toISOString().split('T')[0];
    const updatedKeywords=[];
    for(let i=0;i<total;i++){
      const kw=proj.keywords[i];
      try{
        const res=await fetch('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword:kw.keyword,url:proj.url,device:activeDevice})});
        const data=await res.json();
        const newPos=data.position??null;
        const rankUrl=data.url||kw.url||'';
        const posField=activeDevice==='mobile'?'position_mobile':'position_desktop';
        if(supabase){
          await supabase.from('keywords').update({[posField]:newPos,position:newPos??kw.position,url:rankUrl}).eq('id',String(kw.id));
          const{data:existing}=await supabase.from('keyword_history').select('id').eq('keyword_id',String(kw.id)).eq('date',today).maybeSingle();
          if(existing){await supabase.from('keyword_history').update({position:newPos}).eq('id',existing.id);}
          else if(newPos!=null){await supabase.from('keyword_history').insert({keyword_id:String(kw.id),position:newPos,date:today});}
        }
        const prevHistory=(kw.history||[]).filter(h=>h.date!==today).slice(-29);
        const history=newPos!=null?[...prevHistory,{date:today,position:newPos}]:kw.history||[];
        updatedKeywords.push({...kw,[posField]:newPos,position:newPos??kw.position,url:rankUrl,history});
      }catch(e){
        console.error('checkNow error pentru',kw.keyword,e.message);
        updatedKeywords.push(kw);
      }
      flushSync(()=>setCheckProgress({done:i+1,total}));
      if(i<total-1)await new Promise(r=>setTimeout(r,200));
    }
    const updated=(projects||[]).map(p=>p.id!==activeProject?p:{...p,keywords:updatedKeywords});
    setProjects(updated);
    onProjectsLoaded&&onProjectsLoaded(updated);
    setChecking(false);
  };
  const checkSingleKeyword=async(projId,kw)=>{
    const proj=(projects||[]).find(p=>p.id===projId);
    if(!proj)return;
    setCheckingKwIds(prev=>new Set([...prev,kw.id]));
    const today=new Date().toISOString().split('T')[0];
    try{
      const res=await fetch('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword:kw.keyword,url:proj.url,device:activeDevice})});
      const data=await res.json();
      const newPos=data.position??null;
      const rankUrl=data.url||kw.url||'';
      const posField=activeDevice==='mobile'?'position_mobile':'position_desktop';
      if(supabase){
        await supabase.from('keywords').update({[posField]:newPos,position:newPos??kw.position,url:rankUrl}).eq('id',String(kw.id));
        const{data:existing}=await supabase.from('keyword_history').select('id').eq('keyword_id',String(kw.id)).eq('date',today).maybeSingle();
        if(existing){await supabase.from('keyword_history').update({position:newPos}).eq('id',existing.id);}
        else if(newPos!=null){await supabase.from('keyword_history').insert({keyword_id:String(kw.id),position:newPos,date:today});}
      }
      const prevHistory=(kw.history||[]).filter(h=>h.date!==today).slice(-29);
      const history=newPos!=null?[...prevHistory,{date:today,position:newPos}]:kw.history||[];
      const updated=(projects||[]).map(p=>p.id!==projId?p:{...p,keywords:p.keywords.map(k=>k.id!==kw.id?k:{...k,[posField]:newPos,position:newPos??kw.position,url:rankUrl,history})});
      setProjects(updated);onProjectsLoaded&&onProjectsLoaded(updated);
    }catch(e){console.error('checkSingleKeyword error',kw.keyword,e.message);}
    finally{setCheckingKwIds(prev=>{const s=new Set(prev);s.delete(kw.id);return s;});}
  };
  const getSortedKeywords=keywords=>{if(!keywords)return[];const kws=[...keywords];if(sortKw==="volume_desc")return kws.sort((a,b)=>(b.volume||0)-(a.volume||0));if(sortKw==="volume_asc")return kws.sort((a,b)=>(a.volume||0)-(b.volume||0));if(sortKw==="pos_asc")return kws.sort((a,b)=>a.position-b.position);if(sortKw==="pos_desc")return kws.sort((a,b)=>b.position-a.position);if(sortKw==="alpha")return kws.sort((a,b)=>a.keyword.localeCompare(b.keyword));return kws;};
  if(loading)return <EmptyState icon="⏳" title="Se incarca..."/>;
  const proj=projects?.find(p=>p.id===activeProject);
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Rank Tracker</h1><p style={{color:C.grayText,fontSize:14}}>Monitorizeaza pozitiile site-ului tau in Google.</p></div>
        <button onClick={()=>setShowNewProject(true)} style={{padding:"10px 18px",background:C.orange,color:C.white,border:"none",borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer"}}>+ Proiect nou</button>
      </div>
      {showDeleteConfirm&&proj&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}><div style={{background:C.white,borderRadius:16,padding:32,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}><div style={{fontSize:36,marginBottom:12,textAlign:"center"}}>🗑</div><h2 style={{fontSize:18,fontWeight:700,marginBottom:8,textAlign:"center",color:C.navy}}>Sterge proiect</h2><p style={{fontSize:14,color:C.grayText,textAlign:"center",marginBottom:6}}>Ești sigur că vrei să ștergi proiectul</p><p style={{fontSize:15,fontWeight:700,color:"#ef4444",textAlign:"center",marginBottom:24}}>"{proj.name}"?</p><p style={{fontSize:12,color:C.grayText,textAlign:"center",marginBottom:24,padding:"8px 12px",background:"#fff5f5",borderRadius:8,border:"1px solid #fca5a5"}}>Această acțiune este ireversibilă. Se vor șterge proiectul, toate keyword-urile și tot istoricul de poziții.</p><div style={{display:"flex",gap:10}}><button disabled={deleting} onClick={async()=>{setDeleting(true);await deleteProject(proj.id);setShowDeleteConfirm(false);setDeleting(false);}} style={{flex:1,padding:"11px",background:deleting?"#fca5a5":"#ef4444",color:C.white,border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:deleting?"not-allowed":"pointer"}}>{deleting?"Se sterge...":"Da, sterge"}</button><button disabled={deleting} onClick={()=>setShowDeleteConfirm(false)} style={{flex:1,padding:"11px",background:C.gray,border:`1.5px solid ${C.border}`,borderRadius:8,fontWeight:600,fontSize:14,cursor:"pointer",color:C.grayDark}}>Anulează</button></div></div></div>}
      {showNewProject&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}><div style={{background:C.white,borderRadius:16,padding:32,width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}><h2 style={{fontSize:18,fontWeight:700,marginBottom:20}}>Proiect nou</h2><div style={{marginBottom:14}}><label style={{fontSize:13,fontWeight:500,color:C.grayDark,display:"block",marginBottom:6}}>Nume proiect</label><input value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="Ex: Site-ul meu" style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/></div><div style={{marginBottom:24}}><label style={{fontSize:13,fontWeight:500,color:C.grayDark,display:"block",marginBottom:6}}>URL site</label><input value={newProjectUrl} onChange={e=>setNewProjectUrl(e.target.value)} placeholder="Ex: https://siteulmeu.ro" style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/></div><div style={{display:"flex",gap:10}}><button onClick={addProject} style={{flex:1,padding:"10px",background:C.orange,color:C.white,border:"none",borderRadius:8,fontWeight:600,cursor:"pointer"}}>Creeaza</button><button onClick={()=>setShowNewProject(false)} style={{flex:1,padding:"10px",background:C.gray,border:`1.5px solid ${C.border}`,borderRadius:8,fontWeight:500,cursor:"pointer",color:C.grayText}}>Anuleaza</button></div></div></div>}
      {projects?.length>0&&<div style={{display:"flex",gap:20,flexDirection:isMobile?"column":"row"}}>
        {isMobile?(
          <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,fontWeight:600,color:C.grayText,whiteSpace:"nowrap"}}>📂 Proiect:</span>
            <select value={activeProject||""} onChange={e=>setActiveProject(e.target.value)}
              style={{flex:1,padding:"8px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",background:C.white,cursor:"pointer",color:C.navy,fontWeight:600}}>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name} ({p.keywords.length} kw)</option>)}
            </select>
          </div>
        ):(
          <div style={{width:200,flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Proiecte</div>
            {projects.map(p=><div key={p.id} onClick={()=>setActiveProject(p.id)} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",marginBottom:4,background:activeProject===p.id?C.orangeLight:"transparent",border:`1.5px solid ${activeProject===p.id?C.orange:"transparent"}`}}><div style={{fontWeight:600,fontSize:13,color:activeProject===p.id?C.orange:C.navy}}>{p.name}</div><div style={{fontSize:11,color:C.grayText,marginTop:2}}>{p.keywords.length} keywords</div></div>)}
          </div>
        )}
        {proj&&<div style={{flex:1,minWidth:0}}>
          <div style={{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}><div><div style={{fontWeight:700,fontSize:16,color:C.navy}}>{proj.name}</div>{proj.url&&<div style={{fontSize:12,color:C.orange,marginTop:2}}>{proj.url}</div>}</div><button onClick={()=>{const updated=(projects||[]).map(p=>p.id!==proj.id?p:{...p,auto_check:!proj.auto_check});saveAndUpdate(updated);}} title="Activează/dezactivează verificarea automată zilnică" style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px",borderRadius:8,border:`1.5px solid ${proj.auto_check!==false?C.orange:C.border}`,background:proj.auto_check!==false?C.orangeLight:C.gray,cursor:"pointer",fontSize:12,fontWeight:600,color:proj.auto_check!==false?C.orange:C.grayText,whiteSpace:"nowrap"}}><span style={{width:28,height:16,borderRadius:8,background:proj.auto_check!==false?"#f97316":"#d1d5db",display:"inline-block",position:"relative",transition:"background 0.2s",flexShrink:0}}><span style={{position:"absolute",top:2,left:proj.auto_check!==false?14:2,width:12,height:12,borderRadius:"50%",background:C.white,transition:"left 0.2s"}}/></span>Verificare automată zilnică</button></div>
          {proj.keywords.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.grayText,background:C.white,borderRadius:12,border:`1px solid ${C.border}`}}><div style={{fontSize:40,marginBottom:12}}>📊</div><p style={{fontSize:14,color:C.grayDark}}>Niciun keyword adaugat inca</p><p style={{fontSize:12,marginTop:4,marginBottom:20}}>Adauga manual sau importa din Keyword Research</p><div style={{display:"flex",gap:10,justifyContent:"center",padding:"0 20px",flexWrap:"wrap"}}><input value={newKw} onChange={e=>setNewKw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSingleKeyword(proj.id)} placeholder="Ex: pantofi sport ieftini" style={{padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",width:260}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/><button onClick={()=>addSingleKeyword(proj.id)} style={{padding:"9px 18px",background:C.orange,color:C.white,border:"none",borderRadius:8,fontWeight:600,fontSize:14,cursor:"pointer"}}>Adauga</button></div></div>
          :<div>
            <ProjectChart keywords={proj.keywords} activeDevice={activeDevice}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <select value={sortKw} onChange={e=>setSortKw(e.target.value)} style={{padding:"8px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",background:C.white,cursor:"pointer",color:C.navy}}><option value="pos_asc">Pozitie ▲</option><option value="pos_desc">Pozitie ▼</option><option value="volume_desc">Volum ▼</option><option value="volume_asc">Volum ▲</option><option value="alpha">Alfabetic</option></select>
                <button onClick={checkNow} disabled={checking} style={{padding:"8px 16px",background:checking?C.grayMid:C.orangeLight,color:checking?C.grayText:C.orange,border:`1.5px solid ${checking?C.grayMid:C.orange}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:checking?"not-allowed":"pointer"}}>{checking?`Se verifică ${checkProgress.done}/${checkProgress.total}`:"Verifică acum"}</button>
                <button onClick={updateAllVolumes} disabled={updatingVolumes} style={{padding:"8px 16px",background:updatingVolumes?C.grayMid:C.white,color:updatingVolumes?C.grayText:C.navy,border:`1.5px solid ${updatingVolumes?C.grayMid:C.border}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:updatingVolumes?"not-allowed":"pointer"}}>{updatingVolumes?"Se actualizează...":"🔄 Actualizează volume"}</button>
                <div style={{display:"flex",gap:4}}>{[["desktop","🖥 Desktop"],["mobile","📱 Mobil"]].map(([val,label])=><button key={val} onClick={()=>setActiveDevice(val)} style={{padding:"4px 10px",fontSize:12,borderRadius:6,border:`1.5px solid ${activeDevice===val?C.orange:C.border}`,cursor:"pointer",fontWeight:600,background:activeDevice===val?C.orangeLight:C.gray,color:activeDevice===val?C.orange:C.navy}}>{label}</button>)}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setShowAddKw(v=>!v);setShowBulkAdd(false);}} style={{padding:"8px 16px",background:C.orangeLight,border:`1.5px solid ${C.orange}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",color:C.orange}}>+ Adauga keyword</button>
                <button onClick={()=>{setShowBulkAdd(v=>!v);setShowAddKw(false);}} style={{padding:"8px 16px",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",color:C.navy}}>+ Adaugă în bulk</button>
              </div>
            </div>
            {showAddKw&&<div style={{background:C.gray,border:`1.5px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:16,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}><div style={{flex:1,minWidth:180}}><label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:4}}>Keyword</label><input value={newKw} onChange={e=>setNewKw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSingleKeyword(proj.id)} placeholder="Ex: pantofi sport ieftini" style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/></div><div><label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:4}}>Dispozitiv</label><select value={newDevice} onChange={e=>setNewDevice(e.target.value)} style={{padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",background:C.white,cursor:"pointer"}}><option value="desktop">Desktop</option><option value="mobile">Mobil</option></select></div><button onClick={()=>addSingleKeyword(proj.id)} style={{padding:"9px 18px",background:C.orange,color:C.white,border:"none",borderRadius:8,fontWeight:600,fontSize:14,cursor:"pointer"}}>Adauga</button></div>}
            {showBulkAdd&&<div style={{background:C.gray,border:`1.5px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:16}}><label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:6}}>Keywords — unul pe linie (lipește din Excel)</label><textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} rows={8} placeholder={"pantofi sport\npantofi dama\npantofi barbati\n..."} style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/><div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}><button onClick={()=>addBulkKeywords(proj.id)} disabled={!bulkText.trim()} style={{padding:"9px 20px",background:bulkText.trim()?C.orange:C.grayMid,color:C.white,border:"none",borderRadius:8,fontWeight:600,fontSize:13,cursor:bulkText.trim()?"pointer":"default"}}>Adaugă toate ({bulkText.split('\n').filter(l=>l.trim()).length})</button><button onClick={()=>{setShowBulkAdd(false);setBulkText("");}} style={{padding:"9px 16px",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,cursor:"pointer",color:C.grayDark}}>Anulează</button></div></div>}
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}><thead><tr style={{background:C.gray,borderBottom:`1px solid ${C.border}`}}><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em"}}>Keyword</th><th style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em",width:120}}>Pozitie</th><th style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em",width:80}}>Volum</th><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em"}}>URL</th><th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.05em",width:220}}>Evolutie</th><th style={{padding:"12px 16px",width:40}}></th></tr></thead><tbody>{getSortedKeywords(proj.keywords).map(kw=><tr key={kw.id} style={{borderBottom:`1px solid ${C.grayMid}`}} onMouseEnter={e=>e.currentTarget.style.background=C.gray} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><td style={{padding:"13px 16px",fontWeight:500,fontSize:14,color:C.navy}}>{kw.keyword}</td><td style={{padding:"13px 16px",textAlign:"center"}}><PositionBadge pos={activeDevice==='mobile'?kw.position_mobile:kw.position_desktop}/></td><td style={{padding:"13px 16px",textAlign:"center",fontSize:13,fontWeight:600,color:C.grayText}}>{kw.volume>0?fmtN(kw.volume):"—"}</td><td style={{padding:"13px 16px"}}><input value={kw.url} onChange={e=>updateUrl(proj.id,kw.id,e.target.value)} placeholder="https://..." style={{width:"100%",padding:"5px 8px",border:`1.5px solid ${C.border}`,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box",color:C.orange}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/></td><td style={{padding:"13px 16px"}}><PositionChart history={kw.history}/></td><td style={{padding:"13px 16px"}}><div style={{display:"flex",gap:4,alignItems:"center"}}><button onClick={()=>checkSingleKeyword(proj.id,kw)} disabled={checkingKwIds.has(kw.id)} title="Verifică poziția acum" style={{background:"none",border:"none",cursor:checkingKwIds.has(kw.id)?"default":"pointer",fontSize:15,padding:4,opacity:checkingKwIds.has(kw.id)?0.5:1}}>{checkingKwIds.has(kw.id)?"⏳":"🔄"}</button><button onClick={()=>removeKeyword(proj.id,kw.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#fca5a5",padding:4}}>×</button></div></td></tr>)}</tbody></table></div>
            <div style={{borderTop:`1px solid ${C.border}`,marginTop:32,paddingTop:20}}>
              <button onClick={()=>setShowDeleteConfirm(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",background:"#fff5f5",border:"1.5px solid #fca5a5",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",color:"#ef4444"}}>🗑 Șterge proiect</button>
            </div>
          </div>}
        </div>}
      </div>}
    </div>
  );
}

// ── Forecasting ───────────────────────────────────────────────────────────────
function Forecasting() {
  const [convRate, setConvRate] = useState(2);
  const [avgOrder, setAvgOrder] = useState(250);
  const [monthlyCost, setMonthlyCost] = useState(2000);
  const [horizon, setHorizon] = useState(12);
  const [scenario, setScenario] = useState("realistic");
  const [customPos, setCustomPos] = useState(10);
  const forecastRef = useRef(null);
  const [showCrawlModal, setShowCrawlModal] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlResults, setCrawlResults] = useState(null);
  const [crawlError, setCrawlError] = useState('');
  const [selectedCrawlKws, setSelectedCrawlKws] = useState(new Set());
  const [siteUrl, setSiteUrl] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [kwInput, setKwInput] = useState("");
  const [chartTip, setChartTip] = useState(null);
  const [showBulkForecast, setShowBulkForecast] = useState(false);
  const [bulkForecastText, setBulkForecastText] = useState("");

  const SCEN_TARGET = { optimistic: 2, realistic: 5, pessimistic: 15, custom: customPos };
  const SEO_CURVE = [0.05, 0.10, 0.18, 0.30, 0.45, 0.60, 0.72, 0.80, 0.86, 0.91, 0.95, 1.00];
  const SCEN_COLOR  = { optimistic: C.green, realistic: C.navy, pessimistic: C.grayText, custom: C.orange };
  const SCEN_LABEL  = { optimistic: "Optimist", realistic: "Realist", pessimistic: "Pesimist", custom: "Custom" };

  const targetPos = SCEN_TARGET[scenario];

  const addKeyword = async () => {
    const kw = kwInput.trim();
    if (!kw) return;
    setKwInput("");
    const id = Date.now();
    setKeywords(prev => [...prev, { id, keyword: kw, volume: 0, currentPos: 50, loading: true }]);
    const [volRes, rankRes] = await Promise.allSettled([
      fetch('/api/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: [kw] }) }).then(r => r.json()),
      fetch('/api/rankings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: kw, url: siteUrl }) }).then(r => r.json()),
    ]);
    const volume     = volRes.status  === 'fulfilled' ? (volRes.value?.tasks?.[0]?.result?.[0]?.search_volume || 0) : 0;
    const currentPos = rankRes.status === 'fulfilled' ? (rankRes.value?.position || 50) : 50;
    setKeywords(prev => prev.map(k => k.id === id ? { ...k, volume, currentPos, loading: false } : k));
  };

  const removeKeyword = id => setKeywords(prev => prev.filter(k => k.id !== id));

  const resetForm = () => {
    setKeywords([]);
    setConvRate(2);
    setAvgOrder(250);
    setMonthlyCost(2000);
    setHorizon(12);
    setScenario("realistic");
    setCustomPos(10);
    setSiteUrl("");
    setKwInput("");
    setBulkForecastText("");
    setShowBulkForecast(false);
  };

  const addBulkForecastKeywords = async () => {
    const existing = new Set(keywords.map(k => k.keyword.toLowerCase()));
    const lines = bulkForecastText.split('\n').map(l => l.trim()).filter(l => l && !existing.has(l.toLowerCase()));
    const unique = [...new Set(lines.map(l => l.toLowerCase())).values()].map(l => lines.find(x => x.toLowerCase() === l));
    setBulkForecastText("");
    setShowBulkForecast(false);
    for (const kw of unique) {
      const id = Date.now() + Math.random();
      setKeywords(prev => [...prev, { id, keyword: kw, volume: 0, currentPos: 50, loading: true }]);
      const [volRes, rankRes] = await Promise.allSettled([
        fetch('/api/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: [kw] }) }).then(r => r.json()),
        fetch('/api/rankings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: kw, url: siteUrl }) }).then(r => r.json()),
      ]);
      const volume     = volRes.status  === 'fulfilled' ? (volRes.value?.tasks?.[0]?.result?.[0]?.search_volume || 0) : 0;
      const currentPos = rankRes.status === 'fulfilled' ? (rankRes.value?.position || 50) : 50;
      setKeywords(prev => prev.map(k => k.id === id ? { ...k, volume, currentPos, loading: false } : k));
    }
  };

  const runCrawl = async () => {
    if (!crawlUrl.trim()) return;
    setCrawlLoading(true);
    setCrawlError('');
    setCrawlResults(null);
    setSelectedCrawlKws(new Set());
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCrawlError(data.error || 'Eroare la crawl'); }
      else { setCrawlResults(data); }
    } catch {
      setCrawlError('Eroare de rețea. Încearcă din nou.');
    } finally {
      setCrawlLoading(false);
    }
  };

  const importCrawlKws = async () => {
    const toImport = crawlResults?.keywords?.filter(k => selectedCrawlKws.has(k)) || [];
    setShowCrawlModal(false);
    setCrawlResults(null);
    setCrawlUrl('');
    setSelectedCrawlKws(new Set());
    for (const kw of toImport) {
      const id = Date.now() + Math.random();
      setKeywords(prev => [...prev, { id, keyword: kw, volume: 0, currentPos: 50, loading: true }]);
      const [volRes, rankRes] = await Promise.allSettled([
        fetch('/api/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: [kw] }) }).then(r => r.json()),
        fetch('/api/rankings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: kw, url: siteUrl }) }).then(r => r.json()),
      ]);
      const volume     = volRes.status  === 'fulfilled' ? (volRes.value?.tasks?.[0]?.result?.[0]?.search_volume || 0) : 0;
      const currentPos = rankRes.status === 'fulfilled' ? (rankRes.value?.position || 50) : 50;
      setKeywords(prev => prev.map(k => k.id === id ? { ...k, volume, currentPos, loading: false } : k));
    }
  };

  const printForecast = () => {
    const content = forecastRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank', 'width=1000,height=800');
    w.document.write(`<!DOCTYPE html><html lang="ro"><head>
      <meta charset="UTF-8"/>
      <title>SEO Forecast — ${SCEN_LABEL[scenario]}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Inter,'Segoe UI',Arial,sans-serif;color:#1A2B4A;padding:32px;font-size:13px;line-height:1.5;background:#fff;}
        h1{font-size:22px;font-weight:700;margin-bottom:4px;}
        h2{font-size:15px;font-weight:700;margin:20px 0 10px;}
        table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:12px;}
        th{background:#F5F6F8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;padding:8px 12px;text-align:left;border-bottom:2px solid #E2E5EA;}
        td{padding:8px 12px;border-bottom:1px solid #E8EAED;vertical-align:middle;}
        tr:last-child td{border-bottom:none;}
        svg{max-width:100%;height:auto;}
        button{display:none!important;}
        input[type=number]{border:none;background:transparent;font-weight:700;font-size:13px;color:#1A2B4A;}
        select{border:none;background:transparent;font-size:13px;color:#1A2B4A;}
        .no-print{display:none!important;}
        @page{margin:1.5cm;size:A4;}
        @media print{body{padding:0;}}
      </style>
    </head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };

  const calcKw = kw => {
    const curCTR = getCTR(kw.currentPos);
    const tgtCTR = getCTR(targetPos);
    const curTraffic = Math.round((kw.volume || 0) * curCTR);
    const tgtTraffic = Math.round((kw.volume || 0) * tgtCTR);
    return { ...kw, targetPos, curCTR, tgtCTR, curTraffic, tgtTraffic, trafficGain: tgtTraffic - curTraffic };
  };

  const calcedKws = keywords.filter(k => !k.loading).map(calcKw);
  const totalVolume = calcedKws.reduce((s, k) => s + (k.volume || 0), 0);
  const totalCurTraffic = calcedKws.reduce((s, k) => s + k.curTraffic, 0);
  const totalTgtTraffic = calcedKws.reduce((s, k) => s + k.tgtTraffic, 0);
  const totalGain = totalTgtTraffic - totalCurTraffic;
  const CONV_MULTIPLIER = { optimistic: 1.3, realistic: 1.0, pessimistic: 0.7, custom: 1.0 };
  const effectiveConvRate = +(convRate * (CONV_MULTIPLIER[scenario] || 1.0)).toFixed(2);
  const months = Array.from({ length: horizon }, (_, i) => {
    const progress = i < SEO_CURVE.length ? SEO_CURVE[i] : 1.0;
    const traffic = Math.round(totalCurTraffic + totalGain * progress);
    const conversions = Math.round(traffic * (effectiveConvRate / 100));
    const revenue = conversions * avgOrder;
    return { month: i + 1, traffic, conversions, revenue, cost: monthlyCost, roi: monthlyCost > 0 ? Math.round((revenue - monthlyCost) / monthlyCost * 100) : 0 };
  });

  const finalMonth = months[months.length - 1];
  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalCost = months.reduce((s, m) => s + m.cost, 0);
  const overallROI = totalCost > 0 ? Math.round((totalRevenue - totalCost) / totalCost * 100) : 0;

  const svgW = 560, H = 130, pad = { t: 12, r: 16, b: 28, l: 44 };
  const maxTraffic = Math.max(...months.map(m => m.traffic), 1);
  const maxRev     = Math.max(...months.map(m => m.revenue), 1);
  const invY = (y, H, pad) => pad.t + (H - pad.t - pad.b) - (y - pad.t);
  const tPts = months.map((m, i) => ({ x: pad.l + (i / Math.max(months.length - 1, 1)) * (svgW - pad.l - pad.r), y: invY(pad.t + (m.traffic / maxTraffic) * (H - pad.t - pad.b), H, pad), month: m.month }));
  const rPts = months.map((m, i) => ({ x: pad.l + (i / Math.max(months.length - 1, 1)) * (svgW - pad.l - pad.r), y: invY(pad.t + (m.revenue / maxRev) * (H - pad.t - pad.b), H, pad), month: m.month }));
  const toLine = pts => pts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div ref={forecastRef}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>SEO Forecasting</h1>
        <button onClick={printForecast} className="no-print" style={{ padding: "9px 18px", background: C.navy, color: C.white, border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          📄 Descarcă PDF
        </button>
      </div>
      <p style={{ color: C.grayText, fontSize: 14, marginBottom: 24 }}>Estimează trafic, conversii, venit și ROI pe baza obiectivelor de poziționare.</p>

      {/* Parametri financiari */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
          <label style={{ fontSize: 11, color: C.grayText, fontWeight: 500, display: "block", marginBottom: 6 }}>Rată conversie (%)</label>
          <input type="number" value={convRate} min={0.1} max={20} step={0.1} onChange={e => setConvRate(parseFloat(e.target.value) || 0)} style={{ width: "100%", fontSize: 16, fontWeight: 700, color: C.navy, border: "none", outline: "none", background: "transparent", boxSizing: "border-box" }} />
          {effectiveConvRate !== convRate && (
            <div style={{ fontSize: 11, marginTop: 4, color: SCEN_COLOR[scenario], fontWeight: 600 }}>
              Efectiv: {effectiveConvRate}% ({scenario === 'optimistic' ? '+30%' : '-30%'} scenariu {SCEN_LABEL[scenario].toLowerCase()})
            </div>
          )}
        </div>
        {[{ label: "Valoare medie comandă (RON)", val: avgOrder, set: setAvgOrder, min: 1, max: 10000, step: 10 }, { label: "Cost lunar SEO (RON)", val: monthlyCost, set: setMonthlyCost, min: 0, max: 50000, step: 100 }, { label: "Orizont (luni)", val: horizon, set: setHorizon, min: 1, max: 24, step: 1 }].map((f, i) => (
          <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <label style={{ fontSize: 11, color: C.grayText, fontWeight: 500, display: "block", marginBottom: 6 }}>{f.label}</label>
            <input type="number" value={f.val} min={f.min} max={f.max} step={f.step} onChange={e => f.set(parseFloat(e.target.value) || 0)} style={{ width: "100%", fontSize: 16, fontWeight: 700, color: C.navy, border: "none", outline: "none", background: "transparent", boxSizing: "border-box" }} />
          </div>
        ))}
      </div>

      {/* Scenariu + URL site */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {["optimistic", "realistic", "pessimistic", "custom"].map(s => (
            <button key={s} onClick={() => setScenario(s)} style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid", fontSize: 13, cursor: "pointer", fontWeight: 600, borderColor: scenario === s ? SCEN_COLOR[s] : C.border, background: scenario === s ? SCEN_COLOR[s] : C.white, color: scenario === s ? C.white : C.grayText }}>
              {SCEN_LABEL[s]}{s !== "custom" && <span style={{ fontSize: 11, opacity: 0.85 }}> (poz. {SCEN_TARGET[s]})</span>}
            </button>
          ))}
          {scenario === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: C.grayText }}>Poziție țintă:</span>
              <input
                type="number" min={1} max={100} value={customPos}
                onChange={e => setCustomPos(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ width: 64, padding: "6px 8px", border: `1.5px solid ${C.orange}`, borderRadius: 7, fontSize: 14, fontWeight: 700, color: C.orange, outline: "none", textAlign: "center" }}
              />
              <span style={{ fontSize: 12, color: C.grayText }}>(1–100)</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="URL site (ex: https://site.ro) — pentru poziții reale" style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: C.navy }} onFocus={e => e.target.style.borderColor = C.orange} onBlur={e => e.target.style.borderColor = C.border} />
        </div>
      </div>

      {/* 1. Carduri sumar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Volum total / lună",           value: fmtN(totalVolume),     sub: `${calcedKws.length} keywords`,    color: C.navy,    bg: "#EEF1F8" },
          { label: "Trafic estimat / lună",         value: fmtN(totalTgtTraffic), sub: `+${fmtN(totalGain)} vizitatori`, color: C.orange,  bg: C.orangeLight },
          { label: `Venit estimat (luna ${horizon})`, value: fmtRON(finalMonth.revenue), sub: `${finalMonth.conversions} conversii`, color: C.green, bg: C.greenLight },
          { label: `ROI total (${horizon} luni)`,   value: `${overallROI}%`, sub: overallROI > 0 ? "Profitabil ✓" : "Sub break-even", color: overallROI > 0 ? C.green : C.red, bg: overallROI > 0 ? C.greenLight : C.redLight },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: C.grayText, fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.grayText }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* 2. Grafic proiecție */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Proiecție lunară — Trafic &amp; Venit</div>
        <div style={{ position: "relative" }}>
          <svg viewBox={`0 0 ${svgW} ${H}`} style={{ width: "100%", height: H }} onMouseLeave={() => setChartTip(null)} onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const mx = (e.clientX - r.left) / r.width * svgW; const near = tPts.reduce((a, b) => Math.abs(b.x - mx) < Math.abs(a.x - mx) ? b : a); setChartTip({ x: near.x, m: months[near.month - 1] }); }}>
            {[0, 0.5, 1].map((f, i) => <line key={i} x1={pad.l} y1={pad.t + f * (H - pad.t - pad.b)} x2={svgW - pad.r} y2={pad.t + f * (H - pad.t - pad.b)} stroke={C.grayMid} strokeWidth="1" strokeDasharray="4,3" />)}
            {tPts.map((p, i) => <text key={i} x={p.x} y={H - 4} fontSize="9" fill={C.grayText} textAnchor="middle">M{p.month}</text>)}
            <polyline points={toLine(tPts)} fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round" />
            <polyline points={toLine(rPts)} fill="none" stroke={C.orange} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="6,3" />
            {chartTip && <line x1={chartTip.x} y1={pad.t} x2={chartTip.x} y2={H - pad.b} stroke={C.grayMid} strokeWidth="1" strokeDasharray="3,2" />}
          </svg>
          {chartTip && <div style={{ position: "absolute", top: 8, left: chartTip.x / svgW * 100 > 65 ? "auto" : `calc(${chartTip.x / svgW * 100}% + 10px)`, right: chartTip.x / svgW * 100 > 65 ? `calc(${(1 - chartTip.x / svgW) * 100}% + 10px)` : "auto", background: C.navy, color: C.white, fontSize: 11, padding: "8px 12px", borderRadius: 8, pointerEvents: "none", lineHeight: 1.9 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Luna {chartTip.m.month}</div>
            <div><span style={{ color: "#aac4ff" }}>Trafic:</span> <strong>{fmtN(chartTip.m.traffic)}</strong></div>
            <div><span style={{ color: "#ffb899" }}>Venit:</span> <strong>{fmtRON(chartTip.m.revenue)}</strong></div>
            <div><span style={{ color: chartTip.m.roi >= 0 ? "#86efac" : "#fca5a5" }}>ROI:</span> <strong>{chartTip.m.roi}%</strong></div>
          </div>}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.grayText }}><div style={{ width: 20, height: 2.5, background: C.navy, borderRadius: 2 }} />Trafic organic</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.grayText }}><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={C.orange} strokeWidth="2.5" strokeDasharray="5,3" /></svg>Venit estimat</div>
        </div>
      </div>

      {/* 3. Formular adăugare keyword */}
      {!siteUrl.trim() && (
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, color: "#92400e" }}>Pentru rezultate relevante, te rugăm să completezi URL-ul site-ului în câmpul de mai sus înainte de a adăuga keywords.</span>
        </div>
      )}
      <div className="no-print" style={{ background: C.gray, border: `1.5px solid ${siteUrl.trim() ? C.border : "#fcd34d"}`, borderRadius: 10, padding: 14, marginBottom: showBulkForecast ? 0 : 20, borderBottomLeftRadius: showBulkForecast ? 0 : 10, borderBottomRightRadius: showBulkForecast ? 0 : 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: C.grayDark, display: "block", marginBottom: 4 }}>Keyword</label>
            <input value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && siteUrl.trim() && addKeyword()} placeholder="Ex: pantofi sport ieftini" disabled={!siteUrl.trim()} style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${C.border}`, borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", opacity: siteUrl.trim() ? 1 : 0.5 }} onFocus={e => e.target.style.borderColor = C.orange} onBlur={e => e.target.style.borderColor = C.border} />
          </div>
          <button onClick={addKeyword} disabled={!siteUrl.trim()} style={{ padding: "8px 22px", background: siteUrl.trim() ? C.orange : C.grayMid, color: C.white, border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: siteUrl.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", opacity: siteUrl.trim() ? 1 : 0.6 }}>+ Adaugă</button>
          <button onClick={() => { setShowBulkForecast(v => !v); setBulkForecastText(""); }} disabled={!siteUrl.trim()} style={{ padding: "8px 18px", background: showBulkForecast ? C.orangeLight : C.white, border: `1.5px solid ${showBulkForecast ? C.orange : C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: siteUrl.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", color: showBulkForecast ? C.orange : C.navy, opacity: siteUrl.trim() ? 1 : 0.6 }}>+ Adaugă în bulk</button>
          <button onClick={() => { setShowCrawlModal(true); setCrawlResults(null); setCrawlError(''); }} disabled={!siteUrl.trim()} style={{ padding: "8px 18px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: siteUrl.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", color: C.navy, opacity: siteUrl.trim() ? 1 : 0.6 }}>🌐 Importă din site</button>
          <span style={{ fontSize: 11, color: C.grayText, alignSelf: "center" }}>Volum și poziție se încarcă automat</span>
        </div>
      </div>
      {showBulkForecast && (
        <div className="no-print" style={{ background: C.gray, border: `1.5px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0 14px 14px", marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: C.grayDark, display: "block", marginBottom: 6 }}>Keywords — unul pe linie (lipește din Excel)</label>
          <textarea value={bulkForecastText} onChange={e => setBulkForecastText(e.target.value)} rows={7} placeholder={"pantofi sport\npantofi dama\npantofi barbati\n..."} style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} onFocus={e => e.target.style.borderColor = C.orange} onBlur={e => e.target.style.borderColor = C.border} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <button onClick={addBulkForecastKeywords} disabled={!bulkForecastText.trim()} style={{ padding: "9px 20px", background: bulkForecastText.trim() ? C.orange : C.grayMid, color: C.white, border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: bulkForecastText.trim() ? "pointer" : "default" }}>
              Adaugă toate ({bulkForecastText.split('\n').filter(l => l.trim()).length})
            </button>
            <button onClick={() => { setShowBulkForecast(false); setBulkForecastText(""); }} style={{ padding: "9px 16px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", color: C.grayDark }}>Anulează</button>
            <span style={{ fontSize: 11, color: C.grayText }}>Duplicatele și keywords existente sunt ignorate automat</span>
          </div>
        </div>
      )}

      {/* Modal crawl */}
      {showCrawlModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 28, width: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.navy }}>🌐 Importă keywords din site</h2>
              <button onClick={() => setShowCrawlModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.grayText, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && runCrawl()} placeholder="https://site-ul-tau.ro" style={{ flex: 1, padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: "none" }} onFocus={e => e.target.style.borderColor = C.orange} onBlur={e => e.target.style.borderColor = C.border} />
              <button onClick={runCrawl} disabled={crawlLoading} style={{ padding: "9px 20px", background: crawlLoading ? C.grayMid : C.navy, color: C.white, border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: crawlLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {crawlLoading ? "Se analizează..." : "Analizează"}
              </button>
            </div>

            {crawlError && <div style={{ padding: "10px 14px", background: C.redLight, border: `1px solid #fca5a5`, borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 12 }}>⚠️ {crawlError}</div>}

            {crawlResults && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, fontWeight: 600, background: crawlResults.siteType === "ecommerce" ? C.orangeLight : "#EEF1F8", color: crawlResults.siteType === "ecommerce" ? C.orange : C.navy }}>
                    {crawlResults.siteType === "ecommerce" ? "🛒 E-commerce" : "💼 Site servicii"}
                  </span>
                  <span style={{ fontSize: 12, color: C.grayText }}>{crawlResults.keywords.length} keywords detectate</span>
                  <button onClick={() => setSelectedCrawlKws(new Set(crawlResults.keywords))} style={{ marginLeft: "auto", fontSize: 12, color: C.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Selectează tot</button>
                  <button onClick={() => setSelectedCrawlKws(new Set())} style={{ fontSize: 12, color: C.grayText, background: "none", border: "none", cursor: "pointer" }}>Deselectează</button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16 }}>
                  {crawlResults.keywords.map(kw => (
                    <label key={kw} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.grayMid}`, cursor: "pointer", background: selectedCrawlKws.has(kw) ? C.orangeLight : "transparent" }}>
                      <input type="checkbox" checked={selectedCrawlKws.has(kw)} onChange={() => {
                        const s = new Set(selectedCrawlKws);
                        s.has(kw) ? s.delete(kw) : s.add(kw);
                        setSelectedCrawlKws(s);
                      }} />
                      <span style={{ fontSize: 13, color: C.navy }}>{kw}</span>
                    </label>
                  ))}
                </div>

                <button onClick={importCrawlKws} disabled={selectedCrawlKws.size === 0} style={{ width: "100%", padding: "11px", background: selectedCrawlKws.size === 0 ? C.grayMid : C.orange, color: C.white, border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: selectedCrawlKws.size === 0 ? "not-allowed" : "pointer" }}>
                  Importă {selectedCrawlKws.size > 0 ? `${selectedCrawlKws.size} keywords selectate` : "keywords selectate"}
                </button>
              </>
            )}

            {!crawlResults && !crawlLoading && !crawlError && (
              <p style={{ fontSize: 13, color: C.grayText, textAlign: "center", padding: "20px 0" }}>Introdu URL-ul site-ului și apasă Analizează pentru a detecta automat keywords din titluri, headings și navigație.</p>
            )}
          </div>
        </div>
      )}

      {/* 4. Tabel keywords */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Keywords în forecast ({keywords.length})</span>
          <span style={{ fontSize: 12, color: C.grayText }}>Poziție țintă scenariul <strong style={{ color: SCEN_COLOR[scenario] }}>{SCEN_LABEL[scenario]}</strong>: <strong>#{targetPos}</strong></span>
        </div>
        {keywords.length === 0
          ? <div style={{ padding: "32px", textAlign: "center", color: C.grayText, fontSize: 14 }}>Adaugă keywords mai jos pentru a vedea proiecția</div>
          : <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead><tr style={{ background: C.gray, borderBottom: `1px solid ${C.border}` }}>{["Keyword", "Volum", "Poz. curentă", "CTR curent", "Poz. țintă", "CTR țintă", "Trafic câștigat", ""].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.grayText, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>)}</tr></thead>
              <tbody>{keywords.map(kw => {
                const c = kw.loading ? null : calcKw(kw);
                return (
                  <tr key={kw.id} style={{ borderBottom: `1px solid ${C.grayMid}` }} onMouseEnter={e => e.currentTarget.style.background = C.gray} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "11px 14px", fontWeight: 500, fontSize: 13, color: C.navy }}>{kw.keyword}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: C.grayDark }}>{kw.loading ? <span style={{ color: C.grayText, fontSize: 11, fontStyle: "italic" }}>Se încarcă...</span> : fmtN(kw.volume)}</td>
                    <td style={{ padding: "11px 14px" }}>{kw.loading ? <span style={{ color: C.grayText, fontSize: 11, fontStyle: "italic" }}>Se încarcă...</span> : <PositionBadge pos={kw.currentPos} />}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: C.grayText }}>{kw.loading ? "…" : (getCTR(kw.currentPos) * 100).toFixed(1) + "%"}</td>
                    <td style={{ padding: "11px 14px" }}><PositionBadge pos={targetPos} /></td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: C.green, fontWeight: 600 }}>{kw.loading ? "…" : (getCTR(targetPos) * 100).toFixed(1) + "%"}</td>
                    <td style={{ padding: "11px 14px" }}>{kw.loading ? <span style={{ color: C.grayText, fontSize: 11, fontStyle: "italic" }}>Se încarcă...</span> : <span style={{ fontWeight: 700, fontSize: 13, color: c.trafficGain >= 0 ? C.green : C.red }}>{c.trafficGain >= 0 ? "+" : ""}{fmtN(c.trafficGain)}</span>}</td>
                    <td style={{ padding: "11px 14px" }}><button onClick={() => removeKeyword(kw.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#fca5a5", padding: 4 }}>×</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
        }
      </div>

      {/* 5. Tabel lunar */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: C.gray, borderBottom: `1px solid ${C.border}` }}>{["Luna", "Trafic", "Conversii", "Venit (RON)", "ROI"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.grayText, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead>
          <tbody>{months.map((m, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.grayMid}` }} onMouseEnter={e => e.currentTarget.style.background = C.gray} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><td style={{ padding: "11px 16px", fontWeight: 600, color: C.navy }}>Luna {m.month}</td><td style={{ padding: "11px 16px", color: C.grayDark }}>{fmtN(m.traffic)}</td><td style={{ padding: "11px 16px", color: C.grayDark }}>{fmtN(m.conversions)}</td><td style={{ padding: "11px 16px", fontWeight: 600, color: C.orange }}>{fmtRON(m.revenue)}</td><td style={{ padding: "11px 16px" }}><span style={{ fontWeight: 700, fontSize: 13, color: m.roi >= 0 ? C.green : C.red, background: m.roi >= 0 ? C.greenLight : C.redLight, padding: "3px 10px", borderRadius: 8 }}>{m.roi >= 0 ? "+" : ""}{m.roi}%</span></td></tr>)}</tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, fontSize: 11, color: C.grayText, textAlign: "center" }}>* Estimări bazate pe CTR mediu per poziție Google.</p>

      <div className="no-print" style={{ borderTop: `1px solid ${C.border}`, marginTop: 24, paddingTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={resetForm} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.grayDark }}>
          🔄 Resetare formular
        </button>
      </div>
    </div>
  );
}

// ── Raport SEO ────────────────────────────────────────────────────────────────
const MONTHS_FULL = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];

const DEFAULT_SECTIONS = [
  { id:"summary",   label:"Sumar executiv",            icon:"📋", enabled:true,  order:0 },
  { id:"positions", label:"Pozitii & Volume keywords", icon:"📍", enabled:true,  order:1 },
  { id:"topmovers", label:"Top movers",                icon:"🏆", enabled:true,  order:2 },
  { id:"notes",     label:"Note & recomandari",        icon:"📝", enabled:false, order:3 },
];

function ReportPreview({ config, project, p1Label, p2Label, activeDevice }) {
  if (!project) return null;
  const kws = project.keywords || [];
  const posField = activeDevice === 'mobile' ? 'position_mobile' : 'position_desktop';
  const getPosNow = k => k[posField] ?? k.position;
  const getPosPrev = (k, field='position') => {
    const entries = (k.history||[]).filter(h => {
      const d = new Date(h.date);
      return d.getMonth() === config.p2Month && d.getFullYear() === config.p2Year;
    });
    if (!entries.length) return null;
    const val = entries[entries.length-1][field];
    return val ?? null;
  };
  const posNow = kws.map(k=>getPosNow(k));
  const posNowValid = posNow.filter(p=>p!=null&&p>0);
  const avgNow = posNowValid.length ? Math.round(posNowValid.reduce((a,b)=>a+b,0)/posNowValid.length) : 0;
  const top3Now = posNowValid.filter(p=>p<=3).length;
  const top10Now = posNowValid.filter(p=>p<=10).length;
  const posPrev = kws.map(k=>getPosPrev(k));
  const posPrevValid = posPrev.filter(p=>p!=null&&p>0);
  const avgPrev = posPrevValid.length ? Math.round(posPrevValid.reduce((a,b)=>a+b,0)/posPrevValid.length) : 0;
  const top3Prev = posPrevValid.filter(p=>p<=3).length;
  const top10Prev = posPrevValid.filter(p=>p<=10).length;
  const diffAvg = avgPrev && avgNow ? avgPrev - avgNow : 0;
  // statistici separate desktop/mobile
  const deskPos = kws.map(k=>k.position_desktop).filter(p=>p!=null&&p>0);
  const mobPos = kws.map(k=>k.position_mobile).filter(p=>p!=null&&p>0);
  const avgDesk = deskPos.length ? Math.round(deskPos.reduce((a,b)=>a+b,0)/deskPos.length) : null;
  const avgMob = mobPos.length ? Math.round(mobPos.reduce((a,b)=>a+b,0)/mobPos.length) : null;
  const top3Desk = deskPos.filter(p=>p<=3).length;
  const top3Mob = mobPos.filter(p=>p<=3).length;
  const top10Desk = deskPos.filter(p=>p<=10).length;
  const top10Mob = mobPos.filter(p=>p<=10).length;
  const movers = kws.map((k,i)=>({
    ...k,
    curPos:posNow[i],
    prevPos:posPrev[i],
    prevPosDesktop:getPosPrev(k,'position_desktop'),
    prevPosMobile:getPosPrev(k,'position_mobile'),
    delta:(posPrev[i]&&posNow[i])?(posPrev[i]-posNow[i]):null
  })).sort((a,b)=>b.delta-a.delta);
  const improved = movers.filter(m=>m.delta!=null&&m.delta>=5).slice(0,5);
  const declined = movers.filter(m=>m.delta!=null&&m.delta<=-10).sort((a,b)=>a.delta-b.delta).slice(0,5);
  const sections = [...config.sections].sort((a,b)=>a.order-b.order).filter(s=>s.enabled);
  const accentColor = config.accentColor || C.orange;

  const DeltaBadge = ({delta}) => delta===0 ? <span style={{color:C.grayText,fontSize:12}}>—</span> :
    <span style={{fontSize:12,fontWeight:700,color:delta>0?C.green:C.red}}>{delta>0?`▲ +${delta}`:`▼ ${delta}`}</span>;

  const EvolutionMini = ({history}) => {
    if(!history||history.length<2) return <span style={{color:C.grayText,fontSize:11}}>N/A</span>;
    const last14 = history.slice(-14);
    const W=80,H=28,pad=2;
    const positions=last14.map(e=>e.position);
    const maxP=Math.max(...positions),minP=Math.min(...positions);
    const pts=last14.map((e,i)=>({x:pad+(i/Math.max(last14.length-1,1))*(W-pad*2),y:pad+((e.position-minP)/((maxP-minP)||1))*(H-pad*2)}));
    return <svg width={W} height={H}><polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={accentColor} strokeWidth="2" strokeLinejoin="round"/></svg>;
  };

  return (
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}}>
      <div style={{background:config.darkHeader?C.navy:`linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,borderBottom:`3px solid ${accentColor}`,padding:"28px 32px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            {config.showLogo && <div style={{marginBottom:12}}><Logo variant={config.darkHeader?"dark":"light"} width={150}/></div>}
            <h1 style={{fontSize:22,fontWeight:800,color:config.darkHeader?C.white:C.navy,margin:0,marginBottom:4}}>
              Raport SEO
            </h1>
            <div style={{fontSize:13,color:config.darkHeader?"rgba(255,255,255,0.6)":C.grayText}}>
              {project.name} {project.url&&`· ${project.url}`}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{display:"flex",gap:10}}>
              {[{label:"Perioada curentă",val:p1Label,dark:config.darkHeader},{label:"Perioada anterioară",val:p2Label,dark:config.darkHeader}].map((p,i)=>(
                <div key={i} style={{background:p.dark?"rgba(255,255,255,0.1)":C.white,borderRadius:10,padding:"10px 16px",textAlign:"center",minWidth:90}}>
                  <div style={{fontSize:10,color:p.dark?"rgba(255,255,255,0.5)":C.grayText,fontWeight:500,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{p.label}</div>
                  <div style={{fontSize:13,fontWeight:700,color:p.dark?C.white:C.navy}}>{p.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{padding:"24px 32px"}}>
        {sections.map(sec => {
          if (sec.id==="summary") return (
            <div key="summary" style={{marginBottom:28}}>
              <h2 style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:accentColor}}>📋</span> Sumar executiv
              </h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
                {[
                  {label:"Pozitie medie",desk:avgDesk?`#${avgDesk}`:"—",mob:avgMob?`#${avgMob}`:"—"},
                  {label:"Keywords Top 3",desk:top3Desk,mob:top3Mob},
                  {label:"Keywords Top 10",desk:top10Desk,mob:top10Mob},
                ].map((s,i)=>(
                  <div key={i} style={{background:C.gray,borderRadius:10,padding:"14px 16px"}}>
                    <div style={{fontSize:11,color:C.grayText,fontWeight:500,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.04em"}}>{s.label}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:11,color:C.grayText}}>🖥 Desktop</span>
                        <span style={{fontSize:20,fontWeight:800,color:accentColor}}>{s.desk}</span>
                      </div>
                      <div style={{height:1,background:C.border}}/>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:11,color:C.grayText}}>📱 Mobile</span>
                        <span style={{fontSize:20,fontWeight:800,color:C.navy}}>{s.mob}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {config.summaryText && (
                <div style={{background:`${accentColor}0f`,border:`1px solid ${accentColor}30`,borderRadius:10,padding:"14px 16px",fontSize:13,color:C.grayDark,lineHeight:1.6}}>
                  {config.summaryText}
                </div>
              )}
            </div>
          );

          if (sec.id==="positions") return (
            <div key="positions" style={{marginBottom:28}}>
              <h2 style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:accentColor}}>📍</span> Pozitii & Volume keywords
              </h2>
              <div style={{borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:C.gray}}>
                    {["Keyword","🖥 Desktop","📱 Mobile","Poz. ant. Desktop","Poz. ant. Mobile","Volum lunar","Trend","Best"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:600,color:C.grayText,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>{[...movers].sort((a,b)=>(b.volume||0)-(a.volume||0)).slice(0,config.maxKeywords||999).map((kw,i)=>{
                    const allPos=(kw.history||[]).map(h=>h.position).filter(p=>p>0);
                    const best=allPos.length?Math.min(...allPos):null;
                    return(
                      <tr key={i} style={{borderTop:`1px solid ${C.grayMid}`}}>
                        <td style={{padding:"10px 14px",fontWeight:500,fontSize:13,color:C.navy}}>{kw.keyword}</td>
                        <td style={{padding:"10px 14px"}}><PositionBadge pos={kw.position_desktop}/></td>
                        <td style={{padding:"10px 14px"}}><PositionBadge pos={kw.position_mobile}/></td>
                        <td style={{padding:"10px 14px"}}>{kw.prevPosDesktop?<PositionBadge pos={kw.prevPosDesktop}/>:<span style={{color:C.grayText,fontSize:12}}>—</span>}</td>
                        <td style={{padding:"10px 14px"}}>{kw.prevPosMobile?<PositionBadge pos={kw.prevPosMobile}/>:<span style={{color:C.grayText,fontSize:12}}>—</span>}</td>
                        <td style={{padding:"10px 14px",fontSize:12,fontWeight:600,color:C.grayDark}}>{kw.volume>0?fmtN(kw.volume):"—"}</td>
                        <td style={{padding:"10px 14px"}}><EvolutionMini history={kw.history}/></td>
                        <td style={{padding:"10px 14px",fontSize:12,color:C.green,fontWeight:700}}>{best?`#${best}`:"—"}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          );

          if (sec.id==="topmovers") return (
            <div key="topmovers" style={{marginBottom:28}}>
              <h2 style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:accentColor}}>🏆</span> Top movers
              </h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <div style={{borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                  <div style={{background:C.greenLight,padding:"10px 14px",fontWeight:600,fontSize:12,color:C.green}}>📈 Cele mai mari urcari</div>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <tbody>{improved.length?improved.map((m,i)=>(
                      <tr key={i} style={{borderTop:`1px solid ${C.grayMid}`}}>
                        <td style={{padding:"9px 14px",fontSize:12,fontWeight:500,color:C.navy}}>{m.keyword}</td>
                        <td style={{padding:"9px 14px",textAlign:"right"}}><span style={{fontSize:12,fontWeight:700,color:C.green}}>▲ +{m.delta} poz.</span></td>
                      </tr>
                    )):<tr><td style={{padding:"12px 14px",fontSize:12,color:C.grayText}}>Nicio urcare semnificativa</td></tr>}</tbody>
                  </table>
                </div>
                <div style={{borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                  <div style={{background:C.redLight,padding:"10px 14px",fontWeight:600,fontSize:12,color:C.red}}>📉 Cele mai mari scaderi</div>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <tbody>{declined.length?declined.map((m,i)=>(
                      <tr key={i} style={{borderTop:`1px solid ${C.grayMid}`}}>
                        <td style={{padding:"9px 14px",fontSize:12,fontWeight:500,color:C.navy}}>{m.keyword}</td>
                        <td style={{padding:"9px 14px",textAlign:"right"}}><span style={{fontSize:12,fontWeight:700,color:C.red}}>▼ {m.delta} poz.</span></td>
                      </tr>
                    )):<tr><td style={{padding:"12px 14px",fontSize:12,color:C.grayText}}>Nicio scadere semnificativa</td></tr>}</tbody>
                  </table>
                </div>
              </div>
            </div>
          );

          if (sec.id==="notes") return config.notesText ? (
            <div key="notes" style={{marginBottom:28}}>
              <h2 style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:accentColor}}>📝</span> Note & recomandari
              </h2>
              <div style={{background:`${accentColor}0a`,border:`1px solid ${accentColor}25`,borderRadius:10,padding:"16px 18px",fontSize:13,color:C.grayDark,lineHeight:1.7,whiteSpace:"pre-wrap"}}>
                {config.notesText}
              </div>
            </div>
          ) : null;

          return null;
        })}

        <div style={{borderTop:`1px solid ${C.grayMid}`,paddingTop:16}}>
          <span style={{fontSize:11,color:C.grayText}}>Generat de SEO Tool by AdSem · {new Date().toLocaleDateString("ro-RO")}</span>
        </div>
      </div>
    </div>
  );
}

function RaportSEO({ projects }) {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);

  const [step, setStep] = useState("config");
  const [selectedProjId, setSelectedProjId] = useState(projects?.[0]?.id || null);
  const [p1Month, setP1Month] = useState(now.getMonth());
  const [p1Year, setP1Year] = useState(now.getFullYear());
  const [p2Month, setP2Month] = useState(prevMonth.getMonth());
  const [p2Year, setP2Year] = useState(prevMonth.getFullYear());
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const reportTitle = "Raport SEO";
  const [summaryText, setSummaryText] = useState("");
  const maxKeywords = 999;
  const [mailTab, setMailTab] = useState("manual");
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("Raport SEO lunar");
  const [mailMsg, setMailMsg] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [mailSent, setMailSent] = useState(false);
  const [scheduleDay, setScheduleDay] = useState("1");
  const [scheduleFreq, setScheduleFreq] = useState("monthly");
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const reportRef = useRef(null);

  const project = projects?.find(p=>p.id===selectedProjId);
  const p1Label = `${MONTHS_FULL[p1Month]} ${p1Year}`;
  const p2Label = `${MONTHS_FULL[p2Month]} ${p2Year}`;
  const config = { sections, reportTitle, summaryText, accentColor:C.orange, darkHeader:true, showLogo:true, maxKeywords, p2Month, p2Year };


  const sortedSections = [...sections].sort((a,b)=>a.order-b.order);
  const accentColor = C.orange;

  const moveSection = (idx, dir) => {
    const arr = [...sortedSections];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    const newOrder = arr.map(s=>s.order);
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setSections(prev => prev.map(s => {
      const fi = arr.findIndex(a=>a.id===s.id);
      return fi>=0 ? {...s, order:newOrder[fi]} : s;
    }));
  };

  const toggleSection = id => setSections(prev=>prev.map(s=>s.id===id?{...s,enabled:!s.enabled}:s));

  const handlePDF = () => {
    setPdfGenerating(true);
    setTimeout(()=>{
      const content = reportRef.current;
      if(!content){setPdfGenerating(false);return;}
      const w = window.open("","_blank");
      w.document.write(`<html><head><title>Raport SEO - ${project?.name||""}</title>
        <style>
          body{font-family:Inter,sans-serif;margin:0;padding:20px;color:#1A2B4A;}
          @media print{body{padding:0;}}
          table{width:100%;border-collapse:collapse;}
          th,td{padding:8px 12px;text-align:left;font-size:12px;}
          thead tr{background:#F5F6F8;}
        </style>
      </head><body>${content.innerHTML}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
      w.document.close();
      setPdfGenerating(false);
    },400);
  };

  const handleSendMail = async () => {
    if(!mailTo) return;
    setMailSending(true);
    try {
      const reportHtml = reportRef.current?.innerHTML || '';
      console.log('sending:', { to: mailTo, subject: mailSubject, reportHtml: reportHtml.slice(0, 100) });
      if (!reportHtml) {
        throw new Error('Raportul nu a fost generat. Selectează un proiect și încearcă din nou.');
      }
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: mailTo, subject: mailSubject, message: mailMsg, reportHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare la trimitere');
      setMailSent(true);
      setTimeout(() => setMailSent(false), 3000);
    } catch (e) {
      alert(`Eroare: ${e.message}`);
    } finally {
      setMailSending(false);
    }
  };

  const handleSaveSchedule = () => {
    if(!scheduleEmail) return;
    setScheduleSaved(true);
    setTimeout(()=>setScheduleSaved(false),3000);
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Raportare</h1>
          <p style={{color:C.grayText,fontSize:14}}>Generează, customizează și trimite rapoarte SEO profesionale.</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {["config","preview"].map(s=>(
            <button key={s} onClick={()=>setStep(s)}
              style={{padding:"9px 20px",borderRadius:9,border:"1.5px solid",fontSize:13,fontWeight:600,cursor:"pointer",
                borderColor:step===s?C.orange:C.border,background:step===s?C.orangeLight:C.white,color:step===s?C.orange:C.grayText}}>
              {s==="config"?"⚙️ Configurare":"👁️ Preview raport"}
            </button>
          ))}
        </div>
      </div>

      {step==="config" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:16,color:C.navy}}>📂 Proiect & Perioade</div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:6}}>Proiect</label>
                <select value={selectedProjId||""} onChange={e=>setSelectedProjId(e.target.value)}
                  style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",background:C.white,cursor:"pointer",color:C.navy}}>
                  {(projects||[]).length===0 && <option value="">Niciun proiect — creați unul în Rank Tracker</option>}
                  {(projects||[]).map(p=><option key={p.id} value={p.id}>{p.name} ({(p.keywords||[]).length} kw)</option>)}
                </select>
              </div>
              <div style={{background:"#EEF1F8",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:600,color:C.navy,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>📅 Perioada curentă (P1)</div>
                <div style={{display:"flex",gap:8}}>
                  <select value={p1Month} onChange={e=>setP1Month(parseInt(e.target.value))}
                    style={{flex:1,padding:"8px 10px",border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:13,outline:"none",background:C.white,cursor:"pointer"}}>
                    {MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={p1Year} onChange={e=>setP1Year(parseInt(e.target.value))}
                    style={{width:90,padding:"8px 10px",border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:13,outline:"none",background:C.white,cursor:"pointer"}}>
                    {[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div style={{background:C.orangeLight,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:600,color:C.orange,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>📅 Perioada anterioară (P2)</div>
                <div style={{display:"flex",gap:8}}>
                  <select value={p2Month} onChange={e=>setP2Month(parseInt(e.target.value))}
                    style={{flex:1,padding:"8px 10px",border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:13,outline:"none",background:C.white,cursor:"pointer"}}>
                    {MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={p2Year} onChange={e=>setP2Year(parseInt(e.target.value))}
                    style={{width:90,padding:"8px 10px",border:`1.5px solid ${C.border}`,borderRadius:7,fontSize:13,outline:"none",background:C.white,cursor:"pointer"}}>
                    {[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:16,color:C.navy}}>✏️ Continut text</div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:5}}>Text sumar executiv</label>
                <textarea value={summaryText} onChange={e=>setSummaryText(e.target.value)} rows={3}
                  placeholder="Ex: În luna curentă, site-ul a înregistrat îmbunătățiri semnificative..."
                  style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}}
                  onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/>
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:C.navy}}>📋 Secțiuni raport</div>
              <div style={{fontSize:12,color:C.grayText,marginBottom:14}}>Bifează, debifează și reordonează cu săgețile</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {sortedSections.map((sec,idx)=>(
                  <div key={sec.id} style={{display:"flex",alignItems:"center",gap:10,background:sec.enabled?`${accentColor}0a`:C.gray,border:`1.5px solid ${sec.enabled?accentColor:C.border}`,borderRadius:9,padding:"10px 12px"}}>
                    <input type="checkbox" checked={sec.enabled} onChange={()=>toggleSection(sec.id)} style={{accentColor}}/>
                    <span style={{fontSize:16}}>{sec.icon}</span>
                    <span style={{flex:1,fontSize:13,fontWeight:500,color:sec.enabled?C.navy:C.grayText}}>{sec.label}</span>
                    <div style={{display:"flex",gap:2}}>
                      <button onClick={()=>moveSection(idx,-1)} disabled={idx===0}
                        style={{padding:"2px 7px",fontSize:12,borderRadius:5,border:`1px solid ${C.border}`,cursor:idx===0?"default":"pointer",background:C.white,color:idx===0?C.grayMid:C.navy,opacity:idx===0?0.4:1}}>▲</button>
                      <button onClick={()=>moveSection(idx,1)} disabled={idx===sortedSections.length-1}
                        style={{padding:"2px 7px",fontSize:12,borderRadius:5,border:`1px solid ${C.border}`,cursor:idx===sortedSections.length-1?"default":"pointer",background:C.white,color:idx===sortedSections.length-1?C.grayMid:C.navy,opacity:idx===sortedSections.length-1?0.4:1}}>▼</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>


            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:C.navy}}>📧 Trimitere raport pe email</div>
              <div style={{display:"flex",gap:4,marginBottom:16}}>
                {[["manual","✉️ Trimite acum"],["schedule","⏰ Programează"]].map(([val,label])=>(
                  <button key={val} onClick={()=>setMailTab(val)}
                    style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid",fontSize:12,fontWeight:600,cursor:"pointer",
                      borderColor:mailTab===val?C.orange:C.border,background:mailTab===val?C.orangeLight:C.white,color:mailTab===val?C.orange:C.grayText}}>
                    {label}
                  </button>
                ))}
              </div>
              {mailTab==="manual" && (
                <div>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:5}}>Destinatar</label>
                    <input value={mailTo} onChange={e=>setMailTo(e.target.value)} placeholder="client@email.com"
                      style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}
                      onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/>
                  </div>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:5}}>Subiect</label>
                    <input value={mailSubject} onChange={e=>setMailSubject(e.target.value)}
                      style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}
                      onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:5}}>Mesaj (opțional)</label>
                    <textarea value={mailMsg} onChange={e=>setMailMsg(e.target.value)} rows={2}
                      style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}}
                      onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/>
                  </div>
                  <button onClick={handleSendMail} disabled={mailSending||!mailTo}
                    style={{width:"100%",padding:"10px",background:mailSent?C.green:mailSending?C.grayMid:C.orange,color:C.white,border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:mailTo?"pointer":"default",opacity:mailTo?1:0.5}}>
                    {mailSent?"✓ Trimis!":mailSending?"Se trimite...":"📤 Trimite raportul"}
                  </button>
                </div>
              )}
              {mailTab==="schedule" && (
                <div>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:5}}>Email destinatar</label>
                    <input value={scheduleEmail} onChange={e=>setScheduleEmail(e.target.value)} placeholder="client@email.com"
                      style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}
                      onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                    <div>
                      <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:5}}>Frecvență</label>
                      <select value={scheduleFreq} onChange={e=>setScheduleFreq(e.target.value)}
                        style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",background:C.white,cursor:"pointer"}}>
                        <option value="weekly">Săptămânal</option>
                        <option value="monthly">Lunar</option>
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:500,color:C.grayDark,display:"block",marginBottom:5}}>Ziua</label>
                      <select value={scheduleDay} onChange={e=>setScheduleDay(e.target.value)}
                        style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",background:C.white,cursor:"pointer"}}>
                        {Array.from({length:28},(_,i)=><option key={i+1} value={i+1}>Ziua {i+1}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleSaveSchedule} disabled={!scheduleEmail}
                    style={{width:"100%",padding:"10px",background:scheduleSaved?C.green:C.orange,color:C.white,border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:scheduleEmail?"pointer":"default",opacity:scheduleEmail?1:0.5}}>
                    {scheduleSaved?"✓ Programare salvată!":"💾 Salvează programarea"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step==="preview" && (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{fontSize:13,color:C.grayText,flex:1}}>
              <strong style={{color:C.navy}}>{project?.name||"Niciun proiect"}</strong>
              {" · "}<span style={{background:"#EEF1F8",color:C.navy,padding:"2px 8px",borderRadius:6,fontSize:12}}>{p1Label}</span>
              {" vs "}<span style={{background:C.orangeLight,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:12}}>{p2Label}</span>
            </div>
            <button onClick={handlePDF} disabled={pdfGenerating||!project}
              style={{padding:"9px 20px",background:pdfGenerating?C.grayMid:C.navy,color:C.white,border:"none",borderRadius:9,fontWeight:600,fontSize:13,cursor:project?"pointer":"default"}}>
              {pdfGenerating?"⏳ Generare...":"📄 Descarcă PDF"}
            </button>
            <button onClick={()=>setStep("config")}
              style={{padding:"9px 20px",background:C.white,color:C.grayDark,border:`1.5px solid ${C.border}`,borderRadius:9,fontWeight:600,fontSize:13,cursor:"pointer"}}>
              ← Înapoi
            </button>
          </div>
          {!project ? (
            <EmptyState icon="📂" title="Selectează un proiect în configurare"/>
          ) : (
            <div>
              <ReportPreview config={config} project={project} p1Label={p1Label} p2Label={p2Label} activeDevice={activeDevice}/>
            </div>
          )}
        </div>
      )}

      {/* Div ascuns — reportRef mereu populat pentru generare HTML email */}
      <div ref={reportRef} style={{position:"absolute",left:"-9999px",top:0,width:900,visibility:"hidden",pointerEvents:"none"}} aria-hidden="true">
        {project && <ReportPreview config={config} project={project} p1Label={p1Label} p2Label={p2Label} activeDevice={activeDevice}/>}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("projects");
  const [pendingKeywords, setPendingKeywords] = useState([]);
  const [trackerProjects, setTrackerProjects] = useState([]);
  const [loggedUser, setLoggedUser] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!loggedUser) return;
    loadProjects(loggedUser).then(p => setTrackerProjects(p || [])).catch(() => setTrackerProjects([]));
  }, [loggedUser]);

  if (!loggedUser) return <LoginScreen onLogin={setLoggedUser}/>;

  const handleAddToTracker = keywords => { setPendingKeywords(keywords); setPage("rank"); };
  const handleSelectProject = id => { setSelectedProjectId(id); setPage("rank"); };
  const handleNewProjectFromHome = () => { setPage("rank"); };

  const NAV = [
    { id:"projects", icon:"📂", label:"Proiecte" },
    { id:"rank",     icon:"📈", label:"Rank Tracker" },
    { id:"keywords", icon:"🔍", label:"Keyword Research" },
    { id:"blog",     icon:"✍️", label:"Blog Topic Finder" },
    { id:"forecast", icon:"🔮", label:"SEO Forecasting" },
    { id:"report",   icon:"📑", label:"Raportare" },
  ];

  const renderPage = () => {
    if (page==="projects") return <ProjectsHome projects={trackerProjects} onSelectProject={handleSelectProject} onNewProject={handleNewProjectFromHome}/>;
    if (page==="keywords") return <KeywordResearch onAddToTracker={handleAddToTracker}/>;
    if (page==="blog")     return <BlogTopics/>;
    if (page==="rank")     return <RankTracker pendingKeywords={pendingKeywords} onPendingConsumed={()=>setPendingKeywords([])} onProjectsLoaded={setTrackerProjects} initialProjectId={selectedProjectId} userId={loggedUser}/>;
    if (page==="forecast") return <Forecasting/>;
    if (page==="report")   return <RaportSEO projects={trackerProjects}/>;
    return null;
  };

  const navItemClick = id => { setPage(id); if (isMobile) setDrawerOpen(false); };

  const sidebarContent = (
    <>
      <div style={{padding:"20px 20px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo variant="dark" width={150}/>
        {isMobile && (
          <button onClick={()=>setDrawerOpen(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:20,cursor:"pointer",padding:4,lineHeight:1}}>✕</button>
        )}
      </div>
      <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
        <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em",padding:"4px 12px 8px"}}>Functii</div>
        {NAV.map(item=>(
          <div key={item.id} onClick={()=>navItemClick(item.id)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:8,cursor:"pointer",marginBottom:2,background:page===item.id?"rgba(255,107,43,0.15)":"transparent",color:page===item.id?C.orange:"rgba(255,255,255,0.85)",fontWeight:600,fontSize:13.5}}>
            <span style={{fontSize:15}}>{item.icon}</span><span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:8}}>👤 {loggedUser}</div>
        <button onClick={()=>{setLoggedUser(null);setPage("projects");}} style={{width:"100%",padding:"8px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,fontSize:11,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:500}}>Deconectare</button>
      </div>
    </>
  );

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"Inter,'Segoe UI',sans-serif",background:C.gray,color:C.navy}}>
      <style>{`
        @media (max-width: 768px) {
          table { display: block !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
          button { min-height: 44px !important; }
          input, select, textarea { min-height: 44px !important; font-size: 16px !important; }
          [style*="repeat(3,1fr)"] { grid-template-columns: 1fr 1fr !important; }
          [style*="repeat(4,1fr)"] { grid-template-columns: 1fr 1fr !important; }
          [style*="1fr 1fr 1fr"] { grid-template-columns: 1fr 1fr !important; }
          [style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Overlay backdrop pe mobil */}
      {isMobile && drawerOpen && (
        <div onClick={()=>setDrawerOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:99}}/>
      )}

      {/* Sidebar */}
      {isMobile ? (
        <div style={{position:"fixed",top:0,left:drawerOpen?0:-240,width:240,height:"100vh",background:C.navy,display:"flex",flexDirection:"column",flexShrink:0,zIndex:100,transition:"left 0.25s ease",boxShadow:drawerOpen?"4px 0 24px rgba(0,0,0,0.3)":"none"}}>
          {sidebarContent}
        </div>
      ) : (
        <div style={{width:220,background:C.navy,display:"flex",flexDirection:"column",flexShrink:0}}>
          {sidebarContent}
        </div>
      )}

      {/* Conținut principal */}
      <div style={{flex:1,overflow:"auto",padding:isMobile?16:32,paddingTop:isMobile?64:32}}>
        {isMobile && (
          <button onClick={()=>setDrawerOpen(true)}
            style={{position:"fixed",top:10,left:10,zIndex:98,background:C.navy,color:C.white,border:"none",borderRadius:8,width:44,height:44,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.25)"}}>
            ☰
          </button>
        )}
        {renderPage()}
      </div>
    </div>
  );
}