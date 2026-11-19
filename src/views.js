/* LDM Portal: shared project screens (ported from the LDM Project Hub). */

const PHASES = ["Design","Permitting","Mobilization","Demolition","Structural","Roofing & Masonry","MEPF Roughing","Finishing","Punchlist","Turnover"];
const PHASE_COLORS = ["#a7e6e3","#74d7d3","#3fc9c4","#0ebcb6","#0b9a95","#087f7b","#06625f","#575757","#2b2b2b","#000000"];
const STATUSES = ["Proposal","Onboarded","Ongoing","On Hold","Completed","Terminated","Unconfirmed"];
const ACTIVE = new Set(["Onboarded","Ongoing"]);
const RELEASE_PHASES = new Set(["Finishing","Punchlist","Turnover"]);
const CATS = ["Mobilization","Temporary Facilities","Materials","Labor","Subcontract","Equipment","Permits & Fees","Overhead","Misc"];
const DESIGN_CATS = ["Design Manpower","Consultants","Survey & Soil Test","Plans & Printing","Permits & Fees","Transportation","Misc"];
const STAGES = ["Design","Construction"];
const PAY_TYPES = ["Downpayment","Progress billing","Retention release","Final payment","Change order","Other"];
function colOf(id, st) { return S.collections.filter(c => c.projectId === id && (!st || (c.stage === "Design" ? "Design" : "Construction") === st)).reduce((a, c) => a + (+c.amount || 0), 0); }
function stageOf(c) { return c.stage === "Design" ? "Design" : "Construction"; }
function stageCost(id, st) { return S.costs.filter(c => c.projectId === id && stageOf(c) === st).reduce((a, c) => a + (+c.amount || 0), 0); }

const S = { projects: [], costs: [], settings: { capacity: 5, assumedMonths: 6, releaseMonths: 2 }, loaded: false, local: false,
  mapView: null, pinFor: "", collections: [], colYear: new Date().getFullYear(), costYear: new Date().getFullYear(), costMonth: ym(new Date()), costProject: "", dur: 6 };

