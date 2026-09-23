import { mascaraCnpj, soDigitos } from '../lib/formato';

export const FUSOS = [
  { valor: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { valor: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { valor: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { valor: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { valor: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
];

export interface DadosEmpresa { nome: string; cnpj: string; telefone: string; site: string; fuso: string }

/** Formulário a partir de uma empresa existente (ou vazio, para uma nova). */
export const dadosIniciais = (e?: { nome: string; cnpj: string | null; telefone: string | null; site: string | null; fuso?: string | null }): DadosEmpresa => ({
  nome: e?.nome ?? '', cnpj: mascaraCnpj(e?.cnpj ?? ''), telefone: e?.telefone ?? '', site: e?.site ?? '', fuso: e?.fuso ?? 'America/Sao_Paulo',
});

/** Mensagem de erro, ou null se dá para salvar. */
export function validarEmpresa(d: DadosEmpresa) {
  if (!d.nome.trim()) return 'Informe o nome da empresa.';
  const cnpj = soDigitos(d.cnpj);
  if (cnpj && cnpj.length !== 14) return 'O CNPJ precisa ter 14 dígitos.';
  return null;
}

/** Corpo de octaplus.salvar_empresa. */
export const paraSalvar = (d: DadosEmpresa, id?: string) => ({
  id, nome: d.nome.trim(), cnpj: soDigitos(d.cnpj), telefone: d.telefone.trim(), site: d.site.trim(), fuso: d.fuso,
});

/** Nome, CNPJ, telefone, site e fuso — o mesmo formulário na tela Empresa e na área Owner. */
export default function CamposEmpresa({ dados, onChange, desabilitado, nomeBloqueado, autoFocus }: {
  dados: DadosEmpresa; onChange: (d: DadosEmpresa) => void; desabilitado?: boolean; nomeBloqueado?: boolean; autoFocus?: boolean;
}) {
  const campo = (k: keyof DadosEmpresa) => ({
    value: dados[k], disabled: desabilitado,
    onChange: (e: { target: { value: string } }) => onChange({ ...dados, [k]: k === 'cnpj' ? mascaraCnpj(e.target.value) : e.target.value }),
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="label">Nome da empresa</label>
        <input className="input" placeholder="Ex.: Minha Empresa" autoFocus={autoFocus} {...campo('nome')}
          disabled={desabilitado || nomeBloqueado} title={nomeBloqueado ? 'Só o dono da plataforma muda o nome' : undefined} />
      </div>
      <div><label className="label">CNPJ</label><input className="input tabular-nums" placeholder="00.000.000/0000-00" inputMode="numeric" {...campo('cnpj')} /></div>
      <div><label className="label">Telefone</label><input className="input" placeholder="(11) 99999-9999" {...campo('telefone')} /></div>
      <div><label className="label">Site</label><input className="input" placeholder="https://" {...campo('site')} /></div>
      <div>
        <label className="label">Fuso horário</label>
        <select className="input" {...campo('fuso')}>
          {FUSOS.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
        </select>
      </div>
    </div>
  );
}
