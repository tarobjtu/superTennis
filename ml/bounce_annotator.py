#!/usr/bin/env python3
"""
落点标注工具

用于人工标注视频中的落点，并与算法检测结果对比，计算召回率和准确率。

使用方法:
    python bounce_annotator.py --video path/to/video.mp4

操作说明:
    空格     - 暂停/继续播放
    B        - 标记当前帧为落点 (Bounce)
    I        - 标记为界内落点 (In)
    O        - 标记为出界落点 (Out)
    左箭头   - 后退 1 秒
    右箭头   - 前进 1 秒
    ,        - 后退 1 帧
    .        - 前进 1 帧
    S        - 保存标注
    Q        - 退出
    1-5      - 调整播放速度 (0.25x - 2x)
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional, Dict, Any

import cv2
import numpy as np


@dataclass
class AnnotatedBounce:
    """标注的落点"""
    frame_id: int
    timestamp: float
    is_in: Optional[bool] = None  # True=界内, False=出界, None=未标记


class BounceAnnotator:
    """落点标注器"""

    def __init__(self, video_path: str, detection_result_path: Optional[str] = None):
        self.video_path = video_path
        self.cap = cv2.VideoCapture(video_path)

        if not self.cap.isOpened():
            raise ValueError(f"无法打开视频: {video_path}")

        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        self.current_frame = 0
        self.paused = True  # 默认暂停，方便标注
        self.playback_speed = 1.0

        # 标注数据
        self.annotations: List[AnnotatedBounce] = []

        # 加载已有标注
        self.annotation_path = str(Path(video_path).with_suffix('.annotations.json'))
        self._load_annotations()

        # 加载检测结果 (如果有)
        self.detections: List[Dict] = []
        if detection_result_path and os.path.exists(detection_result_path):
            self._load_detections(detection_result_path)
        else:
            # 尝试自动查找
            default_detection_path = str(Path(video_path).parent / f"{Path(video_path).stem}_report.json")
            if os.path.exists(default_detection_path):
                self._load_detections(default_detection_path)

        self.window_name = "Bounce Annotator - Press H for help"

    def _load_annotations(self):
        """加载已有标注"""
        if os.path.exists(self.annotation_path):
            try:
                with open(self.annotation_path, 'r') as f:
                    data = json.load(f)
                self.annotations = [
                    AnnotatedBounce(**a) for a in data.get('annotations', [])
                ]
                print(f"已加载 {len(self.annotations)} 个标注")
            except Exception as e:
                print(f"加载标注失败: {e}")

    def _load_detections(self, path: str):
        """加载算法检测结果"""
        try:
            with open(path, 'r') as f:
                data = json.load(f)
            self.detections = data.get('bounces', [])
            print(f"已加载 {len(self.detections)} 个检测结果")
        except Exception as e:
            print(f"加载检测结果失败: {e}")

    def save_annotations(self):
        """保存标注"""
        data = {
            'video_path': self.video_path,
            'fps': self.fps,
            'total_frames': self.total_frames,
            'annotations': [asdict(a) for a in self.annotations],
        }
        with open(self.annotation_path, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"已保存 {len(self.annotations)} 个标注到: {self.annotation_path}")

    def add_bounce(self, is_in: Optional[bool] = None):
        """添加落点标注"""
        timestamp = self.current_frame / self.fps

        # 检查是否已存在相近的标注 (0.5秒内)
        for ann in self.annotations:
            if abs(ann.timestamp - timestamp) < 0.5:
                # 更新已有标注
                ann.is_in = is_in
                status = "IN" if is_in else ("OUT" if is_in is False else "未标记")
                print(f"更新标注 Frame {self.current_frame} ({timestamp:.2f}s) - {status}")
                return

        # 添加新标注
        bounce = AnnotatedBounce(
            frame_id=self.current_frame,
            timestamp=timestamp,
            is_in=is_in,
        )
        self.annotations.append(bounce)
        self.annotations.sort(key=lambda x: x.frame_id)

        status = "IN" if is_in else ("OUT" if is_in is False else "未标记")
        print(f"添加标注 Frame {self.current_frame} ({timestamp:.2f}s) - {status}")

    def delete_nearest_bounce(self):
        """删除最近的标注"""
        if not self.annotations:
            return

        timestamp = self.current_frame / self.fps
        nearest = min(self.annotations, key=lambda x: abs(x.timestamp - timestamp))

        if abs(nearest.timestamp - timestamp) < 1.0:
            self.annotations.remove(nearest)
            print(f"删除标注 Frame {nearest.frame_id} ({nearest.timestamp:.2f}s)")

    def _draw_frame(self, frame: np.ndarray) -> np.ndarray:
        """绘制标注界面"""
        vis = frame.copy()
        h, w = vis.shape[:2]
        timestamp = self.current_frame / self.fps

        # 顶部信息栏
        info_bg = np.zeros((80, w, 3), dtype=np.uint8)
        info_bg[:] = (40, 40, 40)

        # 播放状态
        status = "PAUSED" if self.paused else f"PLAYING {self.playback_speed}x"
        cv2.putText(info_bg, status, (10, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        # 时间和帧号
        time_str = f"Frame: {self.current_frame}/{self.total_frames} | Time: {timestamp:.2f}s / {self.total_frames/self.fps:.2f}s"
        cv2.putText(info_bg, time_str, (10, 55),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        # 标注统计
        total_ann = len(self.annotations)
        in_count = sum(1 for a in self.annotations if a.is_in is True)
        out_count = sum(1 for a in self.annotations if a.is_in is False)
        stats_str = f"Annotations: {total_ann} (IN: {in_count}, OUT: {out_count}) | Detections: {len(self.detections)}"
        cv2.putText(info_bg, stats_str, (w - 500, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

        # 操作提示
        cv2.putText(info_bg, "B=Bounce I=In O=Out Space=Pause S=Save Q=Quit", (w - 500, 55),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

        vis = np.vstack([info_bg, vis])

        # 进度条
        progress_h = 30
        progress_bg = np.zeros((progress_h, w, 3), dtype=np.uint8)
        progress_bg[:] = (30, 30, 30)

        # 进度
        progress_x = int(w * self.current_frame / self.total_frames)
        cv2.rectangle(progress_bg, (0, 5), (progress_x, progress_h - 5), (100, 100, 100), -1)

        # 标注标记 (绿色=IN, 红色=OUT, 黄色=未标记)
        for ann in self.annotations:
            x = int(w * ann.frame_id / self.total_frames)
            if ann.is_in is True:
                color = (0, 255, 0)
            elif ann.is_in is False:
                color = (0, 0, 255)
            else:
                color = (0, 255, 255)
            cv2.line(progress_bg, (x, 0), (x, progress_h), color, 2)

        # 检测结果标记 (小蓝点)
        for det in self.detections:
            x = int(w * det['frame_id'] / self.total_frames)
            cv2.circle(progress_bg, (x, progress_h - 8), 3, (255, 150, 0), -1)

        # 当前位置
        cv2.line(progress_bg, (progress_x, 0), (progress_x, progress_h), (255, 255, 255), 2)

        vis = np.vstack([vis, progress_bg])

        # 当前帧附近的标注提示
        for ann in self.annotations:
            if abs(ann.frame_id - self.current_frame) < self.fps * 2:  # 2秒内
                # 在画面上显示标注
                if ann.is_in is True:
                    text, color = "IN", (0, 255, 0)
                elif ann.is_in is False:
                    text, color = "OUT", (0, 0, 255)
                else:
                    text, color = "BOUNCE", (0, 255, 255)

                # 计算位置
                offset = ann.frame_id - self.current_frame
                alpha = 1.0 - abs(offset) / (self.fps * 2)
                x = w // 2 + offset * 5
                y = 120

                cv2.putText(vis, f"{text} ({ann.timestamp:.2f}s)", (int(x), y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        return vis

    def run(self):
        """运行标注器"""
        print("\n" + "=" * 60)
        print("落点标注工具")
        print("=" * 60)
        print(f"视频: {self.video_path}")
        print(f"分辨率: {self.width}x{self.height}")
        print(f"帧率: {self.fps:.2f} fps")
        print(f"总帧数: {self.total_frames}")
        print(f"时长: {self.total_frames/self.fps:.2f} 秒")
        print()
        print("操作说明:")
        print("  空格     - 暂停/继续播放")
        print("  B        - 标记当前帧为落点")
        print("  I        - 标记为界内落点")
        print("  O        - 标记为出界落点")
        print("  D        - 删除最近的标注")
        print("  左/右箭头 - 前后跳 1 秒")
        print("  , / .    - 前后跳 1 帧")
        print("  1-5      - 调整播放速度")
        print("  S        - 保存标注")
        print("  R        - 生成评估报告")
        print("  Q        - 退出")
        print("=" * 60 + "\n")

        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(self.window_name, 1280, 830)

        while True:
            # 读取帧
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, self.current_frame)
            ret, frame = self.cap.read()

            if not ret:
                self.current_frame = 0
                continue

            # 绘制界面
            vis = self._draw_frame(frame)
            cv2.imshow(self.window_name, vis)

            # 计算等待时间
            if self.paused:
                wait_time = 0  # 无限等待
            else:
                wait_time = int(1000 / self.fps / self.playback_speed)

            key = cv2.waitKey(wait_time) & 0xFF

            # 按键处理
            if key == ord('q') or key == 27:  # Q or ESC
                break

            elif key == ord(' '):  # 空格
                self.paused = not self.paused

            elif key == ord('b'):  # 标记落点
                self.add_bounce(None)

            elif key == ord('i'):  # 界内
                self.add_bounce(True)

            elif key == ord('o'):  # 出界
                self.add_bounce(False)

            elif key == ord('d'):  # 删除
                self.delete_nearest_bounce()

            elif key == ord('s'):  # 保存
                self.save_annotations()

            elif key == ord('r'):  # 生成报告
                self.generate_report()

            elif key == 81 or key == 2:  # 左箭头
                self.current_frame = max(0, self.current_frame - int(self.fps))

            elif key == 83 or key == 3:  # 右箭头
                self.current_frame = min(self.total_frames - 1, self.current_frame + int(self.fps))

            elif key == ord(','):  # 后退 1 帧
                self.current_frame = max(0, self.current_frame - 1)

            elif key == ord('.'):  # 前进 1 帧
                self.current_frame = min(self.total_frames - 1, self.current_frame + 1)

            elif key == ord('1'):
                self.playback_speed = 0.25
            elif key == ord('2'):
                self.playback_speed = 0.5
            elif key == ord('3'):
                self.playback_speed = 1.0
            elif key == ord('4'):
                self.playback_speed = 1.5
            elif key == ord('5'):
                self.playback_speed = 2.0

            # 自动前进
            if not self.paused:
                self.current_frame += 1
                if self.current_frame >= self.total_frames:
                    self.current_frame = 0
                    self.paused = True

        # 退出时保存
        self.save_annotations()
        cv2.destroyAllWindows()
        self.cap.release()

        # 生成最终报告
        self.generate_report()

    def generate_report(self):
        """生成评估报告"""
        if not self.annotations:
            print("没有标注数据，无法生成报告")
            return

        print("\n" + "=" * 60)
        print("落点检测评估报告")
        print("=" * 60)

        # 标注统计
        total_annotations = len(self.annotations)
        in_annotations = sum(1 for a in self.annotations if a.is_in is True)
        out_annotations = sum(1 for a in self.annotations if a.is_in is False)

        print(f"\n## 人工标注 (Ground Truth)")
        print(f"- 总落点数: {total_annotations}")
        print(f"- 界内: {in_annotations}")
        print(f"- 出界: {out_annotations}")

        if not self.detections:
            print("\n没有检测结果数据，无法计算召回率")
            return

        # 检测统计
        total_detections = len(self.detections)
        in_detections = sum(1 for d in self.detections if d.get('is_in', False))
        out_detections = total_detections - in_detections

        print(f"\n## 算法检测")
        print(f"- 总检测数: {total_detections}")
        print(f"- 界内: {in_detections}")
        print(f"- 出界: {out_detections}")

        # 匹配检测和标注 (时间差 < 1秒认为匹配)
        MATCH_THRESHOLD = 1.0  # 秒

        matched_annotations = set()
        matched_detections = set()
        correct_judgments = 0

        for i, ann in enumerate(self.annotations):
            for j, det in enumerate(self.detections):
                if j in matched_detections:
                    continue

                time_diff = abs(ann.timestamp - det['timestamp'])
                if time_diff < MATCH_THRESHOLD:
                    matched_annotations.add(i)
                    matched_detections.add(j)

                    # 检查判定是否正确
                    if ann.is_in is not None and ann.is_in == det.get('is_in'):
                        correct_judgments += 1
                    break

        # 计算指标
        true_positives = len(matched_annotations)
        false_negatives = total_annotations - true_positives
        false_positives = total_detections - len(matched_detections)

        recall = true_positives / total_annotations if total_annotations > 0 else 0
        precision = true_positives / total_detections if total_detections > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

        # 判定准确率 (在匹配的落点中)
        judgment_accuracy = correct_judgments / true_positives if true_positives > 0 else 0

        print(f"\n## 检测性能")
        print(f"- 召回率 (Recall): {recall*100:.1f}% ({true_positives}/{total_annotations})")
        print(f"- 精确率 (Precision): {precision*100:.1f}% ({true_positives}/{total_detections})")
        print(f"- F1 分数: {f1*100:.1f}%")

        print(f"\n## 判定准确率")
        print(f"- 界内/出界判定准确率: {judgment_accuracy*100:.1f}% ({correct_judgments}/{true_positives})")

        print(f"\n## 详细分析")
        print(f"- 正确检测 (True Positives): {true_positives}")
        print(f"- 漏检 (False Negatives): {false_negatives}")
        print(f"- 误检 (False Positives): {false_positives}")

        # 列出漏检的落点
        if false_negatives > 0:
            print(f"\n### 漏检的落点:")
            for i, ann in enumerate(self.annotations):
                if i not in matched_annotations:
                    status = "IN" if ann.is_in else ("OUT" if ann.is_in is False else "?")
                    print(f"  - Frame {ann.frame_id} ({ann.timestamp:.2f}s) - {status}")

        # 列出误检的落点
        if false_positives > 0:
            print(f"\n### 误检的落点:")
            for j, det in enumerate(self.detections):
                if j not in matched_detections:
                    status = "IN" if det.get('is_in') else "OUT"
                    print(f"  - Frame {det['frame_id']} ({det['timestamp']:.2f}s) - {status}")

        print("\n" + "=" * 60)

        # 保存报告
        report = {
            'ground_truth': {
                'total': total_annotations,
                'in': in_annotations,
                'out': out_annotations,
            },
            'detections': {
                'total': total_detections,
                'in': in_detections,
                'out': out_detections,
            },
            'metrics': {
                'recall': recall,
                'precision': precision,
                'f1': f1,
                'judgment_accuracy': judgment_accuracy,
            },
            'details': {
                'true_positives': true_positives,
                'false_negatives': false_negatives,
                'false_positives': false_positives,
            }
        }

        report_path = str(Path(self.video_path).with_suffix('.evaluation.json'))
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"报告已保存: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="落点标注工具")
    parser.add_argument("--video", "-v", type=str, required=True, help="视频路径")
    parser.add_argument("--detections", "-d", type=str, help="检测结果 JSON 路径")

    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"错误: 视频不存在: {args.video}")
        sys.exit(1)

    annotator = BounceAnnotator(args.video, args.detections)
    annotator.run()


if __name__ == "__main__":
    main()
