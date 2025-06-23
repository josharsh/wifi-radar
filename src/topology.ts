import chalk from 'chalk';
import type { WiFiNetwork, ConnectedDevice, NetworkTopology, NetworkRelationship } from './types.js';

export class TopologyMapper {
  generateTopology(networks: WiFiNetwork[], devices: ConnectedDevice[]): NetworkTopology {
    const currentNetwork = networks.find(n => n.isConnected);
    const relationships = this.generateRelationships(networks, devices);
    
    return {
      router: {
        mac: currentNetwork?.bssid || 'unknown',
        ip: '192.168.1.1', // Default assumption
        vendor: this.getRouterVendor(currentNetwork?.bssid),
        model: 'Unknown Router'
      },
      devices,
      networks,
      relationships
    };
  }

  renderTopologyASCII(topology: NetworkTopology): string {
    const lines: string[] = [];
    
    // Header
    lines.push(chalk.cyan.bold('🌐 NETWORK TOPOLOGY MAP'));
    lines.push(chalk.gray('─'.repeat(50)));
    lines.push('');
    
    // Router/Gateway
    const router = topology.router;
    lines.push(chalk.yellow.bold(`📡 GATEWAY: ${router.vendor || 'Unknown'}`));
    lines.push(chalk.gray(`   MAC: ${router.mac}`));
    lines.push(chalk.gray(`   IP:  ${router.ip}`));
    lines.push('');
    
    // Connected Network
    const connectedNet = topology.networks.find(n => n.isConnected);
    if (connectedNet) {
      lines.push(chalk.green.bold(`🔗 CONNECTED TO: ${connectedNet.ssid}`));
      lines.push(chalk.gray(`   Channel: ${connectedNet.channel} (${this.getFrequencyBand(connectedNet.frequency)})`));
      lines.push(chalk.gray(`   Signal:  ${this.formatSignalStrength(connectedNet.signal)}`));
      lines.push(chalk.gray(`   Security: ${connectedNet.security.join(', ')}`));
      lines.push('');
    }
    
    // Device Tree
    lines.push(chalk.blue.bold('📱 CONNECTED DEVICES'));
    lines.push('');
    
    if (topology.devices.length === 0) {
      lines.push(chalk.gray('   No devices detected'));
    } else {
      topology.devices.forEach((device, index) => {
        const isLast = index === topology.devices.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const deviceIcon = this.getDeviceIcon(device.deviceType);
        
        lines.push(chalk.white(`${prefix}${deviceIcon} ${device.hostname || 'Unknown Device'}`));
        lines.push(chalk.gray(`│   MAC: ${device.mac}`));
        lines.push(chalk.gray(`│   IP:  ${device.ip || 'Unknown'}`));
        lines.push(chalk.gray(`│   Type: ${device.deviceType || 'unknown'}`));
        if (device.vendor) {
          lines.push(chalk.gray(`│   Vendor: ${device.vendor}`));
        }
        if (!isLast) lines.push('│');
      });
    }
    
    lines.push('');
    
    // Nearby Networks
    const nearbyNetworks = topology.networks.filter(n => !n.isConnected);
    if (nearbyNetworks.length > 0) {
      lines.push(chalk.magenta.bold('📶 NEARBY NETWORKS'));
      lines.push('');
      
      nearbyNetworks
        .sort((a, b) => b.signal - a.signal)
        .slice(0, 10) // Top 10 networks
        .forEach(network => {
          const signalBars = this.getSignalBars(network.signal);
          const securityIcon = network.security.includes('Open') ? '🔓' : '🔒';
          
          lines.push(chalk.white(`${signalBars} ${securityIcon} ${network.ssid}`));
          lines.push(chalk.gray(`    Channel ${network.channel} • ${this.formatSignalStrength(network.signal)} • ${network.security.join(', ')}`));
        });
    }
    
    return lines.join('\n');
  }

