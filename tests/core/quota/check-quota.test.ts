import { describe, expect, it } from "vitest";
import { checkQuota } from "@/core/quota/check-quota";

describe("checkQuota", () => {
  it("envia normalmente e sem aviso quando está longe do limite", () => {
    expect(checkQuota(10, 950)).toEqual({ shouldSend: true, warn: false });
  });

  it("avisa ao cruzar 90% do limite", () => {
    // 950 * 0.9 = 855: a resposta de número 855 já deve avisar.
    expect(checkQuota(854, 950)).toEqual({ shouldSend: true, warn: true });
  });

  it("não avisa logo abaixo de 90%", () => {
    expect(checkQuota(853, 950)).toEqual({ shouldSend: true, warn: false });
  });

  it("entra em modo silencioso ao atingir o limite", () => {
    expect(checkQuota(950, 950)).toEqual({ shouldSend: false, warn: false });
  });

  it("continua em modo silencioso depois do limite", () => {
    expect(checkQuota(1200, 950)).toEqual({ shouldSend: false, warn: false });
  });
});
