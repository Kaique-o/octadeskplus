import { useRef, useState, type ReactNode } from 'react';
import { ImageUp, Pencil, Trash2 } from 'lucide-react';
import { Alert, Modal, Spinner } from './ui';
import { errorMessage } from '../lib/supabase';
import { imagemParaBase64 } from '../lib/imagem';

const TAMANHOS = { xs: 'h-8 w-8', sm: 'h-9 w-9', md: 'h-10 w-10', lg: 'h-14 w-14', xl: 'h-20 w-20' };
const RAIO = { xs: 'rounded-lg', sm: 'rounded-lg', md: 'rounded-lg', lg: 'rounded-xl', xl: 'rounded-2xl' };
const LAPIS = { xs: 14, sm: 14, md: 16, lg: 20, xl: 24 };

type Tamanho = keyof typeof TAMANHOS;

/**
 * Foto quadrada (ou redonda) com cantos arredondados. Sem foto, mostra `vazio`. Com `onSalvar`, passar o
 * mouse mostra um lápis que abre o modal para enviar, trocar ou remover — a imagem vai reduzida em base64.
 */
export default function FotoEditavel({ foto, alt, vazio, tamanho = 'md', redonda, classeVazio = 'bg-brand-soft text-brand', titulo, ajuda, onSalvar }: {
  foto: string | null | undefined; alt: string; vazio: ReactNode; tamanho?: Tamanho; redonda?: boolean; classeVazio?: string;
  titulo?: string; ajuda?: string;
  /** Grava a data URL (ou null para remover). Devolve o erro, se houver. */
  onSalvar?: (foto: string | null) => Promise<unknown>;
}) {
  const [aberto, setAberto] = useState(false);
  const forma = `${TAMANHOS[tamanho]} ${redonda ? 'rounded-full' : RAIO[tamanho]}`;
  const quadro = (
    <span className={`grid shrink-0 place-items-center overflow-hidden ${foto ? '' : classeVazio} ${forma}`}>
      {foto ? <img src={foto} alt={alt} className={`h-full w-full object-cover ${forma}`} /> : vazio}
    </span>
  );
  if (!onSalvar) return quadro;
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setAberto(true); }} title="Trocar foto" aria-label={`Trocar ${(titulo ?? 'foto').toLowerCase()}`}
        className={`group relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${redonda ? 'rounded-full' : RAIO[tamanho]}`}>
        {quadro}
        <span className={`absolute inset-0 grid place-items-center bg-ink/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 ${forma}`}>
          <Pencil size={LAPIS[tamanho]} strokeWidth={2} />
        </span>
      </button>
      {aberto && <ModalFoto atual={foto ?? null} titulo={titulo ?? 'Foto'} ajuda={ajuda} redonda={redonda} onSalvar={onSalvar} onClose={() => setAberto(false)} />}
    </>
  );
}

function ModalFoto({ atual, titulo, ajuda, redonda, onSalvar, onClose }: {
  atual: string | null; titulo: string; ajuda?: string; redonda?: boolean; onSalvar: (foto: string | null) => Promise<unknown>; onClose: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [imagem, setImagem] = useState<string | null>(atual);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro('');
    try { setImagem(await imagemParaBase64(arquivo)); } catch (e) { setErro(errorMessage(e)); }
  }

  async function salvar() {
    setBusy(true); setErro('');
    const falha = await onSalvar(imagem);
    setBusy(false);
    if (falha) return setErro(errorMessage(falha));
    onClose();
  }

  return (
    <Modal open title={titulo} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || imagem === atual} onClick={salvar}>{busy ? <Spinner /> : 'Salvar foto'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <button type="button" onClick={() => entrada.current?.click()}
          className={`grid h-32 w-32 shrink-0 place-items-center overflow-hidden border-2 border-dashed border-line bg-fog text-muted transition hover:border-brand hover:text-brand ${redonda ? 'rounded-full' : 'rounded-2xl'}`}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); escolher(e.dataTransfer.files[0]); }}>
          {imagem ? <img src={imagem} alt="Pré-visualização" className="h-full w-full object-cover" /> : <ImageUp size={32} strokeWidth={1.6} />}
        </button>
        <div className="space-y-3 text-sm">
          <p className="text-muted">Clique no quadro ou arraste uma imagem (PNG, JPG ou WebP, até 5 MB). Ela é reduzida para 256 px.{ajuda ? ` ${ajuda}` : ''}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => entrada.current?.click()}><ImageUp className="h-4 w-4" />Escolher imagem</button>
            {imagem && <button type="button" className="btn-danger" onClick={() => setImagem(null)}><Trash2 className="h-4 w-4" />Remover foto</button>}
          </div>
        </div>
      </div>
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
    </Modal>
  );
}
