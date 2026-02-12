import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import cp from 'child_process';
import http from 'http';
import https from 'https';
import stream from 'stream';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import CoreConfigHandler from './utils/coreConfigHandler';
import { downloadCore, downloadCloudflared } from './utils/download';
import { configType } from './types';

dotenv.config();
const app = express();
app.disable('x-powered-by');
const config: configType = (() => {
  let config_json: configType;
  try {
    config_json = JSON.parse(process.env.CONFIG);
  } catch {
    try {
      config_json = JSON.parse(fs.readFileSync('./config.json').toString());
    } catch {
      console.log('[Main]', `Config Error`);
      config_json = {} as any;
    }
  }
  let part_warp: any = {};
  if (config_json['warp']) {
    part_warp = {
      ...part_warp,
      warp_secretKey: config_json['warp']['key'] || '',
      warp_ipv4: config_json['warp']['ipv4'] || '172.16.0.2',
      warp_ipv6: config_json['warp']['ipv6'] || '',
      warp_reserved: [0, 0, 0],
      warp_publicKey: config_json['warp']['pubkey'] || 'bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=',
      warp_endpoint: config_json['warp']['endpoint'] || '162.159.192.1:2408' || 'engage.cloudflareclient.com:2408',
      add_ipv4: config_json['warp']['add4'] || false,
      add_ipv6: config_json['warp']['add6'] || false,
      warp_routing: config_json['warp']['routing'] || 'auto',
    };
    if (config_json['warp']['reserved']) {
      function decodeClientId(clientId) {
        const decodedBuffer = Buffer.from(clientId, 'base64');
        const hexString = decodedBuffer.toString('hex');
        const hexPairs = hexString.match(/.{1,2}/g) || [];
        const decimalArray = hexPairs.map(hex => parseInt(hex, 16));
        return decimalArray;
      }
      part_warp.warp_reserved = decodeClientId(config_json['warp']['reserved']);
    }
  }
  let part_cloudflared: any = {
    cloudflared_path: config_json['cloudflared_path'] || (os.platform() == 'win32' ? './cloudflared.exe' : './cloudflared'),
  };
  if (config_json['cloudflared']) {
    part_cloudflared = {
      ...part_cloudflared,
      use_cloudflared: config_json['cloudflared']['use'] || false,
      // [auto]/quic/http2
      cloudflared_protocol: config_json['cloudflared']['protocol'] || '',
      // none/us
      cloudflared_region: config_json['cloudflared']['region'] || '',
      cloudflared_access_token: config_json['cloudflared']['token'] || '',
    };
  }
  let part_tls = {};
  if (config_json['tls']) {
    part_tls = {
      ...part_tls,
      use_tls: config_json['tls']['use'] || false,
      // please use base64 encode
      tls_key: Buffer.from(config_json['tls']['key'], 'base64').toString() || '',
      tls_cert: Buffer.from(config_json['tls']['cert'], 'base64').toString() || '',
    };
  }
  return {
    // core
    core_path: config_json['core_path'] || (os.platform() == 'win32' ? './core.exe' : './core'),
    port: config_json['port'] || 3000,
    middle_port: config_json['middle_port'] || 58515,
    disable_exit_protect: config_json['disable_exit_protect'] || false,
    protocol: config_json['protocol'] || 'dmxlc3M=',
    // Tested: ws/xhttp
    network: config_json['network'] || 'ws',
    uuid: config_json['uuid'] || guid(),
    path: config_json['path'] || '/api',
    display_web_entry: config_json['display_web_entry'] || false,
    // tls
    ...part_tls,
    // warp
    ...part_warp,
    // cloudflared
    ...part_cloudflared,
  };
})();

// Generate Random UUID
function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function proxyRemotePage(res, url: string, contentType = 'text/html; charset=utf-8') {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'proxy-box',
      },
    });

    res.status(r.status);
    res.setHeader('Content-Type', contentType);

    const text = await r.text();
    res.send(text);
  } catch (err) {
    res.status(502).send(`Remote page fetch failed: ${err.message}`);
  }
}

let pid_core = NaN,
  pid_cloudflared = NaN;

// Generate Status Codes
app.get('/generate_204', (req, res) => {
  res.status(204).send('');
});
app.get('/generate_200{*any}', (req, res) => {
  res.status(200).send('');
});



