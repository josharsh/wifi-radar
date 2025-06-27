export interface WiFiNetwork {
  ssid: string;
  bssid: string;
  channel: number;
  frequency: number;
  signal: number;
  noise: number;
  security: string[];
  phyMode: string;
  networkType: string;
  countryCode: string;
  vendor?: string;
  encryption?: string;
  lastSeen: Date;
  isConnected: boolean;
}

export interface ConnectedDevice {
  mac: string;
  ip?: string;
  hostname?: string;
  vendor?: string;
  deviceType?: 'phone' | 'laptop' | 'tablet' | 'iot' | 'unknown';
  os?: string;
  lastSeen: Date;
  signal?: number;
  isActive: boolean;
}

export interface NetworkTopology {
  router: {
    mac: string;
    ip: string;
    vendor?: string;
    model?: string;
  };
  devices: ConnectedDevice[];
  networks: WiFiNetwork[];
  relationships: NetworkRelationship[];
}

export interface NetworkRelationship {
  from: string; // MAC address
  to: string;   // MAC address
  type: 'connected' | 'nearby' | 'roaming';
  strength: number;
}

export interface SignalAnalysis {
  network: WiFiNetwork;
  history: SignalReading[];
  prediction: SignalPrediction;
  recommendations: string[];
}

export interface SignalReading {
  timestamp: Date;
  signal: number;
  noise: number;
  snr: number;
  channel: number;
  interference: number;
}

export interface SignalPrediction {
  nextHour: number;
  confidence: number;
  factors: string[];
}

export interface SecurityAudit {
  network: WiFiNetwork;
  vulnerabilities: SecurityVulnerability[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  fix: string;
}

export interface AnomalyDetection {
  type: 'new_device' | 'unusual_traffic' | 'signal_anomaly' | 'security_event';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  timestamp: Date;
  affected: string; // MAC or SSID
  data: any;
}

export interface RadarConfig {
  scanInterval: number;
  historySize: number;
  enablePrediction: boolean;
  enableAnomaly: boolean;
  debugMode: boolean;
  alertThreshold: number;
}

// New comprehensive networking types
export interface SpeedTestResult {
  download: {
    speed: number; // Mbps
    bytes: number;
    elapsed: number; // seconds
  };
  upload: {
    speed: number; // Mbps
    bytes: number;
    elapsed: number; // seconds
  };
  ping: {
    latency: number; // ms
    jitter: number; // ms
    packetLoss: number; // percentage
  };
  server: {
    name: string;
    location: string;
    distance: number; // km
  };
  timestamp: Date;
  isp: string;
  publicIP: string;
}

export interface LatencyTest {
  host: string;
  min: number;
  max: number;
  avg: number;
  loss: number;
  jitter: number;
  times: number[];
  timestamp: Date;
}

export interface NetworkDiagnostics {
  interface: {
    name: string;
    ip: string;
    mac: string;
    speed?: string;
    duplex?: string;
    mtu: number;
    status: 'up' | 'down';
  };
  routing: {
    gateway: string;
    routes: RouteEntry[];
  };
  dns: {
    servers: string[];
    resolution: DNSTest[];
  };
  connectivity: {
    internet: boolean;
    localNetwork: boolean;
    gateway: boolean;
    dns: boolean;
  };
  performance: {
    latency: LatencyTest;
    bandwidth: BandwidthTest;
  };
}

export interface RouteEntry {
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
}

export interface DNSTest {
  domain: string;
  resolved: boolean;
  time: number;
  ip?: string;
}

export interface BandwidthTest {
  download: number; // Mbps
  upload: number; // Mbps
  testDuration: number; // seconds
  testSize: number; // bytes
}

export interface TrafficAnalysis {
  totalBytes: {
    sent: number;
    received: number;
  };
  packets: {
    sent: number;
    received: number;
    errors: number;
    dropped: number;
  };
  connections: {
    active: number;
    established: number;
    listening: number;
  };
  protocols: {
    tcp: number;
    udp: number;
    icmp: number;
  };
  topHosts: Array<{
    ip: string;
    hostname?: string;
    bytes: number;
    connections: number;
  }>;
}

export interface WifiHealth {
  overall: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  signal: {
    strength: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    stability: 'stable' | 'unstable';
  };
  speed: {
    download: number;
    upload: number;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
  };
  latency: {
    ping: number;
    jitter: number;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
  };
  congestion: {
    level: 'low' | 'medium' | 'high';
    channelUtilization: number;
  };
  security: {
    level: 'secure' | 'warning' | 'vulnerable';
    issues: string[];
  };
  recommendations: string[];
}

export interface NetworkEvent {
  type: 'connection' | 'disconnection' | 'device_joined' | 'device_left' | 'security_alert' | 'performance_issue';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
}

export interface QualityOfService {
  classification: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
  metrics: {
    latency: number;
    jitter: number;
    packetLoss: number;
    throughput: number;
  };
  applications: {
    video: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
    voice: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
    gaming: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
    browsing: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
  };
}