/* ---------- helpers ---------- */
function ym(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function ymd(d) { return ym(d) + "-" + String(d.getDate()).padStart(2, "0"); }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function peso(n) { return "₱" + Math.round(n || 0).toLocaleString("en-PH"); }
function pesoS(n) { const a = Math.abs(n || 0), s = n < 0 ? "−" : ""; if (a >= 1e6) return s + "₱" + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M"; if (a >= 1e3) return s + "₱" + Math.round(a / 1e3) + "K"; return s + "₱" + Math.round(a); }
function parseD(s) { if (!s) return null; const [y, m, d] = String(s).split("-").map(Number); if (!y) return null; return new Date(y, (m || 1) - 1, d || 1); }
function fmtD(s) { const d = parseD(s); return d ? d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function qOf(d) { return d.getFullYear() * 4 + Math.floor(d.getMonth() / 3); }
function qLabel(q) { return "Q" + (q % 4 + 1) + " " + Math.floor(q / 4); }
function qStart(q) { return new Date(Math.floor(q / 4), (q % 4) * 3, 1); }
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

function span(p) {
  const s = parseD(p.startDate) || parseD(p.mobilizationDate) || parseD(p.onboardDate) || today();
  let e = parseD(p.endDate), assumed = false;
  if (!e) { e = addMonths(s, +S.settings.assumedMonths || 6); assumed = true; }
  if (e < s) e = s;
  // Slot opens at the Finishing stage, or N months before closeout, whichever comes first
  let release = addMonths(e, -(+S.settings.releaseMonths || 0));
  const freed = RELEASE_PHASES.has(p.phase);
  if (freed) release = addMonths(today(), -1);
  return { s, e, assumed, release, freed };
}
function holdsSlot(p, q) { const { s, release } = span(p); return release >= s && qOf(s) <= q && q <= qOf(release); }
function actualCost(id) { return S.costs.filter(c => c.projectId === id).reduce((a, c) => a + (+c.amount || 0), 0); }
function applicable(p) { const na = new Set(p.phasesNA || []); return PHASES.filter(ph => !na.has(ph)); }
function phasePct(p, ph) { return Math.max(0, Math.min(100, +((p.phaseProgress || {})[ph]) || 0)); }
function derive(p) {
  const a = applicable(p);
  if (!p.phaseProgress) return { progress: +p.progress || 0, phase: p.phase || "" };
  const progress = a.length ? Math.round(a.reduce((t, ph) => t + phasePct(p, ph), 0) / a.length) : 0;
  const phase = a.find(ph => phasePct(p, ph) < 100) || a[a.length - 1] || "";
  return { progress, phase };
}
function fin(p) {
  const contract = +p.contract || 0, est = +p.estCost || 0, actual = stageCost(p.id, "Construction"), designActual = stageCost(p.id, "Design"), collected = colOf(p.id) || +p.collected || 0, collectedD = colOf(p.id, "Design"), collectedC = colOf(p.id, "Construction");
  const designC = +p.designContract || 0, constrC = p.constructionContract != null && p.constructionContract !== "" ? +p.constructionContract || 0 : Math.max(0, contract - designC);
  const designBudget = +p.designCost || 0, designBasis = designBudget || designActual;
  const designProfit = designC - designBasis, constrProfit = constrC - est;
  const projCost = est + designBasis;
  const profit = contract - est, ok = est > 0 && contract > 0;
  const spent = actual + designActual, runConstr = est - spent, runDesign = 0;
  const running = est - spent, actualProfit = profit + running;
  return { contract, designC, constrC, est, actual, designActual, designBudget, designBasis, designProfit, constrProfit, spent, ok, runConstr, runDesign, running, actualProfit, collected, collectedD, collectedC, projCost, profit, margin: contract ? profit / contract : null, receivable: contract - collected };
}
function isLate(p) { const e = parseD(p.endDate); return e && e < today() && p.status !== "Completed"; }
function chip(st) { return `<span class="chip ${esc(String(st || "").replace(/\s/g, ""))}">${esc(st || "—")}</span>`; }
function projName(id) { const p = S.projects.find(x => x.id === id); return p ? p.name : "(deleted project)"; }

function occupancy(q) {
  return S.projects.filter(p => ACTIVE.has(p.status)).filter(p => holdsSlot(p, q));
}
function tentative(q) {
  return S.projects.filter(p => p.status === "Proposal").filter(p => holdsSlot(p, q));
}
function earliestSlot(months) {
  const cap = +S.settings.capacity || 1, need = Math.max(1, Math.ceil(months / 3)), q0 = qOf(today());
  for (let q = q0; q < q0 + 24; q++) {
    let ok = true;
    for (let k = 0; k < need; k++) if (occupancy(q + k).length >= cap) { ok = false; break; }
    if (ok) return q;
  }
  return null;
}

function alerts() {
  const out = [];
  for (const p of S.projects) {
    const f = fin(p);
    if (isLate(p)) out.push({ t: "bad", p, m: `Past target completion (${fmtD(p.endDate)}) and still ${p.status.toLowerCase()}.` });
    if (f.est && f.actual > f.est && p.status !== "Completed") out.push({ t: "bad", p, m: `Spent ${peso(f.actual)}, over the ${peso(f.est)} budget by ${peso(f.actual - f.est)}.` });
    else if (f.est && p.status === "Ongoing" && f.actual > f.est * ((+p.progress || 0) / 100) * 1.1 && f.actual > 0) out.push({ t: "warn", p, m: `Spending (${Math.round(f.actual / f.est * 100)}% of budget) is ahead of progress (${+p.progress || 0}%).` });
    if (f.designBudget && f.designActual > f.designBudget) out.push({ t: "bad", p, m: `Design spending ${peso(f.designActual)} is over the ${peso(f.designBudget)} design cost by ${peso(f.designActual - f.designBudget)}.` });
    if (p.status === "Unconfirmed") out.push({ t: "info", p, m: "Status needs confirming." });
    if (ACTIVE.has(p.status) && f.contract && !f.est) out.push({ t: "warn", p, m: "No computed direct cost yet, so protected profit isn't shown." });
    if (ACTIVE.has(p.status) && !f.contract) out.push({ t: "warn", p, m: "No contract amount yet, so profit can't be projected." });
    if (ACTIVE.has(p.status) && !p.endDate) out.push({ t: "info", p, m: `No target completion date. Capacity assumes ${S.settings.assumedMonths} months.` });
    if (p.status === "Ongoing" && !p.phase) out.push({ t: "info", p, m: "Current phase not set." });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.t] - rank[b.t]);
}

/* ---------- views ---------- */
function vOverview() {
  const act = S.projects.filter(p => ACTIVE.has(p.status));
  const ongoing = S.projects.filter(p => p.status === "Ongoing");
  const props = S.projects.filter(p => p.status === "Proposal");
  const totContract = act.reduce((a, p) => a + fin(p).contract, 0);
  const withDC = act.filter(p => fin(p).ok);
  const totProfit = withDC.reduce((a, p) => a + fin(p).profit, 0), dcContract = withDC.reduce((a, p) => a + fin(p).contract, 0);
  const totRunning = act.filter(p => fin(p).est > 0).reduce((a, p) => a + fin(p).running, 0);
  const totBudget = act.reduce((a, p) => a + fin(p).est, 0), spentDC = act.filter(p => fin(p).est > 0).reduce((a, p) => a + fin(p).spent, 0);
  const totCollected = act.reduce((a, p) => a + fin(p).collected, 0);
  const totSpent = act.reduce((a, p) => a + fin(p).actual + fin(p).designActual, 0);
  const atHand = totCollected - totSpent;
  const mNow = ym(new Date());
  const spentMonth = S.costs.filter(c => (c.date || "").startsWith(mNow)).reduce((a, c) => a + (+c.amount || 0), 0);
  const slot = earliestSlot(S.dur);
  const al = alerts();
  const byPhase = PHASES.map((ph, i) => ({ ph, c: PHASE_COLORS[i], n: ongoing.concat(act.filter(p => p.status === "Onboarded")).filter(p => p.phase === ph).length })).filter(x => x.n);
  const totPh = byPhase.reduce((a, x) => a + x.n, 0);
  const q0 = qOf(today());
  const mobs = S.projects.filter(p => p.mobilizationDate && parseD(p.mobilizationDate) >= today() && p.status !== "Completed").sort((a, b) => a.mobilizationDate.localeCompare(b.mobilizationDate));
  return `
  <div class="head"><div><h1>Good day, ${esc((ME && ME.full_name) || "Engr. Miranda")}</h1><p class="sub">${new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${act.length} active projects, ${props.length} in proposal</p></div>
  <div class="row"><button class="btn" data-a="new-cost">Log a cost</button><button class="btn primary" data-a="new-project">Add client / project</button></div></div>
  <div class="grid-tiles">
    <div class="tile"><span class="k">Ongoing</span><span class="v">${ongoing.length}</span><span class="h">${act.length - ongoing.length} onboarded, not yet started</span></div>
    <div class="tile hi"><span class="k">Next open slot</span><span class="v">${slot === null ? "None in 6 yrs" : qLabel(slot)}</span><span class="h">for a ${S.dur} month project · ${S.settings.capacity} clients per cycle</span></div>
    <div class="tile"><span class="k">Active contract value</span><span class="v">${pesoS(totContract)}</span><span class="h">onboarded + ongoing</span></div>
    <div class="tile"><span class="k">Protected profit</span><span class="v ${totProfit < 0 ? "neg" : ""}">${withDC.length ? pesoS(totProfit) : "–"}</span><span class="h">${withDC.length ? Math.round(totProfit / dcContract * 100) + "% margin · " + withDC.length + " of " + act.length + " projects with direct cost" : "enter direct costs to compute"}</span></div>
    <div class="tile"><span class="k">Total running budget</span><span class="v ${totRunning < 0 ? "neg" : ""}">${totBudget ? pesoS(totRunning) : "–"}</span><span class="h">${totBudget ? pesoS(totBudget) + " direct cost less " + pesoS(spentDC) + " spent" : "enter direct costs to compute"}</span></div>
    <div class="tile hi"><span class="k">Total budget at hand</span><span class="v ${atHand < 0 ? "neg" : ""}">${pesoS(atHand)}</span><span class="h">${pesoS(totCollected)} collected less ${pesoS(totSpent)} spent</span></div>
    <div class="tile"><span class="k">Collected in ${MONTHS[new Date().getMonth()]}</span><span class="v">${pesoS(S.collections.filter(c => (c.date || "").startsWith(mNow)).reduce((a, c) => a + (+c.amount || 0), 0))}</span><span class="h">${pesoS(act.reduce((a, p) => a + fin(p).receivable, 0))} still to collect</span></div>
    <div class="tile"><span class="k">Spent in ${MONTHS[new Date().getMonth()]}</span><span class="v">${pesoS(spentMonth)}</span><span class="h">${S.costs.filter(c => (c.date || "").startsWith(mNow)).length} cost entries</span></div>
  </div>
  <div class="card scroll"><div class="row" style="justify-content:space-between"><h2>Projects at a glance</h2><a href="#progress" class="small">Update progress</a></div>${summaryTable()}</div>
  ${mapPanel()}
  <div class="two">
    <div class="card"><div class="row" style="justify-content:space-between"><h2>Needs attention</h2><span class="muted small">${al.length} items</span></div>
      ${al.length ? `<div class="alerts">${al.slice(0, 9).map(a => `<div class="al ${a.t}"><div><b>${esc(a.p.name)}</b> <span class="muted small">${esc(a.p.client || "")}</span><div class="small">${esc(a.m)}</div></div><button class="btn sm" data-a="edit" data-id="${a.p.id}">Update</button></div>`).join("")}${al.length > 9 ? `<p class="muted small">+ ${al.length - 9} more. Open Projects &amp; Phases to review.</p>` : ""}</div>` : `<div class="empty">All clear. No overdue projects, overruns or missing data.</div>`}
    </div>
    <div class="card"><h2>Where active projects are</h2>
      ${totPh ? `<div class="phasebar">${byPhase.map(x => `<div style="flex:${x.n};background:${x.c};color:${PHASE_COLORS.indexOf(x.c) < 4 ? "#000" : "#fff"}" title="${esc(x.ph)}: ${x.n}">${x.n}</div>`).join("")}</div><div class="legend">${byPhase.map(x => `<span style="--c:${x.c}">${esc(x.ph)} (${x.n})</span>`).join("")}</div>` : `<div class="empty">Set a phase on active projects to see the spread.</div>`}
      <h2 style="margin-top:6px">Upcoming mobilizations</h2>
      ${mobs.length ? `<table><tbody>${mobs.map(p => `<tr class="click" data-a="edit" data-id="${p.id}"><td class="small" style="white-space:nowrap;font-family:var(--mono)">${fmtD(p.mobilizationDate)}</td><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.scope || p.location || "")}</div></td></tr>`).join("")}</tbody></table>` : `<div class="empty">No upcoming mobilization dates.</div>`}
      <h2 style="margin-top:6px">Next 4 quarters</h2>
      <div class="qgrid">${[0, 1, 2, 3].map(k => qCard(q0 + k, false)).join("")}</div>
    </div>
  </div>`;
}


function progressPanel() {
  const order = { Ongoing: 0, Onboarded: 1, "On Hold": 2 };
  const list = S.projects.filter(p => p.status in order).sort((a, b) => order[a.status] - order[b.status] || (a.mobilizationDate || a.startDate || "9").localeCompare(b.mobilizationDate || b.startDate || "9"));
  if (!list.length) return `<div class="empty">No active projects yet.</div>`;
  return list.map(p => {
    const d = derive(p), f = fin(p), mob = p.mobilizationDate && parseD(p.mobilizationDate) >= today();
    return `<div class="prog">
      <div class="pn"><b data-a="edit" data-id="${p.id}">${esc(p.name)}</b><span class="small muted">${esc(p.scope || p.client || "")}</span>
        <div class="row" style="gap:6px;margin-top:6px">${chip(p.status)}<span class="small">Now in <b>${esc(d.phase || "not set")}</b></span></div>
        <div class="ovr"><b>${d.progress}%</b><span class="small muted">overall</span></div><div class="bar" style="height:8px"><i style="width:${d.progress}%"></i></div>
        ${ROLE !== "owner" ? "" : `<dl class="money"><dt>Design contract</dt><dd>${f.designC ? peso(f.designC) : "–"}</dd><dt>Design cost${f.designBudget ? "" : " (actual)"}</dt><dd>${f.designBasis ? peso(f.designBasis) : "–"}</dd><dt>Construction contract</dt><dd>${f.constrC ? peso(f.constrC) : "–"}</dd><dt>Direct cost</dt><dd>${f.est ? peso(f.est) : "–"}</dd><dt><b>Total contract</b></dt><dd><b>${f.contract ? peso(f.contract) : "–"}</b></dd><dt>Protected profit</dt><dd class="${f.ok ? (f.profit < 0 ? "neg" : "pos") : ""}">${f.ok ? peso(f.profit) : `<span class="small muted">set direct cost</span>`}</dd><dt>Running budget</dt><dd class="${f.running < 0 ? "neg" : ""}">${f.est ? peso(f.running) : "–"}</dd><dt>Budget at hand</dt><dd class="${f.collected - f.actual - f.designActual < 0 ? "neg" : ""}">${f.collected || f.actual || f.designActual ? peso(f.collected - f.actual - f.designActual) : "–"}</dd><dt><b>Actual profit</b></dt><dd class="${p.status === "Completed" && f.contract ? (f.actualProfit < 0 ? "neg" : "pos") : "muted"}">${p.status === "Completed" && f.contract ? `<b>${peso(f.actualProfit)}</b>` : `<span class="small">at completion</span>`}</dd></dl>`}
        <div class="meta">${mob ? `<span><b style="color:var(--ink)">Mobilizes</b> ${fmtD(p.mobilizationDate)}</span>` : p.startDate ? `<span>Started ${fmtD(p.startDate)}</span>` : ""}<span class="${isLate(p) ? "neg" : ""}">Target ${p.endDate ? fmtD(p.endDate) : "not set"}</span></div>
      </div>
      <div class="phs">${applicable(p).map(ph => { const v = p.phaseProgress ? phasePct(p, ph) : (PHASES.indexOf(ph) < PHASES.indexOf(d.phase) ? 100 : 0); const key = p.id + "|" + ph; const idk = "ph-" + p.id + "-" + PHASES.indexOf(ph);
        return `<label class="phr ${v >= 100 ? "done" : ph === d.phase ? "cur" : ""}" for="${idk}"><span>${esc(ph)}</span><input type="range" min="0" max="100" step="5" value="${v}" id="${idk}" data-php="${esc(key)}" style="--v:${v}%" aria-label="${esc(ph)} progress for ${esc(p.name)}"><b id="${idk}-v">${v}%</b></label>`; }).join("")}</div>
    </div>`;
  }).join("");
}
function summaryTable() {
  const list = mapProjects();
  if (!list.length) return `<div class="empty">No active projects yet.</div>`;
  return `<table><thead><tr><th>Project</th><th>Status</th><th>Current phase</th><th style="min-width:160px">Progress</th><th>Next date</th><th class="num">Contract</th></tr></thead><tbody>
  ${list.map(p => { const d = derive(p), f = fin(p), mob = p.mobilizationDate && parseD(p.mobilizationDate) >= today();
    return `<tr class="click" data-a="edit" data-id="${p.id}"><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.scope || p.location || "")}</div></td><td>${chip(p.status)}</td><td>${esc(d.phase || "—")}</td>
    <td><div class="pctrow"><div class="bar"><i style="width:${d.progress}%"></i></div><span class="small" style="font-family:var(--mono);min-width:36px;text-align:right">${d.progress}%</span></div></td>
    <td class="small">${mob ? `Mobilization<br><b>${fmtD(p.mobilizationDate)}</b>` : `Target<br><b class="${isLate(p) ? "neg" : ""}">${p.endDate ? fmtD(p.endDate) : "not set"}</b>`}</td>
    <td class="num">${f.contract ? peso(f.contract) : "–"}</td></tr>`; }).join("")}
  </tbody></table>`;
}

