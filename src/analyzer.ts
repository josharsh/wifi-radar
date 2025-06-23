import chalk from 'chalk';
import type { WiFiNetwork, SignalAnalysis, SignalReading, SignalPrediction } from './types.js';

export class SignalAnalyzer {
  private signalHistory = new Map<string, SignalReading[]>();

  async analyzeSignal(networks: WiFiNetwork[]): Promise<SignalAnalysis[]> {
    const analyses: SignalAnalysis[] = [];
    
    for (const network of networks) {
      const history = this.getSignalHistory(network.bssid);
      const currentReading: SignalReading = {
        timestamp: new Date(),
        signal: network.signal,
        noise: network.noise,
        snr: network.signal - network.noise,
        channel: network.channel,
        interference: this.estimateInterference(network)
      };
      
      // Add current reading to history
      history.push(currentReading);
      if (history.length > 100) history.shift(); // Keep last 100 readings
      this.signalHistory.set(network.bssid, history);
      
      const prediction = this.predictSignalStrength(history);
      const recommendations = this.generateSignalRecommendations(network, history);
      
      analyses.push({
        network,
        history,
        prediction,
        recommendations
      });
    }
    
    return analyses.sort((a, b) => b.network.signal - a.network.signal);
  }

  renderSignalAnalysis(analyses: SignalAnalysis[]): string {
    const lines: string[] = [];
    
    lines.push(chalk.blue.bold('📊 SIGNAL ANALYSIS REPORT'));
    lines.push(chalk.gray('─'.repeat(50)));
    lines.push('');
    
    if (analyses.length === 0) {
      lines.push(chalk.yellow('No networks available for analysis'));
      return lines.join('\n');
    }
    
    // Current connected network first
    const connectedAnalysis = analyses.find(a => a.network.isConnected);
    if (connectedAnalysis) {
      lines.push(chalk.green.bold('🔗 CONNECTED NETWORK'));
      lines.push(this.renderNetworkAnalysis(connectedAnalysis));
      lines.push('');
    }
    
    // Other networks
    const otherAnalyses = analyses.filter(a => !a.network.isConnected).slice(0, 5);
    if (otherAnalyses.length > 0) {
      lines.push(chalk.cyan.bold('📶 NEARBY NETWORKS'));
      lines.push('');
      
      otherAnalyses.forEach(analysis => {
        lines.push(this.renderNetworkAnalysis(analysis));
        lines.push('');
      });
    }
    
    // Channel utilization
    lines.push(chalk.magenta.bold('📡 CHANNEL UTILIZATION'));
    lines.push(this.renderChannelAnalysis(analyses));
    
    return lines.join('\n');
  }

  private renderNetworkAnalysis(analysis: SignalAnalysis): string {
    const { network, history, prediction, recommendations } = analysis;
    const lines: string[] = [];
    
    // Network header
    const signalBars = this.getSignalBars(network.signal);
    lines.push(`${signalBars} ${chalk.white.bold(network.ssid)}`);
    
    // Signal metrics
    const snr = network.signal - network.noise;
    const signalQuality = this.getSignalQuality(network.signal);
    const snrQuality = this.getSNRQuality(snr);
    
    lines.push(chalk.gray(`   BSSID: ${network.bssid}`));
    lines.push(chalk.gray(`   Channel: ${network.channel} (${this.getFrequencyBand(network.frequency)})`));
    lines.push(`   Signal: ${this.formatSignal(network.signal)} ${signalQuality}`);
    lines.push(`   Noise: ${network.noise} dBm`);
    lines.push(`   SNR: ${snr} dB ${snrQuality}`);
    
    // Signal trend
    if (history.length > 1) {
      const trend = this.getSignalTrend(history);
      lines.push(`   Trend: ${trend}`);
    }
    
    // Prediction
    if (prediction.confidence > 0.5) {
      const predictionColor = prediction.nextHour >= network.signal ? chalk.green : chalk.red;
      lines.push(`   Prediction: ${predictionColor(`${prediction.nextHour} dBm`)} (confidence: ${Math.round(prediction.confidence * 100)}%)`);
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      lines.push(chalk.yellow('   Recommendations:'));
      recommendations.forEach(rec => {
        lines.push(chalk.yellow(`   • ${rec}`));
      });
    }
    
    return lines.join('\n');
  }

  private renderChannelAnalysis(analyses: SignalAnalysis[]): string {
    const lines: string[] = [];
    
    // Group by channel
    const channelMap = new Map<number, SignalAnalysis[]>();
    analyses.forEach(analysis => {
      const channel = analysis.network.channel;
      if (!channelMap.has(channel)) {
        channelMap.set(channel, []);
      }
      channelMap.get(channel)!.push(analysis);
    });
    
    // Sort channels by congestion
    const sortedChannels = Array.from(channelMap.entries())
      .sort(([, a], [, b]) => b.length - a.length);
    
    sortedChannels.forEach(([channel, networks]) => {
      const band = networks[0].network.frequency < 3000 ? '2.4GHz' : '5GHz';
      const congestionLevel = this.getCongestionLevel(networks.length);
      const congestionColor = this.getCongestionColor(networks.length);
      
      lines.push(congestionColor(`   Channel ${channel} (${band}): ${networks.length} networks ${congestionLevel}`));
      
      // Show strongest networks on each channel
      const topNetworks = networks
        .sort((a, b) => b.network.signal - a.network.signal)
        .slice(0, 3);
      
      topNetworks.forEach(analysis => {
        const bars = this.getSignalBars(analysis.network.signal);
        lines.push(chalk.gray(`     ${bars} ${analysis.network.ssid}`));
      });
    });
    
    return lines.join('\n');
  }

