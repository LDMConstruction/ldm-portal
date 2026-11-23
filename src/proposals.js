/* ================================================================
   LDM Portal: design cost proposals and the client journey.
   Owner prepares a proposal, the client opens a private link and accepts,
   the owner onboards it into a project, and the client sees it in the portal.
   ================================================================ */
const PSTAT = { draft: ["Draft", "OnHold"], sent: ["Sent", "Proposal"], accepted: ["Accepted", "Ongoing"], declined: ["Declined", "Unconfirmed"], onboarded: ["Onboarded", "Onboarded"], expired: ["Expired", "Terminated"] };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
const ORD = n => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
Object.assign(S, { proposals: [], milestones: [], clientProposals: [], viewProposal: null, propFilter: "" });

function designTemplate() {
  return {
    intro: "We are pleased to submit our price proposal for the project mentioned above. Please find herewith our price proposal based on the following scope of works and terms and conditions for your evaluation and consideration.",
    items: [
      { item: "Architectural Plan", scopes: ["Perspective", "Floor Plan", "Reflected Ceiling Plan", "Elevations & Sections", "Schedule of Doors & Windows", "Miscellaneous Details"] },
      { item: "Structural Plan", scopes: ["Foundation Plan", "Structural Framing Plan", "Beam & Column Details", "Stair Details", "Roof Framing Plan"] },
      { item: "Electrical Plan", scopes: ["Power & Lighting Layout", "Load Schedule & Single Line Diagram", "General Notes & Specifications"] },
      { item: "Plumbing & Sanitary Plan", scopes: ["Waterline Plumbing Layout", "Sanitary Plumbing Layout", "Schematic Plumbing Layout", "Septic Vault Details"] },
      { item: "Bill of Quantities", scopes: ["Detailed Cost Estimate"] },
      { item: "Sign & Seal of Plans", scopes: ["Sign & Seal of Professionals"] },
      { item: "Printing", scopes: ["8 Sets of Blueprint of Complete set of plans"] }
    ],
    vat_note: "Prices are VAT Exclusive",
    flow: [
      { phase: "PHASE 1: Initial Design Development", items: ["Collection of Ideas", "Schematic design (floor plan layout) for approval"] },
      { phase: "PHASE 2: 3D Design Development", items: ["Initial 3D design perspectives for approval"] },
      { phase: "PHASE 3: Revision Stage", items: ["Revised design perspectives & floor plan layout for approval"] },
      { phase: "PHASE 4: Final Drawings & Detailing", items: ["Detailing of approved design perspectives & floor plan layout", "Development of the rest of corresponding plans"] },
      { phase: "PHASE 5: Printing of Documents", items: ["Printing of Plans", "Sign and Seal of Plans"] }
    ],
    terms_note: "Note: Additional works are subject to additional cost. Validity of this proposal is 30 days only.",
    terms: [
      "The Designer agrees to provide Architectural and Engineering drawings for the project mentioned above including all the documents that will be required by the City Hall.",
      "The cost proposal indicated is purely design only and all items not mentioned are not included in the proposal.",
      "The Designer shall revise the design up to the client's satisfaction with a maximum of 2 major revisions, further revisions shall be charged accordingly.",
      "LDM Construction retains the right to use the design for portfolio and marketing purposes unless the client provides a written request for confidentiality.",
      "If the client decides to terminate the service of the Designer in the middle of the contract, the client shall pay in full the total amount of the design fee based on percentage completed corresponding to the contract phase at the time of termination.",
      "Sign and seal fees and professional regulatory commission (PRC) requirements are included as indicated in the scope. Permit application fees and government charges are not part of this contract and shall be shouldered by the client.",
      "Any unauthorized reproduction, construction, or distribution of the designer's work/s, either as a whole or any recognizable part from the design is prohibited and will be subject to copyright law."
    ],
    payments: [
      { label: "1st Payment", pct: 50, milestone: "Down payment upon acceptance of this proposal" },
      { label: "2nd Payment", pct: 30, milestone: "Upon submission of Initial Design Development and 3D Perspectives" },
      { label: "3rd Payment", pct: 20, milestone: "Upon submission of Final Drawings and Complete set of Plans" }
    ],
    bank: { name: "EASTWEST BANK", account_name: "LDM CONSTRUCTION", account_no: "200063976198" },
    closing: "We thank you for giving us opportunity to quote and looking forward to be of service to you.",
    signatory: "Engr. Lester D. Miranda"
  };
}

