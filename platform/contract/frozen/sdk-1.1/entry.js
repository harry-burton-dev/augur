import { render as i, html as d } from "lit";
import "@platform/ui-kit";
const l = (t) => t, f = (t) => t instanceof Error && t.name === "IntentCancelled", c = /* @__PURE__ */ new WeakMap(), h = l({
  async mount(t, e) {
    const n = { token: "waiting", answer: "", bus: "", fetched: "" }, r = e.bus.on("reference.ping", (a) => {
      n.bus = a, o();
    }), s = () => e.request({ type: "reference.answer", payload: { question: "six times seven" } }).then(
      (a) => {
        n.answer = String(a.answer), o();
      },
      (a) => {
        n.answer = f(a) ? "cancelled" : "failed", o();
      }
    ), u = async () => {
      const a = await e.fetch("/api/reference/v1/floor");
      n.fetched = await a.text(), o();
    }, o = () => i(
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
          </dl>
          ${e.reply ? d`<ui-button data-action="respond" @click=${() => e.reply.respond({ answer: 42 })}>Answer 42</ui-button>
                <ui-button data-action="cancel" @click=${() => e.reply.cancel()}>Decline</ui-button>` : d`<ui-button data-action="notify" @click=${() => e.notify({ title: "Reference notification", body: "From the reference app", needsYou: !0 })}>Notify</ui-button>
                <ui-button data-action="notify-action" @click=${() => e.notify({ title: "Reference action", needsYou: !0, actions: [{ label: "Show", intent: { type: "reference.show", payload: { n: 2 } } }] })}>Notify with an action</ui-button>
                <ui-button data-action="raise" @click=${() => {
        e.raise({ type: "reference.show", payload: { n: 1 } });
      }}>Raise</ui-button>
                <ui-button data-action="request" @click=${() => {
        s();
      }}>Request</ui-button>
                <ui-button data-action="fetch" @click=${() => {
        u();
      }}>Fetch</ui-button>
                <ui-button data-action="emit" @click=${() => e.bus.emit("reference.ping", "pong")}>Emit</ui-button>`}
        </section>`,
      t
    );
    c.set(t, r), o(), n.token = typeof await e.getToken() == "string" ? "ok" : "missing", o();
  },
  unmount(t) {
    c.get(t)?.(), i(d``, t), window.referenceUnmounts = (window.referenceUnmounts ?? 0) + 1;
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
  h as default
};
