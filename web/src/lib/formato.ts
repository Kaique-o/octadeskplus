export const soDigitos = (v: string) => v.replace(/\D/g, '');

/** 12345678000190 -> 12.345.678/0001-90 (aceita o que já vier digitado pela metade) */
export const mascaraCnpj = (v: string) => soDigitos(v).slice(0, 14)
  .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
  .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
