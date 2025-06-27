import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { 
  SpeedTestResult, 
  LatencyTest, 
  NetworkDiagnostics, 
  TrafficAnalysis, 
  WifiHealth, 
  QualityOfService,
  DNSTest,
  BandwidthTest,
  RouteEntry
} from './types.js';

const execAsync = promisify(exec);

export class NetworkTester {
  private speedTestServers = [
    // Fast.com CDN servers (Netflix's speed test)
    { url: 'https://fast.com', name: 'Fast.com', type: 'cdn' },
    
    // High-quality speed test servers with large files
    { 
      download: 'https://speed.hetzner.de/100MB.bin', 
      upload: 'https://speed.hetzner.de/', 
      size: 104857600, 
      name: 'Hetzner', 
      location: 'Germany' 
    },
    { 
      download: 'http://speedtest.tele2.net/100MB.zip', 
      upload: 'http://speedtest.tele2.net/', 
      size: 104857600, 
      name: 'Tele2', 
      location: 'Sweden' 
    },
    { 
      download: 'https://proof.ovh.net/files/100Mb.dat', 
      upload: 'https://proof.ovh.net/', 
      size: 104857600, 
      name: 'OVH', 
      location: 'France' 
    },
    // US-based servers
    { 
      download: 'http://speedtest.wdc01.softlayer.com/downloads/test100.zip', 
      upload: 'http://speedtest.wdc01.softlayer.com/', 
      size: 104857600, 
      name: 'IBM Cloud', 
      location: 'Washington DC' 
    },
    // Asia-Pacific servers for better global coverage
    { 
      download: 'http://speedtest.tokyo.linode.com/100MB-tokyo.bin', 
      upload: 'http://speedtest.tokyo.linode.com/', 
      size: 104857600, 
      name: 'Linode Tokyo', 
      location: 'Tokyo' 
    }
  ];

  async runSpeedTest(testSize: 'small' | 'medium' | 'large' = 'medium'): Promise<SpeedTestResult> {
    console.log(chalk.blue('🚀 Running comprehensive speed test...'));
    
    const publicIP = await this.getPublicIP();
    const isp = await this.getISP();
    
    try {
      // Find the best server first
      console.log(chalk.yellow('🔍 Finding optimal test server...'));
      const bestServer = await this.findBestServer();
      
      // Run multiple download tests for accuracy
      console.log(chalk.yellow('📥 Testing download speed...'));
      const downloadResult = await this.testDownloadSpeedImproved(testSize, bestServer);
      
      // Run upload test with proper methodology
      console.log(chalk.yellow('📤 Testing upload speed...'));
      const uploadResult = await this.testUploadSpeedImproved(testSize);
      
      // Ping test
      console.log(chalk.yellow('🏓 Testing latency and jitter...'));
      const pingResult = await this.testLatency('8.8.8.8', 10);
      
      return {
        download: downloadResult,
        upload: uploadResult,
        ping: {
          latency: pingResult.avg,
          jitter: pingResult.jitter,
          packetLoss: pingResult.loss
        },
        server: {
          name: bestServer.name,
          location: bestServer.location,
          distance: 0
        },
        timestamp: new Date(),
        isp: isp,
        publicIP: publicIP
      };
    } catch (error) {
      console.error('Speed test failed:', error);
      throw error;
    }
  }

  private async findBestServer(): Promise<any> {
    const results = [];
    
    for (const server of this.speedTestServers.slice(0, 3)) { // Test top 3 servers
      try {
        const startTime = Date.now();
        await execAsync(`curl -I -s --max-time 5 "${server.download}"`, { timeout: 6000 });
        const responseTime = Date.now() - startTime;
        results.push({ server, responseTime });
      } catch {
        // Server unavailable
      }
    }
    
    if (results.length === 0) {
      return this.speedTestServers[0]; // Fallback
    }
    
    // Return server with best response time
    results.sort((a, b) => a.responseTime - b.responseTime);
    return results[0].server;
  }

