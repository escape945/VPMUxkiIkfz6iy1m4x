export declare type configType = {
  core_path: string;
  port: number;
  middle_port: number;
  disable_exit_protect: boolean;
  // Base protocol, With base64
  protocol: string;
  // Transfer protocol
  network: string;
  uuid: string;
  path: string;
  display_web_entry: boolean;
  web_process: boolean;
  web_process_path: string;
  web_process_debug: boolean;

  // Part: TLS
  use_tls: boolean;
  // With base64
  tls_key: string;
  // With base64
  tls_cert: string;

  // Part: Warp
  warp_secretKey?: string;
  warp_ipv4?: string;
  warp_ipv6?: string;
  warp_reserved?: [number];
  warp_publicKey: string;
  warp_endpoint: string;
  add_ipv4?: boolean;
  add_ipv6?: boolean;
  warp_routing?: string;

  // Part: Cloudflared
  cloudflared_path?: string;
  use_cloudflared: boolean;
  cloudflared_protocol?: string;
  cloudflared_region?: string;
  cloudflared_access_token?: string;
};
