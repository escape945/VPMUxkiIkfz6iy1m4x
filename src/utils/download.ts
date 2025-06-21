import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function downloadCore(downloadPath: string) {
  return new Promise(async (resolve, reject) => {
    let url = 'https://tt.vg/DrLSV';
    if (os.platform() == 'linux') {
      let name = '';
      switch (os.arch()) {
        case 'x64':
          name += '';
          break;

        default:
          reject('Core: Unsupport Arch - ' + os.arch());
          return;
          break;
      }
      url = url + name;
    } else {
      reject('Core: Unsupport Platform - ' + os.platform());
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

export function downloadArgo(downloadPath: string) {
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
