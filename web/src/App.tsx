import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from './lib/session';
import { useEmpresas } from './lib/empresas';
import Login from './auth/Login';
import ResetPassword from './auth/ResetPassword';
import EscolherEmpresa from './auth/EscolherEmpresa';
import AppLayout from './app/AppLayout';
import Home from './app/Home';
import Integrations from './app/Integrations';
import Empresa from './app/Empresa';
import Usuarios from './app/Usuarios';
import ApiKeys from './app/ApiKeys';
import NaoPerturbe from './app/NaoPerturbe';
import Automations from './app/Automations';
import AutomationWizard from './app/AutomationWizard';
import Profile from './app/Profile';
import Owner from './app/Owner';
import { Spinner } from './components/ui';

// Só entra logado. Quem não tem nenhuma empresa liberada vê "Sem acesso" na tela de escolha.
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const loc = useLocation();
  if (loading) return <div className="grid h-screen place-items-center"><Spinner /></div>;
  if (!session) return <Navigate to={`/entrar?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

// Configurações › Owner: só o dono da plataforma.
function RequireDono({ children }: { children: ReactNode }) {
  const { eDono } = useSession();
  return eDono ? <>{children}</> : <Navigate to="/app/configuracoes" replace />;
}

// Sem empresa escolhida, passa antes pela tela de escolha.
function RequireEmpresa({ children }: { children: ReactNode }) {
  const { atual, carregando } = useEmpresas();
  const loc = useLocation();
  if (carregando) return <div className="grid h-screen place-items-center"><Spinner /></div>;
  if (!atual) return <Navigate to={`/empresa?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/empresa" element={<RequireAuth><EscolherEmpresa /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth><RequireEmpresa><AppLayout /></RequireEmpresa></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="automacoes" element={<Automations />} />
        <Route path="automacoes/nova" element={<AutomationWizard />} />
        <Route path="automacoes/:id" element={<AutomationWizard />} />
        <Route path="configuracoes" element={<Integrations />} />
        <Route path="configuracoes/empresa" element={<Empresa />} />
        <Route path="configuracoes/usuarios" element={<Usuarios />} />
        <Route path="configuracoes/api" element={<ApiKeys />} />
        <Route path="configuracoes/nao-perturbe" element={<NaoPerturbe />} />
        <Route path="configuracoes/owner" element={<RequireDono><Owner /></RequireDono>} />
        <Route path="perfil" element={<Profile />} />
        {/* rotas antigas continuam funcionando */}
        <Route path="estatisticas" element={<Navigate to="/app" replace />} />
        <Route path="api" element={<Navigate to="/app/configuracoes/api" replace />} />
        <Route path="conta" element={<Navigate to="/app/configuracoes" replace />} />
        <Route path="configuracoes/*" element={<Navigate to="/app/configuracoes" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
