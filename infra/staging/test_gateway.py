import importlib.util
from pathlib import Path
import unittest
from unittest import mock
import subprocess
import tempfile
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('gateway', Path(__file__).with_name('configure-gateway.py'))
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.values = {
            'STAGING_BASIC_AUTH_USER': 'owner',
            'STAGING_BASIC_AUTH_HASH': '$2a$14$' + 'A' * 53,
            'DOMAIN_STAGING_BACKOFFICE': 'bo.staginghml.my.id',
            'DOMAIN_STAGING_HRIS': 'hris.staginghml.my.id',
            'DOMAIN_STAGING_ORDER_WEB': 'order.staginghml.my.id',
        }

    def test_gerbang_melindungi_unggahan_dan_menolak_job_sebelum_autentikasi(self):
        text = gateway.render(self.values)
        self.assertEqual(text.count('basic_auth'), 3)
        self.assertEqual(text.count('respond @jobs 404'), 3)
        for site in text.split('\n}\n')[:3]:
            self.assertLess(site.index('respond @jobs'), site.index('basic_auth'))
        self.assertLess(text.index('basic_auth'), text.index('handle_path /uploads/'))
        self.assertIn('/srv/staging-uploads', text)

    def test_input_tidak_valid_ditolak_sebelum_mengubah_server(self):
        for key, value in [
            ('STAGING_BASIC_AUTH_HASH', ''),
            ('STAGING_BASIC_AUTH_USER', 'owner\n}'),
            ('DOMAIN_STAGING_HRIS', 'hris.hammielion.com'),
            ('DOMAIN_STAGING_HRIS', 'hris.staginghml.my.id {'),
            ('DOMAIN_STAGING_HRIS', 'bo.staginghml.my.id'),
        ]:
            with self.subTest(key=key, value=value):
                values = {**self.values, key: value}
                with self.assertRaises(ValueError):
                    gateway.render(values)

    def test_validasi_gagal_mengembalikan_fragment_lama_atau_menghapus_yang_baru(self):
        for previous in (False, True):
            with self.subTest(previous=previous), tempfile.TemporaryDirectory() as directory:
                calls = []

                def run(*args):
                    calls.append(args)
                    if 'compose' in args:
                        return 'a' * 64
                    if 'cat' in args:
                        return 'import /data/staging-sites*.caddy'
                    if 'validate' in args:
                        raise subprocess.CalledProcessError(1, args)
                    return ''

                with mock.patch.object(gateway, 'read_env', return_value=self.values), \
                     mock.patch.object(gateway, 'run', side_effect=run), \
                     mock.patch.object(gateway.subprocess, 'run', return_value=SimpleNamespace(returncode=0 if previous else 1)):
                    with self.assertRaises(subprocess.CalledProcessError):
                        gateway.configure(directory)
                expected = ('cp', '/data/staging-sites.caddy.backup', '/data/staging-sites.caddy') if previous else ('rm', '-f', '/data/staging-sites.caddy')
                self.assertTrue(any(call[-3:] == expected for call in calls))
                self.assertIn('reload', calls[-1])
                self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
