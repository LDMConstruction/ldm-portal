/* ================================================================
   LDM Portal: progress billing in the LDM format
   (cover letter + Appendix I General Construction Report),
   client acceptance, and expenses paid by clients that LDM reimburses.
   ================================================================ */
const BSTAT = { draft: ["Draft", "OnHold"], sent: ["Waiting for client", "Proposal"], accepted: ["Accepted", "Ongoing"], disputed: ["Concern raised", "Unconfirmed"] };
const bchip = s => `<span class="chip ${BSTAT[s][1]}">${BSTAT[s][0]}</span>`;
const r2 = n => Math.round((+n || 0) * 100) / 100;
const STANDARD_SCOPES = ["General Requirements", "Earthworks", "Concrete Works", "Reinforcing Bar", "Formworks", "Masonry Works", "Roof Works", "Finishing/Tiling Works",
  "Ceiling Works", "Welding Works", "Finish Carpentry", "Glass Works", "Basic Cabinet Works", "Painting Works", "Plumbing Works", "Electrical Works"];
const COMPANY_DEFAULT = { company_name: "LDM Design & Build", company_address: "2F Mandaue Foam Building, Shaw Boulevard\nAddition Hills, Mandaluyong City",
  company_contact: "(+63) 945 681 0515", company_email: "ldmengineeringdesign@gmail.com", signatory: "Engr. Lester D. Miranda", signatory_title: "Project Engineer",
  bank_name: "", bank_account_name: "", bank_account_no: "" };
const company = () => { const c = { ...COMPANY_DEFAULT }; Object.keys(c).forEach(k => { if (S.company && S.company[k] != null) c[k] = S.company[k]; }); return c; };

/* ---------- money and words ---------- */
function peso2(n) { const v = +n || 0; return (v < 0 ? "-₱" : "₱") + Math.abs(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const pct2 = v => (Math.round((+v || 0) * 100) / 100).toFixed(2) + "%";
function numWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const h = x => { const out = []; if (x >= 100) { out.push(ones[Math.floor(x / 100)] + " Hundred"); x %= 100; } if (x >= 20) { out.push(tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "")); } else if (x) out.push(ones[x]); return out.join(" "); };
  if (!n) return "Zero";
  const parts = []; [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]].forEach(([v, w]) => { if (n >= v) { parts.push(h(Math.floor(n / v)) + " " + w); n %= v; } });
  if (n) parts.push(h(n)); return parts.join(" ");
}
function pesoWords(v) { v = Math.abs(r2(v)); const whole = Math.floor(v), cents = Math.round((v - whole) * 100); return `${numWords(whole)} and ${String(cents).padStart(2, "0")}/100 pesos`; }

/* ---------- accomplishment math (items: scope d, contract amount a, previous % p, this period % n) ---------- */
function normItems(b) { return (b.items || []).map(it => ({ d: it.d || "", a: it.a != null ? +it.a || 0 : (+it.w || 0) * (+b.contract_amount || 0) / 100, p: +it.p || 0, n: +it.n || 0 })); }
function billCalc(b) {
  const items = normItems(b);
  items.forEach(it => { it.prevAmt = r2(it.a * it.p / 100); it.toAmt = r2(it.a * (it.p + it.n) / 100); it.nowAmt = r2(it.toAmt - it.prevAmt); });
  const total = items.reduce((s, it) => s + it.a, 0);
  const prevGross = items.reduce((s, it) => s + it.prevAmt, 0), thisGross = items.reduce((s, it) => s + it.nowAmt, 0), gross = prevGross + thisGross;
  const k = 1 - (+b.dp_percent || 0) / 100 - (+b.retention_percent || 0) / 100;
  return { items, total: r2(total), prevGross: r2(prevGross), thisGross: r2(thisGross), gross: r2(gross),
    acc: total ? gross / total : 0, prevAcc: total ? prevGross / total : 0, thisAcc: total ? thisGross / total : 0,
    net: r2(gross * k), prevNet: r2(prevGross * k), due: r2(thisGross * k), deductions: k !== 1 };
}
function basisAmount(p, basis) { const f = fin(p); return basis === "Design" ? f.designC : basis === "Total" ? f.contract : f.constrC; }

