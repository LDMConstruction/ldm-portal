/* ================================================================
   LDM Portal: progress billing (owner prepares, client reviews and accepts)
   and expenses paid by clients that LDM reimburses.
   ================================================================ */
const BSTAT = { draft: ["Draft", "OnHold"], sent: ["Waiting for client", "Proposal"], accepted: ["Accepted", "Ongoing"], disputed: ["Concern raised", "Unconfirmed"] };
const bchip = s => `<span class="chip ${BSTAT[s][1]}">${BSTAT[s][0]}</span>`;
const r2 = n => Math.round((+n || 0) * 100) / 100;

/* Accomplishment math. Items: [{ d: description, w: weight %, p: previous %, n: this period % }] */
function billCalc(b) {
  const items = b.items || [];
  const acc = items.reduce((a, it) => a + (+it.w || 0) * Math.min(100, (+it.p || 0) + (+it.n || 0)) / 100, 0) / 100;
  const contract = +b.contract_amount || 0;
  const gross = r2(contract * acc);
  const recoup = r2(gross * (+b.dp_percent || 0) / 100);
  const retention = r2(gross * (+b.retention_percent || 0) / 100);
  const net = r2(gross - recoup - retention);
  const prev = previousBilling(b);
  const prevNet = prev ? +prev.net_to_date || 0 : 0;
  return { acc, gross, recoup, retention, net, prevNet, due: r2(net - prevNet), weight: items.reduce((a, it) => a + (+it.w || 0), 0) };
}
function previousBilling(b) {
  return S.billings.filter(x => x.project_id === b.project_id && x.basis === b.basis && x.id !== b.id && x.billing_no < b.billing_no && x.status !== "draft")
    .sort((a, c) => c.billing_no - a.billing_no)[0];
}
function basisAmount(p, basis) { const f = fin(p); return basis === "Design" ? f.designC : basis === "Total" ? f.contract : f.constrC; }

