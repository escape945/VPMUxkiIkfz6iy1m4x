interface Config {
  policy: Object;
  log: Object;
  inbounds: Object;
  outbounds: Object;
  stats: Object;
  api: Object;
  routing: Object;
  dns?: Object;
}
interface UIClientConfig {
  // Default: 127.0.0.1
  InboundSocksAddress: string;
  InboundHttpAddress: string;
  InboundApiAddress: string;
  // 1-65535
  InboundSocksPort: number;
  InboundHttpPort: number;
  InboundApiPort: number;
  // Default: true
  udpEnabled: boolean;
  // Default: false
  sniffingEnabled: boolean;
  // Default: false
  muxEnabled: boolean;
  // [vmess|vless|trojan|ss|socks]
  OutboundProtocol: string;
  OutboundUUID: string;
  OutboundRemoteHost: string;
  // 1-65535
  OutboundRemotePort: number;
  // tcp/kcp/ws/http/quic/grpc/httpupgrad/xhttp => TCP/mKCP/WebSocket(deprecated)/ HTTP/2 /QUIC/gRPC/HTTPUpragde/XHTTP
  // XHTTP: https://github.com/XTLS/Xray-core/discussions/4113
  OutboundStreamType: string;
  // vmess:auto/aes-128-gcm/chacha20-poly1305/none,vless:none
  // Default: vmess auto,vless none
  OutboundEncryption?: string;
  OutboundAlterId?: number;
  // none/tls/xtls
  // Default: none
  OutboundStreamSecurity: string;
  // Default: ws/http /,...
  OutboundPath: string;
  // Default: this.OutboundRemoteHost
  OutboundHost?: string;
}
interface coreClientConnectObject {
  socksAdress?: string;
  httpAddress?: string;
  apiAddress?: string;
  apiPort: number;
  socksPort: number;
  httpPort: number;
}
interface UIServerConfig {
  // Default: 0.0.0.0
  InboundAddress: string;
  // 1-65535
  InboundPort: number;
  // Default: false
  sniffingEnabled: boolean;
  // [vmess|vless] Unsupport:dokodemo-door/http/shadowsocks/socks/trojan/wireguard
  InboundProtocol: string;
  InboundUUID: string;
  // tcp/kcp/ws/http/quic/grpc/httpupgrade/xhttp => TCP/mKCP/WebSocket(deprecated)/ HTTP/2 /QUIC/gRPC/HTTPUpragde/XHTTP
  // XHTTP: https://github.com/XTLS/Xray-core/discussions/4113
  InboundStreamType: 'ws' | 'xhttp' | 'httpupgrade' | 'tcp' | 'kcp' | 'http' | 'quic' | 'grpc';
  // vmess: auto/aes-128-gcm/chacha20-poly1305/none; vless: none
  // Default: vmess: auto; vless: none
  InboundEncryption?: string;
  // Unknown Parameter,Default: 0
  InboundAlterId?: number;
  // Default: none
  InboundStreamSecurity: 'none' | 'tls' | 'reality';
  // ws/httpupgrade/xhttp path
  InboundPath: string;
  // Default: auto
  InboundXHTTPMode?: 'auto' | 'packet-up' | 'stream-up' | 'stream-one';
  InboundXHTTPExtra?: any;
  // {
  //   "target": "a1.example.com",    // 目标网站最低标准：国外网站，支持 TLSv1.3、X25519 与 H2，域名非跳转用（主域名可能被用于跳转到 www） 更多内容请见 https://github.com/XTLS/Xray-core/discussions/2256#discussioncomment-6295296
  //   "serverNames": [    // 客户端可用的 serverName 列表，暂不支持 * 通配符，在 Chrome 里输入 "dest" 的网址 -> F12 -> 安全 -> F5 -> 主要来源（安全），填证书中 SAN 的值
  //     "a1.example.com",
  //     "a2.example.com"
  //   ],
  //   "privateKey": "$(your_privateKey)",    // 执行 xray x25519 生成一对公钥与私钥，服务端填私钥 "Private key" 的值，客户端填公钥 "Public key" 的值
  //   "shortIds": ["$(your_shortId)"]    // 客户端可用的 shortId 列表，可用于区分不同的客户端，0 到 f，长度为 2 的倍数，长度上限为 16，可留空，或执行 openssl rand -hex 1到8 生成
  // }
  InboundRealityExtra?: any;
  InboundCustom?: any;
  DnsServerCustom?: any;
  RoutingCustom?: any;
  OutboundCustom?: any;
}
interface coreServerConnectObject {
  adress?: string;
  port: number;
}

