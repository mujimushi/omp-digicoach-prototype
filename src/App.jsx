import React, { useState, useEffect, useRef, useCallback } from "react";
import { Timer as TimerIcon, Clock, Target, Search, BookOpen, Check, Lightbulb, Mic, Square, Play, ChevronLeft, ChevronDown, Star, FileText, BarChart3, MoreHorizontal, Home as HomeIcon, ClipboardList, GraduationCap, Building2, Settings, HelpCircle, Download, Edit, X, User, Mail, Lock, ChevronRight, Volume2, Trash2 } from "lucide-react";

// ── Data (UNCHANGED) ──
const STEPS=[
  {id:1,name:"Get a Commitment",color:"#2563EB",icon:Target,instruction:"Ask the learner to commit to a diagnosis or plan",
    prompts:["What do you think is the most likely diagnosis?","What do you think is going on?","What would you like to do next?","What is your management plan?"],
    checks:["Learner committed to a diagnosis","Learner proposed a plan","Learner identified differentials"]},
  {id:2,name:"Probe for Evidence",color:"#2563EB",icon:Search,instruction:"Explore the learner\u2019s reasoning",
    prompts:["What findings support that diagnosis?","What other diagnoses did you consider?","Why did you rule out alternatives?","What investigation would you order?"],
    checks:["Learner explained reasoning","Knowledge gaps identified","Considered alternatives"]},
  {id:3,name:"Teach General Rule",color:"#2563EB",icon:BookOpen,instruction:"Teach 1\u20132 key points",
    checks:["Shared a teaching pearl","Linked to general principle","Targeted to learner\u2019s level"]},
  {id:4,name:"Reinforce Strengths",color:"#D97706",icon:Check,instruction:"Provide positive feedback",
    starters:["You did well in","Good clinical reasoning because","I liked how you"],
    tags:["Good reasoning","Good history","Good examination","Good communication","Thorough workup","Good differential"]},
  {id:5,name:"Correct & Improve",color:"#D97706",icon:Lightbulb,instruction:"Guide improvement",
    starters:["Next time, try to","You missed","Consider"]},
];
const DEPTS=["Medicine","Surgery","Pediatrics","Gynecology / Obstetrics","Psychiatry","ENT","Ophthalmology","Dermatology","Orthopedics","Emergency","Other"];
const LEVELS=["Student","House Officer (HO)","Resident"];
const CASES=["Long Case","Short Case","Spot Case","Procedure","Counseling / Other"];
const ENCOUNTERS=[
  {id:1,date:"2026-03-30",time:"09:15",dept:"Medicine",lr:"Student",ct:"Long Case",dx:"Pneumonia",dur:312,useful:5,steps:[1,1,1,1,1],pearl:true,voice:true,tags:["Good reasoning"],s3:["CURB-65 score determines admission vs outpatient","pneumonia, always check oxygen saturation","Amoxicillin for community-acquired","Multilobar infiltrates with sepsis"],s4:["identifying key differentials","considered atypical causes","structured your presentation"],s5:["review chest X-ray systematically","checking for pleural effusion","bilateral vs unilateral patterns"],s5plan:"Read Harrison\u2019s chapter on community-acquired pneumonia"},
  {id:2,date:"2026-03-29",time:"14:30",dept:"Surgery",lr:"Resident",ct:"Short Case",dx:"Appendicitis",dur:280,useful:4,steps:[1,1,1,1,0],pearl:false,voice:false,tags:["Good history"],s3:["Alvarado score helps clinical diagnosis","","Laparoscopic appendectomy is gold standard","Perforation risk increases after 48 hours"],s4:["taking a focused surgical history","","eliciting rebound tenderness"],s5:["","",""],s5plan:""},
  {id:3,date:"2026-03-29",time:"10:00",dept:"Medicine",lr:"House Officer",ct:"Long Case",dx:"CHF Exacerbation",dur:305,useful:6,steps:[1,1,1,1,1],pearl:true,voice:true,tags:["Good examination","Good reasoning"],s3:["BNP levels guide treatment decisions","CHF + new murmur, always check echo","IV Furosemide for acute decompensation","Bilateral crackles with S3 gallop"],s4:["assessing JVP accurately","integrated history with exam findings",""],s5:["titrate diuretics based on daily weight","checking hepatojugular reflux","fluid restriction rationale"],s5plan:"Review NYHA classification guidelines"},
  {id:4,date:"2026-03-28",time:"11:45",dept:"Pediatrics",lr:"Student",ct:"Spot Case",dx:"Measles",dur:295,useful:5,steps:[1,1,1,0,0],pearl:false,voice:false,tags:[],s3:["Koplik spots are pathognomonic for measles","","","Encephalitis as a rare complication"],s4:["","",""],s5:["","",""],s5plan:""},
  {id:5,date:"2026-03-27",time:"15:00",dept:"Emergency",lr:"House Officer",ct:"Short Case",dx:"Asthma Attack",dur:260,useful:5,steps:[1,1,1,1,1],pearl:true,voice:false,tags:["Good communication"],s3:["Severity assessment using PEFR","acute asthma + no improvement, always check for pneumothorax","Salbutamol nebulizer as first-line","Silent chest means severe obstruction"],s4:["explaining the plan to the patient clearly","","calming the patient during distress"],s5:["document peak flow before and after treatment","the importance of a written action plan","step-up vs step-down therapy"],s5plan:"Review BTS asthma guidelines"},
  {id:6,date:"2026-03-26",time:"09:45",dept:"Medicine",lr:"Student",ct:"Long Case",dx:"Diabetic Ketoacidosis",dur:320,useful:4,steps:[1,1,1,1,0],pearl:true,voice:true,tags:["Good reasoning"],s3:["Fixed-rate insulin infusion is the protocol","DKA + abdominal pain, always check amylase","Normal saline initially then switch to dextrose","Cerebral edema in young patients"],s4:["identifying the precipitating cause","calculated the anion gap correctly",""],s5:["","",""],s5plan:""},
];
const INIT_PEARLS=[
  {id:"p1",dept:"Medicine",dx:"Pneumonia",pts:["CURB-65 determines admission","","Amoxicillin for community-acquired","Multilobar infiltrates with sepsis"],used:3,fav:true},
  {id:"p2",dept:"Medicine",dx:"Diabetes",pts:["HbA1c target <7%","diabetes + foot ulcer","Metformin after renal check","Silent MI in diabetics"],used:5,fav:true},
  {id:"p3",dept:"Surgery",dx:"Appendicitis",pts:["Alvarado score helps","","Lap appendectomy gold standard","Perforation >48hrs"],used:2,fav:false},
];
const WDATA=[{d:"Mon",s:3},{d:"Tue",s:2},{d:"Wed",s:4},{d:"Thu",s:1},{d:"Fri",s:3},{d:"Sat",s:0},{d:"Sun",s:1}];

