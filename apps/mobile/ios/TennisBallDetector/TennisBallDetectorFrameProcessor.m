/**
 * Tennis Ball Detector Frame Processor Registration
 *
 * Registers the Swift frame processor plugin with VisionCamera.
 */

#import <Foundation/Foundation.h>
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

// Forward declaration of Swift class
@interface TennisBallDetectorFrameProcessor : FrameProcessorPlugin
@end

// Register the plugin
VISION_EXPORT_FRAME_PROCESSOR(TennisBallDetectorFrameProcessor, detectTennisBall)
