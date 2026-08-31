import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";

interface Props {
  whatsappNumber: string;
  businessName: string;
}

// Server Component puro — solo se monta cuando el tenant configuró whatsappNumber (ver
// (storefront)/layout.tsx), así que no hace falta chequear nada acá adentro.
export function WhatsAppButton({ whatsappNumber, businessName }: Props) {
  const href = buildWhatsAppLink(whatsappNumber, `Hola ${businessName}, tengo una consulta.`);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 print:hidden"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <MessageCircle className="relative h-7 w-7" strokeWidth={2} />
    </a>
  );
}
