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
            'DOMAIN_STAGING_BACKOFFICE': 'bo.staginghml.my.id',
            'DOMAIN_STAGING_HRIS': 'hris.staginghml.my.id',
            'DOMAIN_STAGING_ORDER_WEB': 'order.staginghml.my.id',
            'DOMAIN_STAGING_FINANCE': 'finance.staginghml.my.id',
        }

    def test_tanpa_basic_auth_tetap_menolak_job_dan_tidak_diindeks(self):
        text = gateway.render(self.values)
        self.assertNotIn('basic_auth', text)
        self.assertEqual(text.count('respond @jobs 404'), 4)
        self.assertEqual(text.count('respond @internal 404'), 4)
        self.assertEqual(text.count('X-Robots-Tag "noindex, nofollow"'), 4)
        for site in text.split('\n}\n')[:4]:
            self.assertLess(site.index('respond @jobs'), site.index('reverse_proxy'))
        self.assertIn('/srv/staging-uploads', text)

    def test_gateway_meneruskan_api_ke_backoffice_dan_sisanya_ke_berkas_statis(self):
        self.assertNotIn('gateway-staging', gateway.render(self.values))
        text = gateway.render({**self.values, 'DOMAIN_STAGING_GATEWAY': 'app.staginghml.my.id'})
        site = text[text.index('app.staginghml.my.id {'):]
        self.assertNotIn('basic_auth', site)
        self.assertIn('X-Robots-Tag', site)
        self.assertLess(site.index('handle /api/gateway/*'), site.index('reverse_proxy bo-staging:3000'))
        self.assertIn('reverse_proxy gateway-staging:80', site)
        for bad in ('app.hammielion.com', 'bo.staginghml.my.id'):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                gateway.render({**self.values, 'DOMAIN_STAGING_GATEWAY': bad})

    def test_logistik_diteruskan_ke_hris_dan_pintu_internal_ditolak(self):
        self.assertNotIn('logistik.staginghml.my.id', gateway.render(self.values))
        text = gateway.render({**self.values, 'DOMAIN_STAGING_LOGISTICS': 'logistik.staginghml.my.id'})
        site = text[text.index('logistik.staginghml.my.id {'):]
        self.assertLess(site.index('respond @internal 404'), site.index('reverse_proxy hris-staging:3000'))
        self.assertIn('respond @jobs 404', site)
        self.assertIn('X-Robots-Tag', site)
        for bad in ('logistik.hammielion.com', 'hris.staginghml.my.id'):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                gateway.render({**self.values, 'DOMAIN_STAGING_LOGISTICS': bad})

    def test_input_tidak_valid_ditolak_sebelum_mengubah_server(self):
        for key, value in [
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
