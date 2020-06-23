const { readFileSync } = require('fs');
const path = require('path');
const https = require('https');

const jose = require('jose');
const helmet = require('koa-helmet');
const pem = require('https-pem');

const { Provider } = require('../../lib'); // require('oidc-provider');

const OFFICIAL_CERTIFICATION = 'https://www.certification.openid.net';
const { PORT = 3000, ISSUER = `http://localhost:${PORT}`, SUITE_BASE_URL = OFFICIAL_CERTIFICATION } = process.env;

const ALGS = ['PS256', 'ES256', 'EdDSA'];
const tokenEndpointAuthMethods = ['private_key_jwt', 'self_signed_tls_client_auth'];

const normalize = (cert) => cert.toString().replace(/(?:-----(?:BEGIN|END) CERTIFICATE-----|\s)/g, '');

const JWK_PKJWTONE = jose.JWK.asKey(readFileSync(path.join(__dirname, 'pkjwtone.key')), { alg: 'PS256', use: 'sig' }).toJWK();
const JWK_PKJWTTWO = jose.JWK.asKey(readFileSync(path.join(__dirname, 'pkjwttwo.key')), { alg: 'PS256', use: 'sig' }).toJWK();
const JWK_MTLSONE = jose.JWK.asKey(readFileSync(path.join(__dirname, 'mtlsone.key')), { x5c: [normalize(readFileSync(path.join(__dirname, 'mtlsone.crt')))], alg: 'PS256', use: 'sig' }).toJWK();
const JWK_MTLSTWO = jose.JWK.asKey(readFileSync(path.join(__dirname, 'mtlstwo.key')), { x5c: [normalize(readFileSync(path.join(__dirname, 'mtlstwo.crt')))], alg: 'PS256', use: 'sig' }).toJWK();
const PIETER_CERT = {
  e: 'AQAB',
  n: 'q_VMoR77SK9kJoSv2TsEXzLEhPyS3AcNyX2eeGWtyy9Ys-6dXLyaWpKGJjfXp2K-FsBp8H9naz2fjKKk5Yh9RtnnKmovXJ3MYPQwrIWklocrLR2GemgX-bfKoiAV8H6cvV0-8yzgPFV6-1BGV7jwObT0dgVQuu6B9JUxsysJx0jpbDwY5lJT3nCvFTTTpuGMDLBSSbhhva7_qywGytE0TPxUo-k9noqykrGq0961G-9c9-3VQIpycYccDSWOTJZWdS0CL0YzEEExugafl0lApg6XO86U7ankSa6gHXOgu0c8DR0ZR9Qk-c173ozog6Fe3k1ijUZhzHnDsbj5CdZBjQ',
  kty: 'RSA',
  kid: '-8v_umxArXLPlqt6mgVxznjQJ68nTPRxLee94gIv5K0',
  x5c: [
    'MIIFPjCCBCagAwIBAgIQCDDO7LHnzcaiW38hyvy0YTANBgkqhkiG9w0BAQsFADBpMQswCQYDVQQGEwJOTDEWMBQGA1UECBMNTm9vcmQtSG9sbGFuZDESMBAGA1UEBxMJQW1zdGVyZGFtMQ8wDQYDVQQKEwZURVJFTkExHTAbBgNVBAMTFFRFUkVOQSBQZXJzb25hbCBDQSAzMB4XDTE5MDkwNjAwMDAwMFoXDTIyMDkwNjEyMDAwMFowaDELMAkGA1UEBhMCQkUxDzANBgNVBAcTBkxldXZlbjEqMCgGA1UEChMhS2F0aG9saWVrZSBVbml2ZXJzaXRlaXQgdGUgTGV1dmVuMRwwGgYDVQQDExNQaWV0ZXIgUGhpbGlwcGFlcnRzMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/VMoR77SK9kJoSv2TsEXzLEhPyS3AcNyX2eeGWtyy9Ys+6dXLyaWpKGJjfXp2K+FsBp8H9naz2fjKKk5Yh9RtnnKmovXJ3MYPQwrIWklocrLR2GemgX+bfKoiAV8H6cvV0+8yzgPFV6+1BGV7jwObT0dgVQuu6B9JUxsysJx0jpbDwY5lJT3nCvFTTTpuGMDLBSSbhhva7/qywGytE0TPxUo+k9noqykrGq0961G+9c9+3VQIpycYccDSWOTJZWdS0CL0YzEEExugafl0lApg6XO86U7ankSa6gHXOgu0c8DR0ZR9Qk+c173ozog6Fe3k1ijUZhzHnDsbj5CdZBjQIDAQABo4IB4TCCAd0wHwYDVR0jBBgwFoAU8CHpSXdzn4WuGDvoUnAUBu1C7sowHQYDVR0OBBYEFFp3ct/711kj4yUq1+0X/Mv7DnMxMAwGA1UdEwEB/wQCMAAwLQYDVR0RBCYwJIEicGlldGVyLnBoaWxpcHBhZXJ0c0Bjcy5rdWxldXZlbi5iZTAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsGAQUFBwMEMEMGA1UdIAQ8MDowOAYKYIZIAYb9bAQBAjAqMCgGCCsGAQUFBwIBFhxodHRwczovL3d3dy5kaWdpY2VydC5jb20vQ1BTMHUGA1UdHwRuMGwwNKAyoDCGLmh0dHA6Ly9jcmwzLmRpZ2ljZXJ0LmNvbS9URVJFTkFQZXJzb25hbENBMy5jcmwwNKAyoDCGLmh0dHA6Ly9jcmw0LmRpZ2ljZXJ0LmNvbS9URVJFTkFQZXJzb25hbENBMy5jcmwwcwYIKwYBBQUHAQEEZzBlMCQGCCsGAQUFBzABhhhodHRwOi8vb2NzcC5kaWdpY2VydC5jb20wPQYIKwYBBQUHMAKGMWh0dHA6Ly9jYWNlcnRzLmRpZ2ljZXJ0LmNvbS9URVJFTkFQZXJzb25hbENBMy5jcnQwDQYJKoZIhvcNAQELBQADggEBALEk4C34xTbcMm/qPxkEac/++auxInjO7lSvylpgUpID8vCPRcNE8ulPHNhGsuNHmD/ZMkExYZNhH91F4yTbb0qWho1jCBKR31Gd+/gbZWO3kGlhQ2L5J9wjh151Ets/rTCyL7bDrFMreFjjlq0HsemcCvfl6GIeBk6/OLBZqase+BrWOY2C03f9s1JIffLX52NAuqjlkIwS6a5nXwKKhvrxMF+mpmKqj4rGl7sgJWKetKfHZPQIKWicB+33FIEwe2y/ZwcUPqSemkb/a5tflLe36oGECe6lgy7rQH27fCgNFkiHCNsfLFSFYCCXfG8s+hX22Acn6h3us2FC9uuX/s8=',
  ],
  x5t: 'e14U_0lRS3I8Y52s8q14Y9YzdQA',
  'x5t#S256': '9KGCCIST3a4eGWK7F-65wDFzuc42Twt0kNy8AaoMfnw',
};

