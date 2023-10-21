const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const http = require('http');
const https = require('https');
const stream = require('stream');
const httpProxyMiddleware = require('http-proxy-middleware');
const dotenv = require('dotenv');

const CoreConfigHandler = require('./utils/coreConfigHandler.js');
let err404 = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><style>*{margin:0;padding:0;font-family:sans-serif}body,html{width:100%;height:100%;overflow:auto;color:#000;background-color:#fff;box-sizing:border-box}.container{margin-left:auto;margin-right:auto;--padding:18px;padding-left:var(--padding);padding-right:var(--padding);width:calc(100% - var(--padding) * 2);margin-top:80px;border-radius:8px;transition:all ease .2s,background-color 0s,color 0s}@media (min-width:980px){.container{max-width:978px}}@media (min-width:1200px){.container{max-width:1128px}}@media (max-height:500px){.container{margin-top:18px}}#backHome{display:inline-flex;align-items:center;color:#fff;background-color:#333;border-radius:16px;margin:16px 0 0;padding:16px 32px;transition:all ease .2s,background-color 0s,color 0s;user-select:none}#backHome:hover{transition:all ease .2s;background-color:#2a2a2a}#backHome:active{transition:all ease .2s;background-color:#2a2a2a;transform:scale(.95)}#backHome svg{fill:#fff}.col-2{color:#222}.headline-1{font-size:3em;font-weight:600;margin-bottom:24px}.headline-5{font-size:1em;font-weight:600;margin-bottom:0}</style></head><body><div class="container"><div><h1 class="headline-1 col-2">Page not found</h1><h5 class="headline-5 col-2">Sorry, we can't find the page you are looking for in this download server.</h5></div><div id="backHome">Back Home</div></div></body><script>document.querySelector('#backHome').addEventListener('click', () => { location.pathname = "/" });</script></html>`;

dotenv.config();
const app = express();
const config = (() => {
  let config_json = JSON.parse(process.env.CONFIG);
  return {
    // core
    core_path: config_json['core_path'] || './core',
    port: config_json['port'] || 3000,
    protocol: config_json['protocol'] || 'dmxlc3M=',
    uuid: config_json['uuid'] || guid(),
    path: config_json['path'] || '/api',
    // warp
    warp_secretKey: config_json['warp']['key'] || '',
    warp_ipv6: config_json['warp']['ipv6'] || '',
    warp_endpoint:
      config_json['warp']['endpoint'] || 'engage.cloudflareclient.com',
    add_ipv4: config_json['warp']['add4'] || false,
    add_ipv6: config_json['warp']['add6'] || false,
    // argo (cloudflared)
    argo_path: config_json['argo_path'] || './cloudflared',
    use_argo: config_json['argo']['use'] || false,
    argo_protocol: config_json['argo']['protocol'] || '',
    argo_region: config_json['argo']['region'] || '',
    argo_access_token: config_json['argo']['token'] || '',
  };
})();

function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

app.get('/generate_204', (req, res) => {
  res.status(204).send('');
});

const wsProxy = httpProxyMiddleware.createProxyMiddleware({
  target: 'http://127.0.0.1:9000/',
  changeOrigin: true,
  ws: true,
  logLevel: 'silent', // 禁用所有日志输出
});
app.use(config.path, wsProxy);
// 404 page
app.use((req, res, next) => {
  res.status(404).send(err404);
});

// 下载核心
function download_core() {
  return new Promise(async resolve => {
    let url = 'https://tt.vg/DrLSV';
    try {
      const res = await (
        await fetch(url, {
          redirect: 'follow',
        })
      ).arrayBuffer();
      fs.writeFileSync(
        path.resolve(process.cwd(), config.core_path),
        Buffer.from(res)
      );
      resolve(true);
    } catch (err) {
      console.log(err);
      resolve(false);
    }
  });
}
// 启动核心
async function start_core() {
  // 生成配置文件
  let extra = {};
  if (
    config.warp_secretKey &&
    config.warp_ipv6 &&
    (config.add_ipv4 || config.add_ipv6)
  ) {
    let domainStrategy = 'IPIfNonMatch';
    let extra_iprules = [
      {
        type: 'field',
        ip: ['0.0.0.0/0'],
        outboundTag: config.add_ipv4 ? 'warp-IPv4' : 'direct',
      },
      {
        type: 'field',
        ip: ['::/0'],
        outboundTag: config.add_ipv6 ? 'warp-IPv6' : 'direct',
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
          protocol: 'freedom',
          settings: {
            domainStrategy: 'UseIPv4',
          },
          proxySettings: {
            tag: 'wireguard',
          },
          tag: 'warp-IPv4',
        },
        {
          protocol: 'freedom',
          settings: {
            domainStrategy: 'UseIPv6',
          },
          proxySettings: {
            tag: 'wireguard',
          },
          tag: 'warp-IPv6',
        },
        {
          protocol: 'wireguard',
          settings: {
            secretKey: config.warp_secretKey, // 粘贴你的 "private_key" 值
            address: [
              '172.16.0.2/32',
              config.warp_ipv6 + '/128', // 粘贴你获得的 warp IPv6 地址，结尾加 /128
            ],
            peers: [
              {
                publicKey: 'bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=',
                allowedIPs: ['0.0.0.0/0', '::/0'],
                endpoint: config.warp_endpoint + ':2408',
              },
            ],
            reserved: [0, 0, 0], // 粘贴你的 "reserved" 值
            mtu: 1280,
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
    };
  }

  let config_obj = new CoreConfigHandler.default().generateServerConfig({
    InboundPort: 9000,
    InboundAddress: '127.0.0.1',
    sniffingEnabled: false,
    InboundProtocol: Buffer.from(config.protocol, 'base64').toString(),
    InboundUUID: config.uuid,
    InboundStreamType: 'ws',
    InboundEncryption: 'auto',
    InboundAlterId: 0,
    InboundStreamSecurity: 'none',
    InboundPath: config.path,
    ...extra,
  });
  config_obj = JSON.stringify(config_obj, null, '');

  await (_ => {
    return new Promise(async resolve => {
      if (os.platform() != 'linux') {
        resolve();
        return;
      }
      let args = ['+x', path.resolve(process.cwd(), config.core_path)];
      let processC = cp.spawn('chmod', args);
      processC.on('close', () => {
        console.log('[初始化]', 'core chmod完成');
        setTimeout(_ => resolve(), 100);
      });
    });
  })();
  let processC = cp.spawn(path.resolve(process.cwd(), config.core_path), [
    '-c',
    'stdin:',
  ]);
  let stdInStream = new stream.Readable();
  stdInStream.push(config_obj);
  stdInStream.push(null);
  stdInStream.pipe(processC.stdin);
  return new Promise(resolve => {
    processC.stdout.on('data', data => {
      // console.log(data.toString().trim());
      if (/[0-9/]* [0-9:]* \[Warning\] core: .* started/.test(data)) {
        console.log(`----------
  [Config]
  path: ${config.path}
  uuid: ${config.uuid}
  ----------`);
        resolve('[初始化] core启动成功');
      }
    });
    processC.on('error', err => {
      resolve('[初始化] core启动错误：' + err);
    });
  });
}

// 下载argo
function download_argo() {
  return new Promise(async resolve => {
    let url =
      'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
    if (os.platform() == 'win32') {
      url =
        'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
    }
    try {
      const res = await (
        await fetch(url, {
          redirect: 'follow',
        })
      ).arrayBuffer();
      fs.writeFileSync(
        path.resolve(process.cwd(), config.argo_path),
        Buffer.from(res)
      );
      resolve(true);
    } catch (err) {
      console.log(err);
      resolve(false);
    }
  });
}
// 启动argo
async function start_argo() {
  await (_ => {
    return new Promise(async resolve => {
      if (os.platform() != 'linux') {
        resolve();
        return;
      }
      let args = ['+x', path.resolve(process.cwd(), config.argo_path)];
      let processC = cp.spawn('chmod', args);
      processC.on('close', () => {
        console.log('[初始化]', 'argo chmod完成');
        setTimeout(_ => resolve(), 100);
      });
    });
  })();

  let args = ['--url', `http://localhost:${config.port}`];
  if (config.argo_access_token) {
    args = ['run', '--token', config.argo_access_token];
    console.log('[Argo Config]', 'domain: Custom Token');
  }
  if (config.argo_protocol) {
    args.push('--protocol', config.argo_protocol);
  }
  if (config.argo_region) {
    args.push('--region', config.argo_region);
  }
  let processC = cp.spawn(path.resolve(process.cwd(), config.argo_path), [
    'tunnel',
    '--no-autoupdate',
    ...args,
  ]);
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
      } else if (
        !config.argo_access_token &&
        /https:\/\/.*[a-z]+cloudflare.com/.test(data)
      ) {
        console.log(
          '[Argo Config]',
          `domain: ${
            data.toString().match(/(?<=https:\/\/).*[a-z]+cloudflare.com/)[0]
          }`
        );
      } else {
        // console.log(data.toString().trim());
      }
      resolve('[初始化] argo启动成功');
    });
    processC.on('error', err => {
      resolve('[初始化] argo启动错误：' + err);
    });
  });
}

