/**
 * Production-ready WebRTC ICE configuration with enterprise-grade STUN & TURN servers.
 *
 * Why this is necessary:
 * STUN alone only resolves public IPs for Full-Cone / Restricted NATs on symmetric or benign networks (like same WiFi).
 * When participants are on DIFFERENT WiFi networks, mobile data (4G/5G Carrier-Grade NAT / CGNAT),
 * corporate firewalls, or home routers with Symmetric NAT, direct peer-to-peer UDP punch will fail.
 *
 * TURN (Traversal Using Relays around NAT) relays encrypted SRTP media packets through
 * reliable relay servers whenever direct P2P holes cannot be punched.
 *
 * We include multiple redundant global STUN providers (Google, Cloudflare, Matrix) and
 * open public TURN relays (OpenRelay / Metered), with support for custom TURN credentials
 * configured via environment variables (VITE_TURN_SERVER, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL).
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Built-in resilient STUN and TURN server list
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    // 1. Google Global STUN Clusters (Low latency, high availability)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    // 2. Redundant STUN providers (Cloudflare, Matrix, Twilio public stun)
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.matrix.org:3478' },

    // 3. OpenRelay Public TURN / TURNS Relays (Relays media across different WiFis and mobile carriers)
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelay',
      credential: 'openrelay',
    },
  ];

  // 4. Custom TURN server support via Vite environment variables
  if (typeof window !== 'undefined') {
    try {
      const customTurnUrl = (import.meta as any).env?.VITE_TURN_SERVER;
      const customTurnUser = (import.meta as any).env?.VITE_TURN_USERNAME;
      const customTurnCred = (import.meta as any).env?.VITE_TURN_CREDENTIAL;

      if (customTurnUrl) {
        servers.unshift({
          urls: customTurnUrl.includes(',') ? customTurnUrl.split(',').map((u: string) => u.trim()) : customTurnUrl,
          ...(customTurnUser ? { username: customTurnUser } : {}),
          ...(customTurnCred ? { credential: customTurnCred } : {}),
        });
      }
    } catch (e) {
      // ignore
    }
  }

  return servers;
}

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};
