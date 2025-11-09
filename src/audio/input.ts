export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export async function enumerateAudioDevices(): Promise<AudioDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        kind: device.kind,
      }));
  } catch (error) {
    console.error('Error enumerating audio devices:', error);
    return [];
  }
}

export async function getAudioStream(deviceId?: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId 
      ? { 
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      : { 
          echoCancellation: false, 
          noiseSuppression: false, 
          autoGainControl: false 
        }
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    console.error('Error getting audio stream:', error);
    throw error;
  }
}

export async function requestAudioPermission(): Promise<boolean> {
  try {
    const stream = await getAudioStream();
    // Stop the stream immediately after permission check
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Audio permission denied:', error);
    return false;
  }
}

export function stopAudioStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}