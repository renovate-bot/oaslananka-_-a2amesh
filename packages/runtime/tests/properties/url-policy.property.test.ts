import { promises as dns } from 'node:dns';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPrivateIP, validateSafeUrl, type SafeUrlOptions } from '../../src/security/url.js';

const PROPERTY_CONFIG = {
  seed: 20260526,
  numRuns: 1000,
  verbose: true,
} as const;

const byteArbitrary = fc.integer({ min: 0, max: 255 });
const hextetArbitrary = fc.integer({ min: 0, max: 0xffff }).map((value) => value.toString(16));

const loopbackIpv4Arbitrary = fc
  .tuple(fc.constant(127), byteArbitrary, byteArbitrary, byteArbitrary)
  .map(formatIpv4);

const privateNonLoopbackIpv4Arbitrary = fc
  .oneof(
    fc.tuple(fc.constant(0), byteArbitrary, byteArbitrary, byteArbitrary),
    fc.tuple(fc.constant(10), byteArbitrary, byteArbitrary, byteArbitrary),
    fc.tuple(fc.constant(100), fc.integer({ min: 64, max: 127 }), byteArbitrary, byteArbitrary),
    fc.tuple(fc.constant(169), fc.constant(254), byteArbitrary, byteArbitrary),
    fc.tuple(fc.constant(172), fc.integer({ min: 16, max: 31 }), byteArbitrary, byteArbitrary),
    fc.tuple(fc.constant(192), fc.constant(168), byteArbitrary, byteArbitrary),
    fc.constant([169, 254, 169, 254] as const),
  )
  .map(formatIpv4);

const publicIpv4Arbitrary = fc
  .tuple(fc.constantFrom(1, 8, 9, 11, 44, 93), byteArbitrary, byteArbitrary, byteArbitrary)
  .map(formatIpv4)
  .filter((ip) => !isPrivateIP(ip));

const privateNonLoopbackIpv6Arbitrary = fc.oneof(
  fc.constant('::'),
  hextetArbitrary.map((tail) => `fe80::${tail}`),
  hextetArbitrary.map((tail) => `fc00::${tail}`),
  hextetArbitrary.map((tail) => `fd00::${tail}`),
);

const publicIpv6Arbitrary = hextetArbitrary.map((tail) => `2001:4860:4860::${tail}`);

const privateNetworkLiteralUrlArbitrary = fc.oneof(
  privateNonLoopbackIpv4Arbitrary.map((ip) => `http://${ip}/hook`),
  privateNonLoopbackIpv4Arbitrary.map((ip) => `http://${percentEncodeDigits(ip)}/hook`),
  privateNonLoopbackIpv6Arbitrary.map((ip) => `http://[${ip}]/hook`),
  privateNonLoopbackIpv4Arbitrary.map((ip) => `http://[::ffff:${ip}]/hook`),
  privateNonLoopbackIpv4Arbitrary.map((ip) => `http://[::ffff:${ipv4MappedHexTail(ip)}]/hook`),
);

const loopbackLiteralUrlArbitrary = fc.oneof(
  loopbackIpv4Arbitrary.map((ip) => `http://${ip}/hook`),
  fc.constant('http://[::1]/hook'),
  loopbackIpv4Arbitrary.map((ip) => `http://[::ffff:${ip}]/hook`),
  loopbackIpv4Arbitrary.map((ip) => `http://[::ffff:${ipv4MappedHexTail(ip)}]/hook`),
);

const localhostVariantUrlArbitrary = fc.constantFrom(
  'http://localhost/hook',
  'http://LOCALHOST/hook',
  'http://LocalHost/hook',
  'http://%6c%6f%63%61%6c%68%6f%73%74/hook',
  'http://%4c%4f%43%41%4c%48%4f%53%54/hook',
  'http://localhost./hook',
);

const publicLiteralUrlArbitrary = fc.oneof(
  publicIpv4Arbitrary.map((ip) => `https://${ip}/hook`),
  publicIpv6Arbitrary.map((ip) => `https://[${ip}]/hook`),
);

const hostnameArbitrary = fc.integer({ min: 1, max: 999_999 }).map((id) => {
  return `generated-${id}.example.test`;
});

