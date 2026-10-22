import { render as o, html as i } from "lit";
import "@platform/ui-kit";
const u = (n) => n, l = (n) => n instanceof Error && n.name === "IntentCancelled", s = /* @__PURE__ */ new WeakMap(), k = u({
  async mount(n, e) {
    const t = { token: "waiting", answer: "", bus: "" }, r = e.bus.on("reference.ping", (d) => {
      t.bus = d, a();
    }), c = () => e.request({ type: "reference.answer", payload: { question: "six times seven" } }).then(
      (d) => {
        t.answer = String(d.answer), a();
      },
      (d) => {
        t.answer = l(d) ? "cancelled" : "failed", a();
      }
    ), a = () => o(
      i`<section data-reference style="padding:var(--space-6)">
          <ui-heading heading="Reference"></ui-heading>
          <dl>
            <dt>User</dt><dd data-check="user">${e.user.name} (${e.user.id}) ${e.user.departments.join(",")}</dd>
            <dt>Path</dt><dd data-check="path">${e.path}</dd>
            <dt>Token</dt><dd data-check="token">${t.token}</dd>
            <dt>Intent</dt><dd data-check="intent">${e.intent ? `${e.intent.type} ${JSON.stringify(e.intent.payload)}` : "none"}</dd>
            <dt>Answer</dt><dd data-check="answer">${t.answer}</dd>
            <dt>Bus</dt><dd data-check="bus">${t.bus}</dd>
          </dl>
          ${e.reply ? i`<ui-button data-action="respond" @click=${() => e.reply.respond({ answer: 42 })}>Answer 42</ui-button>
                <ui-button data-action="cancel" @click=${() => e.reply.cancel()}>Decline</ui-button>` : i`<ui-button data-action="notify" @click=${() => e.notify({ title: "Reference notification", body: "From the reference app", needsYou: !0 })}>Notify</ui-button>
                <ui-button data-action="raise" @click=${() => {
        e.raise({ type: "reference.show", payload: { n: 1 } });
      }}>Raise</ui-button>
                <ui-button data-action="request" @click=${() => {
        c();
      }}>Request</ui-button>
                <ui-button data-action="emit" @click=${() => e.bus.emit("reference.ping", "pong")}>Emit</ui-button>`}
        </section>`,
      n
    );
    s.set(n, r), a(), t.token = typeof await e.getToken() == "string" ? "ok" : "missing", a();
  },
  unmount(n) {
    s.get(n)?.(), o(i``, n), window.referenceUnmounts = (window.referenceUnmounts ?? 0) + 1;
  }
});
export {
  k as default
};