  private getSignalHistory(bssid: string): SignalReading[] {
    return this.signalHistory.get(bssid) || [];
  }

  private predictSignalStrength(history: SignalReading[]): SignalPrediction {
    if (history.length < 3) {
      return {
        nextHour: history[history.length - 1]?.signal || 0,
        confidence: 0,
        factors: ['Insufficient data for prediction']
      };
    }
    
    // Simple linear regression for prediction
    const recent = history.slice(-10); // Last 10 readings
    const avgSignal = recent.reduce((sum, r) => sum + r.signal, 0) / recent.length;
    const trend = recent.length > 1 ? 
      (recent[recent.length - 1].signal - recent[0].signal) / (recent.length - 1) : 0;
    
    const prediction = avgSignal + (trend * 60); // Predict 1 hour ahead
    const confidence = Math.max(0, Math.min(1, 1 - Math.abs(trend) / 10)); // Lower confidence for high volatility
    
    const factors = [];
    if (Math.abs(trend) > 2) factors.push('Signal volatility detected');
    if (recent.some(r => r.interference > 50)) factors.push('High interference detected');
    if (recent.every(r => r.snr < 10)) factors.push('Poor signal-to-noise ratio');
    
    return {
      nextHour: Math.round(prediction),
      confidence,
      factors
    };
  }

  private generateSignalRecommendations(network: WiFiNetwork, history: SignalReading[]): string[] {
    const recommendations: string[] = [];
    const snr = network.signal - network.noise;
    
    if (network.signal < -70) {
      recommendations.push('Move closer to the router for better signal');
    }
    
    if (snr < 10) {
      recommendations.push('High noise environment - consider changing location');
    }
    
    if (network.channel <= 14 && this.isCongestedChannel(network.channel)) {
      recommendations.push('Switch to 5GHz band if available for better performance');
    }
    
    if (history.length > 5) {
      const recentInterference = history.slice(-5).reduce((sum, r) => sum + r.interference, 0) / 5;
      if (recentInterference > 30) {
        recommendations.push('High interference detected - check for other devices');
      }
    }
    
    const trend = this.getSignalTrendValue(history);
    if (trend < -5) {
      recommendations.push('Signal is declining - check router/device positioning');
    }
    
    return recommendations;
  }

  private estimateInterference(network: WiFiNetwork): number {
    // Simplified interference estimation based on channel and signal characteristics
    let interference = 0;
    
    // 2.4GHz band is generally more congested
    if (network.frequency < 3000) {
      interference += 20;
    }
    
    // Overlapping channels in 2.4GHz
    if ([2, 3, 4, 5, 7, 8, 9, 10, 12, 13].includes(network.channel)) {
      interference += 15;
    }
    
    // Poor SNR indicates interference
    const snr = network.signal - network.noise;
    if (snr < 10) {
      interference += 30;
    }
    
    return Math.min(100, interference);
  }

  private getSignalBars(signal: number): string {
    if (signal >= -30) return chalk.green('▰▰▰▰▰');
    if (signal >= -50) return chalk.green('▰▰▰▰▱');
    if (signal >= -60) return chalk.yellow('▰▰▰▱▱');
    if (signal >= -70) return chalk.yellow('▰▰▱▱▱');
    if (signal >= -80) return chalk.red('▰▱▱▱▱');
    return chalk.red('▱▱▱▱▱');
  }

  private getSignalQuality(signal: number): string {
    if (signal >= -30) return chalk.green('(Excellent)');
    if (signal >= -50) return chalk.green('(Very Good)');
    if (signal >= -60) return chalk.yellow('(Good)');
    if (signal >= -70) return chalk.yellow('(Fair)');
    if (signal >= -80) return chalk.red('(Poor)');
    return chalk.red('(Very Poor)');
  }

  private getSNRQuality(snr: number): string {
    if (snr >= 40) return chalk.green('(Excellent)');
    if (snr >= 25) return chalk.green('(Very Good)');
    if (snr >= 15) return chalk.yellow('(Good)');
    if (snr >= 10) return chalk.yellow('(Fair)');
    return chalk.red('(Poor)');
  }

  private getSignalTrend(history: SignalReading[]): string {
    const trend = this.getSignalTrendValue(history);
    
    if (trend > 2) return chalk.green('↗ Improving');
    if (trend < -2) return chalk.red('↘ Declining');
    return chalk.yellow('→ Stable');
  }

  private getSignalTrendValue(history: SignalReading[]): number {
    if (history.length < 2) return 0;
    
    const recent = history.slice(-5);
    if (recent.length < 2) return 0;
    
    return (recent[recent.length - 1].signal - recent[0].signal) / (recent.length - 1);
  }

  private formatSignal(signal: number): string {
    const color = signal >= -50 ? chalk.green : 
                  signal >= -70 ? chalk.yellow : chalk.red;
    return color(`${signal} dBm`);
  }

  private getFrequencyBand(frequency: number): string {
    if (frequency >= 2400 && frequency <= 2500) return '2.4 GHz';
    if (frequency >= 5000 && frequency <= 6000) return '5 GHz';
    return 'Unknown';
  }

  private isCongestedChannel(channel: number): boolean {
    return [1, 6, 11].includes(channel); // Most common 2.4GHz channels
  }

  private getCongestionLevel(networkCount: number): string {
    if (networkCount >= 5) return '(High Congestion)';
    if (networkCount >= 3) return '(Medium Congestion)';
    if (networkCount >= 2) return '(Low Congestion)';
    return '(Clear)';
  }

  private getCongestionColor(networkCount: number): typeof chalk.red {
    if (networkCount >= 5) return chalk.red;
    if (networkCount >= 3) return chalk.yellow;
    return chalk.green;
  }
}