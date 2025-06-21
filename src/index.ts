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
import { err404, handlepage } from './utils/pages';
import { downloadCore, downloadArgo } from './utils/download';
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
  let part_argo: any = {
    argo_path: config_json['argo_path'] || (os.platform() == 'win32' ? './cloudflared.exe' : './cloudflared'),
  };
  if (config_json['argo']) {
    part_argo = {
      ...part_argo,
      use_argo: config_json['argo']['use'] || false,
      // [auto]/quic/http2
      argo_protocol: config_json['argo']['protocol'] || '',
      // none/us
      argo_region: config_json['argo']['region'] || '',
      argo_access_token: config_json['argo']['token'] || '',
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
    protocol: config_json['protocol'] || 'dmxlc3M=',
    // Tested: ws/xhttp
    network: config_json['network'] || 'ws',
    uuid: config_json['uuid'] || guid(),
    path: config_json['path'] || '/api',
    display_web_entry: config_json['display_web_entry'] || false,
    web_process: config_json['web_process'] || false,
    web_process_path: config_json['web_process_path'] || '/process',
    web_process_debug: config_json['web_process_debug'] || false,
    // tls
    ...part_tls,
    // warp
    ...part_warp,
    // argo (cloudflared)
    ...part_argo,
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

let pid_core = NaN,
  pid_argo = NaN;

// Generate Status Codes
app.get('/generate_204', (req, res) => {
  res.status(204).send('');
});
app.get('/generate_200{*any}', (req, res) => {
  res.status(200).send('');
});

// Web Process
app.get(config.path + config.web_process_path, (req, res, next) => {
  if (config.display_web_entry) {
    res.send(handlepage);
  } else {
    next();
  }
});
app.get(config.path + config.web_process_path + '/debug', (req, res, next) => {
  if (!config.display_web_entry) {
    next();
    return;
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  if (!config.web_process_debug) {
    res.end('web_process_debug off');
    return;
  }
  res.end(cp.execSync(`ps aux|sort -rn -k +4|head -50`).toString());
});
app.get(config.path + config.web_process_path + '/update', async (req, res, next) => {
  if (!config.display_web_entry) {
    next();
    return;
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  if (!config.web_process) {
    res.end('web_process off');
    return;
  }
  res.write('---- Start');
  if (!isNaN(pid_argo)) process.kill(pid_argo);
  if (!isNaN(pid_core)) process.kill(pid_core);
  pid_core = NaN;
  pid_argo = NaN;
  if (typeof req.query['argo'] == 'string') {
    try {
      const foo = await downloadArgo(config.argo_path);
      if (foo) {
        res.write('\n' + 'Argo Download Success' + '\n    ' + foo);
      } else {
        res.write('\n' + 'Argo Download Failed' + '\n    ' + foo);
      }
    } catch (err) {
      res.write('\n' + 'Argo Download Failed' + '\n    ' + err);
    }
  }
  if (typeof req.query['core'] == 'string') {
    try {
      const foo = await downloadCore(config.core_path);
      if (foo) {
        res.write('\n' + 'Core Download Success' + '\n    ' + foo);
      } else {
        res.write('\n' + 'Core Download Failed' + '\n    ' + foo);
      }
    } catch (err) {
      res.write('\n' + 'Core Download Failed' + '\n    ' + err);
    }
  }

  start(true);
  res.end('\n' + '---- Done');
});
app.get(config.path + config.web_process_path + '/version', async (req, res, next) => {
  if (!config.display_web_entry) {
    next();
    return;
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.write(`Node Version:`);
  let object = process.versions;
  for (const key in object) {
    if (Object.hasOwnProperty.call(object, key)) {
      const element = object[key];
      res.write(`\n    ${key}: ${element}`);
    }
  }
  res.write(`\n\nCore Version:`);
  const core_version = await (_ => {
    return new Promise(async resolve => {
      let args = ['--version'];
      let processC = cp.spawn(config.core_path, args);
      let pData = '';
      processC.stdout.on('data', data => {
        pData += data.toString();
      });
      processC.on('close', () => {
        resolve(pData);
      });
    });
  })();
  res.write(`\n    ${core_version}`);
  res.write(`\n\nArgo Version:`);
  const argo_version = await (_ => {
    return new Promise(async resolve => {
      let args = ['--version'];
      let processC = cp.spawn(config.argo_path, args);
      let pData = '';
      processC.stdout.on('data', data => {
        pData += data.toString();
      });
      processC.on('close', () => {
        resolve(pData);
      });
    });
  })();
  res.write(`\n    ${argo_version}`);

  res.end(null);
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
  })
);

app.use((req, res, next) => {
  res.status(404).send(err404);
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
        setTimeout(_ => resolve(0), 100);
      });
    });
  })();
  let processC = cp.spawn(path.resolve(process.cwd(), config.core_path), ['-c', 'stdin:']);
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

