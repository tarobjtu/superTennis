#!/usr/bin/env python3
"""
鹰眼视频测试工具

功能:
1. 交互式 4 点球场校准
2. YOLOv8 网球检测
3. 轨迹追踪 + 落点检测
4. 可视化输出
5. 准确率统计报告

使用方法:
    # 安装依赖
    pip install ultralytics opencv-python numpy

    # 运行测试
    python hawkeye_video_test.py --video path/to/tennis_video.mp4

    # 使用已有校准数据
    python hawkeye_video_test.py --video video.mp4 --calibration calibration.json

    # 仅校准（不处理视频）
    python hawkeye_video_test.py --video video.mp4 --calibrate-only
"""

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

import cv2
import numpy as np

# 尝试导入 ultralytics
try:
    from ultralytics import YOLO
except ImportError:
    print("请安装 ultralytics: pip install ultralytics")
    sys.exit(1)


# ============================================================================
# 数据结构
# ============================================================================

@dataclass
class Point:
    """2D 点"""
    x: float
    y: float


@dataclass
class Detection:
    """单帧检测结果"""
    frame_id: int
    timestamp: float  # 秒
    pixel_x: float
    pixel_y: float
    court_x: Optional[float] = None  # 球场坐标 (米)
    court_y: Optional[float] = None
    confidence: float = 0.0
    bbox_width: float = 0.0
    bbox_height: float = 0.0


@dataclass
class Bounce:
    """落点事件"""
    frame_id: int
    timestamp: float
    pixel_x: float
    pixel_y: float
    court_x: float
    court_y: float
    is_in: bool  # 是否在界内
    distance_from_line: float  # 距边线距离 (米), 正=界内, 负=出界


@dataclass
class TrackingResult:
    """完整追踪结果"""
    video_path: str
    fps: float
    total_frames: int
    detections: List[Detection] = field(default_factory=list)
    bounces: List[Bounce] = field(default_factory=list)
    stats: Dict[str, Any] = field(default_factory=dict)


# ============================================================================
# 球场常量 (单位: 米)
# ============================================================================

class CourtDimensions:
    """标准网球场尺寸"""
    # 单打场地
    SINGLES_WIDTH = 8.23  # 单打边线到边线
    SINGLES_HALF_WIDTH = 4.115

    # 双打场地
    DOUBLES_WIDTH = 10.97
    DOUBLES_HALF_WIDTH = 5.485

    # 长度
    LENGTH = 23.77
    HALF_LENGTH = 11.885

    # 发球区
    SERVICE_LINE = 6.40  # 发球线到球网的距离
    SERVICE_CENTER = 0.0

    # 球网
    NET_HEIGHT_CENTER = 0.914
    NET_HEIGHT_SIDES = 1.07


# ============================================================================
# 校准模块
# ============================================================================