function vProgress() {
  const list = mapProjects();
  const avg = list.length ? Math.round(list.reduce((a, p) => a + derive(p).progress, 0) / list.length) : 0;
  return `
  <div class="head"><div><h1>Project progress</h1><p class="sub">${list.length} active project${list.length === 1 ? "" : "s"} · ${avg}% average progress. Drag any phase bar to update it. Overall % is the average of the phases that apply.</p></div>
  ${ROLE === "owner" ? `<button class="btn primary" data-a="new-project">Add client / project</button>` : ""}</div>
  <div class="card">${progressPanel()}</div>`;
}

/* ---------- map ---------- */
const OFFICE = { name: "LDM office", lat: 14.5845, lng: 121.0395 };
const MK = Math.cos(14.5 * Math.PI / 180);
const SC = 1000, proj = (lng, lat) => [lng * MK * SC, -lat * SC];
let MAPGEO = null;
function mapGeo() {
  if (MAPGEO || !window.PH_MAP) return MAPGEO;
  MAPGEO = { p: PH_MAP.p.map(f => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const d = f.r.map(r => { let out = ""; for (let i = 0; i < r.length; i += 2) { const [x, y] = proj(r[i], r[i + 1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); out += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); } return out + "Z"; }).join("");
    const c = proj(f.c[0], f.c[1]); return { n: f.n, d, b: [x0, y0, x1, y1], c, a: f.a }; }),
    l: PH_MAP.l.map(r => { let out = ""; for (let i = 0; i < r.length; i += 2) { const [x, y] = proj(r[i], r[i + 1]); out += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); } return out + "Z"; }).join("") };
  return MAPGEO;
}
function mapProjects() {
  const order = { Ongoing: 0, Onboarded: 1, "On Hold": 2 };
  return S.projects.filter(p => p.status in order).sort((a, b) => order[a.status] - order[b.status] || (a.mobilizationDate || a.startDate || "9").localeCompare(b.mobilizationDate || b.startDate || "9"));
}
function fitView() {
  const pts = mapProjects().filter(p => isFinite(+p.lat) && isFinite(+p.lng) && p.lat !== "" && p.lat != null).map(p => proj(+p.lng, +p.lat)).concat([proj(OFFICE.lng, OFFICE.lat)]);
  let x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.max(0.3 * SC, (x1 - x0) * 1.6, (y1 - y0) * 1.9 * 1.6);
  return { cx, cy, w };
}
function mapSvg() {
  const g = mapGeo(); const v = S.mapView || fitView();
  const W = v.w, H = v.w / 1.6, x0 = v.cx - W / 2, y0 = v.cy - H / 2, k = W / 640;
  if (!g) return `<text x="${v.cx}" y="${v.cy}">Map data didn't load.</text>`;
  const vis = g.p.filter(f => f.b[2] > x0 && f.b[0] < x0 + W && f.b[3] > y0 && f.b[1] < y0 + H);
  const labels = vis.filter(f => f.a > W * H * 0.03 && f.c[0] > x0 && f.c[0] < x0 + W && f.c[1] > y0 && f.c[1] < y0 + H);
  const list = mapProjects();
  const pins = list.map((p, i) => ({ p, i })).filter(({ p }) => p.lat !== "" && p.lat != null && isFinite(+p.lat) && isFinite(+p.lng));
  const [ox, oy] = proj(OFFICE.lng, OFFICE.lat);
  return `<svg id="pmap" viewBox="${x0} ${y0} ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of project locations">
    <rect x="${x0 - W}" y="${y0 - H}" width="${W * 3}" height="${H * 3}" fill="var(--water)"/>
    ${vis.map(f => `<path class="land" d="${f.d}" vector-effect="non-scaling-stroke" stroke-width="1"><title>${esc(f.n)}</title></path>`).join("")}
    <path class="lake" d="${g.l}"/>
    ${labels.map(f => `<text class="plabel" x="${f.c[0]}" y="${f.c[1]}" font-size="${10.5 * k}">${esc(f.n)}</text>`).join("")}
    <g><rect x="${ox - 6 * k}" y="${oy - 6 * k}" width="${12 * k}" height="${12 * k}" fill="var(--ink)" stroke="var(--land)" stroke-width="${2 * k}"/><text class="pinlabel" x="${ox - 10 * k}" y="${oy + 4 * k}" font-size="${11 * k}" stroke-width="${3 * k}" text-anchor="end">LDM office</text></g>
    ${pins.map(({ p, i }) => { const [x, y] = proj(+p.lng, +p.lat); const on = p.status === "Ongoing";
      return `<g class="pin" data-a="edit" data-id="${p.id}"><title>${esc(p.name)} · ${esc(p.location || "")}</title>
        <path d="M${x} ${y} l${-9 * k} ${-14 * k} a${11 * k} ${11 * k} 0 1 1 ${18 * k} 0 z" fill="${on ? "var(--brand)" : "var(--ink)"}" stroke="var(--land)" stroke-width="${2 * k}"/>
        <text x="${x}" y="${y - 17 * k}" font-size="${11 * k}" text-anchor="middle" font-weight="700" fill="${on ? "#000" : "#fff"}" font-family="var(--display)">${i + 1}</text>
        <text class="pinlabel" x="${x + 14 * k}" y="${y - 14 * k}" font-size="${12 * k}" stroke-width="${3 * k}">${esc(p.name)}</text></g>`; }).join("")}
  </svg>`;
}
function mapPanel() {
  const list = mapProjects();
  if (!list.length) return "";
  const placing = S.pinFor && S.projects.find(p => p.id === S.pinFor);
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Where projects are</h2>
    <div class="row" ${ROLE === "owner" ? "" : "hidden"}><label class="small muted" for="pinfor">Place or move a pin</label><select id="pinfor" data-local="pinFor"><option value="">Choose a project…</option>${list.map(p => `<option value="${p.id}" ${p.id === S.pinFor ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div></div>
    <div class="mapwrap"><div class="mapbox ${placing ? "placing" : ""}" id="mapbox">${mapSvg()}
      <div class="zoom"><button class="btn" data-a="map-zin" aria-label="Zoom in">+</button><button class="btn" data-a="map-zout" aria-label="Zoom out">−</button><button class="btn" data-a="map-fit" aria-label="Fit all projects" title="Fit all projects">⤢</button></div>
      <div class="hint">${placing ? `Click the map to set the pin for <b>${esc(placing.name)}</b>. <a href="#" data-a="pin-cancel">Cancel</a>` : `Drag to pan. Click a pin to open the project.`}</div></div>
    <ol class="maplist">${list.map((p, i) => { const has = p.lat !== "" && p.lat != null && isFinite(+p.lat);
      return `<li><span class="num ${has ? esc(p.status) : "none"}">${i + 1}</span><div><b class="click" data-a="edit" data-id="${p.id}" style="cursor:pointer">${esc(p.name)}</b><div class="small muted">${esc(p.location || "No location")}</div>
        <div class="small">${chip(p.status)} ${has ? "" : `<a href="#" data-a="pin-set" data-id="${p.id}">Place pin</a>`}</div></div></li>`; }).join("")}
      <li><span class="num" style="border-radius:3px">■</span><div><b>LDM office</b><div class="small muted">Shaw Blvd, Mandaluyong</div></div></li></ol></div>
    <div class="legend"><span style="--c:var(--brand)">Ongoing</span><span style="--c:var(--ink)">Onboarded / on hold</span></div></div>`;
}
let drag = null, lastDrag = 0;
document.addEventListener("pointerdown", e => { const svg = e.target.closest && e.target.closest("#pmap"); if (!svg) return; drag = { x: e.clientX, y: e.clientY, v: { ...(S.mapView || fitView()) }, moved: false, svg }; });
document.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (!drag.moved) return;
  const r = drag.svg.getBoundingClientRect(), s2 = Math.max(drag.v.w / r.width, (drag.v.w / 1.6) / r.height);
  S.mapView = { ...drag.v, cx: drag.v.cx - dx * s2, cy: drag.v.cy - dy * s2 }; const W = S.mapView.w, H = W / 1.6; drag.svg.setAttribute("viewBox", `${S.mapView.cx - W / 2} ${S.mapView.cy - H / 2} ${W} ${H}`); });
document.addEventListener("pointerup", async e => { if (!drag) return; const d = drag; drag = null;
  if (d.moved) { lastDrag = Date.now(); render(); return; }
  if (S.pinFor) { const pt = d.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = d.svg.getScreenCTM(); if (!m) return; const q = pt.matrixTransform(m.inverse());
    const lng = +(q.x / MK / SC).toFixed(5), lat = +(-q.y / SC).toFixed(5); const p = S.projects.find(x => x.id === S.pinFor); if (!p) return;
    const body = { ...p, lat, lng, updatedAt: new Date().toISOString() }; delete body.id; S.pinFor = "";
    if (await write("projects/" + p.id, body)) toast("Pin set for " + p.name); render(); } });

