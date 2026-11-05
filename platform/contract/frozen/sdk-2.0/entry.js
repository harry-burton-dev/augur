import { useState as c, useEffect as h, version as A, createElement as p } from "react";
import { createRoot as B } from "react-dom/client";
import { jsxs as a, Fragment as u, jsx as n } from "react/jsx-runtime";
import { Button as r, Heading as G } from "@augur/app-kit";
const L = (e) => e;
class Y extends Error {
  name = "IntentError";
}
const P = (e) => e instanceof Error && e.name === "IntentCancelled", $ = (e, t) => typeof e == "string" && e.length > 0 && e.length <= t, _ = (e) => {
  if (e === void 0)
    return !0;
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return $(t.scheme, 40) && $(t.label, 80);
}, H = "document.open", J = "document.pick", s = (e, t) => typeof e == "string" && e.length > 0 && e.length <= t, K = (e) => {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return s(t.app, 40) && s(t.id, 200) && s(t.title, 300) && (t.version === void 0 || s(t.version, 40)) && _(t.marking);
}, V = (e, t) => e.raise({ type: H, payload: t }), z = async (e, t = {}) => {
  const d = await e.request({ type: J, payload: t });
  if (!K(d))
    throw new Y("The picker answered with something that is not a document.");
  return d;
}, Q = ["turned-on", "left-off", "not-declared"], X = (e) => e.level ? `${e.slug}:${e.level}` : e.slug;
function v({ ctx: e }) {
  const [t, d] = c("waiting"), [b, m] = c(""), [O, R] = c(""), [M, T] = c(""), [j, w] = c(""), [I, k] = c(""), [g, N] = c(!1), [C, y] = c("");
  h(() => e.bus.on("reference.ping", R), [e]), h(() => {
    if (!g) return;
    const o = () => e.fetch("/api/reference/v1/thing").then(
      async (W) => y(await W.text()),
      () => y("failed")
    );
    return o(), e.bus.on("reference.thing.changed", () => {
      o();
    });
  }, [e, g]), h(() => {
    e.getToken().then((o) => d(typeof o == "string" ? "ok" : "missing"));
  }, [e]);
  const D = () => e.request({ type: "reference.answer", payload: { question: "six times seven" } }).then(
    (o) => m(String(o.answer)),
    (o) => m(P(o) ? "cancelled" : "failed")
  ), S = async () => {
    const o = await e.fetch("/api/reference/v1/floor");
    T(await o.text());
  }, q = () => V(e, { app: "folio", id: "d-contract", title: "Contract document" }).then(
    () => w("raised"),
    () => w("no app")
  ), U = () => z(e, { purpose: "For the contract tests" }).then(
    (o) => k(o.title ?? o.id),
    (o) => k(P(o) ? "cancelled" : "no app")
  ), { workspace: i } = e;
  return /* @__PURE__ */ a("section", { "data-reference": !0, style: { padding: "var(--space-6)" }, children: [
    /* @__PURE__ */ n(G, { heading: "Reference" }),
    /* @__PURE__ */ a("dl", { children: [
      /* @__PURE__ */ n("dt", { children: "User" }),
      /* @__PURE__ */ n("dd", { "data-check": "user", children: `${e.user.name} (${e.user.id}) ${e.user.departments.join(",")}` }),
      /* @__PURE__ */ n("dt", { children: "Path" }),
      /* @__PURE__ */ n("dd", { "data-check": "path", children: e.path }),
      /* @__PURE__ */ n("dt", { children: "Token" }),
      /* @__PURE__ */ n("dd", { "data-check": "token", children: t }),
      /* @__PURE__ */ n("dt", { children: "Intent" }),
      /* @__PURE__ */ n("dd", { "data-check": "intent", children: e.intent ? `${e.intent.type} ${JSON.stringify(e.intent.payload)}` : "none" }),
      /* @__PURE__ */ n("dt", { children: "Answer" }),
      /* @__PURE__ */ n("dd", { "data-check": "answer", children: b }),
      /* @__PURE__ */ n("dt", { children: "Bus" }),
      /* @__PURE__ */ n("dd", { "data-check": "bus", children: O }),
      /* @__PURE__ */ n("dt", { children: "Floor" }),
      /* @__PURE__ */ n("dd", { "data-check": "floor", children: `${i.name} (${i.slug}, ${i.kind}, ${i.role}) ${e.getWorkspace().id}` }),
      /* @__PURE__ */ n("dt", { children: "Level" }),
      /* @__PURE__ */ n("dd", { "data-check": "level", children: `${i.level ?? "none"} ${i.path.map(X).join(" > ")}` }),
      /* @__PURE__ */ n("dt", { children: "Fetched" }),
      /* @__PURE__ */ n("dd", { "data-check": "fetched", children: M }),
      /* @__PURE__ */ n("dt", { children: "Opened" }),
      /* @__PURE__ */ n("dd", { "data-check": "opened", children: j }),
      /* @__PURE__ */ n("dt", { children: "Picked" }),
      /* @__PURE__ */ n("dd", { "data-check": "picked", children: I }),
      /* @__PURE__ */ n("dt", { children: "Focus" }),
      /* @__PURE__ */ n("dd", { "data-check": "focus", children: e.focus ? e.focus.label : "none" }),
      /* @__PURE__ */ n("dt", { children: "Previews" }),
      /* @__PURE__ */ n("dd", { "data-check": "previews", children: Q.map((o) => `${o}:${e.previewOn(o) ? "on" : "off"}`).join(" ") }),
      /* @__PURE__ */ n("dt", { children: "Thing" }),
      /* @__PURE__ */ n("dd", { "data-check": "thing", children: C }),
      /* @__PURE__ */ n("dt", { children: "React" }),
      /* @__PURE__ */ n("dd", { "data-check": "react", children: A })
    ] }),
    e.reply ? /* @__PURE__ */ a(u, { children: [
      /* @__PURE__ */ n(r, { "data-action": "respond", onPress: () => e.reply.respond({ answer: 42 }), children: "Answer 42" }),
      /* @__PURE__ */ n(r, { "data-action": "cancel", onPress: () => e.reply.cancel(), children: "Decline" })
    ] }) : /* @__PURE__ */ a(u, { children: [
      /* @__PURE__ */ n(r, { "data-action": "notify", onPress: () => e.notify({ title: "Reference notification", body: "From the reference app", needsYou: !0 }), children: "Notify" }),
      /* @__PURE__ */ n(
        r,
        {
          "data-action": "notify-action",
          onPress: () => e.notify({ title: "Reference action", needsYou: !0, actions: [{ label: "Show", intent: { type: "reference.show", payload: { n: 2 } } }] }),
          children: "Notify with an action"
        }
      ),
      /* @__PURE__ */ n(r, { "data-action": "raise", onPress: () => {
        e.raise({ type: "reference.show", payload: { n: 1 } });
      }, children: "Raise" }),
      /* @__PURE__ */ n(r, { "data-action": "request", onPress: () => {
        D();
      }, children: "Request" }),
      /* @__PURE__ */ n(r, { "data-action": "fetch", onPress: () => {
        S();
      }, children: "Fetch" }),
      /* @__PURE__ */ n(r, { "data-action": "emit", onPress: () => e.bus.emit("reference.ping", "pong"), children: "Emit" }),
      /* @__PURE__ */ n(r, { "data-action": "follow", onPress: () => N(!0), children: "Follow" }),
      /* @__PURE__ */ n(r, { "data-action": "open-document", onPress: () => {
        q();
      }, children: "Open a document" }),
      /* @__PURE__ */ n(r, { "data-action": "pick-document", onPress: () => {
        U();
      }, children: "Pick a document" })
    ] })
  ] });
}
function Z({ ctx: e }) {
  return /* @__PURE__ */ a(u, { children: [
    /* @__PURE__ */ n("p", { "data-check": "card", children: `Reference card on ${e.workspace.slug}` }),
    /* @__PURE__ */ n(r, { "data-action": "card-raise", onPress: () => {
      e.raise({ type: "reference.show", payload: { n: 3 } });
    }, children: "Show" })
  ] });
}
const l = /* @__PURE__ */ new WeakMap(), f = /* @__PURE__ */ new WeakMap(), E = (e, t) => {
  const d = B(e);
  l.set(e, d), d.render(t);
}, F = (e) => {
  l.get(e)?.unmount(), l.delete(e);
}, oe = L({
  mount(e, t) {
    window.referenceMounts = (window.referenceMounts ?? 0) + 1, f.set(e, t), E(e, p(v, { ctx: t }));
  },
  // SDK 1.11: its manifest sets followsAddress, so Back and Forward inside it keep it mounted and the shell says where it is now.
  navigated(e, t) {
    const d = f.get(e);
    d && l.get(e)?.render(p(v, { ctx: { ...d, path: t } }));
  },
  unmount(e) {
    F(e), f.delete(e), window.referenceUnmounts = (window.referenceUnmounts ?? 0) + 1;
  },
  // SDK 1.2: a glance card, which Home places on the person's own floor.
  surfaces: {
    "./Glance": {
      mount(e, t) {
        E(e, p(Z, { ctx: t }));
      },
      unmount(e) {
        F(e);
      }
    }
  }
});
export {
  oe as default
};
