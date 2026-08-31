// number ya viene validado en formato E.164 sin "+" (ver la regex en api/settings/route.ts) —
// wa.me lo acepta tal cual.
export function buildWhatsAppLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
