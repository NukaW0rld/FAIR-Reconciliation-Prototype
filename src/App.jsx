import React, { useEffect, useMemo, useState } from "react";
import revA_balloon25 from "../assets/revA_balloon25.png";
import revB_balloon25 from "../assets/revB_balloon25.png";
import revA_balloon3132 from "../assets/revA_balloon3132.png";
import revB_balloon3132 from "../assets/revB_balloon3132.png";

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1YG6DEcrWv9uryyiJyklqoXSQXms6PKhl/edit?usp=sharing&ouid=101385638677008347573&rtpof=true&sd=true';

/**
 * JSDoc typedefs to avoid TS syntax at runtime
 * @typedef {"import"|"loading"|"queue"|"item"} View
 * @typedef {"added"|"changed"|"removed"|"orphaned"} ChangeType
 * @typedef {{id:string,type:ChangeType,balloon:number,title:string,detail:string,status?:"pending"|"approved"|"edited"|"dismissed",confidence?:string,edit?:{requirement?:string,notes?:string}}} ChangeRecord
 */

class ErrorBoundary extends React.Component { 
  constructor(props){ super(props); this.state = { hasError:false, error:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  componentDidCatch(error, info){ console.error("[ERROR-BOUNDARY]", error, info); }
  render(){ if(this.state.hasError){ const msg = String(this.state.error || ""); return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <h1 className="text-xl font-semibold">Something went wrong.</h1>
      <p className="mt-2 text-sm text-neutral-400">The UI caught an error and prevented a crash.</p>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs text-red-300">{msg}</pre>
      <button className="mt-4 rounded-lg bg-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900" onClick={()=>location.reload()}>Reload</button>
    </div>
  ); } return this.props.children; }
}

function __devAssert(condition, message) { if (!condition) { console.error(`[SELF-TEST] ${message}`); } }

function approveChange(arr, id) { return arr.map((c) => (c.id === id ? { ...c, status: "approved" } : c)); }
function dismissChange(arr, id) { return arr.map((c) => (c.id === id ? { ...c, status: "dismissed" } : c)); }
function saveEditChange(arr, id, edit) { return arr.map((c) => (c.id === id ? { ...c, edit, status: "edited" } : c)); }

/** @type {ChangeRecord[]} */
const INITIAL_CHANGES = [
  {
    id: "b31",
    type: "added",
    balloon: 31,
    title: "Balloon 31 – Chamfer 5 mm",
    detail: "New feature added in Rev B.",
    status: "pending",
    confidence: "Medium – Change not listed in revision block",
  },
  {
    id: "b32",
    type: "added",
    balloon: 32,
    title: "Balloon 32 – Chamfer 45°",
    detail: "New chamfer angle added in Rev B.",
    status: "pending",
    confidence: "Medium – Change not listed in revision block",
  },
  {
    id: "b25",
    type: "changed",
    balloon: 25,
    title: "Balloon 25 – 2×Ø8 THRU ALL → 4×Ø8 THRU ALL",
    detail: "Hole pattern updated from 2 holes to 4 holes.",
    status: "pending",
    confidence: "High – Dimension & geometry changed",
  },
];

(function __selfTest(){
  __devAssert(Array.isArray(INITIAL_CHANGES), "INITIAL_CHANGES must be an array");
  INITIAL_CHANGES.forEach((c,i)=>{
    __devAssert(c && typeof c === "object", `INITIAL_CHANGES[${i}] must be an object`);
    __devAssert(typeof c.id === "string" && c.id, `INITIAL_CHANGES[${i}].id must be non-empty string`);
    __devAssert(["added","changed","removed","orphaned"].includes(c.type), `INITIAL_CHANGES[${i}].type invalid`);
    __devAssert(Number.isFinite(c.balloon), `INITIAL_CHANGES[${i}].balloon must be a number`);
    __devAssert(typeof c.title === "string" && c.title, `INITIAL_CHANGES[${i}].title must be a non-empty string`);
    __devAssert(typeof c.detail === "string", `INITIAL_CHANGES[${i}].detail must be a string`);
  });
  const sample = JSON.parse(JSON.stringify(INITIAL_CHANGES));
  __devAssert(approveChange(sample,"b31").find(x=>x.id==="b31").status==="approved","approveChange should set approved");
  __devAssert(dismissChange(sample,"b32").find(x=>x.id==="b32").status==="dismissed","dismissChange should set dismissed");
  const e = saveEditChange(sample,"b25",{requirement:"4× Ø8 THRU ALL",notes:"Updated"});
  const eItem = e.find(x=>x.id==="b25");
  __devAssert(eItem.status==="edited","saveEditChange should set edited");
  __devAssert(eItem.edit && eItem.edit.requirement === "4× Ø8 THRU ALL","saveEditChange should persist edit");
})();

// ===== Delta Packet helpers =====
function csvEscape(v){ if(v==null) return ""; const s=String(v); return /[",\n]/.test(s)? '"'+s.replace(/"/g,'""')+'"' : s; }
function toCSV(rows){ if(!rows.length) return ""; const header=Object.keys(rows[0]); const lines=[header.map(csvEscape).join(",")]; for(const r of rows){ lines.push(header.map(k=>csvEscape(r[k])).join(",")); } return lines.join("\n"); }
async function buildDeltaZip({changes, summary, revA, revB, form3}){
  const JSZip = (await import("jszip")).default || (await import("jszip")).JSZip || (await import("jszip"));
  const zip = new JSZip();
  const now = new Date().toISOString();
  const manifest = {
    schema: "handy-mechanics.delta-packet/1.0",
    created_at: now,
    part_number: undefined,
    part_name: undefined,
    rev_from: revA?.name || "RevA.pdf",
    rev_to: revB?.name || "RevB.pdf",
    prior_form3: form3?.name || "form3_prior.xlsx",
    summary,
    guidance: "Prototype packet. For FAIR auditing, attach this packet to your existing Form 3 workbook and ECO record."
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const rows = changes.map(c=>({
    change_id: c.id,
    type: c.type,
    balloon: c.balloon,
    title: c.title,
    detail: c.detail,
    status: c.status || "pending",
    requirement: c.edit?.requirement || "",
    notes: c.edit?.notes || "",
  }));
  zip.file("changes.csv", toCSV(rows));

  const form3Delta = changes.map(c=>({
    action: c.type === "added" ? "add" : c.type === "removed" ? "remove" : "update",
    balloon: c.balloon,
    proposed_requirement: c.edit?.requirement || (c.type === "changed" && c.balloon===25 ? "4× Ø8 THRU ALL" : c.type === "added" ? c.title.split(" – ")[1]||"" : ""),
    notes: c.edit?.notes || "",
  }));
  zip.file("form3_delta.csv", toCSV(form3Delta));

  const evidence = [
    { balloon:25, revA:revA_balloon25, revB:revB_balloon25 },
    { balloon:31, revA:revA_balloon3132, revB:revB_balloon3132 },
    { balloon:32, revA:revA_balloon3132, revB:revB_balloon3132 },
  ];
  zip.file("evidence.json", JSON.stringify({ images: evidence }, null, 2));

  return zip.generateAsync({ type: "blob" });
}

// ===== Mock upload helpers =====
function makeMockFile(name, type){
  try { return new File([new Blob(["mock"], { type })], name, { type, lastModified: Date.now() }); }
  catch { return { name, size: 1024, type, lastModified: Date.now() }; }
}

function QuickMockUpload({ label, preset, onSelect }){
  return (
    <button
      type="button"
      onClick={()=> onSelect(preset)}
      className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-neutral-700 bg-neutral-900/20 text-sm font-medium text-neutral-200 hover:border-neutral-300 hover:bg-neutral-900/40"
    >
      {label}
    </button>
  );
}

export default function RevReconciliation() {
  const [view, setView] = useState("import");
  const [revA, setRevA] = useState(null);
  const [revB, setRevB] = useState(null);
  const [form3, setForm3] = useState(null);
  const [errors, setErrors] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [summary, setSummary] = useState({ added: 0, changed: 0, removed: 0, orphaned: 0, confidence: "None", durationSec: 0 });
  const [changes, setChanges] = useState(INITIAL_CHANGES);
  const [selectedId, setSelectedId] = useState(null);
  const [changeLog, setChangeLog] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [lastPacket, setLastPacket] = useState(null);
  const selected = useMemo(()=> (selectedId && changes.find(c=>c.id===selectedId)) || null, [selectedId, changes]);

  const allProvided = Boolean(revA && revB && form3);
  const totalPending = changes.filter(c=>!c.status || c.status === "pending").length;
  const readyToPublish = detected && allProvided && changes.length>0 && totalPending===0;

  function humanSize(bytes){ if(bytes===0) return "0 B"; const k=1024; const sizes=["B","KB","MB","GB"]; const i=Math.floor(Math.log(bytes)/Math.log(k)); return `${(bytes/Math.pow(k,i)).toFixed(1)} ${sizes[i]}`; }
  function validateFile(kind,f){ const newErrors=[]; if(kind==="revA"||kind==="revB"){ if(!f.name.toLowerCase().endsWith(".pdf")) newErrors.push(`${kind==="revA"?"Rev A":"Rev B"} must be a PDF.`); } else if(kind==="form3"){ const lower=f.name.toLowerCase(); if(!(lower.endsWith(".xlsx")||lower.endsWith(".csv"))) newErrors.push("Form-3 must be .xlsx or .csv."); } setErrors(newErrors); return newErrors.length===0; }
  function onSelect(kind,f){ if(!f) return; if(!validateFile(kind,f)) return; if(kind==="revA") setRevA(f); if(kind==="revB") setRevB(f); if(kind==="form3") setForm3(f); }

  async function handleDetect(){
    setDetecting(true);
    setDetected(false);
    setView("loading");
    const start = Date.now();
    await new Promise(r=>setTimeout(r, 3500));
    const durationSec = Math.max(1, Math.round((Date.now()-start)/1000));
    setSummary({ added:2, changed:1, removed:0, orphaned:0, confidence:"High", durationSec });
    setDetecting(false);
    setDetected(true);
    setView("queue");
  }
  function approveItem(id){ setChanges(prev=>approveChange(prev,id)); setChangeLog(l=>[...l,{id,action:"approve",at:new Date().toISOString()}]); setView("queue"); }
  function dismissItem(id){ setChanges(prev=>dismissChange(prev,id)); setChangeLog(l=>[...l,{id,action:"dismiss",at:new Date().toISOString()}]); setView("queue"); }
  function saveEdit(id, edit){ setChanges(prev=>saveEditChange(prev,id,edit)); setChangeLog(l=>[...l,{id,action:"edit",at:new Date().toISOString(),payload:edit}]); setView("queue"); }

  function publishPacket(){
    setPublishing(true);
    try{
      // Open Google Sheets in new tab
      window.open('https://docs.google.com/spreadsheets/d/1aodAuk2E1T7iq1oez9WZUBmAI54jV6fw/edit?usp=sharing&ouid=110275944371160580302&rtpof=true&sd=true', '_blank');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ErrorBoundary>
      {view === "loading" ? (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-100" aria-hidden="true" />
            <div className="text-sm text-neutral-300 text-center space-y-1">
              <p>Detecting changes between Rev A and Rev B…</p>
              <p>This may take a few seconds.</p>
            </div>
          </div>
        </div>
      ) : view === "queue" ? (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
          <div className="mx-auto max-w-5xl px-6 py-10">
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Changes Queue</h1>
                <p className="mt-1 text-sm text-neutral-400">Mock Rev A → Rev B Results</p>
              </div>
              <div className="flex items-center gap-2">
                <Chip label="Added" value={summary.added} color="emerald" />
                <Chip label="Changed" value={summary.changed} color="sky" />
                <Chip label="Removed" value={summary.removed} color="rose" />
                <Chip label="Orphaned" value={summary.orphaned} color="violet" />
                <button onClick={()=>setView("import")} className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-300">Back</button>
              </div>
            </header>

            <section className="space-y-3">
              {changes.map((c)=> (
                <button key={c.id} onClick={()=>{ setSelectedId(c.id); setView("item"); }} className="w-full rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-left hover:border-neutral-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={`text-xs font-semibold ${c.type === "added" ? "text-emerald-400" : c.type === "changed" ? "text-sky-400" : c.type === "removed" ? "text-rose-400" : "text-violet-400"}`}>{c.type.toUpperCase()}</div>
                      <div className="mt-1 text-base text-neutral-100">{c.title}</div>
                      <div className="mt-1 text-sm text-neutral-400">{c.detail}</div>
                      {c.edit?.requirement || c.edit?.notes ? (
                        <div className="mt-2 text-xs text-neutral-400">Edited{c.edit?.requirement ? " • Req: " + c.edit.requirement : ""}{c.edit?.notes ? " • Notes: " + c.edit.notes : ""}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-neutral-500">Balloon #{c.balloon}</div>
                      {(()=>{
                        const raw = c.confidence || summary.confidence || "High";
                        const [level, ...rest] = String(raw).split("–");
                        const reason = rest.join("–").trim();
                        return (
                          <>
                            <Chip label="Confidence" value={level.trim()} color="neutral" />
                            {reason && <span className="text-[11px] text-neutral-400">{reason}</span>}
                          </>
                        );
                      })()}
                      {c.status && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          c.status === "approved" ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800" :
                          c.status === "edited"   ? "bg-sky-900/40 text-sky-300 border border-sky-800" :
                          c.status === "dismissed"? "bg-neutral-800 text-neutral-300 border border-neutral-700" : ""}`}>{c.status}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </section>

            <div className="mt-6 flex items-center justify-end">
              {readyToPublish ? (
                <form action={SHEET_URL} target="_blank" method="get" onSubmit={(e)=>{/* ensure no React state update runs before native open */}}>
                  <button type="submit" className="rounded-xl px-4 py-2 text-sm font-medium bg-emerald-500 text-neutral-900 hover:bg-emerald-400">
                    Publish Delta Packet
                  </button>
                </form>
              ) : (
                <button disabled className="rounded-xl px-4 py-2 text-sm font-medium bg-neutral-800 text-neutral-600 cursor-not-allowed">
                  Publish Delta Packet
                </button>
              )}
            </div>
          </div>
        </div>
      ) : view === "item" && selected ? (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <header className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Item Review</h1>
                <p className="mt-1 text-sm text-neutral-400">{selected.title}</p>
                {(()=>{
                  const raw = selected.confidence || summary.confidence || "High";
                  const [level, ...rest] = String(raw).split("–");
                  const reason = rest.join("–").trim();
                  return (
                    <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                      <Chip label="Confidence" value={level.trim()} color="neutral" />
                      {reason && <span>{reason}</span>}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>setView("queue")} className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-300">Back to Queue</button>
              </div>
            </header>

            {(()=>{
              const isB25 = selected.balloon === 25;
              const isB31or32 = selected.balloon === 31 || selected.balloon === 32;
              const showRevA = isB25 || isB31or32;

              let revAImg = null;
              let revBImg = null;

              if (isB25) {
                revAImg = revA_balloon25;
                revBImg = revB_balloon25;
              } else if (isB31or32) {
                revAImg = revA_balloon3132;
                revBImg = revB_balloon3132;
              }

              const leftImg = showRevA ? revAImg : revBImg;
              const rightImg = showRevA ? revBImg : null;

              return (
                <>
                  <section className="grid gap-4 md:grid-cols-2">
                    {showRevA && (
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-3">
                        <div className="mb-2 text-xs text-neutral-400">Rev A</div>
                        <div className="flex h-[420px] items-center justify-center overflow-hidden rounded-xl bg-neutral-950">
                          <SafeImg src={leftImg} alt="Rev A view" />
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-3">
                      <div className="mb-2 text-xs text-neutral-400">Rev B</div>
                      <div className="flex h-[420px] items-center justify-center overflow-hidden rounded-xl bg-neutral-950">
                        <SafeImg src={showRevA ? rightImg : leftImg} alt="Rev B view" />
                      </div>
                    </div>
                  </section>

                  <EditorPanel selected={selected} onSave={(edit)=>saveEdit(selected.id, edit)} onApprove={()=>approveItem(selected.id)} onDismiss={()=>dismissItem(selected.id)} />
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
          <div className="mx-auto max-w-5xl px-6 py-10">
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Rev Reconciliation</h1>
              </div>
              <div className="text-xs text-neutral-400">This is a prototype. Program's logic is not functional.</div>
            </header>

            <section className="grid gap-5 md:grid-cols-3">
              <QuickMockUpload label={revA?`Rev A loaded: ${revA.name}`:"Click to load Rev A (mock)"} preset={makeMockFile("RevA.pdf","application/pdf")} onSelect={(f)=>onSelect("revA", f)} />
              <QuickMockUpload label={revB?`Rev B loaded: ${revB.name}`:"Click to load Rev B (mock)"} preset={makeMockFile("RevB.pdf","application/pdf")} onSelect={(f)=>onSelect("revB", f)} />
              <QuickMockUpload label={form3?`Form-3 loaded: ${form3.name}`:"Click to load prior Form-3 (mock)"} preset={makeMockFile("form3_prior.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")} onSelect={(f)=>onSelect("form3", f)} />
            </section>

            {errors.length>0 && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
                {errors.map((e,i)=>(<div key={i}>• {e}</div>))}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button type="button" onClick={handleDetect} disabled={!allProvided || detecting} className={"rounded-xl px-4 py-2 text-sm font-medium transition "+(!allProvided || detecting?"bg-neutral-700 text-neutral-400 cursor-not-allowed":"bg-white text-neutral-900 hover:bg-neutral-200")} aria-busy={detecting}>
                {detecting?"Detecting…":"Detect Changes"}
              </button>
            </div>

            <section className="mt-8 grid gap-3 md:grid-cols-3">
              <FileBadge title="Rev A" file={revA} />
              <FileBadge title="Rev B" file={revB} />
              <FileBadge title="Form-3" file={form3} />
            </section>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}

function EditorPanel({ selected, onSave, onApprove, onDismiss }){
  const [req, setReq] = useState(selected.edit?.requirement ?? "");
  const [editMode, setEditMode] = useState(false);
  const defaultAddedText = selected.type === "added" ? (selected.title.split(" – ")[1] || "") : "";
  return (
    <>
      <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
        <div className="grid gap-3 md:grid-cols-1">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Proposed requirement</label>
            <input
              value={req}
              onChange={(e)=>setReq(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              placeholder={selected.type === "changed" ? "4× Ø8 THRU ALL" : selected.type === "added" ? defaultAddedText : ""}
              disabled={!editMode}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 flex items-center gap-3">
        <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200" onClick={()=>onApprove()}>Approve</button>
        {!editMode ? (
          <button className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-300" onClick={()=>setEditMode(true)}>Edit…</button>
        ) : (
          <button className="rounded-xl bg-sky-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-sky-300" onClick={()=>onSave({ requirement:req })}>Save</button>
        )}
        <button className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700" onClick={()=>onDismiss()}>Dismiss</button>
      </section>
    </>
  );
}

function FileBadge({ title, file }){
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      {file ? <div className="mt-1 text-sm text-neutral-200">{file.name}</div> : <div className="mt-1 text-sm text-neutral-600">No file selected</div>}
    </div>
  );
}

function Chip({ label, value, color }){
  const palette = {
    emerald: "bg-emerald-900/30 text-emerald-200 border-emerald-700/50",
    sky: "bg-sky-900/30 text-sky-200 border-sky-700/50",
    rose: "bg-rose-900/30 text-rose-200 border-rose-700/50",
    violet: "bg-violet-900/30 text-violet-200 border-violet-700/50",
    neutral: "bg-neutral-800 text-neutral-300 border-neutral-700",
  };
  const resolved = palette[color] || palette.neutral;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${resolved}`}>
      <span className="opacity-80">{label}:</span>
      <span className="font-semibold">{String(value)}</span>
    </div>
  );
}

function SafeImg({ src, alt }){
  if(!src || typeof src !== "string") return <div className="flex h-[420px] items-center justify-center text-xs text-neutral-500">No image</div>;
  return <img src={src} alt={alt} className="h-full w-full object-contain" draggable={false} />;
}
