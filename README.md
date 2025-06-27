# WiFi Radar 📡

**The Ultimate WiFi Network Analysis & Performance Testing Tool for macOS**

A comprehensive command-line tool that transforms your Mac into a powerful WiFi analyzer, network diagnostics suite, and performance testing platform. WiFi Radar is the godfather of all WiFi analysis tools - from signal strength and device discovery to internet speed testing and quality of service analysis.

## 🚀 Features

### 📊 Network Scanning & Analysis
- **Comprehensive WiFi Scanning**: Detect all nearby networks with detailed technical information
- **Signal Quality Analysis**: Real-time signal strength, noise, SNR, and interference analysis
- **Network Topology Mapping**: Visualize your network structure and device relationships
- **Device Discovery**: Identify and categorize all connected devices on your network

### ⚡ Performance Testing
- **Internet Speed Testing**: Comprehensive download/upload speed, latency, and jitter analysis
- **Latency & Ping Testing**: Advanced network latency testing with jitter calculation
- **Network Diagnostics**: Complete connectivity, DNS, routing, and interface analysis
- **Bandwidth Analysis**: Real-time throughput monitoring and testing

### 🏥 Health & Quality Analysis
- **WiFi Health Scoring**: Overall network health assessment with detailed breakdowns
- **Quality of Service (QoS)**: Application-specific performance analysis for:
  - 📹 Video Streaming
  - 📞 Voice Calls
  - 🎯 Gaming
  - 🌐 Web Browsing

### 🔒 Security Auditing
- **Vulnerability Assessment**: Comprehensive security audit of your network and nearby networks
- **Encryption Analysis**: Detect weak or outdated security protocols
- **Threat Detection**: Identify potential security risks and rogue access points

### 📱 Live Monitoring
- **Real-time Dashboard**: Interactive live monitoring of network performance
- **Anomaly Detection**: Automatic detection of network changes and issues
- **Historical Analysis**: Track network performance over time

## 🎯 Quick Start

### Installation
```bash
npm install -g wifi-radar
```

### Basic Usage
```bash
# Quick network scan
wifi-radar scan

# Comprehensive health analysis
wifi-radar health

# Internet speed test
wifi-radar speed

# Network diagnostics
wifi-radar diagnostics

# Live dashboard
wifi-radar dashboard
```

## 📋 Commands

### Network Analysis
```bash
wifi-radar scan [-v, --verbose]          # Scan for nearby WiFi networks
wifi-radar signal                         # Analyze signal strength and quality
wifi-radar devices                        # Identify connected devices
wifi-radar topology [-i, --interactive]   # Generate network topology map
```

### Performance Testing
```bash
wifi-radar speed [--size small|medium|large]    # Comprehensive speed test
wifi-radar ping [-h host] [-c count]            # Latency and jitter testing
wifi-radar diagnostics                          # Complete network diagnostics
```

### Health & Quality
```bash
wifi-radar health                         # WiFi network health analysis
wifi-radar qos                           # Quality of Service analysis
```

### Security & Monitoring
```bash
wifi-radar security                      # Security audit
wifi-radar dashboard                     # Real-time monitoring dashboard
```

### Help & Information
```bash
wifi-radar help-extended                 # Comprehensive help and examples
wifi-radar --help                       # Basic help
```

## 📈 Example Output

### Network Scan
```
┌────────────────────┬────────────┬──────────┬────────────┬────────────────────┬────────────┐
│ SSID               │ Signal     │ Channel  │ Frequency  │ Security           │ Connected  │
├────────────────────┼────────────┼──────────┼────────────┼────────────────────┼────────────┤
│ MyNetwork_5G       │ -45 dBm    │ 161      │ 5 GHz      │ WPA3 Personal      │ ✓          │
│ NeighborWiFi       │ -67 dBm    │ 6        │ 2.4 GHz    │ WPA2 Personal      │            │
└────────────────────┴────────────┴──────────┴────────────┴────────────────────┴────────────┘
```

### Speed Test Results
```
📊 SPEED TEST RESULTS
──────────────────────────────────────────────────
📥 Download: 85.4 Mbps
📤 Upload:   42.1 Mbps
🏓 Latency:  12 ms
📊 Jitter:   2.1 ms
�� Loss:     0.0%

📈 PERFORMANCE RATING
▰▰▰▰▰ EXCELLENT
```

