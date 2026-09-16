import { type INestApplication, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { maxUint256 } from 'viem';
import {
  chainMock,
  confirmation,
  metadata,
  owner,
  recipient,
} from '../test/fixtures';
import { unavailable } from './common/api-error';
import { configureApp } from './configure-app';
import { HealthController } from './health.controller';
import { TokenController } from './token/token.controller';
import { TokenChainPort } from './token/token.port';
import { TokenService } from './token/token.service';

describe('HTTP API boundary', () => {
  let app: INestApplication<Server>;
  let chain: ReturnType<typeof chainMock>;

  beforeAll(async () => {
    chain = chainMock();
    const module = await Test.createTestingModule({
      controllers: [TokenController, HealthController],
      providers: [TokenService, { provide: TokenChainPort, useValue: chain }],
    }).compile();
    const nestApp = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    nestApp.useLogger(false);
    configureApp(nestApp);
    app = nestApp;
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it('serves versioned metadata with JSON-safe amounts', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/token/metadata')
      .expect(200, metadata);
  });

  it('returns balance and allowance as integer strings', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/token/balance')
      .query({ address: owner })
      .expect(200, {
        address: owner,
        balanceBaseUnits: '90071992547409930000001',
      });
    await request(app.getHttpServer())
      .get('/api/v1/token/allowance')
      .query({ owner, spender: recipient })
      .expect(200, {
        owner,
        spender: recipient,
        allowanceBaseUnits: '90071992547409930000002',
      });
  });

  it('confirms transfer-from and preserves exact input precision', async () => {
    const amountBaseUnits = '9007199254740993123456789';
    await request(app.getHttpServer())
      .post('/api/v1/token/transfer-from')
      .send({ from: owner, to: recipient, amountBaseUnits })
      .expect(200, {
        ...confirmation,
        from: owner,
        to: recipient,
        amountBaseUnits,
      });
    expect(chain.execute).toHaveBeenCalledWith({
      functionName: 'transferFrom',
      args: [owner, recipient, BigInt(amountBaseUnits)],
    });
  });

  it.each([
    { to: recipient, amountBaseUnits: 1 },
    { to: recipient, amountBaseUnits: '0' },
    { to: recipient, amountBaseUnits: '-1' },
    { to: recipient, amountBaseUnits: '0.1' },
    { to: recipient, amountBaseUnits: '1e18' },
    { to: recipient, amountBaseUnits: (maxUint256 + 1n).toString() },
    { to: recipient },
    { to: 'invalid-address', amountBaseUnits: '1' },
    { to: recipient, amountBaseUnits: '1', privateKey: 'untrusted-marker' },
    { to: recipient, amountBaseUnits: '1', 'untrusted-marker': 'value' },
  ])(
    'rejects invalid or extra body input without echoing it %#',
    async (body) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/token/transfer')
        .send(body)
        .expect(400);
      expect(response.body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
        },
      });
      expect(response.text).not.toContain('untrusted-marker');
      expect(chain.execute).not.toHaveBeenCalled();
    },
  );

  it('rejects extra query inputs and invalid query addresses', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/token/balance')
      .query({ address: owner, privateKey: 'untrusted-marker' })
      .expect(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
        },
      });
    await request(app.getHttpServer())
      .get('/api/v1/token/allowance')
      .query({ owner: 'invalid', spender: recipient })
      .expect(400);
    expect(chain.balance).not.toHaveBeenCalled();
    expect(chain.allowance).not.toHaveBeenCalled();
  });

  it.each([
    '/api/v1/token/metadata',
    `/api/v1/token/balance?address=${owner}`,
    `/api/v1/token/allowance?owner=${owner}&spender=${recipient}`,
    '/health/live',
    '/health/ready',
  ])('rejects request bodies on read route %s', async (route) => {
    const response = await request(app.getHttpServer())
      .get(route)
      .send({ privateKey: 'untrusted-marker' })
      .expect(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
      },
    });
    expect(response.text).not.toContain('untrusted-marker');
    expect(chain.metadata).not.toHaveBeenCalled();
    expect(chain.balance).not.toHaveBeenCalled();
    expect(chain.allowance).not.toHaveBeenCalled();
    expect(chain.ready).not.toHaveBeenCalled();
    expect(chain.execute).not.toHaveBeenCalled();
  });

  it('rejects a HEAD request body before the token controller', async () => {
    const body = '{"privateKey":"untrusted-marker"}';
    const response = await request(app.getHttpServer())
      .head('/api/v1/token/metadata')
      .set('Content-Type', 'application/json')
      .set('Content-Length', String(Buffer.byteLength(body)))
      .send(body)
      .expect(400);
    expect(response.text).toBeUndefined();
    expect(chain.metadata).not.toHaveBeenCalled();
    expect(chain.execute).not.toHaveBeenCalled();
  });

  it('rejects chunked read bodies without inspecting their contents', async () => {
    const pending = request(app.getHttpServer())
      .get('/api/v1/token/metadata')
      .set('Content-Type', 'text/plain')
      .set('Transfer-Encoding', 'chunked');
    pending.write('untrusted-marker');
    const response = await pending.expect(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
      },
    });
    expect(response.text).not.toContain('untrusted-marker');
    expect(chain.metadata).not.toHaveBeenCalled();
    expect(chain.execute).not.toHaveBeenCalled();
  });

  it.each(['/api/v1/token/metadata', '/health/live', '/health/ready'])(
    'rejects unexpected query input on %s',
    async (route) => {
      await request(app.getHttpServer())
        .get(route)
        .query({ privateKey: 'untrusted-marker' })
        .expect(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
          },
        });
    },
  );

  it('rejects unexpected query input on write routes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/token/mint')
      .query({ privateKey: 'untrusted-marker' })
      .send({ to: recipient, amountBaseUnits: '1' })
      .expect(400);
    expect(chain.execute).not.toHaveBeenCalled();
  });

  it('returns sanitized 413 for a body larger than the configured JSON limit', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/token/mint')
      .send({ to: recipient, amountBaseUnits: '1', extra: 'x'.repeat(17000) })
      .expect(413, {
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body is too large',
        },
      });
    expect(chain.execute).not.toHaveBeenCalled();
  });

  it('returns sanitized 400 for malformed JSON', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/token/mint')
      .set('Content-Type', 'application/json')
      .send('{"untrusted-marker":')
      .expect(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
        },
      });
  });

  it('keeps liveness available when readiness fails', async () => {
    chain.ready.mockRejectedValueOnce(unavailable());
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok' });
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503, {
        error: {
          code: 'CHAIN_UNAVAILABLE',
          message: 'Local token service is not ready',
        },
      });
  });

  it('does not expose or log unexpected provider error details', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    chain.metadata.mockRejectedValueOnce(new Error('untrusted-marker'));
    const response = await request(app.getHttpServer())
      .get('/api/v1/token/metadata')
      .expect(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected service error' },
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('untrusted-marker');
    warn.mockRestore();
  });

  it('generates Swagger request schemas from DTOs without signing material', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(response.text).toContain('amountBaseUnits');
    expect(response.text).toContain('/api/v1/token/transfer-from');
    expect(response.text).not.toContain('privateKey');
  });
});
