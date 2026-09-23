import { useRef, useState } from 'react';
import { Building2, ImageUp, Pencil, Trash2 } from 'lucide-react';
import { Alert, Modal, Spinner } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { imagemParaBase64 } from '../lib/imagem';

interface EmpresaLogo { id: string; nome: string; logo: string | null }

const TAMANHOS = { sm: 'h-9 w-9 rounded-lg', md: 'h-10 w-10 rounded-lg', lg: 'h-14 w-14 rounded-xl' };
const ICONE = { sm: 18, md: 20, lg: 26 };

/**
 * Foto da empresa (ou o prédio, se não tiver). Com `editavel`, passar o mouse mostra um lápis que abre o
 * modal para enviar, trocar ou remover a foto.
 */
export default function LogoEmpresa({ empresa, tamanho = 'md', editavel, onMudou }: {
  empresa: EmpresaLogo; tamanho?: keyof typeof TAMANHOS; editavel?: boolean; onMudou?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const quadro = (
    <span className={`grid shrink-0 place-items-center overflow-hidden ${empresa.logo ? 'border border-line bg-white' : 'bg-brand-soft text-brand'} ${TAMANHOS[tamanho]}`}>
      {empresa.logo
        ? <img src={empresa.logo} alt={`Logo de ${empresa.nome}`} className="h-full w-full object-contain p-0.5" />
        : <Building2 size={ICONE[tamanho]} strokeWidth={1.8} />}
    </span>
  );
  if (!editavel) return quadro;
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="group relative shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label={`Trocar a foto de ${empresa.nome}`} title="Trocar foto">
        {quadro}
        <span className={`absolute inset-0 grid place-items-center bg-ink/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 ${TAMANHOS[tamanho]}`}>
          <Pencil size={ICONE[tamanho] - 4} strokeWidth={2} />
        </span>
      </button>
      {aberto && <ModalLogo empresa={empresa} onClose={() => setAberto(false)} onSalvo={() => { setAberto(false); onMudou?.(); }} />}
    </>
  );
}

function ModalLogo({ empresa, onClose, onSalvo }: { empresa: EmpresaLogo; onClose: () => void; onSalvo: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [imagem, setImagem] = useState<string | null>(empresa.logo);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro('');
    try { setImagem(await imagemParaBase64(arquivo)); } catch (e) { setErro(errorMessage(e)); }
  }

  async function salvar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('salvar_empresa', { p: { id: empresa.id, logo: imagem ?? '' } });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onSalvo();
  }

  return (
    <Modal open title={`Foto de ${empresa.nome}`} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || imagem === empresa.logo} onClick={salvar}>{busy ? <Spinner /> : 'Salvar foto'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <button type="button" onClick={() => entrada.current?.click()}
          className="grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-fog text-muted transition hover:border-brand hover:text-brand"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); escolher(e.dataTransfer.files[0]); }}>
          {imagem ? <img src={imagem} alt="Pré-visualização" className="h-full w-full bg-white object-contain p-1" /> : <ImageUp size={32} strokeWidth={1.6} />}
        </button>
        <div className="space-y-3 text-sm">
          <p className="text-muted">Clique no quadro ou arraste uma imagem (PNG, JPG ou WebP, até 5 MB). Ela é reduzida para 256 px e aparece na escolha de empresa e nas configurações.</p>
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
