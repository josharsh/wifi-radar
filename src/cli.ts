#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WiFiScanner } from './scanner.js';
import { TopologyMapper } from './topology.js';
import { SecurityAuditor } from './security.js';
import { SignalAnalyzer } from './analyzer.js';
import { Dashboard } from './dashboard.js';
import { NetworkTester } from './network-tester.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();
const scanner = new WiFiScanner();
const topology = new TopologyMapper();
const security = new SecurityAuditor();
const analyzer = new SignalAnalyzer();
const dashboard = new Dashboard();
const networkTester = new NetworkTester();

function showBanner() {
  console.log(chalk.cyan(figlet.textSync('WiFi Radar', { 
    font: 'Small',
    horizontalLayout: 'fitted'
  })));
  console.log(chalk.gray('The Ultimate Network Analysis & Performance Testing Tool'));
  console.log('');
}

program
  .name('wifi-radar')
  .description('Comprehensive WiFi network scanner and performance testing tool for macOS')
  .version(packageJson.version);

program
  .command('scan')
  .description('Scan for nearby WiFi networks')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    showBanner();
    
    const spinner = ora('Scanning for WiFi networks...').start();
    
    try {
      const networks = await scanner.scanNetworks();
      spinner.succeed(`Found ${networks.length} networks`);
      
      if (networks.length === 0) {
        console.log(chalk.yellow('No networks found. Make sure WiFi is enabled.'));
        return;
      }
      
      const table = new Table({
        head: ['SSID', 'Signal', 'Channel', 'Frequency', 'Security', 'Connected'],
        colWidths: [20, 12, 10, 12, 20, 12]
      });
      
      networks
        .sort((a, b) => b.signal - a.signal)
        .forEach(network => {
          const signalColor = network.signal >= -50 ? chalk.green : 
                             network.signal >= -70 ? chalk.yellow : chalk.red;
          const connectedIcon = network.isConnected ? chalk.green('✓') : '';
          const frequency = network.frequency < 3000 ? '2.4 GHz' : '5 GHz';
          
          table.push([
            network.ssid,
            signalColor(`${network.signal} dBm`),
            network.channel.toString(),
            frequency,
            network.security.join(', '),
            connectedIcon
          ]);
        });
      
      console.log(table.toString());
      
      if (options.verbose) {
        console.log('\n' + chalk.bold('Detailed Information:'));
        networks.forEach(network => {
          const snr = network.signal - network.noise;
          console.log(boxen(
            `SSID: ${network.ssid}\n` +
            `BSSID: ${network.bssid}\n` +
            `Channel: ${network.channel} (${network.frequency} MHz)\n` +
            `Signal: ${network.signal} dBm\n` +
            `Noise: ${network.noise} dBm\n` +
            `SNR: ${snr} dB\n` +
            `Security: ${network.security.join(', ')}\n` +
            `PHY Mode: ${network.phyMode}\n` +
            `Network Type: ${network.networkType}\n` +
            `Country: ${network.countryCode}`,
            { 
              title: network.isConnected ? chalk.green('✓ Connected') : 'Available',
              padding: 1,
              margin: 1,
              borderStyle: 'round'
            }
          ));
        });
      }
      
    } catch (error) {
      spinner.fail('Failed to scan networks');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('speed')
  .description('Run comprehensive internet speed test')
  .option('-s, --size <size>', 'Test size: small, medium, large', 'medium')
  .action(async (options) => {
    showBanner();
    
    console.log(chalk.blue.bold('🚀 COMPREHENSIVE SPEED TEST'));
    console.log(chalk.gray('Testing download, upload, latency, and jitter...'));
    console.log('');
    
    try {
      const result = await networkTester.runSpeedTest(options.size);
      
      console.log(chalk.green.bold('📊 SPEED TEST RESULTS'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const downloadColor = result.download.speed >= 25 ? chalk.green : 
                           result.download.speed >= 5 ? chalk.yellow : chalk.red;
      const uploadColor = result.upload.speed >= 10 ? chalk.green : 
                         result.upload.speed >= 3 ? chalk.yellow : chalk.red;
      const latencyColor = result.ping.latency <= 50 ? chalk.green : 
                          result.ping.latency <= 100 ? chalk.yellow : chalk.red;
      
      console.log(`📥 Download: ${downloadColor.bold(result.download.speed + ' Mbps')}`);
      console.log(`📤 Upload:   ${uploadColor.bold(result.upload.speed + ' Mbps')}`);
      console.log(`🏓 Latency:  ${latencyColor.bold(result.ping.latency + ' ms')}`);
      console.log(`📊 Jitter:   ${result.ping.jitter.toFixed(2)} ms`);
      console.log(`📉 Loss:     ${result.ping.packetLoss.toFixed(1)}%`);
      console.log('');
      console.log(chalk.gray(`Server: ${result.server.name}`));
      console.log(chalk.gray(`ISP: ${result.isp}`));
      console.log(chalk.gray(`Public IP: ${result.publicIP}`));
      console.log(chalk.gray(`Timestamp: ${result.timestamp.toLocaleString()}`));
      
      // Performance rating
      const rating = getSpeedRating(result.download.speed, result.ping.latency);
      console.log('');
      console.log(chalk.blue.bold('📈 PERFORMANCE RATING'));
      console.log(getRatingDisplay(rating));
      
    } catch (error) {
      console.error(chalk.red('Speed test failed:'), error);
    }
  });

program
  .command('ping')
  .description('Test network latency and jitter')
  .option('-h, --host <host>', 'Target host', '8.8.8.8')
  .option('-c, --count <count>', 'Number of ping packets', '10')
  .action(async (options) => {
    showBanner();
    
    const count = parseInt(options.count);
    const spinner = ora(`Testing latency to ${options.host} (${count} packets)...`).start();
    
    try {
      const result = await networkTester.testLatency(options.host, count);
      spinner.succeed('Latency test completed');
      
      console.log(chalk.blue.bold(`🏓 LATENCY TEST RESULTS - ${options.host}`));
      console.log(chalk.gray('─'.repeat(50)));
      
      const avgColor = result.avg <= 50 ? chalk.green : 
                      result.avg <= 100 ? chalk.yellow : chalk.red;
      const jitterColor = result.jitter <= 10 ? chalk.green : 
                         result.jitter <= 20 ? chalk.yellow : chalk.red;
      
      console.log(chalk.white(`📊 Statistics:`));
      console.log(`   Min:     ${result.min} ms`);
      console.log(`   Max:     ${result.max} ms`);
      console.log(`   Average: ${avgColor.bold(result.avg + ' ms')}`);
      console.log(`   Jitter:  ${jitterColor.bold(result.jitter.toFixed(2) + ' ms')}`);
      console.log(`   Loss:    ${result.loss}%`);
      console.log('');
      
      if (result.times.length > 0) {
        console.log(chalk.white('📈 Individual Times:'));
        const timeDisplay = result.times.map((time, i) => 
          `${i + 1}: ${time}ms`
        ).join('  ');
        console.log(`   ${timeDisplay}`);
      }
      
      // Quality assessment
      const quality = getLatencyQuality(result.avg, result.jitter, result.loss);
      console.log('');
      console.log(chalk.blue.bold('🎯 CONNECTION QUALITY'));
      console.log(getQualityDisplay(quality));
      
    } catch (error) {
      spinner.fail('Latency test failed');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('diagnostics')
  .description('Run comprehensive network diagnostics')
  .action(async () => {
    showBanner();
    
    try {
      const diagnostics = await networkTester.runNetworkDiagnostics();
      
      console.log(chalk.blue.bold('🔍 NETWORK DIAGNOSTICS REPORT'));
      console.log(chalk.gray('═'.repeat(60)));
      console.log('');
      
      // Interface Information
      console.log(chalk.green.bold('🌐 NETWORK INTERFACE'));
      console.log(`Interface: ${diagnostics.interface.name}`);
      console.log(`IP Address: ${diagnostics.interface.ip}`);
      console.log(`MAC Address: ${diagnostics.interface.mac}`);
      console.log(`MTU: ${diagnostics.interface.mtu}`);
      console.log(`Status: ${diagnostics.interface.status === 'up' ? chalk.green('UP') : chalk.red('DOWN')}`);
      console.log('');
      
      // Connectivity Tests
      console.log(chalk.cyan.bold('🔗 CONNECTIVITY TESTS'));
      console.log(`Internet:      ${diagnostics.connectivity.internet ? chalk.green('✓ Connected') : chalk.red('✗ Failed')}`);
      console.log(`Gateway:       ${diagnostics.connectivity.gateway ? chalk.green('✓ Reachable') : chalk.red('✗ Unreachable')}`);
      console.log(`Local Network: ${diagnostics.connectivity.localNetwork ? chalk.green('✓ Connected') : chalk.red('✗ Failed')}`);
      console.log(`DNS:           ${diagnostics.connectivity.dns ? chalk.green('✓ Working') : chalk.red('✗ Failed')}`);
      console.log('');
      
      // DNS Information
      console.log(chalk.magenta.bold('🔍 DNS CONFIGURATION'));
      console.log(`DNS Servers: ${diagnostics.dns.servers.join(', ')}`);
      console.log('DNS Resolution Tests:');
      diagnostics.dns.resolution.forEach(test => {
        const status = test.resolved ? chalk.green(`✓ ${test.time}ms`) : chalk.red('✗ Failed');
        console.log(`   ${test.domain}: ${status}${test.ip ? ` → ${test.ip}` : ''}`);
      });
      console.log('');
      
      // Routing Information
      console.log(chalk.yellow.bold('🛤️ ROUTING INFORMATION'));
      console.log(`Default Gateway: ${diagnostics.routing.gateway}`);
      if (diagnostics.routing.routes.length > 0) {
        console.log('Routes:');
        diagnostics.routing.routes.slice(0, 5).forEach(route => {
          console.log(`   ${route.destination} → ${route.gateway} (${route.interface})`);
        });
      }
      console.log('');
      
      // Performance Summary
      console.log(chalk.red.bold('⚡ PERFORMANCE SUMMARY'));
      const latency = diagnostics.performance.latency;
      const latencyColor = latency.avg <= 50 ? chalk.green : 
                          latency.avg <= 100 ? chalk.yellow : chalk.red;
      console.log(`Latency: ${latencyColor.bold(latency.avg + ' ms')} (jitter: ${latency.jitter.toFixed(1)}ms)`);
      
      if (diagnostics.performance.bandwidth.download > 0) {
        console.log(`Bandwidth: ${diagnostics.performance.bandwidth.download} Mbps`);
      }
      
    } catch (error) {
      console.error(chalk.red('Diagnostics failed:'), error);
    }
  });

program
  .command('health')
  .description('Analyze overall WiFi network health')
  .action(async () => {
    showBanner();
    
    const spinner = ora('Analyzing WiFi network health...').start();
    
    try {
      const networks = await scanner.scanNetworks();
      const currentNetwork = networks.find(n => n.isConnected);
      
      if (!currentNetwork) {
        spinner.fail('No connected network found');
        console.log(chalk.yellow('Please connect to a WiFi network first.'));
        return;
      }
      
      const health = await networkTester.analyzeWiFiHealth(networks, currentNetwork);
      spinner.succeed('WiFi health analysis completed');
      
      console.log(chalk.blue.bold('🏥 WIFI HEALTH REPORT'));
      console.log(chalk.gray('═'.repeat(50)));
      console.log('');
      
      // Overall Health
      const overallColor = getHealthColor(health.overall);
      console.log(chalk.white.bold('📊 OVERALL HEALTH'));
      console.log(`   Status: ${overallColor.bold(health.overall.toUpperCase())}`);
      console.log('');
      
      // Signal Analysis
      console.log(chalk.green.bold('📶 SIGNAL ANALYSIS'));
      console.log(`   Strength: ${health.signal.strength} dBm (${getSignalQualityDisplay(health.signal.quality)})`);
      console.log(`   Quality: ${getQualityColorDisplay(health.signal.quality)}`);
      console.log(`   Stability: ${health.signal.stability === 'stable' ? chalk.green('Stable') : chalk.yellow('Unstable')}`);
      console.log('');
      
      // Speed Analysis
      console.log(chalk.cyan.bold('🚀 SPEED ANALYSIS'));
      console.log(`   Download: ${health.speed.download} Mbps (${getQualityColorDisplay(health.speed.rating)})`);
      console.log(`   Upload: ${health.speed.upload} Mbps`);
      console.log('');
      
      // Latency Analysis
      console.log(chalk.yellow.bold('🏓 LATENCY ANALYSIS'));
      console.log(`   Ping: ${health.latency.ping} ms (${getQualityColorDisplay(health.latency.rating)})`);
      console.log(`   Jitter: ${health.latency.jitter} ms`);
      console.log('');
      
      // Congestion Analysis
      console.log(chalk.magenta.bold('📊 CONGESTION ANALYSIS'));
      const congestionColor = health.congestion.level === 'low' ? chalk.green : 
                             health.congestion.level === 'medium' ? chalk.yellow : chalk.red;
      console.log(`   Level: ${congestionColor.bold(health.congestion.level.toUpperCase())}`);
      console.log(`   Channel Utilization: ${health.congestion.channelUtilization}%`);
      console.log('');
      
      // Security Analysis
      console.log(chalk.red.bold('🔒 SECURITY ANALYSIS'));
      const securityColor = health.security.level === 'secure' ? chalk.green : 
                           health.security.level === 'warning' ? chalk.yellow : chalk.red;
      console.log(`   Level: ${securityColor.bold(health.security.level.toUpperCase())}`);
      if (health.security.issues.length > 0) {
        console.log('   Issues:');
        health.security.issues.forEach(issue => {
          console.log(chalk.red(`   • ${issue}`));
        });
      }
      console.log('');
      
      // Recommendations
      if (health.recommendations.length > 0) {
        console.log(chalk.blue.bold('💡 RECOMMENDATIONS'));
        health.recommendations.forEach(rec => {
          console.log(chalk.blue(`• ${rec}`));
        });
        console.log('');
      }
      
    } catch (error) {
      spinner.fail('Health analysis failed');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('qos')
  .description('Analyze Quality of Service for different applications')
  .action(async () => {
    showBanner();
    
    const spinner = ora('Analyzing Quality of Service...').start();
    
    try {
      const qos = await networkTester.calculateQualityOfService();
      spinner.succeed('QoS analysis completed');
      
      console.log(chalk.blue.bold('🎯 QUALITY OF SERVICE ANALYSIS'));
      console.log(chalk.gray('═'.repeat(50)));
      console.log('');
      
      // Overall Classification
      const classColor = getQualityColor(qos.classification);
      console.log(chalk.white.bold('📊 OVERALL CLASSIFICATION'));
      console.log(`   ${classColor.bold(qos.classification.toUpperCase())}`);
      console.log('');
      
      // Network Metrics
      console.log(chalk.cyan.bold('📈 NETWORK METRICS'));
      console.log(`   Latency: ${qos.metrics.latency} ms`);
      console.log(`   Jitter: ${qos.metrics.jitter.toFixed(2)} ms`);
      console.log(`   Packet Loss: ${qos.metrics.packetLoss.toFixed(1)}%`);
      console.log(`   Throughput: ${qos.metrics.throughput} Mbps`);
      console.log('');
      
      // Application Performance
      console.log(chalk.green.bold('🎮 APPLICATION PERFORMANCE'));
      console.log(`   📹 Video Streaming: ${getQualityColorDisplay(qos.applications.video)}`);
      console.log(`   📞 Voice Calls: ${getQualityColorDisplay(qos.applications.voice)}`);
      console.log(`   🎯 Gaming: ${getQualityColorDisplay(qos.applications.gaming)}`);
      console.log(`   🌐 Web Browsing: ${getQualityColorDisplay(qos.applications.browsing)}`);
      
    } catch (error) {
      spinner.fail('QoS analysis failed');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('topology')
  .description('Show network topology map')
  .option('-i, --interactive', 'Show interactive topology map')
  .action(async (options) => {
    showBanner();
    
    const spinner = ora('Mapping network topology...').start();
    
    try {
      const [networks, devices] = await Promise.all([
        scanner.scanNetworks(),
        scanner.scanDevices()
      ]);
      
      spinner.succeed('Network topology mapped');
      
      const networkTopology = topology.generateTopology(networks, devices);
      
      if (options.interactive) {
        console.log(topology.renderInteractiveMap(networkTopology));
      } else {
        console.log(topology.renderTopologyASCII(networkTopology));
      }
      
    } catch (error) {
      spinner.fail('Failed to map topology');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('devices')
  .description('Identify connected devices')
  .action(async () => {
    showBanner();
    
    const spinner = ora('Scanning for connected devices...').start();
    
    try {
      const devices = await scanner.scanDevices();
      spinner.succeed(`Found ${devices.length} connected devices`);
      
      if (devices.length === 0) {
        console.log(chalk.yellow('No connected devices found.'));
        return;
      }
      
      const table = new Table({
        head: ['Device', 'IP Address', 'MAC Address', 'Vendor', 'Type'],
        colWidths: [20, 15, 18, 15, 10]
      });
      
      devices.forEach(device => {
        const deviceIcon = topology['getDeviceIcon'](device.deviceType);
        table.push([
          `${deviceIcon} ${device.hostname || 'Unknown'}`,
          device.ip || 'Unknown',
          device.mac,
          device.vendor || 'Unknown',
          device.deviceType || 'unknown'
        ]);
      });
      
      console.log(table.toString());
      
    } catch (error) {
      spinner.fail('Failed to scan devices');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('signal')
  .description('Analyze signal strength and quality')
  .action(async () => {
    showBanner();
    
    const spinner = ora('Analyzing signal quality...').start();
    
    try {
      const networks = await scanner.scanNetworks();
      const analysis = await analyzer.analyzeSignal(networks);
      
      spinner.succeed('Signal analysis complete');
      
      console.log(analyzer.renderSignalAnalysis(analysis));
      
    } catch (error) {
      spinner.fail('Failed to analyze signal');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('security')
  .description('Perform security audit')
  .action(async () => {
    showBanner();
    
    const spinner = ora('Running security audit...').start();
    
    try {
      const networks = await scanner.scanNetworks();
      const audits = await security.auditNetworks(networks);
      
      spinner.succeed('Security audit complete');
      
      console.log(security.renderSecurityReport(audits));
      
    } catch (error) {
      spinner.fail('Failed to run security audit');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('dashboard')
  .description('Launch interactive real-time dashboard')
  .action(async () => {
    showBanner();
    
    console.log(chalk.yellow('Launching interactive dashboard...'));
    console.log(chalk.gray('Press Ctrl+C to exit'));
    console.log('');
    
    try {
      await dashboard.start();
    } catch (error) {
      console.error(chalk.red('Dashboard error:'), error);
    }
  });

program
  .command('help-extended')
  .description('Show comprehensive help with all available features')
  .action(() => {
    showBanner();
    
    console.log(chalk.blue.bold('🚀 WIFI RADAR - COMPREHENSIVE NETWORK ANALYSIS TOOL'));
    console.log(chalk.gray('═'.repeat(70)));
    console.log('');
    
    console.log(chalk.green.bold('📊 NETWORK SCANNING & ANALYSIS'));
    console.log(chalk.cyan('  scan              ') + 'Scan for nearby WiFi networks with detailed info');
    console.log(chalk.cyan('  signal            ') + 'Analyze signal strength and quality');
    console.log(chalk.cyan('  devices           ') + 'Identify all connected devices on network');
    console.log(chalk.cyan('  topology          ') + 'Generate network topology map');
    console.log('');
    
    console.log(chalk.green.bold('⚡ PERFORMANCE TESTING'));
    console.log(chalk.cyan('  speed             ') + 'Run comprehensive internet speed test');
    console.log(chalk.cyan('  ping              ') + 'Test network latency and jitter analysis');
    console.log(chalk.cyan('  diagnostics       ') + 'Complete network diagnostics report');
    console.log('');
    
    console.log(chalk.green.bold('🏥 HEALTH & QUALITY ANALYSIS'));
    console.log(chalk.cyan('  health            ') + 'Comprehensive WiFi network health analysis');
    console.log(chalk.cyan('  qos               ') + 'Quality of Service for different applications');
    console.log('');
    
    console.log(chalk.green.bold('🔒 SECURITY AUDITING'));
    console.log(chalk.cyan('  security          ') + 'Perform comprehensive security audit');
    console.log('');
    
    console.log(chalk.green.bold('📱 LIVE MONITORING'));
    console.log(chalk.cyan('  dashboard         ') + 'Launch real-time interactive dashboard');
    console.log('');
    
    console.log(chalk.yellow.bold('🎯 EXAMPLE USAGE'));
    console.log(chalk.white('  wifi-radar scan -v              ') + chalk.gray('# Detailed network scan'));
    console.log(chalk.white('  wifi-radar speed --size large   ') + chalk.gray('# Large speed test'));
    console.log(chalk.white('  wifi-radar ping -h 1.1.1.1 -c 20') + chalk.gray('# Test Cloudflare DNS'));
    console.log(chalk.white('  wifi-radar health               ') + chalk.gray('# Complete health analysis'));
    console.log(chalk.white('  wifi-radar diagnostics          ') + chalk.gray('# Network troubleshooting'));
    console.log(chalk.white('  wifi-radar qos                  ') + chalk.gray('# Check app performance'));
    console.log(chalk.white('  wifi-radar dashboard            ') + chalk.gray('# Live monitoring'));
    console.log('');
    
    console.log(chalk.magenta.bold('✨ KEY FEATURES'));
    console.log(chalk.white('• Real-time network monitoring and analysis'));
    console.log(chalk.white('• Internet speed testing (download/upload/latency/jitter)'));
    console.log(chalk.white('• Device discovery and identification'));
    console.log(chalk.white('• Signal quality and interference analysis'));
    console.log(chalk.white('• Security vulnerability assessment'));
    console.log(chalk.white('• Network performance diagnostics'));
    console.log(chalk.white('• Quality of Service analysis for different apps'));
    console.log(chalk.white('• Interactive topology mapping'));
    console.log(chalk.white('• WiFi health scoring and recommendations'));
    console.log('');
    
    console.log(chalk.red.bold('💡 PRO TIPS'));
    console.log(chalk.yellow('• Run "health" command first for overall network status'));
    console.log(chalk.yellow('• Use "diagnostics" for troubleshooting connection issues'));
    console.log(chalk.yellow('• "qos" helps determine if network is suitable for specific apps'));
    console.log(chalk.yellow('• "dashboard" provides continuous monitoring'));
    console.log(chalk.yellow('• Regular "security" audits help maintain network safety'));
  });

// Utility functions for display formatting
function getSpeedRating(downloadSpeed: number, latency: number): string {
  if (downloadSpeed >= 100 && latency <= 20) return 'excellent';
  if (downloadSpeed >= 25 && latency <= 50) return 'good';
  if (downloadSpeed >= 5 && latency <= 100) return 'fair';
  return 'poor';
}

function getLatencyQuality(avg: number, jitter: number, loss: number): string {
  if (avg <= 20 && jitter <= 5 && loss <= 0.1) return 'excellent';
  if (avg <= 50 && jitter <= 10 && loss <= 1) return 'good';
  if (avg <= 100 && jitter <= 20 && loss <= 3) return 'fair';
  return 'poor';
}

function getRatingDisplay(rating: string): string {
  const colors = {
    excellent: chalk.green,
    good: chalk.blue,
    fair: chalk.yellow,
    poor: chalk.red
  };
  
  const bars = {
    excellent: '▰▰▰▰▰',
    good: '▰▰▰▰▱',
    fair: '▰▰▱▱▱',
    poor: '▰▱▱▱▱'
  };
  
  const color = colors[rating as keyof typeof colors] || chalk.gray;
  const bar = bars[rating as keyof typeof bars] || '▱▱▱▱▱';
  
  return `${color(bar)} ${color.bold(rating.toUpperCase())}`;
}

function getQualityDisplay(quality: string): string {
  return getRatingDisplay(quality);
}

function getHealthColor(health: string): typeof chalk.green {
  const colors = {
    excellent: chalk.green,
    good: chalk.blue,
    fair: chalk.yellow,
    poor: chalk.red,
    critical: chalk.red
  };
  
  return colors[health as keyof typeof colors] || chalk.gray;
}

function getQualityColor(quality: string): typeof chalk.green {
  const colors = {
    excellent: chalk.green,
    good: chalk.blue,
    fair: chalk.yellow,
    poor: chalk.red,
    unusable: chalk.red
  };
  
  return colors[quality as keyof typeof colors] || chalk.gray;
}

function getSignalQualityDisplay(quality: string): string {
  const displays = {
    excellent: chalk.green('Excellent'),
    good: chalk.blue('Good'),
    fair: chalk.yellow('Fair'),
    poor: chalk.red('Poor')
  };
  
  return displays[quality as keyof typeof displays] || chalk.gray('Unknown');
}

function getQualityColorDisplay(quality: string): string {
  const color = getQualityColor(quality);
  return color.bold(quality.toUpperCase());
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught error:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled rejection:'), error);
  process.exit(1);
});

program.parse();