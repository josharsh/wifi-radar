import { exec } from 'child_process';
import { promisify } from 'util';
import type { WiFiNetwork, ConnectedDevice } from './types.js';

const execAsync = promisify(exec);

export class WiFiScanner {
  private macVendorCache = new Map<string, string>();

  async scanNetworks(): Promise<WiFiNetwork[]> {
    try {
      const { stdout } = await execAsync('system_profiler SPAirPortDataType -json');
      const data = JSON.parse(stdout);
      
      const networks: WiFiNetwork[] = [];
      const wifiInfo = data.SPAirPortDataType?.[0];
      
      if (!wifiInfo) return networks;

      // Current network
      const currentNetwork = wifiInfo['spairport_airport_interfaces']?.[0]?.['spairport_current_network_information'];
      if (currentNetwork) {
        const networkName = Object.keys(currentNetwork)[0];
        const networkData = currentNetwork[networkName];
        
        networks.push({
          ssid: networkName,
          bssid: networkData.spairport_network_bssid || 'unknown',
          channel: this.parseChannel(networkData.spairport_network_channel),
          frequency: this.channelToFrequency(this.parseChannel(networkData.spairport_network_channel)),
          signal: this.parseSignal(networkData['spairport_signal_noise']),
          noise: this.parseNoise(networkData['spairport_signal_noise']),
          security: this.parseSecurity(networkData.spairport_security_mode),
          phyMode: networkData.spairport_network_phymode || 'unknown',
          networkType: networkData.spairport_network_type || 'Infrastructure',
          countryCode: networkData.spairport_country_code || 'unknown',
          lastSeen: new Date(),
          isConnected: true
        });
      }

      // Other networks
      const otherNetworks = wifiInfo['spairport_airport_interfaces']?.[0]?.['spairport_other_local_wi_fi_networks'];
      if (otherNetworks) {
        for (const [ssid, networkData] of Object.entries(otherNetworks)) {
          networks.push({
            ssid,
            bssid: (networkData as any).spairport_network_bssid || 'unknown',
            channel: this.parseChannel((networkData as any).spairport_network_channel),
            frequency: this.channelToFrequency(this.parseChannel((networkData as any).spairport_network_channel)),
            signal: this.parseSignal((networkData as any)['spairport_signal_noise']),
            noise: this.parseNoise((networkData as any)['spairport_signal_noise']),
            security: this.parseSecurity((networkData as any).spairport_security_mode),
            phyMode: (networkData as any).spairport_network_phymode || 'unknown',
            networkType: (networkData as any).spairport_network_type || 'Infrastructure',
            countryCode: (networkData as any).spairport_country_code || 'unknown',
            lastSeen: new Date(),
            isConnected: false
          });
        }
      }

      return networks;
    } catch (error) {
      console.error('Error scanning networks:', error);
      return [];
    }
  }

  async scanDevices(): Promise<ConnectedDevice[]> {
    const devices: ConnectedDevice[] = [];
    
    try {
      // Get ARP table for connected devices
      const { stdout: arpOutput } = await execAsync('arp -a');
      const arpLines = arpOutput.split('\n').filter(line => line.trim());
      
      for (const line of arpLines) {
        const match = line.match(/^(.+?) \((.+?)\) at (.+?) on (.+?)(?:\s|$)/);
        if (match) {
          const [, hostname, ip, mac, interface_] = match;
          
          if (interface_.includes('en0') || interface_.includes('wifi')) {
            const vendor = await this.getMacVendor(mac);
            
            devices.push({
              mac: mac.toLowerCase(),
              ip,
              hostname: hostname !== '?' ? hostname : undefined,
              vendor,
              deviceType: this.guessDeviceType(hostname, vendor, mac),
              lastSeen: new Date(),
              isActive: true
            });
          }
        }
      }

      return devices;
    } catch (error) {
      console.error('Error scanning devices:', error);
      return [];
    }
  }

  private parseChannel(channelStr: string): number {
    if (!channelStr) return 0;
    const match = channelStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private parseSignal(signalNoiseStr: string): number {
    if (!signalNoiseStr) return 0;
    const match = signalNoiseStr.match(/(-?\d+) dBm/);
    return match ? parseInt(match[1]) : 0;
  }

  private parseNoise(signalNoiseStr: string): number {
    if (!signalNoiseStr) return -99;
    const parts = signalNoiseStr.split(' / ');
    if (parts.length > 1) {
      const match = parts[1].match(/(-?\d+) dBm/);
      return match ? parseInt(match[1]) : -99;
    }
    return -99;
  }

  private parseSecurity(securityStr: string): string[] {
    if (!securityStr) return ['Open'];
    return securityStr.split('/').map(s => s.trim());
  }

  private channelToFrequency(channel: number): number {
    if (channel >= 1 && channel <= 14) {
      // 2.4 GHz band
      return 2412 + (channel - 1) * 5;
    } else if (channel >= 36 && channel <= 165) {
      // 5 GHz band
      return 5000 + channel * 5;
    }
    return 0;
  }

  private async getMacVendor(mac: string): Promise<string | undefined> {
    const oui = mac.substring(0, 8).toUpperCase();
    
    if (this.macVendorCache.has(oui)) {
      return this.macVendorCache.get(oui);
    }

    // Simple vendor detection based on common OUIs
    const vendors: Record<string, string> = {
      '00:1B:63': 'Apple',
      '00:25:00': 'Apple',
      '3C:15:C2': 'Apple',
      '80:A9:97': 'Apple',
      'B6:CD:79': 'Apple',
      '00:50:56': 'VMware',
      '08:00:27': 'VirtualBox',
      '00:0C:29': 'VMware'
    };

    const vendor = vendors[oui];
    if (vendor) {
      this.macVendorCache.set(oui, vendor);
    }
    
    return vendor;
  }

  private guessDeviceType(hostname?: string, vendor?: string, mac?: string): ConnectedDevice['deviceType'] {
    if (!hostname && !vendor) return 'unknown';
    
    const name = (hostname || '').toLowerCase();
    const vendorName = (vendor || '').toLowerCase();
    
    if (name.includes('iphone') || name.includes('ipad') || name.includes('android')) {
      return 'phone';
    }
    if (name.includes('macbook') || name.includes('laptop') || vendorName.includes('apple')) {
      return 'laptop';
    }
    if (name.includes('tablet') || name.includes('ipad')) {
      return 'tablet';
    }
    if (name.includes('iot') || name.includes('smart') || name.includes('camera')) {
      return 'iot';
    }
    
    return 'unknown';
  }
}