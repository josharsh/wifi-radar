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

      const interfaces = wifiInfo['spairport_airport_interfaces'];
      if (!interfaces || interfaces.length === 0) return networks;

      // Find the main WiFi interface (usually en0)
      const mainInterface = interfaces.find((iface: any) => 
        iface._name === 'en0' || iface.spairport_current_network_information
      );

      if (!mainInterface) return networks;

      // Current connected network
      const currentNetworkInfo = mainInterface['spairport_current_network_information'];
      if (currentNetworkInfo && currentNetworkInfo._name) {
        const network = this.parseNetworkInfo(currentNetworkInfo, true);
        if (network) networks.push(network);
      }

      // Other nearby networks
      const otherNetworks = mainInterface['spairport_airport_other_local_wireless_networks'];
      if (otherNetworks && Array.isArray(otherNetworks)) {
        for (const networkInfo of otherNetworks) {
          const network = this.parseNetworkInfo(networkInfo, false);
          if (network) networks.push(network);
        }
      }

      return networks;
    } catch (error) {
      console.error('Error scanning networks:', error);
      return [];
    }
  }

  private parseNetworkInfo(networkInfo: any, isConnected: boolean): WiFiNetwork | null {
    if (!networkInfo._name) return null;

    const signal = this.parseSignal(networkInfo.spairport_signal_noise);
    const noise = this.parseNoise(networkInfo.spairport_signal_noise);
    const channel = this.parseChannel(networkInfo.spairport_network_channel);
    const frequency = this.channelToFrequency(channel);
    const security = this.parseSecurity(networkInfo.spairport_security_mode);

    return {
      ssid: networkInfo._name,
      bssid: networkInfo.spairport_network_bssid || this.generateBSSID(networkInfo._name),
      channel,
      frequency,
      signal,
      noise,
      security,
      phyMode: this.parsePhyMode(networkInfo.spairport_network_phymode),
      networkType: this.parseNetworkType(networkInfo.spairport_network_type),
      countryCode: networkInfo.spairport_network_country_code || 'unknown',
      lastSeen: new Date(),
      isConnected
    };
  }

  private parseSignal(signalNoiseStr: string | undefined): number {
    if (!signalNoiseStr) return -99;
    const match = signalNoiseStr.match(/(-?\d+) dBm/);
    return match ? parseInt(match[1]) : -99;
  }

  private parseNoise(signalNoiseStr: string | undefined): number {
    if (!signalNoiseStr) return -99;
    const parts = signalNoiseStr.split(' / ');
    if (parts.length > 1) {
      const match = parts[1].match(/(-?\d+) dBm/);
      return match ? parseInt(match[1]) : -99;
    }
    return -99;
  }

  private parseChannel(channelStr: string | undefined): number {
    if (!channelStr) return 0;
    const match = channelStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private parseSecurity(securityMode: string | undefined): string[] {
    if (!securityMode) return ['Open'];
    
    const securityMap: Record<string, string> = {
      'spairport_security_mode_none': 'Open',
      'spairport_security_mode_wep': 'WEP',
      'spairport_security_mode_wpa_personal': 'WPA Personal',
      'spairport_security_mode_wpa2_personal': 'WPA2 Personal',
      'spairport_security_mode_wpa3_personal': 'WPA3 Personal',
      'spairport_security_mode_wpa2_personal_mixed': 'WPA2/WPA3 Personal',
      'spairport_security_mode_wpa_enterprise': 'WPA Enterprise',
      'spairport_security_mode_wpa2_enterprise': 'WPA2 Enterprise',
      'spairport_security_mode_wpa3_enterprise': 'WPA3 Enterprise'
    };

    return [securityMap[securityMode] || securityMode];
  }

  private parsePhyMode(phyMode: string | undefined): string {
    if (!phyMode) return 'unknown';
    return phyMode.replace(/802\.11/, 'WiFi ');
  }

  private parseNetworkType(networkType: string | undefined): string {
    if (!networkType) return 'Infrastructure';
    if (networkType.includes('station')) return 'Infrastructure';
    if (networkType.includes('adhoc')) return 'Ad-hoc';
    return 'Infrastructure';
  }

  private generateBSSID(ssid: string): string {
    // Generate a pseudo-BSSID for networks without one
    const hash = ssid.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const mac = Math.abs(hash).toString(16).padStart(12, '0');
    return `${mac.substring(0, 2)}:${mac.substring(2, 4)}:${mac.substring(4, 6)}:${mac.substring(6, 8)}:${mac.substring(8, 10)}:${mac.substring(10, 12)}`;
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

      // Enhanced device discovery using network scanning
      const additionalDevices = await this.discoverNetworkDevices();
      devices.push(...additionalDevices);

      return devices;
    } catch (error) {
      console.error('Error scanning devices:', error);
      return [];
    }
  }

  private async discoverNetworkDevices(): Promise<ConnectedDevice[]> {
    const devices: ConnectedDevice[] = [];
    
    try {
      // Get current network info to determine subnet
      const { stdout: routeOutput } = await execAsync('route -n get default');
      const gatewayMatch = routeOutput.match(/gateway: (\d+\.\d+\.\d+\.\d+)/);
      
      if (gatewayMatch) {
        const gateway = gatewayMatch[1];
        const subnet = gateway.substring(0, gateway.lastIndexOf('.'));
        
        // Ping sweep to discover devices (limited to avoid flooding)
        const pingPromises: Promise<void>[] = [];
        for (let i = 1; i <= 20; i++) {
          const ip = `${subnet}.${i}`;
          pingPromises.push(this.pingDevice(ip).then(isAlive => {
            if (isAlive && ip !== gateway) {
              // Try to get MAC address
              this.getMacForIP(ip).then(mac => {
                if (mac) {
                  devices.push({
                    mac: mac.toLowerCase(),
                    ip,
                    deviceType: 'unknown',
                    lastSeen: new Date(),
                    isActive: true
                  });
                }
              }).catch(() => {});
            }
          }).catch(() => {}));
        }
        
        await Promise.all(pingPromises);
      }
    } catch (error) {
      // Silently handle network discovery errors
    }
    
    return devices;
  }

  private async pingDevice(ip: string): Promise<boolean> {
    try {
      await execAsync(`ping -c 1 -W 1000 ${ip}`);
      return true;
    } catch {
      return false;
    }
  }

  private async getMacForIP(ip: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`arp -n ${ip}`);
      const match = stdout.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  // Network Performance Testing Methods
  async testLatency(host: string = '8.8.8.8', count: number = 10): Promise<{
    min: number;
    max: number;
    avg: number;
    loss: number;
    jitter: number;
    times: number[];
  }> {
    try {
      const { stdout } = await execAsync(`ping -c ${count} ${host}`);
      const times: number[] = [];
      
      const timeMatches = stdout.match(/time=(\d+\.?\d*)/g);
      if (timeMatches) {
        timeMatches.forEach(match => {
          const time = parseFloat(match.replace('time=', ''));
          times.push(time);
        });
      }
      
      if (times.length === 0) {
        return { min: 0, max: 0, avg: 0, loss: 100, jitter: 0, times: [] };
      }
      
      const min = Math.min(...times);
      const max = Math.max(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const loss = ((count - times.length) / count) * 100;
      
      // Calculate jitter (standard deviation of latencies)
      const variance = times.reduce((acc, time) => acc + Math.pow(time - avg, 2), 0) / times.length;
      const jitter = Math.sqrt(variance);
      
      return { min, max, avg, loss, jitter, times };
    } catch (error) {
      return { min: 0, max: 0, avg: 0, loss: 100, jitter: 0, times: [] };
    }
  }

  async testDNSResolution(domains: string[] = ['google.com', 'cloudflare.com', 'github.com']): Promise<{
    domain: string;
    resolved: boolean;
    time: number;
    ip?: string;
  }[]> {
    const results: Array<{ domain: string; resolved: boolean; time: number; ip?: string }> = [];
    
    for (const domain of domains) {
      const startTime = Date.now();
      try {
        const { stdout } = await execAsync(`nslookup ${domain}`);
        const endTime = Date.now();
        const ipMatch = stdout.match(/Address: (\d+\.\d+\.\d+\.\d+)/);
        
        results.push({
          domain,
          resolved: true,
          time: endTime - startTime,
          ip: ipMatch ? ipMatch[1] : undefined
        });
      } catch {
        const endTime = Date.now();
        results.push({
          domain,
          resolved: false,
          time: endTime - startTime
        });
      }
    }
    
    return results;
  }

  async getNetworkInterface(): Promise<{
    name: string;
    ip: string;
    mac: string;
    speed?: string;
    duplex?: string;
  } | null> {
    try {
      const { stdout: ifconfigOutput } = await execAsync('ifconfig en0');
      
      const ipMatch = ifconfigOutput.match(/inet (\d+\.\d+\.\d+\.\d+)/);
      const macMatch = ifconfigOutput.match(/ether ([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
      
      if (ipMatch && macMatch) {
        return {
          name: 'en0',
          ip: ipMatch[1],
          mac: macMatch[1]
        };
      }
    } catch (error) {
      console.error('Error getting network interface:', error);
    }
    
    return null;
  }

  private async getMacVendor(mac: string): Promise<string | undefined> {
    const oui = mac.substring(0, 8).toUpperCase();
    
    if (this.macVendorCache.has(oui)) {
      return this.macVendorCache.get(oui);
    }

    // Enhanced vendor detection
    const vendors: Record<string, string> = {
      '00:1B:63': 'Apple',
      '00:25:00': 'Apple',
      '3C:15:C2': 'Apple',
      '80:A9:97': 'Apple',
      'B6:CD:79': 'Apple',
      '00:50:56': 'VMware',
      '08:00:27': 'VirtualBox',
      '00:0C:29': 'VMware',
      '44:D9:E7': 'TP-Link',
      '98:DE:D0': 'Netgear',
      'A0:63:91': 'Linksys',
      '00:1D:7E': 'Cisco',
      '00:26:B9': 'Cisco',
      '28:C6:8E': 'Ubiquiti',
      '74:AC:B9': 'Ubiquiti'
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
    
    // Enhanced device type detection
    if (name.includes('iphone') || name.includes('ios') || (vendorName.includes('apple') && mac?.includes('private'))) {
      return 'phone';
    }
    if (name.includes('ipad') || name.includes('tablet')) {
      return 'tablet';
    }
    if (name.includes('android') || name.includes('galaxy') || name.includes('pixel')) {
      return 'phone';
    }
    if (name.includes('macbook') || name.includes('laptop') || name.includes('imac') || name.includes('windows')) {
      return 'laptop';
    }
    if (name.includes('iot') || name.includes('smart') || name.includes('camera') || 
        name.includes('alexa') || name.includes('google') || name.includes('nest')) {
      return 'iot';
    }
    if (vendorName.includes('apple') && !name.includes('phone')) {
      return 'laptop';
    }
    
    return 'unknown';
  }
}