### WiFi Health Analysis
```
🏥 WIFI HEALTH REPORT
══════════════════════════════════════════════════

📊 OVERALL HEALTH
   Status: EXCELLENT

📶 SIGNAL ANALYSIS
   Strength: -45 dBm (Excellent)
   Quality: EXCELLENT
   Stability: Stable

🚀 SPEED ANALYSIS
   Download: 85.4 Mbps (EXCELLENT)
   Upload: 42.1 Mbps

🏓 LATENCY ANALYSIS
   Ping: 12 ms (EXCELLENT)
   Jitter: 2.1 ms

📊 CONGESTION ANALYSIS
   Level: LOW
   Channel Utilization: 15%

🔒 SECURITY ANALYSIS
   Level: SECURE
```

## 🎮 Quality of Service Analysis

WiFi Radar analyzes your network's suitability for different applications:

```
🎯 QUALITY OF SERVICE ANALYSIS
══════════════════════════════════════════════════

📊 OVERALL CLASSIFICATION
   EXCELLENT

🎮 APPLICATION PERFORMANCE
   📹 Video Streaming: EXCELLENT
   📞 Voice Calls: EXCELLENT
   🎯 Gaming: EXCELLENT
   🌐 Web Browsing: EXCELLENT
```

## 🔍 Network Diagnostics

Complete network troubleshooting and analysis:

```
🔍 NETWORK DIAGNOSTICS REPORT
════════════════════════════════════════════════════════════

🌐 NETWORK INTERFACE
Interface: en0
IP Address: 192.168.1.100
MAC Address: aa:bb:cc:dd:ee:ff
Status: UP

🔗 CONNECTIVITY TESTS
Internet:      ✓ Connected
Gateway:       ✓ Reachable
Local Network: ✓ Connected
DNS:           ✓ Working

🔍 DNS CONFIGURATION
DNS Servers: 8.8.8.8, 1.1.1.1
DNS Resolution Tests:
   google.com: ✓ 15ms → 142.250.194.78
   cloudflare.com: ✓ 12ms → 104.16.133.229
```

## 🛠️ System Requirements

- **macOS**: 10.14 or later
- **Node.js**: 16.0.0 or later
- **Network**: WiFi connection required for most features

## 🔧 Advanced Usage

### Automated Testing
```bash
# Run comprehensive analysis and save to file
wifi-radar health > network-health.txt
wifi-radar diagnostics > network-diagnostics.txt

# Performance monitoring
wifi-radar speed --size large > speed-test-$(date +%Y%m%d).txt
```

### Troubleshooting Network Issues
```bash
# Step 1: Check overall health
wifi-radar health

# Step 2: Run diagnostics if issues found
wifi-radar diagnostics

# Step 3: Test specific connectivity
wifi-radar ping -h 8.8.8.8 -c 20

# Step 4: Check QoS for specific applications
wifi-radar qos
```

## 📊 Key Metrics Explained

- **Signal Strength**: Measured in dBm (-30 to -90 dBm range)
- **SNR (Signal-to-Noise Ratio)**: Higher is better (>25 dB excellent)
- **Jitter**: Network timing variation (lower is better)
- **Channel Utilization**: Network congestion percentage
- **QoS Classifications**: Application-specific performance ratings

## 🎯 Pro Tips

1. **Start with Health Analysis**: Run `wifi-radar health` first for overall status
2. **Use Diagnostics for Troubleshooting**: `wifi-radar diagnostics` helps identify specific issues
3. **Monitor QoS**: Check `wifi-radar qos` to ensure your network supports your applications
4. **Regular Security Audits**: Run `wifi-radar security` periodically
5. **Live Monitoring**: Use `wifi-radar dashboard` for continuous monitoring

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for macOS using native system tools
- Leverages `system_profiler`, `ping`, `arp`, and other network utilities
- Designed for network professionals, developers, and power users

---

**WiFi Radar** - Transform your Mac into the ultimate WiFi analysis powerhouse! 🚀📡