  private async testDownloadSpeedImproved(testSize: 'small' | 'medium' | 'large', server: any): Promise<{
    speed: number;
    bytes: number;
    elapsed: number;
  }> {
    const sizeMap = {
      small: { url: server.download.replace('100MB', '10MB'), size: 10485760 },   // 10MB
      medium: { url: server.download, size: 104857600 },  // 100MB
      large: { url: server.download.replace('100MB', '1000MB'), size: 1073741824 } // 1GB
    };
    
    const testConfig = sizeMap[testSize];
    const testUrl = testConfig.url;
    const expectedSize = testConfig.size;
    
    try {
      // Run multiple tests for accuracy and take the best result
      const results = [];
      const numTests = testSize === 'large' ? 1 : 2; // Only 1 test for large files
      
      for (let i = 0; i < numTests; i++) {
        try {
          const { stdout } = await execAsync(
            `curl -o /dev/null -s -w "%{time_total},%{size_download},%{speed_download},%{http_code}" --max-time 120 "${testUrl}"`,
            { timeout: 130000 }
          );
          
          const [timeTotal, sizeDownload, speedDownload, httpCode] = stdout.trim().split(',');
          
          if (httpCode === '200' && parseInt(sizeDownload) > 0) {
            const elapsed = parseFloat(timeTotal);
            const bytes = parseInt(sizeDownload);
            const bytesPerSecond = parseFloat(speedDownload);
            const mbps = (bytesPerSecond * 8) / (1024 * 1024); // Convert to Mbps
            
            results.push({
              speed: Math.round(mbps * 100) / 100,
              bytes: bytes,
              elapsed: elapsed
            });
          }
        } catch (error) {
          // Individual test failed, continue with others
        }
      }
      
      if (results.length === 0) {
        throw new Error('All download tests failed');
      }
      
      // Return the test with the highest speed (most accurate)
      results.sort((a, b) => b.speed - a.speed);
      return results[0];
      
    } catch (error) {
      // Fallback to simpler method
      console.log(chalk.yellow('Using fallback download test...'));
      const startTime = Date.now();
      await execAsync(`curl -o /dev/null -s --max-time 60 "${testUrl}"`);
      const endTime = Date.now();
      const elapsed = (endTime - startTime) / 1000;
      const mbps = (expectedSize * 8) / (elapsed * 1024 * 1024);
      
      return {
        speed: Math.round(mbps * 100) / 100,
        bytes: expectedSize,
        elapsed: elapsed
      };
    }
  }

  private async testUploadSpeedImproved(testSize: 'small' | 'medium' | 'large'): Promise<{
    speed: number;
    bytes: number;
    elapsed: number;
  }> {
    const sizeMap = {
      small: 1024 * 1024,      // 1MB
      medium: 5 * 1024 * 1024, // 5MB  
      large: 10 * 1024 * 1024  // 10MB
    };
    
    const dataSize = sizeMap[testSize];
    const tempFile = join(tmpdir(), `speedtest-upload-${Date.now()}.bin`);
    
    try {
      // Create a temporary file with random data
      console.log(chalk.gray('Creating test file...'));
      const testData = Buffer.alloc(dataSize);
      for (let i = 0; i < dataSize; i += 1024) {
        testData.fill(Math.floor(Math.random() * 256), i, Math.min(i + 1024, dataSize));
      }
      writeFileSync(tempFile, testData);
      
      // Test upload to multiple services and take the best result
      const uploadTests = [
        () => this.testUploadToHttpBin(tempFile, dataSize),
        () => this.testUploadToFile(tempFile, dataSize),
        () => this.testUploadToTransferSh(tempFile, dataSize)
      ];
      
      const results = [];
      
      for (const testFn of uploadTests) {
        try {
          const result = await testFn();
          if (result.speed > 0) {
            results.push(result);
            break; // Use first successful result
          }
        } catch (error) {
          // Try next upload method
        }
      }
      
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch (error) {
        // Ignore cleanup errors
      }
      
      if (results.length === 0) {
        return {
          speed: 0,
          bytes: 0,
          elapsed: 0
        };
      }
      
      return results[0];
      
    } catch (error) {
      // Clean up temp file on error
      try {
        unlinkSync(tempFile);
      } catch (error) {
        // Ignore cleanup errors
      }
      
      return {
        speed: 0,
        bytes: 0,
        elapsed: 0
      };
    }
  }