async function startArgo() {
  await (_ => {
    return new Promise(async resolve => {
      if (os.platform() != 'linux') {
        resolve(0);
        return;
      }
      let args = ['+x', path.resolve(process.cwd(), config.argo_path)];
      let processC = cp.spawn('chmod', args);
      processC.on('close', () => {
        console.log('[Initialization]', 'Argo chmod Compeleted');
        setTimeout(_ => resolve(0), 100);
      });
    });
  })();

  let args = ['--url', `http://localhost:${config.port}`];
  if (config.argo_access_token) {
    args = ['run', '--token', config.argo_access_token];
    console.log('[Argo Config]', 'Domain: Custom Token');
  }
  if (config.argo_protocol) {
    args.push('--protocol', config.argo_protocol);
  }
  if (config.argo_region) {
    args.push('--region', config.argo_region);
  }
  let processC = cp.spawn(path.resolve(process.cwd(), config.argo_path), ['tunnel', '--no-autoupdate', ...args]);
  return new Promise(resolve => {
    processC.stderr.on('data', data => {
      // https://.*[a-z]+cloudflare.com
      if (/Registered tunnel connection/.test(data)) {
        console.log(
          '[Argo Info]',
          data
            .toString()
            .match(/(?<=Registered tunnel connection).*/)[0]
            .trim()
        );
      } else if (!config.argo_access_token && /https:\/\/.*[a-z]+cloudflare.com/.test(data)) {
        console.log('[Argo Config]', `Domain: ${data.toString().match(/(?<=https:\/\/).*[a-z]+cloudflare.com/)[0]}`);
      } else {
        // console.log(data.toString().trim());
      }
      resolve([true, processC.pid]);
    });
    processC.on('error', err => {
      console.log('[Argo Error]', err);
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
  if (config.use_argo) {
    if (!fs.existsSync(path.resolve(process.cwd(), config.argo_path))) {
      const foo = await downloadArgo(config.argo_path);
      if (foo) {
        console.log('[Initialization]', 'Argo Download Success', `${Math.round((Number(foo) / 1024 / 1024) * 10) / 10} MB`);
      } else {
        console.log('[Initialization]', 'Argo Download Failed');
      }
    } else {
      console.log('[Initialization]', 'Argo Already Exist');
    }
    const start_return = await startArgo();
    if (start_return[0]) {
      pid_argo = start_return[1];
      console.log('[Initialization]', 'Argo Start Success');
    } else {
      console.log('[Initialization]', 'Argo Start Failed:', start_return[1]);
    }
  }

  if (!fs.existsSync(path.resolve(process.cwd(), config.core_path))) {
    const foo = await downloadCore(config.core_path);
    if (foo) {
      console.log('[Initialization]', 'Core Download Success', `${Math.round((Number(foo) / 1024 / 1024) * 10) / 10} MB`);
    } else {
      console.log('[Initialization]', 'Core Download Failed');
    }
  } else {
    console.log('[Initialization]', 'Core Already Exist');
  }
  const start_return = await startCore();
  if (start_return[0]) {
    pid_core = start_return[1];
    console.log('[Initialization]', 'Core Start Success');
  } else {
    console.log('[Initialization]', 'Core Start Failed:', start_return[1]);
  }

  if (!noListenPort) listenPort();
}

keepAlive();
async function keepAlive() {
  let keepalive_url = process.env.KEEP_ALIVE_URL;
  let keepalive_interval = Number(process.env.KEEP_ALIVE_INTERVAL) || 60 * 1000;
  if (!keepalive_url) return;

  try {
    const res = await fetch(keepalive_url);
    if (!res.ok) {
      console.log(`[KeepAlive] Request Error: ${res.status} ${res.statusText}`);
    } else {
    }
  } catch (err) {
    console.log(`[KeepAlive] Network Error: ${err.message}`);
  }
  setTimeout(() => {
    keepAlive();
  }, keepalive_interval);
}