const php = n => "PHP " + (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = d => { const x = parseD(d); return x ? x.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""; };
function propExpiry(p) { const d = parseD(p.proposal_date); if (!d) return null; const e = new Date(d); e.setDate(e.getDate() + (+p.valid_days || 30)); return e; }
function propStatus(p) { if (p.status === "sent") { const e = propExpiry(p); if (e && today() > e) return "expired"; } return p.status; }
const pchip = p => { const s = propStatus(p); return `<span class="chip ${PSTAT[s][1]}">${PSTAT[s][0]}</span>`; };
function propLink(p) { return location.origin + location.pathname + "?proposal=" + p.token; }

/* ---------- the proposal document (same layout as the Word proposal) ---------- */
function proposalDoc(p) {
  const c = { ...designTemplate(), ...(p.content || {}) };
  const accepted = ["accepted", "onboarded"].includes(p.status) && p.accepted_name;
  return `<article class="pdoc">
    <img class="pd-head" src="assets/letterhead.jpg" alt="LDM Construction, Engineers, Architects, Builders">
    <div class="pd-body">
      <div class="pd-meta"><div><b>Project:</b> ${esc(p.title)}</div><div><b>Date:</b> ${longDate(p.proposal_date)}</div>
        <div><b>Location:</b> ${esc(p.location)}</div><div><b>Client:</b> ${esc(p.client_name)}</div></div>
      <div class="pd-bar">${esc((p.kind || "Design").toUpperCase())} COST PROPOSAL</div>
      <p class="pd-intro">${esc(c.intro)}</p>
      <table class="pd-scope"><thead><tr><th>NO.</th><th>ITEM</th><th>SCOPE</th></tr></thead><tbody>
        ${(c.items || []).map((it, i) => `<tr><td class="c">${ROMAN[i] || i + 1}</td><td><b>${esc(it.item)}</b></td><td>${(it.scopes || []).map(s => esc(s)).join("<br>")}</td></tr>`).join("")}
        <tr class="pd-total"><td colspan="2">Total Contract Cost:</td><td>${php(p.total)}</td></tr></tbody></table>
      ${c.vat_note ? `<p class="pd-vat">* Note: ${esc(c.vat_note)}</p>` : ""}
      <h3 class="pd-h">PROJECT FLOW</h3>
      <div class="pd-flow">${(c.flow || []).map(f => `<b>${esc(f.phase)}</b><ul>${(f.items || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`).join("")}</div>
      <h3 class="pd-h">TERMS & CONDITION</h3>
      ${c.terms_note ? `<p class="pd-note">${esc(c.terms_note)}</p>` : ""}
      <ul class="pd-terms">${(c.terms || []).map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      <h3 class="pd-h plain">PAYMENT SCHEDULE</h3>
      <table class="pd-pay"><thead><tr><th>PAYMENT</th><th>MILESTONE</th><th>AMOUNT</th></tr></thead><tbody>
        ${(c.payments || []).map(x => `<tr><td>${esc(x.label)} — ${+x.pct || 0}%</td><td>${esc(x.milestone)}</td><td class="r">${php((+p.total || 0) * (+x.pct || 0) / 100)}</td></tr>`).join("")}
        <tr class="pd-ptotal"><td colspan="2">TOTAL CONTRACT COST:</td><td class="r">${php(p.total)}</td></tr></tbody></table>
      <p class="pd-closing">${esc(c.closing)}</p>
      ${c.bank && (c.bank.name || c.bank.account_no) ? `<dl class="pd-bank"><dt>Bank name</dt><dd>: ${esc(c.bank.name)}</dd><dt>Account name</dt><dd>: ${esc(c.bank.account_name)}</dd><dt>Account no</dt><dd>: ${esc(c.bank.account_no)}</dd></dl>` : ""}
      <p class="pd-conf">Conformed by:</p>
      <div class="pd-sign"><div><span class="sline"></span><b>${esc(c.signatory)}</b></div>
        <div>${accepted ? `<span class="accepted">Accepted online by ${esc(p.accepted_name)}</span>` : ""}<span class="sline"></span><b>Client/Owner</b><i>Date: ${accepted && p.responded_at ? longDate(p.responded_at.slice(0, 10)) : "_____________"}</i></div></div>
    </div>
    <footer class="pd-foot"><div><b>Contact us :</b><span>☎ 0945 681 0515</span><span>ⓕ https://www.facebook.com/ldm.designbuild</span><span>✉ ldmengineeringdesign@gmail.com</span></div>
      <div class="r"><b>LDM Construction OPC</b><span>2F Mandaue Foam Bldg, Shaw Boulevard</span><span>Addition Hills, Mandaluyong City</span></div></footer>
  </article>`;
}

/* ---------- owner: tracker ---------- */
function vProposals() {
  const all = S.proposals.slice().sort((a, b) => (b.proposal_date || "").localeCompare(a.proposal_date || "") || (b.created_at || "").localeCompare(a.created_at || ""));
  const by = s => all.filter(p => propStatus(p) === s);
  const sum = arr => arr.reduce((a, p) => a + (+p.total || 0), 0);
  const responded = all.filter(p => ["accepted", "declined", "onboarded"].includes(p.status));
  const won = all.filter(p => ["accepted", "onboarded"].includes(p.status));
  const thisMonth = all.filter(p => (p.proposal_date || "").startsWith(ym(new Date())));
  const row = p => { const e = propExpiry(p), st = propStatus(p);
    return `<tr class="click" data-a="open-prop" data-id="${p.id}"><td><b>${esc(p.client_name || "—")}</b><div class="small muted">${esc(p.proposal_no)} · ${esc(p.title)}</div></td>
      <td class="small">${esc(p.location)}</td><td class="small">${fmtD(p.proposal_date)}${st === "sent" && e ? `<div class="muted">valid until ${fmtD(ymd(e))}</div>` : ""}</td><td>${pchip(p)}</td><td class="num">${peso(p.total)}</td>
      <td>${p.status === "accepted" ? `<button class="btn sm primary" data-a="onboard-prop" data-id="${p.id}">Onboard</button>` : p.project_id ? `<a href="#" class="small" data-a="goto-project" data-id="${p.project_id}">Open project</a>` : ""}</td></tr>`; };
  const group = (title, list, empty) => `<div class="card scroll"><h2>${title} (${list.length})</h2>${list.length ? `<table><thead><tr><th>Client and project</th><th>Location</th><th>Date</th><th>Status</th><th class="num">Amount</th><th></th></tr></thead><tbody>${list.map(row).join("")}</tbody></table>` : `<div class="empty">${empty}</div>`}</div>`;
  return `
  <div class="head"><div><h1>Proposals</h1><p class="sub">Prepare design cost proposals, send the client a link to accept, then onboard them into a project.</p></div>
  <button class="btn primary" data-a="new-prop">New design proposal</button></div>
  <div class="grid-tiles">
    <div class="tile"><span class="k">Waiting for client</span><span class="v">${by("sent").length}</span><span class="h">${peso(sum(by("sent")))} in open proposals</span></div>
    <div class="tile hi"><span class="k">Accepted, to onboard</span><span class="v">${by("accepted").length}</span><span class="h">${peso(sum(by("accepted")))}</span></div>
    <div class="tile"><span class="k">Win rate</span><span class="v">${responded.length ? Math.round(won.length / responded.length * 100) + "%" : "–"}</span><span class="h">${won.length} won of ${responded.length} answered</span></div>
    <div class="tile"><span class="k">This month</span><span class="v">${thisMonth.length}</span><span class="h">${peso(sum(thisMonth))} proposed</span></div>
  </div>
  ${group("Accepted, ready to onboard", by("accepted"), "No accepted proposals waiting.")}
  ${group("Sent, waiting for client", by("sent"), "No proposals waiting for a reply.")}
  ${by("expired").length ? group("Expired", by("expired"), "") : ""}
  ${group("Drafts", by("draft"), "No drafts.")}
  ${by("onboarded").length ? group("Onboarded", by("onboarded"), "") : ""}
  ${by("declined").length ? group("Declined", by("declined"), "") : ""}`;
}

function vProposal() {
  const p = S.proposals.find(x => x.id === S.viewProposal) || S.clientProposals.find(x => x.id === S.viewProposal);
  if (!p) return `<div class="empty">This proposal isn't available. <a href="#${IS("owner") ? "proposals" : "home"}">Go back</a></div>`;
  const owner = IS("owner"), st = propStatus(p);
  const steps = [["Prepared", p.created_at], ["Sent", p.sent_at], [p.status === "declined" ? "Declined" : "Accepted", p.status === "declined" || ["accepted", "onboarded"].includes(p.status) ? p.responded_at : null], ["Onboarded", p.project_id ? 1 : null]];
  return `
  <div class="head no-print"><div><a href="#${owner ? "proposals" : "home"}" class="small">← ${owner ? "All proposals" : "My project"}</a><h1>${esc(p.proposal_no)} · ${esc(p.client_name)}</h1><div class="row" style="margin-top:6px">${owner ? pchip(p) : ""}</div></div>
  <div class="row">
    ${owner && ["draft", "sent"].includes(p.status) ? `<button class="btn" data-a="edit-prop" data-id="${p.id}">Edit</button>` : ""}
    ${owner && p.status === "draft" ? `<button class="btn primary" data-a="send-prop" data-id="${p.id}">Mark as sent</button>` : ""}
    ${owner && p.status === "accepted" ? `<button class="btn primary" data-a="onboard-prop" data-id="${p.id}">Onboard client</button>` : ""}
    ${owner ? `<button class="btn" data-a="dup-prop" data-id="${p.id}">Duplicate</button>` : ""}
    <button class="btn" data-a="print">Print or save as PDF</button>
    ${owner && p.status !== "onboarded" ? `<button class="btn danger" data-a="del-prop" data-id="${p.id}">Delete</button>` : ""}</div></div>
  ${owner ? `<div class="card no-print"><div class="steps4">${steps.map(([t, d]) => `<div class="${d ? "on" : ""}"><b>${t}</b><span>${d && d !== 1 ? fmtD(String(d).slice(0, 10)) : d ? "✓" : "—"}</span></div>`).join("")}</div>
    ${p.status === "sent" || st === "expired" ? `<div class="answer"><b style="font-size:15px">Client link:</b> send this to ${esc(p.client_name || "the client")} by email, Viber or Messenger. They can read the proposal and accept it online, no account needed.
      <div class="row" style="margin-top:8px"><input class="tin" id="plink" readonly value="${esc(propLink(p))}" style="flex:1;min-width:220px"><button class="btn sm" data-a="copy-plink">Copy link</button></div>
      ${st === "expired" ? `<p class="small neg" style="margin:6px 0 0">Expired. The client can't accept until you edit the date or validity.</p>` : ""}
      <div class="row" style="margin-top:8px"><span class="small muted">Client confirmed another way?</span><button class="btn sm" data-a="accept-prop-manual" data-id="${p.id}">Mark as accepted</button><button class="btn sm" data-a="decline-prop-manual" data-id="${p.id}">Mark as declined</button></div></div>` : ""}
    ${p.client_note ? `<p class="small" style="margin:0"><b>Client's note:</b> ${esc(p.client_note)}</p>` : ""}
    ${p.status === "onboarded" ? `<p class="small" style="margin:0">Onboarded as <a href="#" data-a="goto-project" data-id="${p.project_id}">${esc(projName(p.project_id))}</a>. ${p.client_email ? `When ${esc(p.client_name || "the client")} creates an account with ${esc(p.client_email)}, it's linked to the project automatically.` : "Add the client's email in Team & Access once they sign up."}</p>` : ""}
  </div>` : ""}
  ${proposalDoc(p)}`;
}

/* ---------- owner: editor ---------- */
let PDRAFT = null;
function nextProposalNo() { const y = new Date().getFullYear(); const n = S.proposals.filter(p => (p.proposal_no || "").startsWith(`DP-${y}-`)).length + 1; return `DP-${y}-${String(n).padStart(3, "0")}`; }
function proposalForm(p, dup) {
  PDRAFT = p ? JSON.parse(JSON.stringify(p)) : { proposal_no: nextProposalNo(), kind: "Design", title: "", location: "", client_name: "", client_email: "", client_phone: "", proposal_date: ymd(new Date()), valid_days: 30, total: 0, content: designTemplate(), status: "draft" };
  if (dup) { delete PDRAFT.id; delete PDRAFT.token; Object.assign(PDRAFT, { proposal_no: nextProposalNo(), status: "draft", proposal_date: ymd(new Date()), project_id: null, accepted_name: "", client_note: "", responded_at: null, sent_at: null }); }
  PDRAFT.content = { ...designTemplate(), ...(PDRAFT.content || {}) };
  drawProposalForm();
}
function drawProposalForm() {
  const p = PDRAFT, c = p.content;
  const inp = (id, label, val, type = "text", extra = "") => `<label class="f" for="${id}">${label}<input id="${id}" type="${type}" value="${esc(val ?? "")}" ${extra}></label>`;
  openModal(`<h2>${p.id ? "Edit proposal " + esc(p.proposal_no) : "New design proposal"}</h2>
  <div class="sec">Client and project</div>
  <div class="fg">
    ${inp("pp-title", "Project", p.title, "text", 'placeholder="e.g. Proposed 150 sqm 2 Storey Residential House" required').replace('class="f"', 'class="f wide"')}
    ${inp("pp-loc", "Location", p.location)}${inp("pp-client", "Client name", p.client_name)}
    ${inp("pp-email", "Client email (links their portal account later)", p.client_email, "email")}${inp("pp-phone", "Client mobile", p.client_phone)}
    ${inp("pp-no", "Proposal no.", p.proposal_no)}${inp("pp-date", "Date", p.proposal_date, "date")}${inp("pp-valid", "Valid for (days)", p.valid_days, "number", 'min="1"')}
  </div>
  <div class="sec">Scope of work</div>
  <div class="pp-items">${c.items.map((it, i) => `<div class="pp-item"><span class="pp-no">${ROMAN[i] || i + 1}</span><input data-pi="${i}" data-k="item" value="${esc(it.item)}" aria-label="Item" placeholder="Item">
    <textarea data-pi="${i}" data-k="scopes" rows="${Math.max(2, (it.scopes || []).length)}" aria-label="Scope, one per line" placeholder="Scope, one per line">${esc((it.scopes || []).join("\n"))}</textarea><button type="button" class="btn sm" data-a="pp-rmitem" data-i="${i}" aria-label="Remove item">✕</button></div>`).join("")}</div>
  <button type="button" class="btn sm" data-a="pp-additem" style="align-self:flex-start">Add item</button>
  <div class="fg">${inp("pp-total", "Total contract cost (PHP)", p.total || "", "number", 'min="0" step="0.01"')}${inp("pp-vat", "Note under the total", c.vat_note)}</div>
  <div class="sec">Payment schedule</div>
  <div class="pp-pays">${c.payments.map((x, i) => `<div class="pp-pay"><input data-pp="${i}" data-k="label" value="${esc(x.label)}" aria-label="Payment"><input data-pp="${i}" data-k="pct" type="number" step="0.01" min="0" value="${x.pct}" aria-label="Percent"><span>%</span>
    <input data-pp="${i}" data-k="milestone" value="${esc(x.milestone)}" aria-label="Milestone"><b id="pp-amt-${i}"></b><button type="button" class="btn sm" data-a="pp-rmpay" data-i="${i}" aria-label="Remove payment">✕</button></div>`).join("")}</div>
  <div class="row"><button type="button" class="btn sm" data-a="pp-addpay">Add payment</button><span class="small" id="pp-paysum"></span></div>
  <details><summary class="small">Project flow, terms, bank details and wording</summary>
    <div class="fg" style="margin-top:10px">
      <label class="f wide" for="pp-intro">Opening paragraph<textarea id="pp-intro" rows="3">${esc(c.intro)}</textarea></label>
      <label class="f wide" for="pp-flow">Project flow (a line starting with PHASE begins a phase; other lines are its items)<textarea id="pp-flow" rows="10">${esc(c.flow.map(f => [f.phase, ...f.items.map(x => "- " + x)].join("\n")).join("\n"))}</textarea></label>
      <label class="f wide" for="pp-tnote">Note above the terms<input id="pp-tnote" value="${esc(c.terms_note)}"></label>
      <label class="f wide" for="pp-terms">Terms and conditions (one per line)<textarea id="pp-terms" rows="8">${esc(c.terms.join("\n"))}</textarea></label>
      ${inp("pp-bank", "Bank name", c.bank.name)}${inp("pp-bacct", "Account name", c.bank.account_name)}${inp("pp-bno", "Account no.", c.bank.account_no)}
      ${inp("pp-sign", "Signed by", c.signatory)}
      <label class="f wide" for="pp-closing">Closing line<input id="pp-closing" value="${esc(c.closing)}"></label>
    </div></details>
  <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn" data-a="save-prop" data-s="draft">Save draft</button><button class="btn primary" data-a="save-prop" data-s="sent">Save and get client link</button></div></div>`);
  updatePropCalc();
}
function readProposalForm() {
  const p = PDRAFT, c = p.content, g = id => (document.getElementById(id) || {}).value;
  if (g("pp-title") === undefined) return;
  Object.assign(p, { title: g("pp-title").trim(), location: g("pp-loc").trim(), client_name: g("pp-client").trim(), client_email: g("pp-email").trim(), client_phone: g("pp-phone").trim(),
    proposal_no: g("pp-no").trim(), proposal_date: g("pp-date"), valid_days: +g("pp-valid") || 30, total: +g("pp-total") || 0 });
  c.vat_note = g("pp-vat");
  document.querySelectorAll("[data-pi]").forEach(e => { const it = c.items[+e.dataset.pi]; if (!it) return; if (e.dataset.k === "item") it.item = e.value; else it.scopes = e.value.split("\n").map(s => s.trim()).filter(Boolean); });
  document.querySelectorAll("[data-pp]").forEach(e => { const x = c.payments[+e.dataset.pp]; if (!x) return; x[e.dataset.k] = e.dataset.k === "pct" ? (+e.value || 0) : e.value; });
  if (g("pp-intro") !== undefined) {
    c.intro = g("pp-intro"); c.terms_note = g("pp-tnote"); c.closing = g("pp-closing"); c.signatory = g("pp-sign");
    c.terms = g("pp-terms").split("\n").map(s => s.trim()).filter(Boolean);
    c.bank = { name: g("pp-bank"), account_name: g("pp-bacct"), account_no: g("pp-bno") };
    const flow = []; g("pp-flow").split("\n").map(s => s.trim()).filter(Boolean).forEach(l => { if (/^phase\b/i.test(l) || !flow.length) flow.push({ phase: l.replace(/^-\s*/, ""), items: [] }); else flow[flow.length - 1].items.push(l.replace(/^[-•]\s*/, "")); });
    c.flow = flow;
  }
}
function updatePropCalc() {
  readProposalForm(); const p = PDRAFT, c = p.content;
  c.payments.forEach((x, i) => { const e = document.getElementById("pp-amt-" + i); if (e) e.textContent = php(p.total * (+x.pct || 0) / 100); });
  const s = c.payments.reduce((a, x) => a + (+x.pct || 0), 0), el = document.getElementById("pp-paysum");
  if (el) { el.textContent = `Payments total ${s}%` + (Math.abs(s - 100) > 0.001 ? " (should be 100%)" : ""); el.className = "small " + (Math.abs(s - 100) > 0.001 ? "neg" : "muted"); }
}
async function saveProposal(status) {
  readProposalForm(); const p = PDRAFT;
  if (!p.title) { toast("Enter the project, for example Proposed 150 sqm 2 Storey Residential House."); return null; }
  if (!p.client_name) { toast("Enter the client's name."); return null; }
  if (!p.total) { toast("Enter the total contract cost."); return null; }
  const body = { proposal_no: p.proposal_no, kind: p.kind || "Design", title: p.title, location: p.location, client_name: p.client_name, client_email: p.client_email, client_phone: p.client_phone,
    proposal_date: p.proposal_date, valid_days: p.valid_days, total: p.total, content: p.content, status: p.status === "draft" || !p.id ? status : p.status };
  if (p.id) return await q(sb.from("proposals").update(body).eq("id", p.id).select().single());
  return await q(sb.from("proposals").insert(body).select().single());
}

function onboardForm(p) {
  const last = (p.client_name || "").replace(/^(mr|mrs|ms|engr|arch|dr|spouses)\.?\s+/i, "").trim().split(/\s+/).pop() || "";
  openModal(`<h2>Onboard ${esc(p.client_name)}</h2>
  <p class="small muted" style="margin:0">This creates the project in Onboarded status, Design phase, with a design contract of ${peso(p.total)} and the ${p.content && p.content.payments ? p.content.payments.length : 0} payment milestones from the proposal. ${p.client_email ? `When the client creates an account with ${esc(p.client_email)}, they see their project automatically.` : "No client email on the proposal, so link their account in Team & Access after they sign up."}</p>
  <label class="f" for="ob-name">Project name<input id="ob-name" value="${esc(last ? last + " Residence" : p.title)}"></label>
  <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="onboard-go" data-id="${p.id}">Onboard client</button></div></div>`);
}

/* ---------- client: payment schedule and proposal on their project ---------- */
function clientScheduleCard(p) {
  const ms = S.milestones.filter(m => m.project_id === p.id).sort((a, b) => (a.stage > b.stage ? 1 : -1) || a.sort - b.sort);
  const props = S.clientProposals.filter(x => x.project_id === p.id);
  if (!ms.length && !props.length) return "";
  let html = "";
  ["Design", "Construction"].forEach(stage => {
    const rows = ms.filter(m => m.stage === stage); if (!rows.length) return;
    let paid = S.collections.filter(c => c.projectId === p.id && c.stage === stage).reduce((a, c) => a + c.amount, 0), cum = 0;
    html += `<h3 class="sec" style="border:none;padding:0">${stage} payment schedule</h3><table><thead><tr><th>Payment</th><th>Milestone</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>
      ${rows.map(m => { cum += +m.amount; const done = paid >= cum - 0.5; const part = !done && paid > cum - m.amount + 0.5;
        return `<tr><td class="small">${esc(m.label)} · ${+m.percent}%</td><td class="small">${esc(m.milestone)}</td><td class="num">${peso(m.amount)}</td><td>${done ? `<span class="chip Ongoing">Paid</span>` : part ? `<span class="chip Proposal">Partly paid</span>` : `<span class="chip OnHold">Due</span>`}</td></tr>`; }).join("")}</tbody></table>`;
  });
  return html + props.map(x => `<p class="small" style="margin:0">Your ${esc((x.content && x.content.kind) || "design")} proposal ${esc(x.proposal_no)}, accepted ${fmtD((x.responded_at || "").slice(0, 10))}. <a href="#" data-a="open-prop" data-id="${x.id}">View proposal</a></p>`).join("");
}

/* ---------- public page: client opens the proposal link ---------- */
async function showPublicProposal(token) {
  document.querySelector(".app").hidden = true; document.getElementById("auth").hidden = true;
  const box = document.getElementById("public"); box.hidden = false;
  let p;
  try { p = await q(sb.rpc("proposal_by_token", { t: token })); } catch (e) { p = null; }
  if (!p) { box.innerHTML = `<div class="acard" style="margin:40px auto"><img src="logo.png" alt="LDM Construction"><h2>Proposal not found</h2><p>This link may be incomplete. Please check the link LDM sent you, or contact us at 0945 681 0515.</p></div>`; return; }
  const st = propStatus(p), done = ["accepted", "onboarded"].includes(p.status);
  box.innerHTML = `<div class="pub">
    <div class="card no-print pub-card">
      ${done ? `<h2>Thank you, ${esc(p.accepted_name)}!</h2><p>You accepted this proposal on ${longDate((p.responded_at || "").slice(0, 10))}. LDM will be in touch about the down payment and next steps.</p>
        <p class="small">Create your client account to follow your project's progress, payments and reports. Use the same email LDM has for you.</p><div class="row"><a class="btn primary" href="${location.pathname}#signup">Create my client account</a><a class="btn" href="${location.pathname}">Sign in</a></div>`
      : p.status === "declined" ? `<h2>Proposal declined</h2><p>You declined this proposal. If you change your mind or would like a revised proposal, contact LDM at 0945 681 0515.</p>`
      : st === "expired" ? `<h2>This proposal has expired</h2><p>It was valid for ${p.valid_days} days from ${longDate(p.proposal_date)}. Please contact LDM at 0945 681 0515 for an updated proposal.</p>`
      : `<h2>Your design cost proposal</h2><p class="small muted" style="margin:0">Please review the scope, terms and payment schedule below. Valid until ${longDate(ymd(propExpiry(p)))}.</p>
        <div id="pub-msg"></div>
        <label class="f" for="pub-name">Your full name<input id="pub-name" value="${esc(p.client_name)}" autocomplete="name"></label>
        <label class="checkrow"><input type="checkbox" id="pub-agree"> I have read and agree to the scope of work, terms and conditions, and payment schedule.</label>
        <label class="f" for="pub-note">Message to LDM (optional)<textarea id="pub-note" rows="2"></textarea></label>
        <div class="row"><button class="btn primary" data-a="pub-accept">Accept proposal</button><button class="btn" data-a="pub-decline">Decline</button><button class="btn" data-a="print">Print or save as PDF</button></div>`}
    </div>
    ${proposalDoc(p)}</div>`;
  box.dataset.token = token;
}

/* ---------- actions ---------- */
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, id = el.dataset.id;
  if (!/prop|^pp-|^pub-|onboard|plink|goto-project/.test(a)) return;
  if (el.tagName === "A") ev.preventDefault();
  try {
    if (a === "new-prop") proposalForm();
    else if (a === "open-prop") { S.viewProposal = id; location.hash = "proposal"; render(); }
    else if (a === "edit-prop") proposalForm(S.proposals.find(x => x.id === id));
    else if (a === "dup-prop") proposalForm(S.proposals.find(x => x.id === id), true);
    else if (a === "pp-additem") { readProposalForm(); PDRAFT.content.items.push({ item: "", scopes: [] }); drawProposalForm(); }
    else if (a === "pp-rmitem") { readProposalForm(); PDRAFT.content.items.splice(+el.dataset.i, 1); drawProposalForm(); }
    else if (a === "pp-addpay") { readProposalForm(); PDRAFT.content.payments.push({ label: ORD(PDRAFT.content.payments.length + 1) + " Payment", pct: 0, milestone: "" }); drawProposalForm(); }
    else if (a === "pp-rmpay") { readProposalForm(); PDRAFT.content.payments.splice(+el.dataset.i, 1); drawProposalForm(); }
    else if (a === "save-prop") {
      el.disabled = true; const row = await saveProposal(el.dataset.s); el.disabled = false;
      if (row) { closeModal(); await loadAll(); S.viewProposal = row.id; location.hash = "proposal"; render(); toast(row.status === "sent" ? "Saved. Copy the client link and send it." : "Draft saved"); }
    }
    else if (a === "send-prop") { el.disabled = true; await q(sb.from("proposals").update({ status: "sent" }).eq("id", id)); await loadAll(); render(); toast("Marked as sent. Copy the client link below."); }
    else if (a === "copy-plink") { const i = document.getElementById("plink"); i.select(); try { await navigator.clipboard.writeText(i.value); toast("Link copied"); } catch (e) { document.execCommand && document.execCommand("copy"); toast("Link selected. Press Ctrl+C to copy."); } }
    else if (a === "accept-prop-manual" || a === "decline-prop-manual") {
      const p = S.proposals.find(x => x.id === id); const acc = a === "accept-prop-manual";
      openModal(`<h2>${acc ? "Mark as accepted" : "Mark as declined"}</h2><p class="small muted" style="margin:0">Use this when ${esc(p.client_name)} confirmed by phone, message or a signed copy.</p>
        ${acc ? `<label class="f" for="mm-name">Accepted by<input id="mm-name" value="${esc(p.client_name)}"></label>` : ""}<label class="f" for="mm-note">Note<input id="mm-note" placeholder="${acc ? "e.g. Signed copy received Nov 25" : "e.g. Went with another designer"}"></label>
        <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="mm-save-prop" data-id="${id}" data-acc="${acc ? 1 : 0}">Save</button></div></div>`);
    }
    else if (a === "mm-save-prop") {
      const acc = el.dataset.acc === "1"; el.disabled = true;
      await q(sb.from("proposals").update({ status: acc ? "accepted" : "declined", responded_at: new Date().toISOString(), accepted_name: acc ? (document.getElementById("mm-name").value || "").trim() : "", client_note: (document.getElementById("mm-note").value || "").trim() }).eq("id", id));
      closeModal(); await loadAll(); render(); toast(acc ? "Marked as accepted" : "Marked as declined");
    }
    else if (a === "onboard-prop") onboardForm(S.proposals.find(x => x.id === id));
    else if (a === "onboard-go") {
      el.disabled = true;
      const pid = await q(sb.rpc("onboard_proposal", { pid: id, project_name: document.getElementById("ob-name").value }));
      closeModal(); await loadAll(); render(); toast("Client onboarded. The project is now in your dashboard.");
      S.viewProposal = id;
    }
    else if (a === "goto-project") { location.hash = "progress"; render(); }
    else if (a === "del-prop") {
      if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Click again to delete"; setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = "Delete"; } }, 4000); return; }
      await q(sb.from("proposals").delete().eq("id", id)); await loadAll(); location.hash = "proposals"; render(); toast("Proposal deleted");
    }
    else if (a === "pub-accept" || a === "pub-decline") {
      const token = document.getElementById("public").dataset.token, msg = document.getElementById("pub-msg");
      const acc = a === "pub-accept", name = document.getElementById("pub-name").value.trim(), note = document.getElementById("pub-note").value.trim();
      const show = (t) => { msg.innerHTML = `<div class="amsg bad">${esc(t)}</div>`; };
      if (acc && !name) return show("Please type your full name.");
      if (acc && !document.getElementById("pub-agree").checked) return show("Please tick the box to confirm you agree to the proposal.");
      if (!acc && !note) return show("Please tell us briefly why, in the message box, so we can improve our proposal.");
      el.disabled = true;
      await q(sb.rpc("respond_proposal", { t: token, accept: acc, signer: name, note }));
      await showPublicProposal(token); window.scrollTo(0, 0);
    }
  } catch (e) { const m = friendly(e); const msg = document.getElementById("pub-msg"); if (msg) msg.innerHTML = `<div class="amsg bad">${esc(m)}</div>`; else toast(m); el.disabled = false; }
});
document.addEventListener("input", e => { if (e.target.closest && e.target.closest(".pp-pays, #pp-total")) updatePropCalc(); });