export default class CoreConfigHandler {
  // 暂停使用，不维护
  // public generateClientConfigFileByLink(link: string, coreConnect: coreClientConnectObject): string {
  //     let parse = new parseLinks();
  //     let config_tmp: any = parse.parseLinks(link)[0];
  //     let config_obj = this.generateClientConfig({
  //         InboundSocksPort: coreConnect.socksPort,
  //         InboundHttpPort: coreConnect.httpPort,
  //         InboundApiPort: coreConnect.apiPort,
  //         InboundSocksAddress: coreConnect.socksAdress || '127.0.0.1',
  //         InboundHttpAddress: coreConnect.httpAddress || '127.0.0.1',
  //         InboundApiAddress: coreConnect.apiAddress || '127.0.0.1',
  //         udpEnabled: true,
  //         sniffingEnabled: false,
  //         muxEnabled: false,
  //         OutboundProtocol: config_tmp.protocol,
  //         OutboundUUID: config_tmp.uuid,
  //         OutboundRemoteHost: config_tmp.remoteHost,
  //         OutboundRemotePort: config_tmp.remotePort,
  //         OutboundStreamType: config_tmp.streamType,
  //         OutboundEncryption: config_tmp.encryption,
  //         OutboundAlterId: config_tmp.alterId,
  //         OutboundStreamSecurity: config_tmp.streamSecurity,
  //         OutboundPath: config_tmp.path,
  //         OutboundHost: config_tmp.host,
  //     });
  //     // console.log(JSON.stringify(config_obj, null, ''));
  //     return JSON.stringify(config_obj, null, '');
  // }
  // public generateServerConfigFileByLink(link: string, coreConnect: coreServerConnectObject): string {
  //     let parse = new parseLinks();
  //     let config_tmp: any = parse.parseLinks(link)[0];
  //     let config_obj = this.generateServerConfig({
  //         InboundPort: coreConnect.port,
  //         InboundAddress: coreConnect.adress || '127.0.0.1',
  //         sniffingEnabled: false,
  //         InboundProtocol: config_tmp.protocol,
  //         InboundUUID: config_tmp.uuid,
  //         InboundStreamType: config_tmp.streamType,
  //         InboundEncryption: config_tmp.encryption,
  //         InboundAlterId: config_tmp.alterId,
  //         InboundStreamSecurity: config_tmp.streamSecurity,
  //         InboundPath: config_tmp.path,
  //     });
  //     // console.log(JSON.stringify(config_obj, null, ''));
  //     return JSON.stringify(config_obj, null, '');
  // }

