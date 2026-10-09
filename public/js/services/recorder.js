// Voice-note recording with MediaRecorder.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const t0 = Date.now();
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise((resolve) => {
      rec.onstop = () => { release(); resolve({ blob: new Blob(chunks, { type: rec.mimeType }), duration: (Date.now() - t0) / 1000 }); };
      rec.stop();
    }),
    cancel: () => { rec.onstop = release; rec.stop(); },
  };
}
