import { describe, expect, it } from 'vitest';
import {
  extractSafeLastFour,
  sanitizeErrorMessage,
  sanitizeForLog,
  sanitizeLogString,
} from './log-sanitizer.js';

describe('LogSanitizer (Unit Test)', () => {
  it('deve mascarar PAN e CVV em payloads aninhados preservando apenas os 4 últimos dígitos', () => {
    const payload = {
      orderId: 'ORD-1234',
      payments: [
        {
          card: {
            number: '4111 1111 1111 1234',
            cvv: '999',
            security_code: '777',
          },
        },
      ],
    };

    const sanitized = sanitizeForLog(payload) as typeof payload;
    const card = sanitized.payments[0]!.card;

    expect(card.number).toBe('**** **** **** 1234');
    expect(card.cvv).toBe('***');
    expect(card.security_code).toBe('***');
    expect(sanitized.orderId).toBe('ORD-1234');
  });

  it('deve redactar password, token, JWT, chaves de API, credenciais de banco e Bearer auth', () => {
    const data = {
      password: 'SuperSecretPassword123!',
      token: 'secret-token-value',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature_abc',
      nested: {
        apiKey: 're_1234567890abcdef',
        secretKey: 'sk_test_1234567890abcdef',
      },
    };

    const sanitized = sanitizeForLog(data) as Record<string, unknown>;
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).secretKey).toBe('[REDACTED]');

    const logText =
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature_abc | mysql://hero:secretpass123@localhost:3306/db?token=sensitive_token';
    const cleanLog = sanitizeLogString(logText);

    expect(cleanLog).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(cleanLog).not.toContain('secretpass123');
    expect(cleanLog).not.toContain('sensitive_token');
    expect(cleanLog).toContain('[REDACTED_AUTH]');
    expect(cleanLog).toContain('mysql://hero:[REDACTED]@localhost:3306/db');
    expect(cleanLog).toContain('token=[REDACTED]');
  });

  it('deve lidar com referências circulares e limite de profundidade sem lançar exceção', () => {
    const obj: Record<string, unknown> = { name: 'circular-test' };
    obj.self = obj;

    const sanitized = sanitizeForLog(obj) as Record<string, unknown>;
    expect(sanitized.name).toBe('circular-test');
    expect(sanitized.self).toBe('[Circular]');

    // Max depth test
    let deep: Record<string, unknown> = { level: 0 };
    let current = deep;
    for (let i = 1; i <= 10; i++) {
      const next = { level: i };
      current.child = next;
      current = next;
    }

    const sanitizedDeep = sanitizeForLog(deep, 4) as Record<string, unknown>;
    expect(sanitizedDeep).toBeDefined();
  });

  it('deve neutralizar quebras de linha e caracteres de controle contra Log Injection (CWE-117)', () => {
    const injected = 'Admin User\r\n[ERROR] Fake Log Injection\t\x00';
    const clean = sanitizeLogString(injected);

    expect(clean).not.toContain('\r');
    expect(clean).not.toContain('\n');
    expect(clean).not.toContain('\x00');
    expect(clean).toBe('Admin User [ERROR] Fake Log Injection ');
  });

  it('deve extrair com segurança os últimos 4 dígitos e higienizar mensagens de erro', () => {
    expect(extractSafeLastFour('4111 1111 1111 4321')).toBe('4321');
    expect(extractSafeLastFour('1234')).toBe('1234');
    expect(extractSafeLastFour('123')).toBeNull();
    expect(extractSafeLastFour(null)).toBeNull();
    expect(extractSafeLastFour(12345678)).toBeNull();

    const err = sanitizeErrorMessage('Erro na conexao mysql://user:my_secret@host:3306/db com pan 4111111111119999');
    expect(err).not.toContain('my_secret');
    expect(err).not.toContain('411111111111');
    expect(err).toContain('**** **** **** 9999');
  });

  it('deve lidar com Date inválida em sanitizeForLog sem disparar RangeError', () => {
    expect(sanitizeForLog(new Date('invalid'))).toBe('[Invalid Date]');
    expect(sanitizeForLog(new Date(NaN))).toBe('[Invalid Date]');
    expect(sanitizeForLog({ date: new Date('invalid') })).toEqual({ date: '[Invalid Date]' });
    expect(sanitizeForLog({ valid: new Date('2026-11-12T00:00:00.000Z') })).toEqual({
      valid: '2026-11-12T00:00:00.000Z',
    });
  });

  it('deve higienizar objetos com null-prototype sem disparar TypeError', () => {
    const nullProto = Object.create(null);
    nullProto.foo = 'bar';
    expect(sanitizeLogString(Object.create(null))).toBe('[Object: null prototype]');
    expect(sanitizeForLog(nullProto)).toEqual({ foo: 'bar' });
  });

  it('deve mascarar URLs de banco de dados mesmo quando a senha contém @', () => {
    const dbUrl = 'mysql://admin:p@ssword@localhost:3306/herodb';
    expect(sanitizeLogString(dbUrl)).toBe('mysql://admin:[REDACTED]@localhost:3306/herodb');
    expect(sanitizeLogString(dbUrl)).not.toContain('p@ssword');
    expect(sanitizeLogString(dbUrl)).not.toContain('ssword');

    const multiAt = 'postgres://user:p@ss@w@rd!@localhost:5432/db';
    expect(sanitizeLogString(multiAt)).toBe('postgres://user:[REDACTED]@localhost:5432/db');
    expect(sanitizeLogString(multiAt)).not.toContain('p@ss@w@rd!');
  });

  it('deve mascarar novas chaves secretas (client_secret, private_key, auth_token, session_token, webhook_secret)', () => {
    const payload = {
      client_secret: 'secret-val',
      clientSecret: 'secret-val-camel',
      private_key: 'pk-val',
      privateKey: 'pk-val-camel',
      auth_token: 'at-val',
      authToken: 'at-val-camel',
      session_token: 'st-val',
      sessionToken: 'st-val-camel',
      webhook_secret: 'wh-val',
      webhookSecret: 'wh-val-camel',
    };
    expect(sanitizeForLog(payload)).toEqual({
      client_secret: '[REDACTED]',
      clientSecret: '[REDACTED]',
      private_key: '[REDACTED]',
      privateKey: '[REDACTED]',
      auth_token: '[REDACTED]',
      authToken: '[REDACTED]',
      session_token: '[REDACTED]',
      sessionToken: '[REDACTED]',
      webhook_secret: '[REDACTED]',
      webhookSecret: '[REDACTED]',
    });
  });

  it('deve mascarar número de cartão em campos creditCard e credit_card mesmo quando numérico', () => {
    const payload = {
      creditCard: 4111222233334444,
      credit_card: 5555444433332222,
    };
    const sanitized = sanitizeForLog(payload) as Record<string, unknown>;
    expect(sanitized.creditCard).toBe('**** **** **** 4444');
    expect(sanitized.credit_card).toBe('**** **** **** 2222');
  });

  it('deve neutralizar quebras de linha Unicode (\\u2028, \\u2029 e \\u0085) contra Log Injection (CWE-117)', () => {
    const injected = 'Hello\u2028World\u2029End\u0085Line';
    const clean = sanitizeLogString(injected);
    expect(clean).toBe('Hello World End Line');
    expect(clean).not.toContain('\u2028');
    expect(clean).not.toContain('\u2029');
    expect(clean).not.toContain('\u0085');

    expect(sanitizeLogString('Hello\u2028World\u2029End')).toBe('Hello World End');
  });
});