function vClients() {
  const groups = {};
  for (const p of S.projects) { const k = (p.client || "(no client name)").trim(); (groups[k] = groups[k] || []).push(p); }
  const rows = Object.entries(groups).map(([c, ps]) => {
    const onb = ps.map(p => p.onboardDate).filter(Boolean).sort()[0];
    return { c, ps, onb, val: ps.reduce((a, p) => a + (+p.contract || 0), 0), contact: ps.map(p => p.contact).find(Boolean) || "" };
  }).sort((a, b) => (b.onb || "").localeCompare(a.onb || ""));
  return `
  <div class="head"><div><h1>Onboarded clients</h1><p class="sub">${rows.length} clients across ${S.projects.length} projects. Click a project to edit it.</p></div>
  <button class="btn primary" data-a="new-project">Add client / project</button></div>
  <div class="card scroll">${rows.length ? `<table><thead><tr><th>Client</th><th>Projects</th><th>Location</th><th>Onboarded</th><th>Contact</th><th class="num">Contract value</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td><b>${esc(r.c)}</b></td><td>${r.ps.map(p => `<div class="row" style="gap:6px;margin-bottom:4px"><a href="#" data-a="edit" data-id="${p.id}">${esc(p.name)}</a>${chip(p.status)}</div>`).join("")}</td>
  <td class="small">${r.ps.map(p => esc(p.location || "—")).join("<br>")}</td><td class="small">${fmtD(r.onb)}</td><td class="small">${esc(r.contact) || "—"}</td><td class="num">${r.val ? peso(r.val) : "—"}</td></tr>`).join("")}
  </tbody></table>` : `<div class="empty">No clients yet. Add your first client and project.</div>`}</div>`;
}

function vPhases() {
  const live = S.projects.filter(p => ["Onboarded", "Ongoing", "On Hold", "Unconfirmed"].includes(p.status));
  const props = S.projects.filter(p => p.status === "Proposal");
  const done = S.projects.filter(p => p.status === "Completed" || p.status === "Terminated");
  const card = p => { const sp = span(p); return `<button class="pc ${isLate(p) ? "late" : ""} ${esc(p.status)}" data-a="edit" data-id="${p.id}"><b>${esc(p.name)}</b><span class="small muted">${esc(p.client || "")}</span>
    <div class="row" style="justify-content:space-between">${chip(p.status)}<span class="small" style="font-family:var(--mono)">${+p.progress || 0}%</span></div><div class="bar"><i style="width:${Math.min(100, +p.progress || 0)}%"></i></div>
    ${p.mobilizationDate && parseD(p.mobilizationDate) >= today() ? `<span class="small"><b>Mobilizes ${fmtD(p.mobilizationDate)}</b></span>` : ""}<span class="small ${isLate(p) ? "neg" : "muted"}">Target ${p.endDate ? fmtD(p.endDate) : "not set"}</span></button>`; };
  const cols = PHASES.map(ph => ({ ph, items: live.filter(p => p.phase === ph) }));
  const noPh = live.filter(p => !p.phase || !PHASES.includes(p.phase));
  return `
  <div class="head"><div><h1>Projects &amp; phases</h1><p class="sub">Where every live project stands, left to right from design to turnover.</p></div>
  <button class="btn primary" data-a="new-project">Add client / project</button></div>
  ${noPh.length ? `<div class="card"><h2>Phase not set (${noPh.length})</h2><div class="board" style="grid-auto-columns:minmax(200px,240px)">${noPh.map(card).join("")}</div></div>` : ""}
  <div class="board">${cols.map(c => `<div class="col"><h3>${esc(c.ph)} <span class="n">${c.items.length}</span></h3>${c.items.map(card).join("")}</div>`).join("")}</div>
  <div class="two">
    <div class="card"><h2>Proposals in the pipeline (${props.length})</h2>${props.length ? `<table><tbody>${props.map(p => `<tr class="click" data-a="edit" data-id="${p.id}"><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.client || "")} · ${esc(p.location || "")}</div></td><td class="num">${p.contract ? peso(p.contract) : "—"}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No open proposals.</div>`}</div>
    <div class="card"><h2>Completed and terminated (${done.length})</h2>${done.length ? `<table><tbody>${done.map(p => `<tr class="click" data-a="edit" data-id="${p.id}"><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.client || "")}</div></td><td class="small muted">${p.status === "Terminated" ? chip("Terminated") : fmtD(p.endDate)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Nothing completed yet.</div>`}</div>
  </div>`;
}

function qCard(q, detail) {
  const cap = +S.settings.capacity || 1, occ = occupancy(q), tent = tentative(q);
  const free = cap - occ.length;
  const cells = Array.from({ length: Math.max(cap, occ.length) }, (_, i) => `<i class="${i < occ.length ? (i >= cap ? "over" : "f") : ""}"></i>`).join("");
  return `<div class="q ${free > 0 ? "open" : "full"}"><div class="ql">${qLabel(q)} <span class="small">${free > 0 ? free + " open" : "Full"}</span></div><div class="slots">${cells}</div>
  ${detail ? `<ul>${occ.map(p => `<li>${esc(p.name)}${span(p).assumed ? " *" : ""}</li>`).join("")}${tent.map(p => `<li><i>${esc(p.name)} (proposal)</i></li>`).join("")}</ul>` : ""}</div>`;
}

function vCapacity() {
  const q0 = qOf(today()), slot = earliestSlot(S.dur);
  const anyAssumed = S.projects.some(p => ACTIVE.has(p.status) && span(p).assumed);
  return `
  <div class="head"><div><h1>When can I take a new project?</h1><p class="sub">LDM takes ${S.settings.capacity} clients per cycle. A project frees its slot once it reaches Finishing, or ${S.settings.releaseMonths} months before its target closeout, whichever comes first.</p></div></div>
  <div class="card">
    <div class="fg">
      <label class="f" for="cap">Clients per cycle<input id="cap" type="number" min="1" max="30" value="${S.settings.capacity}" data-set="capacity"></label>
      <label class="f" for="rel">Open a slot this many months before closeout<input id="rel" type="number" min="0" max="12" value="${S.settings.releaseMonths}" data-set="releaseMonths"></label>
      <label class="f" for="dur">New project duration (months)<input id="dur" type="number" min="1" max="36" value="${S.dur}" data-local="dur"></label>
      <label class="f" for="asm">Assumed duration when no target date (months)<input id="asm" type="number" min="1" max="36" value="${S.settings.assumedMonths}" data-set="assumedMonths"></label>
    </div>
    <div class="answer">${slot === null ? `<b>No opening</b> in the next six years at this capacity.` : `Earliest start for a ${S.dur} month project: <b>${qLabel(slot)}</b> <span class="muted">(from ${qStart(slot).toLocaleDateString("en-PH", { month: "long", year: "numeric" })})</span>`}</div>
  </div>
  <div class="card"><h2>Next 8 quarters</h2>
    <div class="legend"><span style="--c:var(--ink)">Booked</span><span style="--c:var(--good-soft)">Open slot</span><span style="--c:var(--bad)">Over capacity</span></div>
    <div class="qgrid">${Array.from({ length: 8 }, (_, k) => qCard(q0 + k, true)).join("")}</div>
    <p class="small muted">${anyAssumed ? `* No target completion date, so closeout is assumed at ${S.settings.assumedMonths} months from start. ` : ""}Proposals are listed in italics but don't take a slot. Projects already in Finishing, Punchlist or Turnover don't take a slot.</p>
  </div>`;
}

function vCosts() {
  const y = S.costYear;
  const yc = S.costs.filter(c => (c.date || "").startsWith(y + "-") && (!S.costProject || c.projectId === S.costProject));
  const grid = MONTHS.map((m, i) => { const key = y + "-" + String(i + 1).padStart(2, "0"); const row = {}; let t = 0, tc = 0, td = 0; for (const c of yc.filter(c => c.date.startsWith(key))) { const v = +c.amount || 0; if (stageOf(c) === "Design") td += v; else { row[c.category] = (row[c.category] || 0) + v; tc += v; } t += v; } return { m, key, row, t, tc, td }; });
  const yt = grid.reduce((a, r) => a + r.t, 0);
  const max = Math.max(1, ...grid.map(r => r.t));
  const W = 720, H = 200, pl = 56, pb = 24, bw = (W - pl - 10) / 12;
  const ticks = [0, .25, .5, .75, 1].map(f => f * max);
  const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly cost totals for ${y}">
    ${ticks.map(t => { const yy = H - pb - (t / max) * (H - pb - 14); return `<line x1="${pl}" x2="${W - 6}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${pl - 6}" y="${yy + 4}" text-anchor="end">${pesoS(t)}</text>`; }).join("")}
    ${grid.map((r, i) => { const k = (H - pb - 14) / max, hc = r.tc * k, hd = r.td * k, x = pl + 6 + i * bw; return `<rect x="${x}" y="${H - pb - hc}" width="${bw - 10}" height="${Math.max(hc, 0)}" fill="var(--muted)"><title>${r.m} ${y} construction: ${peso(r.tc)}</title></rect><rect x="${x}" y="${H - pb - hc - hd}" width="${bw - 10}" height="${Math.max(hd, 0)}" fill="var(--brand)"><title>${r.m} ${y} design: ${peso(r.td)}</title></rect><text x="${x + (bw - 10) / 2}" y="${H - 6}" text-anchor="middle">${r.m}</text>`; }).join("")}
  </svg>`;
  const base = S.projects.filter(p => p.status !== "Proposal" && (!S.costProject || p.id === S.costProject));
  const direct = base.reduce((a, p) => a + (+p.estCost || 0), 0);
  const pctOf = v => direct ? (v / direct * 100) : null;
  const fmtPct = v => v === null ? "–" : (v < 10 ? v.toFixed(2) : v.toFixed(1)) + "%";
  const priorSpend = S.costs.filter(c => stageOf(c) === "Construction" && (c.date || "") < y + "-01" && (!S.costProject || c.projectId === S.costProject)).reduce((a, c) => a + (+c.amount || 0), 0);
  let run = priorSpend;
  const cum = grid.map(r => (run += r.tc));
  const ytc = grid.reduce((a, r) => a + r.tc, 0), ytd = grid.reduce((a, r) => a + r.td, 0);
  const projRows = base.map(p => { const all = S.costs.filter(c => c.projectId === p.id); const pc = all.filter(c => stageOf(c) === "Construction"); const dc = +p.estCost || 0;
    const design = all.filter(c => stageOf(c) === "Design" && (c.date || "").startsWith(y + "-")).reduce((a, c) => a + (+c.amount || 0), 0);
    const months = MONTHS.map((m, i) => { const key = y + "-" + String(i + 1).padStart(2, "0"); return pc.filter(c => (c.date || "").startsWith(key)).reduce((a, c) => a + (+c.amount || 0), 0); });
    const toDate = pc.filter(c => (c.date || "") < (y + 1) + "-01").reduce((a, c) => a + (+c.amount || 0), 0);
    return { p, dc, months, toDate, design }; });
  const monthList = S.costs.filter(c => (c.date || "").startsWith(S.costMonth) && (!S.costProject || c.projectId === S.costProject)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const years = [...new Set([new Date().getFullYear(), ...S.costs.map(c => +(c.date || "").slice(0, 4)).filter(Boolean)])].sort();
  return `
  <div class="head"><div><h1>Monthly project cost summary</h1><p class="sub">${peso(yt)} spent in ${y} (design ${peso(ytd)}, construction ${peso(ytc)})${S.costProject ? " on " + esc(projName(S.costProject)) : " across all projects"}.</p></div>
  <div class="row">
    <select id="cy" data-local="costYear" aria-label="Year">${years.map(v => `<option ${v === y ? "selected" : ""}>${v}</option>`).join("")}</select>
    <select id="cp" data-local="costProject" aria-label="Project"><option value="">All projects</option>${S.projects.map(p => `<option value="${p.id}" ${p.id === S.costProject ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
    <button class="btn primary" data-a="new-cost">Log a cost</button></div></div>
  <div class="card">${yt ? `<div class="legend"><span style="--c:var(--brand)">Design stage</span><span style="--c:var(--muted)">Construction stage</span></div>` + chart : `<div class="empty">No costs logged for ${y} yet. Log materials, labor and other expenses per project to build this summary.</div>`}</div>
  <div class="card scroll"><div><h2>By month and category</h2><p class="small muted" style="margin:4px 0 0">% accomplishment = month construction cost ÷ computed direct cost × 100. Design stage costs are shown separately and don't count toward construction accomplishment. Direct cost base: ${direct ? peso(direct) : "not set yet (add it in each project)"}${S.costProject ? "" : " for all booked projects"}.</p></div>
  <table><thead><tr><th>Month</th><th class="num" style="color:var(--accent)">Design stage</th>${CATS.map(c => `<th class="num">${esc(c)}</th>`).join("")}<th class="num">Construction total</th><th class="num">% Accomp.</th><th class="num">Cumulative %</th></tr></thead><tbody>
  ${grid.map((r, i) => `<tr class="click" data-a="pick-month" data-m="${r.key}"><td><b>${r.m}</b></td><td class="num ${r.td ? "" : "muted"}">${r.td ? peso(r.td) : "–"}</td>${CATS.map(c => `<td class="num ${r.row[c] ? "" : "muted"}">${r.row[c] ? peso(r.row[c]) : "–"}</td>`).join("")}<td class="num"><b>${r.tc ? peso(r.tc) : "–"}</b></td><td class="num"><b>${r.tc ? fmtPct(pctOf(r.tc)) : "–"}</b></td><td class="num muted">${r.tc || cum[i] ? fmtPct(pctOf(cum[i])) : "–"}</td></tr>`).join("")}
  </tbody><tfoot><tr><td>${y}</td><td class="num">${peso(ytd)}</td>${CATS.map(c => `<td class="num">${peso(grid.reduce((a, r) => a + (r.row[c] || 0), 0))}</td>`).join("")}<td class="num">${peso(ytc)}</td><td class="num">${fmtPct(pctOf(ytc))}</td><td class="num">${fmtPct(pctOf(run))}</td></tr></tfoot></table></div>
  <div class="card scroll"><div><h2>Monthly % accomplishment by project</h2><p class="small muted" style="margin:4px 0 0">Each cell is that month's construction cost ÷ the project's computed direct cost × 100. Hover a cell to see the peso amount.</p></div>
  ${projRows.length ? `<table><thead><tr><th>Project</th><th class="num">Design cost ${y}</th><th class="num">Direct cost</th>${MONTHS.map(m => `<th class="num">${m}</th>`).join("")}<th class="num">${y}</th><th class="num">To date</th></tr></thead><tbody>
  ${projRows.map(r => `<tr><td><b class="click" data-a="edit" data-id="${r.p.id}" style="cursor:pointer">${esc(r.p.name)}</b></td><td class="num ${r.design ? "" : "muted"}">${r.design ? peso(r.design) : "–"}</td><td class="num">${r.dc ? peso(r.dc) : `<span class="muted">add</span>`}</td>
    ${r.months.map(v => { const pc = r.dc && v ? v / r.dc * 100 : null; return `<td class="pctcell ${pc ? "heat" : "muted"}" style="--h:${pc ? Math.min(60, 8 + pc * 2) : 0}%" title="${peso(v)}">${v ? (r.dc ? fmtPct(pc) : pesoS(v)) : "–"}</td>`; }).join("")}
    <td class="pctcell"><b>${r.dc ? fmtPct(r.months.reduce((a, v) => a + v, 0) / r.dc * 100) : "–"}</b></td><td class="pctcell"><b>${r.dc ? fmtPct(r.toDate / r.dc * 100) : "–"}</b><small>${peso(r.toDate)}</small></td></tr>`).join("")}
  </tbody></table>` : `<div class="empty">No booked projects yet.</div>`}</div>
  <div class="card scroll"><div class="row" style="justify-content:space-between"><h2>Entries for ${MONTHS[+S.costMonth.slice(5) - 1]} ${S.costMonth.slice(0, 4)}</h2><input type="month" id="cm" value="${S.costMonth}" data-local="costMonth" aria-label="Month"></div>
  ${monthList.length ? `<table><thead><tr><th>Date</th><th>Project</th><th>Stage</th><th>Category</th><th>Description</th><th>Logged by</th><th class="num">Amount</th></tr></thead><tbody>${monthList.map(c => `<tr class="click" data-a="edit-cost" data-id="${c.id}"><td class="small">${fmtD(c.date)}</td><td>${esc(projName(c.projectId))}</td><td>${stageOf(c) === "Design" ? `<span class="chip">Design</span>` : `<span class="small muted">Construction</span>`}</td><td class="small">${esc(c.category)}</td><td class="small">${esc(c.description || "")}</td><td class="small">${esc(nameOf(c.createdBy))}${c.paidFrom && c.paidFrom !== "company" ? `<div class="muted">${PAID[c.paidFrom]}</div>` : ""}</td><td class="num">${peso(c.amount)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No entries this month. Click a month above or log a cost.</div>`}</div>`;
}

function vCollections() {
  const y = S.colYear;
  const book = S.projects.filter(p => p.status !== "Proposal");
  const rows = book.map(p => ({ p, f: fin(p) }));
  const T = rows.reduce((t, { f }) => { t.c += f.contract; t.k += f.collected; t.dc += f.designC; t.kd += f.collectedD; t.cc += f.constrC; t.kc += f.collectedC; return t; }, { c: 0, k: 0, dc: 0, kd: 0, cc: 0, kc: 0 });
  const mNow = ym(new Date());
  const thisMonth = S.collections.filter(c => (c.date || "").startsWith(mNow)).reduce((a, c) => a + (+c.amount || 0), 0);
  const months = MONTHS.map((m, i) => { const key = y + "-" + String(i + 1).padStart(2, "0");
    const inn = S.collections.filter(c => (c.date || "").startsWith(key)).reduce((a, c) => a + (+c.amount || 0), 0);
    const out = S.costs.filter(c => (c.date || "").startsWith(key)).reduce((a, c) => a + (+c.amount || 0), 0);
    return { m, key, inn, out, net: inn - out }; });
  const yi = months.reduce((a, r) => a + r.inn, 0), yo = months.reduce((a, r) => a + r.out, 0);
  const list = S.collections.filter(c => (c.date || "").startsWith(y + "-")).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const years = [...new Set([new Date().getFullYear(), ...S.collections.map(c => +(c.date || "").slice(0, 4)).filter(Boolean)])].sort();
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const pbar = (a, b) => b ? `<div class="pctrow" style="min-width:120px"><div class="bar"><i style="width:${Math.min(100, pct(a, b))}%"></i></div><span class="small" style="font-family:var(--mono)">${pct(a, b)}%</span></div>` : `<span class="muted small">no contract</span>`;
  return `
  <div class="head"><div><h1>Collections</h1><p class="sub">Every payment received from clients, and what is still to be collected.</p></div>
  <div class="row"><select id="ky" data-local="colYear" aria-label="Year">${years.map(v => `<option ${v === y ? "selected" : ""}>${v}</option>`).join("")}</select><button class="btn primary" data-a="new-col">Record a collection</button></div></div>
  <div class="grid-tiles">
    <div class="tile"><span class="k">Total contract (booked)</span><span class="v">${pesoS(T.c)}</span><span class="h">${book.length} projects</span></div>
    <div class="tile hi"><span class="k">Collected to date</span><span class="v">${pesoS(T.k)}</span><span class="h">${pct(T.k, T.c)}% of contract</span></div>
    <div class="tile"><span class="k">Balance to collect</span><span class="v">${pesoS(T.c - T.k)}</span><span class="h">Design ${pesoS(T.dc - T.kd)} · Construction ${pesoS(T.cc - T.kc)}</span></div>
    <div class="tile"><span class="k">Collected in ${MONTHS[new Date().getMonth()]}</span><span class="v">${pesoS(thisMonth)}</span><span class="h">${S.collections.filter(c => (c.date || "").startsWith(mNow)).length} payments</span></div>
  </div>
  <div class="card scroll"><h2>By project</h2>${rows.length ? `<table><thead><tr><th>Project</th><th class="num">Design contract</th><th class="num">Design collected</th><th class="num">Construction contract</th><th class="num">Construction collected</th><th class="num">Total collected</th><th class="num">Balance</th><th>Collected</th><th></th></tr></thead><tbody>
  ${rows.map(({ p, f }) => `<tr><td><b class="click" data-a="edit" data-id="${p.id}" style="cursor:pointer">${esc(p.name)}</b><div class="small muted">${esc(p.client || "")}</div></td>
    <td class="num">${f.designC ? peso(f.designC) : "–"}</td><td class="num">${f.collectedD ? peso(f.collectedD) : "–"}</td><td class="num">${f.constrC ? peso(f.constrC) : "–"}</td><td class="num">${f.collectedC ? peso(f.collectedC) : "–"}</td>
    <td class="num"><b>${f.collected ? peso(f.collected) : "–"}</b></td><td class="num ${f.receivable < 0 ? "neg" : ""}">${f.contract ? peso(f.receivable) : "–"}</td><td>${pbar(f.collected, f.contract)}</td><td><button class="btn sm" data-a="col-for" data-id="${p.id}">Add</button></td></tr>`).join("")}
  </tbody><tfoot><tr><td>Total</td><td class="num">${peso(T.dc)}</td><td class="num">${peso(T.kd)}</td><td class="num">${peso(T.cc)}</td><td class="num">${peso(T.kc)}</td><td class="num">${peso(T.k)}</td><td class="num">${peso(T.c - T.k)}</td><td>${pbar(T.k, T.c)}</td><td></td></tr></tfoot></table>` : `<div class="empty">No booked projects yet.</div>`}</div>
  <div class="two">
    <div class="card scroll"><h2>Payments received in ${y}</h2>${list.length ? `<table><thead><tr><th>Date</th><th>Project</th><th>For</th><th>Type</th><th>Reference</th><th class="num">Amount</th></tr></thead><tbody>
    ${list.map(c => `<tr class="click" data-a="edit-col" data-id="${c.id}"><td class="small">${fmtD(c.date)}</td><td>${esc(projName(c.projectId))}</td><td>${c.stage === "Design" ? `<span class="chip">Design</span>` : `<span class="small muted">Construction</span>`}</td><td class="small">${esc(c.type || "")}</td><td class="small">${esc(c.reference || "")}</td><td class="num">${peso(c.amount)}</td></tr>`).join("")}
    </tbody></table>` : `<div class="empty">No payments recorded for ${y}. Click Record a collection when a client pays.</div>`}</div>
    ${clientOwedCard()}
    <div class="card scroll"><h2>Cash in vs cash out, ${y}</h2><table><thead><tr><th>Month</th><th class="num">Collected</th><th class="num">Costs</th><th class="num">Net</th></tr></thead><tbody>
    ${months.map(r => `<tr><td>${r.m}</td><td class="num ${r.inn ? "" : "muted"}">${r.inn ? peso(r.inn) : "–"}</td><td class="num ${r.out ? "" : "muted"}">${r.out ? peso(r.out) : "–"}</td><td class="num ${r.net < 0 ? "neg" : r.net > 0 ? "pos" : "muted"}">${r.inn || r.out ? peso(r.net) : "–"}</td></tr>`).join("")}
    </tbody><tfoot><tr><td>${y}</td><td class="num">${peso(yi)}</td><td class="num">${peso(yo)}</td><td class="num ${yi - yo < 0 ? "neg" : ""}">${peso(yi - yo)}</td></tr></tfoot></table></div>
  </div>`;
}

function collectionForm(c) {
  c = c || { date: ymd(new Date()), type: "Downpayment", stage: "Construction", projectId: (S.projects.find(p => p.status !== "Proposal") || {}).id || "" };
  const p = S.projects.find(x => x.id === c.projectId), f = p ? fin(p) : null;
  openModal(`<h2>${c.id ? "Edit collection" : "Record a collection"}</h2>
  <form id="kf" class="fg">
    <label class="f wide" for="k-proj">Project<select id="k-proj" name="projectId" required>${S.projects.filter(x => x.status !== "Proposal").map(x => `<option value="${x.id}" ${x.id === c.projectId ? "selected" : ""}>${esc(x.name)}${x.client ? " · " + esc(x.client) : ""}</option>`).join("")}</select></label>
    <label class="f" for="k-date">Date received<input id="k-date" name="date" type="date" required value="${esc(c.date)}"></label>
    <label class="f" for="k-amt">Amount (₱)<input id="k-amt" name="amount" type="number" min="0" step="0.01" required value="${c.amount || ""}"></label>
    <label class="f" for="k-stage">Payment for<select id="k-stage" name="stage">${["Design", "Construction"].map(x => `<option ${x === (c.stage === "Design" ? "Design" : "Construction") ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <label class="f" for="k-type">Type<select id="k-type" name="type">${PAY_TYPES.map(x => `<option ${x === c.type ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <label class="f" for="k-ref">Reference (OR, check or transfer no.)<input id="k-ref" name="reference" value="${esc(c.reference)}"></label>
    <label class="f" for="k-mode">Paid via<select id="k-mode" name="mode">${["Bank transfer", "Check", "Cash", "GCash", "Other"].map(x => `<option ${x === c.mode ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <label class="f wide" for="k-notes">Notes<input id="k-notes" name="notes" placeholder="e.g. 2nd progress billing, 40% accomplishment" value="${esc(c.notes)}"></label>
  </form>
  ${f && f.contract ? `<p class="small muted">${esc(p.name)}: collected ${peso(f.collected)} of ${peso(f.contract)}. Balance ${peso(f.receivable)}.</p>` : ""}
  <div class="row end"><div>${c.id ? `<button class="btn danger" data-a="del-col" data-id="${c.id}">Delete entry</button>` : ""}</div>
  <div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="save-col" data-id="${c.id || ""}">Save</button></div></div>`);
}

function vProfit() {
  const list = S.projects.filter(p => ["Onboarded", "Ongoing", "On Hold", "Completed", "Terminated", "Proposal"].includes(p.status));
  const order = { Ongoing: 0, Onboarded: 1, "On Hold": 2, Proposal: 3, Completed: 4, Terminated: 5 };
  list.sort((a, b) => order[a.status] - order[b.status]);
  const book = list.filter(p => p.status !== "Proposal");
  const z = { dc: 0, cc: 0, db: 0, dp: 0, cp: 0, c: 0, e: 0, a: 0, da: 0, col: 0, p: 0, r: 0, ap: 0 };
  const T = book.reduce((t, p) => { const f = fin(p); t.dc += f.designC; t.cc += f.constrC; t.db += f.designBasis; t.dp += f.designProfit; t.cp += f.constrProfit; t.c += f.contract; t.e += f.est; t.a += f.actual; t.da += f.designActual; t.col += f.collected; if (f.ok) { t.p += f.profit; t.pc += f.contract; t.pn++; } if (f.est > 0) t.r += f.running; if (p.status === "Completed" || p.status === "Terminated") { t.ap += f.actualProfit; t.apc += f.contract; t.app += f.profit; t.n++; } return t; }, { ...z, apc: 0, app: 0, n: 0, pc: 0, pn: 0 });
  const pipe = list.filter(p => p.status === "Proposal" && fin(p).ok).reduce((a, p) => a + fin(p).profit, 0);
  const pm = (a, b) => b ? Math.round(a / b * 100) + "%" : "–";
  const used = (p, f) => { if (!f.est) return `<span class="muted small">set direct cost</span>`; const u = f.spent / f.est * 100, pr = derive(p).progress;
    return `<div class="ubar" title="Spent ${Math.round(u)}% of direct cost at ${pr}% progress"><div class="bar"><i style="width:${Math.min(100, u)}%;background:${u > 100 ? "var(--bad)" : u > pr + 10 ? "var(--warn)" : "var(--brand)"}"></i></div><s style="left:${Math.min(100, pr)}%"></s></div><span class="small muted">${Math.round(u)}% spent · ${pr}% done</span>`; };
  return `
  <div class="head"><div><h1>Profit</h1><p class="sub">Protected profit = total contract cost minus computed direct cost. Running budget = direct cost minus actual costing (design and construction). Actual profit = protected profit + running budget, and it appears once a project is marked Completed.</p></div></div>
  <div class="grid-tiles">
    <div class="tile"><span class="k">Total contract (booked)</span><span class="v">${pesoS(T.c)}</span><span class="h">Design ${pesoS(T.dc)} · Construction ${pesoS(T.cc)}</span></div>
    <div class="tile"><span class="k">Protected profit</span><span class="v ${T.p < 0 ? "neg" : ""}">${T.pn ? pesoS(T.p) : "–"}</span><span class="h">${T.pn ? pm(T.p, T.pc) + " margin · " + T.pn + " of " + book.length + " projects with direct cost" : "enter direct costs to compute"}</span></div>
    <div class="tile"><span class="k">Running budget</span><span class="v ${T.r < 0 ? "neg" : ""}">${T.e ? pesoS(T.r) : "–"}</span><span class="h">${pesoS(T.e)} direct cost less ${pesoS(T.a + T.da)} spent</span></div>
    <div class="tile hi"><span class="k">Actual profit</span><span class="v ${T.ap < 0 ? "neg" : ""}">${T.n ? pesoS(T.ap) : "–"}</span><span class="h">${T.n ? `${T.n} completed project${T.n > 1 ? "s" : ""} · ${pm(T.ap, T.apc)} margin vs ${pm(T.app, T.apc)} protected` : "shows once a project is completed"}</span></div>
    <div class="tile"><span class="k">Pipeline profit</span><span class="v">${pipe ? pesoS(pipe) : "–"}</span><span class="h">if proposals sign</span></div>
  </div>
  <div class="card scroll"><h2>Protected vs actual profit</h2><table><thead><tr><th>Project</th><th class="num">Total contract</th><th class="num">Direct cost</th><th class="num">Protected profit</th><th class="num">Actual costing</th><th class="num">Running budget</th><th class="num">Actual profit</th><th class="num">Margin</th><th>Budget used vs progress</th></tr></thead><tbody>
  ${list.map(p => { const f = fin(p); const cc = f.est + f.designBasis; return `<tr class="click" data-a="edit" data-id="${p.id}"><td><b>${esc(p.name)}</b><div class="row" style="gap:6px;margin-top:3px">${chip(p.status)}</div></td>
    <td class="num"><b>${f.contract ? peso(f.contract) : `<span class="muted">add</span>`}</b>${f.designC ? `<div class="small muted">D ${pesoS(f.designC)} · C ${pesoS(f.constrC)}</div>` : ""}</td>
    <td class="num">${f.est ? peso(f.est) : "–"}</td>
    <td class="num ${f.ok ? (f.profit < 0 ? "neg" : "pos") : ""}">${f.ok ? peso(f.profit) : `<span class="small muted">set direct cost</span>`}</td>
    <td class="num">${f.actual ? peso(f.actual) : "–"}${f.designActual ? `<div class="small muted">+ design ${pesoS(f.designActual)}</div>` : ""}</td>
    <td class="num ${f.running < 0 ? "neg" : ""}"><b>${f.est ? peso(f.running) : "–"}</b></td>
    ${p.status === "Completed" || p.status === "Terminated" ? `<td class="num ${f.contract ? (f.actualProfit < 0 ? "neg" : "pos") : ""}"><b>${f.contract ? peso(f.actualProfit) : "–"}</b></td>
    <td class="num small">${f.contract ? `${f.ok ? pm(f.profit, f.contract) + " → " : ""}<b>${pm(f.actualProfit, f.contract)}</b>` : "–"}</td>` : `<td class="num small muted">at completion</td><td class="num small">${f.ok ? pm(f.profit, f.contract) : "–"}</td>`}
    <td style="min-width:170px">${used(p, f)}</td></tr>`; }).join("")}
  </tbody><tfoot><tr><td>Booked total</td><td class="num">${peso(T.c)}</td><td class="num">${peso(T.e)}</td><td class="num">${T.pn ? peso(T.p) : "–"}</td><td class="num">${peso(T.a + T.da)}</td><td class="num">${T.e ? peso(T.r) : "–"}</td><td class="num">${T.n ? peso(T.ap) : "–"}</td><td class="num small">${T.pn ? pm(T.p, T.pc) : "–"}</td><td></td></tr></tfoot></table>
  <p class="small muted">Actual profit shows only for completed projects, when the running budget is final. While work is ongoing, use the budget bar to check spending against progress: the dark tick marks % progress, and the bar turns amber when spending runs more than 10 points ahead of it and red when it goes over the direct cost.</p></div>`;
}

/* ---------- modals ---------- */
function openModal(html) { document.getElementById("modal").innerHTML = html; document.getElementById("overlay").classList.add("on"); const f = document.querySelector("#modal input, #modal select"); if (f) f.focus(); }
function closeModal() { document.getElementById("overlay").classList.remove("on"); }

function projectForm(p) {
  p = p || { status: "Onboarded", onboardDate: ymd(new Date()), progress: 0 };
  const opt = (arr, v) => arr.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
  openModal(`<h2>${p.id ? "Edit project" : "Add client / project"}</h2>
  <form id="pf" class="fg">
    <label class="f wide" for="f-name">Project name<input id="f-name" name="name" required value="${esc(p.name)}"></label>
    <label class="f" for="f-client">Client<input id="f-client" name="client" value="${esc(p.client)}"></label>
    <label class="f" for="f-contact">Contact (phone or email)<input id="f-contact" name="contact" value="${esc(p.contact)}"></label>
    <label class="f wide" for="f-scope">Scope<input id="f-scope" name="scope" placeholder="e.g. 145 sqm two storey residential" value="${esc(p.scope)}"></label>
    <label class="f wide" for="f-loc">Location<input id="f-loc" name="location" value="${esc(p.location)}"></label>
    <label class="f" for="f-status">Status<select id="f-status" name="status">${opt(STATUSES, p.status)}</select></label>
    <label class="f" for="f-onb">Onboarded<input id="f-onb" name="onboardDate" type="date" value="${esc(p.onboardDate)}"></label>
    <label class="f" for="f-start">Start date (design or works)<input id="f-start" name="startDate" type="date" value="${esc(p.startDate)}"></label>
    <label class="f" for="f-mob">Site mobilization<input id="f-mob" name="mobilizationDate" type="date" value="${esc(p.mobilizationDate)}"></label>
    <label class="f" for="f-end">Target completion<input id="f-end" name="endDate" type="date" value="${esc(p.endDate)}"></label>
    <div class="sec">Project cost</div>
    ${(() => { const f0 = fin(p); return `<label class="f" for="f-dcon">Design contract cost (₱)<input id="f-dcon" name="designContract" type="number" min="0" step="0.01" value="${f0.designC || ""}"></label>
    <label class="f" for="f-ccon">Construction contract cost (₱)<input id="f-ccon" name="constructionContract" type="number" min="0" step="0.01" value="${f0.constrC || ""}"></label>`; })()}
    <label class="f" for="f-dcost">Computed design cost (₱)<input id="f-dcost" name="designCost" type="number" min="0" step="0.01" value="${p.designCost || ""}" placeholder="${p.id && stageCost(p.id, "Design") ? "Actual so far " + peso(stageCost(p.id, "Design")) : ""}"></label>
    <label class="f" for="f-est">Computed direct cost, construction (₱)<input id="f-est" name="estCost" type="number" min="0" step="0.01" value="${p.estCost || ""}"></label>
    ${p.id ? `<div class="f" style="font-size:13px"><span class="muted" style="font-weight:600">Collected so far</span><b style="font:700 18px var(--display)">${peso(fin(p).collected)}</b><button type="button" class="btn sm" data-a="col-for" data-id="${p.id}">Record a collection</button></div>` : ""}
    <div class="calc" id="f-calc"></div>
    <div class="sec">Progress per phase</div>
    <div class="phform">${(() => { const d0 = derive(p); return PHASES.map((ph, i) => { const na = (p.phasesNA || []).includes(ph); const v = p.phaseProgress ? phasePct(p, ph) : (i < PHASES.indexOf(d0.phase) ? 100 : 0);
      return `<div class="r ${na ? "na" : ""}"><span>${esc(ph)}</span><input type="range" min="0" max="100" step="5" value="${v}" id="fp-${i}" data-fp="${i}" aria-label="${esc(ph)} progress"><input type="number" min="0" max="100" value="${v}" id="fn-${i}" data-fn="${i}" aria-label="${esc(ph)} percent"><label class="small"><input type="checkbox" id="fa-${i}" data-fa="${i}" ${na ? "" : "checked"}> Applies</label></div>`; }).join(""); })()}</div>
    <label class="f wide" for="f-notes">Notes<textarea id="f-notes" name="notes" rows="3">${esc(p.notes)}</textarea></label>
  </form>
  ${p.id ? `<p class="small muted">Actual cost logged: design ${peso(stageCost(p.id, "Design"))}, construction ${peso(stageCost(p.id, "Construction"))}, across ${S.costs.filter(c => c.projectId === p.id).length} entries.</p>` : ""}
  <div class="row end"><div class="row">${p.id ? `<button class="btn danger" data-a="del-project" data-id="${p.id}">Delete project</button><button class="btn" data-a="cost-for" data-id="${p.id}">Log a cost for this project</button>` : ""}</div>
  <div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="save-project" data-id="${p.id || ""}">Save</button></div></div>`);
  updateCalc();
}
function updateCalc() {
  const box = document.getElementById("f-calc"); if (!box) return;
  const dc = +document.getElementById("f-dcon").value || 0, cc = +document.getElementById("f-ccon").value || 0, c = dc + cc, e = +document.getElementById("f-est").value || 0, pr = c - e;
  box.innerHTML = `<div><span>Total contract cost</span><b>${peso(c)}</b><span>Design ${pesoS(dc)} · Construction ${pesoS(cc)}</span></div><div><span>Computed direct cost</span><b>${peso(e)}</b></div><div><span>Protected profit</span>${c && e ? `<b class="${pr < 0 ? "neg" : "pos"}">${peso(pr)}</b><span>${Math.round(pr / c * 100)}% of contract</span>` : `<b class="muted">–</b><span>shows once contract and direct cost are entered</span>`}</div>`;
}

function costForm(c) {
  if (!c) { const pid = S.costProject || (S.projects.find(p => p.status === "Ongoing") || S.projects.find(p => p.status !== "Proposal") || {}).id || ""; const pp = S.projects.find(p => p.id === pid) || {};
    const st = ["Design", "Permitting"].includes(derive(pp).phase) ? "Design" : "Construction"; c = { date: ymd(new Date()), stage: st, category: st === "Design" ? DESIGN_CATS[0] : CATS[0], projectId: pid }; }
  const st0 = stageOf(c), cats0 = st0 === "Design" ? DESIGN_CATS : CATS;
  openModal(`<h2>${c.id ? "Edit cost entry" : "Log a cost"}</h2>
  <form id="cf" class="fg">
    <label class="f wide" for="c-proj">Project<select id="c-proj" name="projectId" required>${S.projects.filter(p => p.status !== "Proposal").map(p => `<option value="${p.id}" ${p.id === c.projectId ? "selected" : ""}>${esc(p.name)}${p.client ? " · " + esc(p.client) : ""}</option>`).join("")}</select></label>
    <label class="f" for="c-date">Date<input id="c-date" name="date" type="date" required value="${esc(c.date)}"></label>
    <label class="f" for="c-paid">Paid from<select id="c-paid" name="paidFrom">${[["company", "Company"], ["petty_cash", "Petty cash"], ["out_of_pocket", "Out of pocket"], ["client", "Paid by client (LDM reimburses)"]].map(([v, t]) => `<option value="${v}" ${v === (c.paidFrom || "company") ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="f" for="c-stage">Stage<select id="c-stage" name="stage">${STAGES.map(x => `<option ${x === st0 ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <label class="f" for="c-cat">Category<select id="c-cat" name="category">${(cats0.includes(c.category) ? cats0 : [c.category, ...cats0]).map(x => `<option ${x === c.category ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
    <label class="f" for="c-amt">Amount (₱)<input id="c-amt" name="amount" type="number" min="0" step="0.01" required value="${c.amount || ""}"></label>
    <label class="f wide" for="c-desc">Description<input id="c-desc" name="description" placeholder="${st0 === "Design" ? "e.g. architect fee, soil test, blueprint printing" : "e.g. 200 bags cement, week 3 payroll"}" value="${esc(c.description)}"></label>
  </form>
  <div class="row end"><div>${c.id ? `<button class="btn danger" data-a="del-cost" data-id="${c.id}">Delete entry</button>` : ""}</div>
  <div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="save-cost" data-id="${c.id || ""}">Save</button></div></div>`);
}

/* ---------- data ---------- */
function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2600); }

/* ---------- events ---------- */
document.addEventListener("click", async ev => {
  if (Date.now() - lastDrag < 300) return;
  const el = ev.target.closest("[data-a]"); if (!el) { if (ev.target.id === "overlay") closeModal(); return; }
  const a = el.dataset.a, id = el.dataset.id;
  if (el.tagName === "A") ev.preventDefault();
  if (a === "new-project") projectForm();
  else if (a === "edit") { if (ROLE !== "owner") return; projectForm(S.projects.find(p => p.id === id)); }
  else if (a === "new-cost") { if (!S.projects.some(p => p.status !== "Proposal")) { toast("Add a project first."); return; } costForm(); }
  else if (a === "edit-cost") costForm(S.costs.find(c => c.id === id));
  else if (a === "cost-for") { const pp = S.projects.find(p => p.id === id) || {}; const st = ["Design", "Permitting"].includes(derive(pp).phase) ? "Design" : "Construction"; costForm({ date: ymd(new Date()), stage: st, category: st === "Design" ? DESIGN_CATS[0] : CATS[0], projectId: id }); }
  else if (a === "close") closeModal();
  else if (a === "map-zin" || a === "map-zout") { const v = S.mapView || fitView(); S.mapView = { ...v, w: Math.max(0.02 * SC, Math.min(8 * SC, v.w * (a === "map-zin" ? 0.6 : 1.6))) }; render(); }
  else if (a === "map-fit") { S.mapView = null; render(); }
  else if (a === "pin-set") { S.pinFor = id; render(); }
  else if (a === "pin-cancel") { S.pinFor = ""; render(); }
  else if (a === "pick-month") { S.costMonth = el.dataset.m; render(); }
  else if (a === "save-project") {
    const f = document.getElementById("pf"); if (!f.reportValidity()) return;
    const d = formData("pf"); ["designContract", "constructionContract", "designCost", "estCost"].forEach(k => d[k] = d[k] === "" ? 0 : +d[k]);
    d.contract = d.designContract + d.constructionContract;
    const pp = {}, na = [];
    PHASES.forEach((ph, i) => { pp[ph] = Math.max(0, Math.min(100, +document.getElementById("fn-" + i).value || 0)); if (!document.getElementById("fa-" + i).checked) na.push(ph); });
    if (d.status === "Completed") applicable({ phasesNA: na }).forEach(ph => pp[ph] = 100);
    d.phaseProgress = pp; d.phasesNA = na; Object.assign(d, derive(d));
    const prev = S.projects.find(p => p.id === id) || {}; Object.keys(prev).forEach(k => { if (!(k in d) && k !== "id") d[k] = prev[k]; });
    const pid = id || newId("p"); d.updatedAt = new Date().toISOString();
    el.disabled = true; if (await write("projects/" + pid, d)) { closeModal(); toast("Project saved"); } el.disabled = false;
  }
  else if (a === "save-cost") {
    const f = document.getElementById("cf"); if (!f.reportValidity()) return;
    const d = formData("cf"); d.amount = +d.amount || 0;
    el.disabled = true; if (await write("costs/" + (id || newId("c")), d)) { closeModal(); toast("Cost saved"); if (d.date) { S.costMonth = d.date.slice(0, 7); S.costYear = +d.date.slice(0, 4); } } el.disabled = false;
  }
  else if (a === "new-col") { if (!S.projects.some(p => p.status !== "Proposal")) { toast("Add a project first."); return; } collectionForm(); }
  else if (a === "edit-col") collectionForm(S.collections.find(c => c.id === id));
  else if (a === "col-for") collectionForm({ projectId: id, date: ymd(new Date()), type: "Downpayment", stage: "Construction" });
  else if (a === "save-col") {
    const f = document.getElementById("kf"); if (!f.reportValidity()) return;
    const d = formData("kf"); d.amount = +d.amount || 0;
    el.disabled = true; if (await write("collections/" + (id || newId("k")), d)) { closeModal(); toast("Collection recorded"); if (d.date) S.colYear = +d.date.slice(0, 4); } el.disabled = false;
  }
  else if (a === "del-project" || a === "del-cost" || a === "del-col") {
    if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Click again to delete"; setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = a === "del-project" ? "Delete project" : "Delete entry"; } }, 4000); return; }
    if (await write(({ "del-project": "projects/", "del-cost": "costs/", "del-col": "collections/" })[a] + id, null, true)) { closeModal(); toast("Deleted"); }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("dcard")) { e.preventDefault(); e.target.click(); } });
document.addEventListener("input", e => { const t = e.target;
  if (t.dataset.php) { t.style.setProperty("--v", t.value + "%"); const v = document.getElementById(t.id + "-v"); if (v) v.textContent = t.value + "%"; }
  if (t.dataset.fp) document.getElementById("fn-" + t.dataset.fp).value = t.value;
  if (t.dataset.fn) document.getElementById("fp-" + t.dataset.fn).value = t.value;
  if (t.dataset.fa) t.closest(".r").classList.toggle("na", !t.checked);
  if (t.id === "c-stage") { const cats = t.value === "Design" ? DESIGN_CATS : CATS; document.getElementById("c-cat").innerHTML = cats.map(x => `<option>${esc(x)}</option>`).join(""); document.getElementById("c-desc").placeholder = t.value === "Design" ? "e.g. architect fee, soil test, blueprint printing" : "e.g. 200 bags cement, week 3 payroll"; }
  if (t.id === "f-dcost" || t.id === "f-dcon" || t.id === "f-ccon" || t.id === "f-est") updateCalc();
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.local) { const k = t.dataset.local; S[k] = (k === "costYear" || k === "colYear" || k === "dur") ? (+t.value || S[k]) : t.value; render(); }
  if (t.dataset.php) { const [pid, ph] = t.dataset.php.split("|"); const p = S.projects.find(x => x.id === pid); if (!p) return;
    const d0 = derive(p); const pp = p.phaseProgress ? { ...p.phaseProgress } : Object.fromEntries(PHASES.map((x, i) => [x, i < PHASES.indexOf(d0.phase) ? 100 : 0]));
    pp[ph] = +t.value; const d = { ...p, phaseProgress: pp, updatedAt: new Date().toISOString() }; delete d.id; Object.assign(d, derive(d));
    if (await write("projects/" + pid, d)) toast(`${ph} set to ${t.value}%. ${p.name} is ${d.progress}% overall.`); return; }
  if (t.dataset.set) { const v = Math.max(t.dataset.set === "releaseMonths" ? 0 : 1, +t.value || 0); if (v !== +S.settings[t.dataset.set]) { S.settings = { ...S.settings, [t.dataset.set]: v }; render(); await write("settings/main", S.settings); } }
});