  renderInteractiveMap(topology: NetworkTopology): string {
    const lines: string[] = [];
    
    // ASCII Art Network Diagram
    lines.push(chalk.cyan.bold('         🌐 INTERACTIVE NETWORK MAP'));
    lines.push('');
    lines.push('                    ┌─────────────┐');
    lines.push('                    │   INTERNET  │');
    lines.push('                    └──────┬──────┘');
    lines.push('                           │');
    lines.push('                    ┌──────▼──────┐');
    lines.push(`                    │   ${chalk.yellow('ROUTER')}    │`);
    lines.push(`                    │ ${topology.router.vendor || 'Unknown'} │`);
    lines.push('                    └──────┬──────┘');
    lines.push('                           │');
    lines.push('                    ┌──────▼──────┐');
    lines.push(`                    │  ${chalk.green('WiFi Network')} │`);
    
    const connectedNet = topology.networks.find(n => n.isConnected);
    if (connectedNet) {
      lines.push(`                    │ ${connectedNet.ssid.substring(0, 10)} │`);
    } else {
      lines.push('                    │ Disconnected │');
    }
    
    lines.push('                    └─────┬───────┘');
    lines.push('                          │');
    
    // Device connections
    if (topology.devices.length > 0) {
      const deviceCount = Math.min(topology.devices.length, 3);
      
      if (deviceCount === 1) {
        lines.push('                          │');
        lines.push('                    ┌─────▼─────┐');
        lines.push(`                    │ ${this.getDeviceIcon(topology.devices[0].deviceType)} Device 1 │`);
        lines.push('                    └───────────┘');
      } else {
        // Multiple devices in tree structure
        lines.push('                    ┌─────┼─────┐');
        
        for (let i = 0; i < deviceCount; i++) {
          const device = topology.devices[i];
          if (i === 0) {
            lines.push(`            ┌───────▼─────┐ │ ┌─────▼───────┐`);
            lines.push(`            │ ${this.getDeviceIcon(device.deviceType)} Device ${i + 1} │ │ │ ${this.getDeviceIcon(topology.devices[1]?.deviceType || 'unknown')} Device 2 │`);
            lines.push(`            └─────────────┘ │ └─────────────┘`);
            if (deviceCount > 2) {
              lines.push('                            │');
              lines.push(`                    ┌───────▼─────┐`);
              lines.push(`                    │ ${this.getDeviceIcon(topology.devices[2].deviceType)} Device 3 │`);
              lines.push('                    └─────────────┘');
            }
            break;
          }
        }
      }
    } else {
      lines.push('                          │');
      lines.push('                    ┌─────▼─────┐');
      lines.push('                    │ No Devices│');
      lines.push('                    └───────────┘');
    }
    
    return lines.join('\n');
  }

  private generateRelationships(networks: WiFiNetwork[], devices: ConnectedDevice[]): NetworkRelationship[] {
    const relationships: NetworkRelationship[] = [];
    
    // Connect all devices to the router
    const connectedNetwork = networks.find(n => n.isConnected);
    if (connectedNetwork) {
      devices.forEach(device => {
        relationships.push({
          from: connectedNetwork.bssid,
          to: device.mac,
          type: 'connected',
          strength: device.signal || 80 // Default strength
        });
      });
    }
    
    return relationships;
  }

  private getRouterVendor(bssid?: string): string | undefined {
    if (!bssid) return undefined;
    
    const oui = bssid.substring(0, 8).toUpperCase();
    const vendors: Record<string, string> = {
      '00:1B:63': 'Apple',
      '00:25:00': 'Apple',
      '3C:15:C2': 'Apple',
      '44:D9:E7': 'TP-Link',
      '98:DE:D0': 'Netgear',
      'A0:63:91': 'Linksys'
    };
    
    return vendors[oui];
  }

  private getDeviceIcon(deviceType?: string): string {
    const icons = {
      phone: '📱',
      laptop: '💻',
      tablet: '📱',
      iot: '🏠',
      unknown: '❓'
    };
    
    return icons[deviceType as keyof typeof icons] || icons.unknown;
  }

  private getSignalBars(signal: number): string {
    if (signal >= -30) return chalk.green('▰▰▰▰▰');
    if (signal >= -50) return chalk.green('▰▰▰▰▱');
    if (signal >= -60) return chalk.yellow('▰▰▰▱▱');
    if (signal >= -70) return chalk.yellow('▰▰▱▱▱');
    if (signal >= -80) return chalk.red('▰▱▱▱▱');
    return chalk.red('▱▱▱▱▱');
  }

  private formatSignalStrength(signal: number): string {
    const strength = signal >= -50 ? 'Excellent' : 
                    signal >= -60 ? 'Good' : 
                    signal >= -70 ? 'Fair' : 'Poor';
    
    const color = signal >= -50 ? chalk.green : 
                  signal >= -60 ? chalk.yellow : 
                  signal >= -70 ? chalk.yellow : chalk.red;
    
    return color(`${signal} dBm (${strength})`);
  }

  private getFrequencyBand(frequency: number): string {
    if (frequency >= 2400 && frequency <= 2500) return '2.4 GHz';
    if (frequency >= 5000 && frequency <= 6000) return '5 GHz';
    if (frequency >= 6000 && frequency <= 7000) return '6 GHz';
    return 'Unknown';
  }
}