  private async testUploadToHttpBin(filePath: string, dataSize: number): Promise<{
    speed: number;
    bytes: number;
    elapsed: number;
  }> {
    const { stdout } = await execAsync(
      `curl -X POST -F "file=@${filePath}" -s -w "%{time_total},%{size_upload},%{speed_upload}" --max-time 120 https://httpbin.org/post -o /dev/null`,
      { timeout: 130000 }
    );
    
    const [timeTotal, sizeUpload, speedUpload] = stdout.trim().split(',');
    const elapsed = parseFloat(timeTotal);
    const bytes = parseInt(sizeUpload);
    const bytesPerSecond = parseFloat(speedUpload);
    const mbps = (bytesPerSecond * 8) / (1024 * 1024);
    
    return {
      speed: Math.round(mbps * 100) / 100,
      bytes: bytes,
      elapsed: elapsed
    };
  }

  private async testUploadToFile(filePath: string, dataSize: number): Promise<{
    speed: number;
    bytes: number;
    elapsed: number;
  }> {
    const { stdout } = await execAsync(
      `curl -X PUT -T "${filePath}" -s -w "%{time_total},%{size_upload},%{speed_upload}" --max-time 120 https://file.io/ -o /dev/null`,
      { timeout: 130000 }
    );
    
    const [timeTotal, sizeUpload, speedUpload] = stdout.trim().split(',');
    const elapsed = parseFloat(timeTotal);
    const bytes = parseInt(sizeUpload);
    const bytesPerSecond = parseFloat(speedUpload);
    const mbps = (bytesPerSecond * 8) / (1024 * 1024);
    
    return {
      speed: Math.round(mbps * 100) / 100,
      bytes: bytes,
      elapsed: elapsed
    };
  }

  private async testUploadToTransferSh(filePath: string, dataSize: number): Promise<{
    speed: number;
    bytes: number;
    elapsed: number;
  }> {
    const { stdout } = await execAsync(
      `curl -X PUT --upload-file "${filePath}" -s -w "%{time_total},%{size_upload},%{speed_upload}" --max-time 120 https://transfer.sh/speedtest -o /dev/null`,
      { timeout: 130000 }
    );
    
    const [timeTotal, sizeUpload, speedUpload] = stdout.trim().split(',');
    const elapsed = parseFloat(timeTotal);
    const bytes = parseInt(sizeUpload);
    const bytesPerSecond = parseFloat(speedUpload);
    const mbps = (bytesPerSecond * 8) / (1024 * 1024);
    
    return {
      speed: Math.round(mbps * 100) / 100,
      bytes: bytes,
      elapsed: elapsed
    };
  }

  async testLatency(host: string = '8.8.8.8', count: number = 10): Promise<LatencyTest> {
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
        return {
          host,
          min: 0,
          max: 0,
          avg: 0,
          loss: 100,
          jitter: 0,
          times: [],
          timestamp: new Date()
        };
      }
      
