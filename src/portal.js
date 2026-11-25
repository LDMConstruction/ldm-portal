/* ================================================================
   LDM Portal: sign in, roles, data layer and the employee / client screens.
   Loaded after the shared project views (views.js).
   ================================================================ */
let sb = null, ME = null, ROLE = null;
const IS = r => ROLE === r;
const nz = v => (v === "" || v === undefined ? null : v);
const num = v => (v === "" || v == null || isNaN(+v) ? 0 : +v);
Object.assign(S, { billings: [], viewBilling: null, petty: [], reports: [], profiles: [], members: [], names: {}, summary: [], photoCache: {}, runMonth: ym(new Date()), viewReport: null, reportFilter: "" });

/* ---------- mapping between the database and the screens ---------- */
function fromProject(r, f) {
  f = f || {};
  const dc = num(f.design_contract), cc = num(f.construction_contract);
  const pp = r.phase_progress && Object.keys(r.phase_progress).length ? r.phase_progress : null;
  return { id: r.id, name: r.name, client: r.client_name || "", contact: r.contact || "", scope: r.scope || "", location: r.location || "",
    status: r.status, phase: r.phase || "", progress: r.progress || 0, phaseProgress: pp, phasesNA: r.phases_na || [],
    onboardDate: r.onboard_date || "", startDate: r.start_date || "", mobilizationDate: r.mobilization_date || "", endDate: r.end_date || "",
    lat: r.lat, lng: r.lng, notes: r.notes || "",
    designContract: dc, constructionContract: cc, contract: dc + cc, designCost: num(f.design_cost), estCost: num(f.direct_cost) };
}
function toProject(d) {
  return { name: d.name, client_name: d.client || "", contact: d.contact || "", scope: d.scope || "", location: d.location || "",
    status: d.status || "Onboarded", phase: d.phase || "", progress: num(d.progress), phase_progress: d.phaseProgress || {}, phases_na: d.phasesNA || [],
    onboard_date: nz(d.onboardDate), start_date: nz(d.startDate), mobilization_date: nz(d.mobilizationDate), end_date: nz(d.endDate),
    lat: d.lat === "" || d.lat == null ? null : +d.lat, lng: d.lng === "" || d.lng == null ? null : +d.lng, notes: d.notes || "" };
}
function toFinance(d) {
  const design = num(d.designContract);
  const constr = d.constructionContract !== undefined && d.constructionContract !== "" ? num(d.constructionContract) : Math.max(0, num(d.contract) - design);
  return { design_contract: design, construction_contract: constr, design_cost: num(d.designCost), direct_cost: num(d.estCost) };
}
const fromCost = r => ({ id: r.id, projectId: r.project_id, date: r.date, stage: r.stage, category: r.category, amount: num(r.amount), description: r.description || "", paidFrom: r.paid_from, reimbursed: r.reimbursed, createdBy: r.created_by });
const fromCol = r => ({ id: r.id, projectId: r.project_id, date: r.date, amount: num(r.amount), stage: r.stage, type: r.type, reference: r.reference || "", mode: r.mode, notes: r.notes || "" });
const fromPetty = r => ({ id: r.id, employeeId: r.employee_id, projectId: r.project_id, date: r.date, amount: num(r.amount), note: r.note || "", createdBy: r.created_by });

async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

async function loadAll() {
  const [projects, settings] = await Promise.all([
    q(sb.from("projects").select("*").order("created_at")),
    q(sb.from("settings").select("*").maybeSingle())
  ]);
  if (settings) S.settings = { capacity: settings.capacity, assumedMonths: settings.assumed_months, releaseMonths: settings.release_months };
  let fins = [];
  S.costs = []; S.collections = []; S.petty = []; S.reports = []; S.summary = []; S.billings = [];
  if (IS("owner")) {
    const [f, c, k, p, r, pr, m, bl, pp, ms] = await Promise.all([
      q(sb.from("project_finance").select("*")), q(sb.from("costs").select("*").order("date", { ascending: false })),
      q(sb.from("collections").select("*")), q(sb.from("petty_cash").select("*").order("date", { ascending: false })),
      q(sb.from("reports").select("*").order("week_start", { ascending: false })), q(sb.from("profiles").select("*").order("created_at")),
      q(sb.from("project_members").select("*")), q(sb.from("progress_billings").select("*").order("billing_no")),
      q(sb.from("proposals").select("*").order("created_at", { ascending: false })), q(sb.from("project_milestones").select("*").order("sort"))]);
    S.proposals = pp; S.milestones = ms; S.billings = bl; fins = f; S.costs = c.map(fromCost); S.collections = k.map(fromCol); S.petty = p.map(fromPetty); S.reports = r; S.profiles = pr; S.members = m;
    S.names = Object.fromEntries(pr.map(x => [x.id, x.full_name || (x.email || "").split("@")[0]]));
  } else if (IS("employee")) {
    const [c, p, r, m, n] = await Promise.all([
      q(sb.from("costs").select("*").order("date", { ascending: false })), q(sb.from("petty_cash").select("*").order("date", { ascending: false })),
      q(sb.from("reports").select("*").order("week_start", { ascending: false })), q(sb.from("project_members").select("*")), q(sb.rpc("people_names"))]);
    S.costs = c.map(fromCost); S.petty = p.map(fromPetty); S.reports = r; S.members = m; S.names = Object.fromEntries(n.map(x => [x.id, x.full_name]));
  } else if (IS("client")) {
    const [sum, k, r, n, bl, cc, ms, cp] = await Promise.all([q(sb.rpc("client_summary")), q(sb.from("collections").select("*").order("date", { ascending: false })),
      q(sb.from("reports").select("*").order("week_start", { ascending: false })), q(sb.rpc("people_names")),
      q(sb.from("progress_billings").select("*").order("billing_no")), q(sb.from("costs").select("*").order("date", { ascending: false })),
      q(sb.from("project_milestones").select("*").order("sort")), q(sb.rpc("client_proposals"))]);
    S.milestones = ms; S.clientProposals = cp; S.billings = bl; S.costs = cc.map(fromCost); S.summary = sum; S.collections = k.map(fromCol); S.reports = r; S.names = Object.fromEntries(n.map(x => [x.id, x.full_name]));
  }
  S.projects = projects.map(p => fromProject(p, fins.find(f => f.project_id === p.id)));
  S.loaded = true;
}

function friendly(e) {
  const m = (e && (e.message || e.error_description)) || "Something went wrong.";
  if (/row-level security|permission/i.test(m)) return "Your account isn't allowed to make that change.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  return m;
}

