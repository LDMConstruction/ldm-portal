/* ================================================================
   LDM Portal: payment requests.
   The owner requests a scheduled payment (or a one-off amount); only requested
   payments appear on the client's account, until they are recorded as paid.
   ================================================================ */
const MSTAT = { scheduled: ["Scheduled", "OnHold"], requested: ["Requested", "Proposal"], paid: ["Paid", "Ongoing"] };
function mchip(m) { const over = m.status === "requested" && m.due_date && parseD(m.due_date) < today(); return over ? `<span class="chip Unconfirmed">Overdue</span>` : `<span class="chip ${MSTAT[m.status || "scheduled"][1]}">${MSTAT[m.status || "scheduled"][0]}</span>`; }
const msSort = (a, b) => (a.stage === b.stage ? 0 : a.stage === "Design" ? -1 : 1) || a.sort - b.sort;

function vRequests() {
  const req = S.milestones.filter(m => m.status === "requested");
  const overdue = req.filter(m => m.due_date && parseD(m.due_date) < today());
  const mNow = ym(new Date());
  const paidMonth = S.milestones.filter(m => m.status === "paid" && (m.paid_at || "").startsWith(mNow));
  const projs = S.projects.filter(p => S.milestones.some(m => m.project_id === p.id) || ["Onboarded", "Ongoing"].includes(p.status));
  const nextUp = p => S.milestones.filter(m => m.project_id === p.id && (m.status || "scheduled") === "scheduled").sort(msSort)[0];
  return `
  <div class="head"><div><h1>Payment requests</h1><p class="sub">Clients only see a payment once you request it. Request the next payment when its milestone is reached, then record it when the client pays.</p></div>
  <button class="btn primary" data-a="mr-new">New payment request</button></div>
  <div class="grid-tiles">
    <div class="tile hi"><span class="k">Requested, unpaid</span><span class="v">${peso(req.reduce((a, m) => a + +m.amount, 0))}</span><span class="h">${req.length} request${req.length === 1 ? "" : "s"} with clients</span></div>
    <div class="tile"><span class="k">Overdue</span><span class="v ${overdue.length ? "neg" : ""}">${overdue.length}</span><span class="h">${overdue.length ? peso(overdue.reduce((a, m) => a + +m.amount, 0)) + " past due date" : "nothing past due"}</span></div>
    <div class="tile"><span class="k">Paid this month</span><span class="v">${peso(paidMonth.reduce((a, m) => a + +m.amount, 0))}</span><span class="h">${paidMonth.length} request${paidMonth.length === 1 ? "" : "s"} settled</span></div>
  </div>
  ${req.length ? `<div class="card scroll"><h2>Waiting for payment (${req.length})</h2><table><thead><tr><th>Project</th><th>Payment</th><th>Due</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>
    ${req.sort((a, b) => (a.due_date || "9").localeCompare(b.due_date || "9")).map(m => `<tr><td><b>${esc(projName(m.project_id))}</b></td><td class="small">${esc(m.label)}<div class="muted">${esc(m.milestone)}</div></td><td class="small">${m.due_date ? fmtD(m.due_date) : "—"}</td><td class="num">${peso(m.amount)}</td><td>${mchip(m)}</td>
      <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm primary" data-a="mr-pay" data-id="${m.id}">Record payment</button><button class="btn sm" data-a="mr-edit" data-id="${m.id}">Edit</button></div></td></tr>`).join("")}</tbody></table></div>` : ""}
  ${projs.map(p => { const ms = S.milestones.filter(m => m.project_id === p.id).sort(msSort), nx = nextUp(p);
    const paid = ms.filter(m => m.status === "paid").reduce((a, m) => a + +m.amount, 0), total = ms.reduce((a, m) => a + +m.amount, 0);
    return `<div class="card scroll"><div class="row" style="justify-content:space-between"><div><h2>${esc(p.name)}</h2><span class="small muted">${esc(p.client || "")}${total ? ` · ${peso(paid)} of ${peso(total)} scheduled payments received` : ""}</span></div>
      <div class="row">${nx ? `<button class="btn sm primary" data-a="mr-request" data-id="${nx.id}">Request next: ${esc(nx.label)} (${peso(nx.amount)})</button>` : ""}<button class="btn sm" data-a="mr-new" data-pid="${p.id}">One-off request</button></div></div>
      ${ms.length ? `<table><thead><tr><th>Payment</th><th>Milestone</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${ms.map(m => `<tr><td class="small"><b>${esc(m.label)}</b>${+m.percent ? ` · ${+m.percent}%` : ""}<div class="muted">${esc(m.stage)}</div></td><td class="small">${esc(m.milestone)}${m.status === "requested" && m.due_date ? `<div class="muted">Due ${fmtD(m.due_date)}</div>` : ""}${m.status === "paid" && m.paid_at ? `<div class="muted">Paid ${fmtD(m.paid_at.slice(0, 10))}</div>` : ""}</td>
        <td class="num">${peso(m.amount)}</td><td>${mchip(m)}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">
        ${(m.status || "scheduled") === "scheduled" ? `<button class="btn sm" data-a="mr-request" data-id="${m.id}">Request</button>` : ""}
        ${m.status === "requested" ? `<button class="btn sm primary" data-a="mr-pay" data-id="${m.id}">Record payment</button><button class="btn sm" data-a="mr-cancel" data-id="${m.id}">Cancel request</button>` : ""}
        ${m.status === "paid" ? `<button class="btn sm" data-a="mr-unpay" data-id="${m.id}">Undo paid</button>` : ""}</div></td></tr>`).join("")}</tbody></table>` : `<div class="empty">No payment schedule. Use One-off request to bill this client.</div>`}</div>`; }).join("")}`;
}