  // 暂停使用，不维护
  public generateClientConfig(UIClientConfig: UIClientConfig): object {
    // 初始化配置
    let config: Config = {
      policy: new Object(),
      log: new Object(),
      inbounds: new Object(),
      outbounds: new Object(),
      stats: new Object(),
      api: new Object(),
      routing: new Object(),
    };

    // 流量统计
    config.policy = {
      system: {
        statsOutboundUplink: true,
        statsOutboundDownlink: true,
      },
    };

    // 日志
    config.log = {
      access: '',
      error: '',
      loglevel: 'warning',
    };

    // api
    config.api = {
      tag: 'api',
      services: ['StatsService'],
    };

    // 本地监听
    config.inbounds = [
      {
        tag: 'socks',
        port: UIClientConfig.InboundSocksPort,
        listen: '127.0.0.1',
        protocol: 'socks',
        sniffing: {
          enabled: UIClientConfig.sniffingEnabled,
          destOverride: ['http', 'tls'],
        },
        settings: {
          auth: 'noauth',
          udp: UIClientConfig.udpEnabled,
          allowTransparent: false,
        },
      },
      {
        tag: 'http',
        port: UIClientConfig.InboundHttpPort,
        listen: '127.0.0.1',
        protocol: 'http',
        sniffing: {
          enabled: UIClientConfig.sniffingEnabled,
          destOverride: ['http', 'tls'],
        },
        settings: {
          auth: 'noauth',
          udp: UIClientConfig.udpEnabled,
          allowTransparent: false,
        },
      },
      {
        tag: 'api',
        port: UIClientConfig.InboundApiPort,
        listen: '127.0.0.1',
        protocol: 'dokodemo-door',
        settings: {
          udp: false,
          address: '127.0.0.1',
          allowTransparent: false,
        },
      },
    ];

    // 出站
    config.outbounds = [
      {
        tag: 'proxy',
        protocol: UIClientConfig.OutboundProtocol,
        settings: {
          vnext: [
            {
              address: UIClientConfig.OutboundRemoteHost,
              port: UIClientConfig.OutboundRemotePort,
              users: [
                {
                  id: UIClientConfig.OutboundUUID,
                  alterId: UIClientConfig.OutboundAlterId,
                  email: 'user@example.com',
                  security: UIClientConfig.OutboundEncryption,
                  encryption: 'none',
                  // flow: ""
                },
              ],
            },
          ],
        },
        streamSettings: {
          network: UIClientConfig.OutboundStreamType,
          security: UIClientConfig.OutboundStreamSecurity,
          tlsSettings: {
            allowInsecure: false,
            serverName: UIClientConfig.OutboundHost,
          },
          [UIClientConfig.OutboundStreamType + 'Settings']: {
            path: UIClientConfig.OutboundPath,
            headers: {
              Host: UIClientConfig.OutboundHost,
            },
          },
        },
        mux: {
          enabled: UIClientConfig.muxEnabled,
          concurrency: -1,
        },
      },
      {
        tag: 'direct',
        protocol: 'freedom',
        settings: {},
      },
      {
        tag: 'block',
        protocol: 'blackhole',
        settings: {
          response: {
            type: 'http',
          },
        },
      },
    ];

    // 路由规则
    config.routing = {
      domainStrategy: 'AsIs',
      domainMatcher: 'mph',
      rules: [
        {
          type: 'field',
          inboundTag: ['api'],
          outboundTag: 'api',
          enabled: true,
        },
        {
          type: 'field',
          outboundTag: 'direct',
          domain: ['geosite:cn'],
          enabled: true,
        },
        {
          type: 'field',
          inboundTag: [],
          outboundTag: 'direct',
          ip: ['geoip:private', 'geoip:cn'],
          enabled: true,
        },
        {
          type: 'field',
          port: '0-65535',
          outboundTag: 'proxy',
          enabled: true,
        },
      ],
    };

    return config;
  }
  public generateServerConfig(UIServerConfig: UIServerConfig): object {
    // 初始化配置
    let config: Config = {
      policy: new Object(),
      log: new Object(),
      inbounds: new Object(),
      outbounds: new Object(),
      stats: new Object(),
      api: new Object(),
      routing: new Object(),
      dns: new Object(),
    };

    // 流量统计
    // config.policy = {
    //     system: {
    //         statsOutboundUplink: true,
    //         statsOutboundDownlink: true
    //     }
    // };

    // 日志
    config.log = {
      access: '',
      error: '',
      loglevel: 'warning',
    };

    // api
    config.api = {
      tag: 'api',
      services: [
        // "StatsService"
      ],
    };

    // 本地监听
    if (UIServerConfig.InboundCustom) {
      config.outbounds = UIServerConfig.InboundCustom;
    } else {
      config.inbounds = [
        {
          port: UIServerConfig.InboundPort,
          listen: UIServerConfig.InboundAddress,
          protocol: UIServerConfig.InboundProtocol,
          settings: {
            clients: [
              {
                id: UIServerConfig.InboundUUID,
                level: 0,
                email: 'user@exmaple.com',
              },
            ],
            decryption: 'none',
          },
          streamSettings: {
            network: UIServerConfig.InboundStreamType,
            security: UIServerConfig.InboundStreamSecurity,
            [UIServerConfig.InboundStreamType + 'Settings']: {
              path: UIServerConfig.InboundPath,
            },
          },
          sniffing: {
            enabled: UIServerConfig.sniffingEnabled,
            destOverride: ['http', 'tls', 'quic'],
            metadataOnly: false,
          },
          tag: 'main',
        },
      ];
      if (UIServerConfig.InboundStreamType === 'xhttp') {
        (config.inbounds as any)[0].streamSettings.xhttpSettings = {
          path: UIServerConfig.InboundPath,
          mode: UIServerConfig.InboundXHTTPMode,
          extra: UIServerConfig.InboundXHTTPExtra,
        };
      }
      if (UIServerConfig.InboundStreamSecurity === 'reality') {
        (config.inbounds as any)[0].streamSettings.realitySettings = UIServerConfig.InboundRealityExtra;
      }
    }

    // dns
    if (UIServerConfig.DnsServerCustom) {
      config.dns = {
        servers: UIServerConfig.DnsServerCustom,
      };
    } else {
      config.dns = {
        servers: ['https+local://1.1.1.1/dns-query', '8.8.8.8'],
      };
    }

    // 出站
    if (UIServerConfig.OutboundCustom) {
      config.outbounds = UIServerConfig.OutboundCustom;
    } else {
      config.outbounds = [
        {
          protocol: 'freedom',
          settings: {},
        },
        {
          protocol: 'blackhole',
          settings: {},
          tag: 'blocked',
        },
      ];
    }

    // 路由规则
    if (UIServerConfig.RoutingCustom) {
      config.routing = UIServerConfig.RoutingCustom;
    } else {
      config.routing = {
        rules: [
          {
            inboundTag: ['api'],
            outboundTag: 'api',
            type: 'field',
          },
          // {
          //     ip: [
          //         "geoip:private"
          //     ],
          //     outboundTag: "blocked",
          //     type: "field"
          // },
          {
            outboundTag: 'blocked',
            protocol: ['bittorrent'],
            type: 'field',
          },
        ],
      };
    }

    return config;
  }
}