// 监听端口
function listen_port() {
  let serverProxy = http.createServer(app);
  serverProxy.listen(config.port, () => {
    console.log('[软件]', `Listening on port ${config.port}`);
  });
  serverProxy.on('upgrade', wsProxy.upgrade);
}

(async _ => {
  // console.log(await start_argo());
})();
start();
async function start() {
  if (config.use_argo) {
    if (!fs.existsSync(path.resolve(process.cwd(), config.argo_path))) {
      const foo = await download_argo();
      if (foo) {
        console.log('[初始化]', 'argo下载成功');
      } else {
        console.log('[初始化]', 'argo下载失败');
      }
    } else {
      console.log('[初始化]', 'argo已存在');
    }
    console.log(await start_argo());
  }

  if (!fs.existsSync(path.resolve(process.cwd(), config.core_path))) {
    const foo = await download_core();
    if (foo) {
      console.log('[初始化]', 'core下载成功');
    } else {
      console.log('[初始化]', 'core下载失败');
    }
  } else {
    console.log('[初始化]', 'core已存在');
  }
  console.log(await start_core());
  listen_port();
}

keepalive();
function keepalive() {
  // 保持唤醒
  let url_host = '';
  url_host = process.env.RENDER_EXTERNAL_HOSTNAME;
  https
    .get(`https://${url_host}/generate_204`, res => {
      if (res.statusCode == 204) {
      } else {
        console.log('请求错误: ' + res.statusCode);
      }
    })
    .on('error', err => {
      console.log('请求错误: ' + err);
    });
  setTimeout(() => {
    keepalive();
  }, Math.ceil(Math.random() * 15));
}