      const min = Math.min(...times);
      const max = Math.max(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const loss = ((count - times.length) / count) * 100;
      
      // Calculate jitter (standard deviation)
      const variance = times.reduce((acc, time) => acc + Math.pow(time - avg, 2), 0) / times.length;
      const jitter = Math.sqrt(variance);
      
      return {
        host,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        avg: Math.round(avg * 100) / 100,
        loss: Math.round(loss * 100) / 100,
        jitter: Math.round(jitter * 100) / 100,
        times,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        host,
        min: 0,
        max: 0,
        avg: 0,
        loss: 100,
        jitter: 0,
        times: [],
        timestamp: new Date()
      };
    }
  }

  async runNetworkDiagnostics(): Promise<NetworkDiagnostics> {
    console.log(chalk.blue('🔍 Running comprehensive network diagnostics...'));
    
    const [interfaceInfo, routingInfo, dnsInfo, connectivityInfo, performanceInfo] = await Promise.all([
      this.getInterfaceInfo(),
      this.getRoutingInfo(),
      this.getDNSInfo(),
      this.testConnectivity(),
      this.getPerformanceInfo()
    ]);
    
    return {
      interface: interfaceInfo,
      routing: routingInfo,
      dns: dnsInfo,
      connectivity: connectivityInfo,
      performance: performanceInfo
    };
  }

  private async getInterfaceInfo(): Promise<{
    name: string;
    ip: string;
    mac: string;
    speed?: string;
    duplex?: string;
    mtu: number;
    status: 'up' | 'down';
  }> {
    try {
      const { stdout } = await execAsync('ifconfig en0');
      
      const ipMatch = stdout.match(/inet (\d+\.\d+\.\d+\.\d+)/);
      const macMatch = stdout.match(/ether ([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
      const mtuMatch = stdout.match(/mtu (\d+)/);
      const statusMatch = stdout.match(/status: (\w+)/);
      
      return {
        name: 'en0',
        ip: ipMatch ? ipMatch[1] : 'unknown',
        mac: macMatch ? macMatch[1] : 'unknown',
        mtu: mtuMatch ? parseInt(mtuMatch[1]) : 1500,
        status: statusMatch && statusMatch[1] === 'active' ? 'up' : 'down'
      };
    } catch (error) {
      return {
        name: 'en0',
        ip: 'unknown',
        mac: 'unknown',
        mtu: 1500,
        status: 'down'
      };
    }
  }

  private async getRoutingInfo(): Promise<{
    gateway: string;
    routes: RouteEntry[];
  }> {
    try {
      const { stdout: gatewayOutput } = await execAsync('route -n get default');
      const gatewayMatch = gatewayOutput.match(/gateway: (\d+\.\d+\.\d+\.\d+)/);
      const gateway = gatewayMatch ? gatewayMatch[1] : 'unknown';
      
      const { stdout: routeOutput } = await execAsync('netstat -rn');
      const routes: RouteEntry[] = [];
      
      const lines = routeOutput.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4 && parts[0].match(/^\d+\.\d+\.\d+\.\d+/)) {
          routes.push({
            destination: parts[0],
            gateway: parts[1],
            interface: parts[5] || 'unknown',
            metric: parseInt(parts[4]) || 0
          });
        }
      }
      
      return { gateway, routes: routes.slice(0, 10) }; // Limit to top 10 routes
    } catch (error) {
      return { gateway: 'unknown', routes: [] };
    }
  }

  private async getDNSInfo(): Promise<{
    servers: string[];
    resolution: DNSTest[];
  }> {
    try {
      const { stdout } = await execAsync('cat /etc/resolv.conf');
      const servers: string[] = [];
      
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.startsWith('nameserver')) {
          const server = line.split(/\s+/)[1];
          if (server) servers.push(server);
        }
      }
      
      // Test DNS resolution
      const testDomains = ['google.com', 'cloudflare.com', 'github.com'];
      const resolution: DNSTest[] = [];
      
      for (const domain of testDomains) {
        const startTime = Date.now();
        try {
          const { stdout: nslookupOutput } = await execAsync(`nslookup ${domain}`);
          const endTime = Date.now();
          const ipMatch = nslookupOutput.match(/Address: (\d+\.\d+\.\d+\.\d+)/);
          
          resolution.push({
            domain,
            resolved: true,
            time: endTime - startTime,
            ip: ipMatch ? ipMatch[1] : undefined
          });
        } catch {
          const endTime = Date.now();
          resolution.push({
            domain,
            resolved: false,
            time: endTime - startTime
          });
        }
      }
      
      return { servers, resolution };
    } catch (error) {
      return { servers: [], resolution: [] };
    }
  }

  private async testConnectivity(): Promise<{
    internet: boolean;
    localNetwork: boolean;
    gateway: boolean;
    dns: boolean;
  }> {
    const tests = await Promise.allSettled([
      this.pingTest('8.8.8.8'),    // Internet
      this.pingTest('192.168.1.1'), // Local gateway (common)
      this.pingTest('1.1.1.1'),    // DNS
      execAsync('route -n get default').then(r => r.stdout.match(/gateway: (\d+\.\d+\.\d+\.\d+)/)?.[1]).then(gw => gw ? this.pingTest(gw) : false)
    ]);
    
    return {
      internet: tests[0].status === 'fulfilled' && tests[0].value,
      localNetwork: tests[1].status === 'fulfilled' && tests[1].value,
      dns: tests[2].status === 'fulfilled' && tests[2].value,
      gateway: tests[3].status === 'fulfilled' && tests[3].value
    };
  }

  private async pingTest(host: string): Promise<boolean> {
    try {
      await execAsync(`ping -c 1 -W 2000 ${host}`);
      return true;
    } catch {
      return false;
    }
  }

  private async getPerformanceInfo(): Promise<{
    latency: LatencyTest;
    bandwidth: BandwidthTest;
  }> {
    const latency = await this.testLatency('8.8.8.8', 5);
    
    // Quick bandwidth test using the improved method
    const bandwidth: BandwidthTest = {
      download: 0,
      upload: 0,
      testDuration: 0,
      testSize: 0
    };
    
    try {
      const quickTest = await this.runQuickSpeedTest();
      bandwidth.download = quickTest.download;
      bandwidth.upload = quickTest.upload;
      bandwidth.testDuration = 5; // Estimated
      bandwidth.testSize = 10485760; // 10MB
    } catch (error) {
      // Bandwidth test failed
    }
    
    return { latency, bandwidth };
  }

  async analyzeWiFiHealth(networks: any[], currentNetwork: any): Promise<WifiHealth> {
    console.log(chalk.blue('🏥 Analyzing WiFi health...'));
    
    const signalStrength = currentNetwork?.signal || -99;
    const signalQuality = this.getSignalQuality(signalStrength);
    
    // Test network performance
    const latencyTest = await this.testLatency('8.8.8.8', 5);
    const speedTest = await this.runQuickSpeedTest();
    
    // Analyze congestion
    const channelUtilization = this.analyzeChannelCongestion(networks, currentNetwork?.channel);
    
    // Security analysis
    const securityLevel = this.analyzeSecurityLevel(currentNetwork);
    
    // Generate overall health rating
    const overallHealth = this.calculateOverallHealth({
      signal: signalQuality,
      latency: latencyTest.avg,
      jitter: latencyTest.jitter,
      speed: speedTest.download,
      congestion: channelUtilization,
      security: securityLevel
    });
    
    return {
      overall: overallHealth,
      signal: {
        strength: signalStrength,
        quality: signalQuality,
        stability: latencyTest.jitter < 10 ? 'stable' : 'unstable'
      },
      speed: {
        download: speedTest.download,
        upload: speedTest.upload,
        rating: this.getSpeedRating(speedTest.download)
      },
      latency: {
        ping: latencyTest.avg,
        jitter: latencyTest.jitter,
        rating: this.getLatencyRating(latencyTest.avg)
      },
      congestion: {
        level: channelUtilization > 70 ? 'high' : channelUtilization > 40 ? 'medium' : 'low',
        channelUtilization
      },
      security: {
        level: securityLevel,
        issues: this.getSecurityIssues(currentNetwork)
      },
      recommendations: this.generateHealthRecommendations(overallHealth, {
        signal: signalStrength,
        latency: latencyTest.avg,
        jitter: latencyTest.jitter,
        congestion: channelUtilization,
        security: securityLevel
      })
    };
  }

  async calculateQualityOfService(): Promise<QualityOfService> {
    const latencyTest = await this.testLatency('8.8.8.8', 10);
    const speedTest = await this.runQuickSpeedTest();
    
    const metrics = {
      latency: latencyTest.avg,
      jitter: latencyTest.jitter,
      packetLoss: latencyTest.loss,
      throughput: speedTest.download
    };
    
    const classification = this.classifyQoS(metrics);
    
    return {
      classification,
      metrics,
      applications: {
        video: this.getVideoQuality(metrics),
        voice: this.getVoiceQuality(metrics),
        gaming: this.getGamingQuality(metrics),
        browsing: this.getBrowsingQuality(metrics)
      }
    };
  }

  // Helper methods for quality analysis
  private getSignalQuality(signal: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (signal >= -30) return 'excellent';
    if (signal >= -50) return 'good';
    if (signal >= -70) return 'fair';
    return 'poor';
  }

  private getSpeedRating(speed: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (speed >= 100) return 'excellent';
    if (speed >= 25) return 'good';
    if (speed >= 5) return 'fair';
    return 'poor';
  }

  private getLatencyRating(latency: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (latency <= 20) return 'excellent';
    if (latency <= 50) return 'good';
    if (latency <= 100) return 'fair';
    return 'poor';
  }

  private analyzeChannelCongestion(networks: any[], currentChannel: number): number {
    if (!networks || !currentChannel) return 0;
    
    const sameChannelNetworks = networks.filter(n => n.channel === currentChannel);
    const nearbyChannelNetworks = networks.filter(n => 
      Math.abs(n.channel - currentChannel) <= 2 && n.channel !== currentChannel
    );
    
    return Math.min(100, (sameChannelNetworks.length * 30) + (nearbyChannelNetworks.length * 10));
  }

  private analyzeSecurityLevel(network: any): 'secure' | 'warning' | 'vulnerable' {
    if (!network || !network.security) return 'vulnerable';
    
    const security = network.security.join(' ').toLowerCase();
    
    if (security.includes('wpa3')) return 'secure';
    if (security.includes('wpa2')) return 'secure';
    if (security.includes('wpa')) return 'warning';
    if (security.includes('wep')) return 'vulnerable';
    if (security.includes('open')) return 'vulnerable';
    
    return 'warning';
  }

  private calculateOverallHealth(factors: any): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    let score = 0;
    
    // Signal quality (30% weight)
    if (factors.signal === 'excellent') score += 30;
    else if (factors.signal === 'good') score += 22;
    else if (factors.signal === 'fair') score += 15;
    else score += 5;
    
    // Speed (25% weight)
    if (factors.speed >= 100) score += 25;
    else if (factors.speed >= 25) score += 20;
    else if (factors.speed >= 5) score += 12;
    else score += 3;
    
    // Latency (20% weight)
    if (factors.latency <= 20) score += 20;
    else if (factors.latency <= 50) score += 15;
    else if (factors.latency <= 100) score += 8;
    else score += 2;
    
    // Congestion (15% weight)
    if (factors.congestion <= 30) score += 15;
    else if (factors.congestion <= 60) score += 10;
    else score += 3;
    
    // Security (10% weight)
    if (factors.security === 'secure') score += 10;
    else if (factors.security === 'warning') score += 5;
    else score += 0;
    
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }

  private async runQuickSpeedTest(): Promise<{ download: number; upload: number }> {
    try {
      // Use a reliable quick test with a 10MB file - use Tele2 server (index 2)
      const quickServer = this.speedTestServers[2]; // Tele2 server
      const downloadResult = await this.testDownloadSpeedImproved('small', quickServer);
      const uploadResult = await this.testUploadSpeedImproved('small');
      
      return {
        download: downloadResult.speed,
        upload: uploadResult.speed
      };
    } catch (error) {
      // Fallback with any available server that has download property
      try {
        const fallbackServer = this.speedTestServers.find(s => s.download) || this.speedTestServers[1];
        const downloadResult = await this.testDownloadSpeedImproved('small', fallbackServer);
        return {
          download: downloadResult.speed,
          upload: 0 // Skip upload in fallback
        };
      } catch {
        return { download: 0, upload: 0 };
      }
    }
  }

  private async getPublicIP(): Promise<string> {
    try {
      const { stdout } = await execAsync('curl -s https://api.ipify.org');
      return stdout.trim();
    } catch {
      try {
        const { stdout } = await execAsync('curl -s https://icanhazip.com');
        return stdout.trim();
      } catch {
        return 'unknown';
      }
    }
  }

  private async getISP(): Promise<string> {
    try {
      const { stdout } = await execAsync('curl -s https://ipapi.co/json');
      const data = JSON.parse(stdout);
      return data.org || 'Unknown ISP';
    } catch {
      return 'Unknown ISP';
    }
  }

  private getSecurityIssues(network: any): string[] {
    const issues: string[] = [];
    
    if (!network || !network.security) {
      issues.push('No security information available');
      return issues;
    }
    
    const security = network.security.join(' ').toLowerCase();
    
    if (security.includes('open')) {
      issues.push('Network is open - no encryption');
    }
    if (security.includes('wep')) {
      issues.push('WEP encryption is vulnerable');
    }
    if (security.includes('wpa') && !security.includes('wpa2') && !security.includes('wpa3')) {
      issues.push('Old WPA encryption has vulnerabilities');
    }
    
    return issues;
  }

  private generateHealthRecommendations(health: string, factors: any): string[] {
    const recommendations: string[] = [];
    
    if (factors.signal < -70) {
      recommendations.push('Move closer to the router or consider a WiFi extender');
    }
    
    if (factors.latency > 100) {
      recommendations.push('High latency detected - check for network congestion');
    }
    
    if (factors.jitter > 20) {
      recommendations.push('High jitter detected - may affect video calls and gaming');
    }
    
    if (factors.congestion > 70) {
      recommendations.push('Switch to 5GHz band or less congested channel');
    }
    
    if (factors.security !== 'secure') {
      recommendations.push('Use WPA2 or WPA3 security for better protection');
    }
    
    if (health === 'poor' || health === 'critical') {
      recommendations.push('Consider upgrading your internet plan or router');
    }
    
    return recommendations;
  }

  private classifyQoS(metrics: any): 'excellent' | 'good' | 'fair' | 'poor' | 'unusable' {
    if (metrics.latency <= 20 && metrics.jitter <= 5 && metrics.packetLoss <= 0.1 && metrics.throughput >= 50) {
      return 'excellent';
    }
    if (metrics.latency <= 50 && metrics.jitter <= 10 && metrics.packetLoss <= 1 && metrics.throughput >= 25) {
      return 'good';
    }
    if (metrics.latency <= 100 && metrics.jitter <= 20 && metrics.packetLoss <= 3 && metrics.throughput >= 5) {
      return 'fair';
    }
    if (metrics.latency <= 200 && metrics.jitter <= 50 && metrics.packetLoss <= 5 && metrics.throughput >= 1) {
      return 'poor';
    }
    return 'unusable';
  }

  private getVideoQuality(metrics: any): 'excellent' | 'good' | 'fair' | 'poor' | 'unusable' {
    if (metrics.latency <= 50 && metrics.jitter <= 10 && metrics.throughput >= 25) return 'excellent';
    if (metrics.latency <= 100 && metrics.jitter <= 20 && metrics.throughput >= 10) return 'good';
    if (metrics.latency <= 150 && metrics.jitter <= 30 && metrics.throughput >= 5) return 'fair';
    if (metrics.latency <= 200 && metrics.throughput >= 2) return 'poor';
    return 'unusable';
  }

  private getVoiceQuality(metrics: any): 'excellent' | 'good' | 'fair' | 'poor' | 'unusable' {
    if (metrics.latency <= 20 && metrics.jitter <= 5 && metrics.packetLoss <= 0.1) return 'excellent';
    if (metrics.latency <= 50 && metrics.jitter <= 10 && metrics.packetLoss <= 1) return 'good';
    if (metrics.latency <= 100 && metrics.jitter <= 20 && metrics.packetLoss <= 3) return 'fair';
    if (metrics.latency <= 150 && metrics.packetLoss <= 5) return 'poor';
    return 'unusable';
  }

  private getGamingQuality(metrics: any): 'excellent' | 'good' | 'fair' | 'poor' | 'unusable' {
    if (metrics.latency <= 20 && metrics.jitter <= 5 && metrics.packetLoss <= 0.1) return 'excellent';
    if (metrics.latency <= 40 && metrics.jitter <= 10 && metrics.packetLoss <= 0.5) return 'good';
    if (metrics.latency <= 80 && metrics.jitter <= 15 && metrics.packetLoss <= 1) return 'fair';
    if (metrics.latency <= 120 && metrics.packetLoss <= 2) return 'poor';
    return 'unusable';
  }

  private getBrowsingQuality(metrics: any): 'excellent' | 'good' | 'fair' | 'poor' | 'unusable' {
    if (metrics.throughput >= 25) return 'excellent';
    if (metrics.throughput >= 10) return 'good';
    if (metrics.throughput >= 5) return 'fair';
    if (metrics.throughput >= 1) return 'poor';
    return 'unusable';
  }
} 