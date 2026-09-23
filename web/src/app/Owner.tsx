import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, EmptyState, MenuAcoes, Modal, Spinner, Toggle } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import GestaoUsuarios from './GestaoUsuarios';
import LogoEmpresa from './LogoEmpresa';
import { errorMessage, supabase } from '../lib/supabase';
import { useEmpresas, type Empresa } from '../lib/empresas';
import CamposEmpresa, { dadosIniciais, paraSalvar, validarEmpresa, type DadosEmpresa } from './FormEmpresa';

type Janela = { tipo: 'empresa' } | { tipo: 'editar'; empresa: Empresa } | { tipo: 'apagar'; empresa: Empresa } | null;

/** Área do dono da plataforma: empresas (criar, editar, inativar, apagar) e os usuários de cada uma. */
export default function Owner() {
  const nav = useNavigate();
  const { empresas, atual, recarregar, sair } = useEmpresas();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(atual?.id ?? null);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const selecionada = empresas.find((e) => e.id === selecionadaId) ?? empresas[0] ?? null;

  async function alternarEmpresa(e: Empresa, ativa: boolean) {
    const { error } = await supabase.rpc('definir_empresa_ativa', { p_empresa: e.id, p_ativa: ativa });
    if (error) return setAviso({ kind: 'error', text: errorMessage(error) });
    setAviso({ kind: 'success', text: ativa ? `${e.nome} reativada.` : `${e.nome} inativada: não recebe eventos nem envia mensagens, e os usuários dela perdem o acesso.` });
    await recarregar();
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      {aviso && <Alert kind={aviso.kind}>{aviso.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* empresas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Empresas</h2>
            <button className="btn-ghost py-1.5" onClick={() => setJanela({ tipo: 'empresa' })}><Plus className="h-4 w-4" />Nova</button>
          </div>
          <ul className="space-y-2">
            {empresas.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setSelecionadaId(e.id)}
                  className={`card flex w-full items-center gap-3 px-3 py-3 text-left transition hover:border-brand ${selecionada?.id === e.id ? 'border-brand' : ''}`}>
                  <LogoEmpresa empresa={e} tamanho="sm" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{e.nome}</strong>
                    <span className={`chip mt-1 ${e.ativa ? 'bg-green-100 text-success' : 'bg-fog text-muted'}`}>{e.ativa ? 'Ativa' : 'Inativa'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* empresa selecionada e seus usuários */}
        {!selecionada ? (
          <EmptyState icon={<Building2 />} title="Nenhuma empresa" text="Cadastre a primeira empresa para liberar usuários nela." />
        ) : (
          <section className="space-y-4">
            <div className="card flex flex-wrap items-center gap-4 p-5">
              <LogoEmpresa empresa={selecionada} tamanho="lg" editavel onMudou={recarregar} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-title text-lg font-semibold">{selecionada.nome}</h2>
                <p className="text-sm text-muted">Criada em {new Date(selecionada.criada_em).toLocaleDateString('pt-BR')}{atual?.id === selecionada.id && ' · empresa aberta agora'}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Toggle checked={selecionada.ativa} onChange={(v) => alternarEmpresa(selecionada, v)} />
                {selecionada.ativa ? 'Ativa' : 'Inativa'}
              </label>
              <MenuAcoes rotulo="Ações da empresa" itens={[
                { label: 'Editar', icone: <Pencil className="h-4 w-4" />, onClick: () => setJanela({ tipo: 'editar', empresa: selecionada }) },
                { label: 'Apagar', icone: <Trash2 className="h-4 w-4" />, perigo: true, onClick: () => setJanela({ tipo: 'apagar', empresa: selecionada }) },
              ]} />
            </div>

            <GestaoUsuarios empresa={selecionada} podeGerenciar />
          </section>
        )}
      </div>

      {janela?.tipo === 'empresa' && (
        <NovaEmpresa onClose={() => setJanela(null)} onCriada={async (id, nome) => {
          setJanela(null); await recarregar(); setSelecionadaId(id);
          setAviso({ kind: 'success', text: `${nome} criada. Adicione os usuários e, abrindo a empresa, configure a integração do Octadesk.` });
        }} />
      )}
      {janela?.tipo === 'editar' && (
        <EditarEmpresa empresa={janela.empresa} onClose={() => setJanela(null)} onSalva={async (nome) => {
          setJanela(null); await recarregar(); setAviso({ kind: 'success', text: `${nome} atualizada.` });
        }} />
      )}
      {janela?.tipo === 'apagar' && (
        <ApagarEmpresa empresa={janela.empresa} onClose={() => setJanela(null)} onApagada={async () => {
          const eraAberta = atual?.id === janela.empresa.id;
          setJanela(null); setSelecionadaId(null);
          setAviso({ kind: 'success', text: `${janela.empresa.nome} foi apagada com tudo o que tinha.` });
          await recarregar();
          if (eraAberta) { sair(); nav('/empresa', { replace: true }); }
        }} />
      )}
    </div>
  );
}

function NovaEmpresa({ onClose, onCriada }: { onClose: () => void; onCriada: (id: string, nome: string) => void }) {
  const [dados, setDados] = useState<DadosEmpresa>(dadosIniciais());
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function criar() {
    const invalido = validarEmpresa(dados);
    if (invalido) return setErro(invalido);
    setBusy(true); setErro('');
    const { data, error } = await supabase.rpc('salvar_empresa', { p: paraSalvar(dados) });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onCriada(data as string, dados.nome.trim());
  }
  return (
    <Modal open largo title="Nova empresa" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !dados.nome.trim()} onClick={criar}>{busy ? <Spinner /> : 'Criar empresa'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <CamposEmpresa dados={dados} onChange={setDados} autoFocus />
      <p className="mt-3 text-xs text-muted">O fuso define o horário comercial das regras de envio. A empresa nasce vazia: integração, automações, números e chaves de API são só dela.</p>
    </Modal>
  );
}

function EditarEmpresa({ empresa, onClose, onSalva }: { empresa: Empresa; onClose: () => void; onSalva: (nome: string) => void }) {
  const [dados, setDados] = useState<DadosEmpresa>(dadosIniciais(empresa));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function salvar() {
    const invalido = validarEmpresa(dados);
    if (invalido) return setErro(invalido);
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('salvar_empresa', { p: paraSalvar(dados, empresa.id) });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onSalva(dados.nome.trim());
  }
  return (
    <Modal open largo title="Editar empresa" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !dados.nome.trim()} onClick={salvar}>{busy ? <Spinner /> : 'Salvar'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <CamposEmpresa dados={dados} onChange={setDados} autoFocus />
    </Modal>
  );
}

function ApagarEmpresa({ empresa, onClose, onApagada }: { empresa: Empresa; onClose: () => void; onApagada: () => void }) {
  const [confirmacao, setConfirmacao] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function apagar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('apagar_empresa', { p_empresa: empresa.id, p_confirmacao: confirmacao });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onApagada();
  }
  return (
    <Modal open title="Apagar empresa" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-danger" disabled={busy || !confirmacao.trim()} onClick={apagar}>{busy ? <Spinner /> : 'Apagar para sempre'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <Alert kind="warning">Isso apaga <b>{empresa.nome}</b> e tudo dela: integração, automações, histórico de envios, chaves de API e acessos. Não tem volta. Para só pausar, use “Inativa”.</Alert>
      <label className="label mt-4">Digite o nome da empresa para confirmar</label>
      <input className="input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={empresa.nome} />
    </Modal>
  );
}

