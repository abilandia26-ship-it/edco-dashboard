import { useState, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LabelList
} from "recharts";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const HITOS = [
  "Ficha marketing",
  "Creación del Código y Siglas",
  "Creación de la Cohorte",
  "Ajuste Pauta Plantilla Júpiter",
  "Aprobación de Tarifa",
  "Salesforce",
  "Creacion de BECA",
  "Creación de los Artes",
  "Activación de Pauta",
  "Seguimiento Admisiones",
  "Aprobación Docente DGGA",
  "Certificados",
];

const HITO_SHORT = {
  "Ficha marketing": "Ficha Mkt",
  "Creación del Código y Siglas": "Código/Siglas",
  "Creación de la Cohorte": "Cohorte",
  "Ajuste Pauta Plantilla Júpiter": "Pauta Júpiter",
  "Aprobación de Tarifa": "Tarifa",
  "Salesforce": "Salesforce",
  "Creacion de BECA": "BECA",
  "Creación de los Artes": "Artes",
  "Activación de Pauta": "Act. Pauta",
  "Seguimiento Admisiones": "Admisiones",
  "Aprobación Docente DGGA": "Doc. DGGA",
  "Certificados": "Certificados",
};

const ETAPA_ORDER = [
  "0. SIN INICIAR",
  "1. DISEÑO Y DESARROLLO",
  "2. PUESTA A PUNTO",
  "3. VENTA",
  "4. COMPLETADO",
];

const COLOR = {
  green: "#10b981", yellow: "#f59e0b", red: "#ef4444", gray: "#9ca3af",
  blue: "#3b82f6", indigo: "#6366f1", purple: "#8b5cf6", teal: "#14b8a6",
};

const RISK_COLORS = { Alto: COLOR.red, Medio: COLOR.yellow, Bajo: COLOR.green, Cerrado: COLOR.gray };

// ─── UTILS ────────────────────────────────────────────────────────────────────

// Normaliza encabezados: quita tildes, espacios, minúsculas → clave limpia
function norm(k) {
  if (!k) return "";
  return k.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/\s+/g, "_");
}

// Precio: "$1.390,00" → 1390  |  "1390" → 1390
function parsePrice(v) {
  if (!v && v !== 0) return 0;
  let s = v.toString()
    .replace(/\$/g, "")       // quita $
    .replace(/\s/g, "")       // quita espacios
    .trim();
  // Formato europeo: punto=miles, coma=decimal  →  "1.390,00"
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Formato con coma como miles: "1,390.00"
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", ".").replace("%", ""));
  return isNaN(n) ? null : n;
}

// Fechas: "2-mar-26", "27-abr-26", "01/09/2025", "2026-03-02"
const MESES = { ene:0,jan:0,feb:1,mar:2,abr:3,apr:3,may:4,jun:5,jul:6,ago:7,aug:7,sep:8,oct:9,nov:10,dic:11,dec:11 };
function parseDate(v) {
  if (!v || v === "" || /no.j[uú]piter/i.test(v)) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = v.toString().trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10));
  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split("/");
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  // d-mmm-yy  o  d-mmm-yyyy  (2-mar-26, 31-ago-26)
  const m = s.match(/^(\d{1,2})-([a-záéíóúüñ]{3})-(\d{2,4})$/i);
  if (m) {
    const mes = MESES[m[2].toLowerCase()];
    if (mes !== undefined) {
      const yr = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
      return new Date(yr, mes, parseInt(m[1]));
    }
  }
  return null;
}

function parseHito(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v);
  return (n === 0 || n === 1 || n === 2) ? n : null;
}

function normalizeEtapa(v) {
  if (!v) return null;
  const s = v.toString().trim().toUpperCase();
  if (s.includes("SIN INICIAR") || s === "0") return "0. SIN INICIAR";
  if (s.includes("DISE") || s.includes("DESARROLLO")) return "1. DISEÑO Y DESARROLLO";
  if (s.includes("PUESTA") || s.includes("PUNTO")) return "2. PUESTA A PUNTO";
  if (s.includes("VENTA")) return "3. VENTA";
  if (s.includes("COMPLETADO")) return "4. COMPLETADO";
  return v.toString().trim();
}

