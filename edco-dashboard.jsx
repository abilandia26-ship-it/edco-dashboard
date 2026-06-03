import { useState, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LabelList
} from "recharts";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
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
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  gray: "#9ca3af",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#8b5cf6",
  teal: "#14b8a6",
};

const RISK_COLORS = {
  Alto: COLOR.red,
  Medio: COLOR.yellow,
  Bajo: COLOR.green,
  Cerrado: COLOR.gray,
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
function normalizeKey(k) {
  if (!k) return "";
  return k
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parsePrice(v) {
  if (v === null || v === undefined || v === "") return 0;
  const s = v.toString().replace(/[$,.\s]/g, "").replace(/,/g, "");
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseDate(v) {
  if (!v || v === "" || v === "No Jupiter" || v === "No Júpiter") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = v.toString().trim();
  // yyyy-mm-dd or with time
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10));
  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split("/");
    return new Date(`${y}-${m}-${d}`);
  }
  // dd-mmm-yy e.g. 02-Mar-26
  const mmap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const m2 = s.match(/^(\d{1,2})-([a-z]{3})-(\d{2,4})$/i);
  if (m2) {
    const year = m2[3].length === 2 ? 2000 + parseInt(m2[3]) : parseInt(m2[3]);
    return new Date(year, mmap[m2[2].toLowerCase()], parseInt(m2[1]));
  }
  return null;
}

function parseHito(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v);
  if (isNaN(n)) return null;
  if (n === 0 || n === 1 || n === 2) return n;
  return null;
}

function normalizeEtapa(v) {
  if (!v) return null;
  const s = v.toString().trim().toUpperCase();
  if (s.includes("SIN INICIAR") || s === "0") return "0. SIN INICIAR";
  if (s.includes("DISE") && s.includes("DESARROLLO")) return "1. DISEÑO Y DESARROLLO";
  if (s.includes("PUESTA") || s.includes("PUNTO")) return "2. PUESTA A PUNTO";
  if (s.includes("VENTA")) return "3. VENTA";
  if (s.includes("COMPLETADO")) return "4. COMPLETADO";
  return v.toString().trim();
}

function normalizeFacultad(v) {
  if (!v) return "SIN DEFINIR";
  const s = v.toString().trim().toUpperCase();
  if (s === "GASTRONOMÍA" || s === "GASTRONOMIA") return "GASTRONOMÍA";
  if (s === "MÚSICA" || s === "MUSICA") return "MÚSICA";
  if (s === "DERECHO") return "DERECHO";
  if (s === "ARQUITECTURA") return "ARQUITECTURA";
  if (s.includes("COMUNICACI")) return "COMUNICACIÓN";
  if (s.includes("PSICOLOG")) return "PSICOLOGÍA";
  if (s.includes("CIENCIAS POL")) return "CC. POLÍTICAS";
  return s;
}

function processRows(rawData) {
  // Find header row (first row that has "Programa" in it)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const vals = Object.values(rawData[i] || {}).map(v => String(v || "").toLowerCase());
    if (vals.some(v => v.includes("programa"))) { headerIdx = i; break; }
  }

  const headers = Object.values(rawData[headerIdx] || {});
  const rows = rawData.slice(headerIdx + 1);

  return rows
    .map((row) => {
      const vals = Object.values(row);
      const obj = {};
      headers.forEach((h, i) => {
        if (h) obj[normalizeKey(h)] = vals[i];
      });
      return obj;
    })
    .filter((r) => r.programa && r.programa.toString().trim() !== "");
}

