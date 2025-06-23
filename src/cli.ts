#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import { WiFiScanner } from './scanner.js';
import { TopologyMapper } from './topology.js';
import { SecurityAuditor } from './security.js';
import { SignalAnalyzer } from './analyzer.js';
import { Dashboard } from './dashboard.js';

const program = new Command();
const scanner = new WiFiScanner();
const topology = new TopologyMapper();
const security = new SecurityAuditor();
const analyzer = new SignalAnalyzer();
const dashboard = new Dashboard();

function showBanner() {
  console.log(chalk.cyan(figlet.textSync('WiFi Radar', { 
    font: 'Small',
    horizontalLayout: 'fitted'
  })));
  console.log(chalk.gray('AI-Powered Network Intelligence Tool'));
  console.log('');
}

program
  .name('wifi-radar')
  .description('AI-powered WiFi network intelligence and topology mapping')
  .version('1.0.0');

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
        head: ['SSID', 'Signal', 'Channel', 'Security', 'Connected'],
        colWidths: [20, 12, 10, 15, 12]
      });
      
      networks
        .sort((a, b) => b.signal - a.signal)
        .forEach(network => {
          const signalColor = network.signal >= -50 ? chalk.green : 
                             network.signal >= -70 ? chalk.yellow : chalk.red;
          const connectedIcon = network.isConnected ? chalk.green('✓') : '';
          
          table.push([
            network.ssid,
            signalColor(`${network.signal} dBm`),
            network.channel.toString(),
            network.security.join(', '),
            connectedIcon
          ]);
        });
      
      console.log(table.toString());
      
      if (options.verbose) {
        console.log('\n' + chalk.bold('Detailed Information:'));
        networks.forEach(network => {
          console.log(boxen(
            `SSID: ${network.ssid}\n` +
            `BSSID: ${network.bssid}\n` +
            `Channel: ${network.channel}\n` +
            `Frequency: ${network.frequency} MHz\n` +
            `Signal: ${network.signal} dBm\n` +
            `Noise: ${network.noise} dBm\n` +
            `SNR: ${network.signal - network.noise} dB\n` +
            `Security: ${network.security.join(', ')}\n` +
            `PHY Mode: ${network.phyMode}\n` +
            `Country: ${network.countryCode}`,
            { 
              title: network.isConnected ? chalk.green('Connected') : 'Available',
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