const fapi = new Provider(ISSUER, {
  acrValues: ['urn:mace:incommon:iap:silver'],
  routes: {
    userinfo: '/accounts',
  },
  jwks: {
    keys: [
      {
        alg: 'PS256',
        d: 'dxzWeLBYGwOgNb-S-4RCDxz7U6lUPPZaIkrbmkpLsdDdZOkMXGg_jk2LIJ3tYgAvZkWm87ZQqKjN2ADzJmpHvu-vCLuh8ccpwaiTXfWTOjjii0-Cfq0-fT6aQpIglbwubVKi1Tqxz-AglrMnCkNICm-e0GsotXFskxhwybp8IAZP__Up1pg-G9Dg_Timtepw55HjO4xDhzY70zV2NqSDEIvKOleyIZj4JP5kCkwP4_FJw_KynXwlxKvCshtFC3U2IEWWUaUQmM8Yy1Hz2x3TqImLQTWs3EMm6oRuhS0Y4tg9VlzJqnetdd6Ulh-DFzSB37KnBZS1qvnGGG4Cri9IkQ',
        dp: 'tc9sHeUoX1V1cedHpn0VUNiFwCSRTIn6IMzaSRS4f3IUMbLUHv6Ybt9MRco3hBRV1PrJv8K2YPWzZnNIoFF6gILIIsmz1EJX36lcHtIme0GLAt3BFNm_ofmxA6pLPawtDvo_uFpTBm-Z2frq-BSGeDGh5_Tr1cdlS1RT70RJzbk',
        dq: 'FXlVWUgfSZ3HDqkuqcTGrFq4DPsPFOHEmnkUpT9TRFTXddWqSQe4IZvoWpidxORHD7a0-8x_DhXA40zLVZ42dOa8O7QUEweC9JQEY7DnD6ORZvbALc55CKBDrE52C9y5sk2FM2mWU2YudqDwt2SMZn3vGFTjygQ_P0EBFI08e80',
        e: 'AQAB',
        kty: 'RSA',
        n: 'sUQ6a7yX-qCAIgqYl_pzn2yK5RsPb5zjxMG1v2bvlvf6l6LyvJkxEr4dWLAbn9WAV72GuyMkvWfVi13fu4cYl2vdkIFBt0JGT40QxkMUp0izHs4RiLK1GTrwJ2qX7H67EaNNWFeE9Yqh3sIRyQgHqQf6L9rZFWBSED-M3OaiwH-zdwrMzjQH6wCEjmuyTFiNLO2QI6Yr7dDl1rPjWvN9d8pHHWxkRMAnQrL5_mfvOD_j1Tr5blXYTMHHpThOHVM2Ibe4_5YDmPaRXFMgQrPjz6mlUa9d1EL7CuxLd19S3A_6XEMB2juo0RRCfaHK7ZORPJKa36qrVZVhXK3Geuqorw',
        p: '5SLM2g4Uv3Q1-PGqwKPQ8h8Onp674FTxxYAHCh8mivgCGx7uIjVaOxCKvCimi8NCgtON0a1QdGY-BT3NsewJUvaniWyb5BZo-kpdkSzXCvQpWuWT_iSorgEgl4anJ59JZH_QW7wtjRnF8jWnw-_nkNv4HIIVd7fdKKCkpGi1Drk',
        q: 'xgyjgfZdlfpne27vdlxi5VGmNnBnLRAe_a7Wgo6JdmKPMPa1qugxVM5tUhoYjUuUpHxi8gDSxb0-N_kIqTu7zp2Ly9iB8wQIyyYmdxN7J_B5bSn5rfTcu_Uz-EuYVEGfj0hk5_aNQc0y02Di1L4QrnMNRGBo3jWCCRZrjqyHfqc',
        qi: 'nmJaonUO_d62824V6YmWuEX7imXdgHKRi-tY4IUDJbrm7lKEfcn_xazqilECh1xm7O8b4bj0th3JrRcs1Al0sWP1FwVHjzzmg5oqq26PvHjmtVIHn3cXGT6AmY8-eUPkYgPBc61Ej58Usazm1iuRIe-wNIBeL244kFTQK7zJfnE',
        use: 'sig',
      },
      {
        alg: 'ES256',
        crv: 'P-256',
        d: 'otMhQm75BL5LLmfkCtDDbAxHSLsj2zqBNJvf0C1zY2E',
        kty: 'EC',
        use: 'sig',
        x: 'p9xTCnXKLoJnBOpm1kzSgPt87AIZJZLtdlAXnUk3rxY',
        y: 'ZpaFStCyyWXA_UFQe-rwsSIgOGw92uuzO4BLbvUKkpY',
      },
      {
        alg: 'EdDSA',
        crv: 'Ed25519',
        d: '0OlblX_LYlFnDRD8yEE5gkc4vZw6T94uDCsxRfIEpKo',
        kty: 'OKP',
        use: 'sig',
        x: 'oZrknP771NulaB41XAkHQlvZBLlFnVtlE4AcmGpsGYU',
      },
    ],
  },
  scopes: ['openid', 'offline_access'],
  clients: [
    {
      client_id: 'pkjwt-one',
      response_types: ['code', 'code id_token'],
      grant_types: ['implicit', 'authorization_code', 'refresh_token'],
      redirect_uris: [
        `${SUITE_BASE_URL}/test/a/oidc-provider-pkjwt/callback`,
        'https://staging.certification.openid.net/test/a/oidc-provider-pkjwt/callback',
        `${SUITE_BASE_URL}/test/a/oidc-provider-pkjwt/callback?dummy1=lorem&dummy2=ipsum`,
        'https://staging.certification.openid.net/test/a/oidc-provider-pkjwt/callback?dummy1=lorem&dummy2=ipsum',
      ],
      token_endpoint_auth_method: 'private_key_jwt',
      jwks: {
        keys: [JWK_PKJWTONE],
      },
    },
    {
      client_id: 'pkjwt-two',
      response_types: ['code', 'code id_token'],
      grant_types: ['implicit', 'authorization_code', 'refresh_token'],
      redirect_uris: [
        `${SUITE_BASE_URL}/test/a/oidc-provider-pkjwt/callback`,
        'https://staging.certification.openid.net/test/a/oidc-provider-pkjwt/callback',
        `${SUITE_BASE_URL}/test/a/oidc-provider-pkjwt/callback?dummy1=lorem&dummy2=ipsum`,
        'https://staging.certification.openid.net/test/a/oidc-provider-pkjwt/callback?dummy1=lorem&dummy2=ipsum',
      ],
      token_endpoint_auth_method: 'private_key_jwt',
      jwks: {
        keys: [JWK_PKJWTTWO],
      },
    },
    {
      client_id: 'mtls-one',
      response_types: ['code', 'code id_token'],
      grant_types: ['implicit', 'authorization_code', 'refresh_token'],
      redirect_uris: [
        `${SUITE_BASE_URL}/test/a/oidc-provider-mtls/callback`,
        'https://staging.certification.openid.net/test/a/oidc-provider-mtls/callback',
        `${SUITE_BASE_URL}/test/a/oidc-provider-mtls/callback?dummy1=lorem&dummy2=ipsum`,
        'https://staging.certification.openid.net/test/a/oidc-provider-mtls/callback?dummy1=lorem&dummy2=ipsum',
      ],
      token_endpoint_auth_method: 'self_signed_tls_client_auth',
      jwks: {
        keys: [JWK_MTLSONE],
      },
    },
    {
      client_id: 'mtls-two',
      response_types: ['code', 'code id_token'],
      grant_types: ['implicit', 'authorization_code', 'refresh_token'],
      redirect_uris: [
        `${SUITE_BASE_URL}/test/a/oidc-provider-mtls/callback`,
        'https://staging.certification.openid.net/test/a/oidc-provider-mtls/callback',
        `${SUITE_BASE_URL}/test/a/oidc-provider-mtls/callback?dummy1=lorem&dummy2=ipsum`,
        'https://staging.certification.openid.net/test/a/oidc-provider-mtls/callback?dummy1=lorem&dummy2=ipsum',
      ],
      token_endpoint_auth_method: 'self_signed_tls_client_auth',
      jwks: {
        keys: [JWK_MTLSTWO],
      },
    },
    {
      client_id: 'pieter-mtls',
      response_types: ['code', 'code id_token'],
      grant_types: ['implicit', 'authorization_code', 'refresh_token'],
      redirect_uris: [
        'https://oauch.io/Callback',
      ],
      token_endpoint_auth_method: 'self_signed_tls_client_auth',
      jwks: {
        keys: [PIETER_CERT],
      },
    },
    {
      client_id: 'pieter-pkjwt',
      response_types: ['code', 'code id_token'],
      grant_types: ['implicit', 'authorization_code', 'refresh_token'],
      redirect_uris: [
        'https://oauch.io/Callback',
      ],
      token_endpoint_auth_method: 'private_key_jwt',
      jwks: {
        keys: [PIETER_CERT],
      },
    },
  ],
  clientDefaults: {
    authorization_signed_response_alg: 'PS256',
    grant_types: ['authorization_code', 'implicit'],
    id_token_signed_response_alg: 'PS256',
    introspection_signed_response_alg: 'PS256',
    request_object_signing_alg: 'PS256',
    response_types: ['code id_token'],
    scope: 'openid offline_access',
    tls_client_certificate_bound_access_tokens: true,
    token_endpoint_auth_method: 'private_key_jwt',
  },
  clockTolerance: 5,
  features: {
    fapiRW: { enabled: true },
    mTLS: {
      enabled: true,
      certificateBoundAccessTokens: true,
      selfSignedTlsClientAuth: true,
      getCertificate(ctx) {
        if (SUITE_BASE_URL === OFFICIAL_CERTIFICATION) {
          return unescape(ctx.get('x-ssl-client-cert').replace(/\+/g, ' '));
        }

        const peerCertificate = ctx.socket.getPeerCertificate();
        if (peerCertificate.raw) {
          return `-----BEGIN CERTIFICATE-----\n${peerCertificate.raw.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
        }
        return undefined;
      },
    },
    claimsParameter: { enabled: true },
    introspection: { enabled: true },
    jwtIntrospection: { enabled: true },
    jwtResponseModes: { enabled: true },
    pushedAuthorizationRequests: { enabled: true },
    requestObjects: {
      request: true,
      requestUri: true,
      requireUriRegistration: true,
      mergingStrategy: {
        name: 'strict',
      },
    },
    revocation: { enabled: true },
  },
  responseTypes: ['code id_token', 'code'],
  tokenEndpointAuthMethods,
  whitelistedJWA: {
    authorizationSigningAlgValues: ALGS,
    idTokenSigningAlgValues: ALGS,
    introspectionSigningAlgValues: ALGS,
    requestObjectSigningAlgValues: ALGS,
    tokenEndpointAuthSigningAlgValues: ALGS,
    userinfoSigningAlgValues: ALGS,
  },
});

const orig = fapi.interactionResult;
fapi.interactionResult = function patchedInteractionResult(...args) {
  if (args[2] && args[2].login) {
    args[2].login.acr = 'urn:mace:incommon:iap:silver'; // eslint-disable-line no-param-reassign
  }

  return orig.call(this, ...args);
};

fapi.use(helmet());

if (process.env.NODE_ENV === 'production') {
  fapi.proxy = true;

  fapi.use(async (ctx, next) => {
    if (ctx.secure) {
      await next();

      switch (ctx.oidc && ctx.oidc.route) {
        case 'discovery': {
          ['token', 'introspection', 'revocation', 'userinfo', 'pushed_authorization_request'].forEach((endpoint) => {
            if (ctx.body[`${endpoint}_endpoint`].startsWith(ISSUER)) {
              ctx.body[`${endpoint}_endpoint`] = ctx.body[`${endpoint}_endpoint`].replace('https://', 'https://mtls.');
            }
          });
          break;
        }
        default:
      }
    } else if (ctx.method === 'GET' || ctx.method === 'HEAD') {
      ctx.redirect(ctx.href.replace(/^http:\/\//i, 'https://'));
    } else {
      ctx.body = {
        error: 'invalid_request',
        error_description: 'do yourself a favor and only use https',
      };
      ctx.status = 400;
    }
  });
}

if (SUITE_BASE_URL === OFFICIAL_CERTIFICATION) {
  fapi.listen(PORT);
} else {
  const server = https.createServer({
    requestCert: true,
    rejectUnauthorized: false,
    ...pem,
  }, fapi.callback);

  server.listen(PORT);
}
