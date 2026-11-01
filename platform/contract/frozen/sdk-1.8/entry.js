import { render as i, html as d } from "lit";
import "@augur/ui-kit";
const h = (t) => t;
class w extends Error {
  name = "IntentError";
}
const r = (t) => t instanceof Error && t.name === "IntentCancelled", m = "document.open", y = "document.pick", c = (t, e) => typeof t == "string" && t.length > 0 && t.length <= e, b = (t) => {
  if (!t || typeof t != "object")
    return !1;
  const e = t;
  return c(e.app, 40) && c(e.id, 200) && c(e.title, 300) && (e.version === void 0 || c(e.version, 40));
}, $ = (t, e) => t.raise({ type: m, payload: e }), g = async (t, e = {}) => {
  const n = await t.request({ type: y, payload: e });
  if (!b(n))
    throw new w("The picker answered with something that is not a document.");
  return n;
}, s = /* @__PURE__ */ new WeakMap(), O = h({
  async mount(t, e) {
    const n = { token: "waiting", answer: "", bus: "", fetched: "", opened: "", picked: "" }, u = e.bus.on("reference.ping", (o) => {
      n.bus = o, a();
    }), p = () => e.request({ type: "reference.answer", payload: { question: "six times seven" } }).then(
      (o) => {
        n.answer = String(o.answer), a();
      },
      (o) => {
        n.answer = r(o) ? "cancelled" : "failed", a();
      }
    ), l = async () => {
      const o = await e.fetch("/api/reference/v1/floor");
      n.fetched = await o.text(), a();
    }, k = () => $(e, { app: "folio", id: "d-contract", title: "Contract document" }).then(
      () => {
        n.opened = "raised", a();
      },
      () => {
        n.opened = "no app", a();
      }
    ), f = () => g(e, { purpose: "For the contract tests" }).then(
      (o) => {
        n.picked = o.title ?? o.id, a();
      },
      (o) => {
        n.picked = r(o) ? "cancelled" : "no app", a();
      }
    ), a = () => i(
      d`<section data-reference style="padding:var(--space-6)">
          <ui-heading heading="Reference"></ui-heading>
          <dl>
            <dt>User</dt><dd data-check="user">${e.user.name} (${e.user.id}) ${e.user.departments.join(",")}</dd>
            <dt>Path</dt><dd data-check="path">${e.path}</dd>
            <dt>Token</dt><dd data-check="token">${n.token}</dd>
            <dt>Intent</dt><dd data-check="intent">${e.intent ? `${e.intent.type} ${JSON.stringify(e.intent.payload)}` : "none"}</dd>
            <dt>Answer</dt><dd data-check="answer">${n.answer}</dd>
            <dt>Bus</dt><dd data-check="bus">${n.bus}</dd>
            <dt>Floor</dt><dd data-check="floor">${e.workspace.name} (${e.workspace.slug}, ${e.workspace.kind}, ${e.workspace.role}) ${e.getWorkspace().id}</dd>
            <dt>Fetched</dt><dd data-check="fetched">${n.fetched}</dd>
            <dt>Opened</dt><dd data-check="opened">${n.opened}</dd>
            <dt>Picked</dt><dd data-check="picked">${n.picked}</dd>
          </dl>
          ${e.reply ? d`<ui-button data-action="respond" @click=${() => e.reply.respond({ answer: 42 })}>Answer 42</ui-button>
                <ui-button data-action="cancel" @click=${() => e.reply.cancel()}>Decline</ui-button>` : d`<ui-button data-action="notify" @click=${() => e.notify({ title: "Reference notification", body: "From the reference app", needsYou: !0 })}>Notify</ui-button>
                <ui-button data-action="notify-action" @click=${() => e.notify({ title: "Reference action", needsYou: !0, actions: [{ label: "Show", intent: { type: "reference.show", payload: { n: 2 } } }] })}>Notify with an action</ui-button>
                <ui-button data-action="raise" @click=${() => {
        e.raise({ type: "reference.show", payload: { n: 1 } });
      }}>Raise</ui-button>
                <ui-button data-action="request" @click=${() => {
        p();
      }}>Request</ui-button>
                <ui-button data-action="fetch" @click=${() => {
        l();
      }}>Fetch</ui-button>
                <ui-button data-action="emit" @click=${() => e.bus.emit("reference.ping", "pong")}>Emit</ui-button>
                <ui-button data-action="open-document" @click=${() => {
        k();
      }}>Open a document</ui-button>
                <ui-button data-action="pick-document" @click=${() => {
        f();
      }}>Pick a document</ui-button>`}
        </section>`,
      t
    );
    s.set(t, u), a(), n.token = typeof await e.getToken() == "string" ? "ok" : "missing", a();
  },
  unmount(t) {
    s.get(t)?.(), i(d``, t), window.referenceUnmounts = (window.referenceUnmounts ?? 0) + 1;
  },
  // SDK 1.2: a glance card, which Home places on the person's own floor.
  surfaces: {
    "./Glance": {
      mount(t, e) {
        i(
          d`<p data-check="card">Reference card on ${e.workspace.slug}</p>
            <ui-button data-action="card-raise" @click=${() => {
            e.raise({ type: "reference.show", payload: { n: 3 } });
          }}>Show</ui-button>`,
          t
        );
      },
      unmount(t) {
        i(d``, t);
      }
    }
  }
});
export {
  O as default
};
