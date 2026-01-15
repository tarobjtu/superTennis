/**
 * Tennis Ball Detector Frame Processor
 *
 * VisionCamera Frame Processor plugin for detecting tennis balls
 * using CoreML YOLOv8 model with Neural Engine acceleration.
 */

import Foundation
import Vision
import CoreML
import VisionCamera

@objc(TennisBallDetectorFrameProcessor)
public class TennisBallDetectorFrameProcessor: FrameProcessorPlugin {

    // MARK: - Properties

    private var model: VNCoreMLModel?
    private var lastDetectionTime: CFAbsoluteTime = 0
    private let minDetectionInterval: CFAbsoluteTime = 0.016 // ~60fps max

    // Detection configuration
    private var confidenceThreshold: Float = 0.5
    private var iouThreshold: Float = 0.45

    // Sports ball class index in COCO dataset
    private let sportsBallClassIndex = 32

    // MARK: - Initialization

    public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
        super.init(proxy: proxy, options: options)
        loadModel()
    }

    private func loadModel() {
        // Try to load custom tennis ball model first
        if let customModel = loadCustomModel(named: "tennis_ball_detector") {
            self.model = customModel
            print("[TennisBallDetector] Custom model loaded successfully")
            return
        }

        // Fall back to YOLOv8n pretrained model
        if let yoloModel = loadCustomModel(named: "yolov8n") {
            self.model = yoloModel
            print("[TennisBallDetector] YOLOv8n pretrained model loaded")
            return
        }

        print("[TennisBallDetector] Warning: No ML model found, detection disabled")
    }

    private func loadCustomModel(named name: String) -> VNCoreMLModel? {
        // Try .mlmodelc (compiled) first
        if let modelURL = Bundle.main.url(forResource: name, withExtension: "mlmodelc") {
            do {
                let mlModel = try MLModel(contentsOf: modelURL)
                return try VNCoreMLModel(for: mlModel)
            } catch {
                print("[TennisBallDetector] Failed to load \(name).mlmodelc: \(error)")
            }
        }

        // Try .mlpackage
        if let modelURL = Bundle.main.url(forResource: name, withExtension: "mlpackage") {
            do {
                let compiledURL = try MLModel.compileModel(at: modelURL)
                let mlModel = try MLModel(contentsOf: compiledURL)
                return try VNCoreMLModel(for: mlModel)
            } catch {
                print("[TennisBallDetector] Failed to load \(name).mlpackage: \(error)")
            }
        }

        return nil
    }

    // MARK: - Frame Processing

    public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
        // Rate limiting
        let currentTime = CFAbsoluteTimeGetCurrent()
        guard currentTime - lastDetectionTime >= minDetectionInterval else {
            return nil
        }
        lastDetectionTime = currentTime

        // Check if model is loaded
        guard let model = self.model else {
            return nil
        }

        // Parse arguments
        if let args = arguments {
            if let confidence = args["confidence"] as? NSNumber {
                self.confidenceThreshold = confidence.floatValue
            }
            if let iou = args["iou"] as? NSNumber {
                self.iouThreshold = iou.floatValue
            }
        }

        // Get pixel buffer from frame
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer) else {
            return nil
        }

        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)

        // Create Vision request
        let request = VNCoreMLRequest(model: model) { [weak self] request, error in
            // Results are processed synchronously below
        }

        // Configure request
        request.imageCropAndScaleOption = .scaleFill

        // Perform detection
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])

        do {
            try handler.perform([request])
        } catch {
            print("[TennisBallDetector] Detection failed: \(error)")
            return nil
        }

        // Process results
        guard let results = request.results as? [VNRecognizedObjectObservation] else {
            return nil
        }

        // Find tennis ball (sports ball) detections
        var detections: [[String: Any]] = []

        for observation in results {
            // Check if this is a sports ball
            guard let topLabel = observation.labels.first else { continue }

            // Filter by class (sports ball = 32 in COCO, or custom tennis ball class = 0)
            let isSportsBall = topLabel.identifier == "sports ball" ||
                               topLabel.identifier == "tennis ball" ||
                               topLabel.identifier == "ball"

            guard isSportsBall && observation.confidence >= confidenceThreshold else {
                continue
            }

            // Convert normalized coordinates to pixel coordinates
            let boundingBox = observation.boundingBox
            let x = boundingBox.midX * CGFloat(width)
            let y = (1 - boundingBox.midY) * CGFloat(height) // Flip Y axis
            let boxWidth = boundingBox.width * CGFloat(width)
            let boxHeight = boundingBox.height * CGFloat(height)

            let detection: [String: Any] = [
                "x": x,
                "y": y,
                "width": boxWidth,
                "height": boxHeight,
                "confidence": observation.confidence,
                "timestamp": currentTime * 1000, // Convert to milliseconds
                "frameWidth": width,
                "frameHeight": height,
                "label": topLabel.identifier
            ]

            detections.append(detection)
        }

        // Return the highest confidence detection (or nil if none)
        if let bestDetection = detections.max(by: { ($0["confidence"] as? Float ?? 0) < ($1["confidence"] as? Float ?? 0) }) {
            return bestDetection
        }

        return nil
    }
}
