// Direktverbindung zwischen zwei Handys im selben WLAN oder Hotspot.
//
// Es gibt keinen Server, der vermittelt. Deshalb tauschen die Geräte ihre
// Verbindungsdaten einmalig per QR-Code aus: Gastgeber zeigt, Gast scannt,
// Gast zeigt zurück, Gastgeber scannt. Danach läuft alles direkt.
//
// Damit ein Code auf ein Handydisplay passt, wird die Beschreibung auf das
// Nötigste eingedampft und auf der Gegenseite aus einer Vorlage neu gebaut.

const CODE_MARKE = 'ST1';

/* ------------------------------------------------- Verbindungsdaten packen */

function hexZuBase64(hex) {
  const bytes = hex.split(':').map((h) => parseInt(h, 16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ZuHex(b64) {
  const roh = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Array.from(roh, (c) => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/** Aus einer vollständigen Beschreibung einen kurzen, scanbaren Code machen. */
export function alsCode(sdp, rolle) {
  const hole = (muster) => (sdp.match(muster) || [])[1] || '';
  const ufrag = hole(/^a=ice-ufrag:(.+)$/m);
  const pwd = hole(/^a=ice-pwd:(.+)$/m);
  const fingerabdruck = hole(/^a=fingerprint:sha-256 (.+)$/m).trim();

  const kandidaten = [];
  for (const zeile of sdp.split(/\r?\n/)) {
    const t = zeile.match(/^a=candidate:\S+ \d+ (udp|UDP) \d+ (\S+) (\d+) typ (host|srflx)/);
    if (t && !kandidaten.some((k) => k === `${t[2]},${t[3]}`)) kandidaten.push(`${t[2]},${t[3]}`);
  }

  return [CODE_MARKE + rolle, ufrag, pwd, hexZuBase64(fingerabdruck), ...kandidaten].join('|');
}

/** Kurzcode wieder zu einer vollständigen Beschreibung aufblasen. */
export function ausCode(code) {
  const teile = String(code).trim().split('|');
  const kopf = teile[0] || '';
  if (!kopf.startsWith(CODE_MARKE)) throw new Error('Das ist kein Sky-Team-Verbindungscode.');
  const rolle = kopf.slice(CODE_MARKE.length);
  if (rolle !== 'O' && rolle !== 'A') throw new Error('Der Verbindungscode ist unvollständig.');

  const [, ufrag, pwd, fingerBase64, ...kandidaten] = teile;
  if (!ufrag || !pwd || !fingerBase64) throw new Error('Der Verbindungscode ist unvollständig.');

  const sdp = [
    'v=0',
    'o=- 1 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${base64ZuHex(fingerBase64)}`,
    `a=setup:${rolle === 'O' ? 'actpass' : 'active'}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    '',
  ].join('\r\n');

  return {
    typ: rolle === 'O' ? 'offer' : 'answer',
    sdp,
    kandidaten: kandidaten.filter(Boolean).map((k) => {
      const [adresse, port] = k.split(',');
      return {
        candidate: `candidate:1 1 udp 2130706431 ${adresse} ${port} typ host generation 0 ufrag ${ufrag}`,
        sdpMid: '0',
        sdpMLineIndex: 0,
      };
    }),
  };
}

/* -------------------------------------------------------- Kamera-Freigabe */

// Chrome verrät die echte WLAN-Adresse eines Handys nicht einfach so: statt
// 192.168.x.y steht in den Verbindungsdaten ein zufälliger „….local"-Name
// (mDNS). Die Gegenseite müsste diesen Namen per Multicast auflösen — und
// genau das lassen Handy-Hotspots meistens nicht durch. Hat die Seite aber
// einmal die Erlaubnis für die Kamera, gibt Chrome die echte Adresse heraus.
// Also holen wir die Erlaubnis, *bevor* die Verbindung entsteht; die Kamera
// geht sofort wieder aus. Zum Scannen brauchen wir sie ohnehin gleich.
export async function kameraFreigeben() {
  try {
    const strom = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
    strom.getTracks().forEach((spur) => spur.stop());
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- Verbindung */

/**
 * Baut die Verbindung auf. `aufZustand(text, verbunden)` meldet Fortschritt,
 * `aufNachricht(objekt)` liefert eingehende Daten.
 */
export function funkAufbauen({ gastgeber, aufZustand, aufNachricht }) {
  const pc = new RTCPeerConnection({ iceServers: [] });
  let kanal = null;
  let offen = false;
  const lage = { eigene: [], fremde: 0, mdns: false, stand: 'neu', sammeln: 'läuft' };

  const melde = (text) => aufZustand?.(text, offen);

  const kanalVerdrahten = (k) => {
    kanal = k;
    k.onopen = () => { offen = true; aufZustand?.('verbunden', true); };
    k.onclose = () => { offen = false; aufZustand?.('getrennt', false); };
    k.onmessage = (e) => {
      try { aufNachricht?.(JSON.parse(e.data)); } catch { /* kaputte Nachricht */ }
    };
  };

  if (gastgeber) kanalVerdrahten(pc.createDataChannel('skyteam', { ordered: true }));
  else pc.ondatachannel = (e) => kanalVerdrahten(e.channel);

  // Mitschreiben, was das Handy findet — sonst steht man bei „Verbinde …" im Dunkeln.
  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    const roh = e.candidate.candidate;
    if (/\.local\b/.test(roh)) { lage.mdns = true; return; }
    const t = roh.match(/ (\S+) (\d+) typ (?:host|srflx)/);
    if (t && !lage.eigene.includes(`${t[1]}:${t[2]}`)) lage.eigene.push(`${t[1]}:${t[2]}`);
  };

  pc.oniceconnectionstatechange = () => {
    lage.stand = pc.iceConnectionState;
    if (['failed', 'disconnected'].includes(pc.iceConnectionState) && !offen) {
      melde(lage.mdns && !lage.eigene.length
        ? 'Keine Verbindung — dieses Handy hat seine WLAN-Adresse nicht herausgegeben.'
        : 'Keine Verbindung — blockiert euer Hotspot vielleicht den direkten Weg?');
    }
  };

  /** Wartet, bis alle lokalen Adressen gesammelt sind (oder die Geduld endet). */
  const adressenSammeln = () => new Promise((fertig) => {
    if (pc.iceGatheringState === 'complete') { lage.sammeln = 'fertig'; return fertig(); }
    const stopp = setTimeout(() => { lage.sammeln = 'fertig'; fertig(); }, 6000);
    pc.onicegatheringstatechange = () => {
      lage.sammeln = pc.iceGatheringState === 'complete' ? 'fertig' : pc.iceGatheringState;
      if (pc.iceGatheringState === 'complete') { clearTimeout(stopp); fertig(); }
    };
    return undefined;
  });

  return {
    /** Gastgeber: eigenen Code erzeugen. Gast: erst nach codeLesen aufrufen. */
    async eigenerCode() {
      const beschreibung = gastgeber ? await pc.createOffer() : await pc.createAnswer();
      await pc.setLocalDescription(beschreibung);
      await adressenSammeln();
      return alsCode(pc.localDescription.sdp, gastgeber ? 'O' : 'A');
    },

    async codeLesen(code) {
      const { typ, sdp, kandidaten } = ausCode(code);
      if (gastgeber && typ !== 'answer') throw new Error('Das ist der Code des Gastgebers — du brauchst den vom Gast.');
      if (!gastgeber && typ !== 'offer') throw new Error('Das ist der Code des Gasts — du brauchst den vom Gastgeber.');
      await pc.setRemoteDescription({ type: typ, sdp });
      for (const k of kandidaten) {
        try { await pc.addIceCandidate(k); lage.fremde += 1; } catch { /* einzelne Adresse taugt nicht */ }
      }
      melde('verbinde …');
    },

    senden(objekt) {
      if (kanal && kanal.readyState === 'open') {
        kanal.send(JSON.stringify(objekt));
        return true;
      }
      return false;
    },

    get verbunden() { return offen; },

    /** Momentaufnahme für die Fehlersuche — reine Lesekopie. */
    get lage() { return { ...lage, eigene: lage.eigene.slice() }; },

    schliessen() {
      try { kanal?.close(); } catch { /* egal */ }
      try { pc.close(); } catch { /* egal */ }
    },
  };
}

/* ---------------------------------------------------------------- Scanner */

export const scannerMoeglich = () => typeof window !== 'undefined'
  && 'BarcodeDetector' in window
  && !!navigator.mediaDevices?.getUserMedia;

/**
 * Startet die Kamera und meldet den ersten gefundenen QR-Code.
 * Gibt eine Funktion zum Abschalten zurück.
 */
export async function scannerStarten(videoElement, aufTreffer, aufFehler) {
  if (!scannerMoeglich()) {
    aufFehler?.(new Error('Dieser Browser kann keine QR-Codes lesen — nimm den Textcode.'));
    return () => {};
  }
  let laeuft = true;
  let strom = null;

  try {
    strom = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
  } catch (fehler) {
    aufFehler?.(new Error('Kein Zugriff auf die Kamera. Erlaube ihn oder nimm den Textcode.'));
    return () => {};
  }

  videoElement.srcObject = strom;
  videoElement.setAttribute('playsinline', '');
  await videoElement.play().catch(() => {});

  const sucher = new window.BarcodeDetector({ formats: ['qr_code'] });
  const schauen = async () => {
    if (!laeuft) return;
    try {
      const treffer = await sucher.detect(videoElement);
      const code = treffer.find((t) => String(t.rawValue).startsWith(CODE_MARKE));
      if (code) { laeuft = false; aufTreffer(code.rawValue); return stoppen(); }
    } catch { /* einzelner Fehlversuch ist egal */ }
    setTimeout(schauen, 220);
    return undefined;
  };

  const stoppen = () => {
    laeuft = false;
    strom?.getTracks().forEach((t) => t.stop());
    videoElement.srcObject = null;
  };

  schauen();
  return stoppen;
}
