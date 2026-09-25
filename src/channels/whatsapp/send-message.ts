import "server-only";

// Só texto. Não existe função de template — a Meta cobra por template e o
// bot só responde dentro da janela de 24h de uma mensagem recebida.
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const apiVersion = process.env.WHATSAPP_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao enviar mensagem no WhatsApp: ${response.status} ${errorBody}`);
  }
}
