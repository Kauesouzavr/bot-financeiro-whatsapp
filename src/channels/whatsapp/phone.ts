// O wa_id pode chegar com ou sem o nono dígito (ex.: 5511987654321 vs 551187654321).
// Gera as duas formas possíveis pra comparar com o telefone cadastrado em `users`.
export function phoneVariants(waId: string): string[] {
  const digits = waId.replace(/\D/g, "");

  if (!digits.startsWith("55") || digits.length < 12) return [digits];

  const prefix = digits.slice(0, 4); // "55" + DDD
  const subscriber = digits.slice(4);

  if (subscriber.length === 9 && subscriber.startsWith("9")) {
    return [digits, prefix + subscriber.slice(1)];
  }

  if (subscriber.length === 8) {
    return [digits, prefix + "9" + subscriber];
  }

  return [digits];
}

// Mascara o telefone pra log seguro: mantém DDI+DDD e os 4 últimos dígitos.
// "5524999994137" -> "5524*****4137"
export function maskPhone(phone: string): string {
  if (phone.length <= 8) return "*".repeat(phone.length);
  const visibleStart = phone.slice(0, 4);
  const visibleEnd = phone.slice(-4);
  const masked = "*".repeat(phone.length - 8);
  return `${visibleStart}${masked}${visibleEnd}`;
}
