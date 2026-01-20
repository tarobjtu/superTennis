import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

export interface RecordingConfig {
  maxDuration?: number; // 最大录制时长（秒）
  quality?: '720p' | '1080p' | '4k';
}

export interface RecordingResult {
  uri: string;
  duration: number;
  fileSize: number;
}

// 视频存储目录
export const VIDEO_DIRECTORY = `${FileSystem.documentDirectory}videos/`;

// 确保视频目录存在
export async function ensureVideoDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(VIDEO_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_DIRECTORY, { intermediates: true });
  }
}

// 生成视频文件名
export function generateVideoFileName(matchId: string): string {
  const timestamp = Date.now();
  return `match_${matchId}_${timestamp}.mp4`;
}

// 保存视频到媒体库
export async function saveVideoToLibrary(uri: string): Promise<string | null> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Media library permission not granted');
      return null;
    }

    const asset = await MediaLibrary.createAssetAsync(uri);
    return asset.uri;
  } catch (error) {
    console.error('Error saving video to library:', error);
    return null;
  }
}

// 获取视频文件大小
export async function getVideoFileSize(uri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
  } catch (error) {
    console.error('Error getting video file size:', error);
    return 0;
  }
}

// 删除视频文件
export async function deleteVideoFile(uri: string): Promise<boolean> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return true;
  } catch (error) {
    console.error('Error deleting video file:', error);
    return false;
  }
}

// 获取所有本地视频
export async function getLocalVideos(): Promise<string[]> {
  try {
    await ensureVideoDirectory();
    const files = await FileSystem.readDirectoryAsync(VIDEO_DIRECTORY);
    return files.filter((f) => f.endsWith('.mp4')).map((f) => VIDEO_DIRECTORY + f);
  } catch (error) {
    console.error('Error getting local videos:', error);
    return [];
  }
}

// 清理过期视频（保留最近7天）
export async function cleanupOldVideos(daysToKeep: number = 7): Promise<number> {
  try {
    const videos = await getLocalVideos();
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const videoPath of videos) {
      const fileInfo = await FileSystem.getInfoAsync(videoPath);
      if (fileInfo.exists && 'modificationTime' in fileInfo) {
        const modTime = (fileInfo.modificationTime as number) * 1000;
        if (modTime < cutoffTime) {
          await deleteVideoFile(videoPath);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old videos:', error);
    return 0;
  }
}

// 格式化时长显示
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
