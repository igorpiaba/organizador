import unittest
from datetime import date

from tarefas import interpretar_data, decidir_cobertura, contexto_ssl


class InterpretarData(unittest.TestCase):
    def test_dia_mes_no_ano_corrente(self):
        self.assertEqual(interpretar_data('22/10', date(2026, 10, 11)), date(2026, 10, 22))

    def test_dia_mes_vira_o_ano(self):
        self.assertEqual(interpretar_data('05/01', date(2026, 12, 20)), date(2027, 1, 5))

    def test_passado_recente_fica_no_ano(self):
        self.assertEqual(interpretar_data('30/09', date(2026, 10, 11)), date(2026, 9, 30))

    def test_ano_explicito(self):
        self.assertEqual(interpretar_data('22/10/2027', date(2026, 10, 11)), date(2027, 10, 22))

    def test_invalidas(self):
        for texto in ('32/10', 'amanhã', '22-10'):
            with self.assertRaisesRegex(ValueError, 'data inválida'):
                interpretar_data(texto, date(2026, 10, 11))


class DecidirCobertura(unittest.TestCase):
    def test_regras(self):
        d19, d22 = date(2026, 10, 19), date(2026, 10, 22)
        self.assertTrue(decidir_cobertura(None, d19, False))
        self.assertFalse(decidir_cobertura(d22, d19, False))
        self.assertTrue(decidir_cobertura(d22, d19, True))
        self.assertTrue(decidir_cobertura(d19, d22, False))
        self.assertTrue(decidir_cobertura(d22, d22, False))


class ContextoSSL(unittest.TestCase):
    def test_tem_certificados_de_autoridade(self):
        self.assertGreater(contexto_ssl().cert_store_stats()['x509_ca'], 0)


if __name__ == '__main__':
    unittest.main()
