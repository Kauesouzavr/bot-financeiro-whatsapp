import { describe, expect, it } from "vitest";
import { formatRecordingTime, pickRecorderMimeType } from "@/channels/app/voice-recorder";

describe("pickRecorderMimeType", () => {
  it("no iPhone (só grava MP4) escolhe MP4", () => {
    expect(pickRecorderMimeType((type) => type === "audio/mp4")).toBe("audio/mp4");
  });

  it("no Android (WebM com Opus, sem MP4) escolhe WebM com Opus", () => {
    const androidTypes = ["audio/webm;codecs=opus", "audio/webm"];
    expect(pickRecorderMimeType((type) => androidTypes.includes(type))).toBe(
      "audio/webm;codecs=opus",
    );
  });

  it("quando o aparelho grava vários formatos, prefere o MP4", () => {
    expect(pickRecorderMimeType(() => true)).toBe("audio/mp4");
  });

  it("se nenhum formato da lista é gravável, devolve undefined (o navegador usa o padrão dele)", () => {
    expect(pickRecorderMimeType(() => false)).toBeUndefined();
  });
});

describe("formatRecordingTime", () => {
  it.each([
    [0, "0:00"],
    [7, "0:07"],
    [59, "0:59"],
    [60, "1:00"],
    [65.9, "1:05"],
  ])("%s segundos viram %s", (seconds, expected) => {
    expect(formatRecordingTime(seconds)).toBe(expected);
  });

  it("nunca mostra tempo negativo", () => {
    expect(formatRecordingTime(-3)).toBe("0:00");
  });
});