function billingGroups(list, row, owner) {
  return (owner ? [["disputed", "Concern raised by client"], ["sent", "Waiting for client"], ["draft", "Drafts"], ["accepted", "Accepted"]] : [["sent", "Waiting for your review"], ["disputed", "Concern raised"], ["accepted", "Accepted"]])
    .map(([st, t], i) => { const g = list.filter(b => b.status === st); if (!g.length && i) return "";
      return `<div class="card scroll"><h2>${t} (${g.length})</h2>${g.length ? `<table><thead><tr><th>Project and billing</th><th>As of</th><th>Status</th><th class="num">Amount due</th></tr></thead><tbody>${g.map(row).join("")}</tbody></table>` : `<div class="empty">${owner ? "Nothing here." : "No billing waiting for you."}</div>`}</div>`; }).join("");
}
function vBilling(embed) {
  const list = S.billings.slice().sort((a, b) => (b.as_of || "").localeCompare(a.as_of || "") || b.billing_no - a.billing_no)
    .filter(b => !S.reportFilter || b.project_id === S.reportFilter);
  const row = b => `<tr class="click" data-a="open-bill" data-id="${b.id}"><td><b>${esc(projName(b.project_id))}</b><div class="small muted">Progress Billing No. ${b.billing_no} · ${esc(b.basis)}</div></td>
    <td class="small">${fmtD(b.as_of)}</td><td>${bchip(b.status)}</td><td class="num">${peso(b.amount_due)}</td></tr>`;
  const owner = IS("owner");
  const due = list.filter(b => b.status === "sent").reduce((a, b) => a + (+b.amount_due || 0), 0);
  if (embed) return `<div class="row" style="justify-content:space-between;margin-top:8px"><h2 style="font-size:22px">Progress billing</h2>
    <div class="row"><select id="bf" data-local="reportFilter" aria-label="Project"><option value="">All projects</option>${S.projects.map(p => `<option value="${p.id}" ${p.id === S.reportFilter ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>${owner ? `<button class="btn primary" data-a="new-bill">New progress billing</button>` : ""}</div></div>
    ${billingGroups(list, row, owner)}`;
  return `
  <div class="head"><div><h1>${owner ? "Progress billing" : "Billing"}</h1><p class="sub">${owner ? "Prepare billing from the accomplishment to date. Clients see a billing once you send it, and can accept it or raise a concern." : "Progress billings from LDM Construction. Review each one and accept it, or raise a concern if something needs checking."}</p></div>
  <div class="row"><select id="bf" data-local="reportFilter" aria-label="Project"><option value="">All projects</option>${S.projects.map(p => `<option value="${p.id}" ${p.id === S.reportFilter ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
  ${owner ? `<button class="btn primary" data-a="new-bill">New progress billing</button>` : ""}</div></div>
  ${!owner && due ? `<div class="answer"><b style="font-size:15px">${peso(due)}</b> in billing waiting for your review.</div>` : ""}
  ${billingGroups(list, row, owner)}`;
}

function vBill() {
  const b = S.billings.find(x => x.id === S.viewBilling);
  if (!b) return `<div class="empty">This billing isn't available. <a href="#billing">Back to billing</a></div>`;
  const p = S.projects.find(x => x.id === b.project_id) || {};
  const c = b.status === "draft" ? billCalc(b) : { gross: +b.gross_to_date, net: +b.net_to_date, prevNet: +b.previous_net, due: +b.amount_due, recoup: r2(b.gross_to_date * b.dp_percent / 100), retention: r2(b.gross_to_date * b.retention_percent / 100), acc: b.contract_amount ? b.gross_to_date / b.contract_amount : 0 };
  const owner = IS("owner");
  const paid = S.collections.filter(k => k.projectId === b.project_id && (k.reference || "").includes(`PB ${b.billing_no}`)).reduce((a, k) => a + k.amount, 0);
  const pct = v => (Math.round(v * 100) / 100).toFixed(2) + "%";
  return `
  <div class="head no-print"><div><a href="#billing" class="small">← All billing</a><h1>Progress Billing No. ${b.billing_no}</h1><div class="row" style="margin-top:6px">${bchip(b.status)}${owner && b.status === "draft" ? `<span class="small muted">Not visible to the client yet</span>` : ""}</div></div>
  <div class="row">
    ${owner && b.status !== "accepted" ? `<button class="btn" data-a="edit-bill" data-id="${b.id}">Edit</button>` : ""}
    ${owner && (b.status === "draft" || b.status === "disputed") ? `<button class="btn primary" data-a="send-bill" data-id="${b.id}">${b.status === "disputed" ? "Send revised billing" : "Send to client"}</button>` : ""}
    ${owner && b.status === "accepted" ? `<button class="btn primary" data-a="pay-bill" data-id="${b.id}">Record payment</button>` : ""}
    <button class="btn" data-a="print">Print or save as PDF</button>
    ${owner ? `<button class="btn danger" data-a="del-bill" data-id="${b.id}">Delete</button>` : ""}</div></div>
  ${b.status === "disputed" && b.client_note ? `<div class="answer no-print" style="border-left-color:var(--bad);background:var(--bad-soft)"><b style="font-size:15px">${owner ? "Client's concern" : "Your concern"} (${fmtD((b.responded_at || "").slice(0, 10))}):</b> ${esc(b.client_note)}</div>` : ""}
  ${IS("client") && b.status === "sent" ? `<div class="card no-print"><h2>Your response</h2><p class="small muted" style="margin:0">Accepting confirms the accomplishment and amount due shown below. If something doesn't look right, raise a concern and LDM will review and send a revised billing.</p>
    <label class="f" for="bill-note">Comment (needed if raising a concern)<textarea id="bill-note" rows="2"></textarea></label>
    <div class="row"><button class="btn primary" data-a="accept-bill" data-id="${b.id}">Accept billing</button><button class="btn" data-a="dispute-bill" data-id="${b.id}">Raise a concern</button></div></div>` : ""}
  <article class="report-doc">
    <header class="rd-head"><img src="logo.png" alt="LDM Construction"><div><b>Progress Billing No. ${b.billing_no}</b><span>As of ${fmtD(b.as_of)}${b.period_start ? ` · Period ${fmtD(b.period_start)} to ${fmtD(b.period_end)}` : ""}</span></div></header>
    <div class="rd-info">
      <div><span>Project</span><b>${esc(p.name || "")}</b></div><div><span>Client</span><b>${esc(p.client || "—")}</b></div>
      <div><span>Location</span><b>${esc(p.location || "—")}</b></div><div><span>Contract basis</span><b>${esc(b.basis)} contract · ${peso(b.contract_amount)}</b></div>
    </div>
    <section><h3>Accomplishment</h3><div class="scroll"><table class="btable"><thead><tr><th>Item of work</th><th class="num">Weight</th><th class="num">Previous</th><th class="num">This period</th><th class="num">To date</th><th class="num">Amount to date</th></tr></thead><tbody>
      ${(b.items || []).map(it => { const td = Math.min(100, (+it.p || 0) + (+it.n || 0)); return `<tr><td>${esc(it.d)}</td><td class="num">${pct(+it.w || 0)}</td><td class="num">${pct(+it.p || 0)}</td><td class="num">${pct(+it.n || 0)}</td><td class="num"><b>${pct(td)}</b></td><td class="num">${peso(b.contract_amount * (+it.w || 0) / 100 * td / 100)}</td></tr>`; }).join("")}
    </tbody><tfoot><tr><td>Total accomplishment</td><td class="num">${pct((b.items || []).reduce((a, it) => a + (+it.w || 0), 0))}</td><td></td><td></td><td class="num">${pct(c.acc * 100)}</td><td class="num">${peso(c.gross)}</td></tr></tfoot></table></div></section>
    <section><h3>Billing summary</h3><table class="bsum"><tbody>
      <tr><td>Gross accomplishment to date</td><td class="num">${peso(c.gross)}</td></tr>
      ${+b.dp_percent ? `<tr><td>Less downpayment recoupment (${b.dp_percent}%)</td><td class="num">(${peso(c.recoup)})</td></tr>` : ""}
      ${+b.retention_percent ? `<tr><td>Less retention (${b.retention_percent}%)</td><td class="num">(${peso(c.retention)})</td></tr>` : ""}
      <tr><td>Net amount to date</td><td class="num">${peso(c.net)}</td></tr>
      <tr><td>Less previous billings</td><td class="num">(${peso(c.prevNet)})</td></tr>
      <tr class="due"><td>Amount due this billing</td><td class="num">${peso(c.due)}</td></tr>
    </tbody></table></section>
    ${b.notes ? `<section><h3>Notes</h3><p class="pre">${esc(b.notes)}</p></section>` : ""}
    <footer class="rd-foot"><div><span>Prepared by</span><b>LDM Construction</b>${b.sent_at ? `<span>Sent ${fmtD(b.sent_at.slice(0, 10))}</span>` : ""}</div>
      <div><span>Client acceptance</span><b>${b.status === "accepted" ? esc(nameOf(b.responded_by)) : "—"}</b>${b.status === "accepted" && b.responded_at ? `<span>Accepted ${fmtD(b.responded_at.slice(0, 10))}${b.client_note ? " · " + esc(b.client_note) : ""}</span>` : ""}</div></footer>
    ${owner && b.status === "accepted" ? `<p class="small muted no-print" style="margin:0">Payments recorded against this billing: ${peso(paid)} of ${peso(b.amount_due)}.</p>` : ""}
    <p class="rd-addr">LDM Construction OPC · 2F Mandaue Foam Bldg, Shaw Boulevard, Addition Hills, Mandaluyong City</p>
  </article>`;
}

let BDRAFT = null;
function newBillingFor(pid, basis) {
  const p = S.projects.find(x => x.id === pid) || {};
  const prev = S.billings.filter(x => x.project_id === pid && x.basis === basis && x.status !== "draft").sort((a, c) => c.billing_no - a.billing_no)[0];
  const no = Math.max(0, ...S.billings.filter(x => x.project_id === pid).map(x => x.billing_no)) + 1;
  let items;
  if (prev) items = (prev.items || []).map(it => ({ d: it.d, w: +it.w || 0, p: Math.min(100, (+it.p || 0) + (+it.n || 0)), n: 0 }));
  else if (basis === "Design") items = [{ d: "Design services", w: 100, p: 0, n: p.phaseProgress ? phasePct(p, "Design") : 0 }];
  else {
    const ph = applicable(p).filter(x => basis === "Total" || x !== "Design");
    const w = ph.length ? Math.floor(10000 / ph.length) / 100 : 0;
    items = ph.map((x, i) => ({ d: x, w: i === ph.length - 1 ? r2(100 - w * (ph.length - 1)) : w, p: 0, n: p.phaseProgress ? phasePct(p, x) : 0 }));
  }
  return { project_id: pid, basis, billing_no: no, as_of: ymd(new Date()), period_start: "", period_end: "", contract_amount: basisAmount(p, basis),
    items, dp_percent: prev ? +prev.dp_percent : 0, retention_percent: prev ? +prev.retention_percent : 10, notes: "", status: "draft" };
}

function billingForm(b) {
  const projs = S.projects.filter(p => p.status !== "Proposal");
  if (!projs.length) { toast("Add a project first."); return; }
  BDRAFT = b ? JSON.parse(JSON.stringify(b)) : newBillingFor(S.reportFilter || projs[0].id, "Construction");
  drawBillingForm();
}
function drawBillingForm() {
  const b = BDRAFT, isNew = !b.id;
  const projs = S.projects.filter(p => p.status !== "Proposal");
  openModal(`<h2>${isNew ? "New progress billing" : `Edit Progress Billing No. ${b.billing_no}`}</h2>
  <form id="bif" class="fg" onsubmit="return false">
    <label class="f wide" for="b-proj">Project<select id="b-proj" ${isNew ? "" : "disabled"}>${projs.map(p => `<option value="${p.id}" ${p.id === b.project_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="f" for="b-basis">Bill against<select id="b-basis" ${isNew ? "" : "disabled"}>${[["Construction", "Construction contract"], ["Design", "Design contract"], ["Total", "Total contract"]].map(([v, t]) => `<option value="${v}" ${v === b.basis ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="f" for="b-no">Billing no.<input id="b-no" type="number" min="1" value="${b.billing_no}"></label>
    <label class="f" for="b-asof">As of<input id="b-asof" type="date" value="${esc(b.as_of)}"></label>
    <label class="f" for="b-ps">Period from<input id="b-ps" type="date" value="${esc(b.period_start || "")}"></label>
    <label class="f" for="b-pe">Period to<input id="b-pe" type="date" value="${esc(b.period_end || "")}"></label>
    <label class="f" for="b-contract">Contract amount (₱)<input id="b-contract" type="number" min="0" step="0.01" value="${b.contract_amount}"></label>
    <label class="f" for="b-dp">Downpayment recoupment (%)<input id="b-dp" type="number" min="0" max="100" step="0.01" value="${b.dp_percent}"></label>
    <label class="f" for="b-ret">Retention (%)<input id="b-ret" type="number" min="0" max="100" step="0.01" value="${b.retention_percent}"></label>
  </form>
  <div class="sec">Accomplishment</div>
  <div class="scroll"><table class="bitems"><thead><tr><th>Item of work</th><th class="num">Weight %</th><th class="num">Previous %</th><th class="num">This period %</th><th class="num">To date %</th><th></th></tr></thead><tbody id="b-items">
    ${b.items.map((it, i) => `<tr><td><input data-bi="${i}" data-k="d" value="${esc(it.d)}" aria-label="Item"></td><td><input data-bi="${i}" data-k="w" type="number" step="0.01" min="0" value="${it.w}" aria-label="Weight"></td>
      <td><input data-bi="${i}" data-k="p" type="number" step="0.01" min="0" max="100" value="${it.p}" aria-label="Previous"></td><td><input data-bi="${i}" data-k="n" type="number" step="0.01" min="0" max="100" value="${it.n}" aria-label="This period"></td>
      <td class="num" id="b-td-${i}">${(Math.min(100, (+it.p || 0) + (+it.n || 0))).toFixed(2)}</td><td><button type="button" class="btn sm" data-a="bill-rmrow" data-i="${i}" aria-label="Remove item">✕</button></td></tr>`).join("")}
  </tbody></table></div>
  <button type="button" class="btn sm" data-a="bill-addrow" style="align-self:flex-start">Add item</button>
  <div class="calc" id="b-calc"></div>
  <label class="f" for="b-notes">Notes to client<textarea id="b-notes" rows="2" placeholder="e.g. Payment terms, bank details, items excluded">${esc(b.notes || "")}</textarea></label>
  <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn" data-a="save-bill" data-s="draft">Save draft</button><button class="btn primary" data-a="save-bill" data-s="sent">Save and send to client</button></div></div>`);
  updateBillCalc();
}
function readBillingForm() {
  const b = BDRAFT; const g = id => document.getElementById(id);
  b.billing_no = +g("b-no").value || 1; b.as_of = g("b-asof").value; b.period_start = g("b-ps").value; b.period_end = g("b-pe").value;
  b.contract_amount = +g("b-contract").value || 0; b.dp_percent = +g("b-dp").value || 0; b.retention_percent = +g("b-ret").value || 0; b.notes = g("b-notes").value;
  document.querySelectorAll("[data-bi]").forEach(inp => { const it = b.items[+inp.dataset.bi]; if (!it) return; it[inp.dataset.k] = inp.dataset.k === "d" ? inp.value : (+inp.value || 0); });
  b.items.forEach(it => { it.p = Math.max(0, Math.min(100, +it.p || 0)); it.n = Math.max(0, Math.min(100 - it.p, +it.n || 0)); });
}
function updateBillCalc() {
  const box = document.getElementById("b-calc"); if (!box) return;
  readBillingForm(); const c = billCalc(BDRAFT);
  BDRAFT.items.forEach((it, i) => { const td = document.getElementById("b-td-" + i); if (td) td.textContent = Math.min(100, (+it.p || 0) + (+it.n || 0)).toFixed(2); });
  box.innerHTML = `<div><span>Accomplishment to date</span><b>${(c.acc * 100).toFixed(2)}%</b><span class="${Math.abs(c.weight - 100) > 0.01 ? "neg" : ""}">Weights total ${c.weight.toFixed(2)}%${Math.abs(c.weight - 100) > 0.01 ? " (should be 100%)" : ""}</span></div>
    <div><span>Gross to date</span><b>${peso(c.gross)}</b><span>less recoupment ${pesoS(c.recoup)}, retention ${pesoS(c.retention)}</span></div>
    <div><span>Net to date</span><b>${peso(c.net)}</b><span>less previous billings ${pesoS(c.prevNet)}</span></div>
    <div><span>Amount due this billing</span><b class="${c.due < 0 ? "neg" : "pos"}">${peso(c.due)}</b></div>`;
}

async function saveBilling(status) {
  readBillingForm(); const b = BDRAFT, c = billCalc(b);
  if (Math.abs(c.weight - 100) > 0.01 && !confirmWeights) { confirmWeights = true; toast(`Item weights add up to ${c.weight.toFixed(2)}%, not 100%. Click save again to keep it anyway.`); return null; }
  confirmWeights = false;
  const body = { project_id: b.project_id, billing_no: b.billing_no, basis: b.basis, as_of: b.as_of, period_start: nz(b.period_start), period_end: nz(b.period_end),
    contract_amount: b.contract_amount, items: b.items, dp_percent: b.dp_percent, retention_percent: b.retention_percent, notes: b.notes || "",
    gross_to_date: c.gross, net_to_date: c.net, previous_net: c.prevNet, amount_due: c.due, status };
  if (b.id) return await q(sb.from("progress_billings").update(body).eq("id", b.id).select().single());
  return await q(sb.from("progress_billings").insert(body).select().single());
}
let confirmWeights = false;

/* Owner: client paid expenses waiting to be reimbursed (shown on the Collections page). */
function clientOwedCard() {
  if (!IS("owner")) return "";
  const rows = S.costs.filter(c => c.paidFrom === "client").sort((a, b) => (Number(a.reimbursed) - Number(b.reimbursed)) || (b.date || "").localeCompare(a.date || ""));
  const pend = rows.filter(c => !c.reimbursed);
  return `<div class="card scroll"><h2>Owed back to clients (${pend.length})</h2><p class="small muted" style="margin:0">Expenses a client paid for. Log them in costs with "Paid by client". Clients see these on their account.</p>
    ${rows.length ? `<table><thead><tr><th>Date</th><th>Project</th><th>Item</th><th class="num">Amount</th><th></th></tr></thead><tbody>
    ${rows.slice(0, 20).map(c => `<tr><td class="small">${fmtD(c.date)}</td><td class="small">${esc(projName(c.projectId))}</td><td class="small">${esc(c.category)}${c.description ? " · " + esc(c.description) : ""}</td><td class="num">${peso(c.amount)}</td>
      <td>${c.reimbursed ? `<span class="chip Ongoing">Reimbursed</span>` : `<button class="btn sm" data-a="reimb" data-id="${c.id}">Mark reimbursed</button>`}</td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="3">Still to reimburse</td><td class="num">${peso(pend.reduce((a, c) => a + c.amount, 0))}</td><td></td></tr></tfoot></table>` : `<div class="empty">Nothing owed to clients.</div>`}</div>`;
}

/* ---------- billing actions ---------- */
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, id = el.dataset.id;
  if (!/bill/.test(a)) return;
  if (el.tagName === "A") ev.preventDefault();
  try {
    if (a === "new-bill") billingForm();
    else if (a === "open-bill") { S.viewBilling = id; location.hash = "bill"; render(); }
    else if (a === "edit-bill") billingForm(S.billings.find(x => x.id === id));
    else if (a === "bill-addrow") { readBillingForm(); BDRAFT.items.push({ d: "", w: 0, p: 0, n: 0 }); drawBillingForm(); }
    else if (a === "bill-rmrow") { readBillingForm(); BDRAFT.items.splice(+el.dataset.i, 1); drawBillingForm(); }
    else if (a === "save-bill") {
      el.disabled = true; const row = await saveBilling(el.dataset.s); el.disabled = false;
      if (row) { closeModal(); await loadAll(); S.viewBilling = row.id; location.hash = "bill"; render(); toast(el.dataset.s === "sent" ? "Sent to the client" : "Draft saved"); }
    }
    else if (a === "send-bill") {
      const b = S.billings.find(x => x.id === id); BDRAFT = JSON.parse(JSON.stringify(b)); const c = billCalc(BDRAFT);
      el.disabled = true;
      await q(sb.from("progress_billings").update({ status: "sent", gross_to_date: c.gross, net_to_date: c.net, previous_net: c.prevNet, amount_due: c.due }).eq("id", id));
      await loadAll(); render(); toast("Sent to the client");
    }
    else if (a === "accept-bill" || a === "dispute-bill") {
      const note = ((document.getElementById("bill-note") || {}).value || "").trim();
      if (a === "dispute-bill" && !note) { toast("Please describe your concern so LDM can review it."); return; }
      el.disabled = true;
      await q(sb.rpc("respond_billing", { bid: id, accept: a === "accept-bill", note }));
      await loadAll(); render(); toast(a === "accept-bill" ? "Billing accepted. Thank you!" : "Your concern was sent to LDM");
    }
    else if (a === "pay-bill") {
      const b = S.billings.find(x => x.id === id);
      collectionForm({ projectId: b.project_id, date: ymd(new Date()), amount: b.amount_due, type: "Progress billing", stage: b.basis === "Design" ? "Design" : "Construction", reference: `PB ${b.billing_no}`, notes: `Progress Billing No. ${b.billing_no}` });
    }
    else if (a === "del-bill") {
      if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Click again to delete"; setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = "Delete"; } }, 4000); return; }
      await q(sb.from("progress_billings").delete().eq("id", id)); await loadAll(); location.hash = "billing"; render(); toast("Billing deleted");
    }
  } catch (e) { toast(friendly(e)); el.disabled = false; }
});
document.addEventListener("input", e => { if (e.target.closest && e.target.closest("#b-items, #bif")) updateBillCalc(); });
document.addEventListener("change", e => {
  if (e.target.id === "b-proj" || e.target.id === "b-basis") {
    BDRAFT = newBillingFor(document.getElementById("b-proj").value, document.getElementById("b-basis").value); drawBillingForm();
  }
});