const FAC_MAP = {
  "GASTRONOMIA":"GASTRONOMÍA","GASTRONOMÍA":"GASTRONOMÍA",
  "MUSICA":"MÚSICA","MÚSICA":"MÚSICA",
  "DERECHO":"DERECHO","ARQUITECTURA":"ARQUITECTURA",
  "FICA":"FICA","EDN":"EDN","NODO":"NODO","FACEA":"FACEA","SALUD":"SALUD",
};
function normFac(v) {
  if (!v) return "SIN DEFINIR";
  const s = v.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if (FAC_MAP[s]) return FAC_MAP[s];
  if (s.includes("COMUNICAC")) return "COMUNICACIÓN";
  if (s.includes("PSICOLOG")) return "PSICOLOGÍA";
  if (s.includes("CIENCIAS POL") || s.includes("CC. POL")) return "CC. POLÍTICAS";
  return v.toString().trim().toUpperCase();
}

// ─── PROCESAMIENTO CSV ────────────────────────────────────────────────────────
// Convierte array de objetos PapaParse (cualquier separador) en programas calculados
function buildPrograms(rawRows) {
  // rawRows: [{Facultad:"SALUD", Programa:"...", ...}, ...]
  // Las claves pueden venir con o sin tildes → normalizamos
  return rawRows
    .filter(r => {
      const prog = r[Object.keys(r).find(k => norm(k) === "programa")] || "";
      return prog.toString().trim() !== "";
    })
    .map(r => {
      // Construir objeto con claves normalizadas
      const o = {};
      Object.entries(r).forEach(([k, v]) => { o[norm(k)] = v; });

      const etapa    = normalizeEtapa(o.etapa);
      const facultad = normFac(o.facultad);
      const precio   = parsePrice(o.precio);
      const meta     = parseNum(o.meta_de_estudiantes) ?? 0;
      const docs     = parseNum(o.estudiantes_documentados) ?? 0;
      const fechaInicio = parseDate(o.fecha_de_inicio);
      const fechaFin    = parseDate(o.fecha_de_fin);

      // Hitos (12 columnas)
      const hitoVals = HITOS.map(h => parseHito(o[norm(h)]));
      const valid    = hitoVals.filter(v => v !== null);
      const hitoSum  = valid.reduce((a, b) => a + b, 0);
      const hitoMax  = valid.length * 2;
      const avance   = hitoMax > 0 ? hitoSum / hitoMax : 0;

      // Días para inicio
      const today = new Date(); today.setHours(0,0,0,0);
      const diasInicio = fechaInicio
        ? Math.ceil((fechaInicio - today) / 86400000)
        : null;

      // Riesgo
      let riesgo = "Bajo";
      if (etapa === "4. COMPLETADO") riesgo = "Cerrado";
      else if (diasInicio !== null && diasInicio < 30 && avance < 0.8) riesgo = "Alto";
      else if (diasInicio !== null && diasInicio < 60 && avance < 0.6) riesgo = "Medio";

      const cumCom       = meta > 0 ? docs / meta : 0;
      const ingPot       = precio * meta;
      const ingDoc       = precio * docs;
      const brecha       = ingPot - ingDoc;

      return {
        programa: (o.programa || "").toString().trim(),
        facultad, etapa, ciclo: o.ciclo || "",
        precio, meta, docs, fechaInicio, fechaFin,
        hitoVals, avance, diasInicio, riesgo,
        cumCom, cuposPendientes: Math.max(0, meta - docs),
        ingPot, ingDoc, brecha,
        // campos de alerta (pueden estar vacíos en este CSV)
        codigoBanner: o.codigo_banner_curso || o.codigo_banner || "",
        cohorte:      o.cohorte || "",
        crm:          o.crm || "",
        pep:          o.pep || "",
      };
    });
}

// ─── FORMATEO ─────────────────────────────────────────────────────────────────
const fmtUSD = n => n || n===0
  ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)
  : "-";
