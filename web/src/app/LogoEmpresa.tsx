import { Building2 } from 'lucide-react';
import FotoEditavel from '../components/FotoEditavel';
import { supabase } from '../lib/supabase';

interface EmpresaLogo { id: string; nome: string; logo: string | null }

const ICONE = { sm: 18, md: 20, lg: 26 };

/** Foto da empresa (ou o prédio). Com `editavel`, o lápis no hover troca a foto (octaplus.empresas.logo). */
export default function LogoEmpresa({ empresa, tamanho = 'md', editavel, onMudou }: {
  empresa: EmpresaLogo; tamanho?: keyof typeof ICONE; editavel?: boolean; onMudou?: () => void;
}) {
  async function salvar(logo: string | null) {
    const { error } = await supabase.rpc('salvar_empresa', { p: { id: empresa.id, logo: logo ?? '' } });
    if (!error) onMudou?.();
    return error;
  }
  return (
    <FotoEditavel foto={empresa.logo} alt={`Logo de ${empresa.nome}`} tamanho={tamanho} titulo={`Foto de ${empresa.nome}`}
      vazio={<Building2 size={ICONE[tamanho]} strokeWidth={1.8} />}
      ajuda="Aparece na escolha de empresa e nas configurações." onSalvar={editavel ? salvar : undefined} />
  );
}
