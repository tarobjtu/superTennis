/**
 * Native Ball Detector Service
 *
 * TypeScript interface for the native iOS frame processor plugin.
 * Handles communication between JS and Swift CoreML detection.
 */

import { VisionCameraProxy, Frame } from 'react-native-vision-camera';

// Detection result from native plugin
export interface NativeDetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  timestamp: number;
  frameWidth: number;
  frameHeight: number;
  label: string;
}

// Detection options
export interface DetectionOptions {
  confidence?: number;
  iou?: number;
}

// Initialize the frame processor plugin
const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectTennisBall', {});

/**
 * Detect tennis ball in a camera frame
 *
 * This function is called from within a Frame Processor worklet.
 * It runs synchronously on the camera thread for minimal latency.
 *
 * @param frame - Camera frame to process
 * @param options - Detection options (confidence threshold, IOU)
 * @returns Detection result or null if no ball detected
 */
export function detectTennisBall(
  frame: Frame,
  options: DetectionOptions = {}
): NativeDetectionResult | null {
  'worklet';

  if (!plugin) {
    // Plugin not available (running in Expo Go or plugin not registered)
    return null;
  }

  const result = plugin.call(frame, {
    confidence: options.confidence ?? 0.5,
    iou: options.iou ?? 0.45,
  });

  return result as NativeDetectionResult | null;
}

/**
 * Check if native detection is available
 *
 * Returns false when running in Expo Go (no native code support)
 * or if the plugin failed to register.
 */
export function isNativeDetectionAvailable(): boolean {
  return plugin !== null && plugin !== undefined;
}

/**
 * Get detection plugin info
 */
export function getPluginInfo(): { available: boolean; name: string } {
  return {
    available: isNativeDetectionAvailable(),
    name: 'detectTennisBall',
  };
}
