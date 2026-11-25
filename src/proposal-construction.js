/* ================================================================
   LDM Portal: construction cost proposal (ball park figures)
   with a cost schedule worked out from the project's size.
   ================================================================ */
const PB_PROFILE = [12, 8, 10, 10, 8, 7, 8, 4, 3];   // Neil Bautista proposal, 70% over 9 billings
const WORK_2 = [
  "Ground floor reinforced concrete columns and beams; ground floor slab on fill; first floor structural frame 100% complete",
  "Second floor columns; second floor beams and formworks; concrete pouring of second floor slab",
  "Second floor structural frame and slab complete; roof framing; roofing, fascia and gutter installation 100% complete",
  "CHB wall installation ground and second floor complete; exterior plaster finish; electrical and plumbing rough in works 100% complete",
  "Interior plastering complete; ceiling framing and board installation; staircase structural and tile finishing; T&B and kitchen floor and wall tile works complete",
  "Ground floor tile works; door frames and window frames installation; additional accent wall tile works; cabinet and built in joinery works",
  "Door sashes and window sashes complete; interior and exterior painting complete; fencing and gate installation 100% complete",
  "Electrical and plumbing finishing; light fixtures and sanitary fixtures installation; hardware installation; touch up painting; snagging and defects rectification",
  "Completion of all punch list items; final inspection and walkthrough; project turnover and client acceptance"];
const WORK_1 = [
  "Reinforced concrete columns and beams; slab on fill; structural frame 100% complete",
  "Roof beams and roof framing; roofing, fascia and gutter installation 100% complete",
  "CHB wall installation complete; exterior plaster finish; electrical and plumbing rough in works 100% complete",
  "Interior plastering complete; ceiling framing and board installation; T&B and kitchen floor and wall tile works complete",
  "Floor tile works; door frames and window frames installation; cabinet and built in joinery works",
  "Door sashes and window sashes complete; interior and exterior painting complete; fencing and gate installation 100% complete",
  "Electrical and plumbing finishing; light fixtures and sanitary fixtures installation; hardware installation; touch up painting; snagging and defects rectification",
  "Completion of all punch list items; final inspection and walkthrough; project turnover and client acceptance"];
const UPPER = "Upper floor columns, beams and formworks; concrete pouring of upper floor slabs; upper floor structural frame complete";

function constructionTemplate() {
  return {
    title_bar: "CONSTRUCTION COST PROPOSAL (BALL PARK FIGURES)",
    intro: "We are pleased to submit our estimated contract price proposal for the project mentioned above. Please find herewith our price proposal based on the following scope of works and terms and conditions for your evaluation and consideration.",
    build: [
      { item: "Main House", scopes: ["Two Storey Residential House", "Standard Finish Starting Cost"], qty: 170, unit: "sqm", rate: 35000 },
      { item: "Fencing and Gate", scopes: ["2m Height Fence with One Vehicular", "and One Pedestrian Gate"], qty: 51, unit: "l.m.", rate: 15000 }],
    services: [
      { item: "Design", scopes: ["Complete Residential Drawing", "Building Permit Requirements"], qty: 1, unit: "lot", rate: 157100, role: "design" },
      { item: "As-Builts", scopes: ["As-Built Plans", "Printing and Sign & Seal", "Occupancy Requirements"], qty: 1, unit: "lot", rate: 30000, role: "asbuilt" },
      { item: "Liaison Services", scopes: ["Building Permit", "Occupancy Permit", "Excluding Permit Fees and Special Payments"], qty: 1, unit: "lot", rate: 40000, role: "liaison" }],
    services_note: "All processing of Building Permits and Occupancy Permit are already included in Liaison Services. This does not include Bonds (depending on the developer) and Permit Fees (which vary depending on project size and municipal assessment).",
    terms: [
      "This estimate is based on preliminary information and is subject to change upon finalization of plans, specifications, and scope of work.",
      "Figures stated are approximate only and shall not be construed as a final contract price or binding commitment.",
      "Actual construction cost may vary depending on material price fluctuations, site conditions, design changes, and other factors beyond LDM's control.",
      "This estimate covers only the floor area and footprint as indicated in the reference plan. Any additional areas, extensions, or structures outside the given footprint are not included in this cost and shall be subject to a separate estimate.",
      "This estimate does not include permits, government fees, utility connections, landscaping, and other items not expressly stated.",
      "A formal contract price will only be established upon completion of detailed plans, bill of materials, and signed agreement between both parties.",
      "LDM shall not be held liable for any cost differences between this rough estimate and the final contracted amount.",
      "All figures stated are VAT exclusive. The applicable 12% Value Added Tax (VAT) shall be applied on top of the stated amounts where required."],
    tl: { area: 170, storeys: 2, design_start: ym(addMonths(new Date(), 1)), months: 0, dp_pct: 30, pb_pcts: "", liaison_first_pct: 50 },
    closing: "Thank you and looking forward to be of service to you.",
    signatory: "Engr. Lester D. Miranda"
  };
}