const fmtPct = (n, d=1) => `${(n*100).toFixed(d)}%`;
const fmtDate = d => d ? d.toLocaleDateString("es-EC",{day:"2-digit",month:"short",year:"numeric"}) : "-";

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color="blue", icon }) {
  const cls = {
    blue:   "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    green:  "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    yellow: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
    red:    "from-red-50 to-red-100 border-red-200 text-red-700",
    purple: "from-violet-50 to-violet-100 border-violet-200 text-violet-700",
    gray:   "from-gray-50 to-gray-100 border-gray-200 text-gray-600",
    teal:   "from-teal-50 to-teal-100 border-teal-200 text-teal-700",
    indigo: "from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700",
  };
  return (
    <div className={`bg-gradient-to-br ${cls[color]} border rounded-2xl p-4 flex flex-col gap-1 shadow-sm`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-70">
        {icon} {label}
      </div>
      <div className="text-2xl font-black leading-tight">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  );
}

function RiskBadge({ r }) {
  const cls = {
    Alto:    "bg-red-100 text-red-700 border-red-300",
    Medio:   "bg-amber-100 text-amber-700 border-amber-300",
    Bajo:    "bg-emerald-100 text-emerald-700 border-emerald-300",
    Cerrado: "bg-gray-100 text-gray-500 border-gray-300",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls[r]||cls.Bajo}`}>{r}</span>;
}

function AvBar({ v }) {
  const pct = Math.round(v*100);
  const col = pct>=80?"bg-emerald-500":pct>=50?"bg-amber-500":"bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[50px]">
        <div className={`${col} h-2 rounded-full`} style={{width:`${pct}%`}}/>
      </div>
      <span className="text-xs font-bold w-9 text-right">{pct}%</span>
    </div>
  );
}

const Tip = ({ active, payload, label }) =>
  active && payload?.length ? (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color}}>{p.name}: <b>{
          typeof p.value==="number"&&p.value<=1&&p.name!=="Meta"&&p.name!=="Documentados"&&p.name!=="count"&&p.name!=="Programas"
            ? fmtPct(p.value) : p.value
        }</b></p>
      ))}
    </div>
  ) : null;

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-black text-gray-800 tracking-tight">{title}</h2>
      {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── SECCIÓN 1: RESUMEN ───────────────────────────────────────────────────────
function Resumen({ P }) {
  const n = P.length;
  const comp = P.filter(p=>p.etapa==="4. COMPLETADO").length;
  const venta = P.filter(p=>p.etapa==="3. VENTA").length;
  const puesta = P.filter(p=>p.etapa==="2. PUESTA A PUNTO").length;
  const diseno = P.filter(p=>p.etapa==="1. DISEÑO Y DESARROLLO").length;
  const sinIni = P.filter(p=>p.etapa==="0. SIN INICIAR").length;
  const alto = P.filter(p=>p.riesgo==="Alto").length;
  const avGlobal = P.reduce((a,p)=>a+p.avance,0)/(n||1);
  const metaT = P.reduce((a,p)=>a+p.meta,0);
  const docsT = P.reduce((a,p)=>a+p.docs,0);
  const cumT  = metaT>0?docsT/metaT:0;
  const ingPT = P.reduce((a,p)=>a+p.ingPot,0);
  const ingDT = P.reduce((a,p)=>a+p.ingDoc,0);
  const brecT = ingPT - ingDT;

  return (
    <div>
      <SectionHeader title="Resumen Ejecutivo" sub="Indicadores clave del portafolio EDCO" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard icon="📋" label="Total Programas" value={n} color="blue"/>
        <KpiCard icon="⚙️" label="Avance Operativo Global" value={fmtPct(avGlobal)}
          color={avGlobal>=0.8?"green":avGlobal>=0.5?"yellow":"red"}/>
        <KpiCard icon="✅" label="Completados" value={comp} sub={`${((comp/n)*100).toFixed(0)}% del total`} color="green"/>
        <KpiCard icon="🛒" label="En Venta" value={venta} color="teal"/>
        <KpiCard icon="🔧" label="Puesta a Punto" value={puesta} color="indigo"/>
        <KpiCard icon="✏️" label="Diseño y Desarrollo" value={diseno} color="purple"/>
        <KpiCard icon="⏸️" label="Sin Iniciar" value={sinIni} color="gray"/>
        <KpiCard icon="🔴" label="Riesgo Alto" value={alto} color="red"/>
        <KpiCard icon="🎯" label="Meta Total Estudiantes" value={metaT.toLocaleString()} color="blue"/>
        <KpiCard icon="👥" label="Estudiantes Documentados" value={docsT.toLocaleString()} sub={`de ${metaT}`} color="teal"/>
        <KpiCard icon="📊" label="Cumplimiento Comercial" value={fmtPct(cumT)}
          color={cumT>=0.8?"green":cumT>=0.5?"yellow":"red"}/>
        <KpiCard icon="💰" label="Ingreso Potencial" value={fmtUSD(ingPT)} color="indigo"/>
        <KpiCard icon="💵" label="Ingreso Documentado" value={fmtUSD(ingDT)}
          sub={`${fmtPct(ingPT>0?ingDT/ingPT:0)} capturado`} color="green"/>
        <KpiCard icon="⚠️" label="Brecha Comercial" value={fmtUSD(brecT)} color="red"/>
      </div>
    </div>
  );
}

// ─── SECCIÓN 2: GRÁFICOS ──────────────────────────────────────────────────────
function Graficos({ P }) {
  const porEtapa = ETAPA_ORDER.map(e=>({
    name: e.replace(/^\d+\.\s*/,""),
    count: P.filter(p=>p.etapa===e).length
  }));

  const facMap = {};
  P.forEach(p => {
    if(!facMap[p.facultad]) facMap[p.facultad]={sum:0,n:0,meta:0,docs:0};
    facMap[p.facultad].sum+=p.avance; facMap[p.facultad].n++;
    facMap[p.facultad].meta+=p.meta; facMap[p.facultad].docs+=p.docs;
  });
  const porFac = Object.entries(facMap)
    .map(([name,v])=>({name, avance:v.sum/v.n, Meta:v.meta, Documentados:v.docs}))
    .sort((a,b)=>b.avance-a.avance);

  const riesgoMap={Alto:0,Medio:0,Bajo:0,Cerrado:0};
  P.forEach(p=>riesgoMap[p.riesgo]++);
  const riesgoPie = Object.entries(riesgoMap).map(([name,value])=>({name,value}));

  const brechaTop = [...P].filter(p=>p.brecha>0)
    .sort((a,b)=>b.brecha-a.brecha).slice(0,10)
    .map(p=>({name:p.programa.length>38?p.programa.slice(0,38)+"…":p.programa, brecha:p.brecha}));

  const hitoCum = HITOS.map((h,i)=>{
    const vals = P.map(p=>p.hitoVals[i]).filter(v=>v!==null);
    return {name:HITO_SHORT[h], avance: vals.length?vals.reduce((a,b)=>a+b,0)/(vals.length*2):0};
  }).sort((a,b)=>a.avance-b.avance);

  const ETAPA_COLORS = [COLOR.gray,COLOR.purple,COLOR.indigo,COLOR.teal,COLOR.green];

  return (
    <div>
      <SectionHeader title="Gráficos Principales" sub="Análisis visual del portafolio"/>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Programas por Etapa</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={porEtapa} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="name" tick={{fontSize:10}}/>
              <YAxis tick={{fontSize:10}} allowDecimals={false}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="count" name="Programas" radius={[4,4,0,0]}>
                {porEtapa.map((_,i)=><Cell key={i} fill={ETAPA_COLORS[i]}/>)}
                <LabelList dataKey="count" position="top" style={{fontSize:11,fontWeight:700}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Avance Operativo por Facultad</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={porFac} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="name" tick={{fontSize:9}}/>
              <YAxis tickFormatter={v=>`${(v*100).toFixed(0)}%`} domain={[0,1]} tick={{fontSize:10}}/>
              <Tooltip formatter={v=>fmtPct(v)}/>
              <Bar dataKey="avance" name="Avance" radius={[4,4,0,0]}>
                {porFac.map((d,i)=><Cell key={i} fill={d.avance>=0.8?COLOR.green:d.avance>=0.5?COLOR.yellow:COLOR.red}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Distribución de Riesgo</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={riesgoPie} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>
                {riesgoPie.map((e,i)=><Cell key={i} fill={RISK_COLORS[e.name]}/>)}
              </Pie>
              <Tooltip/><Legend/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Meta vs Documentados por Facultad</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={porFac.slice(0,12)} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="name" tick={{fontSize:9}}/>
              <YAxis tick={{fontSize:10}} allowDecimals={false}/>
              <Tooltip content={<Tip/>}/><Legend/>
              <Bar dataKey="Meta" fill={COLOR.blue} radius={[3,3,0,0]}/>
              <Bar dataKey="Documentados" fill={COLOR.green} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Top 10 Brecha Comercial</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={brechaTop} layout="vertical" margin={{top:5,right:20,left:10,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fontSize:9}}/>
              <YAxis type="category" dataKey="name" width={150} tick={{fontSize:9}}/>
              <Tooltip formatter={v=>fmtUSD(v)}/>
              <Bar dataKey="brecha" name="Brecha" fill={COLOR.red} radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Cumplimiento por Hito Operativo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hitoCum} layout="vertical" margin={{top:5,right:30,left:10,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`${(v*100).toFixed(0)}%`} domain={[0,1]} tick={{fontSize:9}}/>
              <YAxis type="category" dataKey="name" width={100} tick={{fontSize:9}}/>
              <Tooltip formatter={v=>fmtPct(v)}/>
              <Bar dataKey="avance" name="Avance" radius={[0,4,4,0]}>
                {hitoCum.map((d,i)=><Cell key={i} fill={d.avance>=0.8?COLOR.green:d.avance>=0.5?COLOR.yellow:COLOR.red}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

// ─── SECCIÓN 3: TABLA ─────────────────────────────────────────────────────────
function Tabla({ P }) {
  const [q,setQ]=useState("");
  const [fFac,setFFac]=useState("Todos");
  const [fEtapa,setFEtapa]=useState("Todos");
  const [fRiesgo,setFRiesgo]=useState("Todos");
  const [sortK,setSortK]=useState("programa");
  const [asc,setAsc]=useState(true);
  const [page,setPage]=useState(0);
  const PG=15;

  const facs = useMemo(()=>["Todos",...Array.from(new Set(P.map(p=>p.facultad))).sort()],[P]);

  const rows = useMemo(()=>P
    .filter(p=>{
      if(q && !p.programa.toLowerCase().includes(q.toLowerCase())) return false;
      if(fFac!=="Todos" && p.facultad!==fFac) return false;
      if(fEtapa!=="Todos" && p.etapa!==fEtapa) return false;
      if(fRiesgo!=="Todos" && p.riesgo!==fRiesgo) return false;
      return true;
    })
    .sort((a,b)=>{
      let va=a[sortK], vb=b[sortK];
      if(va==null) va=asc?Infinity:-Infinity;
      if(vb==null) vb=asc?Infinity:-Infinity;
      if(typeof va==="string") return asc?va.localeCompare(vb):vb.localeCompare(va);
      return asc?va-vb:vb-va;
    }),[P,q,fFac,fEtapa,fRiesgo,sortK,asc]);

  const pg = rows.slice(page*PG,(page+1)*PG);
  const tot = Math.ceil(rows.length/PG);

  const Th = ({k,lbl}) => (
    <button className={`flex items-center gap-1 hover:text-blue-600 ${sortK===k?"text-blue-600 font-bold":""}`}
      onClick={()=>{if(sortK===k)setAsc(!asc);else{setSortK(k);setAsc(true);}setPage(0);}}>
      {lbl} {sortK===k?(asc?"↑":"↓"):"↕"}
    </button>
  );

  const sel = "border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200";

  return (
    <div>
      <SectionHeader title="Tabla Maestra de Programas" sub={`${rows.length} de ${P.length} programas`}/>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <input className={sel} placeholder="🔍 Buscar programa..." value={q}
          onChange={e=>{setQ(e.target.value);setPage(0);}}/>
        <select className={sel} value={fFac} onChange={e=>{setFFac(e.target.value);setPage(0);}}>
          {facs.map(f=><option key={f}>{f}</option>)}
        </select>
        <select className={sel} value={fEtapa} onChange={e=>{setFEtapa(e.target.value);setPage(0);}}>
          {["Todos",...ETAPA_ORDER].map(e=><option key={e}>{e}</option>)}
        </select>
        <select className={sel} value={fRiesgo} onChange={e=>{setFRiesgo(e.target.value);setPage(0);}}>
          {["Todos","Alto","Medio","Bajo","Cerrado"].map(r=><option key={r}>{r}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Programa</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Facultad</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Etapa</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">F. Inicio</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap"><Th k="avance" lbl="Avance"/></th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Riesgo</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600">Meta</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600">Docs</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap"><Th k="cumCom" lbl="Cumpl.%"/></th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap"><Th k="ingPot" lbl="Ing.Pot."/></th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap"><Th k="brecha" lbl="Brecha"/></th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600">Días</th>
            </tr>
          </thead>
          <tbody>
            {pg.map((p,i)=>{
              const pend = HITOS.filter((_,j)=>p.hitoVals[j]===0).map((_,j)=>HITO_SHORT[HITOS[j]]).filter(Boolean);
              return (
                <tr key={i} className={`border-b border-gray-100 ${i%2===0?"bg-white":"bg-gray-50"} hover:bg-blue-50`}>
                  <td className="px-3 py-2 max-w-[220px]">
                    <div className="font-medium text-gray-800 truncate" title={p.programa}>{p.programa}</div>
                    {pend.length>0 && <div className="text-red-500 text-[10px] truncate">⚠ {pend.slice(0,3).join(", ")}{pend.length>3?` +${pend.length-3}`:""}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.facultad}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      {(p.etapa||"").replace(/^\d+\.\s*/,"")}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(p.fechaInicio)}</td>
                  <td className="px-3 py-2"><AvBar v={p.avance}/></td>
                  <td className="px-3 py-2"><RiskBadge r={p.riesgo}/></td>
                  <td className="px-3 py-2 text-right">{p.meta||"-"}</td>
                  <td className="px-3 py-2 text-right">{p.docs}</td>
                  <td className="px-3 py-2 text-right font-semibold">{p.meta>0?fmtPct(p.cumCom):"-"}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmtUSD(p.ingPot)}</td>
                  <td className="px-3 py-2 text-right text-red-600 font-semibold">{fmtUSD(p.brecha)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${p.diasInicio!==null&&p.diasInicio<0?"text-gray-400":p.diasInicio!==null&&p.diasInicio<30?"text-red-600":"text-gray-600"}`}>
                    {p.diasInicio!==null?(p.diasInicio<0?"Iniciado":`${p.diasInicio}d`):"-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pg.length===0&&<div className="text-center py-10 text-gray-400">Sin resultados con ese filtro</div>}
      </div>

      {tot>1&&(
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{rows.length} programas · Pág. {page+1}/{tot}</span>
          <div className="flex gap-2">
            <button disabled={page===0} onClick={()=>setPage(page-1)}
              className="px-3 py-1 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100">‹</button>
            <button disabled={page>=tot-1} onClick={()=>setPage(page+1)}
              className="px-3 py-1 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100">›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECCIÓN 4: HEATMAP ───────────────────────────────────────────────────────
function Heatmap({ P }) {
  const [fFac,setFFac]=useState("Todos");
  const [fEtapa,setFEtapa]=useState("Todos");
  const facs = useMemo(()=>["Todos",...Array.from(new Set(P.map(p=>p.facultad))).sort()],[P]);
  const rows = P.filter(p=>(fFac==="Todos"||p.facultad===fFac)&&(fEtapa==="Todos"||p.etapa===fEtapa)).slice(0,60);

  const cellCls = v => v===null?"bg-gray-100 text-gray-300":v===0?"bg-red-100 text-red-500":v===1?"bg-amber-100 text-amber-600":"bg-emerald-100 text-emerald-600";
  const cellSym = v => v===null?"·":v===0?"✗":v===1?"◑":"✓";
  const sel = "border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none";

  return (
    <div>
      <SectionHeader title="Heatmap de Hitos" sub="Matriz de avance por programa y hito operativo"/>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select className={sel} value={fFac} onChange={e=>setFFac(e.target.value)}>
          {facs.map(f=><option key={f}>{f}</option>)}
        </select>
        <select className={sel} value={fEtapa} onChange={e=>setFEtapa(e.target.value)}>
          {["Todos",...ETAPA_ORDER].map(e=><option key={e}>{e}</option>)}
        </select>
        <div className="flex items-center gap-4 ml-auto text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block"/> Pendiente (0)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 inline-block"/> En proceso (1)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 inline-block"/> Completado (2)</span>
        </div>
      </div>
      <div className="overflow-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="text-xs border-collapse w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 min-w-[180px] sticky left-0 bg-gray-50 z-20">Programa</th>
              <th className="px-2 py-2 text-left font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Facultad</th>
              {HITOS.map(h=>(
                <th key={h} className="px-2 py-2 text-center font-semibold text-gray-500 border-b border-gray-200">
                  <div className="text-[9px] leading-tight max-w-[60px]">{HITO_SHORT[h]}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-semibold text-gray-600 border-b border-gray-200">Avance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p,i)=>(
              <tr key={i} className={`${i%2===0?"bg-white":"bg-gray-50"} hover:bg-blue-50`}>
                <td className="px-3 py-1.5 border-b border-gray-100 sticky left-0 bg-inherit z-10">
                  <div className="max-w-[180px] truncate font-medium text-gray-800" title={p.programa}>{p.programa}</div>
                </td>
                <td className="px-2 py-1.5 border-b border-gray-100 text-gray-500 whitespace-nowrap text-[10px]">{p.facultad.slice(0,12)}</td>
                {p.hitoVals.map((v,j)=>(
                  <td key={j} className={`px-2 py-1.5 border-b border-gray-100 text-center font-bold ${cellCls(v)}`}>
                    {cellSym(v)}
                  </td>
                ))}
                <td className="px-2 py-1.5 border-b border-gray-100 text-center">
                  <span className={`font-bold text-xs ${p.avance>=0.8?"text-emerald-600":p.avance>=0.5?"text-amber-600":"text-red-600"}`}>
                    {fmtPct(p.avance)}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length===0&&<tr><td colSpan={HITOS.length+3} className="text-center py-8 text-gray-400">Sin programas con ese filtro</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SECCIÓN 5: CUELLOS ───────────────────────────────────────────────────────
function Cuellos({ P }) {
  const ranking = HITOS.map((h,i)=>{
    const pend = P.filter(p=>p.hitoVals[i]===0).length;
    const proc = P.filter(p=>p.hitoVals[i]===1).length;
    const comp = P.filter(p=>p.hitoVals[i]===2).length;
    const tot  = P.filter(p=>p.hitoVals[i]!==null).length;
    return {h, pend, proc, comp, tot};
  }).sort((a,b)=>b.pend-a.pend);

  return (
    <div>
      <SectionHeader title="Cuellos de Botella" sub="Hitos con más pendientes en el portafolio"/>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {ranking.map((r,i)=>{
          const pct = r.tot>0?r.pend/r.tot:0;
          return (
            <div key={i} className={`flex items-center gap-4 px-5 py-3 ${i!==ranking.length-1?"border-b border-gray-100":""} hover:bg-gray-50`}>
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{i+1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 text-sm">{r.h}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                    <div className="bg-red-400 h-2 rounded-full" style={{width:`${pct*100}%`}}/>
                  </div>
                  <span className="text-xs text-gray-400">{(pct*100).toFixed(0)}% pend.</span>
                </div>
              </div>
              <div className="flex gap-3 text-xs font-bold">
                <span className="text-red-600">{r.pend} ✗</span>
                <span className="text-amber-600">{r.proc} ◑</span>
                <span className="text-emerald-600">{r.comp} ✓</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SECCIÓN 6: ALERTAS ───────────────────────────────────────────────────────
function Alertas({ P }) {
  const alerts = [];
  P.forEach(p=>{
    const d = p.diasInicio;
    if(d!==null&&d>=0&&d<30&&p.avance<0.8&&p.riesgo!=="Cerrado")
      alerts.push({t:"rojo",msg:`🚨 Inicio en ${d}d con avance ${fmtPct(p.avance)}`,prog:p.programa,fac:p.facultad});
    if(p.etapa==="3. VENTA"&&p.hitoVals[9]!==2)
      alerts.push({t:"amarillo",msg:"🎓 En Venta sin Seguimiento Admisiones completado",prog:p.programa,fac:p.facultad});
    if(!p.precio||p.precio===0)
      alerts.push({t:"amarillo",msg:"💲 Sin precio definido",prog:p.programa,fac:p.facultad});
    if(!p.meta||p.meta===0)
      alerts.push({t:"amarillo",msg:"🎯 Sin meta de estudiantes",prog:p.programa,fac:p.facultad});
    if(p.docs===0&&d!==null&&d>=0&&d<30&&p.riesgo!=="Cerrado")
      alerts.push({t:"rojo",msg:"👤 0 estudiantes documentados con inicio próximo",prog:p.programa,fac:p.facultad});
  });

  const rojos = alerts.filter(a=>a.t==="rojo");
  const amarillos = alerts.filter(a=>a.t==="amarillo");

  const Group = ({items,label,color,bg,border}) => items.length===0?null:(
    <div className="mb-5">
      <h3 className={`font-bold text-sm mb-2 ${color}`}>{label} ({items.length})</h3>
      <div className="space-y-2">
        {items.map((a,i)=>(
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-xs border ${bg} ${border}`}>
            <div>
              <div className="font-semibold text-gray-700">{a.msg}</div>
              <div className="text-gray-500 mt-0.5">{a.prog} · <span className="font-medium">{a.fac}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Alertas Automáticas" sub={`${alerts.length} alertas detectadas`}/>
      {alerts.length===0
        ? <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center text-emerald-600 font-semibold">✅ Sin alertas activas</div>
        : <>
            <Group items={rojos} label="🔴 Alertas Críticas" color="text-red-600" bg="bg-red-50" border="border-red-200"/>
            <Group items={amarillos} label="🟡 Advertencias" color="text-amber-600" bg="bg-amber-50" border="border-amber-200"/>
          </>
      }
    </div>
  );
}

// ─── PANTALLA DE CARGA ────────────────────────────────────────────────────────
function Upload({ onLoad }) {
  const ref = useRef();
  const handle = f => {
    if(!f) return;
    Papa.parse(f, {
      // autodetect: intenta ; primero, luego ,
      delimiter: "",        // PapaParse auto-detect
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: r => onLoad(r.data),
    });
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">📊</div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Dashboard EDCO</h1>
        <p className="text-gray-500 mb-8">Seguimiento del ciclo de vida de programas de Educación Continua</p>
        <div className="border-2 border-dashed border-blue-300 rounded-2xl p-10 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group"
          onClick={()=>ref.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();handle(e.dataTransfer.files[0]);}}>
          <div className="text-5xl mb-3">📂</div>
          <p className="font-bold text-gray-700 group-hover:text-blue-600">Arrastra tu archivo CSV aquí</p>
          <p className="text-sm text-gray-400 mt-1">o haz clic para seleccionar</p>
          <input ref={ref} type="file" accept=".csv" className="hidden" onChange={e=>handle(e.target.files[0])}/>
        </div>
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-4 text-left text-xs text-gray-500 shadow-sm">
          <p className="font-semibold text-gray-700 mb-2">📋 Cómo exportar desde Excel</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Abre el archivo <strong>EDCO_DAHSBOARD.xlsx</strong></li>
            <li>Archivo → Guardar como → <strong>CSV UTF-8</strong> o <strong>CSV (delimitado por comas)</strong></li>
            <li>Sube el archivo <code>.csv</code> aquí</li>
          </ol>
          <p className="mt-2 text-[10px] text-gray-400">Compatible con separador <code>;</code> o <code>,</code> · Precios <code>$1.390,00</code> · Fechas <code>2-mar-26</code></p>
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const NAV = [
  {id:"resumen",lbl:"Resumen",icon:"📊"},
  {id:"graficos",lbl:"Gráficos",icon:"📈"},
  {id:"tabla",lbl:"Tabla",icon:"📋"},
  {id:"heatmap",lbl:"Heatmap",icon:"🗂️"},
  {id:"cuellos",lbl:"Cuellos",icon:"⚙️"},
  {id:"alertas",lbl:"Alertas",icon:"🔔"},
];

export default function App() {
  const [raw, setRaw] = useState(null);
  const [section, setSection] = useState("resumen");
  const fileRef = useRef();

  const programs = useMemo(()=>{
    if(!raw) return [];
    try { return buildPrograms(raw); }
    catch(e){ console.error(e); return []; }
  },[raw]);

  const handleFile = f => {
    if(!f) return;
    Papa.parse(f, {
      delimiter: "",      // auto-detect , o ;
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: r => { setRaw(r.data); setSection("resumen"); },
    });
  };

  if(!raw) return <Upload onLoad={d=>setRaw(d)}/>;

  const alto = programs.filter(p=>p.riesgo==="Alto").length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow">📊</div>
          <div>
            <h1 className="font-black text-gray-900 text-base leading-tight">Dashboard de Avance EDCO</h1>
            <p className="text-xs text-gray-400">Seguimiento del ciclo de vida de programas de Educación Continua</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">{programs.length} programas</span>
            {alto>0&&<span className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full font-bold">🚨 {alto} riesgo alto</span>}
            <button onClick={()=>fileRef.current?.click()}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              📂 Cargar CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>handleFile(e.target.files[0])}/>
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto px-4 flex gap-1 pb-2 overflow-x-auto">
          {NAV.map(s=>(
            <button key={s.id} onClick={()=>setSection(s.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${section===s.id?"bg-blue-600 text-white shadow-sm":"text-gray-600 hover:bg-gray-100"}`}>
              {s.icon} {s.lbl}
              {s.id==="alertas"&&alto>0&&<span className="bg-red-500 text-white text-[10px] rounded-full px-1.5">{alto}</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-8">
        {section==="resumen"  && <Resumen P={programs}/>}
        {section==="graficos" && <Graficos P={programs}/>}
        {section==="tabla"    && <Tabla P={programs}/>}
        {section==="heatmap"  && <Heatmap P={programs}/>}
        {section==="cuellos"  && <Cuellos P={programs}/>}
        {section==="alertas"  && <Alertas P={programs}/>}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-200 mt-4">
        Dashboard EDCO · Educación Continua · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
