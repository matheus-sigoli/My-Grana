// Service worker do MyGrana: só recebe notificações push e abre o app no lugar certo.
// Não guarda nada em cache (dados financeiros não ficam no aparelho).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = {}; }
  const titulo = typeof d.titulo === "string" ? d.titulo.slice(0, 80) : "MyGrana";
  const texto = typeof d.texto === "string" ? d.texto.slice(0, 200) : "Você tem avisos.";
  // Só caminhos do próprio site: bloqueia "//site.com" e "/\\site.com" (o navegador trata "\\" como "/").
  const href = typeof d.href === "string" && /^\/(?![\/\\])[^\s]*$/.test(d.href) ? d.href : "/avisos";
  event.waitUntil(
    self.registration.showNotification(titulo, { body: texto, icon: "/icon.svg", badge: "/icon.svg", tag: d.tag || "mygrana-avisos", data: { href } }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/avisos";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          c.navigate(href);
          return c.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
