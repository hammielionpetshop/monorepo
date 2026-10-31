#!/usr/bin/env python3
"""Pasang gerbang staging pada Caddy bersama tanpa memulai ulang aplikasi toko."""
import os
from pathlib import Path
import re
import subprocess
import tempfile


def read_env(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key] = value.strip().strip("'\"")
    return values


def render(values):
    user = values.get('STAGING_BASIC_AUTH_USER', '')
    password_hash = values.get('STAGING_BASIC_AUTH_HASH', '')
    if not re.fullmatch(r'[A-Za-z0-9._-]+', user):
        raise ValueError('Nama pengguna gerbang staging kosong atau tidak valid.')
    if not re.fullmatch(r'\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}', password_hash):
        raise ValueError('Hash bcrypt gerbang staging wajib diisi dengan benar.')
    sites = []
    domains = []
    for key, upstream in [
        ('DOMAIN_STAGING_BACKOFFICE', 'bo-staging'),
        ('DOMAIN_STAGING_HRIS', 'hris-staging'),
        ('DOMAIN_STAGING_ORDER_WEB', 'order-staging'),
    ]:
        domain = values.get(key, '')
        if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.staginghml\.my\.id', domain):
            raise ValueError('Domain staging harus subdomain staginghml.my.id yang valid.')
        domains.append(domain)
        handlers = ''
        if upstream == 'bo-staging':
            handlers = '''
        handle_path /uploads/* {
            root * /srv/staging-uploads
            file_server
        }
'''
        sites.append(f'''{domain} {{
    encode zstd gzip
    route {{
        @jobs path /api/jobs /api/jobs/*
        respond @jobs 404
        @internal path /api/internal /api/internal/*
        respond @internal 404
        basic_auth {{
            {user} {password_hash}
        }}
{handlers}
        handle {{
            reverse_proxy {upstream}:3000
        }}
    }}
}}
''')
    if len(set(domains)) != len(domains):
        raise ValueError('Setiap aplikasi staging harus punya domain berbeda.')
    return '\n'.join(sites)


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()


def configure(directory):
    directory = Path(directory).resolve()
    content = render(read_env(directory / '.env'))
    container = run('docker', 'compose', '-f', '/srv/hammielion/docker-compose.yml', 'ps', '-q', 'caddy')
    if not re.fullmatch('[a-f0-9]{12,64}', container):
        raise ValueError('Container Caddy produksi tidak ditemukan.')
    current = run('docker', 'exec', container, 'cat', '/etc/caddy/Caddyfile')
    if 'import /data/staging-sites*.caddy' not in current:
        raise ValueError('Import staging belum dipasang pada Caddyfile produksi.')

    target = '/data/staging-sites.caddy'
    previous = subprocess.run(['docker', 'exec', container, 'test', '-f', target]).returncode == 0
    if previous:
        run('docker', 'exec', container, 'cp', target, target + '.backup')
    with tempfile.NamedTemporaryFile(mode='w', dir=directory, prefix='.gateway-', delete=False) as handle:
        os.chmod(handle.name, 0o600)
        handle.write(content)
        temporary = handle.name
    try:
        run('docker', 'cp', temporary, container + ':' + target + '.next')
        run('docker', 'exec', container, 'mv', target + '.next', target)
        try:
            run('docker', 'exec', container, 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
            run('docker', 'exec', container, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        except subprocess.CalledProcessError:
            if previous:
                run('docker', 'exec', container, 'cp', target + '.backup', target)
            else:
                run('docker', 'exec', container, 'rm', '-f', target)
            run('docker', 'exec', container, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
            raise
    finally:
        Path(temporary).unlink(missing_ok=True)
    print('Gerbang staging tervalidasi dan dimuat ulang.')


if __name__ == '__main__':
    import sys
    try:
        configure(Path(__file__).parent)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        # Jangan tampilkan argumen perintah atau konfigurasi yang berisi hash akses.
        print('Gagal memasang gerbang staging: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