function computeProgram(r) {
  const etapa = normalizeEtapa(r.etapa);
  const facultad = normalizeFacultad(r.facultad);
  const precio = parsePrice(r.precio);
  const meta = parseNumber(r.meta_de_estudiantes) || 0;
  const docs = parseNumber(r.estudiantes_documentados) || 0;
  const fechaInicio = parseDate(r.fecha_de_inicio);
  const fechaFin = parseDate(r.fecha_de_fin);

  // Hitos
  const hitoVals = HITOS.map((h) => parseHito(r[normalizeKey(h)]));
  const validHitos = hitoVals.filter((v) => v !== null);
  const hitoSum = validHitos.reduce((a, b) => a + b, 0);
  const hitoMax = validHitos.length * 2;
  const avance = hitoMax > 0 ? hitoSum / hitoMax : 0;

  // Days to start
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diasInicio = fechaInicio
    ? Math.ceil((fechaInicio - today) / (1000 * 60 * 60 * 24))
    : null;

  // Risk
  let riesgo = "Bajo";
  if (etapa === "4. COMPLETADO") {
    riesgo = "Cerrado";
  } else if (diasInicio !== null && diasInicio < 30 && avance < 0.8) {
    riesgo = "Alto";
  } else if (diasInicio !== null && diasInicio < 60 && avance < 0.6) {
    riesgo = "Medio";
  }

  // Commercial
  const cumplimientoComercial = meta > 0 ? docs / meta : 0;
  const cuposPendientes = Math.max(0, meta - docs);
  const ingresoPotencial = precio * meta;
  const ingresoDocumentado = precio * docs;
  const brechaComercial = ingresoPotencial - ingresoDocumentado;

  return {
    ...r,
    programa: (r.programa || "").toString().trim(),
    facultad,
    etapa,
    ciclo: r.ciclo || "",
    precio,
    meta,
    docs,
    fechaInicio,
    fechaFin,
    hitoVals,
    avance,
    diasInicio,
    riesgo,
    cumplimientoComercial,
    cuposPendientes,
    ingresoPotencial,
    ingresoDocumentado,
    brechaComercial,
    codigoBanner: r.codigo_banner_curso,
    codigoCohorte: r.codigo_banner_de_cohorte,
    cohorte: r.cohorte,
    crm: r.crm,
    pep: r.pep,
  };
}

function formatUSD(n) {
  if (!n && n !== 0) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtDate(d) {
  if (!d) return "-";
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = "blue", icon }) {
  const colorMap = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    green: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    yellow: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
    red: "from-red-50 to-red-100 border-red-200 text-red-700",
    purple: "from-violet-50 to-violet-100 border-violet-200 text-violet-700",
    gray: "from-gray-50 to-gray-100 border-gray-200 text-gray-700",
    teal: "from-teal-50 to-teal-100 border-teal-200 text-teal-700",
    indigo: "from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700",
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-4 flex flex-col gap-1 shadow-sm`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-70">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="text-2xl font-black">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  );
}

function RiskBadge({ riesgo }) {
  const cls = {
    Alto: "bg-red-100 text-red-700 border border-red-300",
    Medio: "bg-amber-100 text-amber-700 border border-amber-300",
    Bajo: "bg-emerald-100 text-emerald-700 border border-emerald-300",
    Cerrado: "bg-gray-100 text-gray-500 border border-gray-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls[riesgo] || cls.Bajo}`}>
      {riesgo}
    </span>
  );
}

function AvanceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{pct}%</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <b>{typeof p.value === "number" && p.value < 2 ? formatPct(p.value) : p.value}</b></p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-black text-gray-800 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ResumenEjecutivo({ programs }) {
  const total = programs.length;
  const completados = programs.filter((p) => p.etapa === "4. COMPLETADO").length;
  const enVenta = programs.filter((p) => p.etapa === "3. VENTA").length;
  const enPuesta = programs.filter((p) => p.etapa === "2. PUESTA A PUNTO").length;
  const enDiseno = programs.filter((p) => p.etapa === "1. DISEÑO Y DESARROLLO").length;
  const sinIniciar = programs.filter((p) => p.etapa === "0. SIN INICIAR").length;
  const riesgoAlto = programs.filter((p) => p.riesgo === "Alto").length;
  const avanceGlobal = programs.reduce((a, p) => a + p.avance, 0) / (total || 1);
  const metaTotal = programs.reduce((a, p) => a + p.meta, 0);
  const docsTotal = programs.reduce((a, p) => a + p.docs, 0);
  const cumComercial = metaTotal > 0 ? docsTotal / metaTotal : 0;
  const ingPotencial = programs.reduce((a, p) => a + p.ingresoPotencial, 0);
  const ingDoc = programs.reduce((a, p) => a + p.ingresoDocumentado, 0);
  const brecha = ingPotencial - ingDoc;

  return (
    <div>
      <SectionHeader title="Resumen Ejecutivo" subtitle="Indicadores clave del portafolio EDCO" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard icon="📋" label="Total Programas" value={total} color="blue" />
        <KpiCard icon="⚙️" label="Avance Operativo Global" value={formatPct(avanceGlobal)} color={avanceGlobal >= 0.8 ? "green" : avanceGlobal >= 0.5 ? "yellow" : "red"} />
        <KpiCard icon="✅" label="Programas Completados" value={completados} sub={`${((completados / total) * 100).toFixed(0)}% del total`} color="green" />
        <KpiCard icon="🛒" label="En Venta" value={enVenta} color="teal" />
        <KpiCard icon="🔧" label="Puesta a Punto" value={enPuesta} color="indigo" />
        <KpiCard icon="✏️" label="Diseño y Desarrollo" value={enDiseno} color="purple" />
        <KpiCard icon="🚫" label="Sin Iniciar" value={sinIniciar} color="gray" />
        <KpiCard icon="🔴" label="Riesgo Alto" value={riesgoAlto} color="red" />
        <KpiCard icon="🎯" label="Meta Total Estudiantes" value={metaTotal.toLocaleString()} color="blue" />
        <KpiCard icon="👥" label="Estudiantes Documentados" value={docsTotal.toLocaleString()} sub={`${docsTotal} de ${metaTotal}`} color="teal" />
        <KpiCard icon="📊" label="Cumplimiento Comercial" value={formatPct(cumComercial)} color={cumComercial >= 0.8 ? "green" : cumComercial >= 0.5 ? "yellow" : "red"} />
        <KpiCard icon="💰" label="Ingreso Potencial" value={formatUSD(ingPotencial)} color="indigo" />
        <KpiCard icon="💵" label="Ingreso Documentado" value={formatUSD(ingDoc)} sub={`${formatPct(ingDoc / (ingPotencial || 1))} capturado`} color="green" />
        <KpiCard icon="⚠️" label="Brecha Comercial" value={formatUSD(brecha)} color="red" />
      </div>
    </div>
  );
}