/* ---------- list ---------- */
function vBilling() {
  const list = S.billings.slice().sort((a, b) => (b.as_of || "").localeCompare(a.as_of || "") || b.billing_no - a.billing_no)
    .filter(b => !S.reportFilter || b.project_id === S.reportFilter);
  const row = b => `<tr class="click" data-a="open-bill" data-id="${b.id}"><td><b>${esc(projName(b.project_id))}</b><div class="small muted">Progress Billing No. ${b.billing_no} · ${esc(b.basis)}</div></td>
    <td class="small">${fmtD(b.as_of)}</td><td>${bchip(b.status)}</td><td class="num">${peso2(b.amount_due)}</td></tr>`;
  const owner = IS("owner");
  const due = list.filter(b => b.status === "sent").reduce((a, b) => a + (+b.amount_due || 0), 0);
  return `
  <div class="head"><div><h1>${owner ? "Progress billing" : "Billing"}</h1><p class="sub">${owner ? "Prepare each billing with its General Construction Report. Clients see a billing once you send it, and can accept it or raise a concern." : "Progress billings from LDM. Review each one and accept it, or raise a concern if something needs checking."}</p></div>
  <div class="row"><select id="bf" data-local="reportFilter" aria-label="Project"><option value="">All projects</option>${S.projects.map(p => `<option value="${p.id}" ${p.id === S.reportFilter ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
  ${owner ? `<button class="btn" data-a="bill-settings">Letterhead and bank details</button><button class="btn primary" data-a="new-bill">New progress billing</button>` : ""}</div></div>
  ${!owner && due ? `<div class="answer"><b style="font-size:15px">${peso2(due)}</b> in billing waiting for your review.</div>` : ""}
  ${(owner ? [["disputed", "Concern raised by client"], ["sent", "Waiting for client"], ["draft", "Drafts"], ["accepted", "Accepted"]] : [["sent", "Waiting for your review"], ["disputed", "Concern raised"], ["accepted", "Accepted"]])
    .map(([st, t], i) => { const g = list.filter(b => b.status === st); if (!g.length && i) return "";
      return `<div class="card scroll"><h2>${t} (${g.length})</h2>${g.length ? `<table><thead><tr><th>Project and billing</th><th>Date</th><th>Status</th><th class="num">Amount billed</th></tr></thead><tbody>${g.map(row).join("")}</tbody></table>` : `<div class="empty">${owner ? "Nothing here." : "No billing waiting for you."}</div>`}</div>`; }).join("")}`;
}

/* ---------- the billing document ---------- */
function letterhead() {
  const c = company();
  return `<header class="lh"><img src="logo.png" alt="${esc(c.company_name)}"><div><b>${esc(c.company_name)}</b>${esc(c.company_address).split("\n").map(l => `<span>${l}</span>`).join("")}
    ${c.company_contact ? `<span>Contact No.: ${esc(c.company_contact)}</span>` : ""}${c.company_email ? `<span>Email: ${esc(c.company_email)}</span>` : ""}</div></header>`;
}
function vBill() {
  const b = S.billings.find(x => x.id === S.viewBilling);
  if (!b) return `<div class="empty">This billing isn't available. <a href="#billing">Back to billing</a></div>`;
  const p = S.projects.find(x => x.id === b.project_id) || {};
  const c = billCalc(b), co = company(), owner = IS("owner");
  const paid = S.collections.filter(k => k.projectId === b.project_id && (k.reference || "").includes(`PB ${b.billing_no}`)).reduce((a, k) => a + k.amount, 0);
  const dateLong = d => { const x = parseD(d); return x ? x.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""; };
  const dateShort = d => { const x = parseD(d); return x ? `${x.getMonth() + 1}/${x.getDate()}/${String(x.getFullYear()).slice(2)}` : ""; };
  const accepted = b.status === "accepted";
  const t = c.total || 1;
  return `
  <div class="head no-print"><div><a href="#billing" class="small">← All billing</a><h1>Progress Billing No. ${b.billing_no}</h1><div class="row" style="margin-top:6px">${bchip(b.status)}${owner && b.status === "draft" ? `<span class="small muted">Not visible to the client yet</span>` : ""}</div></div>
  <div class="row">
    ${owner && b.status !== "accepted" ? `<button class="btn" data-a="edit-bill" data-id="${b.id}">Edit</button>` : ""}
    ${owner && (b.status === "draft" || b.status === "disputed") ? `<button class="btn primary" data-a="send-bill" data-id="${b.id}">${b.status === "disputed" ? "Send revised billing" : "Send to client"}</button>` : ""}
    ${owner && accepted ? `<button class="btn primary" data-a="pay-bill" data-id="${b.id}">Record payment</button>` : ""}
    <button class="btn" data-a="print">Print or save as PDF</button>
    ${owner ? `<button class="btn danger" data-a="del-bill" data-id="${b.id}">Delete</button>` : ""}</div></div>
  ${b.status === "disputed" && b.client_note ? `<div class="answer no-print" style="border-left-color:var(--bad);background:var(--bad-soft)"><b style="font-size:15px">${owner ? "Client's concern" : "Your concern"} (${fmtD((b.responded_at || "").slice(0, 10))}):</b> ${esc(b.client_note)}</div>` : ""}
  ${IS("client") && b.status === "sent" ? `<div class="card no-print"><h2>Your response</h2><p class="small muted" style="margin:0">Accepting confirms the accomplishment and the amount billed below, and signs the Client/Owner line for you. If something doesn't look right, raise a concern and LDM will review and send a revised billing.</p>
    <label class="f" for="bill-note">Comment (needed if raising a concern)<textarea id="bill-note" rows="2"></textarea></label>
    <div class="row"><button class="btn primary" data-a="accept-bill" data-id="${b.id}">Accept billing</button><button class="btn" data-a="dispute-bill" data-id="${b.id}">Raise a concern</button></div></div>` : ""}
  ${owner && accepted ? `<p class="small muted no-print" style="margin:0">Payments recorded against this billing: ${peso2(paid)} of ${peso2(b.amount_due)}.</p>` : ""}
  <div class="bdoc">
    <section class="bpage letter">
      ${letterhead()}
      <h2 class="ltitle">PROGRESS REPORT</h2>
      <dl class="lmeta"><dt>DATE:</dt><dd><b>${dateLong(b.as_of)}</b></dd>
        <dt>ATTENTION:</dt><dd><b>${esc(b.attention || p.client || "")}</b><br>Client</dd>
        <dt>PROJECT:</dt><dd>${esc(p.name || "")}${p.scope ? `: ${esc(p.scope)}` : ""}</dd><dt>LOCATION:</dt><dd>${esc(p.location || "")}</dd>
        <dt>SUBJECT:</dt><dd><b>PROGRESS BILLING NO. ${b.billing_no}</b></dd></dl>
      <p>${esc(b.salutation || "Dear Sir/Ma'am,")}</p>
      <p class="lbody">We hereby submit the progress report of the project mentioned above and the corresponding billing amount based on the monthly project cost summary. Please find herewith the attached following documents which all form part of this billing:</p>
      <p class="lappx">Appendix I <span>:</span> General Construction Report</p>
      <p class="lbody">We would like to bill the amount of <u><b>PHP ${Math.abs(c.due).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pesoWords(c.due)})</b></u> equivalent to ${pct2(c.thisAcc * 100)} accomplishment bringing the total accomplishment to date to <b>${pct2(c.acc * 100).replace(".00%", "%")}</b>${c.deductions ? `, net of ${+b.dp_percent ? `${b.dp_percent}% downpayment recoupment` : ""}${+b.dp_percent && +b.retention_percent ? " and " : ""}${+b.retention_percent ? `${b.retention_percent}% retention` : ""}` : ""}.</p>
      ${b.notes ? `<p class="lbody pre">${esc(b.notes)}</p>` : ""}
      <p>Should you need further clarifications, please do not hesitate to contact us.</p>
      <p>Sincerely Yours,<br>${esc(co.company_name.toUpperCase())}</p>
      <div class="lsign"><div><span class="sline"></span><b>${esc(co.signatory)}</b></div>
        <div>${accepted ? `<span class="accepted">Accepted online by ${esc(nameOf(b.responded_by))}</span>` : ""}<span class="sline"></span><b>Client/Owner</b><i>Date: ${accepted && b.responded_at ? fmtD(b.responded_at.slice(0, 10)) : "_____________"}</i></div></div>
      ${co.bank_name || co.bank_account_no ? `<div class="lbank"><b>BANK DETAILS</b><dl><dt>Bank name</dt><dd>: ${esc(co.bank_name)}</dd><dt>Account name</dt><dd>: ${esc(co.bank_account_name)}</dd><dt>Account no</dt><dd>: ${esc(co.bank_account_no)}</dd></dl></div>` : ""}
    </section>
    <section class="bpage appx">${letterhead()}<div><h2>APPENDIX I</h2><h3>General Construction Report</h3></div></section>
    <section class="bpage gcr">
      ${letterhead()}
      <div class="gmeta"><dl><dt>NAME OF PROJECT</dt><dd>: ${esc((p.name || "").toUpperCase())}</dd><dt>LOCATION</dt><dd>: ${esc((p.location || "").toUpperCase())}</dd></dl>
        <h2>GENERAL CONSTRUCTION REPORT</h2><dl><dt>BILLING NO.</dt><dd>${b.billing_no}</dd><dt>DATE</dt><dd>${dateShort(b.as_of)}</dd></dl></div>
      <div class="scroll"><table class="gtable"><thead>
        <tr><th rowspan="2">SCOPE</th><th rowspan="2">RELATIVE WEIGHT</th><th>BALANCE TO CONTRACT</th><th colspan="3" class="gnow">THIS PERIOD (CURRENT BILLABLE)</th><th colspan="2">PREVIOUS</th><th colspan="2">TO DATE (TOTAL BILLED)</th></tr>
        <tr><th>AMOUNT</th><th class="gnow">RELATIVE ACCOMPLISHMENT</th><th class="gnow">ACCOMPLISHMENT</th><th class="gnow">AMOUNT</th><th>RELATIVE ACCOMPLISHMENT</th><th>AMOUNT</th><th>RELATIVE ACCOMPLISHMENT</th><th>AMOUNT</th></tr></thead><tbody>
        ${c.items.map(it => { const now = it.nowAmt, prev = it.prevAmt, td = it.toAmt;
          return `<tr><td>${esc(it.d.toUpperCase())}</td><td class="num">${pct2(it.a / t * 100)}</td><td class="num">${peso2(it.a)}</td><td class="num gnow">${pct2(now / t * 100)}</td><td class="num gnow">${pct2(it.n)}</td><td class="num gnow">${now ? peso2(now) : "₱ –"}</td>
            <td class="num">${pct2(prev / t * 100)}</td><td class="num">${prev ? peso2(prev) : "₱ –"}</td><td class="num">${pct2(td / t * 100)}</td><td class="num">${td ? peso2(td) : "₱ –"}</td></tr>`; }).join("")}
      </tbody><tfoot><tr><td></td><td class="num">${c.total ? "100.00%" : "0.00%"}</td><td class="num">${peso2(c.total)}</td><td class="num gdue">${pct2(c.thisAcc * 100)}</td><td></td><td class="num gdue">${peso2(c.thisGross)}</td><td class="num">${pct2(c.prevAcc * 100)}</td><td class="num">${peso2(c.prevGross)}</td><td class="num">${pct2(c.acc * 100)}</td><td class="num">${peso2(c.gross)}</td></tr></tfoot></table></div>
      ${c.deductions ? `<table class="bsum"><tbody><tr><td>Gross accomplishment this period</td><td class="num">${peso2(c.thisGross)}</td></tr>
        ${+b.dp_percent ? `<tr><td>Less downpayment recoupment (${b.dp_percent}%)</td><td class="num">(${peso2(c.thisGross * b.dp_percent / 100)})</td></tr>` : ""}
        ${+b.retention_percent ? `<tr><td>Less retention (${b.retention_percent}%)</td><td class="num">(${peso2(c.thisGross * b.retention_percent / 100)})</td></tr>` : ""}
        <tr class="due"><td>Amount billed</td><td class="num">${peso2(c.due)}</td></tr></tbody></table>` : ""}
      <p class="gattest">I hereby attest that all accomplishments written here are fully done in accordance with the specifications and standard design as prescribed by the client. The accomplishments here are based on actual work and have been measured and duly acknowledged by the engineer. Any misrepresentation shall be dealt with accordingly.</p>
      <div class="gprep"><span>PREPARED BY:</span><span class="sline"></span><b>${esc(co.signatory.toUpperCase())}</b><i>${esc(co.signatory_title.toUpperCase())}</i></div>
    </section>
  </div>`;
}

/* ---------- editor ---------- */
let BDRAFT = null;
function newBillingFor(pid, basis) {
  const p = S.projects.find(x => x.id === pid) || {};
  const prev = S.billings.filter(x => x.project_id === pid && x.basis === basis && x.status !== "draft").sort((a, c) => c.billing_no - a.billing_no)[0];
  const no = Math.max(0, ...S.billings.filter(x => x.project_id === pid).map(x => x.billing_no)) + 1;
  let items;
  if (prev) items = normItems(prev).map(it => ({ d: it.d, a: it.a, p: r2(it.p + it.n), n: 0 }));
  else if (basis === "Design") items = [{ d: "Design services", a: basisAmount(p, basis), p: 0, n: 0 }];
  else items = STANDARD_SCOPES.map(d => ({ d, a: 0, p: 0, n: 0 }));
  return { project_id: pid, basis, billing_no: no, as_of: ymd(new Date()), period_start: "", period_end: "", contract_amount: basisAmount(p, basis), items,
    attention: prev ? prev.attention : (p.client || ""), salutation: prev ? prev.salutation : "Dear Sir/Ma'am,",
    dp_percent: prev ? +prev.dp_percent : 0, retention_percent: prev ? +prev.retention_percent : 0, notes: "", status: "draft" };
}
function billingForm(b) {
  const projs = S.projects.filter(p => p.status !== "Proposal");
  if (!projs.length) { toast("Add a project first."); return; }
  if (b) { BDRAFT = JSON.parse(JSON.stringify(b)); BDRAFT.items = normItems(BDRAFT); }
  else BDRAFT = newBillingFor(S.reportFilter || projs[0].id, "Construction");
  drawBillingForm();
}
function drawBillingForm() {
  const b = BDRAFT, isNew = !b.id;
  const projs = S.projects.filter(p => p.status !== "Proposal");
  openModal(`<h2>${isNew ? "New progress billing" : `Edit Progress Billing No. ${b.billing_no}`}</h2>
  <form id="bif" class="fg" onsubmit="return false">
    <label class="f wide" for="b-proj">Project<select id="b-proj" ${isNew ? "" : "disabled"}>${projs.map(p => `<option value="${p.id}" ${p.id === b.project_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="f" for="b-basis">Bill against<select id="b-basis" ${isNew ? "" : "disabled"}>${[["Construction", "Construction contract"], ["Design", "Design contract"], ["Total", "Total contract"]].map(([v, t]) => `<option value="${v}" ${v === b.basis ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="f" for="b-no">Progress billing no.<input id="b-no" type="number" min="1" value="${b.billing_no}"></label>
    <label class="f" for="b-asof">Date<input id="b-asof" type="date" value="${esc(b.as_of)}"></label>
    <label class="f" for="b-att">Attention<input id="b-att" value="${esc(b.attention || "")}" placeholder="Client's name"></label>
    <label class="f" for="b-sal">Salutation<input id="b-sal" value="${esc(b.salutation || "")}" list="b-sals"><datalist id="b-sals"><option>Dear Ma'am,</option><option>Dear Sir,</option><option>Dear Sir/Ma'am,</option></datalist></label>
  </form>
  <div class="sec">General Construction Report</div>
  <p class="small muted" style="margin:0">Enter each scope's contract amount once. Weights are worked out from the amounts. Previous % carries over from the last billing; type it in if earlier billings were done outside the portal. This period can be negative to correct an earlier billing.</p>
  <div class="scroll"><table class="bitems"><thead><tr><th>Scope</th><th class="num">Contract amount (₱)</th><th class="num">Weight</th><th class="num">Previous %</th><th class="num">This period %</th><th class="num">To date %</th><th class="num">This period (₱)</th><th></th></tr></thead><tbody id="b-items">
    ${b.items.map((it, i) => `<tr><td><input data-bi="${i}" data-k="d" value="${esc(it.d)}" aria-label="Scope"></td><td><input data-bi="${i}" data-k="a" type="number" step="0.01" min="0" value="${it.a || ""}" aria-label="Contract amount"></td>
      <td class="num small" id="b-w-${i}"></td><td><input data-bi="${i}" data-k="p" type="number" step="0.01" value="${it.p}" aria-label="Previous percent"></td><td><input data-bi="${i}" data-k="n" type="number" step="0.01" value="${it.n}" aria-label="This period percent"></td>
      <td class="num small" id="b-td-${i}"></td><td class="num small" id="b-amt-${i}"></td><td><button type="button" class="btn sm" data-a="bill-rmrow" data-i="${i}" aria-label="Remove scope">✕</button></td></tr>`).join("")}
  </tbody><tfoot><tr><td>Total</td><td class="num" id="b-tot"></td><td class="num">100%</td><td></td><td></td><td class="num" id="b-totacc"></td><td class="num" id="b-totnow"></td><td></td></tr></tfoot></table></div>
  <div class="row"><button type="button" class="btn sm" data-a="bill-addrow">Add scope</button><button type="button" class="btn sm" data-a="bill-stdrows">Add standard scopes</button></div>
  <details ${+b.dp_percent || +b.retention_percent ? "open" : ""}><summary class="small">Deductions (optional)</summary>
    <div class="fg" style="margin-top:10px"><label class="f" for="b-dp">Downpayment recoupment (%)<input id="b-dp" type="number" min="0" max="100" step="0.01" value="${b.dp_percent}"></label>
    <label class="f" for="b-ret">Retention (%)<input id="b-ret" type="number" min="0" max="100" step="0.01" value="${b.retention_percent}"></label></div></details>
  <label class="f" for="b-notes">Additional note in the letter (optional)<textarea id="b-notes" rows="2">${esc(b.notes || "")}</textarea></label>
  <div class="calc" id="b-calc"></div>
  <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn" data-a="save-bill" data-s="draft">Save draft</button><button class="btn primary" data-a="save-bill" data-s="sent">Save and send to client</button></div></div>`);
  updateBillCalc();
}
function readBillingForm() {
  const b = BDRAFT, g = id => document.getElementById(id);
  if (!g("b-no")) return;
  b.billing_no = +g("b-no").value || 1; b.as_of = g("b-asof").value; b.attention = g("b-att").value; b.salutation = g("b-sal").value;
  b.dp_percent = +g("b-dp").value || 0; b.retention_percent = +g("b-ret").value || 0; b.notes = g("b-notes").value;
  document.querySelectorAll("[data-bi]").forEach(inp => { const it = b.items[+inp.dataset.bi]; if (!it) return; it[inp.dataset.k] = inp.dataset.k === "d" ? inp.value : (+inp.value || 0); });
}
function updateBillCalc() {
  const box = document.getElementById("b-calc"); if (!box) return;
  readBillingForm(); const c = billCalc(BDRAFT), t = c.total || 1;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  c.items.forEach((it, i) => { set("b-w-" + i, pct2(it.a / t * 100)); set("b-td-" + i, pct2(it.p + it.n)); set("b-amt-" + i, it.n ? peso2(it.nowAmt) : "–"); });
  set("b-tot", peso2(c.total)); set("b-totacc", pct2(c.acc * 100)); set("b-totnow", peso2(c.thisGross));
  const p = S.projects.find(x => x.id === BDRAFT.project_id) || {}, basis = basisAmount(p, BDRAFT.basis);
  const off = basis && Math.abs(basis - c.total) > 1;
  box.innerHTML = `<div><span>Scope amounts total</span><b>${peso2(c.total)}</b><span class="${off ? "neg" : ""}">${basis ? `${BDRAFT.basis} contract ${peso2(basis)}${off ? " (doesn't match)" : ""}` : `Set the ${BDRAFT.basis.toLowerCase()} contract in the project to compare`}</span></div>
    <div><span>This period</span><b>${pct2(c.thisAcc * 100)}</b><span>to date ${pct2(c.acc * 100)}</span></div>
    <div><span>Amount to bill</span><b class="${c.due < 0 ? "neg" : "pos"}">${peso2(c.due)}</b>${c.deductions ? `<span>after deductions</span>` : ""}</div>`;
}
async function saveBilling(status) {
  readBillingForm(); const b = BDRAFT, c = billCalc(b);
  if (!c.total) { toast("Enter the contract amount for each scope first."); return null; }
  const body = { project_id: b.project_id, billing_no: b.billing_no, basis: b.basis, as_of: b.as_of, period_start: nz(b.period_start), period_end: nz(b.period_end),
    contract_amount: c.total, items: c.items.map(({ d, a, p, n }) => ({ d, a, p, n })), dp_percent: b.dp_percent, retention_percent: b.retention_percent, notes: b.notes || "",
    attention: b.attention || "", salutation: b.salutation || "Dear Sir/Ma'am,",
    gross_to_date: c.gross, net_to_date: c.net, previous_net: c.prevNet, amount_due: c.due, status };
  if (b.id) return await q(sb.from("progress_billings").update(body).eq("id", b.id).select().single());
  return await q(sb.from("progress_billings").insert(body).select().single());
}

function billSettingsForm() {
  const c = company();
  const f = (k, label, ta) => `<label class="f ${ta ? "wide" : ""}" for="cs-${k}">${label}${ta ? `<textarea id="cs-${k}" rows="2">${esc(c[k])}</textarea>` : `<input id="cs-${k}" value="${esc(c[k])}">`}</label>`;
  openModal(`<h2>Letterhead and bank details</h2><p class="small muted" style="margin:0">Shown on every progress billing. Clients can see these details.</p>
  <div class="fg">${f("company_name", "Company name")}${f("company_contact", "Contact no.")}${f("company_address", "Address", true)}${f("company_email", "Email")}
    ${f("signatory", "Signed by")}${f("signatory_title", "Title (on the construction report)")}${f("bank_name", "Bank name")}${f("bank_account_name", "Account name")}${f("bank_account_no", "Account no.")}</div>
  <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="save-bill-settings">Save</button></div></div>`);
}

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
    else if (a === "bill-addrow") { readBillingForm(); BDRAFT.items.push({ d: "", a: 0, p: 0, n: 0 }); drawBillingForm(); }
    else if (a === "bill-rmrow") { readBillingForm(); BDRAFT.items.splice(+el.dataset.i, 1); drawBillingForm(); }
    else if (a === "bill-stdrows") { readBillingForm(); const have = new Set(BDRAFT.items.map(x => x.d.toLowerCase())); STANDARD_SCOPES.forEach(d => { if (!have.has(d.toLowerCase())) BDRAFT.items.push({ d, a: 0, p: 0, n: 0 }); }); drawBillingForm(); }
    else if (a === "bill-settings") billSettingsForm();
    else if (a === "save-bill-settings") {
      const body = {}; Object.keys(COMPANY_DEFAULT).forEach(k => { const e = document.getElementById("cs-" + k); if (e) body[k] = e.value.trim(); });
      el.disabled = true; await q(sb.from("settings").update(body).eq("id", 1)); closeModal(); await loadAll(); render(); toast("Letterhead and bank details saved");
    }
    else if (a === "save-bill") {
      el.disabled = true; const row = await saveBilling(el.dataset.s); el.disabled = false;
      if (row) { closeModal(); await loadAll(); S.viewBilling = row.id; location.hash = "bill"; render(); toast(el.dataset.s === "sent" ? "Sent to the client" : "Draft saved"); }
    }
    else if (a === "send-bill") {
      const b = S.billings.find(x => x.id === id), c = billCalc(b);
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
document.addEventListener("input", e => { if (e.target.closest && e.target.closest("#b-items, #bif, details")) updateBillCalc(); });
document.addEventListener("change", e => {
  if (e.target.id === "b-proj" || e.target.id === "b-basis") {
    BDRAFT = newBillingFor(document.getElementById("b-proj").value, document.getElementById("b-basis").value); drawBillingForm();
  }
});
