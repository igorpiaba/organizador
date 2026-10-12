import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehErroDeLogin } from '../web/erros.js';

test('reconhece sessão vencida ou inválida', () => {
  assert.equal(ehErroDeLogin({ code: 'PGRST301', message: 'JWT expired' }), true);
  assert.equal(ehErroDeLogin({ status: 401, message: 'Unauthorized' }), true);
  assert.equal(ehErroDeLogin({ message: 'invalid JWT: unable to parse' }), true);
  assert.equal(ehErroDeLogin({ name: 'AuthSessionMissingError', message: 'Auth session missing!' }), true);
});
test('falta de internet não é erro de login', () => {
  assert.equal(ehErroDeLogin(new TypeError('Failed to fetch')), false);
  assert.equal(ehErroDeLogin({ status: 500, message: 'Internal' }), false);
  assert.equal(ehErroDeLogin(null), false);
});