function GraficosPrincipales({ programs }) {
  // 1. Programas por etapa
  const porEtapa = ETAPA_ORDER.map((e) => ({
    name: e.replace(/^\d+\.\s*/, ""),
    count: programs.filter((p) => p.etapa === e).length,
  }));

  // 2. Avance por facultad
  const facMap = {};
  programs.forEach((p) => {
    if (!facMap[p.facultad]) facMap[p.facultad] = [];
    facMap[p.facultad].push(p.avance);
  });
  const porFacultad = Object.entries(facMap)
    .map(([name, vals]) => ({ name, avance: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => b.avance - a.avance);

  // 3. Distribución de riesgo
  const riesgoMap = { Alto: 0, Medio: 0, Bajo: 0, Cerrado: 0 };
  programs.forEach((p) => { riesgoMap[p.riesgo] = (riesgoMap[p.riesgo] || 0) + 1; });
  const riesgoPie = Object.entries(riesgoMap).map(([name, value]) => ({ name, value }));

  // 4. Meta vs Documentados por facultad
  const metaFac = Object.entries(facMap.constructor === Object ? facMap : {}).map(() => null);
  const metaFacMap = {};
  programs.forEach((p) => {
    if (!metaFacMap[p.facultad]) metaFacMap[p.facultad] = { meta: 0, docs: 0 };
    metaFacMap[p.facultad].meta += p.meta;
    metaFacMap[p.facultad].docs += p.docs;
  });
  const metaFacData = Object.entries(metaFacMap)
    .map(([name, v]) => ({ name, Meta: v.meta, Documentados: v.docs }))
    .sort((a, b) => b.Meta - a.Meta)
    .slice(0, 12);

  // 5. Brecha comercial top programas
  const brechaTop = [...programs]
    .filter((p) => p.brechaComercial > 0)
    .sort((a, b) => b.brechaComercial - a.brechaComercial)
    .slice(0, 10)
    .map((p) => ({ name: p.programa.length > 35 ? p.programa.slice(0, 35) + "…" : p.programa, brecha: p.brechaComercial }));

  // 6. Cumplimiento por hito
  const hitoCumplimiento = HITOS.map((h, i) => {
    const vals = programs.map((p) => p.hitoVals[i]).filter((v) => v !== null);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / (vals.length * 2) : 0;
    return { name: HITO_SHORT[h], avance: avg };
  }).sort((a, b) => a.avance - b.avance);

  return (
    <div>
      <SectionHeader title="Gráficos Principales" subtitle="Análisis visual del portafolio" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Programas por etapa */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Programas por Etapa</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porEtapa} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Programas" radius={[4, 4, 0, 0]}>
                {porEtapa.map((_, i) => (
                  <Cell key={i} fill={[COLOR.gray, COLOR.purple, COLOR.indigo, COLOR.teal, COLOR.green][i]} />
                ))}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avance por facultad */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Avance Operativo Promedio por Facultad</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porFacultad} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} domain={[0, 1]} />
              <Tooltip formatter={(v) => formatPct(v)} />
              <Bar dataKey="avance" name="Avance" radius={[4, 4, 0, 0]} fill={COLOR.blue}>
                {porFacultad.map((d, i) => (
                  <Cell key={i} fill={d.avance >= 0.8 ? COLOR.green : d.avance >= 0.5 ? COLOR.yellow : COLOR.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de riesgo (dona) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Distribución de Riesgo</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={riesgoPie} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {riesgoPie.map((entry, i) => (
                  <Cell key={i} fill={RISK_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Meta vs Documentados */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Meta vs Documentados por Facultad</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metaFacData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Meta" fill={COLOR.blue} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Documentados" fill={COLOR.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Brecha comercial */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Top 10 Programas con Mayor Brecha Comercial</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={brechaTop} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v) => formatUSD(v)} />
              <Bar dataKey="brecha" name="Brecha" fill={COLOR.red} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumplimiento por hito */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Cumplimiento Promedio por Hito Operativo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hitoCumplimiento} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v) => formatPct(v)} />
              <Bar dataKey="avance" name="Avance" radius={[0, 4, 4, 0]}>
                {hitoCumplimiento.map((d, i) => (
                  <Cell key={i} fill={d.avance >= 0.8 ? COLOR.green : d.avance >= 0.5 ? COLOR.yellow : COLOR.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

function TablaMaestra({ programs }) {
  const [search, setSearch] = useState("");
  const [filterFac, setFilterFac] = useState("Todos");
  const [filterEtapa, setFilterEtapa] = useState("Todos");
  const [filterRiesgo, setFilterRiesgo] = useState("Todos");
  const [sortBy, setSortBy] = useState("programa");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const facultades = useMemo(() => ["Todos", ...Array.from(new Set(programs.map((p) => p.facultad))).sort()], [programs]);
  const etapas = useMemo(() => ["Todos", ...ETAPA_ORDER], []);

  const filtered = useMemo(() => {
    return programs
      .filter((p) => {
        if (search && !p.programa.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterFac !== "Todos" && p.facultad !== filterFac) return false;
        if (filterEtapa !== "Todos" && p.etapa !== filterEtapa) return false;
        if (filterRiesgo !== "Todos" && p.riesgo !== filterRiesgo) return false;
        return true;
      })
      .sort((a, b) => {
        let va = a[sortBy], vb = b[sortBy];
        if (va === null || va === undefined) va = sortAsc ? Infinity : -Infinity;
        if (vb === null || vb === undefined) vb = sortAsc ? Infinity : -Infinity;
        if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortAsc ? va - vb : vb - va;
      });
  }, [programs, search, filterFac, filterEtapa, filterRiesgo, sortBy, sortAsc]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const SortBtn = ({ field, label }) => (
    <button
      className={`flex items-center gap-1 hover:text-blue-600 ${sortBy === field ? "text-blue-600 font-bold" : ""}`}
      onClick={() => { if (sortBy === field) setSortAsc(!sortAsc); else { setSortBy(field); setSortAsc(true); } setPage(0); }}
    >
      {label} {sortBy === field ? (sortAsc ? "↑" : "↓") : "↕"}
    </button>
  );

  return (
    <div>
      <SectionHeader title="Tabla Maestra de Programas" subtitle={`${filtered.length} programas filtrados de ${programs.length} total`} />
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <input
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="🔍 Buscar programa..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
        <select className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterFac} onChange={(e) => { setFilterFac(e.target.value); setPage(0); }}>
          {facultades.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterEtapa} onChange={(e) => { setFilterEtapa(e.target.value); setPage(0); }}>
          {etapas.map((e) => <option key={e}>{e}</option>)}
        </select>
        <select className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterRiesgo} onChange={(e) => { setFilterRiesgo(e.target.value); setPage(0); }}>
          {["Todos", "Alto", "Medio", "Bajo", "Cerrado"].map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Programa</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Facultad</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Etapa</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Fecha Inicio</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap"><SortBtn field="avance" label="Avance" /></th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Riesgo</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">Meta</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">Docs.</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap"><SortBtn field="cumplimientoComercial" label="Cumpl.%" /></th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap"><SortBtn field="ingresoPotencial" label="Ing. Pot." /></th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap"><SortBtn field="brechaComercial" label="Brecha" /></th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">Días</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p, i) => {
              const hPendientes = HITOS.filter((h, idx) => p.hitoVals[idx] === 0).map((h) => HITO_SHORT[h]);
              return (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="font-medium text-gray-800 truncate" title={p.programa}>{p.programa}</div>
                    {hPendientes.length > 0 && (
                      <div className="text-red-500 text-[10px] mt-0.5 truncate" title={hPendientes.join(", ")}>
                        ⚠ {hPendientes.slice(0, 3).join(", ")}{hPendientes.length > 3 ? ` +${hPendientes.length - 3}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{p.facultad}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{(p.etapa || "").replace(/^\d+\.\s*/, "")}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(p.fechaInicio)}</td>
                  <td className="px-3 py-2"><AvanceBar value={p.avance} /></td>
                  <td className="px-3 py-2"><RiskBadge riesgo={p.riesgo} /></td>
                  <td className="px-3 py-2 text-right">{p.meta || "-"}</td>
                  <td className="px-3 py-2 text-right">{p.docs}</td>
                  <td className="px-3 py-2 text-right font-semibold">{p.meta > 0 ? formatPct(p.cumplimientoComercial) : "-"}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatUSD(p.ingresoPotencial)}</td>
                  <td className="px-3 py-2 text-right text-red-600 font-semibold">{formatUSD(p.brechaComercial)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${p.diasInicio !== null && p.diasInicio < 0 ? "text-gray-400" : p.diasInicio !== null && p.diasInicio < 30 ? "text-red-600" : "text-gray-600"}`}>
                    {p.diasInicio !== null ? (p.diasInicio < 0 ? "Iniciado" : `${p.diasInicio}d`) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{filtered.length} programas · Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100">‹ Anterior</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente ›</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HeatmapHitos({ programs }) {
  const [filterFac, setFilterFac] = useState("Todos");
  const [filterEtapa, setFilterEtapa] = useState("Todos");

  const facultades = useMemo(() => ["Todos", ...Array.from(new Set(programs.map((p) => p.facultad))).sort()], [programs]);

  const filtered = programs
    .filter((p) => {
      if (filterFac !== "Todos" && p.facultad !== filterFac) return false;
      if (filterEtapa !== "Todos" && p.etapa !== filterEtapa) return false;
      return true;
    })
    .slice(0, 50);

  const cellColor = (v) => {
    if (v === null) return "bg-gray-100 text-gray-300";
    if (v === 0) return "bg-red-100 text-red-600";
    if (v === 1) return "bg-amber-100 text-amber-600";
    return "bg-emerald-100 text-emerald-600";
  };
  const cellSymbol = (v) => {
    if (v === null) return "·";
    if (v === 0) return "✗";
    if (v === 1) return "◑";
    return "✓";
  };

  return (
    <div>
      <SectionHeader title="Heatmap de Hitos" subtitle="Matriz de avance por programa y hito operativo" />
      <div className="flex gap-3 mb-4">
        <select className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterFac} onChange={(e) => setFilterFac(e.target.value)}>
          {facultades.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterEtapa} onChange={(e) => setFilterEtapa(e.target.value)}>
          {["Todos", ...ETAPA_ORDER].map((e) => <option key={e}>{e}</option>)}
        </select>
        <div className="flex items-center gap-4 ml-auto text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-100 inline-block border border-red-200" /> Pendiente</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-100 inline-block border border-amber-200" /> En proceso</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 inline-block border border-emerald-200" /> Completado</span>
        </div>
      </div>
      <div className="overflow-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="text-xs border-collapse w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap min-w-[200px] sticky left-0 bg-gray-50 z-20">Programa</th>
              <th className="px-2 py-2 text-left font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Fac.</th>
              {HITOS.map((h) => (
                <th key={h} className="px-2 py-2 text-center font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap max-w-[80px]">
                  <div className="writing-mode-vertical text-[10px]">{HITO_SHORT[h]}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">Avance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50`}>
                <td className="px-3 py-1.5 border-b border-gray-100 sticky left-0 bg-inherit z-10">
                  <div className="max-w-[200px] truncate font-medium text-gray-800" title={p.programa}>{p.programa}</div>
                </td>
                <td className="px-2 py-1.5 border-b border-gray-100 text-gray-500 whitespace-nowrap">{p.facultad.slice(0, 10)}</td>
                {p.hitoVals.map((v, j) => (
                  <td key={j} className={`px-2 py-1.5 border-b border-gray-100 text-center font-bold ${cellColor(v)}`}>
                    {cellSymbol(v)}
                  </td>
                ))}
                <td className="px-2 py-1.5 border-b border-gray-100 text-center">
                  <span className={`font-bold text-xs ${p.avance >= 0.8 ? "text-emerald-600" : p.avance >= 0.5 ? "text-amber-600" : "text-red-600"}`}>
                    {formatPct(p.avance)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400">Sin programas con ese filtro</div>}
      </div>
    </div>
  );
}

function CuellosBotella({ programs }) {
  const ranking = HITOS.map((h, i) => {
    const pendientes = programs.filter((p) => p.hitoVals[i] === 0).length;
    const enProceso = programs.filter((p) => p.hitoVals[i] === 1).length;
    const completados = programs.filter((p) => p.hitoVals[i] === 2).length;
    const total = programs.filter((p) => p.hitoVals[i] !== null).length;
    return { hito: h, short: HITO_SHORT[h], pendientes, enProceso, completados, total };
  }).sort((a, b) => b.pendientes - a.pendientes);

  return (
    <div>
      <SectionHeader title="Cuellos de Botella" subtitle="Hitos con más pendientes en el portafolio" />
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {ranking.map((r, i) => {
          const pctPend = r.total > 0 ? r.pendientes / r.total : 0;
          return (
            <div key={i} className={`flex items-center gap-4 px-5 py-3 ${i !== ranking.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50`}>
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 text-sm">{r.hito}</div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="bg-red-400 h-2 rounded-full" style={{ width: `${(r.pendientes / (r.total || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-right min-w-fit">
                <span className="text-red-600 font-bold">{r.pendientes} ✗</span>
                <span className="text-amber-600 font-bold">{r.enProceso} ◑</span>
                <span className="text-emerald-600 font-bold">{r.completados} ✓</span>
              </div>
              <div className={`w-14 text-right text-xs font-bold ${pctPend > 0.5 ? "text-red-600" : pctPend > 0.2 ? "text-amber-600" : "text-emerald-600"}`}>
                {formatPct(pctPend)} pend.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Alertas({ programs }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alertas = [];

  programs.forEach((p) => {
    const dias = p.diasInicio;

    if (dias !== null && dias < 30 && dias >= 0 && p.avance < 0.8 && p.riesgo !== "Cerrado") {
      alertas.push({ tipo: "rojo", msg: `🚨 Inicio en ${dias}d con avance ${formatPct(p.avance)}`, prog: p.programa, fac: p.facultad });
    }
    if (p.etapa === "3. VENTA" && p.hitoVals[HITOS.indexOf("Seguimiento Admisiones")] !== 2) {
      alertas.push({ tipo: "amarillo", msg: "🎓 En venta sin Seguimiento Admisiones completado", prog: p.programa, fac: p.facultad });
    }
    if (!p.codigoBanner || p.codigoBanner === "" || p.codigoBanner === "undefined") {
      alertas.push({ tipo: "amarillo", msg: "🏷️ Sin código Banner Curso", prog: p.programa, fac: p.facultad });
    }
    if (!p.cohorte || p.cohorte === "" || p.cohorte === "undefined") {
      alertas.push({ tipo: "amarillo", msg: "📅 Sin cohorte asignada", prog: p.programa, fac: p.facultad });
    }
    if (!p.crm || p.crm === "" || p.crm === "undefined") {
      alertas.push({ tipo: "gris", msg: "💾 Sin CRM", prog: p.programa, fac: p.facultad });
    }
    if (!p.pep || p.pep === "" || p.pep === "undefined") {
      alertas.push({ tipo: "gris", msg: "📄 Sin PEP", prog: p.programa, fac: p.facultad });
    }
    if (!p.precio || p.precio === 0) {
      alertas.push({ tipo: "amarillo", msg: "💲 Sin precio definido", prog: p.programa, fac: p.facultad });
    }
    if (!p.meta || p.meta === 0) {
      alertas.push({ tipo: "amarillo", msg: "🎯 Sin meta de estudiantes", prog: p.programa, fac: p.facultad });
    }
    if (p.docs === 0 && dias !== null && dias < 30 && dias >= 0 && p.riesgo !== "Cerrado") {
      alertas.push({ tipo: "rojo", msg: "👤 0 estudiantes documentados con inicio próximo", prog: p.programa, fac: p.facultad });
    }
  });

  const rojos = alertas.filter((a) => a.tipo === "rojo");
  const amarillos = alertas.filter((a) => a.tipo === "amarillo");
  const grises = alertas.filter((a) => a.tipo === "gris");

  const AlertGroup = ({ items, label, color }) => (
    items.length > 0 && (
      <div className="mb-5">
        <h3 className={`font-bold text-sm mb-2 ${color}`}>{label} ({items.length})</h3>
        <div className="space-y-2">
          {items.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-xs border ${a.tipo === "rojo" ? "bg-red-50 border-red-200" : a.tipo === "amarillo" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex-1">
                <div className="font-semibold text-gray-700">{a.msg}</div>
                <div className="text-gray-500 mt-0.5">{a.prog} · {a.fac}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  );

  return (
    <div>
      <SectionHeader title="Alertas Automáticas" subtitle={`${alertas.length} alertas detectadas en el portafolio`} />
      {alertas.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center text-emerald-600 font-semibold">
          ✅ Sin alertas activas. El portafolio está en buen estado.
        </div>
      ) : (
        <div>
          <AlertGroup items={rojos} label="🔴 Alertas Críticas" color="text-red-600" />
          <AlertGroup items={amarillos} label="🟡 Advertencias" color="text-amber-600" />
          <AlertGroup items={grises} label="⚪ Información Faltante" color="text-gray-500" />
        </div>
      )}
    </div>
  );
}

// ─── UPLOAD SCREEN ────────────────────────────────────────────────────────────
function UploadScreen({ onLoad }) {
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          // Convert array-of-arrays to array-of-objects with generic keys
          const headers = rows[0];
          const data = rows.slice(1).map((row) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
          });
          onLoad(data);
        },
      });
    } else {
      alert("Por favor sube un archivo CSV. Exporta tu Excel como CSV primero.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">
          📊
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Dashboard EDCO</h1>
        <p className="text-gray-500 mb-8">Seguimiento del ciclo de vida de programas de Educación Continua</p>

        <div
          className="border-2 border-dashed border-blue-300 rounded-2xl p-10 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        >
          <div className="text-5xl mb-3">📂</div>
          <p className="font-bold text-gray-700 group-hover:text-blue-600">Arrastra tu archivo CSV aquí</p>
          <p className="text-sm text-gray-400 mt-1">o haz clic para seleccionar</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 text-left text-sm text-gray-600 shadow-sm">
          <p className="font-semibold text-gray-700 mb-2">📋 Instrucciones</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Abre tu archivo Excel de seguimiento EDCO</li>
            <li>Ve a <strong>Archivo → Guardar como → CSV (separado por comas)</strong></li>
            <li>Sube el archivo CSV generado</li>
            <li>El dashboard procesará automáticamente todos los datos</li>
          </ol>
          <p className="mt-3 text-xs text-gray-400">Columnas requeridas: Facultad, Programa, Etapa, Fecha de Inicio, hitos operativos, Meta de estudiantes, Estudiantes Documentados, Precio</p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: "resumen", label: "Resumen", icon: "📊" },
  { id: "graficos", label: "Gráficos", icon: "📈" },
  { id: "tabla", label: "Tabla", icon: "📋" },
  { id: "heatmap", label: "Heatmap", icon: "🗂️" },
  { id: "cuellos", label: "Cuellos", icon: "⚙️" },
  { id: "alertas", label: "Alertas", icon: "🔔" },
];

export default function App() {
  const [rawData, setRawData] = useState(null);
  const [activeSection, setActiveSection] = useState("resumen");
  const fileRef = useRef();

  const programs = useMemo(() => {
    if (!rawData) return [];
    try {
      const processed = processRows(rawData);
      return processed.map(computeProgram);
    } catch (e) {
      console.error("Error procesando datos:", e);
      return [];
    }
  }, [rawData]);

  const handleLoad = useCallback((data) => {
    setRawData(data);
  }, []);

  const handleFileChange = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const headers = rows[0];
        const data = rows.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        });
        handleLoad(data);
      },
    });
  };

  if (!rawData) return <UploadScreen onLoad={handleLoad} />;

  const alertCount = programs.filter((p) => p.riesgo === "Alto").length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow">📊</div>
            <div>
              <h1 className="font-black text-gray-900 text-base leading-tight">Dashboard de Avance EDCO</h1>
              <p className="text-xs text-gray-400 leading-tight">Seguimiento del ciclo de vida de programas de Educación Continua</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
              {programs.length} programas
            </span>
            {alertCount > 0 && (
              <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full font-bold">
                🚨 {alertCount} en riesgo alto
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              📂 Cargar CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFileChange(e.target.files[0])} />
          </div>
        </div>
        {/* Nav */}
        <div className="max-w-screen-2xl mx-auto px-4 flex gap-1 pb-2 overflow-x-auto">
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeSection === s.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {s.icon} {s.label}
              {s.id === "alertas" && alertCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5">{alertCount}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-screen-2xl mx-auto px-4 py-8">
        {activeSection === "resumen" && <ResumenEjecutivo programs={programs} />}
        {activeSection === "graficos" && <GraficosPrincipales programs={programs} />}
        {activeSection === "tabla" && <TablaMaestra programs={programs} />}
        {activeSection === "heatmap" && <HeatmapHitos programs={programs} />}
        {activeSection === "cuellos" && <CuellosBotella programs={programs} />}
        {activeSection === "alertas" && <Alertas programs={programs} />}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-200 mt-8">
        Dashboard EDCO · Educación Continua · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
