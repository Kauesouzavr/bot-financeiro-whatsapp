import { describe, expect, it } from "vitest";
import { isSimulatorEnabled } from "@/channels/simulator/enabled";

describe("isSimulatorEnabled", () => {
  it("fica ligado em desenvolvimento", () => {
    expect(isSimulatorEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("fica ligado nos testes", () => {
    expect(isSimulatorEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("fica desligado em produção", () => {
    expect(isSimulatorEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("só liga em produção com SIMULATOR_ENABLED=true", () => {
    expect(isSimulatorEnabled({ NODE_ENV: "production", SIMULATOR_ENABLED: "true" })).toBe(true);
    expect(isSimulatorEnabled({ NODE_ENV: "production", SIMULATOR_ENABLED: "1" })).toBe(false);
    expect(isSimulatorEnabled({ NODE_ENV: "production", SIMULATOR_ENABLED: "" })).toBe(false);
  });
});
