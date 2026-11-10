import { describe, expect, it } from "vitest";
import { fitWithin } from "@/core/chat/image-size";

describe("fitWithin", () => {
  it("não amplia imagem que já cabe", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("reduz pelo lado maior, mantendo a proporção", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("arredonda e nunca devolve lado zero", () => {
    expect(fitWithin(3001, 1999, 1600)).toEqual({ width: 1600, height: 1066 });
    expect(fitWithin(100000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});