const unsupportedSchemeUrlArbitrary = fc
  .tuple(
    fc.constantFrom('file', 'ftp', 'gopher', 'ws', 'wss'),
    hostnameArbitrary,
    fc.integer({ min: 1, max: 9999 }),
  )
  .map(([scheme, hostname, id]) => {
    if (scheme === 'file') {
      return `file:///tmp/a2a-${id}`;
    }
    return `${scheme}://${hostname}/hook-${id}`;
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('URL safety policy properties', () => {
  it('rejects generated private network literals by default and accepts them only with allowPrivateNetworks', async () => {
    const dnsResolveSpy = vi
      .spyOn(dns, 'resolve')
      .mockRejectedValue(new Error('unexpected DNS resolution'));

    await fc.assert(
      fc.asyncProperty(privateNetworkLiteralUrlArbitrary, async (url) => {
        await expect(validateSafeUrl(url)).rejects.toThrow('SSRF Prevention');
        await expect(validateSafeUrl(url, { allowPrivateNetworks: true })).resolves.toBeInstanceOf(
          URL,
        );
      }),
      PROPERTY_CONFIG,
    );

    expect(dnsResolveSpy).not.toHaveBeenCalled();
  });

  it('rejects generated localhost and loopback variants by default and accepts them only with allowLocalhost', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(loopbackLiteralUrlArbitrary, localhostVariantUrlArbitrary),
        async (url) => {
          const rejectedResolver = createResolver(['127.0.0.1']);
          await expect(
            validateSafeUrl(url, { resolveHostname: rejectedResolver.resolveHostname }),
          ).rejects.toThrow('SSRF Prevention');

          const acceptedResolver = createResolver(['127.0.0.1']);
          await expect(
            validateSafeUrl(url, {
              allowLocalhost: true,
              resolveHostname: acceptedResolver.resolveHostname,
            }),
          ).resolves.toBeInstanceOf(URL);
        },
      ),
      PROPERTY_CONFIG,
    );
  });

  it('accepts generated public IP literals without DNS resolution', async () => {
    const dnsResolveSpy = vi
      .spyOn(dns, 'resolve')
      .mockRejectedValue(new Error('unexpected DNS resolution'));

    await fc.assert(
      fc.asyncProperty(publicLiteralUrlArbitrary, async (url) => {
        await expect(validateSafeUrl(url)).resolves.toBeInstanceOf(URL);
      }),
      PROPERTY_CONFIG,
    );

    expect(dnsResolveSpy).not.toHaveBeenCalled();
  });

  it('applies deterministic mocked DNS answers to generated hostnames', async () => {
    const dnsResolveSpy = vi
      .spyOn(dns, 'resolve')
      .mockRejectedValue(new Error('unexpected DNS resolution'));

    await fc.assert(
      fc.asyncProperty(
        hostnameArbitrary,
        fc.oneof(privateNonLoopbackIpv4Arbitrary, privateNonLoopbackIpv6Arbitrary),
        publicIpv4Arbitrary,
        async (hostname, privateAddress, publicAddress) => {
          const privateResolver = createResolver([privateAddress]);
          await expect(
            validateSafeUrl(`https://${hostname}/callback`, {
              resolveHostname: privateResolver.resolveHostname,
            }),
          ).rejects.toThrow('SSRF Prevention');
          expect(privateResolver.calls).toEqual([hostname]);

          const allowedPrivateResolver = createResolver([privateAddress]);
          await expect(
            validateSafeUrl(`https://${hostname}/callback`, {
              allowPrivateNetworks: true,
              resolveHostname: allowedPrivateResolver.resolveHostname,
            }),
          ).resolves.toBeInstanceOf(URL);
          expect(allowedPrivateResolver.calls).toEqual([hostname]);

          const publicResolver = createResolver([publicAddress]);
          await expect(
            validateSafeUrl(`https://${hostname}/callback`, {
              resolveHostname: publicResolver.resolveHostname,
            }),
          ).resolves.toBeInstanceOf(URL);
          expect(publicResolver.calls).toEqual([hostname]);
        },
      ),
      PROPERTY_CONFIG,
    );

    expect(dnsResolveSpy).not.toHaveBeenCalled();
  });

  it('rejects unsupported schemes before hostname resolution', async () => {
    await fc.assert(
      fc.asyncProperty(unsupportedSchemeUrlArbitrary, async (url) => {
        const resolver = createResolver(['93.184.216.34']);
        await expect(
          validateSafeUrl(url, { resolveHostname: resolver.resolveHostname }),
        ).rejects.toThrow('Unsupported URL protocol');
        expect(resolver.calls).toEqual([]);
      }),
      PROPERTY_CONFIG,
    );
  });
});

function formatIpv4(octets: readonly number[]): string {
  return octets.join('.');
}

function percentEncodeDigits(hostname: string): string {
  return hostname.replaceAll(/\d/g, (digit) => {
    return `%${digit.charCodeAt(0).toString(16)}`;
  });
}

function ipv4MappedHexTail(ip: string): string {
  const [first = 0, second = 0, third = 0, fourth = 0] = ip.split('.').map(Number);
  return `${(first * 256 + second).toString(16)}:${(third * 256 + fourth).toString(16)}`;
}

function createResolver(addresses: readonly string[]): {
  calls: string[];
  resolveHostname: NonNullable<SafeUrlOptions['resolveHostname']>;
} {
  const calls: string[] = [];

  return {
    calls,
    resolveHostname: async (hostname) => {
      calls.push(hostname);
      return [...addresses];
    },
  };
}
