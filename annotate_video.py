#!/usr/bin/env python3
"""
Tennis Video Annotation Tool
标注网球落点 - 标记每个落点是 IN 还是 OUT

Controls:
  Space  - 暂停/播放
  左箭头 - 后退 1 帧
  右箭头 - 前进 1 帧
  [ ]    - 后退/前进 10 帧
  i      - 标记当前帧为 IN (界内)
  o      - 标记当前帧为 OUT (界外)
  d      - 删除最近的标注
  s      - 保存标注
  q      - 退出
"""

import cv2
import json
import os
import sys
from pathlib import Path

class VideoAnnotator:
    def __init__(self, video_path):
        self.video_path = video_path
        self.cap = cv2.VideoCapture(video_path)

        if not self.cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.current_frame = 0
        self.playing = False
        self.annotations = []

        # Output file
        base_name = Path(video_path).stem
        self.output_path = Path(video_path).parent / f"{base_name}.annotations.json"

        # Load existing annotations if any
        self.load_annotations()

        print(f"Video: {video_path}")
        print(f"FPS: {self.fps}, Total frames: {self.total_frames}")
        print(f"Duration: {self.total_frames / self.fps:.1f} seconds")
        print(f"Output: {self.output_path}")
        print(f"Loaded {len(self.annotations)} existing annotations")
        print("\n--- Controls ---")
        print("Space: Play/Pause | Arrow keys: Navigate frames")
        print("i: Mark IN | o: Mark OUT | d: Delete last | s: Save | q: Quit")

    def load_annotations(self):
        if self.output_path.exists():
            with open(self.output_path, 'r') as f:
                data = json.load(f)
                self.annotations = data.get('annotations', [])

    def save_annotations(self):
        data = {
            "video_path": str(self.video_path),
            "fps": self.fps,
            "total_frames": self.total_frames,
            "annotations": sorted(self.annotations, key=lambda x: x['frame_id'])
        }
        with open(self.output_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"\nSaved {len(self.annotations)} annotations to {self.output_path}")

    def add_annotation(self, is_in: bool):
        # Check if this frame already has an annotation
        for ann in self.annotations:
            if ann['frame_id'] == self.current_frame:
                ann['is_in'] = is_in
                print(f"Updated frame {self.current_frame}: {'IN' if is_in else 'OUT'}")
                return

        self.annotations.append({
            "frame_id": self.current_frame,
            "timestamp": self.current_frame / self.fps,
            "is_in": is_in
        })
        print(f"Added frame {self.current_frame}: {'IN' if is_in else 'OUT'}")

    def delete_last_annotation(self):
        if self.annotations:
            removed = self.annotations.pop()
            print(f"Deleted annotation at frame {removed['frame_id']}")
        else:
            print("No annotations to delete")

    def seek(self, frame_num):
        frame_num = max(0, min(frame_num, self.total_frames - 1))
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        self.current_frame = frame_num

    def get_frame(self):
        ret, frame = self.cap.read()
        if ret:
            return frame
        return None

    def draw_overlay(self, frame):
        h, w = frame.shape[:2]

        # Draw info bar at top
        cv2.rectangle(frame, (0, 0), (w, 60), (0, 0, 0), -1)

        # Frame info
        time_str = f"{self.current_frame / self.fps:.2f}s"
        info = f"Frame: {self.current_frame}/{self.total_frames} | Time: {time_str} | Annotations: {len(self.annotations)}"
        cv2.putText(frame, info, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        # Status
        status = "PLAYING" if self.playing else "PAUSED"
        cv2.putText(frame, status, (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0) if self.playing else (0, 255, 255), 1)

        # Check if current frame has annotation
        for ann in self.annotations:
            if ann['frame_id'] == self.current_frame:
                label = "IN" if ann['is_in'] else "OUT"
                color = (0, 255, 0) if ann['is_in'] else (0, 0, 255)
                cv2.putText(frame, f"MARKED: {label}", (w - 200, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                break

        # Draw annotation markers on progress bar
        bar_y = h - 20
        bar_h = 10
        cv2.rectangle(frame, (0, bar_y), (w, bar_y + bar_h), (50, 50, 50), -1)

        # Current position
        pos_x = int(self.current_frame / self.total_frames * w)
        cv2.rectangle(frame, (0, bar_y), (pos_x, bar_y + bar_h), (100, 100, 100), -1)

        # Annotation markers
        for ann in self.annotations:
            x = int(ann['frame_id'] / self.total_frames * w)
            color = (0, 255, 0) if ann['is_in'] else (0, 0, 255)
            cv2.line(frame, (x, bar_y), (x, bar_y + bar_h), color, 2)

        # Current position marker
        cv2.line(frame, (pos_x, bar_y - 5), (pos_x, bar_y + bar_h + 5), (255, 255, 255), 2)

        return frame

    def run(self):
        cv2.namedWindow('Tennis Annotation Tool', cv2.WINDOW_NORMAL)
        cv2.resizeWindow('Tennis Annotation Tool', 1280, 720)

        while True:
            if self.playing:
                self.current_frame += 1
                if self.current_frame >= self.total_frames:
                    self.current_frame = self.total_frames - 1
                    self.playing = False

            self.seek(self.current_frame)
            frame = self.get_frame()

            if frame is None:
                break

            frame = self.draw_overlay(frame)
            cv2.imshow('Tennis Annotation Tool', frame)

            # Handle key input
            wait_time = int(1000 / self.fps) if self.playing else 0
            key = cv2.waitKey(max(1, wait_time)) & 0xFF

            if key == ord('q'):
                break
            elif key == ord(' '):
                self.playing = not self.playing
            elif key == 81 or key == 2:  # Left arrow
                self.playing = False
                self.current_frame = max(0, self.current_frame - 1)
            elif key == 83 or key == 3:  # Right arrow
                self.playing = False
                self.current_frame = min(self.total_frames - 1, self.current_frame + 1)
            elif key == ord('['):
                self.playing = False
                self.current_frame = max(0, self.current_frame - 10)
            elif key == ord(']'):
                self.playing = False
                self.current_frame = min(self.total_frames - 1, self.current_frame + 10)
            elif key == ord('i'):
                self.add_annotation(is_in=True)
            elif key == ord('o'):
                self.add_annotation(is_in=False)
            elif key == ord('d'):
                self.delete_last_annotation()
            elif key == ord('s'):
                self.save_annotations()

        # Auto-save on exit
        self.save_annotations()
        self.cap.release()
        cv2.destroyAllWindows()

def main():
    if len(sys.argv) < 2:
        # Default to 01.mp4
        video_path = "/Users/bytedance/Desktop/SuperTennis 测评集合/01.mp4"
    else:
        video_path = sys.argv[1]

    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)

    annotator = VideoAnnotator(video_path)
    annotator.run()

if __name__ == "__main__":
    main()
