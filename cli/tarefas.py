#!/usr/bin/env python3
"""Atualiza o organizador a partir do Mac (usado pelas skills do Claude).

  tarefas.py cobertura <codigo> --ate DD/MM[/AAAA] [--forcar]
  tarefas.py feito <codigo> [--dia DD/MM[/AAAA]]
  tarefas.py ver <codigo>

Endereço e chave de serviço vêm do Keychain (serviço organizador-supabase).
"""
import argparse
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

FUSO = ZoneInfo('America/Sao_Paulo')


class Falha(Exception):
    pass


def hoje_sp() -> date:
    return datetime.now(FUSO).date()


def interpretar_data(texto: str, hoje: date) -> date:
    m = re.fullmatch(r'(\d{1,2})/(\d{1,2})(?:/(\d{4}))?', texto.strip())
    if not m:
        raise ValueError(f'data inválida: {texto} (use DD/MM)')
    dia, mes, ano = int(m[1]), int(m[2]), m[3]
    try:
        if ano:
            return date(int(ano), mes, dia)
        data = date(hoje.year, mes, dia)
        if data < hoje - timedelta(days=90):
            data = date(hoje.year + 1, mes, dia)
        return data
    except ValueError:
        raise ValueError(f'data inválida: {texto} (use DD/MM)') from None


def decidir_cobertura(atual, nova: date, forcar: bool) -> bool:
    return forcar or atual is None or nova >= atual


def ddmm(d) -> str:
    return d.strftime('%d/%m')


def contexto_ssl() -> ssl.SSLContext:
    # O Python do python.org não usa os certificados do macOS; /etc/ssl/cert.pem é a lista do sistema.
    ctx = ssl.create_default_context()
    if ctx.cert_store_stats()['x509_ca'] == 0 and os.path.exists('/etc/ssl/cert.pem'):
        ctx.load_verify_locations('/etc/ssl/cert.pem')
    return ctx


def keychain(conta: str) -> str:
    r = subprocess.run(['security', 'find-generic-password', '-s', 'organizador-supabase', '-a', conta, '-w'],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise Falha(f'Keychain sem "{conta}" do serviço organizador-supabase')
    return r.stdout.strip()


class Supabase:
    def __init__(self):
        self.url = keychain('url').rstrip('/')
        self.chave = keychain('service_key')

    def pedir(self, metodo, caminho, corpo=None, prefer=None):
        cabecalhos = {'apikey': self.chave, 'Authorization': f'Bearer {self.chave}',
                      'Content-Type': 'application/json'}
        if prefer:
            cabecalhos['Prefer'] = prefer
        dados = json.dumps(corpo).encode() if corpo is not None else None
        req = urllib.request.Request(f'{self.url}/rest/v1/{caminho}', data=dados, method=metodo, headers=cabecalhos)
        try:
            with urllib.request.urlopen(req, timeout=20, context=contexto_ssl()) as r:
                texto = r.read().decode()
                return json.loads(texto) if texto else None
        except urllib.error.HTTPError as e:
            raise Falha(f'Supabase respondeu {e.code} em {caminho.split("?")[0]}') from None
        except urllib.error.URLError as e:
            raise Falha(f'sem conexão com o Supabase ({e.reason})') from None

    def tarefa(self, codigo):
        linhas = self.pedir('GET', f'tarefas?select=*&codigo=eq.{urllib.parse.quote(codigo)}')
        if not linhas:
            raise Falha(f'nenhuma tarefa com o código "{codigo}"')
        return linhas[0]


def cmd_cobertura(sb, args):
    t = sb.tarefa(args.codigo)
    if t['tipo'] != 'cobertura':
        raise Falha(f'"{args.codigo}" não é cobertura (é {t["tipo"]})')
    nova = interpretar_data(args.ate, hoje_sp())
    atual = date.fromisoformat(t['coberto_ate']) if t['coberto_ate'] else None
    if not decidir_cobertura(atual, nova, args.forcar):
        print(f'cobertura atual ({ddmm(atual)}) é maior que {ddmm(nova)}; nada alterado (use --forcar)')
        return
    sb.pedir('PATCH', f'tarefas?id=eq.{t["id"]}', {'coberto_ate': nova.isoformat()})
    sb.pedir('POST', 'historico_cobertura', {'tarefa_id': t['id'], 'user_id': t['user_id'],
                                             'de': t['coberto_ate'], 'para': nova.isoformat(), 'origem': 'automatico'})
    print(f'{t["nome"]}: coberto até {ddmm(nova)}')


def cmd_feito(sb, args):
    t = sb.tarefa(args.codigo)
    dia = interpretar_data(args.dia, hoje_sp()) if args.dia else hoje_sp()
    if t['tipo'] == 'cobertura':
        raise Falha('use "cobertura" para tarefas de cobertura')
    if t['tipo'] == 'rotina':
        sb.pedir('POST', 'conclusoes', {'tarefa_id': t['id'], 'dia': dia.isoformat(), 'user_id': t['user_id']},
                 prefer='resolution=merge-duplicates')
        print(f'{t["nome"]}: feita em {ddmm(dia)}')
    else:
        sb.pedir('PATCH', f'tarefas?id=eq.{t["id"]}', {'concluida_em': datetime.now(timezone.utc).isoformat()})
        print(f'{t["nome"]}: concluída')


def cmd_ver(sb, args):
    t = sb.tarefa(args.codigo)
    print(f'{t["nome"]} ({t["tipo"]}{"" if t["ativa"] else ", pausada"})')
    if t['tipo'] == 'cobertura':
        ate = date.fromisoformat(t['coberto_ate']) if t['coberto_ate'] else None
        print(f'coberto até {ddmm(ate)}' if ate else 'sem data de cobertura')
    elif t['tipo'] == 'rotina':
        hoje = hoje_sp().isoformat()
        feita = sb.pedir('GET', f'conclusoes?select=dia&tarefa_id=eq.{t["id"]}&dia=eq.{hoje}')
        print('feita hoje' if feita else 'pendente hoje')
    else:
        print('concluída' if t['concluida_em'] else f'prazo {t["prazo"] or "sem prazo"}')


def main(argv=None):
    p = argparse.ArgumentParser(prog='tarefas.py', description='Atualiza o organizador.')
    sub = p.add_subparsers(dest='comando', required=True)
    c = sub.add_parser('cobertura')
    c.add_argument('codigo')
    c.add_argument('--ate', required=True)
    c.add_argument('--forcar', action='store_true')
    f = sub.add_parser('feito')
    f.add_argument('codigo')
    f.add_argument('--dia')
    v = sub.add_parser('ver')
    v.add_argument('codigo')
    args = p.parse_args(argv)
    try:
        {'cobertura': cmd_cobertura, 'feito': cmd_feito, 'ver': cmd_ver}[args.comando](Supabase(), args)
    except (Falha, ValueError) as e:
        print(f'não consegui atualizar o organizador: {e}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
