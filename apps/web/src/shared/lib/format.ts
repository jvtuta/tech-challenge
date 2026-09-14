const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

export const formatCurrency = (value: number): string => currency.format(value);
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
