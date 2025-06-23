import chalk from 'chalk';
import { WiFiScanner } from './scanner.js';
import { TopologyMapper } from './topology.js';
import { SecurityAuditor } from './security.js';
import { SignalAnalyzer } from './analyzer.js';
import type { WiFiNetwork, ConnectedDevice, AnomalyDetection } from './types.js';

export class Dashboard {
  private scanner = new WiFiScanner();
  private topology = new TopologyMapper();
  private security = new SecurityAuditor();
  private analyzer = new SignalAnalyzer();
  
  private running = false;
  private networks: WiFiNetwork[] = [];
  private devices: ConnectedDevice[] = [];
  private anomalies: AnomalyDetection[] = [];
  private lastUpdate = new Date();

  async start(): Promise<void> {
    this.running = true;
    
    // Hide cursor and clear screen
    process.stdout.write('\x1B[?25l\x1B[2J\x1B[H');
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      this.stop();
    });
    
    // Initial scan
    await this.updateData();
    
    // Start update loop
    const updateInterval = setInterval(async () => {
      if (!this.running) {
        clearInterval(updateInterval);
        return;
      }
      
      await this.updateData();
      this.render();
    }, 5000); // Update every 5 seconds
    
    // Initial render
    this.render();
    
    // Keep the process alive
    while (this.running) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  stop(): void {
    this.running = false;
    // Show cursor and clear screen
    process.stdout.write('\x1B[?25h\x1B[2J\x1B[H');
    console.log(chalk.green('Dashboard stopped.'));
    process.exit(0);
  }

  private async updateData(): Promise<void> {
    try {
      const [newNetworks, newDevices] = await Promise.all([
        this.scanner.scanNetworks(),
        this.scanner.scanDevices()
      ]);
      
      // Check for anomalies
      const newAnomalies = this.detectAnomalies(newNetworks, newDevices);
      this.anomalies = [...newAnomalies, ...this.anomalies].slice(0, 10); // Keep last 10
      
      this.networks = newNetworks;
      this.devices = newDevices;
      this.lastUpdate = new Date();
      
    } catch (error) {
      // Silently handle errors in dashboard mode
    }
  }

  private render(): void {
    // Clear screen and move cursor to top
    process.stdout.write('\x1B[2J\x1B[H');
    
    const output = this.buildDashboard();
    console.log(output);
  }

  private buildDashboard(): string {
    const lines: string[] = [];
    const width = process.stdout.columns || 80;
    
    // Header
    lines.push(chalk.cyan.bold('🌐 WiFi Radar - Live Dashboard'.padEnd(width - 20) + chalk.gray(this.lastUpdate.toLocaleTimeString())));
    lines.push(chalk.gray('═'.repeat(width)));
    lines.push('');
    
    // Quick stats
    const connectedNetwork = this.networks.find(n => n.isConnected);
    const totalNetworks = this.networks.length;
    const connectedDevices = this.devices.length;
    const criticalAlerts = this.anomalies.filter(a => a.severity === 'critical').length;
    
    lines.push(chalk.white.bold('📊 QUICK STATS'));
    lines.push(`Connected to: ${connectedNetwork ? chalk.green(connectedNetwork.ssid) : chalk.red('None')}`);
    lines.push(`Networks detected: ${chalk.cyan(totalNetworks)}`);
    lines.push(`Connected devices: ${chalk.blue(connectedDevices)}`);
    lines.push(`Critical alerts: ${criticalAlerts > 0 ? chalk.red(criticalAlerts) : chalk.green('0')}`);
    lines.push('');
    
    // Two-column layout
    const leftColumn: string[] = [];
    const rightColumn: string[] = [];
    
    // Left column - Current network info
    leftColumn.push(chalk.green.bold('🔗 CURRENT CONNECTION'));
    leftColumn.push('');
    
    if (connectedNetwork) {
      const snr = connectedNetwork.signal - connectedNetwork.noise;
      leftColumn.push(`Network: ${connectedNetwork.ssid}`);
      leftColumn.push(`Signal: ${this.formatSignal(connectedNetwork.signal)}`);
      leftColumn.push(`Channel: ${connectedNetwork.channel}`);
      leftColumn.push(`Security: ${connectedNetwork.security.join(', ')}`);
      leftColumn.push(`SNR: ${snr} dB`);
      leftColumn.push(`PHY Mode: ${connectedNetwork.phyMode}`);
    } else {
      leftColumn.push(chalk.red('Not connected to any network'));
    }
    
    leftColumn.push('');
    leftColumn.push(chalk.blue.bold('📱 CONNECTED DEVICES'));
    leftColumn.push('');
    
    if (this.devices.length === 0) {
      leftColumn.push(chalk.gray('No devices detected'));
    } else {
      this.devices.slice(0, 5).forEach(device => {
        const icon = this.getDeviceIcon(device.deviceType);
        leftColumn.push(`${icon} ${device.hostname || 'Unknown'}`);
        leftColumn.push(chalk.gray(`   ${device.ip || 'No IP'} • ${device.vendor || 'Unknown vendor'}`));
      });
      
      if (this.devices.length > 5) {
        leftColumn.push(chalk.gray(`... and ${this.devices.length - 5} more`));
      }
    }
    
    // Right column - Network list and alerts
    rightColumn.push(chalk.magenta.bold('📶 NEARBY NETWORKS'));
    rightColumn.push('');
    
    const nearbyNetworks = this.networks
      .filter(n => !n.isConnected)
      .sort((a, b) => b.signal - a.signal)
      .slice(0, 8);
    
    if (nearbyNetworks.length === 0) {
      rightColumn.push(chalk.gray('No nearby networks'));
    } else {
      nearbyNetworks.forEach(network => {
        const bars = this.getSignalBars(network.signal);
        const securityIcon = network.security.includes('Open') ? '🔓' : '🔒';
        rightColumn.push(`${bars} ${securityIcon} ${network.ssid}`);
        rightColumn.push(chalk.gray(`   Ch ${network.channel} • ${network.signal} dBm`));
      });
    }
    
    rightColumn.push('');
    rightColumn.push(chalk.red.bold('🚨 RECENT ALERTS'));
    rightColumn.push('');
    
    if (this.anomalies.length === 0) {
      rightColumn.push(chalk.green('No alerts'));
    } else {
      this.anomalies.slice(0, 5).forEach(anomaly => {
        const severityColor = this.getSeverityColor(anomaly.severity);
        const timeStr = this.getRelativeTime(anomaly.timestamp);
        rightColumn.push(severityColor(`• ${anomaly.description}`));
        rightColumn.push(chalk.gray(`  ${timeStr}`));
      });
    }
    
    // Combine columns
    const maxLeftLength = Math.max(...leftColumn.map(line => this.stripAnsi(line).length));
    const columnWidth = Math.floor((width - 4) / 2);
    
    const maxRows = Math.max(leftColumn.length, rightColumn.length);
    
    for (let i = 0; i < maxRows; i++) {
      const left = (leftColumn[i] || '').padEnd(columnWidth);
      const right = rightColumn[i] || '';
      lines.push(`${left} │ ${right}`);
    }
    
    lines.push('');
    lines.push(chalk.gray('─'.repeat(width)));
    lines.push(chalk.gray('Press Ctrl+C to exit • Updates every 5 seconds'));
    
    return lines.join('\n');
  }

  private detectAnomalies(newNetworks: WiFiNetwork[], newDevices: ConnectedDevice[]): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    
    // Detect new devices
    const previousDeviceMacs = new Set(this.devices.map(d => d.mac));
    const newDeviceMacs = newDevices.filter(d => !previousDeviceMacs.has(d.mac));
    
    newDeviceMacs.forEach(device => {
      anomalies.push({
        type: 'new_device',
        severity: 'info',
        description: `New device connected: ${device.hostname || device.mac}`,
        timestamp: new Date(),
        affected: device.mac,
        data: device
      });
    });
    
    // Detect signal anomalies
    newNetworks.forEach(network => {
      const previousNetwork = this.networks.find(n => n.bssid === network.bssid);
      if (previousNetwork && Math.abs(network.signal - previousNetwork.signal) > 20) {
        anomalies.push({
          type: 'signal_anomaly',
          severity: 'warning',
          description: `Signal change detected for ${network.ssid}: ${previousNetwork.signal} → ${network.signal} dBm`,
          timestamp: new Date(),
          affected: network.ssid,
          data: { previous: previousNetwork.signal, current: network.signal }
        });
      }
    });
    
    // Detect new networks (potential rogue APs)
    const previousNetworkBSSIDs = new Set(this.networks.map(n => n.bssid));
    const newNetworkBSSIDs = newNetworks.filter(n => !previousNetworkBSSIDs.has(n.bssid));
    
    newNetworkBSSIDs.forEach(network => {
      if (network.security.includes('Open')) {
        anomalies.push({
          type: 'security_event',
          severity: 'warning',
          description: `New open network detected: ${network.ssid}`,
          timestamp: new Date(),
          affected: network.ssid,
          data: network
        });
      }
    });
    
    return anomalies;
  }

  private formatSignal(signal: number): string {
    const bars = this.getSignalBars(signal);
    const quality = signal >= -50 ? 'Excellent' : 
                   signal >= -60 ? 'Good' : 
                   signal >= -70 ? 'Fair' : 'Poor';
    return `${bars} ${signal} dBm (${quality})`;
  }

  private getSignalBars(signal: number): string {
    if (signal >= -30) return chalk.green('▰▰▰▰▰');
    if (signal >= -50) return chalk.green('▰▰▰▰▱');
    if (signal >= -60) return chalk.yellow('▰▰▰▱▱');
    if (signal >= -70) return chalk.yellow('▰▰▱▱▱');
    if (signal >= -80) return chalk.red('▰▱▱▱▱');
    return chalk.red('▱▱▱▱▱');
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

  private getSeverityColor(severity: string): typeof chalk.red {
    switch (severity) {
      case 'critical': return chalk.red;
      case 'warning': return chalk.yellow;
      case 'info': return chalk.blue;
      default: return chalk.gray;
    }
  }

  private getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  }

  private stripAnsi(str: string): string {
    // Remove ANSI color codes for length calculation
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }
}