class CourtCalibrator:
    """
    交互式球场校准器

    使用 4 点透视变换将像素坐标转换为球场坐标
    """

    def __init__(self):
        self.pixel_points: List[Tuple[float, float]] = []
        self.court_points: List[Tuple[float, float]] = []
        self.transform_matrix: Optional[np.ndarray] = None
        self.inverse_matrix: Optional[np.ndarray] = None
        self.image_for_calibration: Optional[np.ndarray] = None
        self.window_name = "Court Calibration - Click 4 corners"

        # 默认球场角点 (单打场地)
        # 顺序: 左上, 右上, 右下, 左下 (从摄像机视角看远端为上)
        hw = CourtDimensions.SINGLES_HALF_WIDTH
        hl = CourtDimensions.HALF_LENGTH
        self.default_court_points = [
            (-hw, hl),   # 左上 (远端左角)
            (hw, hl),    # 右上 (远端右角)
            (hw, -hl),   # 右下 (近端右角)
            (-hw, -hl),  # 左下 (近端左角)
        ]

    def _mouse_callback(self, event, x, y, flags, param):
        """鼠标点击回调"""
        if event == cv2.EVENT_LBUTTONDOWN:
            if len(self.pixel_points) < 4:
                self.pixel_points.append((x, y))
                print(f"点 {len(self.pixel_points)}: ({x}, {y})")

                # 绘制点
                self._draw_points()

    def _draw_points(self):
        """绘制已标注的点"""
        if self.image_for_calibration is None:
            return

        img = self.image_for_calibration.copy()
        colors = [
            (0, 255, 0),    # 绿
            (0, 255, 255),  # 黄
            (0, 0, 255),    # 红
            (255, 0, 255),  # 紫
        ]
        labels = ["1.Far-Left", "2.Far-Right", "3.Near-Right", "4.Near-Left"]

        # 绘制已有的点
        for i, (px, py) in enumerate(self.pixel_points):
            cv2.circle(img, (int(px), int(py)), 8, colors[i], -1)
            cv2.putText(img, labels[i], (int(px) + 10, int(py) - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, colors[i], 2)

        # 如果有 2+ 个点，绘制连线
        if len(self.pixel_points) >= 2:
            for i in range(len(self.pixel_points) - 1):
                pt1 = (int(self.pixel_points[i][0]), int(self.pixel_points[i][1]))
                pt2 = (int(self.pixel_points[i+1][0]), int(self.pixel_points[i+1][1]))
                cv2.line(img, pt1, pt2, (255, 255, 0), 2)

        # 如果有 4 个点，闭合
        if len(self.pixel_points) == 4:
            pt1 = (int(self.pixel_points[3][0]), int(self.pixel_points[3][1]))
            pt2 = (int(self.pixel_points[0][0]), int(self.pixel_points[0][1]))
            cv2.line(img, pt1, pt2, (255, 255, 0), 2)

        # 显示提示
        remaining = 4 - len(self.pixel_points)
        if remaining > 0:
            hint = f"Click point {len(self.pixel_points) + 1}: {labels[len(self.pixel_points)]}"
            cv2.putText(img, hint, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            cv2.putText(img, "Press 'r' to reset, 'q' to quit", (20, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        else:
            cv2.putText(img, "Calibration complete! Press 's' to save, 'r' to reset",
                       (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        cv2.imshow(self.window_name, img)

    def calibrate_interactive(self, frame: np.ndarray) -> bool:
        """
        交互式校准

        Args:
            frame: 视频帧 (用于校准的参考图像)

        Returns:
            校准是否成功
        """
        self.image_for_calibration = frame.copy()
        self.pixel_points = []

        cv2.namedWindow(self.window_name)
        cv2.setMouseCallback(self.window_name, self._mouse_callback)

        print("\n" + "=" * 50)
        print("球场校准")
        print("=" * 50)
        print("请依次点击球场的 4 个角落:")
        print("  1. 远端左角 (Far-Left)")
        print("  2. 远端右角 (Far-Right)")
        print("  3. 近端右角 (Near-Right)")
        print("  4. 近端左角 (Near-Left)")
        print("\n按键:")
        print("  's' - 保存校准")
        print("  'r' - 重置")
        print("  'q' - 退出")
        print("=" * 50 + "\n")

        self._draw_points()

        while True:
            key = cv2.waitKey(1) & 0xFF

            if key == ord('q'):
                cv2.destroyWindow(self.window_name)
                return False

            elif key == ord('r'):
                self.pixel_points = []
                self._draw_points()
                print("已重置，请重新点击 4 个角落")

            elif key == ord('s'):
                if len(self.pixel_points) == 4:
                    self.court_points = self.default_court_points
                    self._compute_transform()
                    cv2.destroyWindow(self.window_name)
                    print("\n校准完成!")
                    return True
                else:
                    print(f"需要 4 个点，当前只有 {len(self.pixel_points)} 个")

        return False

    def _compute_transform(self):
        """计算透视变换矩阵"""
        if len(self.pixel_points) != 4 or len(self.court_points) != 4:
            raise ValueError("需要 4 个像素点和 4 个球场点")

        src = np.array(self.pixel_points, dtype=np.float32)
        dst = np.array(self.court_points, dtype=np.float32)

        self.transform_matrix = cv2.getPerspectiveTransform(src, dst)
        self.inverse_matrix = cv2.getPerspectiveTransform(dst, src)

        print(f"透视变换矩阵:\n{self.transform_matrix}")

    def pixel_to_court(self, px: float, py: float) -> Tuple[float, float]:
        """
        像素坐标 -> 球场坐标

        Args:
            px, py: 像素坐标

        Returns:
            (court_x, court_y): 球场坐标 (米)
        """
        if self.transform_matrix is None:
            raise ValueError("请先进行校准")

        point = np.array([[[px, py]]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(point, self.transform_matrix)
        return float(transformed[0, 0, 0]), float(transformed[0, 0, 1])

    def court_to_pixel(self, cx: float, cy: float) -> Tuple[float, float]:
        """
        球场坐标 -> 像素坐标

        Args:
            cx, cy: 球场坐标 (米)

        Returns:
            (pixel_x, pixel_y): 像素坐标
        """
        if self.inverse_matrix is None:
            raise ValueError("请先进行校准")

        point = np.array([[[cx, cy]]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(point, self.inverse_matrix)
        return float(transformed[0, 0, 0]), float(transformed[0, 0, 1])

    def save(self, filepath: str):
        """保存校准数据"""
        data = {
            "pixel_points": self.pixel_points,
            "court_points": self.court_points,
            "transform_matrix": self.transform_matrix.tolist() if self.transform_matrix is not None else None,
            "inverse_matrix": self.inverse_matrix.tolist() if self.inverse_matrix is not None else None,
        }
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"校准数据已保存: {filepath}")

    def load(self, filepath: str) -> bool:
        """加载校准数据"""
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)

            self.pixel_points = [tuple(p) for p in data["pixel_points"]]
            self.court_points = [tuple(p) for p in data["court_points"]]

            if data["transform_matrix"]:
                self.transform_matrix = np.array(data["transform_matrix"], dtype=np.float32)
            if data["inverse_matrix"]:
                self.inverse_matrix = np.array(data["inverse_matrix"], dtype=np.float32)

            print(f"校准数据已加载: {filepath}")
            return True
        except Exception as e:
            print(f"加载校准数据失败: {e}")
            return False


# ============================================================================
# 落点判定
# ============================================================================

def is_point_in_bounds(
    x: float,
    y: float,
    match_type: str = "singles"
) -> Tuple[bool, float, str]:
    """
    判断球是否在界内

    Args:
        x, y: 球场坐标 (米)
        match_type: "singles" 或 "doubles"

    Returns:
        (is_in, distance_from_line, line_type)
        - is_in: 是否在界内
        - distance_from_line: 距最近边线距离 (米), 正=界内, 负=出界
        - line_type: 最近的边线类型
    """
    if match_type == "singles":
        half_width = CourtDimensions.SINGLES_HALF_WIDTH
    else:
        half_width = CourtDimensions.DOUBLES_HALF_WIDTH

    half_length = CourtDimensions.HALF_LENGTH

    # 计算到各边线的距离
    dist_to_left = x + half_width
    dist_to_right = half_width - x
    dist_to_far = half_length - y
    dist_to_near = y + half_length

    # 找最近边线
    distances = {
        "left_sideline": dist_to_left,
        "right_sideline": dist_to_right,
        "far_baseline": dist_to_far,
        "near_baseline": dist_to_near,
    }

    min_dist = min(distances.values())
    line_type = [k for k, v in distances.items() if v == min_dist][0]

    # 判断是否在界内
    is_in = (
        x >= -half_width and x <= half_width and
        y >= -half_length and y <= half_length
    )

    # 返回有符号距离
    signed_distance = min_dist if is_in else -min_dist

    return is_in, signed_distance, line_type


# ============================================================================
# 轨迹追踪器
# ============================================================================

class BallTracker:
    """
    网球轨迹追踪器 (增强版)

    特性:
    1. 基于像素坐标的落点检测 (更稳定)
    2. 轨迹插值补充漏检
    3. 抛物线拟合预测落点
    """

    def __init__(self, fps: float, bounce_cooldown: float = 0.5):
        """
        Args:
            fps: 视频帧率
            bounce_cooldown: 落点检测冷却时间 (秒)
        """
        self.fps = fps
        self.bounce_cooldown = bounce_cooldown
        self.positions: List[Detection] = []
        self.all_positions: List[Detection] = []  # 保留所有检测用于轨迹分析
        self.bounces: List[Bounce] = []
        self.last_bounce_time: float = -1
        self.last_bounce_frame: int = -1

    def add_detection(self, detection: Detection):
        """添加一个检测"""
        self.positions.append(detection)
        self.all_positions.append(detection)

        # 保留最近的 60 个位置 (约 2 秒 @30fps)
        if len(self.positions) > 60:
            self.positions.pop(0)

        # 检测落点 (使用像素坐标)
        self._detect_bounce_pixel()

    def _is_valid_court_position(self, x: float, y: float) -> bool:
        """检查坐标是否在有效的球场区域内"""
        MAX_X = CourtDimensions.SINGLES_HALF_WIDTH + 3.0  # ~7.1m
        MAX_Y = CourtDimensions.HALF_LENGTH + 3.0  # ~14.9m
        return abs(x) <= MAX_X and abs(y) <= MAX_Y

    def _detect_bounce_pixel(self):
        """
        基于像素坐标检测落点

        原理: 球落地反弹时，在画面中的 y 坐标会先增大（下落）后减小（反弹）
        检测像素 y 坐标的局部极大值点
        """
        if len(self.positions) < 7:
            return

        # 获取最近的检测点
        recent = self.positions[-7:]

        # 检查时间连续性 (不能有太大间隔)
        time_gaps = [recent[i+1].timestamp - recent[i].timestamp for i in range(len(recent)-1)]
        max_gap = max(time_gaps) if time_gaps else 0
        if max_gap > 0.5:  # 间隔超过0.5秒，轨迹不连续
            return

        # 提取像素 y 坐标 (在画面中，y 向下增大)
        pixel_ys = [p.pixel_y for p in recent]

        # 寻找局部极大值 (落地点)
        # 使用中间点作为候选
        mid = len(recent) // 2

        # 检查是否是局部极大值
        left_avg = sum(pixel_ys[:mid]) / mid
        right_avg = sum(pixel_ys[mid+1:]) / (len(recent) - mid - 1)
        center = pixel_ys[mid]

        # 落地条件: 中心点比两侧都低（像素y更大）
        # 且变化幅度足够大
        min_change = 15  # 最小像素变化

        if center > left_avg + min_change and center > right_avg + min_change:
            bounce_detection = recent[mid]
            current_time = bounce_detection.timestamp
            current_frame = bounce_detection.frame_id

            # 冷却检查
            if current_time - self.last_bounce_time < self.bounce_cooldown:
                return

            # 检查是否有有效的球场坐标
            if bounce_detection.court_x is None or bounce_detection.court_y is None:
                return

            # 验证球场坐标在有效范围内
            if not self._is_valid_court_position(bounce_detection.court_x, bounce_detection.court_y):
                return

            is_in, distance, line_type = is_point_in_bounds(
                bounce_detection.court_x,
                bounce_detection.court_y
            )

            bounce = Bounce(
                frame_id=bounce_detection.frame_id,
                timestamp=bounce_detection.timestamp,
                pixel_x=bounce_detection.pixel_x,
                pixel_y=bounce_detection.pixel_y,
                court_x=bounce_detection.court_x,
                court_y=bounce_detection.court_y,
                is_in=is_in,
                distance_from_line=distance,
            )

            self.bounces.append(bounce)
            self.last_bounce_time = current_time
            self.last_bounce_frame = current_frame

            status = "IN" if is_in else "OUT"
            print(f"[落点检测] Frame {bounce.frame_id}: ({bounce.court_x:.2f}, {bounce.court_y:.2f}) - {status} (距线 {distance:.3f}m)")

    def interpolate_trajectory(self, calibrator) -> List[Detection]:
        """
        轨迹插值: 补充漏检的帧

        Args:
            calibrator: 坐标转换器

        Returns:
            插值后的检测列表
        """
        if len(self.all_positions) < 2:
            return self.all_positions

        interpolated = []

        for i in range(len(self.all_positions) - 1):
            p1 = self.all_positions[i]
            p2 = self.all_positions[i + 1]

            interpolated.append(p1)

            # 计算帧间隔
            frame_gap = p2.frame_id - p1.frame_id

            # 如果间隔大于 3 帧，进行插值
            if 3 < frame_gap <= 15:  # 不超过 0.5 秒
                # 线性插值
                for j in range(1, frame_gap):
                    t = j / frame_gap

                    # 插值像素坐标
                    px = p1.pixel_x + t * (p2.pixel_x - p1.pixel_x)
                    py = p1.pixel_y + t * (p2.pixel_y - p1.pixel_y)

                    # 计算时间戳和帧号
                    frame_id = p1.frame_id + j
                    timestamp = p1.timestamp + t * (p2.timestamp - p1.timestamp)

                    # 转换为球场坐标
                    court_x, court_y = None, None
                    try:
                        court_x, court_y = calibrator.pixel_to_court(px, py)
                    except:
                        pass

                    # 创建插值检测
                    det = Detection(
                        frame_id=frame_id,
                        timestamp=timestamp,
                        pixel_x=px,
                        pixel_y=py,
                        court_x=court_x,
                        court_y=court_y,
                        confidence=0.5,  # 插值的置信度较低
                        bbox_width=p1.bbox_width,
                        bbox_height=p1.bbox_height,
                    )
                    interpolated.append(det)

        # 添加最后一个点
        interpolated.append(self.all_positions[-1])

        return interpolated

    def detect_bounces_from_trajectory(self, calibrator) -> List[Bounce]:
        """
        从完整轨迹中检测落点 (后处理)

        先进行插值，再检测落点
        """
        # 插值补充漏检
        full_trajectory = self.interpolate_trajectory(calibrator)

        if len(full_trajectory) < 7:
            return self.bounces

        # 分段检测落点
        additional_bounces = []

        for i in range(3, len(full_trajectory) - 3):
            # 获取窗口
            window = full_trajectory[i-3:i+4]

            # 提取像素 y 坐标
            pixel_ys = [p.pixel_y for p in window]

            mid = 3
            left_avg = sum(pixel_ys[:mid]) / mid
            right_avg = sum(pixel_ys[mid+1:]) / (len(window) - mid - 1)
            center = pixel_ys[mid]

            min_change = 12

            if center > left_avg + min_change and center > right_avg + min_change:
                bounce_detection = window[mid]

                # 检查是否已存在相近的落点
                is_duplicate = False
                for b in self.bounces + additional_bounces:
                    if abs(b.timestamp - bounce_detection.timestamp) < self.bounce_cooldown:
                        is_duplicate = True
                        break

                if is_duplicate:
                    continue

                # 检查球场坐标
                if bounce_detection.court_x is None or bounce_detection.court_y is None:
                    continue

                if not self._is_valid_court_position(bounce_detection.court_x, bounce_detection.court_y):
                    continue

                is_in, distance, line_type = is_point_in_bounds(
                    bounce_detection.court_x,
                    bounce_detection.court_y
                )

                bounce = Bounce(
                    frame_id=bounce_detection.frame_id,
                    timestamp=bounce_detection.timestamp,
                    pixel_x=bounce_detection.pixel_x,
                    pixel_y=bounce_detection.pixel_y,
                    court_x=bounce_detection.court_x,
                    court_y=bounce_detection.court_y,
                    is_in=is_in,
                    distance_from_line=distance,
                )

                additional_bounces.append(bounce)

                status = "IN" if is_in else "OUT"
                print(f"[轨迹预测] Frame {bounce.frame_id}: ({bounce.court_x:.2f}, {bounce.court_y:.2f}) - {status} (距线 {distance:.3f}m)")

        # 合并并排序
        all_bounces = self.bounces + additional_bounces
        all_bounces.sort(key=lambda x: x.frame_id)

        return all_bounces

    def get_trajectory(self) -> List[Tuple[float, float]]:
        """获取像素坐标轨迹 (用于绘制)"""
        return [(p.pixel_x, p.pixel_y) for p in self.positions]


# ============================================================================
# 视频处理器
# ============================================================================

class HawkEyeVideoProcessor:
    """
    鹰眼视频处理器
    """

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence: float = 0.3,
        iou: float = 0.45,
    ):
        """
        Args:
            model_path: YOLO 模型路径
            confidence: 检测置信度阈值
            iou: NMS IoU 阈值
        """
        print(f"加载模型: {model_path}")
        self.model = YOLO(model_path)
        self.confidence = confidence
        self.iou = iou

        # 自动检测模型类别
        # 自定义模型通常只有一个类别 (索引 0)
        # COCO 预训练模型使用 sports ball (索引 32)
        if len(self.model.names) == 1:
            self.target_class = 0  # 自定义单类别模型
            print(f"检测类别: {self.model.names[0]} (索引 0)")
        elif 32 in self.model.names:
            self.target_class = 32  # COCO sports ball
            print(f"检测类别: sports ball (索引 32)")
        else:
            self.target_class = 0  # 默认使用第一个类别
            print(f"检测类别: {self.model.names[0]} (索引 0)")

        self.calibrator = CourtCalibrator()
        self.tracker: Optional[BallTracker] = None

    def process_video(
        self,
        video_path: str,
        output_path: Optional[str] = None,
        calibration_path: Optional[str] = None,
        calibrate_only: bool = False,
        show_preview: bool = True,
    ) -> TrackingResult:
        """
        处理视频

        Args:
            video_path: 输入视频路径
            output_path: 输出视频路径 (可选)
            calibration_path: 校准数据路径 (可选)
            calibrate_only: 仅校准，不处理视频
            show_preview: 是否显示预览窗口

        Returns:
            TrackingResult: 追踪结果
        """
        # 打开视频
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"无法打开视频: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        print(f"\n视频信息:")
        print(f"  - 路径: {video_path}")
        print(f"  - 分辨率: {width}x{height}")
        print(f"  - 帧率: {fps:.2f} fps")
        print(f"  - 总帧数: {total_frames}")
        print(f"  - 时长: {total_frames/fps:.2f} 秒")

        # 校准
        if calibration_path and os.path.exists(calibration_path):
            self.calibrator.load(calibration_path)
        else:
            # 读取第一帧进行校准
            ret, first_frame = cap.read()
            if not ret:
                raise ValueError("无法读取视频帧")

            if not self.calibrator.calibrate_interactive(first_frame):
                print("校准取消")
                cap.release()
                return TrackingResult(video_path=video_path, fps=fps, total_frames=total_frames)

            # 保存校准数据
            calib_save_path = calibration_path or str(Path(video_path).with_suffix('.calibration.json'))
            self.calibrator.save(calib_save_path)

            # 重置视频到开头
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        if calibrate_only:
            cap.release()
            return TrackingResult(video_path=video_path, fps=fps, total_frames=total_frames)

        # 初始化追踪器
        self.tracker = BallTracker(fps=fps)

        # 输出视频
        out = None
        if output_path:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        # 结果
        result = TrackingResult(
            video_path=video_path,
            fps=fps,
            total_frames=total_frames,
        )

        # 处理每一帧
        frame_id = 0
        detection_count = 0
        start_time = time.time()

        print(f"\n开始处理视频...")
        print("按 'q' 退出, 空格暂停/继续")

        paused = False

        while True:
            if not paused:
                ret, frame = cap.read()
                if not ret:
                    break

                timestamp = frame_id / fps

                # YOLO 检测
                detections = self._detect_ball(frame, frame_id, timestamp)

                if detections:
                    detection_count += 1
                    for det in detections:
                        result.detections.append(det)
                        self.tracker.add_detection(det)

                # 绘制可视化
                vis_frame = self._draw_visualization(frame, detections)

                # 写入输出视频
                if out:
                    out.write(vis_frame)

                # 显示预览
                if show_preview:
                    # 添加进度信息
                    progress = f"Frame: {frame_id}/{total_frames} ({100*frame_id/total_frames:.1f}%)"
                    cv2.putText(vis_frame, progress, (10, height - 20),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

                    cv2.imshow("Hawk-Eye Analysis", vis_frame)

                frame_id += 1

                # 进度输出
                if frame_id % 100 == 0:
                    elapsed = time.time() - start_time
                    fps_actual = frame_id / elapsed
                    print(f"  进度: {frame_id}/{total_frames} ({100*frame_id/total_frames:.1f}%) - {fps_actual:.1f} fps")

            # 按键处理
            key = cv2.waitKey(1 if not paused else 0) & 0xFF
            if key == ord('q'):
                break
            elif key == ord(' '):
                paused = not paused
                print("暂停" if paused else "继续")

        # 清理
        cap.release()
        if out:
            out.release()
        cv2.destroyAllWindows()

        # 收集落点数据 (使用轨迹预测补充漏检)
        print("\n[后处理] 使用轨迹预测补充漏检...")
        result.bounces = self.tracker.detect_bounces_from_trajectory(self.calibrator)
        print(f"[后处理] 完成，共检测到 {len(result.bounces)} 个落点")

        # 计算统计
        elapsed = time.time() - start_time
        result.stats = {
            "processing_time": elapsed,
            "processing_fps": frame_id / elapsed,
            "total_detections": len(result.detections),
            "detection_rate": len(result.detections) / frame_id if frame_id > 0 else 0,
            "total_bounces": len(result.bounces),
            "bounces_in": sum(1 for b in result.bounces if b.is_in),
            "bounces_out": sum(1 for b in result.bounces if not b.is_in),
        }

        return result

    def _detect_ball(
        self,
        frame: np.ndarray,
        frame_id: int,
        timestamp: float
    ) -> List[Detection]:
        """检测网球"""
        results = self.model.predict(
            frame,
            conf=self.confidence,
            iou=self.iou,
            classes=[self.target_class],  # 只检测 sports ball
            verbose=False,
        )

        detections = []

        for r in results:
            if r.boxes is None:
                continue

            for box in r.boxes:
                cls = int(box.cls[0])
                if cls != self.target_class:
                    continue

                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                # 中心点
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2

                # 转换为球场坐标
                court_x, court_y = None, None
                try:
                    court_x, court_y = self.calibrator.pixel_to_court(cx, cy)
                except:
                    pass

                det = Detection(
                    frame_id=frame_id,
                    timestamp=timestamp,
                    pixel_x=cx,
                    pixel_y=cy,
                    court_x=court_x,
                    court_y=court_y,
                    confidence=conf,
                    bbox_width=x2 - x1,
                    bbox_height=y2 - y1,
                )
                detections.append(det)

        return detections

    def _draw_visualization(
        self,
        frame: np.ndarray,
        detections: List[Detection]
    ) -> np.ndarray:
        """绘制可视化"""
        vis = frame.copy()

        # 绘制球场边界 (如果有校准)
        try:
            self._draw_court_lines(vis)
        except:
            pass

        # 绘制轨迹
        if self.tracker:
            trajectory = self.tracker.get_trajectory()
            if len(trajectory) > 1:
                for i in range(1, len(trajectory)):
                    pt1 = (int(trajectory[i-1][0]), int(trajectory[i-1][1]))
                    pt2 = (int(trajectory[i][0]), int(trajectory[i][1]))
                    # 渐变颜色
                    alpha = i / len(trajectory)
                    color = (0, int(255 * alpha), int(255 * (1 - alpha)))
                    cv2.line(vis, pt1, pt2, color, 2)

        # 绘制当前检测
        for det in detections:
            cx, cy = int(det.pixel_x), int(det.pixel_y)

            # 检测框
            half_w = int(det.bbox_width / 2)
            half_h = int(det.bbox_height / 2)
            cv2.rectangle(vis,
                         (cx - half_w, cy - half_h),
                         (cx + half_w, cy + half_h),
                         (0, 255, 0), 2)

            # 中心点
            cv2.circle(vis, (cx, cy), 5, (0, 0, 255), -1)

            # 标签
            label = f"Ball {det.confidence:.2f}"
            if det.court_x is not None:
                label += f" ({det.court_x:.2f}, {det.court_y:.2f})"
            cv2.putText(vis, label, (cx + 10, cy - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # 绘制落点
        if self.tracker:
            for bounce in self.tracker.bounces[-5:]:  # 最近 5 个落点
                bx, by = int(bounce.pixel_x), int(bounce.pixel_y)
                color = (0, 255, 0) if bounce.is_in else (0, 0, 255)
                cv2.circle(vis, (bx, by), 15, color, 3)
                status = "IN" if bounce.is_in else "OUT"
                cv2.putText(vis, status, (bx + 20, by),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

        # 绘制统计信息
        if self.tracker:
            stats_text = [
                f"Detections: {len(self.tracker.positions)}",
                f"Bounces: {len(self.tracker.bounces)}",
                f"In: {sum(1 for b in self.tracker.bounces if b.is_in)}",
                f"Out: {sum(1 for b in self.tracker.bounces if not b.is_in)}",
            ]
            for i, text in enumerate(stats_text):
                cv2.putText(vis, text, (10, 30 + i * 25),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        return vis

    def _draw_court_lines(self, frame: np.ndarray):
        """绘制球场边界线"""
        hw = CourtDimensions.SINGLES_HALF_WIDTH
        hl = CourtDimensions.HALF_LENGTH

        # 球场角点
        corners = [
            (-hw, hl), (hw, hl), (hw, -hl), (-hw, -hl)
        ]

        # 转换为像素坐标
        pixel_corners = [self.calibrator.court_to_pixel(x, y) for x, y in corners]

        # 绘制边界
        for i in range(4):
            pt1 = (int(pixel_corners[i][0]), int(pixel_corners[i][1]))
            pt2 = (int(pixel_corners[(i+1)%4][0]), int(pixel_corners[(i+1)%4][1]))
            cv2.line(frame, pt1, pt2, (255, 255, 0), 1)


# ============================================================================
# 报告生成
# ============================================================================

def generate_report(result: TrackingResult, output_path: str):
    """生成测试报告"""
    report = []
    report.append("=" * 60)
    report.append("鹰眼视频测试报告")
    report.append("=" * 60)
    report.append("")

    report.append("## 视频信息")
    report.append(f"- 文件: {result.video_path}")
    report.append(f"- 帧率: {result.fps:.2f} fps")
    report.append(f"- 总帧数: {result.total_frames}")
    report.append(f"- 时长: {result.total_frames/result.fps:.2f} 秒")
    report.append("")

    report.append("## 处理统计")
    stats = result.stats
    report.append(f"- 处理时间: {stats.get('processing_time', 0):.2f} 秒")
    report.append(f"- 处理帧率: {stats.get('processing_fps', 0):.2f} fps")
    report.append(f"- 检测总数: {stats.get('total_detections', 0)}")
    report.append(f"- 检测率: {stats.get('detection_rate', 0)*100:.1f}%")
    report.append("")

    report.append("## 落点统计")
    report.append(f"- 落点总数: {stats.get('total_bounces', 0)}")
    report.append(f"- 界内: {stats.get('bounces_in', 0)}")
    report.append(f"- 出界: {stats.get('bounces_out', 0)}")
    report.append("")

    if result.bounces:
        report.append("## 落点详情")
        report.append("")
        report.append("| # | 时间(s) | 球场坐标 (m) | 判定 | 距线 (m) |")
        report.append("|---|---------|--------------|------|----------|")

        for i, bounce in enumerate(result.bounces, 1):
            status = "IN" if bounce.is_in else "OUT"
            report.append(
                f"| {i} | {bounce.timestamp:.2f} | "
                f"({bounce.court_x:.2f}, {bounce.court_y:.2f}) | "
                f"{status} | {bounce.distance_from_line:.3f} |"
            )

    report.append("")
    report.append("=" * 60)

    # 写入文件
    report_text = "\n".join(report)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report_text)

    print(report_text)
    print(f"\n报告已保存: {output_path}")

    # 同时保存 JSON 格式
    json_path = str(Path(output_path).with_suffix('.json'))
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            "video_path": result.video_path,
            "fps": result.fps,
            "total_frames": result.total_frames,
            "stats": result.stats,
            "bounces": [asdict(b) for b in result.bounces],
            "detections_count": len(result.detections),
        }, f, indent=2, ensure_ascii=False)
    print(f"JSON 数据已保存: {json_path}")


# ============================================================================
# 主程序
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="鹰眼视频测试工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 处理视频
  python hawkeye_video_test.py --video tennis_match.mp4

  # 使用已有校准
  python hawkeye_video_test.py --video tennis_match.mp4 --calibration court.json

  # 仅校准
  python hawkeye_video_test.py --video tennis_match.mp4 --calibrate-only

  # 指定输出
  python hawkeye_video_test.py --video input.mp4 --output output.mp4 --report report.txt
        """
    )

    parser.add_argument(
        "--video", "-v",
        type=str,
        required=True,
        help="输入视频路径",
    )

    parser.add_argument(
        "--output", "-o",
        type=str,
        help="输出视频路径 (带标注)",
    )

    parser.add_argument(
        "--calibration", "-c",
        type=str,
        help="校准数据文件路径 (.json)",
    )

    parser.add_argument(
        "--calibrate-only",
        action="store_true",
        help="仅进行校准，不处理视频",
    )

    parser.add_argument(
        "--model", "-m",
        type=str,
        default="yolov8n.pt",
        help="YOLO 模型路径 (默认: yolov8n.pt)",
    )

    parser.add_argument(
        "--confidence",
        type=float,
        default=0.3,
        help="检测置信度阈值 (默认: 0.3)",
    )

    parser.add_argument(
        "--report", "-r",
        type=str,
        help="测试报告输出路径",
    )

    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="不显示预览窗口",
    )

    args = parser.parse_args()

    # 检查视频文件
    if not os.path.exists(args.video):
        print(f"错误: 视频文件不存在: {args.video}")
        sys.exit(1)

    # 默认输出路径
    video_stem = Path(args.video).stem
    if args.output is None:
        args.output = str(Path(args.video).parent / f"{video_stem}_hawkeye.mp4")
    if args.report is None:
        args.report = str(Path(args.video).parent / f"{video_stem}_report.txt")

    # 创建处理器
    processor = HawkEyeVideoProcessor(
        model_path=args.model,
        confidence=args.confidence,
    )

    # 处理视频
    result = processor.process_video(
        video_path=args.video,
        output_path=args.output if not args.calibrate_only else None,
        calibration_path=args.calibration,
        calibrate_only=args.calibrate_only,
        show_preview=not args.no_preview,
    )

    # 生成报告
    if not args.calibrate_only and result.detections:
        generate_report(result, args.report)

    print("\n完成!")


if __name__ == "__main__":
    main()
