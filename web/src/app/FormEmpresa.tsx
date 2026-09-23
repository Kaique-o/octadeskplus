import { mascaraCnpj, soDigitos } from '../lib/formato';

export const FUSOS = [
  { valor: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { valor: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { valor: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { valor: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { valor: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
];

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export interface Endereco { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }
export interface DadosEmpresa { nome: string; cnpj: string; telefone: string; site: string; fuso: string; endereco: Endereco }

const mascaraCep = (v: string) => soDigitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');

const enderecoVazio: Endereco = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' };

/** Formulário a partir de uma empresa existente (ou vazio, para uma nova). */
export const dadosIniciais = (e?: {
  nome: string; cnpj: string | null; telefone: string | null; site: string | null; fuso?: string | null; endereco_cobranca?: Partial<Endereco> | null;
}): DadosEmpresa => ({
  nome: e?.nome ?? '', cnpj: mascaraCnpj(e?.cnpj ?? ''), telefone: e?.telefone ?? '', site: e?.site ?? '', fuso: e?.fuso ?? 'America/Sao_Paulo',
  endereco: { ...enderecoVazio, ...(e?.endereco_cobranca ?? {}), cep: mascaraCep(e?.endereco_cobranca?.cep ?? '') },
});

/** Mensagem de erro, ou null se dá para salvar. */
export function validarEmpresa(d: DadosEmpresa) {
  if (!d.nome.trim()) return 'Informe o nome da empresa.';
  const cnpj = soDigitos(d.cnpj);
  if (cnpj && cnpj.length !== 14) return 'O CNPJ precisa ter 14 dígitos.';
  const cep = soDigitos(d.endereco.cep);
  if (cep && cep.length !== 8) return 'O CEP precisa ter 8 dígitos.';
  return null;
}

/** Corpo de octaplus.salvar_empresa. */
export const paraSalvar = (d: DadosEmpresa, id?: string) => ({
  id, nome: d.nome.trim(), cnpj: soDigitos(d.cnpj), telefone: d.telefone.trim(), site: d.site.trim(), fuso: d.fuso,
  endereco_cobranca: { ...d.endereco, cep: soDigitos(d.endereco.cep) },
});

/** Nome, CNPJ, telefone, site, fuso e endereço de cobrança — o mesmo formulário na tela Empresa e na área Owner. */
export default function CamposEmpresa({ dados, onChange, desabilitado, nomeBloqueado, autoFocus }: {
  dados: DadosEmpresa; onChange: (d: DadosEmpresa) => void; desabilitado?: boolean; nomeBloqueado?: boolean; autoFocus?: boolean;
}) {
  const campo = (k: Exclude<keyof DadosEmpresa, 'endereco'>) => ({
    value: dados[k], disabled: desabilitado,
    onChange: (e: { target: { value: string } }) => onChange({ ...dados, [k]: k === 'cnpj' ? mascaraCnpj(e.target.value) : e.target.value }),
  });
  const end = (k: keyof Endereco) => ({
    value: dados.endereco[k], disabled: desabilitado,
    onChange: (e: { target: { value: string } }) => onChange({ ...dados, endereco: { ...dados.endereco, [k]: k === 'cep' ? mascaraCep(e.target.value) : e.target.value } }),
  });
  return (
    <div className="space-y-6">
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

      <div>
        <h3 className="font-semibold">Endereço de cobrança</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2"><label className="label">CEP</label><input className="input tabular-nums" placeholder="00000-000" inputMode="numeric" {...end('cep')} /></div>
          <div className="md:col-span-4"><label className="label">Logradouro</label><input className="input" placeholder="Rua, avenida…" {...end('logradouro')} /></div>
          <div className="md:col-span-2"><label className="label">Número</label><input className="input" placeholder="123" {...end('numero')} /></div>
          <div className="md:col-span-4"><label className="label">Complemento</label><input className="input" placeholder="Sala, andar… (opcional)" {...end('complemento')} /></div>
          <div className="md:col-span-2"><label className="label">Bairro</label><input className="input" {...end('bairro')} /></div>
          <div className="md:col-span-3"><label className="label">Cidade</label><input className="input" {...end('cidade')} /></div>
          <div className="md:col-span-1">
            <label className="label">UF</label>
            <select className="input" {...end('uf')}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
