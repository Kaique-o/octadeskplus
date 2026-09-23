-- =====================================================================
-- Octadesk Plus — visitante sem login (anon) não executa nenhuma função do schema.
-- O Postgres dá execute a PUBLIC por padrão; o painel só funciona logado e as funções dele já têm grant
-- explícito para authenticated. Os utilitários que ainda dependiam de PUBLIC ganham grant próprio.
-- =====================================================================

revoke execute on all functions in schema octaplus from public, anon;
alter default privileges in schema octaplus revoke execute on functions from public, anon;

grant execute on function
  octaplus.atende_condicoes(jsonb, jsonb), octaplus.intervalo(integer, octaplus.unidade_tempo),
  octaplus.normalizar_telefone(text), octaplus.proximo_horario_util(timestamptz)
to authenticated;
