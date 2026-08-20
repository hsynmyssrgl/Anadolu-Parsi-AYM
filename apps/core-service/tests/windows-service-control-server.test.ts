import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CoreServiceWindowsServiceControlServer,
  readWindowsServiceControlConfiguration
} from '../src/windows-service-control-server.js';

const servers: CoreServiceWindowsServiceControlServer[] = [];
const endpoint = (): string => `\\\\.\\pipe\\ppt-core-service-host-control-${randomBytes(10).toString('hex')}`;
const token = (): string => randomBytes(48).toString('base64url');

const request = async (pipe: string, value: unknown, raw = false): Promise<Record<string, unknown>> =>
  await new Promise((resolve, reject) => {
    const socket = createConnection(pipe);
    let response = '';
    socket.once('connect', () => socket.write(raw ? String(value) : `${JSON.stringify(value)}\n`));
    socket.on('data', (chunk: Buffer) => { response += chunk.toString('utf8'); });
    socket.once('error', reject);
    socket.once('end', () => {
      try {
        resolve(JSON.parse(response.trim()) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
  });

const waitFor = async (predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('test timeout');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

describe('Windows Core Service host control boundary', () => {
  it('accepts one exact authenticated shutdown and rejects its replay', async () => {
    const controlEndpoint = endpoint();
    const authenticationToken = token();
    let shutdownCount = 0;
    const server = new CoreServiceWindowsServiceControlServer({
      endpoint: controlEndpoint,
      authenticationToken,
      requestShutdown: () => { shutdownCount += 1; }
    });
    servers.push(server);
    await server.start();

    const accepted = await request(controlEndpoint, {
      protocolVersion: 1,
      command: 'shutdown',
      authenticationToken
    });
    await waitFor(() => shutdownCount === 1);
    expect(accepted).toEqual({ protocolVersion: 1, ok: true, code: 'SHUTDOWN_ACCEPTED' });

    await expect(request(controlEndpoint, {
      protocolVersion: 1,
      command: 'shutdown',
      authenticationToken
    })).resolves.toEqual({ protocolVersion: 1, ok: false, code: 'REPLAY_DETECTED' });
    expect(shutdownCount).toBe(1);
  });

  it('rejects forged tokens, extra fields and oversized messages without invoking shutdown', async () => {
    const controlEndpoint = endpoint();
    const authenticationToken = token();
    let shutdownCount = 0;
    const server = new CoreServiceWindowsServiceControlServer({
      endpoint: controlEndpoint,
      authenticationToken,
      requestShutdown: () => { shutdownCount += 1; }
    });
    servers.push(server);
    await server.start();

    await expect(request(controlEndpoint, {
      protocolVersion: 1,
      command: 'shutdown',
      authenticationToken: token()
    })).resolves.toEqual({ protocolVersion: 1, ok: false, code: 'AUTHENTICATION_FAILED' });
    await expect(request(controlEndpoint, {
      protocolVersion: 1,
      command: 'shutdown',
      authenticationToken,
      extra: true
    })).resolves.toEqual({ protocolVersion: 1, ok: false, code: 'INVALID_REQUEST' });
    await expect(request(controlEndpoint, `${'x'.repeat(4_097)}\n`, true))
      .resolves.toEqual({ protocolVersion: 1, ok: false, code: 'INVALID_REQUEST' });
    expect(shutdownCount).toBe(0);
  });

  it('requires exact paired service-control environment values and a local Windows pipe', () => {
    const controlEndpoint = endpoint();
    const authenticationToken = token();
    expect(readWindowsServiceControlConfiguration({}, 'win32')).toBeNull();
    expect(readWindowsServiceControlConfiguration({
      PPT_CORE_SERVICE_HOST_CONTROL_ENDPOINT: controlEndpoint,
      PPT_CORE_SERVICE_HOST_CONTROL_TOKEN: authenticationToken
    }, 'win32')).toEqual({ endpoint: controlEndpoint, authenticationToken });
    expect(() => readWindowsServiceControlConfiguration({
      PPT_CORE_SERVICE_HOST_CONTROL_ENDPOINT: '\\\\remote\\pipe\\ppt-core-service-host-control-test',
      PPT_CORE_SERVICE_HOST_CONTROL_TOKEN: authenticationToken
    }, 'win32')).toThrow('CORE_SERVICE_WINDOWS_CONTROL_CONFIGURATION_INVALID');
    expect(() => readWindowsServiceControlConfiguration({
      PPT_CORE_SERVICE_HOST_CONTROL_ENDPOINT: controlEndpoint
    }, 'win32')).toThrow('CORE_SERVICE_WINDOWS_CONTROL_CONFIGURATION_INVALID');
    expect(() => readWindowsServiceControlConfiguration({
      PPT_CORE_SERVICE_HOST_CONTROL_ENDPOINT: controlEndpoint,
      PPT_CORE_SERVICE_HOST_CONTROL_TOKEN: authenticationToken
    }, 'linux')).toThrow('CORE_SERVICE_WINDOWS_CONTROL_CONFIGURATION_INVALID');
  });

  it('keeps the native host thin, DPAPI-protected and explicit about unsigned SCM UAT', () => {
    const host = readFileSync('native/windows-core-service-host/ParsYuvaCoreServiceHost.cs', 'utf8');
    const build = readFileSync('native/windows-core-service-host/build.ps1', 'utf8');
    const install = readFileSync('native/windows-core-service-host/install-service.ps1', 'utf8');
    expect(host).toContain('DataProtectionScope.LocalMachine');
    expect(host).toContain('NamedPipeClientStream');
    expect(host).toContain('restart_limit_exceeded');
    expect(host).toContain('ProcessStartInfo');
    expect(host).not.toContain('PlatformPolicyKernel');
    expect(host).not.toContain('family_database');
    expect(build).toContain('/deterministic+');
    expect(build).toContain('deterministic = $true');
    expect(build).toContain('windowsServiceLifecycleVerified = $false');
    expect(install).toContain("$serviceName = 'ParsYuvaCoreService'");
    expect(install).toContain("'start= auto'");
  });
});
