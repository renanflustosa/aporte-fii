import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analisar, rendaMensal, sugerirAporte } from './carteira.ts';
import { cotar } from './yahoo.ts';

type Config = {
  aporte: number;
  dyMinimo: number;
  mesesMinimos: number;
  rendaAlvo?: number;
  fiis: { ticker: string; peso: number; cotas: number }[];
};

const ARQUIVO = join(import.meta.dirname, '..', 'carteira.json');

function lerConfig(): Config {
  if (!existsSync(ARQUIVO)) throw new Error(`Falta ${ARQUIVO}: copie carteira.example.json para carteira.json.`);
  const c = JSON.parse(readFileSync(ARQUIVO, 'utf8')) as Config;
  const positivo = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const naoNegativo = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

  const erros: string[] = [];
  if (!naoNegativo(c.aporte)) erros.push('aporte deve ser um número >= 0');
  if (!positivo(c.dyMinimo) || c.dyMinimo >= 1) erros.push('dyMinimo deve ser uma fração entre 0 e 1 (0.10 = 10%)');
  if (!Number.isInteger(c.mesesMinimos) || c.mesesMinimos < 0 || c.mesesMinimos > 12) erros.push('mesesMinimos deve ser inteiro de 0 a 12');
  if (c.rendaAlvo !== undefined && !positivo(c.rendaAlvo)) erros.push('rendaAlvo deve ser um número > 0');
  if (!Array.isArray(c.fiis) || c.fiis.length === 0) erros.push('fiis deve ser uma lista não vazia');
  for (const [i, f] of (Array.isArray(c.fiis) ? c.fiis : []).entries()) {
    if (typeof f.ticker !== 'string' || !/^[A-Z]{4}\d{2}$/.test(f.ticker)) erros.push(`fiis[${i}].ticker deve ser como MXRF11`);
    if (!naoNegativo(f.peso)) erros.push(`fiis[${i}].peso deve ser um número >= 0`);
    if (!Number.isInteger(f.cotas) || f.cotas < 0) erros.push(`fiis[${i}].cotas deve ser inteiro >= 0`);
  }
  if (new Set(c.fiis?.map((f) => f.ticker)).size !== c.fiis?.length) erros.push('fiis tem ticker repetido');
  if (erros.length > 0) throw new Error(`carteira.json inválido:\n- ${erros.join('\n- ')}`);
  return c;
}

function aporteDaLinhaDeComando(padrao: number): number {
  const arg = process.argv[2];
  if (arg === undefined) return padrao;
  const valor = Number(arg.replace(',', '.'));
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`Aporte inválido: "${arg}". Uso: node src/main.ts [aporte]`);
  return valor;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format;
const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;

const config = lerConfig();
const aporte = aporteDaLinhaDeComando(config.aporte);
const agora = new Date();
const cotacoes = await Promise.all(config.fiis.map((f) => cotar(f.ticker)));
const analises = config.fiis.map((f, i) => analisar({ ...f, ...cotacoes[i]! }, config, agora));
const { fiis, sobra } = sugerirAporte(analises, aporte);

const pesoTotal = fiis.reduce((s, f) => s + f.peso, 0);
const patrimonio = fiis.reduce((s, f) => s + f.cotas * f.preco, 0);

console.table(
  fiis.map((f) => ({
    FII: f.ticker,
    Preço: brl(f.preco),
    Teto: brl(f.precoTeto),
    'DY 12m': pct(f.dy),
    Meta: pct(f.peso / pesoTotal),
    Atual: patrimonio > 0 ? pct((f.cotas * f.preco) / patrimonio) : '-',
    Cotas: f.cotas,
    'Nº mágico': Number.isFinite(f.numeroMagico) ? `${f.cotas}/${f.numeroMagico}` : '-',
    Comprar: f.comprar,
    Custo: brl(f.comprar * f.preco),
    Obs: f.bloqueio ?? '',
  })),
);

const antes = rendaMensal(fiis, false);
const depois = rendaMensal(fiis, true);
console.log(`Aporte ${brl(aporte)} | investido ${brl(aporte - sobra)} | sobra ${brl(sobra)}`);
console.log(`Patrimônio ${brl(patrimonio)} -> ${brl(patrimonio + aporte - sobra)}`);
console.log(`Renda mensal estimada ${brl(antes)} -> ${brl(depois)}`);
if (config.rendaAlvo) console.log(`Meta de renda ${brl(config.rendaAlvo)}/mês: ${pct(depois / config.rendaAlvo)} atingida`);
