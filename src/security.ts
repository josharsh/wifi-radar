import chalk from 'chalk';
import type { WiFiNetwork, SecurityAudit, SecurityVulnerability } from './types.js';

export class SecurityAuditor {
  async auditNetworks(networks: WiFiNetwork[]): Promise<SecurityAudit[]> {
    const audits: SecurityAudit[] = [];
    
    for (const network of networks) {
      const vulnerabilities = await this.analyzeNetworkSecurity(network);
      const riskLevel = this.calculateRiskLevel(vulnerabilities);
      const recommendations = this.generateRecommendations(network, vulnerabilities);
      
      audits.push({
        network,
        vulnerabilities,
        riskLevel,
        recommendations
      });
    }
    
    return audits.sort((a, b) => this.getRiskScore(b.riskLevel) - this.getRiskScore(a.riskLevel));
  }

  renderSecurityReport(audits: SecurityAudit[]): string {
    const lines: string[] = [];
    
    lines.push(chalk.red.bold('🔒 SECURITY AUDIT REPORT'));
    lines.push(chalk.gray('─'.repeat(50)));
    lines.push('');
    
    // Summary
    const criticalCount = audits.filter(a => a.riskLevel === 'critical').length;
    const highCount = audits.filter(a => a.riskLevel === 'high').length;
    const mediumCount = audits.filter(a => a.riskLevel === 'medium').length;
    const lowCount = audits.filter(a => a.riskLevel === 'low').length;
    
    lines.push(chalk.bold('📊 RISK SUMMARY'));
    lines.push(`${chalk.red('● Critical:')} ${criticalCount}`);
    lines.push(`${chalk.red('● High:')} ${highCount}`);
    lines.push(`${chalk.yellow('● Medium:')} ${mediumCount}`);
    lines.push(`${chalk.green('● Low:')} ${lowCount}`);
    lines.push('');
    
    // Detailed audit results
    audits.forEach((audit, index) => {
      const riskColor = this.getRiskColor(audit.riskLevel);
      lines.push(riskColor.bold(`${index + 1}. ${audit.network.ssid}`));
      lines.push(chalk.gray(`   BSSID: ${audit.network.bssid}`));
      lines.push(riskColor(`   Risk Level: ${audit.riskLevel.toUpperCase()}`));
      
      if (audit.vulnerabilities.length > 0) {
        lines.push(chalk.white('   Vulnerabilities:'));
        audit.vulnerabilities.forEach(vuln => {
          const vulnColor = this.getRiskColor(vuln.severity);
          lines.push(vulnColor(`   • ${vuln.type}: ${vuln.description}`));
        });
      }
      
      if (audit.recommendations.length > 0) {
        lines.push(chalk.blue('   Recommendations:'));
        audit.recommendations.forEach(rec => {
          lines.push(chalk.blue(`   • ${rec}`));
        });
      }
      
      lines.push('');
    });
    
    // Overall security tips
    lines.push(chalk.cyan.bold('💡 GENERAL SECURITY TIPS'));
    lines.push(chalk.cyan('• Use WPA3 encryption when available'));
    lines.push(chalk.cyan('• Avoid connecting to open/unsecured networks'));
    lines.push(chalk.cyan('• Use VPN on public networks'));
    lines.push(chalk.cyan('• Regularly update router firmware'));
    lines.push(chalk.cyan('• Use strong, unique WiFi passwords'));
    lines.push(chalk.cyan('• Enable MAC address randomization'));
    
    return lines.join('\n');
  }

  private async analyzeNetworkSecurity(network: WiFiNetwork): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    
    // Check for open networks
    if (network.security.includes('Open') || network.security.length === 0) {
      vulnerabilities.push({
        type: 'Open Network',
        severity: 'high',
        description: 'Network has no encryption - all traffic is visible',
        fix: 'Enable WPA2/WPA3 encryption with a strong password'
      });
    }
    
    // Check for weak encryption
    if (network.security.includes('WEP')) {
      vulnerabilities.push({
        type: 'Weak Encryption',
        severity: 'critical',
        description: 'WEP encryption is easily cracked',
        fix: 'Upgrade to WPA2 or WPA3 encryption'
      });
    }
    
    // Check for outdated security protocols
    if (network.security.includes('WPA') && !network.security.includes('WPA2') && !network.security.includes('WPA3')) {
      vulnerabilities.push({
        type: 'Outdated Security',
        severity: 'high',
        description: 'Original WPA has known vulnerabilities',
        fix: 'Upgrade to WPA2 or WPA3'
      });
    }
    
    // Check for WPS vulnerabilities
    if (network.security.includes('WPS')) {
      vulnerabilities.push({
        type: 'WPS Vulnerability',
        severity: 'medium',
        description: 'WPS can be vulnerable to PIN attacks',
        fix: 'Disable WPS if not needed'
      });
    }
    
    // Check for weak signal (potential evil twin)
    if (network.signal < -80) {
      vulnerabilities.push({
        type: 'Weak Signal',
        severity: 'low',
        description: 'Very weak signal may indicate spoofed network',
        fix: 'Verify network authenticity before connecting'
      });
    }
    
    // Check for suspicious network names
    if (this.isSuspiciousSSID(network.ssid)) {
      vulnerabilities.push({
        type: 'Suspicious Network',
        severity: 'medium',
        description: 'Network name appears suspicious or generic',
        fix: 'Verify network legitimacy before connecting'
      });
    }
    
    // Check for channel congestion (security through obscurity)
    if (this.isCongestedChannel(network.channel)) {
      vulnerabilities.push({
        type: 'Channel Congestion',
        severity: 'low',
        description: 'High channel congestion may indicate interference',
        fix: 'Consider switching to less congested channels'
      });
    }
    
    return vulnerabilities;
  }

  private calculateRiskLevel(vulnerabilities: SecurityVulnerability[]): 'low' | 'medium' | 'high' | 'critical' {
    if (vulnerabilities.some(v => v.severity === 'critical')) return 'critical';
    if (vulnerabilities.some(v => v.severity === 'high')) return 'high';
    if (vulnerabilities.some(v => v.severity === 'medium')) return 'medium';
    return 'low';
  }

  private generateRecommendations(network: WiFiNetwork, vulnerabilities: SecurityVulnerability[]): string[] {
    const recommendations: string[] = [];
    
    if (vulnerabilities.length === 0) {
      recommendations.push('Network appears secure - no immediate concerns');
      return recommendations;
    }
    
    const fixes = vulnerabilities.map(v => v.fix);
    return [...new Set(fixes)]; // Remove duplicates
  }

  private isSuspiciousSSID(ssid: string): boolean {
    const suspicious = [
      'free wifi', 'public', 'guest', 'open', 'wifi', 'internet',
      'connection', 'network', 'router', 'linksys', 'netgear',
      'dlink', 'tplink', 'default'
    ];
    
    const lower = ssid.toLowerCase();
    return suspicious.some(term => lower.includes(term)) || 
           ssid.length < 3 || 
           /^\w+\d+$/.test(ssid); // Generic patterns like "WiFi123"
  }

  private isCongestedChannel(channel: number): boolean {
    // Channels 1, 6, 11 are most commonly used in 2.4GHz
    // This is a simplified check
    return [1, 6, 11].includes(channel);
  }

  private getRiskScore(riskLevel: string): number {
    const scores = { low: 1, medium: 2, high: 3, critical: 4 };
    return scores[riskLevel as keyof typeof scores] || 0;
  }

  private getRiskColor(riskLevel: string): typeof chalk.red {
    switch (riskLevel) {
      case 'critical': return chalk.red;
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.green;
      default: return chalk.gray;
    }
  }
}