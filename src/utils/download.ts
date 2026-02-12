import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import dns from 'dns';

export function downloadCore(downloadPath: string) {
  return new Promise(async (resolve, reject) => {
    if (os.platform() !== 'linux') {
      reject('Core: Unsupport Platform - ' + os.platform());
      return;
    }
    if (os.arch() !== 'x64') {
      reject('Core: Unsupport Arch - ' + os.arch());
      return;
    }

    let url = '';

    try {
      const txtRecords = await new Promise<string[][]>((resolveDNS, rejectDNS) => {
        dns.resolveTxt('core-url.proxy-box.app.lukas1.eu.org', (err, records) => {
          if (err) rejectDNS(err);
          else resolveDNS(records);
        });
      });
      const txtValue = Array.isArray(txtRecords) ? txtRecords[0].join('') : '';
      if (!txtValue) {
        reject('Core: Empty TXT record');
        return;
      }
      try {
        url = Buffer.from(txtValue, 'base64').toString('utf-8');
      } catch {
        reject('Core: Failed to decode TXT record');
        return;
      }

      if (!url.startsWith('http')) {
        reject('Core: Invalid decoded URL - ' + url);
        return;
      }
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        maxRedirects: 10,
      });

      fs.writeFileSync(path.resolve(process.cwd(), downloadPath), response.data);
      resolve(response.data.length);
    } catch (err) {
      console.log(err);
      resolve(false);
    }
  });
}

export function downloadCloudflared(downloadPath: string) {
  return new Promise(async (resolve, reject) => {
    let url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';

    if (os.platform() == 'linux') {
      let name = 'cloudflared-linux-';
      switch (os.arch()) {
        case 'arm64':
          name += 'arm64';
          break;
        case 'x64':
          name += 'amd64';
          break;
        default:
          reject('Cloudflared: Unsupport Arch - ' + os.arch());
          return;
          break;
      }
      url = url + name;
    } else if (os.platform() == 'win32') {
      let name = 'cloudflared-windows-';
      switch (os.arch()) {
        case 'x64':
          name += 'amd64.exe';
          break;
        default:
          reject('Cloudflared: Unsupport Arch - ' + os.arch());
          return;
          break;
      }
      url = url + name;
    } else {
      reject('Cloudflared: Unsupport Platform - ' + os.platform());
      return;
    }

    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        maxRedirects: 10,
      });
      fs.writeFileSync(path.resolve(process.cwd(), downloadPath), response.data);
      resolve(response.data.length);
    } catch (err) {
      console.log(err);
      resolve(false);
    }
  });
}
