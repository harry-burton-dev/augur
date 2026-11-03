/* Sample data for one deployment: a regional services organisation.
   Swap this object and every name, label, date, count, keeper and reason follows. */
const DATA = {
  app: "Data Atlas", today: "2026-11-03",
  floor: { name: "Regional Services", type: "department", above: "the Org" },
  person: { name: "Priya Shah", role: "Procurement officer" },
  asked: { words: "which suppliers have we not heard from since spring?", at: "2026-11-03 10:14" },
  kind: { one: "supplier", many: "suppliers", tech: "cco:Organization" },
  /* what the desk asked back, and who settled each answer */
  since: { value: "2026-03-01", by: "you", asked: "Since spring: which day?",
    options: [
      { v: "2026-03-01", label: "1 March", why: "spring by the calendar" },
      { v: "2026-03-20", label: "20 March", why: "the equinox" },
      { v: "2026-04-01", label: "1 April", why: "the start of the financial year" } ] },
  statuses: [
    { id: "live", label: "running", on: true },
    { id: "paused", label: "paused", on: false },
    { id: "finished", label: "finished", on: false } ],
  /* "heard from" is read by the model gateway as these kinds of contact; the person confirmed it */
  heard: { said: "heard from", by: "model", confirmed: "you", fallback: "Without the model, the desk shows this list with nothing ticked and asks you to tick what counts." },
  kinds: [
    { id: "invoice", label: "invoice", many: "invoices", icon: "receipt", on: true, src: "inv" },
    { id: "email", label: "email", many: "emails", icon: "mail", on: true, src: "inbox" },
    { id: "meeting", label: "meeting", many: "meetings", icon: "users", on: true, src: "notes" },
    { id: "call", label: "call", many: "calls", icon: "phone", on: true, src: "calls" },
    { id: "mention", label: "mention in a document", many: "mentions in documents", icon: "file-text", on: false, src: "docs" } ],
  /* how a contact record is linked to a supplier; only "meaning" uses the model gateway */
  matches: [
    { id: "key", label: "company number", icon: "hash", model: false, tech: "key match: companyNumber" },
    { id: "name", label: "exact name", icon: "equal", model: false, tech: "label = label" },
    { id: "spelling", label: "close spelling", icon: "spell-check", model: false, tech: "pg_trgm similarity ≥ 0.8" },
    { id: "meaning", label: "meaning", icon: "bot", model: true, tech: "pgvector cosine ≥ 0.86 via model gateway" } ],
  sources: {
    inv: { name: "Invoices ledger", keeper: "Finance", from: "2023-04-01" },
    inbox: { name: "Procurement inbox", keeper: "Procurement desk", from: "2026-01-05" },
    notes: { name: "Supplier meetings, a library in Artifacts", keeper: "Procurement desk", from: "2024-01-01" },
    calls: { name: "Call log", keeper: "Procurement desk", from: "2025-06-01", gap: ["2026-08-12", "2026-09-02"] },
    docs: { name: "Site reports in Artifacts", keeper: "Estates desk", from: "2024-01-01" } },
  /* contacts: [kind, date, how it was matched, what the record says] */
  suppliers: [
    { id: 1, name: "Northgate Haulage", status: "live", c: [["invoice", "2026-09-14", "key", "Invoice NH-2231"], ["email", "2026-06-02", "name", "Re: route changes"]] },
    { id: 2, name: "Pennine Pipe Co", status: "live", c: [["email", "2026-02-11", "name", "Price list 2026"], ["invoice", "2025-12-03", "key", "Invoice PP-0911"]] },
    { id: 3, name: "Brightwater Labs", status: "live", c: [["meeting", "2026-03-04", "name", "Lab results review"], ["invoice", "2026-01-22", "key", "Invoice BW-114"]] },
    { id: 4, name: "Ashdown Fleet Services", status: "live", c: [["invoice", "2026-10-02", "key", "Invoice AF-7781"]] },
    { id: 5, name: "Carver & Lowe", status: "finished", ended: "2025-09-30", c: [["invoice", "2025-08-19", "key", "Final invoice CL-330"]] },
    { id: 6, name: "Meridian Care Ltd", status: "live", c: [["email", "2026-06-20", "spelling", "From “Meridian Care Limited”"], ["invoice", "2026-02-02", "key", "Invoice MC-5520"]] },
    { id: 7, name: "Holt Surfacing", status: "live", c: [["invoice", "2026-01-30", "key", "Invoice HS-208"]], merged: "Holt Surfacing Ltd" },
    { id: 8, name: "Tidewell Marine Works", status: "live", c: [["email", "2026-07-08", "meaning", "From “the dredging team at Tidewell”, no company number"], ["invoice", "2025-11-14", "key", "Invoice TM-401"]] },
    { id: 9, name: "Greenbin Recycling", status: "live", c: [["call", "2026-05-12", "name", "Call about bin lifts"]] },
    { id: 10, name: "Oakfield Facilities", status: "live", c: [["invoice", "2025-12-02", "key", "Invoice OF-1200"]] },
    { id: 11, name: "Stonebridge Plant Hire", status: "live", c: [], since: "2024-05-01" },
    { id: 12, name: "Avon Valve", status: "live", c: [["mention", "2026-04-15", "name", "Named in “Kingsmead salt barn, April site report”"], ["email", "2025-10-09", "name", "Valve recall notice"]] },
    { id: 13, name: "Kestrel Cleaning", status: "live", c: [["meeting", "2026-08-21", "key", "Contract review"]] },
    { id: 14, name: "Clearway Signs", status: "paused", paused: "2026-06-01", c: [["invoice", "2026-01-20", "key", "Invoice CS-090"]] },
    { id: 15, name: "Harrow Electrical", status: "live", c: [["email", "2026-02-27", "name", "Holiday cover"]] },
    { id: 16, name: "Bluewater Testing", status: "live", c: [["invoice", "2026-10-20", "key", "Invoice BT-3301"]] },
    { id: 17, name: "Linden Security", status: "live", c: [["email", "2026-04-03", "spelling", "From “Linden Secuirty”"]] },
    { id: 18, name: "Ridge Roofing", status: "live", usual: "call", c: [["call", "2026-02-02", "name", "Call about gutters"], ["call", "2025-11-20", "name", "Call about quote"]] },
    { id: 19, name: "Saltmarsh Dredging", status: "live", c: [["email", "2026-09-01", "meaning", "From accounts@smd-marine, signed “Saltmarsh”"], ["invoice", "2026-01-12", "key", "Invoice SD-77"]] },
    { id: 20, name: "Quarry Lane Concrete", status: "live", c: [["meeting", "2026-05-30", "name", "Site walk, Elm Road"]] },
    { id: 21, name: "Elmstead Medical", status: "live", c: [["invoice", "2025-11-18", "key", "Invoice EM-62"]] } ],
  /* matches on a floor this person can't open: shown as "some", never a count */
  hidden: { floor: "Coast works crew", type: "team", ask: "Dee Harper", count: "some" },
  /* who could fill the gaps */
  gapKeeper: { name: "Grace Mwangi", desk: "Procurement desk" },
  intent: { title: "Review suppliers we've lost touch with", by: "Grace Mwangi", due: "2026-11-30" }
};
