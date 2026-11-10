import { VOICE_MAX_SECONDS } from "@/core/ai/voice";

// Formatos que o navegador pode gravar, do preferido ao último. O iPhone (Safari) só grava MP4 com AAC;
// Android e computador gravam WebM ou OGG com Opus. Nada aqui é convertido: o servidor aceita todos.
const RECORDER_MIME_CANDIDATES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

// Escolhe o primeiro formato que o aparelho sabe gravar. Recebe a pergunta "você grava isso?" como
// parâmetro pra funcionar (e ser testada) sem navegador.
export function pickRecorderMimeType(
  isSupported: (mimeType: string) => boolean,
): string | undefined {
  return RECORDER_MIME_CANDIDATES.find((mimeType) => isSupported(mimeType));
}

// "0:07", "1:00". Usado no cronômetro da gravação.
export function formatRecordingTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

export interface VoiceRecording {
  // Para a gravação, solta o microfone e devolve o arquivo (null se não gravou nada).
  stop(): Promise<File | null>;
  // Descarta a gravação sem enviar nada e solta o microfone.
  cancel(): void;
}

// Pede o microfone (o navegador mostra o aviso de permissão) e começa a gravar. A gravação fica só na
// memória do celular: nada é salvo em disco. Para sozinha ao chegar no limite e avisa por onLimitReached.
// Lança erro se a pessoa negar o microfone ou se o aparelho não conseguir gravar.
export async function startVoiceRecording(onLimitReached: () => void): Promise<VoiceRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const releaseMicrophone = () => stream.getTracks().forEach((track) => track.stop());

  let recorder: MediaRecorder;
  try {
    const mimeType = pickRecorderMimeType((type) => MediaRecorder.isTypeSupported(type));
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (error) {
    releaseMicrophone();
    throw error;
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const limitTimer = setTimeout(onLimitReached, VOICE_MAX_SECONDS * 1000);
  const finish = () => {
    clearTimeout(limitTimer);
    releaseMicrophone();
  };

  recorder.start();

  return {
    stop() {
      return new Promise<File | null>((resolve) => {
        if (recorder.state === "inactive") {
          finish();
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          finish();
          const type = recorder.mimeType;
          const blob = new Blob(chunks, { type });
          resolve(blob.size > 0 ? new File([blob], "voz", { type }) : null);
        };
        recorder.stop();
      });
    },
    cancel() {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      chunks.length = 0;
      finish();
    },
  };
}