// ── Design System Tokens ──
const ds={
  navy:"#1B2A5C",blue:"#2563EB",blueDk:"#1E3A8A",
  surface:"#E8F0FE",green:"#22C55E",gold:"#D97706",
  tx:"#1B2A5C",txB:"#475569",txW:"#FFFFFF",txL:"#94A3B8",
  bd:"#E2E8F0",bdL:"#F1F5F9",
  red:"#EF4444",purple:"#7C3AED",
  screenBg:"linear-gradient(180deg, #E8F0FE 0%, #1E3A8A 100%)",
  headerBg:"linear-gradient(135deg, #1E3A8A, #2563EB)",
  ctaBg:"linear-gradient(135deg, #2563EB, #1E3A8A)",
  card:{background:"rgba(255,255,255,0.88)",backdropFilter:"blur(12px)",borderRadius:16,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"},
  input:{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"14px",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit",width:"100%",transition:"all 0.2s ease"},
  btnPrimary:{background:"linear-gradient(135deg, #2563EB, #1E3A8A)",borderRadius:14,fontWeight:600,color:"#fff",border:"none",boxShadow:"0 4px 14px rgba(37,99,235,0.3)",cursor:"pointer",transition:"all 0.2s ease"},
  btnSecondary:{background:"#fff",border:"1px solid #CBD5E1",borderRadius:14,cursor:"pointer",transition:"all 0.2s ease"},
};

function IconCircle({Icon,color,size=36}){
  return (<div style={{width:size,height:size,borderRadius:"50%",background:`${color}1F`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
    <Icon size={size*0.5} color={color} strokeWidth={2.2}/>
  </div>);
}

// ── Phone Frame (responsive: full-screen on mobile, framed on desktop) ──
function Phone({children}){
  const[isMobile,setIsMobile]=useState(false);
  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<600);
    check();window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  if(isMobile){
    // Mobile: no frame, fills viewport like a native app
    return (
      <div style={{width:"100%",height:"100dvh",maxWidth:500,margin:"0 auto",background:ds.surface,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif"}}>
        {children}
      </div>
    );
  }

  // Desktop: show phone frame mockup
  return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:"100vh",background:ds.screenBg,padding:20,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif"}}>
      <div style={{width:390,height:844,borderRadius:44,background:ds.surface,position:"relative",overflow:"hidden",boxShadow:"0 25px 80px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.1)",border:"8px solid #111",display:"flex",flexDirection:"column"}}>
        <div style={{height:54,display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"0 24px 4px",position:"absolute",top:0,left:0,right:0,zIndex:100}}>
          <span style={{fontSize:14,fontWeight:600,color:ds.navy}}>9:41</span>
          <div style={{display:"flex",gap:5}}>
            <svg width="16" height="12" viewBox="0 0 16 12"><path d="M1 8h2v4H1zM5 5h2v7H5zM9 3h2v9H9zM13 0h2v12h-2z" fill={ds.navy}/></svg>
            <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0" y="1" width="21" height="10" rx="2" stroke={ds.navy} strokeWidth="1" fill="none"/><rect x="22" y="4" width="2" height="4" rx="1" fill={ds.navy}/><rect x="1.5" y="2.5" width="18" height="7" rx="1" fill={ds.navy}/></svg>
          </div>
        </div>
        {children}
        <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",width:134,height:5,borderRadius:3,background:"rgba(0,0,0,0.2)",zIndex:100}}/>
      </div>
    </div>
  );
}

// ── Timer Ring (SVG circle with stroke-dasharray) ──
function TimerRing({tl,total,step,paused}){
  const m=Math.floor(tl/60),s=tl%60;
  const strokeColor=step<=3?ds.blue:ds.gold;
  const r=82,ci=2*Math.PI*r,progress=tl/total,offset=ci*(1-progress);
  return (
    <div style={{position:"relative",width:196,height:196,margin:"0 auto",flexShrink:0}}>
      <svg width="196" height="196" style={{transform:"rotate(-90deg)"}}>
        <circle cx="98" cy="98" r={r} fill="none" stroke={`${strokeColor}20`} strokeWidth="8"/>
        <circle cx="98" cy="98" r={r} fill="none" stroke={strokeColor} strokeWidth="8"
          strokeDasharray={ci} strokeDashoffset={offset} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 0.3s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:48,fontWeight:700,color:ds.navy,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>
          {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
        </div>
        <div style={{fontSize:11,fontWeight:600,color:ds.txL,letterSpacing:3,textTransform:"uppercase",marginTop:2}}>
          {paused?"PAUSED":"SECONDS"}
        </div>
      </div>
    </div>
  );
}

// ── Tab Bar ──
function TabBar({active,onNav,show}){
  if(!show) return null;
  const tabs=[{id:"home",l:"Home",Icon:HomeIcon},{id:"history",l:"Log",Icon:FileText},{id:"stats",l:"Stats",Icon:BarChart3},{id:"more",l:"More",Icon:MoreHorizontal}];
  return (
    <div style={{display:"flex",borderTop:`1px solid ${ds.bd}`,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(12px)",padding:"6px 0 28px",flexShrink:0}}>
      {tabs.map(t => (
        <button key={t.id} onClick={()=>onNav(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"8px 0 0",transition:"all 0.2s ease"}}>
          <t.Icon size={20} color={active===t.id?ds.blue:ds.txL} strokeWidth={active===t.id?2.5:1.8}/>
          <span style={{fontSize:10,fontWeight:active===t.id?700:400,color:active===t.id?ds.blue:ds.txL}}>{t.l}</span>
        </button>
      ))}
    </div>
  );
}

function VoiceBtn({rec,onTap}){
  return (
    <button onClick={onTap} style={{width:40,height:40,borderRadius:"50%",border:"none",background:rec?ds.red:`${ds.blue}15`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s ease",animation:rec?"rp 1s infinite":"none"}}>
      {rec?<Square size={16} color="#fff" fill="#fff"/>:<Mic size={18} color={ds.blue}/>}
      <style>{`@keyframes rp{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}`}</style>
    </button>
  );
}

// ── Wave SVG (reusable) ──
function WaveBottom({color1=ds.blueDk,color2=ds.navy}){
  return (
    <svg viewBox="0 0 390 60" style={{display:"block",width:"100%",flexShrink:0}}>
      <path d={`M0,20 Q100,0 200,25 T390,20 L390,60 L0,60 Z`} fill={color1} opacity="0.5"/>
      <path d={`M0,35 Q100,15 200,35 T390,30 L390,60 L0,60 Z`} fill={color2}/>
    </svg>
  );
}

// ── Splash ──
function Splash({onNext}){
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"#fff"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:54}}>
        <IconCircle Icon={TimerIcon} color={ds.navy} size={80}/>
        <div style={{position:"relative",marginTop:-12,marginRight:-30}}>
          <Check size={22} color={ds.red} strokeWidth={3}/>
        </div>
        <h1 style={{fontSize:28,fontWeight:700,color:ds.navy,margin:"16px 0 0",letterSpacing:"-0.02em"}}>OMP DigiCoach</h1>
        <p style={{fontSize:15,color:ds.txB,margin:"6px 0 0",fontWeight:400,lineHeight:1.5}}>Your Pocket Teaching Coach</p>
        <div style={{width:48,height:2,background:ds.bd,margin:"20px 0"}}/>
        <p style={{fontSize:13,color:ds.txL,margin:0,fontStyle:"italic"}}>A Digital Health Intervention</p>
        <div style={{background:ds.navy,borderRadius:20,padding:"8px 20px",margin:"16px 0"}}>
          <span style={{color:ds.txW,fontSize:13,fontWeight:600}}>By Prof. Muneeza Rizwan</span>
        </div>
        <p style={{fontSize:12,color:ds.txB,margin:"8px 0 0",textAlign:"center",lineHeight:1.6}}>
          Developed for Clinical Teaching<br/>Using the <strong>One-Minute Preceptor Model</strong>
        </p>
      </div>
      <WaveBottom/>
      <div style={{background:ds.navy,padding:"0 0 40px",textAlign:"center"}}>
        <button onClick={onNext} style={{...ds.btnPrimary,padding:"14px 60px",fontSize:16,marginTop:-30,position:"relative",zIndex:10}}>Enter App</button>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"16px 0 0"}}>by <strong style={{color:"rgba(255,255,255,0.8)"}}>Prof. Muneeza Rizwan</strong></p>
      </div>
    </div>
  );
}

// ── Login ──
function Login({onLogin}){
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:ds.headerBg,paddingTop:54}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 30px"}}>
        <IconCircle Icon={User} color="#fff" size={64}/>
        <div style={{width:"100%",...ds.card,padding:"24px 20px",marginTop:24}}>
          {[{icon:User,ph:"Full Name"},{icon:Mail,ph:"your.email@example.com",type:"email"},{icon:Lock,ph:"Password",type:"password"}].map((f,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,...ds.input,padding:"12px 14px",marginBottom:i<2?10:0,border:`1px solid ${ds.bd}`}}>
              <f.icon size={16} color={ds.txL}/>
              <input placeholder={f.ph} type={f.type||"text"} style={{flex:1,border:"none",outline:"none",fontSize:14,background:"transparent",fontFamily:"inherit",color:ds.tx}}/>
            </div>
          ))}
        </div>
        <button onClick={onLogin} style={{width:"100%",padding:"16px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${ds.green},#16A34A)`,color:ds.txW,fontSize:16,fontWeight:600,cursor:"pointer",marginTop:16,boxShadow:"0 4px 14px rgba(34,197,94,0.35)",transition:"all 0.2s ease"}}>Log In</button>
        <span style={{color:"rgba(255,255,255,0.6)",fontSize:13,marginTop:12,cursor:"pointer"}}>Forgot password?</span>
        <div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0",width:"100%"}}>
          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.2)"}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>or</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.2)"}}/>
        </div>
        <div style={{display:"flex",gap:10,width:"100%"}}>
          {["Google","Facebook"].map((p,i) => (
            <button key={p} onClick={onLogin} style={{flex:1,padding:"14px",...ds.btnSecondary,background:i===0?"#fff":"#1877F2",color:i===0?ds.tx:"#fff",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span style={{fontWeight:700}}>{i===0?"G":"f"}</span>{p}
            </button>
          ))}
        </div>
      </div>
      <div style={{textAlign:"center",padding:"16px 0 40px"}}><span style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>Don't have an account? </span><span style={{color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Sign Up</span></div>
    </div>
  );
}

// ── Home ──
function Home({onStart,pc}){
  const[dept,setDept]=useState("Medicine");const[lr,setLr]=useState("Student");const[ct,setCt]=useState("Long Case");const[sd,setSd]=useState(false);
  const sectionIcon=[{Icon:Building2,color:ds.green},{Icon:GraduationCap,color:ds.purple},{Icon:ClipboardList,color:ds.gold}];
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      <div style={{background:ds.headerBg,padding:"16px 20px 24px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <TimerIcon size={28} color={ds.txW}/>
            <div><h2 style={{color:ds.txW,fontSize:18,fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>ONE-MINUTE</h2><h2 style={{color:ds.txW,fontSize:18,fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>PRECEPTOR</h2></div>
          </div>
          <button style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",border:"none",cursor:"pointer"}}><HelpCircle size={18} color={ds.txW}/></button>
        </div>
        <p style={{color:"rgba(255,255,255,0.7)",fontSize:13,margin:"8px 0 0",fontWeight:400,lineHeight:1.5}}>Start a New Teaching Encounter</p>
      </div>
      <div style={{flex:1,padding:16,overflowY:"auto",minHeight:0}}>
        {/* Department */}
        <div style={{...ds.card,padding:16,marginBottom:12,position:"relative",zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <IconCircle Icon={Building2} color={ds.green}/><div><div style={{fontSize:15,fontWeight:700,color:ds.tx,letterSpacing:"-0.02em"}}>Department</div><div style={{fontSize:13,color:ds.txB,fontWeight:400}}>Select your department</div></div>
          </div>
          <button onClick={()=>setSd(!sd)} style={{...ds.input,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontWeight:500,color:ds.tx}}>
            {dept}<ChevronDown size={16} color={ds.txL}/>
          </button>
          {sd&&<div style={{position:"absolute",left:16,right:16,top:"100%",zIndex:50,background:"#fff",borderRadius:16,boxShadow:"0 8px 30px rgba(0,0,0,0.15)",marginTop:-8,maxHeight:180,overflowY:"auto",padding:0,border:`1px solid ${ds.bd}`}}>
            {DEPTS.map(d => <div key={d} onClick={()=>{setDept(d);setSd(false)}} style={{padding:"12px 16px",cursor:"pointer",fontSize:13,color:d===dept?ds.blue:ds.tx,fontWeight:d===dept?600:400,borderBottom:`1px solid ${ds.bdL}`,background:d===dept?ds.surface:"transparent",transition:"all 0.2s ease"}}>{d}</div>)}
          </div>}
        </div>
        {/* Learner Level */}
        <div style={{...ds.card,padding:16,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <IconCircle Icon={GraduationCap} color={ds.purple}/><div><div style={{fontSize:15,fontWeight:700,color:ds.tx,letterSpacing:"-0.02em"}}>Learner Level</div><div style={{fontSize:13,color:ds.txB,fontWeight:400}}>Select the learner's level</div></div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {LEVELS.map(l => <button key={l} onClick={()=>setLr(l)} style={{padding:"8px 16px",borderRadius:14,border:`1.5px solid ${lr===l?ds.purple:"transparent"}`,background:lr===l?ds.purple:"#fff",color:lr===l?ds.txW:ds.txB,fontSize:13,fontWeight:lr===l?600:400,cursor:"pointer",transition:"all 0.2s ease",boxShadow:lr!==l?`inset 0 0 0 1px ${ds.bd}`:"none"}}>{l}</button>)}
          </div>
        </div>
        {/* Case Type */}
        <div style={{...ds.card,padding:16,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <IconCircle Icon={ClipboardList} color={ds.gold}/><div><div style={{fontSize:15,fontWeight:700,color:ds.tx,letterSpacing:"-0.02em"}}>Case Type</div><div style={{fontSize:13,color:ds.txB,fontWeight:400}}>Select the type of case</div></div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {CASES.map(c => <button key={c} onClick={()=>setCt(c)} style={{padding:"8px 16px",borderRadius:14,border:`1.5px solid ${ct===c?ds.gold:"transparent"}`,background:ct===c?ds.gold:"#fff",color:ct===c?ds.txW:ds.txB,fontSize:13,fontWeight:ct===c?600:400,cursor:"pointer",transition:"all 0.2s ease",boxShadow:ct!==c?`inset 0 0 0 1px ${ds.bd}`:"none"}}>{c}</button>)}
          </div>
        </div>
        {/* Start */}
        <button onClick={()=>onStart({dept,learner:lr,caseType:ct})} style={{...ds.btnPrimary,width:"100%",padding:"18px 20px",fontSize:16,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><Play size={14} color="#fff" fill="#fff"/></div>
          <div style={{textAlign:"left"}}><div>Start Teaching Session</div><div style={{fontSize:11,fontWeight:400,opacity:0.8,marginTop:2}}>Begin 1-Minute Preceptor Model (60 sec)</div></div>
        </button>
        <button style={{...ds.btnSecondary,width:"100%",padding:"14px 20px",fontSize:14,fontWeight:600,color:ds.blue,display:"flex",alignItems:"center",gap:10,marginTop:12}}>
          <Clock size={16} color={ds.blue}/><div style={{flex:1,textAlign:"left"}}><div>View Previous Encounters</div><div style={{fontSize:11,fontWeight:400,color:ds.txB,marginTop:1}}>See your teaching history & statistics</div></div><ChevronRight size={16} color={ds.txL}/>
        </button>
      </div>
    </div>
  );
}

// ── Timer Screen ──
function TimerScr({config,onComplete,onCancel,pearls,onSavePearl}){
  const[step,setStep]=useState(1);const[tl,setTl]=useState(60);const[paused,setPaused]=useState(false);const[elapsed,setElapsed]=useState(0);
  const[s1Txt,setS1Txt]=useState("");const[s4,setS4]=useState(["","",""]);const[s4Tags,setS4Tags]=useState([]);
  const[s5,setS5]=useState(["","",""]);const[actPlan,setActPlan]=useState("");const[checks,setChecks]=useState({});
  const[rec,setRec]=useState(false);const[recD,setRecD]=useState({});const[pearlSaved,setPearlSaved]=useState(false);
  const[showSug,setShowSug]=useState(false);const[sugP,setSugP]=useState(null);
  const[note,setNote]=useState("");const[showNote,setShowNote]=useState(false);
  const scrollRef=useRef(null);
  const ref=useRef(null);
  useEffect(()=>{if(paused)return;ref.current=setInterval(()=>{setTl(p=>{if(p<=1){if(step<5){setStep(s=>s+1);return 60}else{clearInterval(ref.current);onComplete(elapsed+60);return 0}}return p-1});setElapsed(e=>e+1)},1000);return()=>clearInterval(ref.current)},[paused,step]);
  useEffect(()=>{if(step===3&&s1Txt.trim()){const m=pearls.find(p=>p.dx.toLowerCase().includes(s1Txt.toLowerCase()));if(m){setSugP(m);setShowSug(true)}}},[step]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=0},[step]);
  const st=STEPS[step-1];const StepIcon=st.icon;
  const goNext=()=>{if(step<5){setStep(x=>x+1);setTl(60)}else onComplete(elapsed)};
  const goBack=()=>{if(step>1){setStep(x=>x-1);setTl(60)}};
  const toggleRec=()=>{if(rec){setRec(false);setRecD(p=>({...p,[step]:3+Math.floor(Math.random()*8)}))}else setRec(true)};
  const toggleChk=(sid,i)=>{const k=`${sid}-${i}`;setChecks(p=>({...p,[k]:!p[k]}))};
  const toggleTag=tg=>setS4Tags(p=>p.includes(tg)?p.filter(x=>x!==tg):[...p,tg]);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      {/* Step indicator */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 20px 0",flexShrink:0}}>
        <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",transition:"all 0.2s ease"}}><ChevronLeft size={22} color={ds.txB}/></button>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:15,fontWeight:700,color:ds.navy,letterSpacing:"-0.02em"}}>Step {step}</span>
          <span style={{color:ds.txL,fontSize:13}}>•</span>
          {[1,2,3,4,5].filter(n=>n!==step).map(n => <span key={n} style={{fontSize:13,fontWeight:n<step?600:400,color:n<step?ds.blue:ds.txL}}>{n}</span>)}
        </div>
        <button style={{background:"none",border:"none",cursor:"pointer"}}><ClipboardList size={18} color={ds.txB}/></button>
      </div>
      {/* Timer */}
      <div style={{padding:"12px 0 0",flexShrink:0}}>
        <div onClick={()=>setPaused(!paused)} style={{cursor:"pointer"}}><TimerRing tl={tl} total={60} step={step} paused={paused}/></div>
      </div>
      {/* Step title */}
      <div style={{textAlign:"center",padding:"10px 20px 0",flexShrink:0}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${st.color}15`,padding:"6px 16px",borderRadius:20}}>
          <StepIcon size={16} color={st.color}/><span style={{fontSize:14,fontWeight:700,color:st.color,letterSpacing:"-0.02em"}}>{st.name}</span>
        </div>
        <p style={{fontSize:13,color:ds.txB,margin:"4px 0 0",fontWeight:400,lineHeight:1.5}}>{st.instruction}</p>
      </div>
      {/* Content */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",minHeight:0,padding:"12px 16px 0",WebkitOverflowScrolling:"touch"}}>
        {/* STEP 1 */}
        {step===1&&<>
          <div style={{...ds.card,padding:14}}>
            <p style={{fontSize:13,color:ds.txB,margin:"0 0 8px",fontWeight:400}}>Ask the learner:</p>
            {st.prompts.map((p,i) => <div key={i} style={{padding:"7px 0",fontSize:13,color:ds.tx,lineHeight:1.5}}>• {p}</div>)}
          </div>
          <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
            <input value={s1Txt} onChange={e=>setS1Txt(e.target.value)} placeholder="Quick or skip answer..." style={{...ds.input,flex:1}}/>
            <VoiceBtn rec={rec} onTap={toggleRec}/>
          </div>
          {recD[1]&&<div style={{display:"flex",alignItems:"center",gap:6,background:`${ds.red}10`,borderRadius:12,padding:"8px 12px",marginTop:6}}><Volume2 size={14} color={ds.red}/><div style={{flex:1,height:12,background:`${ds.red}20`,borderRadius:4}}/><span style={{fontSize:11,color:ds.txB}}>{recD[1]}s</span><Play size={14} color={ds.blue} style={{cursor:"pointer"}}/></div>}
          <div style={{...ds.card,padding:12,marginTop:10}}>
            <p style={{fontSize:13,color:ds.txL,margin:"0 0 6px",fontWeight:600}}>Mark what happened</p>
            {st.checks.map((ck,i)=>{const k=`${st.id}-${i}`,ch=checks[k];return (
              <button key={i} onClick={()=>toggleChk(st.id,i)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",borderRadius:10,border:"none",background:ch?`${ds.blue}10`:"transparent",cursor:"pointer",textAlign:"left",marginBottom:2,transition:"all 0.2s ease"}}>
                <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${ch?ds.blue:ds.bd}`,background:ch?ds.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s ease"}}>{ch&&<Check size={12} color="#fff" strokeWidth={3}/>}</div>
                <span style={{fontSize:13,color:ch?ds.tx:ds.txB,fontWeight:ch?500:400}}>{ck}</span>
              </button>
            )})}
          </div>
        </>}
        {/* STEP 2 */}
        {step===2&&<>
          <div style={{...ds.card,padding:14}}>
            <p style={{fontSize:13,color:ds.txB,margin:"0 0 8px",fontWeight:400}}>Explore reasoning:</p>
            {st.prompts.map((p,i) => <div key={i} style={{padding:"7px 0",fontSize:13,color:ds.tx,lineHeight:1.5}}>• {p}</div>)}
          </div>
          <div style={{...ds.card,padding:12,marginTop:10}}>
            <p style={{fontSize:13,color:ds.txL,margin:"0 0 6px",fontWeight:600}}>Mark what happened</p>
            {st.checks.map((ck,i)=>{const k=`${st.id}-${i}`,ch=checks[k];return (
              <button key={i} onClick={()=>toggleChk(st.id,i)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",borderRadius:10,border:"none",background:ch?`${ds.blue}10`:"transparent",cursor:"pointer",textAlign:"left",marginBottom:2,transition:"all 0.2s ease"}}>
                <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${ch?ds.blue:ds.bd}`,background:ch?ds.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s ease"}}>{ch&&<Check size={12} color="#fff" strokeWidth={3}/>}</div>
                <span style={{fontSize:13,color:ch?ds.tx:ds.txB,fontWeight:ch?500:400}}>{ck}</span>
              </button>
            )})}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><VoiceBtn rec={rec} onTap={toggleRec}/></div>
        </>}
        {/* STEP 3 */}
        {step===3&&<>
          {showSug&&sugP&&<div style={{...ds.card,padding:12,marginBottom:10,borderLeft:`3px solid ${ds.gold}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><Star size={14} color={ds.gold}/><span style={{fontSize:13,fontWeight:700,color:ds.gold}}>Saved pearl for "{sugP.dx}"</span></div>
            <button onClick={()=>setShowSug(false)} style={{width:"100%",marginTop:8,padding:"10px",...ds.btnSecondary,fontSize:13,fontWeight:600,color:ds.gold,borderColor:ds.gold}}>Use Saved Pearl →</button>
          </div>}
          <div style={{...ds.card,padding:14}}>
            <p style={{fontSize:13,color:ds.txB,margin:"0 0 10px",fontWeight:400}}>Teach 1-2 key points:</p>
            <div style={{marginBottom:10}}><span style={{fontSize:13,color:ds.txB}}>• One important thing to remember is...</span><input placeholder="___" style={{...ds.input,marginTop:4,background:ds.bdL}}/></div>
            <div style={{marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}><span style={{fontSize:13,color:ds.txB}}>• In patients with</span><input placeholder="condition" style={{...ds.input,width:100,padding:"8px 10px",background:ds.bdL}}/><span style={{fontSize:13,color:ds.txB}}>always check</span><input placeholder="what" style={{...ds.input,width:100,padding:"8px 10px",background:ds.bdL}}/></div></div>
            <div style={{marginBottom:10}}><span style={{fontSize:13,color:ds.txB}}>• First-line treatment is usually...</span><input placeholder="___" style={{...ds.input,marginTop:4,background:ds.bdL}}/></div>
            <div><span style={{fontSize:13,color:ds.txB}}>• Red flag:</span><input placeholder="___" style={{...ds.input,marginTop:4,background:ds.bdL}}/></div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
            <button onClick={()=>{onSavePearl({dept:config.dept,dx:s1Txt||"General",pts:["","","",""]});setPearlSaved(true)}} disabled={pearlSaved} style={{flex:1,padding:"12px",...ds.btnSecondary,fontSize:13,fontWeight:600,color:pearlSaved?ds.green:ds.txB,borderColor:pearlSaved?ds.green:ds.bd,background:pearlSaved?`${ds.green}10`:"#fff",transition:"all 0.2s ease",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {pearlSaved?<><Check size={14}/><span>Pearl Saved</span></>:<><Star size={14}/><span>Save as teaching pearl</span></>}
            </button>
            <VoiceBtn rec={rec} onTap={toggleRec}/>
          </div>
        </>}
        {/* STEP 4 */}
        {step===4&&<>
          <div style={{...ds.card,padding:14}}>
            <p style={{fontSize:13,color:ds.txB,margin:"0 0 10px",fontWeight:400}}>Provide positive feedback:</p>
            {st.starters.map((s,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",marginBottom:8,borderRadius:12,border:`1px solid ${ds.bd}`,overflow:"hidden"}}>
                <span style={{padding:"12px",fontSize:13,color:ds.txB,fontWeight:500,whiteSpace:"nowrap",borderRight:`1px solid ${ds.bd}`,background:"#fff",flexShrink:0}}>{s}</span>
                <input value={s4[i]} onChange={e=>{const n=[...s4];n[i]=e.target.value;setS4(n)}} placeholder="___" style={{flex:1,padding:"12px",border:"none",fontSize:13,outline:"none",background:ds.bdL,fontFamily:"inherit"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
            {st.tags.map(tg => (
              <button key={tg} onClick={()=>toggleTag(tg)} style={{padding:"7px 14px",borderRadius:14,border:s4Tags.includes(tg)?"none":`1px solid ${ds.bd}`,background:s4Tags.includes(tg)?ds.green:"#fff",color:s4Tags.includes(tg)?ds.txW:ds.txB,fontSize:12,fontWeight:s4Tags.includes(tg)?600:400,cursor:"pointer",transition:"all 0.2s ease",display:"flex",alignItems:"center",gap:4,boxShadow:!s4Tags.includes(tg)?`inset 0 0 0 1px ${ds.bd}`:"none"}}>
                {s4Tags.includes(tg)&&<Check size={12}/>}<span>{tg}</span>
              </button>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><VoiceBtn rec={rec} onTap={toggleRec}/></div>
        </>}
        {/* STEP 5 */}
        {step===5&&<>
          <div style={{...ds.card,padding:14}}>
            <p style={{fontSize:13,color:ds.txB,margin:"0 0 10px",fontWeight:400}}>Guide improvement:</p>
            {st.starters.map((s,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",marginBottom:8,borderRadius:12,border:`1px solid ${ds.bd}`,overflow:"hidden"}}>
                <span style={{padding:"12px",fontSize:13,color:ds.txB,fontWeight:500,whiteSpace:"nowrap",borderRight:`1px solid ${ds.bd}`,background:"#fff",flexShrink:0}}>{s}</span>
                <input value={s5[i]} onChange={e=>{const n=[...s5];n[i]=e.target.value;setS5(n)}} placeholder="___" style={{flex:1,padding:"12px",border:"none",fontSize:13,outline:"none",background:ds.bdL,fontFamily:"inherit"}}/>
              </div>
            ))}
          </div>
          <div style={{...ds.card,padding:14,marginTop:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:15,fontWeight:700,color:ds.tx,letterSpacing:"-0.02em"}}>Action Plan</span><Edit size={16} color={ds.txL}/></div>
            <textarea value={actPlan} onChange={e=>setActPlan(e.target.value)} placeholder="What should the learner study next?" rows={2} style={{...ds.input,resize:"none",background:ds.bdL}}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><VoiceBtn rec={rec} onTap={toggleRec}/></div>
        </>}
        {/* Quick note for all steps */}
        <button onClick={()=>setShowNote(!showNote)} style={{width:"100%",padding:"10px",...ds.btnSecondary,fontSize:12,fontWeight:500,color:ds.txB,marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Edit size={14} color={ds.txL}/><span>{showNote?"Hide note":"Quick note"}</span>
        </button>
        {showNote&&<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Quick observation..." rows={2} style={{...ds.input,marginTop:6,resize:"none",background:ds.bdL}}/>}
        <div style={{height:8}}/>
      </div>
      {/* Nav */}
      <div style={{display:"flex",gap:12,padding:"12px 16px 36px",flexShrink:0}}>
        {step===1?<button onClick={goNext} style={{...ds.btnSecondary,flex:1,padding:"14px",fontSize:14,fontWeight:600,color:ds.txB}}>Skip</button>
        :<button onClick={goBack} style={{...ds.btnSecondary,flex:1,padding:"14px",fontSize:15,fontWeight:600,color:ds.tx,display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronLeft size={18}/></button>}
        <button onClick={goNext} style={{...ds.btnPrimary,flex:3,padding:"14px",fontSize:15,background:step===5?`linear-gradient(135deg,${ds.green},#16A34A)`:ds.ctaBg,boxShadow:step===5?"0 4px 14px rgba(34,197,94,0.3)":"0 4px 14px rgba(37,99,235,0.3)"}}>
          {step===5?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Check size={16}/>Finish</span>:"Next →"}
        </button>
      </div>
    </div>
  );
}

// ── Quick Log ──
function LogScr({config,dur,onSave}){
  const[u,setU]=useState(null);const[ld,setLd]=useState(null);
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      <div style={{padding:"12px 20px 0",flexShrink:0}}><h2 style={{fontSize:24,fontWeight:700,color:ds.navy,margin:0,letterSpacing:"-0.02em"}}>Quick Log</h2><p style={{fontSize:13,color:ds.txB,margin:"4px 0 0",fontWeight:400}}>Session: {Math.floor(dur/60)}m {dur%60}s</p></div>
      <div style={{flex:1,padding:16,overflowY:"auto",minHeight:0}}>
        <div style={{display:"flex",gap:8,marginBottom:16}}>{[["LEARNER",config?.learner],["CASE",config?.caseType],["DEPT",config?.dept]].map(([l,v]) => <div key={l} style={{flex:1,...ds.card,padding:"10px 12px"}}><div style={{fontSize:10,color:ds.txL,fontWeight:600,letterSpacing:1}}>{l}</div><div style={{fontSize:13,fontWeight:600,color:ds.tx,marginTop:2}}>{v}</div></div>)}</div>
        <div style={{marginBottom:16}}><label style={{fontSize:13,fontWeight:600,color:ds.txB,display:"block",marginBottom:6}}>Diagnosis</label><input placeholder="e.g., Pneumonia" style={ds.input}/></div>
        <div style={{marginBottom:16}}><label style={{fontSize:13,fontWeight:600,color:ds.txB,display:"block",marginBottom:8}}>Learner gave diagnosis?</label><div style={{display:"flex",gap:10}}>{[true,false].map(v => <button key={String(v)} onClick={()=>setLd(v)} style={{flex:1,padding:"12px",borderRadius:12,border:ld===v?"none":`1px solid ${ds.bd}`,background:ld===v?(v?`${ds.green}15`:`${ds.red}15`):"#fff",color:ld===v?(v?ds.green:ds.red):ds.tx,fontSize:14,fontWeight:600,cursor:"pointer",transition:"all 0.2s ease",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{v?<><Check size={14}/><span>Yes</span></>:<><X size={14}/><span>No</span></>}</button>)}</div></div>
        <div style={{marginBottom:16}}><label style={{fontSize:13,fontWeight:600,color:ds.txB,display:"block",marginBottom:8}}>Teaching usefulness</label><div style={{display:"flex",gap:6}}>{[1,2,3,4,5,6].map(n => <button key={n} onClick={()=>setU(n)} style={{flex:1,padding:"12px 0",borderRadius:10,border:u===n?"none":`1px solid ${ds.bd}`,background:u===n?ds.blue:"#fff",color:u===n?ds.txW:ds.tx,fontSize:16,fontWeight:700,cursor:"pointer",transition:"all 0.2s ease"}}>{n}</button>)}</div></div>
      </div>
      <div style={{display:"flex",gap:12,padding:"12px 16px 36px",flexShrink:0}}>
        <button onClick={onSave} style={{...ds.btnSecondary,flex:1,padding:"14px",fontSize:14,fontWeight:600,color:ds.txB}}>Skip</button>
        <button onClick={onSave} style={{...ds.btnPrimary,flex:2,padding:"14px",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Check size={16}/><span>Save</span></button>
      </div>
    </div>
  );
}

// ── History ──
function HistoryScr(){
  const[exp,setExp]=useState(null);
  const stepColors=[ds.blue,ds.blue,"#7C3AED",ds.green,ds.gold];
  const stepNames=["Commit","Probe","Teach","Reinforce","Correct"];
  const grouped={};ENCOUNTERS.forEach(e=>{if(!grouped[e.date])grouped[e.date]=[];grouped[e.date].push(e)});
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      <div style={{padding:"12px 20px 12px",flexShrink:0}}>
        <h2 style={{fontSize:24,fontWeight:700,color:ds.navy,margin:"0 0 8px",letterSpacing:"-0.02em"}}>Encounter History</h2>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:ds.txL,fontWeight:600}}>Steps:</span>
          {stepNames.map((s,i) => <div key={i} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:7,height:7,borderRadius:"50%",background:stepColors[i]}}/><span style={{fontSize:10,color:ds.txB}}>{s}</span></div>)}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"0 16px 20px",WebkitOverflowScrolling:"touch"}}>
        {Object.entries(grouped).map(([date,encs]) => <div key={date}>
          <p style={{fontSize:11,fontWeight:700,color:ds.txL,letterSpacing:1,margin:"14px 0 6px"}}>{date}</p>
          {encs.map(e => <div key={e.id} onClick={()=>setExp(exp===e.id?null:e.id)} style={{...ds.card,padding:14,marginBottom:8,cursor:"pointer",border:exp===e.id?`2px solid ${ds.blue}`:"2px solid transparent",transition:"all 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:15,fontWeight:700,color:ds.tx,letterSpacing:"-0.02em"}}>{e.dx}</span>
                  {e.pearl&&<span style={{fontSize:9,background:`${ds.purple}15`,color:ds.purple,padding:"2px 6px",borderRadius:4,fontWeight:600,display:"flex",alignItems:"center",gap:2}}><Star size={8}/>Pearl</span>}
                  {e.voice&&<span style={{fontSize:9,background:`${ds.red}10`,color:ds.red,padding:"2px 6px",borderRadius:4,fontWeight:600,display:"flex",alignItems:"center",gap:2}}><Mic size={8}/>Voice</span>}
                </div>
                <div style={{fontSize:13,color:ds.txB,marginTop:3,fontWeight:400}}>{e.dept} · {e.lr} · {e.ct}</div>
              </div>
              <div style={{textAlign:"right"}}><div style={{fontSize:11,color:ds.txL}}>{e.time}</div><div style={{fontSize:11,fontWeight:600,color:ds.blue,marginTop:2}}>{Math.floor(e.dur/60)}m {e.dur%60}s</div></div>
            </div>
            <div style={{display:"flex",gap:3,marginTop:8}}>{e.steps.map((s,i) => <div key={i} style={{display:"flex",alignItems:"center",gap:3,flex:1}}><div style={{width:8,height:8,borderRadius:"50%",background:s?stepColors[i]:ds.bd,flexShrink:0,transition:"all 0.2s ease"}}/><div style={{height:2,flex:1,borderRadius:1,background:s?`${stepColors[i]}30`:ds.bdL}}/></div>)}</div>
            {e.tags.length>0&&<div style={{display:"flex",gap:4,marginTop:6}}>{e.tags.map(tg => <span key={tg} style={{fontSize:10,background:`${ds.green}15`,color:ds.green,padding:"2px 8px",borderRadius:10,fontWeight:600}}>{tg}</span>)}</div>}
            {exp===e.id&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${ds.bd}`}}>
              <div style={{display:"flex",gap:6,marginBottom:10}}>{[["Useful",`${e.useful}/6`,ds.blue],["Steps",`${e.steps.filter(Boolean).length}/5`,ds.navy],["Duration",`${Math.floor(e.dur/60)}:${String(e.dur%60).padStart(2,"0")}`,ds.txB]].map(([l,v,c]) => <div key={l} style={{flex:1,background:ds.surface,borderRadius:10,padding:8,textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:10,color:ds.txL,marginTop:2}}>{l}</div></div>)}</div>
              {e.s3.some(x=>x)&&<div style={{background:ds.surface,borderRadius:10,padding:10,marginBottom:6}}><p style={{fontSize:10,fontWeight:700,color:ds.purple,letterSpacing:0.5,margin:"0 0 6px"}}>STEP 3 — TAUGHT</p>{e.s3[0]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>Remember:</span> {e.s3[0]}</div>}{e.s3[1]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>In patients with</span> {e.s3[1]}</div>}{e.s3[2]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>Treatment:</span> {e.s3[2]}</div>}{e.s3[3]&&<div style={{fontSize:12,color:ds.tx,lineHeight:1.5}}><span style={{color:ds.txL}}>Red flag:</span> {e.s3[3]}</div>}</div>}
              {(e.s4.some(x=>x)||e.tags.length>0)&&<div style={{background:ds.surface,borderRadius:10,padding:10,marginBottom:6}}><p style={{fontSize:10,fontWeight:700,color:ds.green,letterSpacing:0.5,margin:"0 0 6px"}}>STEP 4 — REINFORCED</p>{e.s4[0]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>You did well in</span> {e.s4[0]}</div>}{e.s4[1]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>Good reasoning because</span> {e.s4[1]}</div>}{e.s4[2]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>I liked how you</span> {e.s4[2]}</div>}{e.tags.length>0&&<div style={{display:"flex",gap:4,marginTop:4}}>{e.tags.map(tg => <span key={tg} style={{fontSize:9,background:`${ds.green}15`,color:ds.green,padding:"2px 8px",borderRadius:10,fontWeight:600}}>● {tg}</span>)}</div>}</div>}
              {(e.s5.some(x=>x)||e.s5plan)&&<div style={{background:ds.surface,borderRadius:10,padding:10,marginBottom:6}}><p style={{fontSize:10,fontWeight:700,color:ds.gold,letterSpacing:0.5,margin:"0 0 6px"}}>STEP 5 — CORRECTED</p>{e.s5[0]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>Next time, try to</span> {e.s5[0]}</div>}{e.s5[1]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>You missed</span> {e.s5[1]}</div>}{e.s5[2]&&<div style={{fontSize:12,color:ds.tx,marginBottom:3,lineHeight:1.5}}><span style={{color:ds.txL}}>Consider</span> {e.s5[2]}</div>}{e.s5plan&&<div style={{marginTop:6,padding:"8px 10px",background:"rgba(255,255,255,0.9)",borderRadius:8,border:`1px solid ${ds.bd}`}}><span style={{fontSize:10,fontWeight:700,color:ds.gold}}>ACTION PLAN: </span><span style={{fontSize:12,color:ds.tx}}>{e.s5plan}</span></div>}</div>}
              <button style={{width:"100%",padding:"10px",...ds.btnSecondary,fontSize:12,fontWeight:600,color:ds.blue,display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4}}><Download size={14}/>Export encounter</button>
            </div>}
          </div>)}
        </div>)}
      </div>
    </div>
  );
}

// ── Stats ──
function StatsScr(){
  const stepAvg=[55,48,42,35,28];const stepComp=[100,96,85,77,62];const mx=Math.max(...WDATA.map(d=>d.s),1);
  const heatmap=[[3,2,4,1,3,0,1],[2,3,2,3,1,1,0],[1,2,3,2,4,0,2],[3,1,2,2,3,1,0]];
  const rr=60,cx=80,cy=80;const angles=STEPS.map((_,i)=>((i*360/5)-90)*Math.PI/180);const vals=stepAvg.map(v=>v/60);
  const radarPts=vals.map((v,i)=>`${cx+rr*v*Math.cos(angles[i])},${cy+rr*v*Math.sin(angles[i])}`).join(" ");
  const stepColors=[ds.blue,ds.blue,"#7C3AED",ds.green,ds.gold];
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      <div style={{padding:"12px 20px 12px",flexShrink:0}}><h2 style={{fontSize:24,fontWeight:700,color:ds.navy,margin:0,letterSpacing:"-0.02em"}}>Teaching Analytics</h2></div>
      <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"0 16px 20px",WebkitOverflowScrolling:"touch"}}>
        {/* Insight */}
        <div style={{background:ds.headerBg,borderRadius:16,padding:"16px",marginBottom:14,color:ds.txW,boxShadow:"0 4px 14px rgba(37,99,235,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Lightbulb size={14} color="#FCD34D"/><span style={{fontSize:11,fontWeight:700,letterSpacing:1,opacity:0.8}}>INSIGHT</span></div>
          <p style={{fontSize:13,fontWeight:400,margin:0,lineHeight:1.5}}>You skip <strong>Step 5 (Corrections)</strong> in 38% of sessions. Learners benefit most from constructive feedback.</p>
        </div>
        {/* Summary */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {[{n:"26",l:"Sessions",s:"+4 this week",c:ds.blue,Icon:TimerIcon},{n:"4m 52s",l:"Avg Duration",s:"Target: 5m",c:ds.navy,Icon:Clock},{n:"8",l:"Pearls Saved",s:"3 reused",c:ds.purple,Icon:Star},{n:"72%",l:"5-Step Rate",s:"↑12%",c:ds.green,Icon:Check}].map(s => (
            <div key={s.l} style={{...ds.card,padding:14}}>
              <IconCircle Icon={s.Icon} color={s.c} size={32}/>
              <div style={{fontSize:24,fontWeight:700,color:ds.navy,marginTop:8,letterSpacing:"-0.02em"}}>{s.n}</div>
              <div style={{fontSize:13,color:ds.txB,marginTop:1,fontWeight:400}}>{s.l}</div>
              <div style={{fontSize:11,color:s.c,fontWeight:600,marginTop:4}}>{s.s}</div>
            </div>
          ))}
        </div>
        {/* Radar */}
        <div style={{...ds.card,padding:16,marginBottom:14}}>
          <h4 style={{fontSize:15,fontWeight:700,color:ds.navy,margin:"0 0 10px",letterSpacing:"-0.02em"}}>OMP Step Pattern</h4>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              {[0.33,0.66,1].map(gl => <polygon key={gl} points={angles.map(a=>`${cx+rr*gl*Math.cos(a)},${cy+rr*gl*Math.sin(a)}`).join(" ")} fill="none" stroke={ds.bd} strokeWidth="1"/>)}
              {angles.map((a,i) => <line key={i} x1={cx} y1={cy} x2={cx+rr*Math.cos(a)} y2={cy+rr*Math.sin(a)} stroke={ds.bd} strokeWidth="1"/>)}
              <polygon points={radarPts} fill={`${ds.blue}20`} stroke={ds.blue} strokeWidth="2"/>
              {vals.map((v,i) => <circle key={i} cx={cx+rr*v*Math.cos(angles[i])} cy={cy+rr*v*Math.sin(angles[i])} r="4" fill={stepColors[i]}/>)}
            </svg>
            <div style={{flex:1}}>{STEPS.map((s,i) => <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:8,height:8,borderRadius:"50%",background:stepColors[i],flexShrink:0}}/><span style={{fontSize:11,color:ds.txB,flex:1,fontWeight:400}}>{s.name.split(" ").slice(-1)[0]}</span><span style={{fontSize:11,fontWeight:700,color:ds.navy}}>{stepAvg[i]}s</span></div>)}</div>
          </div>
        </div>
        {/* Funnel */}
        <div style={{...ds.card,padding:16,marginBottom:14}}>
          <h4 style={{fontSize:15,fontWeight:700,color:ds.navy,margin:"0 0 10px",letterSpacing:"-0.02em"}}>Step Completion Funnel</h4>
          {STEPS.map((s,i) => <div key={i} style={{marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,color:ds.tx,fontWeight:400}}>Step {i+1}</span><span style={{fontSize:12,fontWeight:700,color:stepComp[i]>80?ds.green:stepComp[i]>60?ds.gold:ds.red}}>{stepComp[i]}%</span></div>
            <div style={{height:8,borderRadius:4,background:ds.bdL}}><div style={{height:"100%",borderRadius:4,width:`${stepComp[i]}%`,background:stepColors[i],transition:"width 0.5s ease"}}/></div>
          </div>)}
        </div>
        {/* Heatmap */}
        <div style={{...ds.card,padding:16,marginBottom:14}}>
          <h4 style={{fontSize:15,fontWeight:700,color:ds.navy,margin:"0 0 10px",letterSpacing:"-0.02em"}}>Teaching Consistency</h4>
          <div style={{display:"flex",gap:2}}>
            <div style={{display:"flex",flexDirection:"column",gap:2,marginRight:4}}>{["M","T","W","T","F","S","S"].map((d,i) => <div key={i} style={{width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:ds.txL,fontWeight:400}}>{d}</div>)}</div>
            {heatmap.map((week,wi) => <div key={wi} style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>{week.map((v,di) => <div key={di} style={{height:14,borderRadius:3,background:v===0?ds.bdL:v===1?"#BBF7D0":v===2?"#4ADE80":v>=3?ds.green:"#059669",transition:"all 0.2s ease"}}/>)}</div>)}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:6,justifyContent:"flex-end"}}><span style={{fontSize:9,color:ds.txL}}>Less</span>{[ds.bdL,"#BBF7D0","#4ADE80",ds.green].map((c,i) => <div key={i} style={{width:10,height:10,borderRadius:2,background:c}}/>)}<span style={{fontSize:9,color:ds.txL}}>More</span></div>
        </div>
        {/* Weekly */}
        <div style={{...ds.card,padding:16,marginBottom:14}}>
          <h4 style={{fontSize:15,fontWeight:700,color:ds.navy,margin:"0 0 12px",letterSpacing:"-0.02em"}}>This Week</h4>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>{WDATA.map(d => <div key={d.d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><span style={{fontSize:11,fontWeight:700,color:ds.navy}}>{d.s}</span><div style={{width:"100%",borderRadius:6,height:`${Math.max((d.s/mx)*55,3)}px`,background:d.s>0?ds.blue:ds.bdL,transition:"height 0.5s ease"}}/><span style={{fontSize:10,color:ds.txB,fontWeight:400}}>{d.d}</span></div>)}</div>
        </div>
        {/* Learner */}
        <div style={{...ds.card,padding:16}}>
          <h4 style={{fontSize:15,fontWeight:700,color:ds.navy,margin:"0 0 10px",letterSpacing:"-0.02em"}}>By Learner Level</h4>
          {[{l:"Student",v:42,c:ds.blue},{l:"House Officer",v:33,c:ds.purple},{l:"Resident",v:25,c:ds.green}].map(d => <div key={d.l} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,color:ds.tx,fontWeight:400}}>{d.l}</span><span style={{fontSize:13,fontWeight:700,color:d.c}}>{d.v}%</span></div>
            <div style={{height:6,borderRadius:3,background:ds.bdL}}><div style={{height:"100%",borderRadius:3,width:`${d.v}%`,background:d.c,transition:"width 0.5s ease"}}/></div>
          </div>)}
        </div>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

// ── More / About / Pearls ──
function MoreScr({onNav,pc}){
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      <div style={{padding:"12px 20px 16px",flexShrink:0}}><h2 style={{fontSize:24,fontWeight:700,color:ds.navy,margin:0,letterSpacing:"-0.02em"}}>More</h2></div>
      <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"0 16px 20px"}}>
        {[{l:"Teaching Pearls",d:`${pc} pearls saved`,Icon:Star,c:ds.gold,tg:"pearls"},{l:"About OMP",d:"Learn the model",Icon:BookOpen,c:ds.blue,tg:"about"},{l:"Settings",d:"Timer & data",Icon:Settings,c:ds.txB,tg:"settings"},{l:"Export Data",d:"CSV download",Icon:Download,c:ds.green,tg:null}].map(i => (
          <div key={i.l} onClick={()=>i.tg&&onNav(i.tg)} style={{...ds.card,padding:16,marginBottom:8,display:"flex",alignItems:"center",gap:14,cursor:i.tg?"pointer":"default",transition:"all 0.2s ease"}}>
            <IconCircle Icon={i.Icon} color={i.c}/><div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:ds.tx,letterSpacing:"-0.02em"}}>{i.l}</div><div style={{fontSize:13,color:ds.txB,marginTop:2,fontWeight:400}}>{i.d}</div></div><ChevronRight size={16} color={ds.txL}/>
          </div>
        ))}
        <p style={{textAlign:"center",fontSize:13,color:ds.txB,margin:"24px 0 0",fontWeight:600}}>by Prof. Muneeza Rizwan</p>
      </div>
    </div>
  );
}

function AboutScr({onBack}){
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      <div style={{padding:"12px 20px",flexShrink:0}}><button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:ds.blue,fontWeight:600,padding:0,marginBottom:8,display:"flex",alignItems:"center",gap:4,transition:"all 0.2s ease"}}><ChevronLeft size={16}/>Back</button><h2 style={{fontSize:24,fontWeight:700,color:ds.navy,margin:0,letterSpacing:"-0.02em"}}>About OMP</h2></div>
      <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"8px 16px 20px"}}>
        <div style={{background:ds.headerBg,borderRadius:16,padding:24,textAlign:"center",boxShadow:"0 4px 14px rgba(37,99,235,0.2)"}}>
          <TimerIcon size={40} color={ds.txW}/>
          <h3 style={{color:ds.txW,fontSize:18,fontWeight:700,margin:"12px 0 4px",letterSpacing:"-0.02em"}}>One-Minute Preceptor</h3>
          <p style={{color:"rgba(255,255,255,0.6)",fontSize:13,margin:0,fontWeight:600}}>by Prof. Muneeza Rizwan</p>
        </div>
      </div>
    </div>
  );
}

function PearlLib({pearls,onBack}){
  const[s,setS]=useState("");const f=pearls.filter(p=>!s||p.dx.toLowerCase().includes(s.toLowerCase()));
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:54,background:ds.surface,minHeight:0}}>
      <div style={{padding:"12px 20px",flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:ds.blue,fontWeight:600,padding:0,marginBottom:8,display:"flex",alignItems:"center",gap:4}}><ChevronLeft size={16}/>Back</button>
        <h2 style={{fontSize:24,fontWeight:700,color:ds.navy,margin:"0 0 10px",letterSpacing:"-0.02em"}}>Teaching Pearls</h2>
        <div style={{position:"relative"}}><Search size={16} color={ds.txL} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}/><input value={s} onChange={e=>setS(e.target.value)} placeholder="Search by diagnosis..." style={{...ds.input,paddingLeft:40}}/></div>
      </div>
      <div style={{flex:1,overflowY:"auto",minHeight:0,padding:"12px 16px 20px",WebkitOverflowScrolling:"touch"}}>
        {f.map(p => <div key={p.id} style={{...ds.card,padding:14,marginBottom:8}}>
          <div style={{display:"flex",gap:6,marginBottom:8}}><span style={{fontSize:10,background:`${ds.purple}15`,color:ds.purple,padding:"3px 8px",borderRadius:6,fontWeight:600}}>{p.dept}</span><span style={{fontSize:10,background:ds.surface,color:ds.blue,padding:"3px 8px",borderRadius:6,fontWeight:600}}>{p.dx}</span><span style={{marginLeft:"auto"}}><Star size={16} color={p.fav?ds.gold:ds.txL} fill={p.fav?ds.gold:"none"}/></span></div>
          {p.pts.filter(x=>x).map((pt,i) => <div key={i} style={{fontSize:13,color:ds.tx,padding:"4px 0",lineHeight:1.5,fontWeight:400}}><span style={{color:ds.txL,fontSize:11,fontWeight:600}}>{["Remember:","Check:","Treatment:","Red flag:"][i]}</span> {pt}</div>)}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8,alignItems:"center"}}><span style={{fontSize:11,color:ds.txL,fontWeight:400}}>Used {p.used}x</span><div style={{display:"flex",gap:8}}><button style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:2,fontSize:12,color:ds.blue,fontWeight:600}}><Edit size={12}/>Edit</button><button style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:2,fontSize:12,color:ds.red,fontWeight:600}}><Trash2 size={12}/>Delete</button></div></div>
        </div>)}
      </div>
    </div>
  );
}

function Toast({show}){
  if(!show) return null;
  return (
    <div style={{position:"absolute",top:70,left:16,right:16,zIndex:200,background:ds.green,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 24px rgba(34,197,94,0.35)",animation:"sld .3s ease"}}>
      <Check size={20} color="#fff"/><div><div style={{color:ds.txW,fontSize:14,fontWeight:700}}>Encounter Saved!</div><div style={{color:"rgba(255,255,255,0.7)",fontSize:12,fontWeight:400}}>Pearl added to library</div></div>
      <style>{`@keyframes sld{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

// ── Main App (ZERO functional changes) ──
export default function App(){
  const[scr,setScr]=useState("splash");const[tab,setTab]=useState("home");const[sub,setSub]=useState(null);
  const[cfg,setCfg]=useState(null);const[dur,setDur]=useState(0);const[toast,setToast]=useState(false);
  const[pearls,setPearls]=useState([...INIT_PEARLS]);
  const showTabs=["home","history","stats","more"].includes(scr)&&!sub;
  const onStart=useCallback(c=>{setCfg(c);setScr("timer")},[]);
  const onDone=useCallback(d=>{setDur(d);setScr("log")},[]);
  const onSave=useCallback(()=>{setScr("home");setTab("home");setToast(true);setTimeout(()=>setToast(false),3000)},[]);
  const onTab=useCallback(tb=>{setTab(tb);setScr(tb);setSub(null)},[]);
  const onSavePearl=useCallback(p=>{setPearls(pr=>[...pr,{id:"p"+Date.now(),dept:p.dept,dx:p.dx,pts:p.pts,used:1,fav:false}])},[]);

  let content=null;
  if(sub==="pearls") content=<PearlLib pearls={pearls} onBack={()=>setSub(null)}/>;
  else if(sub==="about") content=<AboutScr onBack={()=>setSub(null)}/>;
  else if(sub==="settings") content=<AboutScr onBack={()=>setSub(null)}/>;
  else if(scr==="splash") content=<Splash onNext={()=>setScr("login")}/>;
  else if(scr==="login") content=<Login onLogin={()=>{setScr("home");setTab("home")}}/>;
  else if(scr==="home") content=<Home onStart={onStart} pc={pearls.length}/>;
  else if(scr==="timer") content=<TimerScr config={cfg} onComplete={onDone} onCancel={()=>{setScr("home");setTab("home")}} pearls={pearls} onSavePearl={onSavePearl}/>;
  else if(scr==="log") content=<LogScr config={cfg} dur={dur} onSave={onSave}/>;
  else if(scr==="history") content=<HistoryScr/>;
  else if(scr==="stats") content=<StatsScr/>;
  else if(scr==="more") content=<MoreScr onNav={setSub} pc={pearls.length}/>;

  return (<Phone><Toast show={toast}/>{content}<TabBar active={tab} onNav={onTab} show={showTabs}/></Phone>);
}