app.use(
  config.path,
  createProxyMiddleware({
    target: `http://127.0.0.1:${false ? 12100 : config.middle_port}${config.network === 'ws' ? '' : config.path}`,
    changeOrigin: true,
    ws: true,
    logger: {
      info: msg => {
        // console.log(msg);
      },
      warn: msg => {
        // console.log(msg);
      },
      error: msg => {
        console.log(msg);
      },
    },
  }),
);

app.use(async (req, res, next) => {
  await proxyRemotePage(res, 'https://404.mise.eu.org/');
});

async function startCore() {
  // Generate config for core
  let extra = {};
  if (config.warp_secretKey && config.warp_ipv6 && (config.add_ipv4 || config.add_ipv6)) {
    let domainStrategy = 'IPIfNonMatch';
    let extra_iprules: any = [
      {
        type: 'field',
        ip: ['0.0.0.0/0'],
        outboundTag: config.add_ipv4 ? 'wireguard' : 'direct',
      },
      {
        type: 'field',
        ip: ['::/0'],
        outboundTag: config.add_ipv6 ? 'wireguard' : 'direct',
      },
    ];
    if (config.add_ipv4 && config.add_ipv6) {
      domainStrategy = 'AsIs';
      extra_iprules = [
        {
          type: 'field',
          port: '0-65535',
          outboundTag: 'wireguard',
        },
      ];
    }
    extra = {
      OutboundCustom: [
        {
          protocol: 'freedom',
          settings: {},
          tag: 'direct',
        },
        {
          protocol: 'blackhole',
          settings: {},
          tag: 'blocked',
        },
        {
          protocol: 'wireguard',
          settings: {
            kernelMode: false,
            secretKey: config.warp_secretKey,
            address: [config.warp_ipv4 + '/32', config.warp_ipv6 + '/128'],
            peers: [
              {
                publicKey: config.warp_publicKey,
                endpoint: config.warp_endpoint,
              },
            ],
            reserved: config.warp_reserved,
            mtu: 1420,
          },
          tag: 'wireguard',
        },
      ],
      RoutingCustom: {
        domainStrategy: domainStrategy,
        rules: [
          ...extra_iprules,
          {
            outboundTag: 'blocked',
            protocol: ['bittorrent'],
            type: 'field',
          },
        ],
      },
      DnsServerCustom: ['tcp+local://8.8.8.8'],
    };
  }

  let config_obj: any = new CoreConfigHandler().generateServerConfig({
    InboundPort: config.middle_port,
    InboundAddress: '127.0.0.1',
    sniffingEnabled: false,
    InboundProtocol: Buffer.from(config.protocol, 'base64').toString(),
    InboundUUID: config.uuid,
    InboundStreamType: config.network as any,
    InboundEncryption: 'auto',
    InboundStreamSecurity: 'none',
    InboundPath: config.path,
    ...extra,
  });
  config_obj = JSON.stringify(config_obj, null, '');
  // console.log(config_obj);

  await (_ => {
    return new Promise(async resolve => {
      if (os.platform() != 'linux') {
        resolve(0);
        return;
      }
      let args = ['+x', path.resolve(process.cwd(), config.core_path)];
      let processC = cp.spawn('chmod', args);
      processC.on('close', () => {
        console.log('[Initialization]', 'Core chmod Compeleted');
        setTimeout(() => {
          resolve(0);
        }, 100);
      });
    });
  })();
  let processC = cp.spawn(path.resolve(process.cwd(), config.core_path), ['-c', 'stdin:']);
  processC.on('exit', (code, signal) => {
    console.log('[Main]', `Core exited with code ${code}, signal ${signal}`);
    if (!config.disable_exit_protect) process.exit(1);
  });

  let stdInStream = new stream.Readable();
  stdInStream.push(config_obj);
  stdInStream.push(null);
  stdInStream.pipe(processC.stdin);
  return new Promise(resolve => {
    processC.stdout.on('data', data => {
      // console.log(data.toString().trim());
      if (/\[Warning\] core: .* started/.test(data)) {
        console.log(`----------
[Config]
path: ${config.path}
uuid: ${config.uuid}
----------`);
        resolve([true, processC.pid]);
      }
    });
    processC.on('error', err => {
      resolve([false, err]);
    });
  });
}

