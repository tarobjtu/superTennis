/**
 * Expo Config Plugin for Tennis Ball Detector
 *
 * Automatically adds the native iOS frame processor plugin
 * to the Xcode project during prebuild.
 */

const {
  withXcodeProject,
  withDangerousMod,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Add Swift files to the Xcode project
 */
function withTennisBallDetectorXcode(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    // Source files in our plugin directory
    const sourceDir = path.join(
      config.modRequest.projectRoot,
      'ios',
      'TennisBallDetector'
    );

    // Target group in Xcode project
    const targetGroup = xcodeProject.addPbxGroup(
      [],
      'TennisBallDetector',
      'TennisBallDetector'
    );

    // Get the main group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;

    // Add our group to the main group
    xcodeProject.addToPbxGroup(targetGroup.uuid, mainGroup);

    // Check if source directory exists
    if (fs.existsSync(sourceDir)) {
      const files = fs.readdirSync(sourceDir);

      for (const file of files) {
        const filePath = path.join(sourceDir, file);
        const relativePath = `TennisBallDetector/${file}`;

        if (file.endsWith('.swift')) {
          // Add Swift file
          xcodeProject.addSourceFile(
            relativePath,
            { target: xcodeProject.getFirstTarget().uuid },
            targetGroup.uuid
          );
        } else if (file.endsWith('.m')) {
          // Add Objective-C file
          xcodeProject.addSourceFile(
            relativePath,
            { target: xcodeProject.getFirstTarget().uuid },
            targetGroup.uuid
          );
        }
      }
    }

    return config;
  });
}

/**
 * Copy native source files to ios directory
 */
function withTennisBallDetectorFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // Source directory (in our project)
      const sourceDir = path.join(projectRoot, 'ios', 'TennisBallDetector');

      // Destination in generated ios folder
      const iosDir = path.join(projectRoot, 'ios');
      const destDir = path.join(iosDir, 'TennisBallDetector');

      // Create destination directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Copy files if source exists
      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
          const srcPath = path.join(sourceDir, file);
          const destPath = path.join(destDir, file);

          // Only copy if different or doesn't exist
          if (!fs.existsSync(destPath) ||
              fs.readFileSync(srcPath).toString() !== fs.readFileSync(destPath).toString()) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[TennisBallDetector] Copied ${file}`);
          }
        }
      }

      return config;
    },
  ]);
}

/**
 * Main plugin export
 */
function withTennisBallDetector(config) {
  // First copy the files
  config = withTennisBallDetectorFiles(config);

  // Then add them to Xcode project
  config = withTennisBallDetectorXcode(config);

  return config;
}

module.exports = withTennisBallDetector;
