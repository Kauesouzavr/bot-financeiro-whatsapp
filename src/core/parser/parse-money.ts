// "45", "45,90", "1.234,56" (vírgula = decimal, ponto = separador de milhar).
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.trim();

  if (cleaned.includes(",")) {
    const lastComma = cleaned.lastIndexOf(",");
    const intPart = cleaned.slice(0, lastComma).replace(/\./g, "");
    const decPart = cleaned.slice(lastComma + 1).replace(/\D/g, "");
    const intValue = Number.parseInt(intPart, 10);
    if (Number.isNaN(intValue)) return null;
    return intValue * 100 + Number.parseInt((decPart + "00").slice(0, 2), 10);
  }

  if (cleaned.includes(".")) {
    const lastDot = cleaned.lastIndexOf(".");
    const afterDot = cleaned.slice(lastDot + 1);
    if (afterDot.length === 2) {
      const intValue = Number.parseInt(cleaned.slice(0, lastDot).replace(/\./g, ""), 10);
      if (Number.isNaN(intValue)) return null;
      return intValue * 100 + Number.parseInt(afterDot, 10);
    }
    const intValue = Number.parseInt(cleaned.replace(/\./g, ""), 10);
    if (Number.isNaN(intValue)) return null;
    return intValue * 100;
  }

  const intValue = Number.parseInt(cleaned, 10);
  if (Number.isNaN(intValue)) return null;
  return intValue * 100;
}