function requestForm(m, pid) {
  const isNew = !m, projs = S.projects.filter(p => p.status !== "Proposal");
  if (isNew && !projs.length) { toast("Add a project first."); return; }
  const due = new Date(); due.setDate(due.getDate() + 7);
  m = m || { project_id: pid || projs[0].id, stage: "Design", label: "", milestone: "", amount: "", status: "scheduled" };
  openModal(`<h2>${isNew ? "New payment request" : m.status === "requested" ? "Edit payment request" : "Request payment"}</h2>
  <p class="small muted" style="margin:0">The client sees this on their account as a payment due, with your note.</p>
  <form id="mrf" class="fg">
    ${isNew ? `<label class="f wide" for="mr-proj">Project<select id="mr-proj">${projs.map(p => `<option value="${p.id}" ${p.id === m.project_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label class="f" for="mr-stage">For<select id="mr-stage"><option ${m.stage === "Design" ? "selected" : ""}>Design</option><option ${m.stage === "Construction" ? "selected" : ""}>Construction</option></select></label>
      <label class="f" for="mr-label">Payment<input id="mr-label" placeholder="e.g. Additional works, Change order 1" required></label>
      <label class="f wide" for="mr-ms">Description<input id="mr-ms" placeholder="What the payment is for"></label>
      <label class="f" for="mr-amt">Amount (₱)<input id="mr-amt" type="number" min="0" step="0.01" required></label>`
    : `<div class="f wide"><span class="muted" style="font-weight:600">Payment</span><b>${esc(projName(m.project_id))} · ${esc(m.label)} · ${peso(m.amount)}</b><span class="small muted">${esc(m.milestone)}</span></div>`}
    <label class="f" for="mr-due">Due date<input id="mr-due" type="date" value="${esc(m.due_date || ymd(due))}" required></label>
    <label class="f wide" for="mr-note">Note to client (optional)<textarea id="mr-note" rows="2" placeholder="e.g. Initial design and 3D perspectives submitted Nov 24. Please settle via EastWest Bank.">${esc(m.request_note || "")}</textarea></label>
  </form>
  <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="mr-save" data-id="${m.id || ""}">${m.status === "requested" ? "Save" : "Send request to client"}</button></div></div>`);
}

/* Client: only what is currently due */
function clientDueCard(p) {
  const due = S.milestones.filter(m => m.project_id === p.id && m.status === "requested").sort((a, b) => (a.due_date || "9").localeCompare(b.due_date || "9"));
  const props = S.clientProposals.filter(x => x.project_id === p.id);
  let html = `<h3 class="sec" style="border:none;padding:0">Payment due</h3>`;
  html += due.length ? `<div class="duelist">${due.map(m => { const over = m.due_date && parseD(m.due_date) < today();
      return `<div class="due ${over ? "over" : ""}"><div><b>${esc(m.label)}</b><span class="small muted">${esc(m.milestone)}</span>${m.request_note ? `<span class="small">${esc(m.request_note)}</span>` : ""}</div>
        <div class="r"><b>${peso(m.amount)}</b><span class="small ${over ? "neg" : "muted"}">${m.due_date ? (over ? "Overdue since " : "Due ") + fmtD(m.due_date) : ""}</span></div></div>`; }).join("")}
      <p class="small muted" style="margin:0">Total due ${peso(due.reduce((a, m) => a + +m.amount, 0))}. Please contact LDM for payment details if you need them.</p></div>`
    : `<div class="empty">No payment due right now.</div>`;
  return html + props.map(x => `<p class="small" style="margin:0">Your ${esc((x.kind || "design").toLowerCase())} proposal ${esc(x.proposal_no)}, accepted ${fmtD((x.responded_at || "").slice(0, 10))}. <a href="#" data-a="open-prop" data-id="${x.id}">View proposal</a></p>`).join("");
}

let PAYING = null;
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, id = el.dataset.id;
  if (!/^mr-/.test(a)) return;
  try {
    if (a === "mr-new") requestForm(null, el.dataset.pid);
    else if (a === "mr-request" || a === "mr-edit") requestForm(S.milestones.find(m => m.id === id));
    else if (a === "mr-save") {
      const f = document.getElementById("mrf"); if (!f.reportValidity()) return;
      const g = x => (document.getElementById(x) || {}).value;
      const fields = { status: "requested", due_date: g("mr-due") || null, request_note: (g("mr-note") || "").trim(), requested_at: new Date().toISOString() };
      el.disabled = true;
      if (id) await q(sb.from("project_milestones").update(fields).eq("id", id));
      else { const pid = g("mr-proj"); const n = S.milestones.filter(m => m.project_id === pid).length;
        await q(sb.from("project_milestones").insert({ project_id: pid, stage: g("mr-stage"), label: g("mr-label").trim(), milestone: (g("mr-ms") || "").trim(), percent: 0, amount: +g("mr-amt") || 0, sort: n + 1, ...fields })); }
      closeModal(); await loadAll(); render(); toast("Request sent. The client can now see it on their account.");
    }
    else if (a === "mr-cancel") {
      if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Click again to cancel"; setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = "Cancel request"; } }, 4000); return; }
      await q(sb.from("project_milestones").update({ status: "scheduled", requested_at: null, due_date: null }).eq("id", id)); await loadAll(); render(); toast("Request cancelled. The client no longer sees it.");
    }
    else if (a === "mr-unpay") { await q(sb.from("project_milestones").update({ status: "requested", paid_at: null }).eq("id", id)); await loadAll(); render(); toast("Back to requested"); }
    else if (a === "mr-pay") {
      const m = S.milestones.find(x => x.id === id); PAYING = id;
      collectionForm({ projectId: m.project_id, date: ymd(new Date()), amount: m.amount, stage: m.stage, type: /^PB|progress/i.test(m.label) ? "Progress billing" : /down|1st|^design 1st/i.test(m.label) ? "Downpayment" : "Other", reference: "", notes: `${m.label}${m.milestone ? ": " + m.milestone : ""}`.slice(0, 200) });
    }
  } catch (e) { toast(friendly(e)); el.disabled = false; }
});
/* After a collection is saved from "Record payment", mark the request paid. */
async function markPayingPaid() {
  if (!PAYING) return; const id = PAYING; PAYING = null;
  try { await q(sb.from("project_milestones").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id)); await loadAll(); render(); toast("Payment recorded and request marked paid"); } catch (e) { toast(friendly(e)); }
}
document.addEventListener("click", e => { const el = e.target.closest("[data-a]"); if (el && (el.dataset.a === "close") && PAYING && !document.getElementById("kf")) PAYING = null; });