async function write(path, data, del) {
  const [col, id] = path.split("/");
  try {
    if (col === "settings") {
      await q(sb.from("settings").update({ capacity: data.capacity, assumed_months: data.assumedMonths, release_months: data.releaseMonths }).eq("id", 1));
    } else if (col === "projects") {
      if (del) await q(sb.from("projects").delete().eq("id", id));
      else if (IS("owner")) {
        await q(sb.from("projects").upsert({ id, ...toProject(data) }));
        await q(sb.from("project_finance").upsert({ project_id: id, ...toFinance(data) }));
      } else {
        await q(sb.from("projects").update({ phase: data.phase || "", progress: num(data.progress), phase_progress: data.phaseProgress || {}, phases_na: data.phasesNA || [] }).eq("id", id));
      }
    } else if (col === "costs") {
      if (del) await q(sb.from("costs").delete().eq("id", id));
      else await q(sb.from("costs").upsert({ id, project_id: data.projectId, date: data.date, stage: data.stage === "Design" ? "Design" : "Construction",
        category: data.category, amount: num(data.amount), description: data.description || "", paid_from: data.paidFrom || (IS("owner") ? "company" : "petty_cash") }));
    } else if (col === "collections") {
      if (del) await q(sb.from("collections").delete().eq("id", id));
      else await q(sb.from("collections").upsert({ id, project_id: data.projectId, date: data.date, amount: num(data.amount), stage: data.stage === "Design" ? "Design" : "Construction",
        type: data.type, reference: data.reference || "", mode: data.mode, notes: data.notes || "" }));
    } else if (col === "petty") {
      if (del) await q(sb.from("petty_cash").delete().eq("id", id));
      else await q(sb.from("petty_cash").upsert({ id, employee_id: data.employeeId || ME.id, project_id: nz(data.projectId), date: data.date, amount: num(data.amount), note: data.note || "" }));
    }
    await loadAll(); render();
    return true;
  } catch (e) { toast(friendly(e)); return false; }
}
function newId() { return (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2)); }
function localApply() {}
function formData(id) { const o = {}; new FormData(document.getElementById(id)).forEach((v, k) => o[k] = typeof v === "string" ? v.trim() : v); return o; }
const nameOf = id => (id && S.names[id]) || "—";
function memberIds(pid, role) { return S.members.filter(m => m.project_id === pid).map(m => m.user_id).filter(uid => !role || (S.profiles.find(p => p.id === uid) || {}).role === role); }

/* ---------- employee: running cost and petty cash ---------- */
function pettyTotals(empId) {
  const mine = c => !empId || c.createdBy === empId;
  const rec = S.petty.filter(p => !empId || p.employeeId === empId).reduce((a, p) => a + p.amount, 0);
  const spent = S.costs.filter(c => mine(c) && c.paidFrom === "petty_cash").reduce((a, c) => a + c.amount, 0);
  const oop = S.costs.filter(c => mine(c) && c.paidFrom === "out_of_pocket" && !c.reimbursed).reduce((a, c) => a + c.amount, 0);
  return { rec, spent, hand: rec - spent, oop };
}
const PAID = { petty_cash: "Petty cash", out_of_pocket: "Out of pocket", company: "Company", client: "Paid by client" };