/* ---------- money and months ---------- */
const lineCost = it => r2((+it.qty || 0) * (+it.rate || 0));
const sumCost = list => r2((list || []).reduce((a, it) => a + lineCost(it), 0));
const roleCost = (c, role) => r2((c.services || []).filter(s => s.role === role).reduce((a, s) => a + lineCost(s), 0));
function monthAdd(ymStr, n) { const [y, m] = (ymStr || ym(new Date())).split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return ym(d); }
function monthName(ymStr) { const [y, m] = ymStr.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function suggestMonths(area, storeys) { return Math.max(4, Math.min(24, Math.round(3 + 0.04 * (+area || 0)) + ((+storeys || 2) >= 3 ? 2 : 0) - ((+storeys || 2) === 1 ? 1 : 0))); }
function designMonths(area) { return area <= 200 ? 3 : area <= 400 ? 4 : 5; }
function guessStoreys(c) { const t = ((c.build || [])[0] || {}).scopes ? c.build[0].scopes.join(" ").toLowerCase() : ""; return /three|3\s*storey|3 ?sty/.test(t) ? 3 : /single|one storey|1\s*storey|bungalow/.test(t) ? 1 : 2; }

/* Spread the progress billing balance over n billings, following the LDM profile. */
function pbPercents(n, balance, custom) {
  const own = String(custom || "").split(/[,\s]+/).map(Number).filter(x => !isNaN(x) && x > 0);
  if (own.length === n) return own;
  if (n <= 0) return [];
  const raw = Array.from({ length: n }, (_, k) => { const x = n === 1 ? 0 : k * (PB_PROFILE.length - 1) / (n - 1), i = Math.floor(x), f = x - i; return PB_PROFILE[i] * (1 - f) + (PB_PROFILE[i + 1] ?? PB_PROFILE[i]) * f; });
  const tot = raw.reduce((a, b) => a + b, 0), exact = raw.map(v => v / tot * balance), out = exact.map(Math.floor);
  let left = Math.round(balance - out.reduce((a, b) => a + b, 0));
  exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return out;
}
function workPackages(n, storeys, hasFence) {
  let base = storeys === 1 ? WORK_1.slice() : WORK_2.slice();
  if (storeys >= 3) base.splice(3, 0, UPPER);
  if (!hasFence) base = base.map(s => s.replace(/; fencing and gate installation 100% complete/, ""));
  const m = base.length;
  if (n === m) return base;
  if (n < m) { const b = Array.from({ length: n }, () => []); base.forEach((s, i) => b[Math.min(n - 1, Math.floor(i * n / m))].push(s)); return b.map(x => x.join("; ")); }
  return Array.from({ length: n }, (_, k) => { const i = Math.floor(k * m / n), prev = k ? Math.floor((k - 1) * m / n) : -1; return base[i] + (i === prev ? " (continued)" : ""); });
}

/* ---------- the cost schedule, built from the project size ---------- */
function buildTimeline(c) {
  const tl = { ...constructionTemplate().tl, ...(c.tl || {}) };
  const area = +tl.area || 0, storeys = +tl.storeys || 2, start = tl.design_start || ym(new Date());
  const consTotal = sumCost(c.build), design = roleCost(c, "design"), asbuilt = roleCost(c, "asbuilt"), liaison = roleCost(c, "liaison");
  const lp = +tl.liaison_first_pct || 50, dp = +tl.dp_pct || 30;
  const D = designMonths(area), mid = Math.round((D - 1) / 2), fin = monthAdd(start, D - 1);
  const designRows = [
    { m: start, act: "Design starts, initial consultation, schematic floor plan layout, and 3D perspectives", pay: "50% — 1st payment", pct: 50 },
    { m: monthAdd(start, mid), act: "Completion of working drawings, detailed plans, and building permit requirements", pay: "30% — 2nd payment", pct: 30 },
    { m: fin, act: "Final revisions, sign and seal of plans, printing and submission", pay: "20% — Final payment", pct: 20 }].map(r => ({ ...r, amt: r2(design * r.pct / 100) }));
  const permitRows = [
    { m: fin, act: `Building permit application filing (${lp}% of Liaison Services — ${php(liaison * lp / 100)})`, amt: r2(liaison * lp / 100) },
    { m: monthAdd(fin, 1), act: "Release of Notice to Construct" },
    { m: monthAdd(fin, 1), act: "Preparation period; signing of Construction Contract; mobilization planning" }];
  const M = +tl.months || suggestMonths(area, storeys), consStart = monthAdd(fin, 3), consEnd = monthAdd(consStart, M);
  const n = Math.max(1, M - 1), pcts = pbPercents(n, 100 - dp, tl.pb_pcts), hasFence = (c.build || []).some(b => /fenc|gate/i.test(b.item + " " + (b.scopes || []).join(" ")));
  const work = workPackages(n, storeys, hasFence);
  const consRows = [
    { bill: "DP", m: consStart, act: "Downpayment before mobilization; site clearing and grubbing; layout and staking; temporary facilities and utilities setup; mobilization of equipment and materials", pct: null, amt: r2(consTotal * dp / 100) },
    { bill: "—", m: monthAdd(consStart, 1), act: "Ground breaking; column footing excavation; reinforced concrete footings poured; pedestal, tie beam and grade beam works; backfilling and compaction", pct: null, amt: null },
    ...pcts.map((p, k) => ({ bill: `PB ${k + 1}`, m: monthAdd(consStart, 2 + k), act: work[k] || "", pct: p, amt: r2(consTotal * p / 100) }))];
  const last = consRows[consRows.length - 1];
  last.amt = r2(consTotal - consRows.reduce((a, r) => a + (r === last ? 0 : (r.amt || 0)), 0));
  const postStart = monthAdd(consRows[consRows.length - 1].m, 1);
  const postRows = [
    { m: postStart, act: "Application and processing of Occupancy Permit", amt: null },
    ...(asbuilt ? [{ m: postStart, act: "Payment — As-Built Plans (Printing, Sign & Seal, Occupancy Requirements)", amt: asbuilt }] : []),
    ...(liaison ? [{ m: monthAdd(postStart, 1), act: `Payment — Liaison Services balance (${100 - lp}% — Occupancy Permit processing)`, amt: r2(liaison * (100 - lp) / 100) }] : [])];
  return { tl, area, storeys, consTotal, design, asbuilt, liaison, servicesTotal: sumCost(c.services), D, M, n, dp, lp, designRows, permitRows, consRows, consStart, consEnd: last.m, postRows,
    postEnd: postRows[postRows.length - 1].m, suggested: suggestMonths(area, storeys) };
}

/* Payment milestones and contract split, used when the client is onboarded. */
function constructionMilestones(c) {
  const t = buildTimeline(c), out = [];
  t.designRows.forEach(r => out.push({ stage: "Design", label: `Design ${r.pay.split(" — ")[1] || ""}`.trim(), milestone: `${monthName(r.m)}: ${r.act}`, pct: r.pct, amount: r.amt }));
  t.permitRows.filter(r => r.amt).forEach(r => out.push({ stage: "Design", label: "Liaison services", milestone: `${monthName(r.m)}: building permit filing`, pct: t.lp, amount: r.amt }));
  t.consRows.filter(r => r.amt).forEach(r => out.push({ stage: "Construction", label: r.bill === "DP" ? "Downpayment" : r.bill, milestone: `${monthName(r.m)}: ${r.act}`, pct: r.bill === "DP" ? t.dp : r.pct, amount: r.amt }));
  t.postRows.filter(r => r.amt).forEach(r => out.push({ stage: "Design", label: /As-Built/.test(r.act) ? "As-built plans" : "Liaison services balance", milestone: `${monthName(r.m)}: ${r.act.replace(/^Payment — /, "")}`, pct: 0, amount: r.amt }));
  return { milestones: out, finance: { design: r2(t.servicesTotal), construction: t.consTotal } };
}

/* ---------- the document ---------- */
function constructionDoc(p, attached) {
  const c = { ...constructionTemplate(), ...(p.content || {}) }, t = buildTimeline(c);
  const ul = s => `<h3 class="cd-h">${s}</h3>`;
  const costTable = (rows, total, label, withRate) => `<table class="pd-scope cd-cost"><thead><tr><th>NO.</th><th>ITEM</th><th>SCOPE</th><th>QTY</th><th>UNIT</th>${withRate ? "<th>UNIT COST</th>" : ""}<th>COST</th></tr></thead><tbody>
    ${rows.map((it, i) => `<tr><td class="c">${ROMAN[i] || i + 1}</td><td><b>${esc(it.item)}</b></td><td>${(it.scopes || []).map(esc).join("<br>")}</td><td class="c">${esc(it.qty)}</td><td class="c">${esc(it.unit)}</td>${withRate ? `<td class="r">${(+it.rate || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>` : ""}<td class="r">${lineCost(it).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>`).join("")}
    <tr class="pd-total"><td colspan="${withRate ? 6 : 5}">${label}</td><td class="r">${php(total)}</td></tr></tbody></table>`;
  const accepted = ["accepted", "onboarded"].includes(p.status) && p.accepted_name;
  return `<article class="pdoc">
    <img class="pd-head" src="assets/letterhead.jpg" alt="LDM Construction, Engineers, Architects, Builders">
    <div class="pd-body">
      <div class="pd-meta"><div><b>Project:</b> ${esc(p.title)}</div><div><b>Date:</b> ${longDate(p.proposal_date)}</div>
        <div><b>Location:</b> ${esc(p.location)}</div><div><b>Client:</b> <b>${esc(p.client_name)}</b></div></div>
      <div class="pd-bar">${esc(c.title_bar)}</div>
      <p class="pd-intro">${esc(c.intro)}</p>
      <p class="cd-ballpark"><b>Ball park estimate only.</b> The construction figures and schedule in this proposal are for planning, so you know what to expect during construction. They are not a payment schedule. The final construction contract price and billing are agreed after the design is completed, and billing follows the actual progress on site.</p>
      ${ul("ESTIMATED CONSTRUCTION COST")}${costTable(c.build || [], t.consTotal, "Estimated Total Contract Cost:", true)}
      ${ul("ESTIMATED SERVICES COST")}${costTable(c.services || [], t.servicesTotal, "Estimated Services Cost:", false)}
      ${c.services_note ? `<p class="cd-note">${esc(c.services_note)}</p>` : ""}
      ${ul("TERMS & CONDITIONS")}<ul class="pd-terms cd-bul">${(c.terms || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${ul("GENERAL COST SUMMARY")}
      <table class="cd-sum"><tbody><tr><td>TOTAL CONSTRUCTION COST:</td><td>${php(t.consTotal)}</td></tr><tr><td>TOTAL SERVICES COST:</td><td>${php(t.servicesTotal)}</td></tr>
        <tr class="g"><td>GRAND TOTAL (Construction + Services):</td><td>${php(t.consTotal + t.servicesTotal)}</td></tr></tbody></table>
      ${ul("COST SCHEDULE")}
      ${ul("A. DESIGN PHASE")}${attached && !t.design ? `<p>Design: see the Design Cost Proposal for the design fee and its payment schedule.</p>` : `<p>Design Cost${t.asbuilt ? " (excluding As-Builts)" : ""}: <b>${php(t.design)}</b></p>
      <table class="cd-t"><thead><tr><th>DATE/MILESTONE</th><th>ACTIVITY</th><th>PAYMENT</th><th>AMOUNT</th></tr></thead><tbody>
        ${t.designRows.map(r => `<tr><td>${monthName(r.m)}</td><td>${esc(r.act)}</td><td>${r.pay}</td><td class="r">${php(r.amt)}</td></tr>`).join("")}
        <tr><td></td><td></td><td>Design Total:</td><td class="r">${php(t.design)}</td></tr></tbody></table>`}
      ${ul("B. PERMIT PHASE")}
      <table class="cd-t"><thead><tr><th>DATE</th><th>ACTIVITY</th></tr></thead><tbody>${t.permitRows.map(r => `<tr><td>${monthName(r.m)}</td><td>${esc(r.act)}</td></tr>`).join("")}</tbody></table>
      ${ul("C. CONSTRUCTION PHASE")}
      <p>Construction Period: <b>${monthName(t.consStart)} – ${monthName(t.consEnd)} (${t.M} Months)</b></p>
      <p>Total Construction Cost: <b>${php(t.consTotal)}</b></p>
      <p>Down Payment (${t.dp}%) before Mobilization: <b>${php(t.consRows[0].amt)} (${monthName(t.consStart)})</b></p>
      <p>Progress Billing Balance (${100 - t.dp}%): <b>${php(t.consTotal - t.consRows[0].amt)} (PB 1 to PB ${t.n}, ${monthName(t.consRows[2] ? t.consRows[2].m : t.consStart)} to ${monthName(t.consEnd)})</b></p>
      <table class="cd-t cd-pb"><thead><tr><th>BILLING</th><th>TARGET DATE</th><th>TARGET SCOPE ACCOMPLISHED</th><th>% ACC.</th><th>BILLING AMOUNT</th></tr></thead><tbody>
        ${t.consRows.map(r => `<tr><td class="c"><b>${r.bill}</b></td><td>${monthName(r.m)}</td><td>${esc(r.act)}</td><td class="c">${r.pct == null ? "—" : r.pct + "%"}</td><td class="r">${r.amt == null ? "—" : php(r.amt)}</td></tr>`).join("")}</tbody></table>
      ${ul("D. POST CONSTRUCTION PHASE")}
      <p>Duration: <b>${monthName(t.postRows[0].m)} – ${monthName(t.postEnd)} (${t.postRows[0].m === t.postEnd ? 1 : 2} Month${t.postRows[0].m === t.postEnd ? "" : "s"})</b></p>
      <table class="cd-t"><thead><tr><th>DATE</th><th>ACTIVITY</th><th>AMOUNT</th></tr></thead><tbody>
        ${t.postRows.map(r => `<tr><td>${monthName(r.m)}</td><td>${esc(r.act)}</td><td class="r">${r.amt ? php(r.amt) : "—"}</td></tr>`).join("")}
        <tr class="pd-total"><td></td><td>Post Construction Total:</td><td class="r">${php(t.postRows.reduce((a, r) => a + (r.amt || 0), 0))}</td></tr></tbody></table>
      <p class="pd-closing">${esc(c.closing)}</p>
      <div class="pd-sign"><div><span class="small">Prepared by:</span><span class="sline"></span><b>${esc(c.signatory)}</b></div>
        <div>${accepted ? `<span class="accepted">${attached ? "Acknowledged" : "Accepted"} online by ${esc(p.accepted_name)}</span>` : ""}<span class="sline"></span><b>Client/Owner${attached ? " (acknowledged)" : ""}</b><i>Date: ${accepted && p.responded_at ? longDate(p.responded_at.slice(0, 10)) : "_____________"}</i></div></div>
    </div>
    <footer class="pd-foot"><div><b>Contact us :</b><span>☎ 0945 681 0515</span><span>ⓕ https://www.facebook.com/ldm.designbuild</span><span>✉ ldmengineeringdesign@gmail.com</span></div>
      <div class="r"><b>LDM Construction OPC</b><span>2F Mandaue Foam Bldg, Shaw Boulevard</span><span>Addition Hills, Mandaluyong City</span></div></footer>
  </article>`;
}

/* ---------- editor ---------- */
function nextConstructionNo() { const y = new Date().getFullYear(); const n = S.proposals.filter(p => (p.proposal_no || "").startsWith(`CP-${y}-`)).length + 1; return `CP-${y}-${String(n).padStart(3, "0")}`; }
function constructionForm(p, dup) {
  PDRAFT = p ? JSON.parse(JSON.stringify(p)) : { proposal_no: nextConstructionNo(), kind: "Construction", title: "", location: "", client_name: "", client_email: "", client_phone: "", proposal_date: ymd(new Date()), valid_days: 30, total: 0, content: constructionTemplate(), status: "draft" };
  if (dup) { delete PDRAFT.id; delete PDRAFT.token; Object.assign(PDRAFT, { proposal_no: nextConstructionNo(), status: "draft", proposal_date: ymd(new Date()), project_id: null, accepted_name: "", client_note: "", responded_at: null, sent_at: null }); }
  PDRAFT.content = { ...constructionTemplate(), ...(PDRAFT.content || {}) };
  PDRAFT.content.tl = { ...constructionTemplate().tl, ...(PDRAFT.content.tl || {}) };
  drawConstructionForm();
}
function costRows(list, key, withRole) {
  return list.map((it, i) => `<div class="cf-row ${withRole ? "svc" : ""}"><span class="pp-no">${ROMAN[i] || i + 1}</span><input data-${key}="${i}" data-k="item" value="${esc(it.item)}" placeholder="Item" aria-label="Item">
    <textarea data-${key}="${i}" data-k="scopes" rows="${Math.max(2, (it.scopes || []).length)}" placeholder="Scope, one per line" aria-label="Scope">${esc((it.scopes || []).join("\n"))}</textarea>
    <input data-${key}="${i}" data-k="qty" type="number" step="0.01" value="${it.qty}" aria-label="Quantity"><input data-${key}="${i}" data-k="unit" value="${esc(it.unit)}" aria-label="Unit">
    <input data-${key}="${i}" data-k="rate" type="number" step="0.01" value="${it.rate}" aria-label="${withRole ? "Cost" : "Unit cost"}">
    ${withRole ? `<select data-${key}="${i}" data-k="role" aria-label="Used in schedule as">${[["design", "Design phase"], ["liaison", "Liaison (permits)"], ["asbuilt", "As-builts (post)"], ["other", "Other"]].map(([v, t]) => `<option value="${v}" ${it.role === v ? "selected" : ""}>${t}</option>`).join("")}</select>` : `<b class="cf-line" id="cf-${key}-${i}"></b>`}
    <button type="button" class="btn sm" data-a="cf-rm" data-list="${key}" data-i="${i}" aria-label="Remove">✕</button></div>`).join("");
}
function drawConstructionForm() {
  const p = PDRAFT, c = p.content, tl = c.tl;
  const inp = (id, label, val, type = "text", extra = "", wide) => `<label class="f ${wide ? "wide" : ""}" for="${id}">${label}<input id="${id}" type="${type}" value="${esc(val ?? "")}" ${extra}></label>`;
  openModal(`<h2>${p.id ? "Edit proposal " + esc(p.proposal_no) : "New construction proposal"}</h2>
  <div class="sec">Client and project</div>
  <div class="fg">${inp("cp-title", "Project", p.title, "text", 'placeholder="e.g. Proposed 170 sqm Two Storey Residential"', true)}
    ${inp("cp-loc", "Location", p.location)}${inp("cp-client", "Client name", p.client_name)}${inp("cp-email", "Client email (links their portal account later)", p.client_email, "email")}
    ${inp("cp-phone", "Client mobile", p.client_phone)}${inp("cp-no", "Proposal no.", p.proposal_no)}${inp("cp-date", "Date", p.proposal_date, "date")}${inp("cp-valid", "Valid for (days)", p.valid_days, "number", 'min="1"')}</div>
  <div class="sec">Estimated construction cost</div>
  <div class="cf-head"><span></span><span>Item</span><span>Scope</span><span>Qty</span><span>Unit</span><span>Unit cost</span><span>Cost</span><span></span></div>
  <div>${costRows(c.build, "cb", false)}</div><div class="row"><button type="button" class="btn sm" data-a="cf-add" data-list="cb">Add item</button><span class="small" id="cf-cbtot"></span></div>
  <div class="sec">Estimated services cost</div>
  <div class="cf-head svc"><span></span><span>Item</span><span>Scope</span><span>Qty</span><span>Unit</span><span>Cost</span><span>In the schedule as</span><span></span></div>
  <div>${costRows(c.services, "cs", true)}</div><div class="row"><button type="button" class="btn sm" data-a="cf-add" data-list="cs">Add item</button><span class="small" id="cf-cstot"></span></div>
  <label class="f" for="cp-snote">Note under services<textarea id="cp-snote" rows="2">${esc(c.services_note)}</textarea></label>
  <div class="sec">Timeline from project size</div>
  <div class="fg">${inp("tl-area", "Floor area (sqm)", tl.area, "number", 'min="1"')}
    <label class="f" for="tl-storeys">Storeys<select id="tl-storeys">${[1, 2, 3, 4].map(n => `<option value="${n}" ${+tl.storeys === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    ${inp("tl-start", "Design starts", tl.design_start, "month")}${inp("tl-months", "Construction months (blank = suggested)", tl.months || "", "number", 'min="2" max="36"')}
    ${inp("tl-dp", "Downpayment before mobilization (%)", tl.dp_pct, "number", 'min="0" max="100"')}${inp("tl-lp", "Liaison paid at permit filing (%)", tl.liaison_first_pct, "number", 'min="0" max="100"')}
    ${inp("tl-pbs", "Progress billing % (optional, comma separated)", tl.pb_pcts, "text", 'placeholder="Leave blank to use the LDM profile"', true)}</div>
  <div class="calc" id="cf-calc"></div>
  <details><summary class="small">Terms, opening paragraph and wording</summary><div class="fg" style="margin-top:10px">
    ${inp("cp-bar", "Title bar", c.title_bar, "text", "", true)}
    <label class="f wide" for="cp-intro">Opening paragraph<textarea id="cp-intro" rows="3">${esc(c.intro)}</textarea></label>
    <label class="f wide" for="cp-terms">Terms and conditions (one per line)<textarea id="cp-terms" rows="9">${esc(c.terms.join("\n"))}</textarea></label>
    ${inp("cp-closing", "Closing line", c.closing, "text", "", true)}${inp("cp-sign", "Prepared by", c.signatory)}</div></details>
  <div class="row end"><div></div><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn" data-a="save-cprop" data-s="draft">Save draft</button><button class="btn primary" data-a="save-cprop" data-s="sent">Save and get client link</button></div></div>`);
  updateConstructionCalc();
}
function readConstructionForm() {
  const p = PDRAFT, c = p.content, g = id => (document.getElementById(id) || {}).value;
  if (g("cp-title") === undefined) return;
  Object.assign(p, { title: g("cp-title").trim(), location: g("cp-loc").trim(), client_name: g("cp-client").trim(), client_email: g("cp-email").trim(), client_phone: g("cp-phone").trim(),
    proposal_no: g("cp-no").trim(), proposal_date: g("cp-date"), valid_days: +g("cp-valid") || 30 });
  [["cb", "build"], ["cs", "services"]].forEach(([key, list]) => document.querySelectorAll(`[data-${key}]`).forEach(e => { const it = c[list][+e.dataset[key]]; if (!it) return; const k = e.dataset.k;
    it[k] = k === "scopes" ? e.value.split("\n").map(s => s.trim()).filter(Boolean) : (k === "qty" || k === "rate") ? (+e.value || 0) : e.value; }));
  c.services_note = g("cp-snote");
  Object.assign(c.tl, { area: +g("tl-area") || 0, storeys: +g("tl-storeys") || 2, design_start: g("tl-start") || ym(new Date()), months: +g("tl-months") || 0, dp_pct: +g("tl-dp") || 0, liaison_first_pct: +g("tl-lp") || 0, pb_pcts: g("tl-pbs") });
  if (g("cp-bar") !== undefined) { c.title_bar = g("cp-bar"); c.intro = g("cp-intro"); c.terms = g("cp-terms").split("\n").map(s => s.trim()).filter(Boolean); c.closing = g("cp-closing"); c.signatory = g("cp-sign"); }
  const t = buildTimeline(c); p.total = r2(t.consTotal + t.servicesTotal);
}
function updateConstructionCalc() {
  const box = document.getElementById("cf-calc"); if (!box) return;
  readConstructionForm(); const c = PDRAFT.content, t = buildTimeline(c);
  c.build.forEach((it, i) => { const e = document.getElementById(`cf-cb-${i}`); if (e) e.textContent = php(lineCost(it)); });
  const s1 = document.getElementById("cf-cbtot"), s2 = document.getElementById("cf-cstot");
  if (s1) s1.textContent = "Construction total " + php(t.consTotal); if (s2) s2.textContent = "Services total " + php(t.servicesTotal);
  const own = String(c.tl.pb_pcts || "").split(/[,\s]+/).filter(Boolean), pbSum = t.consRows.reduce((a, r) => a + (r.pct || 0), 0);
  box.innerHTML = `<div><span>Design</span><b>${t.D} months</b><span>${monthName(t.designRows[0].m)} to ${monthName(t.designRows[2].m)}</span></div>
    <div><span>Construction</span><b>${t.M} months</b><span>${monthName(t.consStart)} to ${monthName(t.consEnd)}${+c.tl.months ? ` (suggested ${t.suggested})` : " (suggested for " + t.area + " sqm, " + t.storeys + " storey" + (t.storeys > 1 ? "s" : "") + ")"}</span></div>
    <div><span>Billings</span><b>DP + ${t.n} PBs</b><span class="${own.length && own.length !== t.n ? "neg" : ""}">${own.length && own.length !== t.n ? `Your list has ${own.length} values; ${t.n} needed, so the LDM profile is used` : `DP ${t.dp}% + PBs ${pbSum}% = ${t.dp + pbSum}%`}</span></div>
    <div><span>Grand total</span><b>${php(t.consTotal + t.servicesTotal)}</b><span>post construction ends ${monthName(t.postEnd)}</span></div>`;
}
async function saveConstructionProposal(status) {
  readConstructionForm(); const p = PDRAFT;
  if (!p.title) { toast("Enter the project, for example Proposed 170 sqm Two Storey Residential."); return null; }
  if (!p.client_name) { toast("Enter the client's name."); return null; }
  if (!p.total) { toast("Enter at least one cost item."); return null; }
  const m = constructionMilestones(p.content);
  p.content.milestones = m.milestones; p.content.finance = m.finance;
  const body = { proposal_no: p.proposal_no, kind: "Construction", title: p.title, location: p.location, client_name: p.client_name, client_email: p.client_email, client_phone: p.client_phone,
    proposal_date: p.proposal_date, valid_days: p.valid_days, total: p.total, content: p.content, status: p.status === "draft" || !p.id ? status : p.status };
  if (p.id) return await q(sb.from("proposals").update(body).eq("id", p.id).select().single());
  return await q(sb.from("proposals").insert(body).select().single());
}

document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a;
  if (!/^cf-|cprop/.test(a)) return;
  try {
    if (a === "new-cprop") constructionForm();
    else if (a === "cf-add") { readConstructionForm(); const l = el.dataset.list === "cb" ? "build" : "services"; PDRAFT.content[l].push(l === "build" ? { item: "", scopes: [], qty: 1, unit: "lot", rate: 0 } : { item: "", scopes: [], qty: 1, unit: "lot", rate: 0, role: "other" }); drawConstructionForm(); }
    else if (a === "cf-rm") { readConstructionForm(); PDRAFT.content[el.dataset.list === "cb" ? "build" : "services"].splice(+el.dataset.i, 1); drawConstructionForm(); }
    else if (a === "save-cprop") {
      el.disabled = true; const row = await saveConstructionProposal(el.dataset.s); el.disabled = false;
      if (row) { closeModal(); await loadAll(); S.viewProposal = row.id; location.hash = "proposal"; render(); toast(row.status === "sent" ? "Saved. Copy the client link and send it." : "Draft saved"); }
    }
  } catch (e) { toast(friendly(e)); el.disabled = false; }
});
document.addEventListener("input", e => { if (e.target.closest && e.target.closest("[data-cb], [data-cs], #tl-area, #tl-storeys, #tl-start, #tl-months, #tl-dp, #tl-lp, #tl-pbs")) updateConstructionCalc(); });
let lastArea = null;
document.addEventListener("focusin", e => { if (e.target.id === "tl-area") lastArea = +e.target.value; });
document.addEventListener("change", e => {
  if (e.target.id === "tl-area" && PDRAFT && PDRAFT.content && PDRAFT.content.build[0] && /sqm/i.test(PDRAFT.content.build[0].unit || "")) {
    const q0 = document.querySelector('[data-cb="0"][data-k="qty"]');
    if (q0 && (lastArea == null || +q0.value === lastArea)) { q0.value = e.target.value; updateConstructionCalc(); }
    lastArea = +e.target.value;
  }
  if (e.target.id === "tl-storeys" || (e.target.dataset && e.target.dataset.k === "role")) updateConstructionCalc();
  if (e.target.dataset && e.target.dataset.cb === "0" && e.target.dataset.k === "qty" && PDRAFT && PDRAFT.content && /sqm/i.test(PDRAFT.content.build[0].unit || "")) { const a = document.getElementById("tl-area"); if (a && (+a.value === 0 || +a.value === +PDRAFT.content.tl.area)) { a.value = e.target.value; updateConstructionCalc(); } }
});
