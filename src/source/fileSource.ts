export function setupFileSource(opts: {
  video: HTMLVideoElement;
  dropZone: HTMLElement;
  fileInput: HTMLInputElement;
  onLoad: (name: string) => void;
}): void {
  const { video, dropZone, fileInput, onLoad } = opts;
  let currentUrl: string | null = null;

  function load(file: File): void {
    if (!file.type.startsWith('video/')) return;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(file);
    video.src = currentUrl;
    video.load();
    onLoad(file.name);
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) load(f);
    fileInput.value = '';
  });
  for (const ev of ['dragover', 'dragenter'] as const) {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  }
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) load(f);
  });
}