function vRunning() {
  const t = pettyTotals(IS("owner") ? ME.id : null);
  const m = S.runMonth;
  const list = S.costs.filter(c => (c.date || "").startsWith(m) && (IS("owner") ? c.createdBy === ME.id : true)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const byCat = {}; list.forEach(c => { const k = (c.stage === "Design" ? "Design · " : "") + c.category; byCat[k] = (byCat[k] || 0) + c.amount; });
  const monthTotal = list.reduce((a, c) => a + c.amount, 0);
  const recv = S.petty.filter(p => IS("owner") ? p.employeeId === ME.id : true);
  return `
  <div class="head"><div><h1>Running cost</h1><p class="sub">Log every expense on site by category. Petty cash on hand is what you received less what you spent from it.</p></div>
  <div class="row"><button class="btn" data-a="new-petty">Record cash received</button><button class="btn primary" data-a="new-exp">Log an expense</button></div></div>
  <div class="grid-tiles">
    <div class="tile"><span class="k">Petty cash received</span><span class="v">${peso(t.rec)}</span><span class="h">${recv.length} release${recv.length === 1 ? "" : "s"}</span></div>
    <div class="tile"><span class="k">Spent from petty cash</span><span class="v">${peso(t.spent)}</span><span class="h">all projects</span></div>
    <div class="tile hi"><span class="k">Cash on hand</span><span class="v ${t.hand < 0 ? "neg" : ""}">${peso(t.hand)}</span><span class="h">${t.hand < 0 ? "spent more than received" : "petty cash left"}</span></div>
    <div class="tile"><span class="k">Out of pocket</span><span class="v">${peso(t.oop)}</span><span class="h">to be reimbursed to you</span></div>
  </div>
  <div class="two">
    <div class="card scroll"><div class="row" style="justify-content:space-between"><h2>Expenses for ${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</h2><input type="month" id="rm" value="${m}" data-local="runMonth" aria-label="Month"></div>
      ${list.length ? `<table><thead><tr><th>Date</th><th>Project</th><th>Category</th><th>Description</th><th>Paid from</th><th class="num">Amount</th></tr></thead><tbody>
      ${list.map(c => `<tr class="${c.reimbursed ? "" : "click"}" ${c.reimbursed ? "" : `data-a="edit-exp" data-id="${c.id}"`}><td class="small">${fmtD(c.date)}</td><td>${esc(projName(c.projectId))}</td><td class="small">${c.stage === "Design" ? `<span class="chip">Design</span> ` : ""}${esc(c.category)}</td><td class="small">${esc(c.description)}</td>
        <td class="small">${PAID[c.paidFrom] || ""}${c.paidFrom === "out_of_pocket" || c.paidFrom === "client" ? (c.reimbursed ? ` <span class="chip Ongoing">Reimbursed</span>` : ` <span class="chip Proposal">Pending</span>`) : ""}</td><td class="num">${peso(c.amount)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="5">Total</td><td class="num">${peso(monthTotal)}</td></tr></tfoot></table>` : `<div class="empty">No expenses logged this month.</div>`}
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card"><h2>By category this month</h2>${Object.keys(byCat).length ? `<table><tbody>${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${peso(v)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Nothing yet.</div>`}</div>
      <div class="card"><h2>Petty cash received</h2>${recv.length ? `<table><tbody>${recv.slice(0, 12).map(p => `<tr class="click" data-a="edit-petty" data-id="${p.id}"><td class="small">${fmtD(p.date)}</td><td class="small">${esc(p.note || (p.projectId ? projName(p.projectId) : ""))}</td><td class="num">${peso(p.amount)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No petty cash recorded yet.</div>`}</div>
    </div>
  </div>`;
}

function expenseForm(c) {
  const projs = S.projects.filter(p => p.status !== "Proposal" && p.status !== "Completed");
  if (!projs.length) { toast("You're not assigned to a project yet."); return; }
  c = c || { date: ymd(new Date()), stage: "Construction", category: CATS[0], projectId: projs[0].id, paidFrom: "petty_cash" };
  const st0 = c.stage === "Design" ? "Design" : "Construction", cats = st0 === "Design" ? DESIGN_CATS : CATS;
  openModal(`<h2>${c.id ? "Edit expense" : "Log an expense"}</h2>
  <form id="xf" class="fg">
    <label class="f wide" for="x-proj">Project<select id="x-proj" name="projectId" required>${projs.map(p => `<option value="${p.id}" ${p.id === c.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="f" for="x-date">Date<input id="x-date" name="date" type="date" required value="${esc(c.date)}"></label>
    <label class="f" for="x-amt">Amount (₱)<input id="x-amt" name="amount" type="number" min="0" step="0.01" required value="${c.amount || ""}"></label>
    <label class="f" for="c-stage">Stage<select id="c-stage" name="stage">${STAGES.map(x => `<option ${x === st0 ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <label class="f" for="c-cat">Category<select id="c-cat" name="category">${(cats.includes(c.category) ? cats : [c.category, ...cats]).map(x => `<option ${x === c.category ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
    <label class="f" for="x-paid">Paid from<select id="x-paid" name="paidFrom">${[["petty_cash", "Petty cash"], ["out_of_pocket", "Out of pocket (my own money)"], ["company", "Paid by the company"], ["client", "Paid by the client (LDM reimburses)"]].map(([v, t]) => `<option value="${v}" ${v === (c.paidFrom || "petty_cash") ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="f wide" for="c-desc">Description<input id="c-desc" name="description" placeholder="e.g. 20 bags cement, tricycle for deliveries" value="${esc(c.description)}"></label>
  </form>
  <div class="row end"><div>${c.id ? `<button class="btn danger" data-a="del-exp" data-id="${c.id}">Delete entry</button>` : ""}</div>
  <div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="save-exp" data-id="${c.id || ""}">Save</button></div></div>`);
}

function pettyForm(e) {
  const emps = S.profiles.filter(p => p.role === "employee");
  if (IS("owner") && !emps.length) { toast("Add an employee in Team & Access first."); return; }
  e = e || { date: ymd(new Date()), employeeId: IS("owner") ? (emps[0] || {}).id : ME.id };
  const projs = S.projects.filter(p => p.status !== "Proposal");
  openModal(`<h2>${e.id ? "Edit petty cash" : IS("owner") ? "Give petty cash" : "Record petty cash received"}</h2>
  <form id="pcf" class="fg">
    ${IS("owner") ? `<label class="f wide" for="pc-emp">Employee<select id="pc-emp" name="employeeId">${emps.map(p => `<option value="${p.id}" ${p.id === e.employeeId ? "selected" : ""}>${esc(p.full_name || p.email)}</option>`).join("")}</select></label>` : ""}
    <label class="f" for="pc-date">Date received<input id="pc-date" name="date" type="date" required value="${esc(e.date)}"></label>
    <label class="f" for="pc-amt">Amount (₱)<input id="pc-amt" name="amount" type="number" min="1" step="0.01" required value="${e.amount || ""}"></label>
    <label class="f wide" for="pc-proj">For project (optional)<select id="pc-proj" name="projectId"><option value="">Any project</option>${projs.map(p => `<option value="${p.id}" ${p.id === e.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="f wide" for="pc-note">Note<input id="pc-note" name="note" placeholder="e.g. Received from Engr. Miranda via GCash" value="${esc(e.note)}"></label>
  </form>
  <div class="row end"><div>${e.id ? `<button class="btn danger" data-a="del-petty" data-id="${e.id}">Delete entry</button>` : ""}</div>
  <div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="save-petty" data-id="${e.id || ""}">Save</button></div></div>`);
}

/* ---------- owner: petty cash and reimbursements ---------- */
function vPetty() {
  const emps = S.profiles.filter(p => p.role === "employee");
  const oop = S.costs.filter(c => c.paidFrom === "out_of_pocket" && !c.reimbursed).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return `
  <div class="head"><div><h1>Petty cash</h1><p class="sub">Cash given to each employee, what they spent from it, and out of pocket expenses waiting for reimbursement.</p></div>
  <button class="btn primary" data-a="new-petty">Give petty cash</button></div>
  <div class="card scroll"><h2>By employee</h2>${emps.length ? `<table><thead><tr><th>Employee</th><th class="num">Received</th><th class="num">Spent from petty cash</th><th class="num">Cash on hand</th><th class="num">Out of pocket owed</th></tr></thead><tbody>
    ${emps.map(p => { const t = pettyTotals(p.id); return `<tr><td><b>${esc(p.full_name || p.email)}</b></td><td class="num">${peso(t.rec)}</td><td class="num">${peso(t.spent)}</td><td class="num ${t.hand < 0 ? "neg" : ""}"><b>${peso(t.hand)}</b></td><td class="num">${t.oop ? peso(t.oop) : "–"}</td></tr>`; }).join("")}
  </tbody></table>` : `<div class="empty">No employees yet. Set someone's role to Employee in Team & Access.</div>`}</div>
  <div class="two">
    <div class="card scroll"><h2>Out of pocket to reimburse (${oop.length})</h2>${oop.length ? `<table><thead><tr><th>Date</th><th>Employee</th><th>Project</th><th>Item</th><th class="num">Amount</th><th></th></tr></thead><tbody>
      ${oop.map(c => `<tr><td class="small">${fmtD(c.date)}</td><td>${esc(nameOf(c.createdBy))}</td><td class="small">${esc(projName(c.projectId))}</td><td class="small">${esc(c.category)}${c.description ? " · " + esc(c.description) : ""}</td><td class="num">${peso(c.amount)}</td><td><button class="btn sm" data-a="reimb" data-id="${c.id}">Mark reimbursed</button></td></tr>`).join("")}
    </tbody></table>` : `<div class="empty">Nothing waiting for reimbursement.</div>`}</div>
    <div class="card scroll"><h2>Petty cash given</h2>${S.petty.length ? `<table><thead><tr><th>Date</th><th>Employee</th><th>Note</th><th class="num">Amount</th></tr></thead><tbody>
      ${S.petty.slice(0, 30).map(p => `<tr class="click" data-a="edit-petty" data-id="${p.id}"><td class="small">${fmtD(p.date)}</td><td>${esc(nameOf(p.employeeId))}</td><td class="small">${esc(p.note || (p.projectId ? projName(p.projectId) : ""))}</td><td class="num">${peso(p.amount)}</td></tr>`).join("")}
    </tbody></table>` : `<div class="empty">No petty cash given yet.</div>`}</div>
  </div>`;
}

/* ---------- weekly reports ---------- */
const RSTAT = { draft: ["Draft", "OnHold"], submitted: ["Waiting for approval", "Proposal"], approved: ["Approved", "Ongoing"], returned: ["Returned", "Unconfirmed"] };
const rchip = s => `<span class="chip ${RSTAT[s][1]}">${RSTAT[s][0]}</span>`;
function weekRange(r) { return `${fmtD(r.week_start)} to ${fmtD(r.week_end)}`; }
function reportNo(r) { const same = S.reports.filter(x => x.project_id === r.project_id && (IS("client") || x.status === "approved" || x.id === r.id)).sort((a, b) => a.week_start.localeCompare(b.week_start)); return same.findIndex(x => x.id === r.id) + 1; }
function mondayOf(d) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; }

function vReports() {
  const list = S.reports.filter(r => !S.reportFilter || r.project_id === S.reportFilter);
  const groups = IS("owner") ? [["submitted", "Waiting for your approval"], ["returned", "Returned to employee"], ["draft", "Drafts"], ["approved", "Approved"]]
    : IS("employee") ? [["returned", "Returned to you for changes"], ["draft", "Drafts"], ["submitted", "Waiting for approval"], ["approved", "Approved"]] : [["approved", "Weekly progress reports"]];
  const row = r => `<tr class="click" data-a="open-report" data-id="${r.id}"><td><b>${esc(projName(r.project_id))}</b><div class="small muted">${weekRange(r)}</div></td>
    <td class="small">${esc(nameOf(r.created_by))}</td><td>${rchip(r.status)}</td><td class="num small">${r.progress_snapshot != null ? r.progress_snapshot + "%" : "–"}</td></tr>`;
  const canWrite = !IS("client") && S.projects.some(p => p.status !== "Proposal");
  return `
  <div class="head"><div><h1>${IS("client") ? "Progress reports" : "Weekly reports"}</h1><p class="sub">${IS("client") ? "Weekly updates from the LDM site team, with photos." : IS("owner") ? "Reports reach clients only after you approve them." : "Fill in the week's details and photos, then submit for approval."}</p></div>
  <div class="row"><select id="rf" data-local="reportFilter" aria-label="Project"><option value="">All projects</option>${S.projects.map(p => `<option value="${p.id}" ${p.id === S.reportFilter ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
  ${canWrite ? `<button class="btn primary" data-a="new-report">New weekly report</button>` : ""}</div></div>
  ${groups.map(([st, title]) => { const g = list.filter(r => r.status === st); if (!g.length && st !== groups[0][0]) return "";
    return `<div class="card scroll"><h2>${title} (${g.length})</h2>${g.length ? `<table><thead><tr><th>Project and week</th><th>Prepared by</th><th>Status</th><th class="num">Progress</th></tr></thead><tbody>${g.map(row).join("")}</tbody></table>` : `<div class="empty">${IS("client") ? "No reports yet. They appear here once LDM approves them." : "Nothing here."}</div>`}</div>`; }).join("")}`;
}

async function loadPhotos(rid, force) {
  if (S.photoCache[rid] && !force) return S.photoCache[rid];
  const rows = await q(sb.from("report_photos").select("*").eq("report_id", rid).order("sort").order("created_at"));
  let urls = [];
  if (rows.length) { const { data } = await sb.storage.from("report-photos").createSignedUrls(rows.map(r => r.path), 3600); urls = data || []; }
  S.photoCache[rid] = rows.map((r, i) => ({ ...r, url: (urls[i] || {}).signedUrl || "" }));
  return S.photoCache[rid];
}

function vReport() {
  const r = S.reports.find(x => x.id === S.viewReport);
  if (!r) return `<div class="empty">This report isn't available. <a href="#reports">Back to reports</a></div>`;
  const p = S.projects.find(x => x.id === r.project_id) || {};
  const photos = S.photoCache[r.id];
  if (!photos) loadPhotos(r.id).then(render).catch(e => toast(friendly(e)));
  const mine = r.created_by === ME.id;
  const canEdit = (IS("employee") && mine && ["draft", "returned"].includes(r.status)) || (IS("owner") && r.status !== "approved");
  const sec = (t, v) => v ? `<section><h3>${t}</h3><p class="pre">${esc(v)}</p></section>` : "";
  return `
  <div class="head no-print"><div><a href="#reports" class="small">← All reports</a><h1>Weekly progress report</h1><div class="row" style="margin-top:6px" ${IS("client") ? "hidden" : ""}>${rchip(r.status)}${r.status === "approved" ? `<span class="small muted">Visible to the client</span>` : `<span class="small muted">Not visible to the client yet</span>`}</div></div>
  <div class="row">
    ${canEdit ? `<button class="btn" data-a="edit-report" data-id="${r.id}">Edit</button>` : ""}
    ${IS("employee") && mine && ["draft", "returned"].includes(r.status) ? `<button class="btn primary" data-a="submit-report" data-id="${r.id}">Submit for approval</button>` : ""}
    <button class="btn" data-a="print">Print or save as PDF</button>
    ${IS("owner") ? `<button class="btn danger" data-a="del-report" data-id="${r.id}">Delete report</button>` : ""}</div></div>
  ${r.status === "returned" && r.owner_note && !IS("client") ? `<div class="answer no-print"><b style="font-size:15px">Returned with a note:</b> ${esc(r.owner_note)}</div>` : ""}
  ${IS("owner") && r.status === "submitted" ? `<div class="card no-print"><h2>Review</h2><label class="f" for="rv-note">Note to the employee (needed only when returning)<textarea id="rv-note" rows="2"></textarea></label>
    <div class="row"><button class="btn primary" data-a="approve-report" data-id="${r.id}">Approve and share with client</button><button class="btn" data-a="return-report" data-id="${r.id}">Return for changes</button></div></div>` : ""}
  <article class="report-doc">
    <header class="rd-head"><img src="logo.png" alt="LDM Construction"><div><b>Weekly Progress Report</b><span>Report No. ${reportNo(r)} · ${weekRange(r)}</span></div></header>
    <div class="rd-info">
      <div><span>Project</span><b>${esc(p.name || "")}</b></div><div><span>Client</span><b>${esc(p.client || "—")}</b></div>
      <div><span>Location</span><b>${esc(p.location || "—")}</b></div><div><span>Scope</span><b>${esc(p.scope || "—")}</b></div>
    </div>
    <div class="rd-prog"><div><span>Overall progress</span><b>${r.progress_snapshot != null ? r.progress_snapshot : derive(p).progress}%</b></div><div class="dbar"><i style="width:${r.progress_snapshot != null ? r.progress_snapshot : derive(p).progress}%"></i></div><span class="small">Stage: <b>${esc(stageOfPhase(r.phase_snapshot || derive(p).phase) || "—")}</b>${(r.phase_snapshot || derive(p).phase) ? ` · ${esc(r.phase_snapshot || derive(p).phase)}` : ""}</span></div>
    <div class="rd-two">${sec("Manpower", r.manpower)}${sec("Weather", r.weather)}</div>
    ${sec("Work accomplished this week", r.activities)}${sec("Plan for next week", r.next_week)}${sec("Issues and concerns", r.issues)}
    ${photos === undefined ? `<p class="muted small">Loading photos…</p>` : photos.length ? `<section><h3>Site photos</h3><div class="rd-photos">${photos.map(ph => `<figure>${ph.url ? `<img src="${esc(ph.url)}" alt="${esc(ph.caption || "Site photo")}" loading="lazy">` : ""}${ph.caption ? `<figcaption>${esc(ph.caption)}</figcaption>` : ""}</figure>`).join("")}</div></section>` : ""}
    <footer class="rd-foot"><div><span>Prepared by</span><b>${esc(nameOf(r.created_by))}</b>${r.submitted_at ? `<span>${fmtD(r.submitted_at.slice(0, 10))}</span>` : ""}</div>
      <div><span>Approved by</span><b>${r.status === "approved" ? esc(nameOf(r.approved_by)) : "—"}</b>${r.approved_at ? `<span>${fmtD(r.approved_at.slice(0, 10))}</span>` : ""}</div></footer>
    <p class="rd-addr">LDM Construction OPC · 2F Mandaue Foam Bldg, Shaw Boulevard, Addition Hills, Mandaluyong City</p>
  </article>`;
}

let RDRAFT = null;
function reportForm(r) {
  const projs = S.projects.filter(p => p.status !== "Proposal");
  if (!projs.length) { toast("No projects to report on yet."); return; }
  const mon = mondayOf(new Date()), sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  RDRAFT = r ? { ...r } : { project_id: S.reportFilter || projs[0].id, week_start: ymd(mon), week_end: ymd(sun), manpower: "", weather: "", activities: "", next_week: "", issues: "", status: "draft" };
  const photos = (RDRAFT.id && S.photoCache[RDRAFT.id]) || [];
  openModal(`<h2>${RDRAFT.id ? "Edit weekly report" : "New weekly report"}</h2>
  <form id="rpf" class="fg">
    <label class="f wide" for="r-proj">Project<select id="r-proj" name="project_id">${projs.map(p => `<option value="${p.id}" ${p.id === RDRAFT.project_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="f" for="r-ws">Week starting<input id="r-ws" name="week_start" type="date" required value="${esc(RDRAFT.week_start)}"></label>
    <label class="f" for="r-we">Week ending<input id="r-we" name="week_end" type="date" required value="${esc(RDRAFT.week_end)}"></label>
    <label class="f wide" for="r-man">Manpower<textarea id="r-man" name="manpower" rows="2" placeholder="e.g. 1 foreman, 4 skilled workers, 6 laborers (average per day)">${esc(RDRAFT.manpower)}</textarea></label>
    <label class="f wide" for="r-wea">Weather<input id="r-wea" name="weather" placeholder="e.g. Sunny Mon to Thu, rain Friday afternoon (half day lost)" value="${esc(RDRAFT.weather)}"></label>
    <label class="f wide" for="r-act">Work accomplished this week<textarea id="r-act" name="activities" rows="5" placeholder="One item per line">${esc(RDRAFT.activities)}</textarea></label>
    <label class="f wide" for="r-next">Plan for next week<textarea id="r-next" name="next_week" rows="3">${esc(RDRAFT.next_week)}</textarea></label>
    <label class="f wide" for="r-iss">Issues and concerns<textarea id="r-iss" name="issues" rows="2" placeholder="Delays, material shortages, client decisions needed">${esc(RDRAFT.issues)}</textarea></label>
  </form>
  <div class="sec">Site photos</div>
  <div class="ph-edit" id="ph-edit">${photos.map(ph => `<figure><img src="${esc(ph.url)}" alt=""><input value="${esc(ph.caption)}" placeholder="Caption" data-cap="${ph.id}" aria-label="Photo caption"><button type="button" class="btn sm danger" data-a="del-photo" data-id="${ph.id}">Remove</button></figure>`).join("")}</div>
  <label class="btn" for="r-photos" style="align-self:flex-start">Add photos<input id="r-photos" type="file" accept="image/*" multiple hidden></label>
  <p class="small muted" id="ph-status">Photos are resized before upload. Adding photos saves the report as a draft.</p>
  <div class="row end"><div>${RDRAFT.id && (RDRAFT.status !== "approved" || IS("owner")) ? `<button class="btn danger" data-a="del-report" data-id="${RDRAFT.id}">Delete report</button>` : ""}</div>
  <div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn" data-a="save-report" data-s="draft">Save draft</button>${IS("employee") ? `<button class="btn primary" data-a="save-report" data-s="submitted">Submit for approval</button>` : `<button class="btn primary" data-a="save-report" data-s="approved">Save and approve</button>`}</div></div>`);
}

async function saveReport(status) {
  const f = document.getElementById("rpf"); if (!f.reportValidity()) return null;
  const d = formData("rpf"); const p = S.projects.find(x => x.id === d.project_id) || {};
  const dv = derive(p);
  const body = { project_id: d.project_id, week_start: d.week_start, week_end: d.week_end, manpower: d.manpower, weather: d.weather,
    activities: d.activities, next_week: d.next_week, issues: d.issues, progress_snapshot: dv.progress, phase_snapshot: dv.phase || "", status };
  let row;
  if (RDRAFT.id) row = await q(sb.from("reports").update(body).eq("id", RDRAFT.id).select().single());
  else row = await q(sb.from("reports").insert(body).select().single());
  RDRAFT = { ...RDRAFT, ...row };
  for (const inp of document.querySelectorAll("[data-cap]")) {
    const ph = (S.photoCache[RDRAFT.id] || []).find(x => x.id === inp.dataset.cap);
    if (ph && ph.caption !== inp.value) await q(sb.from("report_photos").update({ caption: inp.value }).eq("id", ph.id));
  }
  return row;
}

async function compressImage(file) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(res, "image/jpeg", 0.82));
}

async function addPhotos(files) {
  const st = document.getElementById("ph-status");
  try {
    if (!RDRAFT.id || RDRAFT.status === "submitted") { const row = await saveReport(RDRAFT.status === "returned" ? "returned" : "draft"); if (!row) return; }
    const existing = (S.photoCache[RDRAFT.id] || []).length;
    let i = 0;
    for (const file of files) {
      i++; if (st) st.textContent = `Uploading photo ${i} of ${files.length}…`;
      const blob = await compressImage(file);
      const path = `${RDRAFT.id}/${newId()}.jpg`;
      const { error } = await sb.storage.from("report-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      await q(sb.from("report_photos").insert({ report_id: RDRAFT.id, path, caption: "", sort: existing + i }));
    }
    await loadAll(); await loadPhotos(RDRAFT.id, true);
    reportForm(S.reports.find(x => x.id === RDRAFT.id)); toast(`${files.length} photo${files.length > 1 ? "s" : ""} added`);
  } catch (e) { toast(friendly(e)); if (st) st.textContent = "Upload failed. Try again."; }
}

/* ---------- owner: team and access ---------- */
function vTeam() {
  const projs = S.projects.filter(p => p.status !== "Completed" || S.members.some(m => m.project_id === p.id));
  return `
  <div class="head"><div><h1>Team and access</h1><p class="sub">Set each person's role and the projects they can see.</p></div></div>
  <div class="answer"><b style="font-size:15px">Adding people:</b> send them this site's link and ask them to click <b>Create account</b>, or invite them from Supabase (Authentication, Users, Invite user). New accounts show here as <b>Pending</b> and see nothing until you give them a role.
    <div class="small" style="margin-top:6px"><b>Employee:</b> progress, running cost, petty cash and weekly reports on assigned projects. <b>Client:</b> their project's progress, payments and approved reports.</div></div>
  <div class="card scroll"><table><thead><tr><th>Person</th><th>Role</th><th>Projects they can access</th><th></th></tr></thead><tbody>
  ${S.profiles.map(u => { const self = u.id === ME.id; const mine = S.members.filter(m => m.user_id === u.id).map(m => m.project_id);
    return `<tr data-user="${u.id}"><td style="min-width:200px"><input class="tin" id="tn-${u.id}" value="${esc(u.full_name)}" placeholder="Full name" aria-label="Full name"><div class="small muted">${esc(u.email)}</div></td>
      <td><select id="tr-${u.id}" ${self ? "disabled" : ""} aria-label="Role">${["pending", "employee", "client", "owner"].map(r => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r[0].toUpperCase() + r.slice(1)}</option>`).join("")}</select></td>
      <td>${u.role === "owner" ? `<span class="small muted">All projects</span>` : `<div class="checks">${projs.map(p => `<label><input type="checkbox" data-mp="${u.id}" value="${p.id}" ${mine.includes(p.id) ? "checked" : ""}> ${esc(p.name)}</label>`).join("") || `<span class="small muted">No projects yet</span>`}</div>`}</td>
      <td><button class="btn sm primary" data-a="save-user" data-id="${u.id}">Save</button></td></tr>`; }).join("")}
  </tbody></table></div>`;
}

/* ---------- client: my project ---------- */
function vHome() {
  if (!S.projects.length) return `<div class="empty">Your project isn't linked to this account yet. Please contact LDM Construction.</div>`;
  return `<div class="head"><div><h1>Welcome${ME.full_name ? ", " + esc(ME.full_name.split(" ")[0]) : ""}</h1><p class="sub">Your project with LDM Construction at a glance.</p></div></div>` +
  S.projects.map(p => {
    const d = derive(p), ap = applicable(p), sm = S.summary.find(x => x.project_id === p.id) || {}, contract = num(sm.contract), paid = num(sm.paid);
    const pays = S.collections.filter(c => c.projectId === p.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const latest = S.reports.filter(r => r.project_id === p.id && r.status === "approved").sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
    const mob = p.mobilizationDate && parseD(p.mobilizationDate) >= today();
    return `<div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2 style="font-size:22px">${esc(p.name)}</h2><span class="small muted">${esc(p.scope)}${p.scope && p.location ? " · " : ""}${esc(p.location)}</span></div>${chip(p.status)}</div>
      <div class="two">
        <div style="display:flex;flex-direction:column;gap:12px">
          ${(() => { const cs = currentStage(p); return `
          <div class="dbig"><b>${d.progress}%</b><span class="small">overall · now in <b>${esc(cs.name || "—")}</b></span></div>
          <div class="dbar"><i style="width:${d.progress}%"></i></div>
          <h3 class="sec" style="border:none;padding:0">Your project journey</h3>
          ${journeyTracker(p)}
          <div class="jnow"><div class="row" style="justify-content:space-between"><b>${esc(cs.name)}</b><span class="small">${cs.pct}% done</span></div><span class="small muted">${esc(cs.desc || "")}</span>
            ${cs.ph.length > 1 ? `<div class="phs">${cs.ph.map(ph => { const v = phaseVal(p, ph); return `<div class="phr ${v >= 100 ? "done" : ph === d.phase ? "cur" : ""}"><span>${esc(ph)}</span><div class="bar" style="height:8px"><i style="width:${v}%;background:${v >= 100 ? "var(--ink)" : "var(--brand)"}"></i></div><b>${v}%</b></div>`; }).join("")}</div>` : ""}</div>`; })()}
          <div class="dmeta">${mob ? `<span>Site mobilization <b>${fmtD(p.mobilizationDate)}</b></span>` : p.startDate ? `<span>Started <b>${fmtD(p.startDate)}</b></span>` : ""}<span>Target completion <b>${p.endDate ? fmtD(p.endDate) : "to be confirmed"}</b></span></div>
          ${latest ? `<div class="answer"><b style="font-size:15px">Latest report:</b> ${weekRange(latest)} <a href="#" data-a="open-report" data-id="${latest.id}">Read report</a></div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid-tiles"><div class="tile"><span class="k">Contract</span><span class="v">${peso(contract)}</span></div><div class="tile hi"><span class="k">Paid</span><span class="v">${peso(paid)}</span><span class="h">${contract ? Math.round(paid / contract * 100) + "% of contract" : ""}</span></div><div class="tile"><span class="k">Balance</span><span class="v">${peso(contract - paid)}</span></div></div>
          <div class="dbar"><i style="width:${contract ? Math.min(100, paid / contract * 100) : 0}%"></i></div>
          <h3 class="sec" style="border:none;padding:0">Payment history</h3>
          ${pays.length ? `<table><thead><tr><th>Date</th><th>For</th><th>Type</th><th>Reference</th><th class="num">Amount</th></tr></thead><tbody>${pays.map(c => `<tr><td class="small">${fmtD(c.date)}</td><td class="small">${esc(c.stage)}</td><td class="small">${esc(c.type)}</td><td class="small">${esc(c.reference)}</td><td class="num">${peso(c.amount)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No payments recorded yet.</div>`}
          ${(() => { const rb = S.costs.filter(c => c.projectId === p.id && c.paidFrom === "client"); if (!rb.length) return ""; const pend = rb.filter(c => !c.reimbursed).reduce((a, c) => a + c.amount, 0);
            return `<h3 class="sec" style="border:none;padding:0">Expenses you paid that LDM reimburses</h3>${pend ? `<div class="answer"><b style="font-size:15px">${peso(pend)}</b> to be reimbursed to you</div>` : ""}
            <table><thead><tr><th>Date</th><th>Item</th><th>Status</th><th class="num">Amount</th></tr></thead><tbody>${rb.map(c => `<tr><td class="small">${fmtD(c.date)}</td><td class="small">${esc(c.category)}${c.description ? " · " + esc(c.description) : ""}</td><td>${c.reimbursed ? `<span class="chip Ongoing">Reimbursed</span>` : `<span class="chip Proposal">To be reimbursed</span>`}</td><td class="num">${peso(c.amount)}</td></tr>`).join("")}</tbody></table>`; })()}
          ${clientDueCard(p)}
        </div>
      </div></div>`;
  }).join("");
}

/* ---------- portal actions ---------- */
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, id = el.dataset.id;
  const take = () => { if (el.tagName === "A") ev.preventDefault(); };
  if (a === "new-exp") { take(); expenseForm(); }
  else if (a === "edit-exp") expenseForm(S.costs.find(c => c.id === id));
  else if (a === "save-exp") {
    const f = document.getElementById("xf"); if (!f.reportValidity()) return;
    const d = formData("xf"); el.disabled = true;
    if (await write("costs/" + (id || newId()), d)) { closeModal(); toast("Expense saved"); S.runMonth = d.date.slice(0, 7); render(); }
    el.disabled = false;
  }
  else if (a === "new-petty") pettyForm();
  else if (a === "edit-petty") pettyForm(S.petty.find(p => p.id === id));
  else if (a === "save-petty") {
    const f = document.getElementById("pcf"); if (!f.reportValidity()) return;
    const d = formData("pcf"); el.disabled = true;
    if (await write("petty/" + (id || newId()), d)) { closeModal(); toast("Petty cash saved"); }
    el.disabled = false;
  }
  else if (a === "reimb") { el.disabled = true; try { await q(sb.from("costs").update({ reimbursed: true }).eq("id", id)); await loadAll(); render(); toast("Marked reimbursed"); } catch (e) { toast(friendly(e)); el.disabled = false; } }
  else if (a === "new-report") reportForm();
  else if (a === "open-report") { take(); S.viewReport = id; location.hash = "report"; render(); }
  else if (a === "edit-report") { const r = S.reports.find(x => x.id === id); await loadPhotos(id).catch(() => {}); reportForm(r); }
  else if (a === "save-report") {
    el.disabled = true;
    try { const row = await saveReport(el.dataset.s); if (row) { closeModal(); await loadAll(); S.viewReport = row.id; delete S.photoCache[row.id]; location.hash = "report"; render(); toast(el.dataset.s === "submitted" ? "Submitted for approval" : el.dataset.s === "approved" ? "Report approved" : "Draft saved"); } }
    catch (e) { toast(friendly(e)); }
    el.disabled = false;
  }
  else if (a === "submit-report" || a === "approve-report" || a === "return-report") {
    const status = { "submit-report": "submitted", "approve-report": "approved", "return-report": "returned" }[a];
    const body = { status };
    if (a === "return-report") { const n = (document.getElementById("rv-note") || {}).value || ""; if (!n.trim()) { toast("Add a note so the employee knows what to change."); return; } body.owner_note = n.trim(); }
    el.disabled = true;
    try { await q(sb.from("reports").update(body).eq("id", id)); await loadAll(); render(); toast({ submitted: "Submitted for approval", approved: "Approved. The client can now see it.", returned: "Returned to the employee" }[status]); }
    catch (e) { toast(friendly(e)); el.disabled = false; }
  }
  else if (a === "del-report" || a === "del-photo" || a === "del-exp" || a === "del-petty") {
    if (!el.dataset.armed) { el.dataset.armed = "1"; const t = el.textContent; el.textContent = "Click again to confirm"; setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = t; } }, 4000); return; }
    try {
      if (a === "del-report") { const ph = await loadPhotos(id, true); if (ph.length) await sb.storage.from("report-photos").remove(ph.map(x => x.path)); await q(sb.from("reports").delete().eq("id", id)); closeModal(); await loadAll(); location.hash = "reports"; render(); toast("Report deleted"); }
      else if (a === "del-photo") { const ph = (S.photoCache[RDRAFT.id] || []).find(x => x.id === id); if (ph) { await sb.storage.from("report-photos").remove([ph.path]); await q(sb.from("report_photos").delete().eq("id", id)); } await loadPhotos(RDRAFT.id, true); reportForm(RDRAFT); }
      else if (a === "del-exp") { if (await write("costs/" + id, null, true)) { closeModal(); toast("Deleted"); } }
      else if (a === "del-petty") { if (await write("petty/" + id, null, true)) { closeModal(); toast("Deleted"); } }
    } catch (e) { toast(friendly(e)); }
  }
  else if (a === "print") window.print();
  else if (a === "save-user") {
    const name = document.getElementById("tn-" + id).value.trim(), roleSel = document.getElementById("tr-" + id), role = roleSel.disabled ? null : roleSel.value;
    const want = [...document.querySelectorAll(`[data-mp="${id}"]`)].filter(x => x.checked).map(x => x.value);
    const have = S.members.filter(m => m.user_id === id).map(m => m.project_id);
    el.disabled = true;
    try {
      await q(sb.from("profiles").update(role ? { full_name: name, role } : { full_name: name }).eq("id", id));
      const add = want.filter(p => !have.includes(p)), rem = have.filter(p => !want.includes(p));
      if (add.length) await q(sb.from("project_members").insert(add.map(p => ({ project_id: p, user_id: id }))));
      if (rem.length) await q(sb.from("project_members").delete().eq("user_id", id).in("project_id", rem));
      await loadAll(); render(); toast("Access updated");
    } catch (e) { toast(friendly(e)); }
    el.disabled = false;
  }
  else if (a === "signout") { take(); await sb.auth.signOut(); location.hash = ""; location.reload(); }
});
document.addEventListener("change", e => {
  if (e.target.id === "r-photos" && e.target.files.length) addPhotos([...e.target.files]);
  if (e.target.id === "r-ws") { const s = parseD(e.target.value); if (s) { const x = new Date(s); x.setDate(x.getDate() + 6); document.getElementById("r-we").value = ymd(x); } }
});

/* ---------- navigation by role ---------- */
const NAV = {
  owner: [["overview", "Dashboard"], ["proposals", "Proposals"], ["progress", "Project Progress"], ["reports", "Weekly Reports"], ["clients", "Clients"], ["phases", "Projects & Phases"], ["capacity", "Capacity by Quarter"], ["costs", "Monthly Costs"], ["collections", "Collections"], ["billing", "Billing & Payments"], ["profit", "Profit"], ["petty", "Petty Cash"], ["team", "Team & Access"]],
  employee: [["progress", "Progress"], ["running", "Running Cost"], ["reports", "Weekly Reports"]],
  client: [["home", "My Project"], ["billing", "Billing & Payments"], ["reports", "Progress Reports"]]
};
const VIEWS = { overview: vOverview, progress: vProgress, clients: vClients, phases: vPhases, capacity: vCapacity, costs: vCosts, collections: vCollections, profit: vProfit,
  running: vRunning, petty: vPetty, reports: vReports, report: vReport, team: vTeam, home: vHome, billing: vRequests, bill: vBill, proposals: vProposals, proposal: vProposal, requests: vRequests };
function allowed() { return (NAV[ROLE] || []).map(x => x[0]).concat(["report"], IS("employee") ? [] : ["bill", "proposal"]); }
function current() { if (location.hash === "#requests") return "billing"; const h = location.hash.slice(1); return allowed().includes(h) && VIEWS[h] ? h : (NAV[ROLE] || [["overview"]])[0][0]; }
function buildNav() {
  document.getElementById("nav").innerHTML = (NAV[ROLE] || []).map(([k, t]) => `<a href="#${k}" data-v="${k}">${t}${k === "reports" && IS("owner") ? ` <span class="n" id="n-rep"></span>` : ""}${k === "billing" ? ` <span class="n" id="n-bill"></span>` : ""}${k === "proposals" ? ` <span class="n" id="n-prop"></span>` : ""}</a>`).join("");
  document.getElementById("sync").innerHTML = `<b>${esc(ME.full_name || ME.email)}</b><br><span>${{ owner: "Owner", employee: "Employee", client: "Client" }[ROLE]}</span> · <a href="#" data-a="signout">Sign out</a>`;
  document.body.dataset.role = ROLE;
}
function render() {
  if (!ROLE) return;
  const v = current();
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.v === v || (v === "report" && a.dataset.v === "reports") || (v === "bill" && a.dataset.v === "billing") || (v === "proposal" && a.dataset.v === (IS("owner") ? "proposals" : "home"))));
  const nr = document.getElementById("n-rep"); if (nr) nr.textContent = S.reports.filter(r => r.status === "submitted").length || "";
  const np = document.getElementById("n-prop"); if (np) np.textContent = S.proposals.filter(p => p.status === "accepted").length || "";
  const nb = document.getElementById("n-bill"); if (nb) nb.textContent = (IS("client") ? S.billings.filter(b => b.status === "sent").length + S.milestones.filter(m => m.status === "requested").length : S.billings.filter(b => b.status === "disputed").length + openBillings().filter(b => b.status === "accepted").length) || "";
  if (!S.loaded) { document.getElementById("view").innerHTML = `<div class="empty">Loading…</div>`; return; }
  const focusId = document.activeElement && document.activeElement.id;
  document.getElementById("view").innerHTML = VIEWS[v]();
  if (focusId && document.getElementById(focusId) && !document.getElementById("overlay").classList.contains("on")) document.getElementById(focusId).focus();
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
function setSync() {}
function banner(t) { const b = document.getElementById("banner"); b.textContent = t || ""; b.classList.toggle("on", !!t); }

/* ---------- sign in ---------- */
const AUTH_TYPE = (/type=(recovery|invite|signup|magiclink)/.exec(location.hash) || [])[1] || "";
function showAuth(mode, msg) {
  document.querySelector(".app").hidden = true;
  const box = document.getElementById("auth"); box.hidden = false;
  const f = (id, label, type, extra = "") => `<label class="f" for="${id}">${label}<input id="${id}" name="${id}" type="${type}" ${extra}></label>`;
  const forms = {
    login: `<h2>Sign in</h2><form id="af-login" class="aform">${f("email", "Email", "email", 'required autocomplete="email"')}${f("password", "Password", "password", 'required autocomplete="current-password"')}<button class="btn primary">Sign in</button></form>
      <div class="alinks"><a href="#" data-auth="forgot">Forgot password?</a><a href="#" data-auth="signup">Create account</a></div>`,
    signup: `<h2>Create account</h2><p class="small muted">LDM will give your account access to your project after you sign up.</p><form id="af-signup" class="aform">${f("full_name", "Full name", "text", 'required autocomplete="name"')}${f("email", "Email", "email", 'required autocomplete="email"')}${f("password", "Password (at least 8 characters)", "password", 'required minlength="8" autocomplete="new-password"')}<button class="btn primary">Create account</button></form>
      <div class="alinks"><a href="#" data-auth="login">I already have an account</a></div>`,
    forgot: `<h2>Reset password</h2><form id="af-forgot" class="aform">${f("email", "Email", "email", 'required autocomplete="email"')}<button class="btn primary">Send reset link</button></form><div class="alinks"><a href="#" data-auth="login">Back to sign in</a></div>`,
    newpass: `<h2>Set your password</h2><form id="af-newpass" class="aform">${f("password", "New password (at least 8 characters)", "password", 'required minlength="8" autocomplete="new-password"')}${f("password2", "Confirm password", "password", 'required minlength="8" autocomplete="new-password"')}<button class="btn primary">Save password</button></form>`,
    pending: `<h2>Waiting for access</h2><p>Your account is set up. LDM Construction still needs to give it access to your project. Please check back later or contact LDM.</p><div class="alinks"><a href="#" data-a="signout">Sign out</a></div>`,
    setup: `<h2>Almost ready</h2><p>This site isn't connected to its database yet. Add your Supabase project URL and anon key to <code>config.js</code>, then reload.</p>`
  };
  box.querySelector(".acard-body").innerHTML = (msg ? `<div class="amsg">${esc(msg)}</div>` : "") + forms[mode];
  const first = box.querySelector("input"); if (first) first.focus();
}
document.addEventListener("click", e => { const a = e.target.closest("[data-auth]"); if (!a) return; e.preventDefault(); showAuth(a.dataset.auth); });
document.addEventListener("submit", async e => {
  const id = e.target.id; if (!id || !id.startsWith("af-")) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector("button"); btn.disabled = true;
  const here = location.origin + location.pathname;
  try {
    if (id === "af-login") { const { data, error } = await sb.auth.signInWithPassword({ email: d.email, password: d.password }); if (error) throw error; await enter(data.user); }
    else if (id === "af-signup") { const { data, error } = await sb.auth.signUp({ email: d.email, password: d.password, options: { data: { full_name: d.full_name }, emailRedirectTo: here } }); if (error) throw error;
      if (data.session) await enter(data.user); else showAuth("login", "Check your email to confirm your account, then sign in."); }
    else if (id === "af-forgot") { const { error } = await sb.auth.resetPasswordForEmail(d.email, { redirectTo: here }); if (error) throw error; showAuth("login", "If that email has an account, a reset link is on its way."); }
    else if (id === "af-newpass") { if (d.password !== d.password2) throw new Error("The passwords don't match."); const { data, error } = await sb.auth.updateUser({ password: d.password }); if (error) throw error; history.replaceState(null, "", location.pathname); await enter(data.user); }
  } catch (err) {
    const m = /Invalid login/i.test(err.message) ? "Wrong email or password." : /Email not confirmed/i.test(err.message) ? "Please confirm your email first. Check your inbox for the link." : friendly(err);
    const box = document.querySelector(".acard-body"); let n = box.querySelector(".amsg"); if (!n) { n = document.createElement("div"); n.className = "amsg"; box.prepend(n); } n.textContent = m; n.classList.add("bad");
  }
  btn.disabled = false;
});

async function enter(user) {
  const prof = await q(sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
  ME = prof || { id: user.id, email: user.email, full_name: "", role: "pending" }; ROLE = ME.role;
  if (ROLE === "pending") { showAuth("pending"); return; }
  if (/access_token|type=/.test(location.hash)) history.replaceState(null, "", location.pathname);
  document.getElementById("auth").hidden = true; document.querySelector(".app").hidden = false;
  buildNav(); render();
  try { await loadAll(); } catch (e) { banner("Couldn't load your data: " + friendly(e)); S.loaded = true; }
  render();
}

(async function boot() {
  const cfg = window.LDM_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { showAuth("setup"); return; }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const ptoken = new URLSearchParams(location.search).get("proposal");
  if (ptoken && /^[0-9a-f-]{36}$/i.test(ptoken)) { await showPublicProposal(ptoken); return; }
  sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") showAuth("newpass"); });
  const { data: { session } } = await sb.auth.getSession();
  if (session && (AUTH_TYPE === "recovery" || AUTH_TYPE === "invite")) { showAuth("newpass"); return; }
  if (session) await enter(session.user); else showAuth(location.hash === "#signup" ? "signup" : "login");
})();
