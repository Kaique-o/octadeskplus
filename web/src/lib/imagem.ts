/** Tamanho máximo do arquivo escolhido (antes de reduzir). */
export const MAX_ARQUIVO = 5 * 1024 * 1024;

/**
 * Lê uma imagem escolhida pelo usuário, reduz para caber em `lado` × `lado` (sem distorcer) e devolve
 * uma data URL em base64 — o formato que octaplus.empresas.logo guarda. WebP com transparência quando o
 * navegador suporta; senão PNG.
 */
export async function imagemParaBase64(arquivo: File, lado = 256): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (PNG, JPG ou WebP).');
  if (arquivo.size > MAX_ARQUIVO) throw new Error('A imagem passa de 5 MB. Escolha uma menor.');

  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não foi possível abrir essa imagem.'));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