async function startCloudflared() {
  await (_ => {
    return new Promise(async resolve => {
      if (os.platform() != 'linux') {
        resolve(0);
        return;
      }
      let args = ['+x', path.resolve(process.cwd(), config.cloudflared_path)];
      let processC = cp.spawn('chmod', args);
      processC.on('close', () => {
        console.log('[Initialization]', 'Cloudflared chmod Compeleted');
        setTimeout(() => {
          resolve(0);
        }, 100);
      });
    });
  })();

  let args = ['--url', `http://localhost:${config.port}`];
  if (config.cloudflared_access_token) {
    args = ['run', '--token', config.cloudflared_access_token];
    console.log('[Cloudflared Config]', 'Domain: Custom Token');
  }
  if (config.cloudflared_protocol) {
    args.push('--protocol', config.cloudflared_protocol);
  }
  if (config.cloudflared_region) {
    args.push('--region', config.cloudflared_region);
  }
  let processC = cp.spawn(path.resolve(process.cwd(), config.cloudflared_path), ['tunnel', '--no-autoupdate', ...args]);
  processC.on('exit', (code, signal) => {
    console.log('[Main]', `Cloudflared exited with code ${code}, signal ${signal}`);
    if (!config.disable_exit_protect) process.exit(1);
  });

  return new Promise(resolve => {
    processC.stderr.on('data', data => {
      // https://.*[a-z]+cloudflare.com
      if (/Registered tunnel connection/.test(data)) {
        console.log(
          '[Cloudflared Info]',
          data
            .toString()
            .match(/(?<=Registered tunnel connection).*/)[0]
            .trim(),
        );
      } else if (!config.cloudflared_access_token && /https:\/\/.*[a-z]+cloudflare.com/.test(data)) {
        console.log('[Cloudflared Config]', `Domain: ${data.toString().match(/(?<=https:\/\/).*[a-z]+cloudflare.com/)[0]}`);
      } else {
        // console.log(data.toString().trim());
      }
      resolve([true, processC.pid]);
    });
    processC.on('error', err => {
      console.log('[Cloudflared Error]', err);
      resolve([false, err]);
    });
  });
}

// Listening Port with Retry
function listenPort() {
  let serverProxy;
  if (config.use_tls) {
    console.log('[Main]', `Https Enabled`);
    if (config.tls_cert && config.tls_key) {
      const options = {
        key: config.tls_key,
        cert: config.tls_cert,
      };
      serverProxy = https.createServer(options, app);
    } else {
      console.log('[Main]', `Https Missing: tls_cert,tls_key`);
    }
  } else {
    serverProxy = http.createServer(app);
  }
  const try_connect = serverProxy => {
    serverProxy.listen(config.port, () => {
      console.log('[Main]', `Listening on Port ${config.port}`);
    });
  };
  try_connect(serverProxy);
  serverProxy.on('error', e => {
    if (e.code === 'EADDRINUSE') {
      console.error('[Main]', 'Listening Port Failed: Address in use, retrying...');
      setTimeout(() => {
        serverProxy.close();
        try_connect(serverProxy);
      }, 1000);
    }
  });
}

start();
async function start(noListenPort = false) {
  console.log('[OS Info]', `${os.platform()} ${os.arch()}`);
  if (config.use_cloudflared) {
    if (!fs.existsSync(path.resolve(process.cwd(), config.cloudflared_path))) {
      const foo = await downloadCloudflared(config.cloudflared_path);
      if (foo) {
        console.log(
          '[Initialization]',
          'Cloudflared Download Success',
          `${Math.round((Number(foo) / 1024 / 1024) * 10) / 10} MB`,
        );
      } else {
        console.log('[Initialization]', 'Cloudflared Download Failed');
      }
    } else {
      console.log('[Initialization]', 'Cloudflared Already Exist');
    }
    const start_return = await startCloudflared();
    if (start_return[0]) {
      pid_cloudflared = start_return[1];
      console.log('[Main]', 'Cloudflared Start Success');
    } else {
      console.log('[Main]', 'Cloudflared Start Failed:', start_return[1]);
      if (!config.disable_exit_protect) process.exit(1);
    }
  }

  if (!fs.existsSync(path.resolve(process.cwd(), config.core_path))) {
    const foo = await downloadCore(config.core_path);
    if (foo) {
      console.log(
        '[Initialization]',
        'Core Download Success',
        `${Math.round((Number(foo) / 1024 / 1024) * 10) / 10} MB`,
      );
    } else {
      console.log('[Initialization]', 'Core Download Failed');
    }
  } else {
    console.log('[Initialization]', 'Core Already Exist');
  }
  const start_return = await startCore();
  if (start_return[0]) {
    pid_core = start_return[1];
    console.log('[Main]', 'Core Start Success');
  } else {
    console.log('[Main]', 'Core Start Failed:', start_return[1]);
    if (!config.disable_exit_protect) process.exit(1);
  }

  if (!noListenPort) listenPort();
}

